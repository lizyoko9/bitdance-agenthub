from __future__ import annotations

import io
import json
import os
import subprocess
import tempfile
import unittest
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from .judge import (BoundedJudgeRequester, JudgeBudgetExceeded, JudgeRequestError,
                    _NoRedirect, _http_transport, _perform_http_job)


def runtime(**kwargs):
    return SimpleNamespace(**{"model": "gpt-6-luna", "api_mode": "chat_completions",
                             "base_url": "https://api.openai.com/v1", "api_key": "test-only-key",
                             "timeout": 60.0, **kwargs})


def success(content='{"score":1,"reason":"fixture evidence"}', *, usage=True, finish="stop"):
    payload = {"model": "gpt-6-luna", "choices": [{"finish_reason": finish,
               "message": {"content": content}}]}
    if usage:
        payload["usage"] = {"prompt_tokens": 25, "completion_tokens": 12,
                            "prompt_tokens_details": {"cached_tokens": 5},
                            "completion_tokens_details": {"reasoning_tokens": 0}}
    return {"httpStatus": 200, "requestId": "request-fixture", "payload": payload}


class BoundedJudgeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name) / "judge"

    def test_first_request_parameters_and_usage_are_recorded_without_key(self):
        transport = Mock(return_value=success())
        requester = BoundedJudgeRequester(self.directory, transport=transport,
                                           proxy="http://127.0.0.1:7890")
        self.assertIn('"score":1', requester(runtime(), "fixture"))
        job = transport.call_args.args[0]
        payload = json.loads(job["body"])
        self.assertEqual(payload["max_completion_tokens"], 4096)
        self.assertEqual(payload["reasoning_effort"], "none")
        self.assertEqual(payload["temperature"], 0)
        self.assertNotIn("max_tokens", payload)
        self.assertEqual(job["timeout"], 60)
        self.assertEqual(job["proxy"], "http://127.0.0.1:7890")
        self.assertEqual(requester.summary()["inputTokens"], 25)
        self.assertEqual(requester.summary()["reasoningTokens"], 0)
        self.assertIsNone(requester.summary()["cacheCreationTokens"])
        self.assertTrue(requester.summary()["usageComplete"])
        for path in self.directory.iterdir():
            self.assertNotIn("test-only-key", path.read_text())

    def test_unknown_usage_is_null_not_zero(self):
        requester = BoundedJudgeRequester(self.directory, transport=lambda job: success(usage=False))
        requester(runtime(), "fixture")
        self.assertIsNone(requester.summary()["inputTokens"])
        self.assertIsNone(requester.summary()["outputTokens"])
        self.assertFalse(requester.summary()["usageComplete"])
        self.assertEqual(requester.summary()["unknownUsageRequests"], 1)

    def test_maximum_ten_transport_attempts_and_no_eleventh_request(self):
        transport = Mock(return_value=success())
        requester = BoundedJudgeRequester(self.directory, transport=transport)
        for _ in range(10):
            requester(runtime(), "fixture")
        with self.assertRaises(JudgeBudgetExceeded):
            requester(runtime(), "fixture")
        self.assertEqual(transport.call_count, 10)
        self.assertEqual(requester.summary()["requests"], 10)
        self.assertTrue(json.loads((self.directory / "summary.json").read_text())["budgetExhausted"])

    def test_utf8_request_byte_limit_is_checked_before_transport(self):
        transport = Mock(return_value=success())
        requester = BoundedJudgeRequester(self.directory, transport=transport, max_request_bytes=256)
        with self.assertRaises(JudgeBudgetExceeded):
            requester(runtime(), "证据" * 100)
        transport.assert_not_called()
        self.assertEqual(requester.summary()["requests"], 0)

    def test_cumulative_request_bytes_are_bounded(self):
        transport = Mock(return_value=success())
        requester = BoundedJudgeRequester(self.directory, transport=transport, max_total_request_bytes=400)
        requester(runtime(), "fixture" * 10)
        with self.assertRaises(JudgeBudgetExceeded):
            requester(runtime(), "fixture" * 10)
        self.assertEqual(transport.call_count, 1)

    def test_deadline_limits_single_transport_and_prevents_later_request(self):
        now = [100.0]
        transport = Mock(return_value=success())
        requester = BoundedJudgeRequester(self.directory, transport=transport, clock=lambda: now[0],
                                           wall_seconds=20)
        now[0] = 115
        requester(runtime(), "fixture")
        self.assertEqual(transport.call_args.args[0]["timeout"], 5)
        now[0] = 120
        with self.assertRaises(JudgeBudgetExceeded):
            requester(runtime(), "fixture")
        self.assertEqual(transport.call_count, 1)

    def test_late_response_is_incomplete(self):
        now = [0.0]
        def transport(job):
            now[0] = 11
            return success()
        requester = BoundedJudgeRequester(self.directory, transport=transport,
                                           clock=lambda: now[0], wall_seconds=10)
        with self.assertRaises(JudgeRequestError):
            requester(runtime(), "fixture")
        self.assertEqual(requester.requests[0]["status"], "failed")

    def test_http_error_is_not_retried_and_usage_remains_unknown(self):
        transport = Mock(return_value={"httpStatus": 429, "requestId": "fixture",
                                       "errorType": "http_error"})
        requester = BoundedJudgeRequester(self.directory, transport=transport)
        with self.assertRaises(JudgeRequestError):
            requester(runtime(), "fixture")
        transport.assert_called_once()
        self.assertEqual(requester.requests[0]["httpStatus"], 429)
        self.assertIsNone(requester.summary()["outputTokens"])

    def test_output_token_truncation_cannot_be_accepted_as_complete_score(self):
        requester = BoundedJudgeRequester(self.directory, transport=lambda job: success(finish="length"))
        with self.assertRaises(JudgeRequestError):
            requester(runtime(), "fixture")
        self.assertEqual(requester.requests[0]["finishReason"], "length")
        self.assertEqual(requester.requests[0]["status"], "failed")

    def test_endpoint_and_budget_cannot_be_relaxed(self):
        with self.assertRaises(ValueError):
            BoundedJudgeRequester(self.directory, max_requests=11)
        requester = BoundedJudgeRequester(self.directory, transport=Mock())
        with self.assertRaises(ValueError):
            requester(runtime(base_url="https://example.com/v1"), "fixture")
        with self.assertRaises(ValueError):
            requester(runtime(timeout=0), "fixture")

    def test_transport_worker_timeout_uses_no_key_argv_or_environment(self):
        job = {"timeout": 0.05, "apiKey": "test-only-key"}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-sentinel"}, clear=True), \
                patch("subprocess.run", side_effect=subprocess.TimeoutExpired("worker", .05)) as run:
            result = _http_transport(job)
        self.assertEqual(result["errorType"], "request_timeout")
        args, kwargs = run.call_args
        self.assertNotIn("test-only-key", " ".join(args[0]))
        self.assertNotIn("OPENAI_API_KEY", kwargs["env"])
        self.assertEqual(kwargs["timeout"], .05)
        self.assertEqual(json.loads(kwargs["input"])["apiKey"], "test-only-key")

    def test_worker_disables_redirect_and_uses_only_explicit_proxy(self):
        job = {"baseUrl": "https://api.openai.com/v1", "url": "https://api.openai.com/v1/chat/completions",
               "apiKey": "test-only-key", "body": "{}", "proxy": None, "timeout": 1}
        opener = Mock()
        opener.open.side_effect = urllib.error.HTTPError(job["url"], 302, "redirect", {}, io.BytesIO())
        with patch("urllib.request.build_opener", return_value=opener) as build:
            result = _perform_http_job(job)
        self.assertEqual(result["httpStatus"], 302)
        self.assertEqual(result["errorType"], "http_error")
        opener.open.assert_called_once()
        self.assertEqual(build.call_args.args[0].proxies, {})
        self.assertIsInstance(build.call_args.args[1], _NoRedirect)
        self.assertIsNone(build.call_args.args[1].redirect_request(None, None, 302, "", {}, "https://example.com"))


if __name__ == "__main__":
    unittest.main()

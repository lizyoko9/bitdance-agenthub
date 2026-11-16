from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit


JUDGE_MODEL = "gpt-6-luna"
MAX_JUDGE_REQUESTS = 10
MAX_REQUEST_BYTES = 256 * 1024
MAX_SUPPORTED_REQUEST_BYTES = 512 * 1024
MAX_TOTAL_REQUEST_BYTES = 2 * 1024 * 1024
MAX_COMPLETION_TOKENS = 4096
MAX_WALL_SECONDS = 600.0
MAX_CALL_SECONDS = 60.0
MAX_RESPONSE_BYTES = 1024 * 1024
TOKEN_FIELDS = ("inputTokens", "outputTokens", "cacheReadTokens", "cacheCreationTokens", "reasoningTokens")


def judge_request_limits(task_id: str) -> dict[str, int | float]:
    from .container_worker import CONFIRMATION_TASK_ID

    return {"maxRequests": MAX_JUDGE_REQUESTS,
            "maxRequestBytes": MAX_SUPPORTED_REQUEST_BYTES if task_id == CONFIRMATION_TASK_ID else MAX_REQUEST_BYTES,
            "maxTotalRequestBytes": MAX_TOTAL_REQUEST_BYTES, "maxCompletionTokens": MAX_COMPLETION_TOKENS,
            "wallSeconds": MAX_WALL_SECONDS, "callSeconds": MAX_CALL_SECONDS}


class JudgeRequestError(RuntimeError):
    pass


class JudgeBudgetExceeded(JudgeRequestError):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _api_url(base_url: str) -> str:
    parsed = urlsplit(base_url)
    if (parsed.scheme != "https" or parsed.hostname != "api.openai.com"
            or parsed.port not in (None, 443) or parsed.path.rstrip("/") != "/v1"
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError("Judge endpoint must be the approved https://api.openai.com/v1")
    return base_url.rstrip("/") + "/chat/completions"


def _proxy_url(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlsplit(value)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.port is None or parsed.username or parsed.password
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        raise ValueError("Judge proxy must be an explicit credential-free HTTP(S) proxy URL")
    return value.rstrip("/")


def _number(value: object) -> int | None:
    return value if type(value) is int and value >= 0 else None


def _usage(payload: dict[str, Any]) -> dict[str, int | None]:
    value = payload.get("usage")
    value = value if isinstance(value, dict) else {}
    prompt = value.get("prompt_tokens_details")
    prompt = prompt if isinstance(prompt, dict) else {}
    completion = value.get("completion_tokens_details")
    completion = completion if isinstance(completion, dict) else {}
    return {
        "inputTokens": _number(value.get("prompt_tokens")),
        "outputTokens": _number(value.get("completion_tokens")),
        "cacheReadTokens": _number(prompt.get("cached_tokens")),
        "cacheCreationTokens": _number(value.get("cache_creation_input_tokens")),
        "reasoningTokens": _number(completion.get("reasoning_tokens")),
    }


def _minimal_environment() -> dict[str, str]:
    allowed = ("PATH", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TMPDIR", "TMP", "TEMP", "SYSTEMROOT", "WINDIR")
    result = {name: os.environ[name] for name in allowed if name in os.environ}
    result["PYTHONDONTWRITEBYTECODE"] = "1"
    return result


def _perform_http_job(job: dict[str, Any]) -> dict[str, Any]:
    if job["url"] != _api_url(job["baseUrl"]):
        raise ValueError("Judge worker endpoint did not match the approved endpoint")
    proxy = _proxy_url(job.get("proxy"))
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": proxy, "https": proxy} if proxy else {}),
        _NoRedirect(),
    )
    request = urllib.request.Request(
        job["url"], data=job["body"].encode("utf-8"), method="POST",
        headers={"Authorization": "Bearer " + job["apiKey"], "Content-Type": "application/json"},
    )
    try:
        with opener.open(request, timeout=job["timeout"]) as response:
            data = response.read(MAX_RESPONSE_BYTES + 1)
            result = {"httpStatus": response.status, "requestId": response.headers.get("x-request-id")}
            if len(data) > MAX_RESPONSE_BYTES:
                return {**result, "errorType": "response_too_large"}
            try:
                payload = json.loads(data)
            except (json.JSONDecodeError, UnicodeError):
                return {**result, "errorType": "invalid_response_json"}
            return {**result, "payload": payload}
    except urllib.error.HTTPError as error:
        return {"httpStatus": error.code, "requestId": error.headers.get("x-request-id"), "errorType": "http_error"}
    except (urllib.error.URLError, OSError, TimeoutError) as error:
        return {"httpStatus": None, "requestId": None, "errorType": type(error).__name__}


def _http_transport(job: dict[str, Any]) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), "--http-worker"],
            input=json.dumps(job, ensure_ascii=False).encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=job["timeout"], check=False, env=_minimal_environment(),
        )
    except subprocess.TimeoutExpired:
        return {"httpStatus": None, "requestId": None, "errorType": "request_timeout"}
    if completed.returncode != 0:
        return {"httpStatus": None, "requestId": None, "errorType": "transport_worker_failed"}
    try:
        result = json.loads(completed.stdout)
    except (UnicodeError, json.JSONDecodeError):
        result = None
    return result if isinstance(result, dict) else {"errorType": "invalid_transport_result"}


class BoundedJudgeRequester:
    def __init__(
        self, output_dir: Path, *, proxy: str | None = None,
        transport: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
        clock: Callable[[], float] = time.monotonic,
        max_requests: int = MAX_JUDGE_REQUESTS, max_request_bytes: int = MAX_REQUEST_BYTES,
        max_total_request_bytes: int = MAX_TOTAL_REQUEST_BYTES,
        wall_seconds: float = MAX_WALL_SECONDS, call_seconds: float = MAX_CALL_SECONDS,
    ):
        for name, value, bound in (("max_requests", max_requests, MAX_JUDGE_REQUESTS),
                                   ("max_request_bytes", max_request_bytes, MAX_SUPPORTED_REQUEST_BYTES),
                                   ("max_total_request_bytes", max_total_request_bytes, MAX_TOTAL_REQUEST_BYTES)):
            if type(value) is not int or not 1 <= value <= bound:
                raise ValueError(f"Invalid bounded judge {name}")
        for name, value, bound in (("wall_seconds", wall_seconds, MAX_WALL_SECONDS),
                                   ("call_seconds", call_seconds, MAX_CALL_SECONDS)):
            if type(value) not in (int, float) or not math.isfinite(value) or not 0 < value <= bound:
                raise ValueError(f"Invalid bounded judge {name}")
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=False, mode=0o700)
        self.proxy = _proxy_url(proxy)
        self.transport = transport or _http_transport
        self.clock = clock
        self.max_requests, self.max_request_bytes = max_requests, max_request_bytes
        self.max_total_request_bytes = max_total_request_bytes
        self.wall_seconds, self.call_seconds = float(wall_seconds), float(call_seconds)
        self.started = clock()
        self.deadline = self.started + self.wall_seconds
        self.total_bytes = 0
        self.requests: list[dict[str, Any]] = []
        self.exhausted = False
        self.rejection_reason: str | None = None
        settings = {"model": JUDGE_MODEL, "reasoning_effort": "none", "max_completion_tokens": MAX_COMPLETION_TOKENS,
                    "temperature": 0, "maxRequests": max_requests, "maxRequestBytes": max_request_bytes,
                    "maxTotalRequestBytes": max_total_request_bytes, "wallSeconds": wall_seconds,
                    "callSeconds": call_seconds, "networkRetries": 0, "redirects": "error", "proxy": self.proxy,
                    "officialJsonCorrection": "at most one per rubric, counted against the same request limit",
                    "requestCountScope": "reserved transport attempts; upstream send/usage may be unknown after failure"}
        (self.output_dir / "settings.json").write_text(json.dumps(settings, indent=2) + "\n")
        (self.output_dir / "requests.jsonl").write_text("")
        self._persist_summary()

    def _persist_summary(self) -> None:
        (self.output_dir / "summary.json").write_text(json.dumps(self.summary(), indent=2) + "\n")

    def _reject(self, message: str) -> None:
        self.exhausted = True
        self.rejection_reason = message
        self._persist_summary()
        raise JudgeBudgetExceeded("judge_budget_exhausted: " + message)

    def __call__(self, runtime: Any, prompt: str) -> str:
        if runtime.model != JUDGE_MODEL or runtime.api_mode != "chat_completions" or not runtime.api_key:
            raise ValueError("Judge runtime must use the approved Luna Chat Completions profile")
        if not math.isfinite(float(runtime.timeout)) or float(runtime.timeout) <= 0:
            raise ValueError("Judge runtime timeout must be finite and positive")
        url = _api_url(runtime.base_url)
        payload = {"model": JUDGE_MODEL, "messages": [{"role": "user", "content": prompt}],
                   "reasoning_effort": "none", "max_completion_tokens": MAX_COMPLETION_TOKENS, "temperature": 0}
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        body_bytes = len(body.encode("utf-8"))
        remaining = self.deadline - self.clock()
        if self.exhausted or len(self.requests) >= self.max_requests:
            self._reject("maximum HTTP attempts reached")
        if remaining <= 0:
            self._reject("overall deadline reached")
        if body_bytes > self.max_request_bytes or self.total_bytes + body_bytes > self.max_total_request_bytes:
            self._reject("serialized request body limit exceeded")
        self.total_bytes += body_bytes
        observation = {"sequence": len(self.requests) + 1, "bodyBytes": body_bytes,
                       "startedAt": time.time(), "httpStatus": None, "requestId": None,
                       "status": "failed", "usage": _usage({}), "usageComplete": False,
                       "responseModel": None, "finishReason": None}
        self.requests.append(observation)
        try:
            response = self.transport({"baseUrl": runtime.base_url, "url": url, "apiKey": runtime.api_key,
                                       "body": body, "proxy": self.proxy,
                                       "timeout": min(self.call_seconds, remaining, float(runtime.timeout))})
            if not isinstance(response, dict):
                raise JudgeRequestError("Judge transport response was not an object")
            observation.update({key: response.get(key) for key in ("httpStatus", "requestId")})
            if response.get("errorType"):
                observation["errorType"] = response["errorType"]
                raise JudgeRequestError("Judge HTTP transport failed: " + str(response["errorType"]))
            if type(response.get("httpStatus")) is not int or not 200 <= response["httpStatus"] < 300:
                raise JudgeRequestError("Judge transport did not confirm an HTTP success status")
            value = response.get("payload")
            if not isinstance(value, dict):
                raise JudgeRequestError("Judge API response was not an object")
            observation["usage"] = _usage(value)
            observation["usageComplete"] = all(observation["usage"][field] is not None for field in ("inputTokens", "outputTokens"))
            observation["responseModel"] = value.get("model")
            choices = value.get("choices")
            choice = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
            observation["finishReason"] = choice.get("finish_reason")
            if choice.get("finish_reason") != "stop":
                raise JudgeRequestError("Judge did not finish a complete response")
            message = choice.get("message")
            content = message.get("content") if isinstance(message, dict) else None
            if not isinstance(content, str) or not content.strip():
                raise JudgeRequestError("Judge API response had no message content")
            if self.clock() > self.deadline:
                raise JudgeRequestError("Judge overall deadline elapsed during transport")
            observation["status"] = "completed"
            return content.replace(runtime.api_key, "[REDACTED]")
        except Exception as error:
            observation.setdefault("errorType", type(error).__name__)
            raise
        finally:
            observation["endedAt"] = time.time()
            with (self.output_dir / "requests.jsonl").open("a") as stream:
                stream.write(json.dumps(observation, ensure_ascii=False).replace(runtime.api_key, "[REDACTED]") + "\n")
            self._persist_summary()

    def summary(self) -> dict[str, Any]:
        totals = {field: sum(row["usage"][field] for row in self.requests)
                  if self.requests and all(row["usage"][field] is not None for row in self.requests) else None
                  for field in TOKEN_FIELDS}
        return {"requests": len(self.requests), "totalRequestBytes": self.total_bytes,
                "budgetExhausted": self.exhausted, "rejectionReason": self.rejection_reason,
                "elapsedSeconds": self.clock() - self.started,
                "usageComplete": bool(self.requests) and all(row["usageComplete"] for row in self.requests),
                "unknownUsageRequests": sum(not row["usageComplete"] for row in self.requests), **totals}


if __name__ == "__main__" and sys.argv[1:] == ["--http-worker"]:
    try:
        job = json.loads(sys.stdin.buffer.read(2 * MAX_SUPPORTED_REQUEST_BYTES + 8192))
        result = _perform_http_job(job)
    except Exception as error:
        result = {"httpStatus": None, "requestId": None, "errorType": type(error).__name__}
    sys.stdout.write(json.dumps(result, ensure_ascii=False))

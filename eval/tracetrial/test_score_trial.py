from __future__ import annotations

import json
import os
import shlex
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from tracetrial_bench.types import LayeredScoringSpec, TaskSpec, VerifierSpec
from tracetrial_bench.workspace import RunLayout

from .container_worker import CONFIRMATION_TASK_ID, GOVERNANCE_TASK_ID
from .judge import JudgeRequestError
from .score_trial import NoModelJudgeRequester, score_retained_trial
from .test_judge import large_prompt, success


class OfficialScoringTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        run = root / "run"
        self.layout = RunLayout(run, run / "agent", run / "agent" / "workspace",
                                root / "private", root / "private" / "verifier",
                                run / "artifacts", root / "baseline")
        for path in vars(self.layout).values():
            path.mkdir(parents=True, exist_ok=True)
        (self.layout.workspace_dir / "answer.txt").write_text("fixture deliverable")
        events = self.layout.artifacts_dir / "events.json"
        events.write_text(json.dumps([{"seq": 1, "event_type": "tool", "tool_result": "fixture observation"}]))
        self.trace = {"events_path": str(events), "tool_calls": 1, "user_turns": 1,
                      "stop_reason": "completed"}
        rule_payload = {"schema_version": "harnessbench_rule_results_v1", "rule_results": {
            "harness": [{"id": "h_rule", "score": 1, "reason": "fixture harness rule"}],
            "agent": [{"id": "a_rule", "score": 1, "reason": "fixture agent rule"}]}}
        verifier = self.layout.verifier_dir / "run.py"
        verifier.write_text("import json, os\n"
                            "assert not any(name in os.environ for name in "
                            "['OPENAI_API_KEY','JUDGE_API_KEY','DEEPSEEK_API_KEY','ACTOR_API_KEY'])\n"
                            "print(" + repr(json.dumps(rule_payload)) + ")\n")
        for layer, prefix in (("harness", "h"), ("agent", "a")):
            sheet = self.layout.verifier_dir / f"{layer}.yaml"
            sheet.write_text(f'''version: score_v1
layer: {layer}
items:
  - id: {prefix}_rule
    type: rule
    criterion: fixture rule
  - id: {prefix}_rubric
    type: rubric
    criterion: fixture rubric
    evidence:
      event_types: ["tool"]
      fields: ["tool_result"]
      keywords: ["fixture"]
''')
        self.task = TaskSpec("fixture-task", root, "Inspect the fixture", self.layout.workspace_dir,
                             VerifierSpec(shlex.quote(sys.executable) + " " + shlex.quote(str(verifier))),
                             max_turns=1, max_tool_calls=6, max_wall_time_sec=120,
                             scoring=LayeredScoringSpec("score_v1", self.layout.verifier_dir / "harness.yaml",
                                                       self.layout.verifier_dir / "agent.yaml"))

    def score(self, transport, *, judge_key="test-only-key"):
        # A clean test environment never consumes a real host credential.
        with patch.dict(os.environ, {"PATH": os.defpath, "OPENAI_API_KEY": "fixture-actor-key",
                                     "JUDGE_API_KEY": "fixture-judge-key",
                                     "DEEPSEEK_API_KEY": "fixture-deepseek-key"}, clear=True):
            before = dict(os.environ)
            result = score_retained_trial(task=self.task, layout=self.layout, trace_summary=self.trace,
                                           actor_settings={"model": "gpt-6-luna", "reasoningEffort": "none"},
                                           judge_key=judge_key, transport=transport, judge_proxy=None)
            self.assertEqual(dict(os.environ), before)
        return result

    def governance_rules_only(self):
        self.task = replace(self.task, task_id=GOVERNANCE_TASK_ID)
        for layer, prefix in (("harness", "h"), ("agent", "a")):
            (self.layout.verifier_dir / f"{layer}.yaml").write_text(
                f"version: score_v1\nlayer: {layer}\nitems:\n"
                f"  - id: {prefix}_rule\n    type: rule\n    criterion: fixture rule\n")

    def test_zero_rubric_governance_keeps_complete_official_scoring_without_model_transport(self):
        self.governance_rules_only()
        with patch('eval.tracetrial.score_trial.BoundedJudgeRequester') as bounded:
            result = self.score(lambda _job: self.fail('zero-rubric task reached model transport'), judge_key="")
            bounded.assert_not_called()
        self.assertEqual(result['scoringStatus'], 'completed')
        self.assertEqual(result['rawEvaluation']['score'], 100)
        self.assertEqual(result['effectiveEvaluation']['score'], 100)
        self.assertEqual(result['combinedScore']['harness_score']['passed_items'], 1)
        self.assertEqual(result['combinedScore']['agent_score']['passed_items'], 1)
        self.assertEqual(result['combinedScore']['judge_runtime']['logical_calls'], 0)
        self.assertEqual(result['combinedScore']['judge_runtime']['scoring_order'], ['rules:harness', 'rules:agent'])
        self.assertEqual(result['judge']['requests'], 0)
        self.assertTrue(result['judge']['transportProhibited'])
        self.assertEqual(result['judge']['rejectedLogicalCalls'], 0)
        self.assertEqual(result['actualSettings']['judge']['maxRequests'], 0)
        self.assertEqual(result['actualSettings']['judge']['credentialStorage'], 'not used')
        self.assertIsInstance(result['policy'], dict)
        self.assertIsInstance(result['attribution'], dict)

    def test_governance_with_any_declared_rubric_is_rejected_without_side_effects(self):
        self.task = replace(self.task, task_id=GOVERNANCE_TASK_ID)
        with patch('eval.tracetrial.score_trial.score_layout') as official:
            with self.assertRaisesRegex(ValueError, 'must declare zero LLM rubrics'):
                self.score(lambda _job: self.fail('unexpected transport'))
            official.assert_not_called()
        self.assertFalse((self.layout.artifacts_dir / 'agenthub_scoring').exists())

    def test_non_governance_rubrics_cannot_use_an_empty_key_or_zero_requester(self):
        with patch('eval.tracetrial.score_trial.NoModelJudgeRequester') as disabled:
            with self.assertRaisesRegex(ValueError, 'credential is required'):
                self.score(lambda _job: self.fail('unexpected transport'), judge_key="")
            disabled.assert_not_called()
        self.assertFalse((self.layout.artifacts_dir / 'agenthub_scoring').exists())

    def test_unexpected_governance_rubric_request_is_hard_blocked_and_makes_score_incomplete(self):
        self.governance_rules_only()
        def official(**kwargs):
            self.assertEqual(kwargs['judge_runtime'].api_key, '')
            kwargs['judge_requester'](kwargs['judge_runtime'], 'unexpected rubric')
        with patch('eval.tracetrial.score_trial.score_layout', side_effect=official):
            result = self.score(lambda _job: self.fail('hard block reached model transport'))
        self.assertEqual(result['scoringStatus'], 'incomplete')
        self.assertIsNone(result['combinedScore'])
        self.assertIsNone(result['rawEvaluation'])
        self.assertEqual(result['error']['type'], 'JudgeRequestError')
        self.assertEqual(result['judge']['requests'], 0)
        self.assertEqual(result['judge']['rejectedLogicalCalls'], 1)

    def test_zero_requester_always_rejects_without_acquiring_a_transport(self):
        requester = NoModelJudgeRequester(self.layout.artifacts_dir / 'disabled-judge')
        with self.assertRaises(JudgeRequestError):
            requester(object(), 'unexpected rubric')
        self.assertEqual(requester.summary()['requests'], 0)
        self.assertEqual((requester.output_dir / 'requests.jsonl').read_text(), '')

    def test_real_official_rules_judging_aggregation_and_policy(self):
        jobs = []
        def transport(job):
            jobs.append(job)
            self.assertNotIn("OPENAI_API_KEY", os.environ)
            return success()
        result = self.score(transport)
        self.assertEqual(result["scoringStatus"], "completed")
        self.assertEqual(result["combinedScore"]["score"], 100)
        self.assertEqual(result["rawEvaluation"]["score"], 100)
        self.assertEqual(result["effectiveEvaluation"]["score"], 100)
        self.assertEqual(result["combinedScore"]["judge_runtime"]["scoring_order"],
                         ["rules:harness", "rules:agent", "rubric:agent:a_rubric", "rubric:harness:h_rubric"])
        self.assertEqual(result["combinedScore"]["harness_score"]["points"], 50)
        self.assertIsInstance(result["attribution"], dict)
        self.assertIsInstance(result["policy"], dict)
        self.assertEqual(len(jobs), 2)
        self.assertEqual(result["judge"]["requests"], 2)
        self.assertEqual(result['actualSettings']['judge']['maxRequestBytes'], 256 * 1024)
        self.assertEqual(result['actualSettings']['judge']['maxTotalRequestBytes'], 2 * 1024 * 1024)
        self.assertTrue(Path(result["policyPath"]).is_file())
        for path in (self.layout.artifacts_dir / "agenthub_scoring").rglob("*"):
            if path.is_file():
                self.assertNotIn("test-only-key", path.read_text())

    def test_default_task_rejects_large_actual_request_before_any_transport(self):
        calls = []

        def official(**kwargs):
            kwargs['judge_requester'](kwargs['judge_runtime'], large_prompt())

        with patch('eval.tracetrial.score_trial.score_layout', side_effect=official):
            result = self.score(lambda job: calls.append(job))
        self.assertEqual(calls, [])
        self.assertEqual(result['scoringStatus'], 'incomplete')
        self.assertEqual(result['error']['type'], 'JudgeBudgetExceeded')
        self.assertEqual(result['actualSettings']['judge']['maxRequestBytes'], 256 * 1024)
        self.assertEqual(result['judge']['requests'], 0)

    def test_confirmation_explicitly_accepts_large_actual_request_and_records_unchanged_other_guards(self):
        self.task = replace(self.task, task_id=CONFIRMATION_TASK_ID)
        calls = []

        def official(**kwargs):
            kwargs['judge_requester'](kwargs['judge_runtime'], large_prompt())

        def transport(job):
            calls.append(job)
            return success()

        with patch('eval.tracetrial.score_trial.score_layout', side_effect=official):
            result = self.score(transport)
        self.assertEqual(len(calls), 1)
        body_bytes = len(calls[0]['body'].encode('utf-8'))
        self.assertGreater(body_bytes, 510000)
        self.assertLessEqual(body_bytes, 512 * 1024)
        self.assertEqual(result['judge']['requests'], 1)
        self.assertFalse(result['judge']['budgetExhausted'])
        settings = result['actualSettings']['judge']
        self.assertEqual({key: settings[key] for key in ('maxRequests', 'maxRequestBytes', 'maxTotalRequestBytes',
                         'maxCompletionTokens', 'wallSeconds', 'callSeconds')},
                         {'maxRequests': 10, 'maxRequestBytes': 524288, 'maxTotalRequestBytes': 2097152,
                          'maxCompletionTokens': 4096, 'wallSeconds': 600.0, 'callSeconds': 60.0})
        self.assertEqual(settings['networkRetries'], 0)
        self.assertEqual(calls[0]['timeout'], 60)
        self.assertEqual(result['scoringStatus'], 'incomplete')
        self.assertIsNone(result['combinedScore'])

    def test_confirmation_scoring_does_not_widen_the_cumulative_judge_guard(self):
        self.task = replace(self.task, task_id=CONFIRMATION_TASK_ID)
        calls = []

        def official(**kwargs):
            for _ in range(5):
                kwargs['judge_requester'](kwargs['judge_runtime'], large_prompt())

        def transport(job):
            calls.append(job)
            return success()

        with patch('eval.tracetrial.score_trial.score_layout', side_effect=official):
            result = self.score(transport)
        self.assertEqual(len(calls), 4)
        self.assertEqual(result['error']['type'], 'JudgeBudgetExceeded')
        self.assertTrue(result['judge']['budgetExhausted'])
        self.assertLessEqual(result['judge']['totalRequestBytes'], 2 * 1024 * 1024)

    def test_official_parse_correction_is_preserved_and_budgeted(self):
        contents = iter(["invalid fixture JSON", '{"score":1,"reason":"fixture evidence"}',
                         '{"score":1,"reason":"fixture evidence"}'])
        result = self.score(lambda job: success(next(contents)))
        self.assertEqual(result["scoringStatus"], "completed")
        self.assertEqual(result["judge"]["requests"], 3)
        self.assertIn("rubric:agent:a_rubric:retry",
                      result["combinedScore"]["judge_runtime"]["scoring_order"])
        self.assertTrue((self.layout.artifacts_dir / "llm_judge" / "agent" / "a_rubric" /
                         "raw_response.retry.txt").is_file())

    def test_unexercised_original_score_and_attribution_are_retained(self):
        contents = iter(['{"score":1,"reason":"fixture passed"}',
                         '{"score":2,"reason":"fixture mechanism not exercised"}'])
        result = self.score(lambda job: success(next(contents)))
        self.assertEqual(result["scoringStatus"], "completed")
        item = result["unexercisedCriteria"][0]
        self.assertEqual(item["original_score"], 2)
        self.assertEqual(item["score"], 1)
        self.assertIn("resolved_from", item)
        self.assertEqual(result["combinedScore"]["score"], 100)

    def test_http_failure_keeps_rules_without_fabricating_full_score(self):
        calls = []
        def transport(job):
            calls.append(job)
            return {"httpStatus": 500, "errorType": "http_error"}
        result = self.score(transport)
        self.assertEqual(result["scoringStatus"], "incomplete")
        self.assertIsNotNone(result["ruleScore"])
        for field in ("combinedScore", "rawEvaluation", "effectiveEvaluation", "policy", "attribution"):
            self.assertIsNone(result[field])
        self.assertEqual(result["judge"]["requests"], 1)
        self.assertEqual(len(calls), 1)
        self.assertIsNone(result["judge"]["inputTokens"])
        self.assertEqual(result["error"]["type"], "JudgeRequestError")

    def test_invalid_rule_verifier_makes_no_model_call_or_probe(self):
        (self.layout.verifier_dir / "run.py").write_text("raise RuntimeError('fixture verifier failure')\n")
        calls = []
        result = self.score(lambda job: calls.append(job))
        self.assertEqual(result["scoringStatus"], "incomplete")
        self.assertEqual(calls, [])
        self.assertEqual(result["judge"]["requests"], 0)
        self.assertIsNone(result["combinedScore"])
        self.assertIsNone(result["judge"]["inputTokens"])

    def test_second_parse_failure_does_not_retry_or_fabricate_score(self):
        calls = []
        def transport(job):
            calls.append(job)
            return success("invalid fixture JSON")
        result = self.score(transport)
        self.assertEqual(result["scoringStatus"], "incomplete")
        self.assertIsNone(result["combinedScore"])
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["judge"]["requests"], 2)
        self.assertEqual(result["error"]["type"], "ValueError")


if __name__ == "__main__":
    unittest.main()

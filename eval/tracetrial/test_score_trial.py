from __future__ import annotations

import json
import os
import shlex
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tracetrial_bench.types import LayeredScoringSpec, TaskSpec, VerifierSpec
from tracetrial_bench.workspace import RunLayout

from .score_trial import score_retained_trial
from .test_judge import success


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

    def score(self, transport):
        # A clean test environment never consumes a real host credential.
        with patch.dict(os.environ, {"PATH": os.defpath, "OPENAI_API_KEY": "fixture-actor-key",
                                     "JUDGE_API_KEY": "fixture-judge-key",
                                     "DEEPSEEK_API_KEY": "fixture-deepseek-key"}, clear=True):
            before = dict(os.environ)
            result = score_retained_trial(task=self.task, layout=self.layout, trace_summary=self.trace,
                                           actor_settings={"model": "gpt-6-luna", "reasoningEffort": "none"},
                                           judge_key="test-only-key", transport=transport, judge_proxy=None)
            self.assertEqual(dict(os.environ), before)
        return result

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
        self.assertTrue(Path(result["policyPath"]).is_file())
        for path in (self.layout.artifacts_dir / "agenthub_scoring").rglob("*"):
            if path.is_file():
                self.assertNotIn("test-only-key", path.read_text())

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

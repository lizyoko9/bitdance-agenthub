import hashlib
import json
from dataclasses import replace
from pathlib import Path
import unittest
from unittest.mock import Mock

from tracetrial_bench.evidence_finder import EvidenceFinder
from tracetrial_bench import llm_judge as official
from tracetrial_bench.score_config import load_score_sheet

from . import test_score_trial as scoring_fixture
from .container_worker import MOUNTCHECK_TASK_ID
from .judge import BoundedJudgeRequester, JudgeBudgetExceeded, JudgeRequestError, serialize_judge_body
from .judge_plan import PlannedJudgeRequester
from .test_judge import runtime, success


class JudgeInputPlanTests(unittest.TestCase):
    def setUp(self):
        scoring_fixture.OfficialScoringTests.setUp(self)
        self.task = replace(self.task, task_id=MOUNTCHECK_TASK_ID)
        (self.task.task_dir / 'task.yaml').write_text('id: ' + MOUNTCHECK_TASK_ID + '\n')
        (self.task.task_dir / 'prompt.md').write_text(self.task.prompt)
        self.harness_path = self.task.scoring.harness_score_path
        text = self.harness_path.read_text().replace('h_rubric', 'h_first')
        second = text[text.index('  - id: h_first'):].replace('h_first', 'h_second').replace('fixture rubric', 'second fixture rubric')
        self.harness_path.write_text(text + second)
        agent_path = self.task.scoring.agent_score_path
        agent_path.write_text(agent_path.read_text().split('  - id: a_rubric')[0])

    def score(self, transport):
        return scoring_fixture.OfficialScoringTests.score(self, transport)

    def write_rules(self):
        path = self.layout.artifacts_dir / 'verifier_output/score.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'schema_version': 'harnessbench_rule_results_v1', 'rule_results': {
            'harness': [{'id': 'h_rule', 'score': 1, 'reason': 'fixture harness rule'}],
            'agent': [{'id': 'a_rule', 'score': 1, 'reason': 'fixture agent rule'}]}}))
        return path

    def prompts(self):
        rules = official._load_rule_payload(self.write_rules())
        agent = load_score_sheet(self.task.scoring.agent_score_path, expected_layer='agent')
        agent_score = official._finalize_layer(agent, official._score_rules(agent, rules))
        finder = EvidenceFinder(run_dir=self.layout.run_dir, workspace_dir=self.layout.workspace_dir,
            baseline_dir=self.layout.baseline_dir, trace_summary=self.trace)
        harness = load_score_sheet(self.harness_path, expected_layer='harness')
        return [official._judge_prompt(task_prompt=self.task.prompt, layer='harness', item=item,
            evidence=finder.find(item.evidence, focus='trajectory').to_dict(), evidence_focus='trajectory',
            agent_score=agent_score) for item in harness.rubric_items]

    def requester(self, **limits):
        self.write_rules()
        self.transport = Mock(return_value=success())
        bounded = BoundedJudgeRequester(self.layout.artifacts_dir / 'direct-judge', transport=self.transport, **limits)
        self.plan_path = self.layout.artifacts_dir / 'plan.json'
        planned = PlannedJudgeRequester(task=self.task, layout=self.layout, trace_summary=self.trace,
            requester=bounded, plan_path=self.plan_path)
        return planned, bounded

    def test_full_official_synthetic_pipeline_uses_two_exact_planned_prompts(self):
        jobs = []
        result = self.score(lambda job: (jobs.append(job), success())[1])
        self.assertEqual(result['scoringStatus'], 'completed')
        self.assertEqual(result['combinedScore']['score'], 100)
        self.assertEqual(result['judge']['requests'], 2)
        plan_file = self.layout.artifacts_dir / 'agenthub_scoring/judge-input-plan.json'
        plan = json.loads(plan_file.read_text())
        self.assertEqual(plan['status'], 'completed')
        self.assertEqual(plan['limits'], {'maxRequests': 10, 'maxRequestBytes': 262144, 'maxTotalRequestBytes': 2097152})
        self.assertEqual([row['id'] for row in plan['rubrics']], ['h_first', 'h_second'])
        for row, job in zip(plan['rubrics'], jobs, strict=True):
            body = job['body'].encode('utf-8')
            prompt = json.loads(body)['messages'][0]['content']
            self.assertEqual(row['bodyBytes'], len(body))
            self.assertEqual(row['bodySha256'], hashlib.sha256(body).hexdigest())
            saved = self.layout.artifacts_dir / 'llm_judge/harness' / row['id'] / 'judge_input.md'
            self.assertEqual(saved.read_text(), prompt)
        self.assertEqual(plan['worstCorrectionTotalBytes'], 2 * sum(len(job['body'].encode()) for job in jobs))
        for reference in plan['sources']:
            self.assertEqual(reference['sha256'], hashlib.sha256(Path(reference['path']).read_bytes()).hexdigest())
        self.assertNotIn('test-only-key', plan_file.read_text())

    def test_official_same_prompt_corrections_are_bound_and_counted_once_each(self):
        contents = iter(['invalid', '{"score":1,"reason":"fixture evidence"}',
                         'invalid', '{"score":1,"reason":"fixture evidence"}'])
        jobs = []
        result = self.score(lambda job: (jobs.append(job), success(next(contents)))[1])
        self.assertEqual(result['scoringStatus'], 'completed')
        self.assertEqual(result['judge']['requests'], 4)
        self.assertEqual(jobs[0]['body'], jobs[1]['body'])
        self.assertEqual(jobs[2]['body'], jobs[3]['body'])
        plan = json.loads((self.layout.artifacts_dir / 'agenthub_scoring/judge-input-plan.json').read_text())
        self.assertEqual([row['callForRubric'] for row in plan['authorizedLogicalCalls']], [1, 2, 1, 2])
        self.assertEqual(result['judge']['totalRequestBytes'], plan['worstCorrectionTotalBytes'])

    def test_second_prompt_overflow_rejects_before_even_the_small_first_http(self):
        self.harness_path.write_text(self.harness_path.read_text().replace('second fixture rubric', 'x' * 300000))
        jobs = []
        result = self.score(lambda job: jobs.append(job))
        self.assertEqual(jobs, [])
        self.assertEqual(result['scoringStatus'], 'incomplete')
        self.assertIsNone(result['rawEvaluation'])
        self.assertIsNone(result['effectiveEvaluation'])
        self.assertEqual(result['judge']['requests'], 0)
        self.assertTrue(result['judge']['budgetExhausted'])
        self.assertEqual(result['error']['type'], 'JudgeBudgetExceeded')
        plan = json.loads((self.layout.artifacts_dir / 'agenthub_scoring/judge-input-plan.json').read_text())
        self.assertEqual(plan['status'], 'rejected')
        self.assertLess(plan['rubrics'][0]['bodyBytes'], 262144)
        self.assertGreater(plan['rubrics'][1]['bodyBytes'], 262144)

    def test_correction_total_guard_is_checked_before_first_transport(self):
        first = self.prompts()[0]
        planned, bounded = self.requester(max_total_request_bytes=1)
        with self.assertRaises(JudgeBudgetExceeded):
            planned(runtime(), first)
        self.transport.assert_not_called()
        self.assertEqual(bounded.summary()['requests'], 0)
        self.assertIn('correction total', bounded.summary()['rejectionReason'])

    def test_worst_correction_request_count_is_checked_before_transport(self):
        first = self.prompts()[0]
        planned, bounded = self.requester(max_requests=3)
        with self.assertRaises(JudgeBudgetExceeded):
            planned(runtime(), first)
        self.transport.assert_not_called()
        self.assertEqual(bounded.summary()['requests'], 0)

    def test_first_unknown_or_reordered_prompt_is_rejected_without_http(self):
        second = self.prompts()[1]
        planned, bounded = self.requester()
        with self.assertRaisesRegex(JudgeRequestError, 'order differs'):
            planned(runtime(), second)
        self.transport.assert_not_called()
        self.assertEqual(bounded.summary()['requests'], 0)

    def test_first_actual_prompt_must_match_full_planned_text(self):
        first = self.prompts()[0]
        planned, bounded = self.requester()
        with self.assertRaisesRegex(JudgeRequestError, 'not a planned'):
            planned(runtime(), first + '\nchanged')
        self.transport.assert_not_called()
        self.assertEqual(bounded.summary()['requests'], 0)

    def test_second_actual_prompt_drift_does_not_forward_another_http(self):
        first, second = self.prompts()
        planned, bounded = self.requester()
        planned(runtime(), first)
        with self.assertRaisesRegex(JudgeRequestError, 'not a planned'):
            planned(runtime(), second + ' changed')
        self.assertEqual(self.transport.call_count, 1)
        self.assertEqual(bounded.summary()['requests'], 1)

    def test_third_same_rubric_call_is_rejected_before_transport(self):
        first = self.prompts()[0]
        planned, bounded = self.requester()
        planned(runtime(), first)
        planned(runtime(), first)
        with self.assertRaisesRegex(JudgeRequestError, 'more than one correction'):
            planned(runtime(), first)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(bounded.summary()['requests'], 2)

    def test_changed_source_is_rejected_even_if_actual_prompt_matches(self):
        first, second = self.prompts()
        planned, bounded = self.requester()
        planned(runtime(), first)
        (self.layout.workspace_dir / 'answer.txt').write_text('changed evidence')
        with self.assertRaisesRegex(JudgeRequestError, 'source changed'):
            planned(runtime(), second)
        self.assertEqual(self.transport.call_count, 1)
        self.assertEqual(bounded.summary()['requests'], 1)

    def test_missing_rule_source_stays_incomplete_and_persists_failure_without_key(self):
        planned, bounded = self.requester()
        (self.layout.artifacts_dir / 'verifier_output/score.json').unlink()
        with self.assertRaisesRegex(JudgeRequestError, 'planning failed'):
            planned(runtime(), 'unplanned')
        self.transport.assert_not_called()
        self.assertEqual(bounded.summary()['requests'], 0)
        text = self.plan_path.read_text()
        self.assertNotIn(runtime().api_key, text)
        self.assertEqual(json.loads(text)['status'], 'rejected')

    def test_shared_serializer_counts_utf8_and_json_escaping_exactly(self):
        prompt = '检查 "value"\\\n'
        body = serialize_judge_body(prompt)
        payload = json.loads(body)
        self.assertEqual(payload['messages'][0]['content'], prompt)
        self.assertGreater(len(body.encode('utf-8')), len(body))
        expected = json.dumps({'model': 'gpt-6-luna', 'messages': [{'role': 'user', 'content': prompt}],
            'reasoning_effort': 'none', 'max_completion_tokens': 4096, 'temperature': 0},
            ensure_ascii=False, separators=(',', ':'))
        self.assertEqual(body, expected)

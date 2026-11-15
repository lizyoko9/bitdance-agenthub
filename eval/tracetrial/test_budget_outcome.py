import unittest

from .budget_contract import build_budget_plan
from .budget_outcome import classify_budget_outcome


TASK = {'maxUserTurns': 12, 'maxToolCalls': 80, 'maxWallTimeSeconds': 1200}


class BudgetOutcomeTests(unittest.TestCase):
    def plan(self, **kwargs):
        return build_budget_plan('G1-registry-cleanup-002', TASK, **kwargs)

    def test_complete_on_the_last_request_is_not_exhaustion(self):
        result = classify_budget_outcome(self.plan(), {'terminationReason': 'completed', 'runStatus': 'complete'},
            {'actual_upstream_requests': 81, 'total_request_bytes': 21233664})
        self.assertEqual(result['kind'], 'not_limited')
        self.assertIsNone(result['limit'])
        self.assertFalse(result['resourceLimited'])

    def test_official_tool_and_wall_limits_remain_task_budget_outcomes(self):
        tool = classify_budget_outcome(self.plan(), {'terminationReason': 'budget_exhausted',
            'error': 'budget_exhausted: maximum tool calls reached'})
        wall = classify_budget_outcome(self.plan(), process={'timed_out': True})
        self.assertEqual((tool['kind'], tool['limitValue']), ('task_budget_exhausted', 80))
        self.assertEqual((wall['kind'], wall['limitValue']), ('task_budget_exhausted', 1200000))

    def test_smaller_explicit_tool_time_limits_are_resource_limited(self):
        plan = self.plan(mode='constrained', overrides={'maxToolCalls': 6, 'timeoutMs': 120000})
        for native, process in (({'terminationReason': 'budget_exhausted',
                'error': 'budget_exhausted: maximum tool calls reached'}, {}), ({}, {'timed_out': True})):
            with self.subTest(native=native):
                result = classify_budget_outcome(plan, native, process)
                self.assertEqual(result['kind'], 'resource_limited')
                self.assertTrue(result['constrainedExperiment'])
                self.assertFalse(result['taskBudgetMatched'])
                self.assertEqual(result['limitSource']['kind'], 'explicit_override')

    def test_completed_constrained_run_keeps_its_experimental_scope(self):
        result = classify_budget_outcome(self.plan(mode='constrained', overrides={'maxToolCalls': 6}),
            {'terminationReason': 'completed', 'runStatus': 'complete'})
        self.assertEqual(result['kind'], 'not_limited')
        self.assertTrue(result['constrainedExperiment'])

    def test_each_extra_guard_has_an_observed_resource_reason(self):
        for limit in ('http_requests', 'request_bytes', 'total_request_bytes'):
            with self.subTest(limit=limit):
                result = classify_budget_outcome(self.plan(), process={
                    'budget_rejection': {'limit': limit, 'reason': 'recorded rejection'}})
                self.assertEqual(result['kind'], 'resource_limited')
                self.assertEqual(result['limit'], limit)
        for reason in ('iteration_limit', 'output_limit'):
            with self.subTest(reason=reason):
                self.assertEqual(classify_budget_outcome(self.plan(), {'terminationReason': reason})['kind'],
                                 'resource_limited')

    def test_transport_wrapping_does_not_hide_worker_rejection(self):
        result = classify_budget_outcome(self.plan(), {'terminationReason': 'error', 'error': 'upstream 502'},
            {'budget_rejection': {'limit': 'total_request_bytes', 'reason': 'body total exhausted'}})
        self.assertEqual(result['kind'], 'resource_limited')
        self.assertEqual(result['evidence'], 'worker.budget_rejection')

    def test_missing_or_unrelated_error_evidence_stays_unknown(self):
        for native in (None, {'terminationReason': 'error', 'error': 'network failed'},
                       {'terminationReason': 'budget_exhausted', 'error': 'unknown budget failure'}):
            with self.subTest(native=native):
                result = classify_budget_outcome(self.plan(), native, {'actual_upstream_requests': 81})
                self.assertEqual(result['kind'], 'unknown')
                self.assertFalse(result['resourceLimited'])


if __name__ == '__main__':
    unittest.main()

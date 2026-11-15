import copy
import unittest

from .budget_contract import (MAX_TIMER_MS, build_budget_plan, budget_plan_digest,
                              validate_budget_plan)


G1 = {'maxUserTurns': 12, 'maxToolCalls': 80, 'maxWallTimeSeconds': 1200}


class BudgetContractTests(unittest.TestCase):
    def test_g1_covers_eighty_tools_and_a_final_model_response_without_old_bottlenecks(self):
        plan = build_budget_plan('G1-registry-cleanup-002', G1)
        self.assertEqual(plan['actor'], {'userInputs': 1, 'timeoutMs': 1_200_000,
            'maxToolCalls': 80, 'maxTurns': 81, 'requestLimits': {
                'maxRequests': 81, 'maxRequestBytes': 262144,
                'maxTotalRequestBytes': 21_233_664, 'maxCompletionTokens': 8192}})
        self.assertTrue(plan['coverage']['completeTaskTrajectory'])
        self.assertEqual(plan['sources']['maxToolCalls']['kind'], 'task')
        self.assertEqual(plan['sources']['maxRequests']['source'], 'actor.maxTurns')
        self.assertEqual(plan['sources']['maxRequestBytes']['kind'], 'resource_guard_default')
        self.assertEqual(validate_budget_plan(plan, task_id=plan['taskId'], task_budget=G1), plan)

    def test_multiple_task_sizes_derive_from_tools_instead_of_user_turns_or_task_ids(self):
        for tools, seconds, users in ((1, 1, 6), (6, 120, 1), (32, 900, 8), (80, 1200, 12), (255, 1, 1)):
            with self.subTest(tools=tools):
                plan = build_budget_plan('synthetic-task', {
                    'maxUserTurns': users, 'maxToolCalls': tools, 'maxWallTimeSeconds': seconds})
                self.assertEqual(plan['actor']['userInputs'], 1)
                self.assertEqual(plan['actor']['maxTurns'], tools + 1)
                self.assertEqual(plan['actor']['requestLimits']['maxRequests'], tools + 1)
                self.assertEqual(plan['actor']['requestLimits']['maxTotalRequestBytes'], (tools + 1) * 262144)
                self.assertEqual(plan['actor']['timeoutMs'], seconds * 1000)

    def test_hidden_task_mode_bottlenecks_are_rejected_including_transport_guards(self):
        for override in ({'maxToolCalls': 6}, {'timeoutMs': 120000}, {'maxTurns': 32},
                         {'maxRequests': 16}, {'maxTotalRequestBytes': 2 * 1024 * 1024},
                         {'maxRequestBytes': 65536}, {'maxCompletionTokens': 2048}):
            with self.subTest(override=override), self.assertRaisesRegex(ValueError, 'does not cover'):
                build_budget_plan('G1-registry-cleanup-002', G1, overrides=override)

    def test_explicit_constrained_experiment_records_reductions_and_every_override_source(self):
        overrides = {'maxToolCalls': 6, 'timeoutMs': 120000, 'maxTurns': 32,
                     'maxRequests': 16, 'maxTotalRequestBytes': 2 * 1024 * 1024,
                     'maxCompletionTokens': 2048}
        plan = build_budget_plan('G1-registry-cleanup-002', G1, mode='constrained', overrides=overrides)
        self.assertEqual(plan['overrides'], overrides)
        self.assertEqual(plan['taskBudget'], G1)
        self.assertFalse(plan['coverage']['completeTaskTrajectory'])
        self.assertFalse(plan['coverage']['maxToolCalls']['covered'])
        self.assertFalse(plan['coverage']['maxRequests']['covered'])
        self.assertFalse(plan['coverage']['maxTotalRequestBytes']['covered'])
        for name in overrides:
            self.assertEqual(plan['sources'][name], {'kind': 'explicit_override', 'source': 'overrides.' + name})
        self.assertEqual(validate_budget_plan(plan), plan)

    def test_headroom_is_explicit_but_neither_mode_can_exceed_official_tools_or_time(self):
        plan = build_budget_plan('G1-registry-cleanup-002', G1,
                                 overrides={'maxTurns': 100, 'maxRequests': 100})
        self.assertTrue(plan['coverage']['completeTaskTrajectory'])
        self.assertEqual(plan['actor']['maxTurns'], 100)
        for mode in ('task', 'constrained'):
            for overrides in ({'maxToolCalls': 81}, {'timeoutMs': 1200001}):
                with self.subTest(mode=mode, overrides=overrides), self.assertRaisesRegex(ValueError, 'cannot exceed'):
                    build_budget_plan('G1-registry-cleanup-002', G1, mode=mode, overrides=overrides)

    def test_unsupported_technical_domains_are_rejected_instead_of_clamped(self):
        for changes in ({'maxToolCalls': 10001}, {'maxToolCalls': 10000}, {'maxToolCalls': 1000},
                        {'maxToolCalls': 256}, {'maxWallTimeSeconds': MAX_TIMER_MS // 1000 + 1},
                        {'maxUserTurns': 0}, {'maxWallTimeSeconds': True}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                build_budget_plan('synthetic-task', {**G1, **changes})
        for changes in ({'maxRequests': 1001}, {'maxTurns': 10001}, {'maxRequestBytes': 262145},
                        {'maxCompletionTokens': 8193}, {'maxTotalRequestBytes': 64 * 1024 * 1024 + 1},
                        {'timeoutMs': MAX_TIMER_MS + 1}, {'maxRequests': True}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                build_budget_plan('synthetic-task', G1, mode='constrained', overrides=changes)

    def test_plan_timeout_precision_matches_the_official_whole_second_runner_policy(self):
        for timeout in (1, 999, 1001, 2500):
            with self.subTest(timeout=timeout), self.assertRaisesRegex(ValueError, 'require whole seconds'):
                build_budget_plan('G1-registry-cleanup-002', G1, mode='constrained', overrides={'timeoutMs': timeout})

    def test_exact_plan_reconstruction_rejects_stale_effective_values_sources_and_coverage(self):
        original = build_budget_plan('G1-registry-cleanup-002', G1)
        for mutate in (lambda p: p['actor'].update(maxTurns=32),
                       lambda p: p['actor'].update(userInputs=True),
                       lambda p: p['sources']['maxToolCalls'].update(source='a different task'),
                       lambda p: p['coverage'].update(completeTaskTrajectory=False),
                       lambda p: p.update(unrecognized=True)):
            with self.subTest(mutate=mutate):
                plan = copy.deepcopy(original)
                mutate(plan)
                with self.assertRaises(ValueError):
                    validate_budget_plan(plan)
        with self.assertRaisesRegex(ValueError, 'stale'):
            validate_budget_plan(original, task_budget={**G1, 'maxToolCalls': 79})
        with self.assertRaisesRegex(ValueError, 'task ID'):
            validate_budget_plan(original, task_id='different-task')

    def test_digest_is_deterministic_and_all_input_shapes_are_explicit(self):
        plan = build_budget_plan('G1-registry-cleanup-002', G1)
        self.assertEqual(budget_plan_digest(plan), budget_plan_digest(dict(reversed(list(plan.items())))))
        self.assertEqual(len(budget_plan_digest(plan)), 64)
        self.assertNotEqual(budget_plan_digest(plan), budget_plan_digest(
            build_budget_plan('G1-registry-cleanup-002', G1, mode='constrained')))
        for overrides in ({'requestLimits': {}}, {'maxRequests': '81'}, {'maxTurns': 81.0}, []):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                build_budget_plan('synthetic-task', G1, overrides=overrides)
        with self.assertRaises(ValueError):
            build_budget_plan('../private', G1)
        with self.assertRaises(ValueError):
            build_budget_plan('synthetic-task', {**G1, 'extra': 1})


if __name__ == '__main__':
    unittest.main()

from dataclasses import replace
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.types import ExecutionProbeSpec

from .container_worker import APPROVED_TASK_IDS, GOVERNANCE_TASK_ID, TIMEOUT_TASK_ID
from .budget_contract import build_budget_plan, budget_plan_digest
from .task_admission import actor_request, actor_settings, admit_task, task_budget_values


SOURCE = Path('/private/tmp/agenthub-tracetrial-source')


class TaskAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.task = resolve_task(SOURCE/'Task'/'E8-exit-code-masked-by-output-001')

    def test_all_approved_tasks_preserve_one_user_input_and_independent_internal_turns(self):
        for task_id, user_ceiling, rubrics in zip(APPROVED_TASK_IDS, (6, 6, 1, 12, 6), (4, 2, 5, 0, 4), strict=True):
            with self.subTest(task=task_id):
                task = resolve_task(SOURCE/'Task'/task_id)
                report, request = admit_task(task)
                self.assertEqual(report['status'], 'supported')
                self.assertIsNone(report['score'])
                self.assertEqual(report['reasons'], [])
                self.assertEqual(request['instruction'], task.prompt)
                expected_tools = task.max_tool_calls
                self.assertEqual(request['maxTurns'], expected_tools + 1)
                self.assertEqual(request['maxToolCalls'], expected_tools)
                self.assertEqual(request['timeoutMs'], task.max_wall_time_sec * 1000)
                self.assertEqual(request['requestLimits']['maxRequests'], expected_tools + 1)
                self.assertEqual(request['requestLimits']['maxTotalRequestBytes'], (expected_tools + 1) * 262144)
                self.assertTrue(report['budgetPlan']['coverage']['completeTaskTrajectory'])
                self.assertEqual(report['budgetPlanDigest'], budget_plan_digest(report['budgetPlan']))
                settings = report['effectiveActor']
                self.assertEqual(settings['userTurns'], 1)
                self.assertEqual(settings['taskUserTurnCeiling'], user_ceiling)
                self.assertEqual(settings['declaredRuntime'], {
                    'timeoutSeconds': 1200 if task_id == GOVERNANCE_TASK_ID else 600, 'networkMode': 'none'})
                self.assertEqual(settings['timeoutSeconds'], task.max_wall_time_sec)
                self.assertEqual(settings['networkMode'], 'bridge')
                self.assertEqual(report['judgeCoverage'], {'rubrics': rubrics, 'maxRequests': 0 if task_id == GOVERNANCE_TASK_ID else 10,
                                                          'worstCaseRequests': 2 * rubrics})

    def test_timeout_task_budget_and_capabilities_are_scoped_to_the_installed_observer_policy(self):
        task = resolve_task(SOURCE/'Task'/TIMEOUT_TASK_ID)
        report, request = admit_task(task)
        self.assertEqual(report['status'], 'supported')
        self.assertEqual((request['maxToolCalls'], request['maxTurns'], request['timeoutMs']), (6, 7, 120000))
        self.assertEqual(request['requestLimits']['maxRequests'], 7)
        self.assertEqual(request['requestLimits']['maxTotalRequestBytes'], 1835008)
        self.assertEqual(report['declaredRuntime']['timeout_sec'], 600)
        self.assertEqual(report['judgeCoverage'], {'rubrics': 4, 'maxRequests': 10, 'worstCaseRequests': 8})
        self.assertEqual(report['capabilities'], {'required': ['native_exec_v1', 'post_tool_v1',
            'timeout_observation_v1', 'process_containment_v1'], 'available': ['native_exec_v1', 'post_tool_v1',
            'timeout_observation_v1', 'process_containment_v1'], 'missing': []})
        for task_id in APPROVED_TASK_IDS[:-1]:
            with self.subTest(task=task_id):
                previous, _ = admit_task(resolve_task(SOURCE/'Task'/task_id))
                self.assertEqual(previous['capabilities']['available'], ['native_exec_v1', 'post_tool_v1'])

    def test_timeout_capabilities_cannot_be_borrowed_by_another_task(self):
        task = replace(self.task, execution_probe=ExecutionProbeSpec('lifecycle_v1',
            ('native_exec_v1', 'post_tool_v1', 'timeout_observation_v1', 'process_containment_v1')))
        report, request = admit_task(task)
        self.assertEqual(report['status'], 'unsupported')
        self.assertIsNone(request)
        self.assertEqual(report['capabilities']['missing'], ['timeout_observation_v1', 'process_containment_v1'])

    def test_governance_declared_ceilings_and_protocol_are_distinct_from_effective_agenthub_limits(self):
        task = resolve_task(SOURCE/'Task'/GOVERNANCE_TASK_ID)
        report, request = admit_task(task)
        settings = report['effectiveActor']
        self.assertEqual(settings['declaredTaskBudget'], {
            'maxUserTurns': 12, 'maxToolCalls': 80, 'maxWallTimeSeconds': 1200})
        self.assertEqual(settings['executionProfileMapping'], {
            'declaredProtocol': 'openclaw_native_v1', 'declaredRuntimeSchema': 'openclaw_native_v1',
            'executor': 'agenthub', 'compatibleShape': 'single_turn_workspace', 'stockHarnessExecuted': False})
        self.assertEqual((request['maxToolCalls'], request['timeoutMs']), (80, 1200000))
        self.assertEqual(request['instruction'], task.prompt)
        self.assertNotIn('provider_executed', json.dumps(report))

    def test_governance_mapping_cannot_admit_other_profiles_or_unsupported_declared_domains(self):
        task = resolve_task(SOURCE/'Task'/GOVERNANCE_TASK_ID)
        for changes in ({'max_tool_calls': 10001}, {'max_tool_calls': 80.0}, {'max_wall_time_sec': 2147484},
                        {'max_turns': 0}, {'metadata': {'execution': {
                            'mode': 'native', 'protocol': 'native_v1', 'profile': 'runtime/execution.json'}}}):
            with self.subTest(changes=changes):
                report, request = admit_task(replace(task, **changes))
                self.assertEqual(report['status'], 'unsupported')
                self.assertIsNone(request)
        metadata = {**self.task.metadata, 'execution': {
            'mode': 'native', 'protocol': 'openclaw_native_v1', 'profile': 'runtime/execution.json'}}
        report, _ = admit_task(replace(self.task, metadata=metadata))
        self.assertEqual(report['status'], 'unsupported')

    def test_governance_rejects_any_added_rubric_before_actor_admission(self):
        class Sheet:
            rubric_items = [object()]
        task = resolve_task(SOURCE/'Task'/GOVERNANCE_TASK_ID)
        with patch('eval.tracetrial.task_admission.load_score_sheet', return_value=Sheet()):
            report, request = admit_task(task)
        self.assertEqual(report['status'], 'unsupported')
        self.assertEqual(report['judgeCoverage']['maxRequests'], 0)
        self.assertIsNone(request)

    def test_missing_capability_is_unsupported_with_null_score(self):
        task = replace(self.task, execution_probe=ExecutionProbeSpec('lifecycle_v1', ('native_exec_v1', 'unknown_v1')))
        report, request = admit_task(task)
        self.assertEqual(report['status'], 'unsupported')
        self.assertIsNone(report['score'])
        self.assertIsNone(request)
        self.assertEqual(report['capabilities']['missing'], ['unknown_v1'])

    def test_task_budget_and_conversation_shapes_are_checked_before_request_creation(self):
        for changes in ({'max_turns': 0}, {'max_turns': None}, {'max_tool_calls': 10001}, {'max_wall_time_sec': 2147484},
                        {'max_tool_calls': None}, {'max_wall_time_sec': None}, {'max_tool_calls': True},
                        {'conversation': replace(self.task.conversation, mode='fixed_turns')},
                        {'conversation': replace(self.task.conversation, new_session_before_turns=(1,))}):
            with self.subTest(changes=changes):
                report, request = admit_task(replace(self.task, **changes))
                self.assertEqual(report['status'], 'unsupported')
                self.assertIsNone(request)
                self.assertIsNone(report['score'])

    def test_setup_requirements_and_unapproved_identity_are_not_silently_ignored(self):
        for changes in ({'task_id': 'E7-build-stale-artifact-001'}, {'business_simulator': object()},
                        {'task_tools': object()}, {'security_probe': object()}, {'native_instructions': object()},
                        {'model_call_budget': object()}, {'container_resources': object()}, {'scoring': None},
                        {'metadata': {'execution': {'mode': 'docker'}}}):
            with self.subTest(changes=changes):
                report, request = admit_task(replace(self.task, **changes))
                self.assertEqual(report['status'], 'unsupported')
                self.assertIsNone(request)
                self.assertTrue(report['reasons'])

    def test_runtime_setup_or_multi_turn_profile_is_rejected_without_executing_it(self):
        original_read = Path.read_text
        for overrides in ({'requires': ['gateway']}, {'conversation': 'multi_turn'}, {'runnable': False}):
            runtime = json.loads((self.task.task_dir/'runtime/execution.json').read_text())
            runtime.update(overrides)
            def read(path, *args, **kwargs):
                return json.dumps(runtime) if path == self.task.task_dir/'runtime/execution.json' else original_read(path, *args, **kwargs)
            with self.subTest(overrides=overrides), patch.object(Path, 'read_text', read):
                report, request = admit_task(self.task)
                self.assertEqual(report['status'], 'unsupported')
                self.assertIsNone(request)

    def test_judge_coverage_reserves_the_official_one_correction_per_rubric(self):
        class Sheet:
            rubric_items = [1, 2, 3]
        with patch('eval.tracetrial.task_admission.load_score_sheet', return_value=Sheet()):
            report, request = admit_task(self.task)
        self.assertEqual(report['status'], 'unsupported')
        self.assertEqual(report['judgeCoverage']['worstCaseRequests'], 12)
        self.assertIsNone(request)

    def test_arbitrary_task_sizes_are_derived_without_task_specific_numeric_copies(self):
        for tools, seconds in ((1, 60), (10, 180), (80, 1200)):
            with self.subTest(tools=tools):
                task = replace(self.task, max_tool_calls=tools, max_wall_time_sec=seconds)
                report, request = admit_task(task)
                self.assertEqual(report['status'], 'supported')
                self.assertEqual(request['maxToolCalls'], tools)
                self.assertEqual(request['maxTurns'], tools + 1)
                self.assertEqual(request['timeoutMs'], seconds * 1000)

    def test_settings_follow_an_explicit_constrained_plan_and_reject_request_disagreement(self):
        plan = build_budget_plan(self.task.task_id, task_budget_values(self.task), mode='constrained',
            overrides={'timeoutMs': 5000, 'maxTurns': 8, 'maxToolCalls': 2, 'maxRequests': 3})
        report, request = admit_task(self.task, budget_plan=plan)
        settings = actor_settings(request, self.task, report['declaredRuntime'], plan)
        self.assertEqual((settings['timeoutSeconds'], settings['maxTurns'], settings['maxToolCalls'], settings['maxRequests']),
                         (5, 8, 2, 3))
        self.assertEqual(settings['budgetMode'], 'constrained')
        self.assertEqual(settings['budgetPlanDigest'], budget_plan_digest(plan))
        self.assertEqual(settings['taskUserTurnCeiling'], 1)
        with self.assertRaisesRegex(ValueError, 'differs from the budget plan'):
            actor_settings({**request, 'maxToolCalls': 1}, self.task, report['declaredRuntime'], plan)

    def test_stale_or_mutated_task_plan_is_unsupported_before_request_creation(self):
        report, _ = admit_task(self.task)
        plan = report['budgetPlan']
        stale = replace(self.task, max_tool_calls=5)
        result, request = admit_task(stale, budget_plan=plan)
        self.assertEqual(result['status'], 'unsupported')
        self.assertIsNone(request)
        self.assertIn('stale', result['reasons'][0])
        plan['actor']['requestLimits']['maxRequests'] = 1
        result, request = admit_task(self.task, budget_plan=plan)
        self.assertEqual(result['status'], 'unsupported')
        self.assertIsNone(request)

    def test_undersized_task_mode_overrides_are_not_silently_constrained(self):
        task = resolve_task(SOURCE/'Task'/GOVERNANCE_TASK_ID)
        report, request = admit_task(task, overrides={'maxToolCalls': 6})
        self.assertEqual(report['status'], 'unsupported')
        self.assertIsNone(request)
        report, request = admit_task(task, mode='constrained', overrides={'maxToolCalls': 6})
        self.assertEqual(report['status'], 'supported')
        self.assertEqual(request['maxToolCalls'], 6)
        self.assertEqual(report['budgetPlan']['mode'], 'constrained')
        self.assertFalse(report['budgetPlan']['coverage']['completeTaskTrajectory'])
        self.assertEqual(actor_request(task, report['budgetPlan']), request)

    def test_subsecond_or_fractional_second_plans_are_unsupported_before_requests(self):
        for timeout in (1, 999, 1001, 2500):
            with self.subTest(timeout=timeout):
                report, request = admit_task(self.task, mode='constrained', overrides={'timeoutMs': timeout})
                self.assertEqual(report['status'], 'unsupported')
                self.assertIsNone(request)
                self.assertIsNone(report['score'])
                self.assertIn('require whole seconds', report['reasons'][0])


if __name__ == '__main__':
    unittest.main()

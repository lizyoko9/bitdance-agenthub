from dataclasses import replace
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.types import ExecutionProbeSpec

from .container_worker import APPROVED_TASK_IDS
from .task_admission import actor_settings, admit_task


SOURCE = Path('/private/tmp/agenthub-tracetrial-source')


class TaskAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.task = resolve_task(SOURCE/'Task'/APPROVED_TASK_IDS[-1])

    def test_all_three_approved_tasks_preserve_one_user_input_and_independent_internal_turns(self):
        for task_id, user_ceiling, rubrics in zip(APPROVED_TASK_IDS, (6, 6, 1), (4, 2, 5)):
            with self.subTest(task=task_id):
                task = resolve_task(SOURCE/'Task'/task_id)
                report, request = admit_task(task)
                self.assertEqual(report['status'], 'supported')
                self.assertIsNone(report['score'])
                self.assertEqual(report['reasons'], [])
                self.assertEqual(request['instruction'], task.prompt)
                self.assertEqual(request['maxTurns'], 32)
                self.assertEqual(request['maxToolCalls'], 6)
                self.assertEqual(request['timeoutMs'], 120000)
                self.assertEqual(request['requestLimits']['maxRequests'], 16)
                settings = report['effectiveActor']
                self.assertEqual(settings['userTurns'], 1)
                self.assertEqual(settings['taskUserTurnCeiling'], user_ceiling)
                self.assertEqual(settings['declaredRuntime'], {'timeoutSeconds': 600, 'networkMode': 'none'})
                self.assertEqual(settings['timeoutSeconds'], 120)
                self.assertEqual(settings['networkMode'], 'bridge')
                self.assertEqual(report['judgeCoverage'], {'rubrics': rubrics, 'maxRequests': 10,
                                                          'worstCaseRequests': 2 * rubrics})

    def test_missing_capability_is_unsupported_with_null_score(self):
        task = replace(self.task, execution_probe=ExecutionProbeSpec('lifecycle_v1', ('native_exec_v1', 'unknown_v1')))
        report, request = admit_task(task)
        self.assertEqual(report['status'], 'unsupported')
        self.assertIsNone(report['score'])
        self.assertIsNone(request)
        self.assertEqual(report['capabilities']['missing'], ['unknown_v1'])

    def test_task_budget_and_conversation_shapes_are_checked_before_request_creation(self):
        for changes in ({'max_turns': 0}, {'max_turns': None}, {'max_tool_calls': 7}, {'max_wall_time_sec': 121},
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

    def test_settings_derive_effective_values_from_the_request_without_selecting_new_limits(self):
        report, request = admit_task(self.task)
        request.update(timeoutMs=5000, maxTurns=8, maxToolCalls=2)
        request['requestLimits']['maxRequests'] = 3
        settings = actor_settings(request, self.task, report['declaredRuntime'])
        self.assertEqual((settings['timeoutSeconds'], settings['maxTurns'], settings['maxToolCalls'], settings['maxRequests']),
                         (5, 8, 2, 3))
        self.assertEqual(settings['taskUserTurnCeiling'], 1)


if __name__ == '__main__':
    unittest.main()

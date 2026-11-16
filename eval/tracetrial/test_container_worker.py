import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import URLError
from urllib.request import Request
from unittest.mock import Mock, patch

from tracetrial_bench.task_resolver import resolve_task

from . import container_worker as worker
from .budget_contract import build_budget_plan, budget_plan_digest


SOURCE = Path(os.environ.get('AGENTHUB_TRACETRIAL_TEST_SOURCE', '/private/tmp/agenthub-tracetrial-source'))

TASK_BUDGET = {'maxUserTurns': 12, 'maxToolCalls': 80, 'maxWallTimeSeconds': 1200}


def plan(*, task_id=worker.GOVERNANCE_TASK_ID, mode='task', overrides=None):
    return build_budget_plan(task_id, TASK_BUDGET, mode=mode, overrides=overrides)


def actor_request(budget_plan=None, **overrides):
    budget = plan() if budget_plan is None else budget_plan
    actor = budget['actor']
    return {'taskId': budget['taskId'], 'instruction': 'Complete the fixture task',
        'cwd': '/workspace', 'group': 'single', 'modelId': worker.MODEL,
        **{name: actor[name] for name in ('timeoutMs', 'maxTurns', 'maxToolCalls')},
        'requestLimits': dict(actor['requestLimits']), 'outputDir': '/state/trial', **overrides}


class UpstreamBudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.transport = Mock()
        self.transport.open.return_value.status = 200
        self.budget = plan()
        self.guard = self.guard_for(self.budget)

    def guard_for(self, budget, name='requests.jsonl', deadline=None):
        return worker.BoundedUpstream(proxy='',
            deadline=time.monotonic()+budget['actor']['timeoutMs']/1000 if deadline is None else deadline,
            ledger_path=Path(self.tmp.name)/name, opener=self.transport,
            request=actor_request(budget), budget_plan=budget)

    def request(self, **overrides):
        payload = {'model': 'gpt-6-luna', 'reasoning_effort': 'none', 'max_completion_tokens': 8192}
        payload.update(overrides)
        return Request('https://api.openai.com/v1/chat/completions', data=json.dumps(payload).encode())

    def test_g1_allows_eighty_one_http_opportunities_without_an_equality_exhaustion_claim(self):
        for _ in range(81):
            self.guard.open(self.request())
        self.assertEqual(self.transport.open.call_count, 81)
        self.assertIsNone(self.guard.budget_rejection)
        with self.assertRaisesRegex(URLError, 'budget'):
            self.guard.open(self.request())
        self.assertEqual(self.transport.open.call_count, 81)
        self.assertEqual(self.guard.budget_rejection['limit'], 'http_requests')

    def test_failed_upstream_is_counted_once_without_transport_retry(self):
        self.transport.open.side_effect = URLError('offline')
        with self.assertRaises(URLError):
            self.guard.open(self.request())
        self.assertEqual(self.guard.count, 1)
        self.assertEqual(self.transport.open.call_count, 1)
        self.assertIsNone(self.guard.budget_rejection)

    def test_unapproved_endpoint_model_or_output_setting_has_no_budget_or_network_side_effect(self):
        for request in [self.request(model='other'), self.request(max_completion_tokens=9000),
                        Request('https://other.test', data=b'{}')]:
            with self.assertRaises(URLError):
                self.guard.open(request)
        self.transport.open.assert_not_called()
        self.assertIsNone(self.guard.budget_rejection)

    def test_byte_guards_preserve_safe_structured_rejection_and_never_send_after_rejection(self):
        with self.assertRaises(URLError):
            self.guard.open(self.request(padding='a'*262144))
        self.assertEqual(self.guard.budget_rejection, {
            'limit': 'request_bytes', 'reason': 'actor request body exceeds byte limit'})
        with self.assertRaises(URLError):
            self.guard.open(self.request())
        self.transport.open.assert_not_called()
        other = self.guard_for(self.budget, 'total.jsonl')
        other.total_bytes = self.budget['actor']['requestLimits']['maxTotalRequestBytes']
        with self.assertRaises(URLError):
            other.open(self.request())
        self.assertEqual(other.budget_rejection['limit'], 'total_request_bytes')
        self.transport.open.assert_not_called()

    def test_timeout_is_dynamic_and_ledger_does_not_contain_authorization(self):
        request = self.request()
        request.add_header('Authorization', 'Bearer test-sensitive-key')
        self.guard.open(request, timeout=3600)
        self.assertGreater(self.transport.open.call_args.kwargs['timeout'], 600)
        self.assertLessEqual(self.transport.open.call_args.kwargs['timeout'], 1200)
        contents = self.guard.ledger_path.read_text()
        self.assertNotIn('test-sensitive-key', contents)
        self.assertEqual(json.loads(contents)['sequence'], 1)

    def test_deadline_guard_is_recorded_before_transport(self):
        guard = self.guard_for(self.budget, deadline=time.monotonic()-1)
        with self.assertRaises(URLError):
            guard.open(self.request())
        self.assertEqual(guard.budget_rejection['limit'], 'wall_time')
        self.transport.open.assert_not_called()

    def test_explicit_constrained_request_limit_output_and_deadline_are_enforced(self):
        budget = plan(mode='constrained', overrides={
            'timeoutMs': 5000, 'maxRequests': 1, 'maxRequestBytes': 1024,
            'maxTotalRequestBytes': 1024, 'maxCompletionTokens': 2048})
        guard = self.guard_for(budget, 'small.jsonl')
        with self.assertRaisesRegex(URLError, 'settings'):
            guard.open(self.request(max_completion_tokens=8192))
        guard.open(self.request(max_completion_tokens=2048), timeout=120)
        self.assertLessEqual(self.transport.open.call_args.kwargs['timeout'], 5)
        with self.assertRaises(URLError):
            guard.open(self.request(max_completion_tokens=2048))
        self.assertEqual(guard.budget_rejection['limit'], 'http_requests')
        self.assertEqual(self.transport.open.call_count, 1)

    def test_redirects_raise_before_following(self):
        with self.assertRaises(URLError):
            worker.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.test')


class RequestValidationTests(unittest.TestCase):
    def test_worker_accepts_full_task_plan_and_exact_request_for_each_allowed_id(self):
        for task_id in worker.APPROVED_TASK_IDS:
            with self.subTest(task=task_id):
                task = resolve_task((SOURCE / 'Task')/task_id)
                budget = build_budget_plan(task_id, {'maxUserTurns': task.max_turns,
                    'maxToolCalls': task.max_tool_calls, 'maxWallTimeSeconds': task.max_wall_time_sec})
                request = actor_request(budget)
                self.assertEqual(worker.validate_actor_request(request, budget), request)
                self.assertEqual(request['maxToolCalls'], task.max_tool_calls)
                self.assertEqual(request['maxTurns'], task.max_tool_calls + 1)

    def test_plan_request_scalar_shape_and_limit_disagreement_are_rejected(self):
        budget = plan()
        for overrides in ({'taskId': '../private'}, {'modelId': 'other'}, {'group': 'orch-gate'},
                          {'cwd': '/private'}, {'outputDir': '/workspace/results'}, {'instruction': ''},
                          {'timeoutMs': 120000}, {'maxTurns': 32}, {'maxToolCalls': 6},
                          {'maxToolCalls': True}, {'extraSetting': 'unapproved'},
                          {'requestLimits': {**budget['actor']['requestLimits'], 'maxRequests': 16}}):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                worker.validate_actor_request(actor_request(budget, **overrides), budget)
        with self.assertRaises(TypeError):
            worker.validate_actor_request(actor_request(budget))
        with self.assertRaises(ValueError):
            worker.validate_actor_request(actor_request(budget), {})

    def test_missing_or_stale_plan_is_rejected_before_credentials_or_process_start(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            request_file, budget_file = state/'request.json', state/'budget.json'
            budget = plan()
            request_file.write_text(json.dumps(actor_request(budget, maxToolCalls=6)))
            budget_file.write_text(json.dumps(budget))
            with patch.object(worker.sys, 'stdin') as stdin, patch.object(worker.subprocess, 'Popen') as popen:
                for path in (budget_file, state/'missing.json'):
                    with self.subTest(path=path), self.assertRaises((ValueError, FileNotFoundError)):
                        worker.run_worker(request_file, state, '', path)
                stdin.read.assert_not_called()
                popen.assert_not_called()

    def test_standalone_worker_imports_adjacent_contract_and_rejects_before_actor_creation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ('container_worker.py', 'budget_contract.py'):
                shutil.copyfile(Path(worker.__file__).with_name(name), root/name)
            budget = plan()
            (root/'request.json').write_text(json.dumps(actor_request(budget, maxTurns=32)))
            (root/'budget.json').write_text(json.dumps(budget))
            completed = subprocess.run([sys.executable, str(root/'container_worker.py'),
                str(root/'request.json'), str(root/'not-created'), '', str(root/'budget.json')],
                env={'PATH': os.defpath, 'PYTHONDONTWRITEBYTECODE': '1'},
                capture_output=True, text=True, timeout=10, input='fixture-only-key')
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn('Actor request differs from the budget plan', completed.stderr)
            self.assertNotIn('fixture-only-key', completed.stderr)
            self.assertFalse((root/'not-created').exists())

    def run_mock_worker(self, *, timeout=False, observe=False, observer_failure=False, private_contract=True, task_id=None):
        task_id = task_id or (worker.TIMEOUT_TASK_ID if observe else worker.GOVERNANCE_TASK_ID)
        task = resolve_task((SOURCE / 'Task')/task_id)
        observe = task_id in worker.PROCESS_OBSERVED_TASK_IDS
        budget = build_budget_plan(task_id,
            {'maxUserTurns': task.max_turns, 'maxToolCalls': task.max_tool_calls,
                'maxWallTimeSeconds': task.max_wall_time_sec},
            mode='constrained', overrides={
            'timeoutMs': 5000, 'maxTurns': 4, 'maxToolCalls': 2, 'maxRequests': 3})
        request = actor_request(budget)
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            request_file, budget_file = state/'request.json', state/'budget.json'
            request_file.write_text(json.dumps(request))
            budget_file.write_text(json.dumps(budget))
            recorder = Mock()
            recorder.start.return_value.base_url = 'http://127.0.0.1:4002'
            recorder.public_summary.return_value = {}
            child = Mock(pid=99)
            child.wait.side_effect = [subprocess.TimeoutExpired('fixture', 5), 0] if timeout else [0]
            order = []
            observer = Mock()
            if observer_failure:
                observer.start.side_effect = RuntimeError('fixture observation refused')
            def freeze(**kwargs):
                order.append('freeze')
                return {'fixture_receipt': True, **kwargs}
            observer.freeze.side_effect = freeze
            recorder.stop.side_effect = lambda: order.append('recorder_stop')
            with patch('tracetrial_bench.provider_request_recorder.ProviderRequestRecorderProxy', return_value=recorder), \
                 patch.object(worker.os, 'geteuid', return_value=0), \
                 patch.object(worker.sys, 'stdin') as stdin, \
                 patch.dict(worker.os.environ, {'PATH': '/fixture/bin', 'ACTOR_UID': '501', 'ACTOR_GID': '20',
                     **({'AGENTHUB_PRIVATE_PID_NAMESPACE': 'private'} if private_contract else {})}, clear=True), \
                 patch.object(worker.subprocess, 'Popen', return_value=child) as popen, \
                 patch.object(worker.os, 'killpg') as kill, \
                 patch.object(worker, 'ProcessObserver', return_value=observer) as make_observer, \
                 patch.object(worker.time, 'monotonic', return_value=100), \
                 patch.object(worker.Path, 'mkdir'):
                stdin.read.return_value = 'fixture-only-key'
                kill.side_effect = lambda *args: order.append('kill')
                if observer_failure:
                    with self.assertRaisesRegex(RuntimeError, 'observation refused'):
                        worker.run_worker(request_file, state, '', budget_file)
                    popen.assert_not_called()
                else:
                    self.assertEqual(worker.run_worker(request_file, state, '', budget_file), 124 if timeout else 0)
                    self.assertEqual(child.wait.call_args_list[0].kwargs['timeout'], 5)
                    self.assertNotIn('fixture-only-key', json.dumps(popen.call_args.kwargs['env']))
                    self.assertNotIn('AGENTHUB_PRIVATE_PID_NAMESPACE', popen.call_args.kwargs['env'])
                    self.assertEqual(popen.call_args.kwargs['user'], 501)
                    self.assertEqual(popen.call_args.kwargs['group'], 20)
                self.assertEqual(recorder._opener.deadline, 105)
                self.assertEqual(recorder._opener.settings, request)
                self.assertEqual(kill.call_count, int(timeout))
                if observe:
                    make_observer.assert_called_once_with(private_pid_namespace=private_contract)
                    observer.start.assert_called_once_with()
                    if not observer_failure:
                        observer.bind_actor.assert_called_once_with(99)
                    observer.freeze.assert_called_once_with(**({'natural_exit': False, 'forced_stop': True}
                        if timeout else {'natural_exit': not observer_failure}))
                    self.assertEqual(order, ['freeze', 'kill', 'recorder_stop'] if timeout else ['freeze', 'recorder_stop'])
                else:
                    make_observer.assert_not_called()
            metadata = json.loads((state/'actor_process.json').read_text())
            self.assertEqual(metadata['budget_plan_digest'], budget_plan_digest(budget))
            self.assertEqual(metadata['budget_mode'], 'constrained')
            self.assertEqual(metadata['effective_limits'], {name: request[name]
                for name in ('timeoutMs', 'maxTurns', 'maxToolCalls', 'requestLimits')})
            self.assertNotIn('fixture-only-key', (state/'actor_process.json').read_text())
            self.assertEqual('process_containment' in metadata, observe)
            if observe:
                self.assertTrue(metadata['process_containment']['fixture_receipt'])
            return metadata

    def test_worker_uses_plan_deadline_and_records_exact_plan_digest_without_a_rejection_on_success(self):
        self.assertIsNone(self.run_mock_worker()['budget_rejection'])

    def test_worker_wall_timeout_records_structured_budget_rejection(self):
        self.assertEqual(self.run_mock_worker(timeout=True)['budget_rejection']['limit'], 'wall_time')

    def test_e6_natural_exit_freezes_receipt_before_recorder_cleanup(self):
        self.assertTrue(self.run_mock_worker(observe=True)['process_containment']['natural_exit'])

    def test_e6_wall_timeout_freezes_forced_failure_before_first_signal_without_overwriting(self):
        receipt = self.run_mock_worker(observe=True, timeout=True)['process_containment']
        self.assertFalse(receipt['natural_exit'])
        self.assertTrue(receipt['forced_stop'])

    def test_e6_observer_start_failure_persists_receipt_without_starting_actor(self):
        metadata = self.run_mock_worker(observe=True, observer_failure=True)
        self.assertIsNone(metadata['exit_code'])
        self.assertFalse(metadata['process_containment']['natural_exit'])

    def test_e6_missing_private_contract_is_passed_as_false_and_rejects_actor(self):
        metadata = self.run_mock_worker(observe=True, observer_failure=True, private_contract=False)
        self.assertIsNone(metadata['exit_code'])

    def test_confirmation_natural_exit_uses_the_same_pre_cleanup_process_observer(self):
        receipt = self.run_mock_worker(task_id=worker.CONFIRMATION_TASK_ID)['process_containment']
        self.assertTrue(receipt['natural_exit'])

    def test_confirmation_wall_timeout_freezes_failure_before_signaling(self):
        receipt = self.run_mock_worker(task_id=worker.CONFIRMATION_TASK_ID, timeout=True)['process_containment']
        self.assertFalse(receipt['natural_exit'])
        self.assertTrue(receipt['forced_stop'])

    def test_confirmation_observer_refusal_retains_failure_and_does_not_start_actor(self):
        for private_contract in (True, False):
            with self.subTest(private_contract=private_contract):
                metadata = self.run_mock_worker(task_id=worker.CONFIRMATION_TASK_ID,
                    observer_failure=True, private_contract=private_contract)
                self.assertIsNone(metadata['exit_code'])
                self.assertFalse(metadata['process_containment']['natural_exit'])

    def test_unobserved_approved_tasks_do_not_start_an_observer(self):
        for task_id in set(worker.APPROVED_TASK_IDS) - set(worker.PROCESS_OBSERVED_TASK_IDS):
            with self.subTest(task_id=task_id):
                self.assertNotIn('process_containment', self.run_mock_worker(task_id=task_id))


if __name__ == '__main__':
    unittest.main()

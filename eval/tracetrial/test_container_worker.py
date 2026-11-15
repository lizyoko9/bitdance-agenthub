import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from urllib.error import URLError
from urllib.request import Request
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('container_worker', Path(__file__).with_name('container_worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def actor_request(**overrides):
    return {'taskId': worker.APPROVED_TASK_IDS[-1], 'instruction': 'Complete the fixture task',
        'cwd': '/workspace', 'group': 'single', 'modelId': worker.MODEL,
        **worker.ACTOR_CEILINGS, 'requestLimits': dict(worker.REQUEST_CEILINGS),
        'outputDir': '/state/trial', **overrides}


class UpstreamBudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.transport = Mock()
        self.transport.open.return_value.status = 200
        self.guard = worker.BoundedUpstream(proxy='', deadline=time.monotonic()+120,
            ledger_path=Path(self.tmp.name)/'requests.jsonl', opener=self.transport, request=actor_request())

    def request(self, **overrides):
        payload = {'model': 'gpt-6-luna', 'reasoning_effort': 'none', 'max_completion_tokens': 8192}
        payload.update(overrides)
        return Request('https://api.openai.com/v1/chat/completions', data=json.dumps(payload).encode())

    def test_blocks_seventeenth_upstream_and_no_retry_after_failure(self):
        self.transport.open.side_effect = URLError('offline')
        for _ in range(16):
            with self.assertRaises(URLError):
                self.guard.open(self.request())
        with self.assertRaisesRegex(URLError, 'budget'):
            self.guard.open(self.request())
        self.assertEqual(self.transport.open.call_count, 16)

    def test_bytes_and_settings_rejected_before_network(self):
        for request in [self.request(model='other'), self.request(max_completion_tokens=9000),
                        self.request(padding='a'*262144), Request('https://other.test', data=b'{}')]:
            with self.assertRaises(URLError):
                self.guard.open(request)
        self.assertEqual(self.transport.open.call_count, 0)
        self.guard.total_bytes = 2097152
        with self.assertRaises(URLError):
            self.guard.open(self.request())

    def test_timeout_is_capped_and_ledger_has_no_authorization(self):
        request = self.request()
        request.add_header('Authorization', 'Bearer test-sensitive-key')
        self.guard.open(request, timeout=3600)
        self.assertLessEqual(self.transport.open.call_args.kwargs['timeout'], 120)
        contents = self.guard.ledger_path.read_text()
        self.assertNotIn('test-sensitive-key', contents)
        self.assertEqual(json.loads(contents)['sequence'], 1)

    def test_redirects_raise_before_following(self):
        with self.assertRaises(URLError):
            worker.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.test')

    def test_worker_enforces_effective_request_limits_instead_of_approved_maxima(self):
        limits = {'maxRequests': 1, 'maxRequestBytes': 1024, 'maxTotalRequestBytes': 1024,
                  'maxCompletionTokens': 2048}
        guard = worker.BoundedUpstream(proxy='', deadline=time.monotonic()+120,
            ledger_path=Path(self.tmp.name)/'small.jsonl', opener=self.transport,
            request=actor_request(timeoutMs=5000, requestLimits=limits))
        with self.assertRaisesRegex(URLError, 'settings'):
            guard.open(self.request(max_completion_tokens=8192))
        guard.open(self.request(max_completion_tokens=2048), timeout=120)
        self.assertLessEqual(self.transport.open.call_args.kwargs['timeout'], 5)
        with self.assertRaisesRegex(URLError, 'budget'):
            guard.open(self.request(max_completion_tokens=2048))
        self.assertEqual(self.transport.open.call_count, 1)

    def test_worker_enforces_both_effective_byte_limits_before_transport(self):
        limits = {'maxRequests': 16, 'maxRequestBytes': 512, 'maxTotalRequestBytes': 512,
                  'maxCompletionTokens': 8192}
        guard = worker.BoundedUpstream(proxy='', deadline=time.monotonic()+120,
            ledger_path=Path(self.tmp.name)/'bytes.jsonl', opener=self.transport,
            request=actor_request(requestLimits=limits))
        with self.assertRaisesRegex(URLError, 'budget'):
            guard.open(self.request(padding='a'*512))
        self.transport.open.assert_not_called()
        guard.total_bytes = 512
        with self.assertRaisesRegex(URLError, 'budget'):
            guard.open(self.request())
        self.transport.open.assert_not_called()


class RequestValidationTests(unittest.TestCase):
    def test_governance_task_cannot_use_its_larger_declared_limits_in_the_worker(self):
        request = actor_request(taskId=worker.GOVERNANCE_TASK_ID)
        self.assertEqual(worker.validate_actor_request(request)['maxToolCalls'], 6)
        for overrides in ({'maxToolCalls': 80}, {'timeoutMs': 1200000}):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                worker.validate_actor_request({**request, **overrides})

    def test_all_approved_ids_share_one_bounded_public_request_contract(self):
        for task_id in worker.APPROVED_TASK_IDS:
            with self.subTest(task=task_id):
                request = actor_request(taskId=task_id)
                self.assertEqual(worker.validate_actor_request(request), request)

    def test_request_shape_and_scalar_ceiling_disagreement_is_rejected(self):
        cases = [{'taskId': '../private'}, {'modelId': 'other'}, {'group': 'orch-gate'},
                 {'cwd': '/private'}, {'outputDir': '/workspace/results'}, {'instruction': ''},
                 {'timeoutMs': 120001}, {'maxTurns': 33}, {'maxToolCalls': 7},
                 {'maxToolCalls': True}, {'extraSetting': 'unapproved'}]
        for overrides in cases:
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                worker.validate_actor_request(actor_request(**overrides))
        missing = actor_request()
        del missing['maxToolCalls']
        with self.assertRaises(ValueError):
            worker.validate_actor_request(missing)

    def test_request_limits_cannot_exceed_any_approved_ceiling(self):
        for name, ceiling in worker.REQUEST_CEILINGS.items():
            for invalid in (ceiling + 1, 0, True, '1'):
                with self.subTest(name=name, invalid=invalid), self.assertRaises(ValueError):
                    worker.validate_actor_request(actor_request(requestLimits={**worker.REQUEST_CEILINGS, name: invalid}))

    def test_invalid_worker_request_is_rejected_before_credentials_or_process_start(self):
        with tempfile.TemporaryDirectory() as folder:
            request_file = Path(folder)/'request.json'
            request_file.write_text(json.dumps(actor_request(maxToolCalls=7)))
            with patch.object(worker.sys, 'stdin') as stdin, patch.object(worker.subprocess, 'Popen') as popen:
                with self.assertRaises(ValueError):
                    worker.run_worker(request_file, Path(folder)/'state', '')
                stdin.read.assert_not_called()
                popen.assert_not_called()

    def test_worker_uses_request_deadline_and_retains_the_exact_effective_limits(self):
        request = actor_request(timeoutMs=5000, maxTurns=4, maxToolCalls=2,
                                requestLimits={**worker.REQUEST_CEILINGS, 'maxRequests': 3})
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            request_file = state/'request.json'
            request_file.write_text(json.dumps(request))
            recorder = Mock()
            recorder.start.return_value.base_url = 'http://127.0.0.1:4002'
            recorder.public_summary.return_value = {}
            child = Mock(pid=99)
            child.wait.return_value = 0
            with patch('tracetrial_bench.provider_request_recorder.ProviderRequestRecorderProxy', return_value=recorder), \
                 patch.object(worker.os, 'geteuid', return_value=0), \
                 patch.object(worker.sys, 'stdin') as stdin, \
                 patch.dict(worker.os.environ, {'PATH': '/fixture/bin', 'ACTOR_UID': '501', 'ACTOR_GID': '20'}, clear=True), \
                 patch.object(worker.subprocess, 'Popen', return_value=child) as popen, \
                 patch.object(worker.time, 'monotonic', return_value=100), \
                 patch.object(worker.Path, 'mkdir'):
                stdin.read.return_value = 'fixture-only-key'
                self.assertEqual(worker.run_worker(request_file, state, ''), 0)
                child.wait.assert_called_once_with(timeout=5)
                self.assertEqual(recorder._opener.deadline, 105)
                self.assertEqual(recorder._opener.settings, request)
                self.assertNotIn('fixture-only-key', json.dumps(popen.call_args.kwargs['env']))
                self.assertEqual(popen.call_args.kwargs['user'], 501)
                self.assertEqual(popen.call_args.kwargs['group'], 20)
            metadata = json.loads((state/'actor_process.json').read_text())
            self.assertEqual(metadata['effective_limits'], {name: request[name]
                for name in ('timeoutMs', 'maxTurns', 'maxToolCalls', 'requestLimits')})
            self.assertNotIn('fixture-only-key', (state/'actor_process.json').read_text())


if __name__ == '__main__':
    unittest.main()

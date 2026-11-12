import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from urllib.error import URLError
from urllib.request import Request
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location('container_worker', Path(__file__).with_name('container_worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class UpstreamBudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.transport = Mock()
        self.transport.open.return_value.status = 200
        self.guard = worker.BoundedUpstream(proxy='', deadline=time.monotonic()+120,
            ledger_path=Path(self.tmp.name)/'requests.jsonl', opener=self.transport)

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


if __name__ == '__main__':
    unittest.main()

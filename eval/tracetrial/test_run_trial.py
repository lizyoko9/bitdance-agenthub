import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tracetrial_bench.task_resolver import resolve_task

from .run_trial import actor_request, checked_source, directory_hashes, docker_environment, verify_build_files, TASK_ID


class DriverContractTests(unittest.TestCase):
    def test_public_actor_request_contains_no_private_grading_inputs(self):
        source = checked_source(Path('/private/tmp/agenthub-tracetrial-source'))
        task = resolve_task(source / 'Task' / TASK_ID)
        request = actor_request(task)
        self.assertEqual(request['instruction'], (task.task_dir/'prompt.md').read_text())
        self.assertEqual(request['cwd'], '/workspace')
        self.assertEqual(request['maxToolCalls'], task.max_tool_calls)
        self.assertEqual(request['timeoutMs'], task.max_wall_time_sec*1000)
        self.assertNotIn('OPENAI_API_KEY', json.dumps(request))
        self.assertNotIn('verifier/', json.dumps(request))

    def test_docker_environment_omits_provider_keys_and_unscoped_context(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'private-test-key', 'DEEPSEEK_API_KEY': 'other',
            'DOCKER_CONTEXT': 'unexpected', 'DOCKER_HOST': 'unix:///test.sock'}):
            environment = docker_environment()
        self.assertEqual(environment['DOCKER_HOST'], 'unix:///test.sock')
        self.assertNotIn('OPENAI_API_KEY', environment)
        self.assertNotIn('DEEPSEEK_API_KEY', environment)
        self.assertNotIn('DOCKER_CONTEXT', environment)

    def test_hashes_detect_real_changes_and_ignore_python_runtime_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'input').write_text('initial')
            before = directory_hashes(root)
            (root/'__pycache__').mkdir()
            (root/'__pycache__/cache.pyc').write_bytes(b'cache')
            self.assertEqual(directory_hashes(root), before)
            (root/'input').write_text('changed')
            self.assertNotEqual(directory_hashes(root), before)

    def test_changed_build_input_is_rejected_before_docker(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'runtime.tar.gz').write_bytes(b'original')
            manifest = {'buildFiles': directory_hashes(root)}
            verify_build_files(root, manifest)
            (root/'runtime.tar.gz').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'Build context changed'):
                verify_build_files(root, manifest)


if __name__ == '__main__':
    unittest.main()

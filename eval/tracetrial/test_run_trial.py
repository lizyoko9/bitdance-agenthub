import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import tarfile
import unittest
from unittest.mock import patch

from tracetrial_bench.task_resolver import resolve_task

from . import run_trial as driver
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

    def test_reuse_requires_pinned_local_digest_without_pulling(self):
        with patch.object(driver, 'docker') as docker:
            for reference in ('agenthub/tracetrial:latest', 'agenthub/tracetrial@sha256:short'):
                with self.assertRaisesRegex(ValueError, 'pinned RepoDigest'):
                    driver.inspect_reuse_image(reference)
            docker.assert_not_called()
            reference = 'agenthub/tracetrial@sha256:' + 'a'*64
            docker.return_value.stdout = json.dumps([{'RepoDigests': [], 'Os': 'linux'}])
            with self.assertRaisesRegex(ValueError, 'exact pinned RepoDigest'):
                driver.inspect_reuse_image(reference)
            self.assertEqual(docker.call_args.args, ('image', 'inspect', reference))

    def test_baseline_copy_never_starts_container_and_removes_it_on_failure(self):
        with patch.object(driver, 'docker') as docker:
            docker.side_effect = [SimpleNamespace(stdout='synthetic-container\n'), OSError('copy failed'), SimpleNamespace()]
            with self.assertRaises(OSError):
                driver.retain_baseline_manifest({'Id': 'sha256:synthetic'}, Path('/unused-baseline'))
            self.assertEqual([call.args[0] for call in docker.call_args_list], ['create', 'cp', 'rm'])
            self.assertEqual(docker.call_args_list[0].args, ('create', '--network=none', 'sha256:synthetic'))
            self.assertEqual(docker.call_args_list[-1].args, ('rm', 'synthetic-container'))

    def test_uncommitted_reuse_sources_are_rejected(self):
        with patch.object(driver.subprocess, 'run', return_value=SimpleNamespace(returncode=1)), \
             patch.object(driver.subprocess, 'check_output', return_value=''):
            with self.assertRaisesRegex(ValueError, 'Commit all runtime'):
                driver.require_committed_sources(['untracked-source.ts'])

    def test_reuse_preparation_retains_baseline_and_complete_recipe_hashes(self):
        reference = 'agenthub/tracetrial@sha256:' + 'a'*64
        inspection = {'Id': 'sha256:' + 'b'*64, 'Architecture': 'arm64', 'Os': 'linux', 'RootFS': {'Layers': ['layer']}}
        revision = driver.subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=driver.ROOT, text=True).strip()
        def retain(_inspection, target):
            with tarfile.open(target.parent/'runtime.tar.gz', 'r:gz') as archive:
                baseline = json.loads(archive.extractfile('runtime-source.json').read())
            baseline['agenthubCommit'] = 'synthetic-baseline'
            target.write_text(json.dumps(baseline))
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(driver, 'require_committed_sources', return_value=revision), \
             patch.object(driver, 'inspect_reuse_image', return_value=inspection), \
             patch.object(driver, 'retain_baseline_manifest', side_effect=retain):
            context = driver.prepare_build(Path('/private/tmp/agenthub-tracetrial-source'), Path(folder)/'build', reuse_image=reference)
            value = json.loads((context/'build-manifest.json').read_text())
            self.assertEqual(value['baseImage']['reference'], reference)
            self.assertEqual(value['baseImage']['runtimeCommit'], 'synthetic-baseline')
            self.assertEqual(value['runtime']['agenthubCommit'], revision)
            self.assertIn('refresh-runtime.py', value['buildFiles'])
            self.assertIn('baseline-runtime-source.json', value['buildFiles'])
            self.assertNotIn('build-manifest.json', value['buildFiles'])
            self.assertEqual((context/'Dockerfile').read_bytes(), Path(driver.__file__).with_name('Dockerfile.refresh').read_bytes())
            self.assertEqual(set(value['controllerFiles']), set(driver.REFRESH_CONTROLLER_FILES))
            verify_build_files(context, value)
            driver.verify_runtime_sources(context)

    def test_default_preparation_keeps_original_clean_build(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(driver, 'inspect_reuse_image') as inspect:
            context = driver.prepare_build(Path('/private/tmp/agenthub-tracetrial-source'), Path(folder)/'build')
            value = json.loads((context/'build-manifest.json').read_text())
            inspect.assert_not_called()
            self.assertNotIn('baseImage', value)
            self.assertFalse((context/'refresh-runtime.py').exists())
            self.assertEqual((context/'Dockerfile').read_bytes(), Path(driver.__file__).with_name('Dockerfile').read_bytes())

    def test_reuse_build_passes_fixed_base_and_retains_image_provenance(self):
        base = {'reference': 'agenthub/tracetrial@sha256:' + 'a'*64, 'id': 'sha256:' + 'b'*64}
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(driver, 'inspect_reuse_image', return_value={'Id': base['id']}), \
             patch.object(driver.subprocess, 'run', return_value=SimpleNamespace(returncode=0)) as run, \
             patch.object(driver, 'docker', return_value=SimpleNamespace(stdout=json.dumps([
                 {'Id': 'sha256:new-synthetic-image', 'Architecture': 'arm64', 'Os': 'linux'}]))):
            context = Path(folder)
            (context/'build-manifest.json').write_text(json.dumps({'buildFiles': {}, 'runtime': {'synthetic': True}, 'baseImage': base}))
            driver.build_image(context, 'synthetic-image', '')
            command = run.call_args.args[0]
            self.assertIn('BASE_IMAGE=' + base['reference'], command)
            self.assertIn('--pull=false', command)
            image = json.loads((context/'image.json').read_text())
            self.assertEqual(image['baseImage'], base)
            self.assertEqual(image['runtime'], {'synthetic': True})


if __name__ == '__main__':
    unittest.main()

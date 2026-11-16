import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import tarfile
import unittest
from unittest.mock import patch

from tracetrial_bench.task_resolver import resolve_task

from . import run_trial as driver
from .run_trial import actor_request, checked_source, directory_hashes, docker_environment, verify_build_files, TASK_ID


SOURCE = Path(os.environ.get('AGENTHUB_TRACETRIAL_TEST_SOURCE', '/private/tmp/agenthub-tracetrial-source'))

class DriverContractTests(unittest.TestCase):
    def plan_file(self, folder, task_id=TASK_ID, **options):
        report = driver.preflight_task(SOURCE, task_id, **options)
        path = Path(folder) / 'budget.json'
        driver.write_budget_file(report, path)
        return path

    def test_run_requires_an_explicit_plan_before_credentials_or_side_effects(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(driver, 'docker') as docker, \
             patch.object(driver, 'resolve_trial_task') as resolve:
            with self.assertRaisesRegex(ValueError, '--budget-file'):
                driver.run_trial(source=Path('/unused'), output=Path('/unused'), context=Path('/unused'),
                    image='unused', actor_proxy='', judge_proxy='')
            docker.assert_not_called()
            resolve.assert_not_called()

    def test_plan_binds_task_sources_and_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            plan = self.plan_file(folder)
            envelope = driver.read_budget_file(plan)
            self.assertEqual(envelope['taskId'], TASK_ID)
            self.assertEqual(envelope['budgetPlan']['actor']['maxToolCalls'], 6)
            with self.assertRaises(FileExistsError):
                driver.write_budget_file(driver.preflight_task(SOURCE), plan)
            envelope['budgetPlan']['actor']['maxToolCalls'] = 5
            plan.write_text(json.dumps(envelope))
            with self.assertRaises(ValueError):
                driver.read_budget_file(plan)

    def test_stale_source_binding_fails_before_key_or_docker(self):
        with tempfile.TemporaryDirectory() as folder:
            plan = self.plan_file(folder)
            envelope = json.loads(plan.read_text())
            envelope['sourceTaskHashes']['prompt.md'] = 'changed'
            plan.write_text(json.dumps(envelope))
            with patch.dict(os.environ, {}, clear=True), patch.object(driver, 'docker') as docker:
                with self.assertRaisesRegex(ValueError, 'task inputs changed'):
                    driver.run_trial(source=SOURCE,
                        output=Path(folder)/'trial', context=Path('/unused'), image='unused',
                        actor_proxy='', judge_proxy='', budget_file=plan)
                self.assertFalse((Path(folder)/'trial').exists())
                docker.assert_not_called()

    def test_driver_copies_the_reviewed_plan_and_uses_the_full_task_deadline(self):
        task_id = 'G1-registry-cleanup-002'
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            plan_file = self.plan_file(root, task_id)
            envelope = driver.read_budget_file(plan_file)
            task, report, request = driver.resolve_trial_task(SOURCE,
                task_id, budget_plan=envelope['budgetPlan'])
            context = root/'build'
            context.mkdir()
            (context/'build-manifest.json').write_text(json.dumps({'runtime': {'agenthubCommit': 'fixture'}}))
            (context/'image.json').write_text(json.dumps({'id': 'fixture-image'}))
            output = root/'trial'
            calls = []

            def docker(*args, **kwargs):
                calls.append((args, kwargs))
                if args[:2] == ('image', 'inspect'):
                    return SimpleNamespace(stdout=json.dumps([{'Id': 'fixture-image'}]), stderr='', returncode=0)
                if args[0] == 'create':
                    return SimpleNamespace(stdout='fixture-container', stderr='', returncode=0)
                if args[:2] == ('cp', 'fixture-container:/state/.'):
                    native = Path(args[2])
                    (native/'trial').mkdir()
                    (native/'trial/result.json').write_text(json.dumps({
                        'runStatus': 'complete', 'terminationReason': 'completed'}))
                    (native/'actor_process.json').write_text(json.dumps({'exit_code': 0, 'timed_out': False}))
                return SimpleNamespace(stdout='', stderr='', returncode=0)

            with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture-only-key'}, clear=True), \
                 patch.object(driver, 'resolve_trial_task', return_value=(task, report, request)), \
                 patch.object(driver, 'verify_build_files'), patch.object(driver, 'verify_runtime_sources'), \
                 patch.object(driver.subprocess, 'check_output', return_value='fixture-revision'), \
                 patch.object(driver, 'docker', side_effect=docker), \
                 patch('eval.tracetrial.trace_adapter.normalize_agenthub_trace', return_value={'structured_trace_status': 'available'}), \
                 patch('eval.tracetrial.trace_adapter.emit_execution_evidence'), \
                 patch('eval.tracetrial.score_trial.score_retained_trial', return_value={'scoringStatus': 'completed'}):
                result = driver.run_trial(source=Path('/unused'), output=output, context=context,
                    image='fixture-image', actor_proxy='proxy', judge_proxy='', task_id=task_id, budget_file=plan_file)
            copied = [args for args, _ in calls if args[0]=='cp' and args[-1]=='fixture-container:/state/budget-plan.json']
            self.assertEqual(len(copied), 1)
            self.assertEqual(json.loads(Path(copied[0][1]).read_text()), envelope['budgetPlan'])
            execution = next((args, kwargs) for args, kwargs in calls if args[0]=='exec')
            self.assertEqual(execution[0][-4:], ('/state/request.json', '/state', 'proxy', '/state/budget-plan.json'))
            self.assertEqual(execution[1]['timeout'], 1235)
            protocol = json.loads((output/'artifacts/protocol.json').read_text())
            self.assertEqual(protocol['actor']['sdkRequestTimeoutMs'], 1200000)
            self.assertEqual(protocol['budgetPlanSha256'], envelope['budgetPlanSha256'])
            self.assertEqual(result['budgetOutcome']['kind'], 'not_limited')
            self.assertEqual(json.loads((output/'artifacts/budget-outcome.json').read_text()), result['budgetOutcome'])

    def test_e6_private_pid_namespace_is_verified_before_actor_start_and_proof_is_scoped(self):
        for pid_mode in ('', 'host'):
            with self.subTest(pid_mode=pid_mode), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                task_id = driver.TIMEOUT_TASK_ID
                plan_file = self.plan_file(root, task_id)
                envelope = driver.read_budget_file(plan_file)
                task, report, request = driver.resolve_trial_task(SOURCE,
                    task_id, budget_plan=envelope['budgetPlan'])
                context = root/'build'
                context.mkdir()
                (context/'build-manifest.json').write_text(json.dumps({'runtime': {'agenthubCommit': 'fixture'}}))
                (context/'image.json').write_text(json.dumps({'id': 'fixture-image'}))
                output, calls = root/'trial', []

                def docker(*args, **kwargs):
                    calls.append((args, kwargs))
                    if args[:2] == ('image', 'inspect'):
                        return SimpleNamespace(stdout=json.dumps([{'Id': 'fixture-image'}]), stderr='', returncode=0)
                    if args[:2] == ('container', 'inspect'):
                        return SimpleNamespace(stdout=json.dumps([{'Id': 'fixture-container', 'HostConfig': {'PidMode': pid_mode}}]), stderr='', returncode=0)
                    if args[0] == 'create':
                        return SimpleNamespace(stdout='fixture-container', stderr='', returncode=0)
                    if args[:2] == ('cp', 'fixture-container:/state/.') and any(call[0][0] == 'exec' for call in calls):
                        native = Path(args[2])
                        (native/'trial').mkdir()
                        (native/'trial/result.json').write_text(json.dumps({'runStatus': 'complete', 'terminationReason': 'completed'}))
                        (native/'actor_process.json').write_text(json.dumps({'exit_code': 0, 'timed_out': False}))
                    return SimpleNamespace(stdout='', stderr='', returncode=0)

                with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture-only-key'}, clear=True), \
                     patch.object(driver, 'resolve_trial_task', return_value=(task, report, request)), \
                     patch.object(driver, 'verify_build_files'), patch.object(driver, 'verify_runtime_sources'), \
                     patch.object(driver.subprocess, 'check_output', return_value='fixture-revision'), \
                     patch.object(driver, 'docker', side_effect=docker), \
                     patch('eval.tracetrial.trace_adapter.normalize_agenthub_trace', return_value={'structured_trace_status': 'available'}), \
                     patch('eval.tracetrial.trace_adapter.emit_execution_evidence'), \
                     patch('eval.tracetrial.score_trial.score_retained_trial', return_value={'scoringStatus': 'completed'}):
                    arguments = dict(source=Path('/unused'), output=output, context=context, image='fixture-image',
                        actor_proxy='proxy', judge_proxy='', task_id=task_id, budget_file=plan_file)
                    if pid_mode == '':
                        driver.run_trial(**arguments)
                    else:
                        with self.assertRaisesRegex(RuntimeError, 'Actor apparatus failed'):
                            driver.run_trial(**arguments)
                create = next(args for args, _ in calls if args[0] == 'create')
                self.assertFalse(any(value.startswith('--pid=') for value in create))
                lifecycle = json.loads((output/'artifacts/lifecycle.json').read_text())
                if pid_mode == '':
                    stages = [row['stage'] for row in lifecycle]
                    self.assertLess(stages.index('pid_namespace_verified'), stages.index('actor_started'))
                    proof = next(row for row in lifecycle if row['stage'] == 'pid_namespace_verified')
                    self.assertEqual(proof['pidMode'], '')
                    self.assertEqual(proof['normalizedPidMode'], 'private')
                    execution = next((args, kwargs) for args, kwargs in calls if args[0] == 'exec')
                    self.assertIn('AGENTHUB_PRIVATE_PID_NAMESPACE=private', execution[0])
                    self.assertEqual(execution[1]['timeout'], 155)
                else:
                    self.assertFalse(any(args[0] in ('start', 'exec') for args, _ in calls))
                    self.assertNotIn('pid_namespace_verified', [row['stage'] for row in lifecycle])
                    self.assertTrue((output/'artifacts/apparatus-failure.json').is_file())

    def test_confirmation_driver_preserves_full_deadline_namespace_and_container_evidence(self):
        for mode in ('success', 'actor_nonzero', 'foreign_namespace', 'actor_copy_remove_exceptions'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as folder:
                root = Path(folder).resolve()
                task_id = driver.CONFIRMATION_TASK_ID
                plan_file = self.plan_file(root, task_id)
                plan = driver.read_budget_file(plan_file)
                task, report, request = driver.resolve_trial_task(SOURCE,
                    task_id, budget_plan=plan['budgetPlan'])
                context = root / 'build'
                context.mkdir()
                (context / 'build-manifest.json').write_text(json.dumps({'runtime': {'agenthubCommit': 'fixture'}}))
                (context / 'image.json').write_text(json.dumps({'id': 'fixture-image'}))
                output, calls = root / 'trial', []

                def docker(*args, **kwargs):
                    calls.append((args, kwargs))
                    if args[:2] == ('image', 'inspect'):
                        return SimpleNamespace(stdout=json.dumps([{'Id': 'fixture-image'}]), stderr='', returncode=0)
                    if args[0] == 'create':
                        return SimpleNamespace(stdout='fixture-container', stderr='', returncode=0)
                    if args[:2] == ('container', 'inspect'):
                        pid_mode = 'host' if mode == 'foreign_namespace' else ''
                        return SimpleNamespace(stdout=json.dumps([{'Id': 'fixture-container',
                            'HostConfig': {'PidMode': pid_mode}}]), stderr='', returncode=0)
                    if mode == 'actor_copy_remove_exceptions':
                        if args[0] == 'exec':
                            raise subprocess.TimeoutExpired(['docker', 'exec'], 2435)
                        if args[:2] == ('cp', 'fixture-container:/state/.'):
                            raise OSError('copy failed after actor timeout')
                        if args[0] == 'rm':
                            raise PermissionError('removal failed after copy')
                    if args[:2] == ('cp', 'fixture-container:/state/.') and mode in ('success', 'actor_nonzero'):
                        native = Path(args[2])
                        for name in driver.REQUIRED_NATIVE_ARCHIVES:
                            path = native / name
                            path.parent.mkdir(parents=True, exist_ok=True)
                            path.write_text('{}\n')
                        (native / 'trial/result.json').write_text(json.dumps({'runStatus': 'failed' if mode == 'actor_nonzero' else 'complete',
                            'terminationReason': 'provider_error' if mode == 'actor_nonzero' else 'completed'}))
                        (native / 'actor_process.json').write_text(json.dumps({'exit_code': 1 if mode == 'actor_nonzero' else 0,
                            'timed_out': False}))
                    if args[0] == 'exec' and mode == 'actor_nonzero':
                        return SimpleNamespace(stdout='', stderr='', returncode=1)
                    return SimpleNamespace(stdout='', stderr='', returncode=0)

                with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture-only-key'}, clear=True), \
                     patch.object(driver, 'resolve_trial_task', return_value=(task, report, request)), \
                     patch.object(driver, 'verify_build_files'), patch.object(driver, 'verify_runtime_sources'), \
                     patch.object(driver.subprocess, 'check_output', return_value='fixture-revision'), \
                     patch.object(driver, 'docker', side_effect=docker), \
                     patch('eval.tracetrial.trace_adapter.normalize_agenthub_trace', return_value={'structured_trace_status': 'available'}), \
                     patch('eval.tracetrial.trace_adapter.emit_execution_evidence'), \
                     patch('eval.tracetrial.score_trial.score_retained_trial', return_value={'scoringStatus': 'completed'}) as score:
                    arguments = dict(source=Path('/unused'), output=output, context=context,
                        image='fixture-image', actor_proxy='proxy', judge_proxy='', task_id=task_id, budget_file=plan_file)
                    if mode in ('success', 'actor_nonzero'):
                        driver.run_trial(**arguments)
                        score.assert_called_once()
                    else:
                        with self.assertRaisesRegex(RuntimeError, 'Actor apparatus failed') as raised:
                            driver.run_trial(**arguments)
                        score.assert_not_called()
                        expected = ValueError if mode == 'foreign_namespace' else subprocess.TimeoutExpired
                        self.assertIsInstance(raised.exception.__cause__, expected)
                lifecycle_file = output / 'artifacts/lifecycle.json'
                lifecycle = json.loads(lifecycle_file.read_text())
                projected = json.loads((output / 'artifacts/container_lifecycle.json').read_text())
                self.assertEqual(projected['source']['sha256'], driver.hashlib.sha256(lifecycle_file.read_bytes()).hexdigest())
                self.assertTrue(all(row['containerId'] == 'fixture-container' for row in lifecycle))
                self.assertEqual(lifecycle[-2]['source'], 'fixture-container:/state/.')
                self.assertEqual(lifecycle[-2]['destination'], str(output / 'agent/native'))
                self.assertEqual([row['stage'] for row in lifecycle[-2:]], ['evidence_copied', 'removed'])
                if mode in ('success', 'actor_nonzero'):
                    execution = next((args, kwargs) for args, kwargs in calls if args[0] == 'exec')
                    self.assertIn('AGENTHUB_PRIVATE_PID_NAMESPACE=private', execution[0])
                    self.assertEqual(execution[1]['timeout'], 2435)
                    self.assertEqual(projected['archive_status'], 'complete')
                    self.assertEqual(projected['cleanup_status'], 'complete')
                    self.assertIsNone(projected['error_type'])
                    protocol = json.loads((output / 'artifacts/protocol.json').read_text())
                    self.assertEqual(protocol['actor']['sdkRequestTimeoutMs'], 2400000)
                    metadata = json.loads((output / 'agent/native/actor_process.json').read_text())
                    native_result = json.loads((output / 'agent/native/trial/result.json').read_text())
                    self.assertEqual(metadata['exit_code'], 1 if mode == 'actor_nonzero' else 0)
                    self.assertEqual(native_result['runStatus'], 'failed' if mode == 'actor_nonzero' else 'complete')
                elif mode == 'foreign_namespace':
                    self.assertFalse(any(args[0] in ('start', 'exec') for args, _ in calls))
                    self.assertEqual(projected['error_type'], 'ValueError')
                else:
                    self.assertEqual(projected['error_type'], 'TimeoutExpired')
                    apparatus = json.loads((output / 'artifacts/apparatus-failure.json').read_text())
                    self.assertEqual(apparatus['type'], 'TimeoutExpired')
                    self.assertEqual([error['error_type'] for error in apparatus['secondary_errors']],
                        ['OSError', 'PermissionError'])

    def test_preflight_admits_only_allowlisted_pinned_tasks_without_a_key_or_docker(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(driver, 'docker') as docker:
            for task_id in driver.APPROVED_TASK_IDS:
                report = driver.preflight_task(SOURCE, task_id)
                self.assertEqual(report['taskId'], task_id)
                self.assertEqual(report['status'], 'supported')
                self.assertIsNone(report['score'])
                self.assertEqual(report['modelCalls'], 0)
            docker.assert_not_called()

    def test_changed_host_trace_or_scoring_controller_is_rejected_before_execution(self):
        required = {'eval/tracetrial/trace_adapter.py', 'eval/tracetrial/score_trial.py',
                    'eval/tracetrial/judge.py'}
        self.assertLessEqual(required, set(driver.REFRESH_CONTROLLER_FILES))
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'runtime.tar.gz').write_bytes(b'unused')
            (root/'build-manifest.json').write_text(json.dumps({'controllerFiles': {
                'eval/tracetrial/score_trial.py': 'wrong-hash'}}))
            manifest = {'files': {}}
            with patch.object(driver.tarfile, 'open') as archive:
                archive.return_value.__enter__.return_value.extractfile.return_value.read.return_value = json.dumps(manifest).encode()
                (root/'container_worker.py').write_bytes(Path(driver.__file__).with_name('container_worker.py').read_bytes())
                (root/'budget_contract.py').write_bytes(Path(driver.__file__).with_name('budget_contract.py').read_bytes())
                with self.assertRaisesRegex(ValueError, 'Refresh controller source differs'):
                    driver.verify_runtime_sources(root)

    def test_unapproved_or_path_task_ids_return_unsupported_before_resolving_a_task(self):
        with patch.object(driver, 'checked_source', return_value=Path('/fixture-source')), \
             patch.object(driver, 'check_installed_benchmark'), \
             patch('tracetrial_bench.task_resolver.resolve_task') as resolve:
            for task_id in ('../private', '/private/task', 'a\\b', 'E7-build-stale-artifact-001', ''):
                with self.subTest(task=task_id):
                    report = driver.preflight_task(Path('/fixture-source'), task_id)
                    self.assertEqual(report['status'], 'unsupported')
                    self.assertIsNone(report['score'])
                    self.assertTrue(report['reasons'])
            resolve.assert_not_called()

    def test_unsupported_run_has_no_output_or_container_side_effects_and_needs_no_key(self):
        report = {'status': 'unsupported', 'score': None, 'reasons': ['fixture missing capability']}
        with tempfile.TemporaryDirectory() as folder:
            plan = self.plan_file(folder)
            with patch.dict(os.environ, {}, clear=True), \
                 patch.object(driver, 'resolve_trial_task', return_value=(None, report, None)), \
                 patch.object(driver, 'docker') as docker, patch.object(driver, 'verify_build_files') as verify:
                output = Path(folder)/'not-created'
                result = driver.run_trial(source=Path('/unused'), output=output, context=Path('/unused'),
                                          image='unused', actor_proxy='', judge_proxy='', budget_file=plan)
                self.assertEqual(result, report)
                self.assertFalse(output.exists())
                docker.assert_not_called()
                verify.assert_not_called()

    def test_preflight_cli_needs_only_source_and_optional_task(self):
        report = {'status': 'supported', 'score': None}
        with patch.object(driver.sys, 'argv', ['run_trial.py', 'preflight', '--source', '/fixture-source']), \
             patch.object(driver, 'preflight_task', return_value=report) as preflight, \
             patch.object(driver.sys, 'stdout', new_callable=io.StringIO) as output:
            driver.main()
            preflight.assert_called_once_with(Path('/fixture-source'), TASK_ID, mode='task', overrides=None)
            self.assertEqual(json.loads(output.getvalue()), report)

    def test_existing_or_symlink_run_directory_is_rejected_before_key_or_docker(self):
        task, report, request = driver.resolve_trial_task(SOURCE)
        with tempfile.TemporaryDirectory() as folder:
            plan = self.plan_file(folder)
            link = Path(folder)/'dangling'
            link.symlink_to(Path(folder)/'new-target')
            with patch.dict(os.environ, {}, clear=True), \
                 patch.object(driver, 'resolve_trial_task', return_value=(task, report, request)), \
                 patch.object(driver, 'docker') as docker:
                for output in (Path(folder), link):
                    with self.subTest(output=output), self.assertRaises(FileExistsError):
                        driver.run_trial(source=Path('/unused'), output=output, context=Path('/unused'),
                                         image='unused', actor_proxy='', judge_proxy='', budget_file=plan)
                self.assertFalse((Path(folder)/'new-target').exists())
                docker.assert_not_called()

    def test_public_actor_request_contains_no_private_grading_inputs(self):
        source = checked_source(SOURCE)
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
            context = driver.prepare_build(SOURCE, Path(folder)/'build', reuse_image=reference)
            value = json.loads((context/'build-manifest.json').read_text())
            self.assertEqual(value['baseImage']['reference'], reference)
            self.assertEqual(value['baseImage']['runtimeCommit'], 'synthetic-baseline')
            self.assertEqual(value['runtime']['agenthubCommit'], revision)
            self.assertIn('refresh-runtime.py', value['buildFiles'])
            self.assertIn('baseline-runtime-source.json', value['buildFiles'])
            self.assertIn('budget_contract.py', value['buildFiles'])
            self.assertNotIn('build-manifest.json', value['buildFiles'])
            self.assertEqual((context/'Dockerfile').read_bytes(), Path(driver.__file__).with_name('Dockerfile.refresh').read_bytes())
            self.assertEqual(set(value['controllerFiles']), set(driver.REFRESH_CONTROLLER_FILES))
            verify_build_files(context, value)
            driver.verify_runtime_sources(context)

    def test_default_preparation_keeps_original_clean_build(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(driver, 'inspect_reuse_image') as inspect:
            context = driver.prepare_build(SOURCE, Path(folder)/'build')
            value = json.loads((context/'build-manifest.json').read_text())
            inspect.assert_not_called()
            self.assertNotIn('baseImage', value)
            self.assertFalse((context/'refresh-runtime.py').exists())
            self.assertEqual((context/'Dockerfile').read_bytes(), Path(driver.__file__).with_name('Dockerfile').read_bytes())


class LocalAssemblyTests(unittest.TestCase):
    image = 'agenthub/tracetrial:synthetic-fixed'
    base_id = 'sha256:' + 'b'*64

    def context(self, folder):
        root = Path(folder)
        names = ['Dockerfile', 'runtime.tar.gz', 'baseline-runtime-source.json', 'refresh-runtime.py',
                 'container_worker.py', 'budget_contract.py', *('recorder/' + name for name in driver.RECORDER_FILES)]
        for name in names:
            target = root/name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('synthetic build input: ' + name)
        manifest = {'buildFiles': directory_hashes(root), 'sourceRevision': driver.SOURCE_REVISION,
                    'runtime': {'synthetic': True}, 'actorUid': 501, 'actorGid': 20,
                    'controllerFiles': {'eval/tracetrial/run_trial.py': driver.hashlib.sha256(Path(driver.__file__).read_bytes()).hexdigest()},
                    'baseImage': {'reference': 'agenthub/tracetrial@sha256:' + 'a'*64,
                                  'id': self.base_id, 'architecture': 'arm64', 'os': 'linux'}}
        driver.write_json(root/'build-manifest.json', manifest)
        return root, manifest

    def process(self, calls, *, failure=None, changed_base=False, root_probe=False):
        def run(command, **kwargs):
            calls.append((command, kwargs))
            self.assertEqual(command[0], 'docker')
            operation = command[1]
            stage = ('probe' if operation == 'exec' and 'node' in command else
                     'refresh' if operation == 'exec' and 'python3' in command else
                     'final-inspect' if command[1:3] == ['image', 'inspect'] and command[3] == self.image else operation)
            if failure == 'create-timeout' and stage == 'create':
                raise subprocess.TimeoutExpired(command, 120)
            if stage == failure:
                return SimpleNamespace(returncode=1, stdout='', stderr='synthetic failure')
            if command[1:3] == ['image', 'inspect']:
                inspection = {'Id': self.base_id if command[3] == self.base_id else 'sha256:' + 'c'*64,
                              'Architecture': 'arm64', 'Os': 'linux', 'Config': {'User': '501:20'}}
                if changed_base and command[3] == self.base_id:
                    inspection['Id'] = 'sha256:' + 'd'*64
                stdout = json.dumps([inspection])
            elif stage == 'create':
                stdout = 'e'*64
            elif stage == 'probe':
                stdout = json.dumps({'uid': 0 if root_probe else 501, 'node': 'v24.13.1', 'arch': 'arm64',
                                     'sqlite': 'ok', 'profile': 'ok', 'modelCalls': 0})
            else:
                stdout = ''
            return SimpleNamespace(returncode=0, stdout=stdout, stderr='')
        return run

    def test_reuse_assembles_offline_by_id_and_retains_nonroot_probe_and_recipe_provenance(self):
        calls = []
        with tempfile.TemporaryDirectory() as folder, \
             patch.dict(os.environ, {'OPENAI_API_KEY': 'private-test-key', 'ANTHROPIC_API_KEY': 'other-private-key'}, clear=True), \
             patch.object(driver.subprocess, 'run', side_effect=self.process(calls)), \
             patch.object(driver, 'inspect_reuse_image') as inspect_reference:
            context, manifest = self.context(folder)
            driver.build_image(context, self.image, 'unused-proxy')
            inspect_reference.assert_not_called()
            commands = [command for command, _kwargs in calls]
            self.assertEqual(commands[0], ['docker', 'image', 'inspect', self.base_id])
            create = commands[1]
            self.assertEqual(create[:5], ['docker', 'create', '--pull=never', '--network=none', '--name'])
            container = create[5]
            self.assertTrue(container.startswith('agenthub-refresh-'))
            self.assertEqual(create[6:], [self.base_id, 'sleep', 'infinity'])
            operations = [command[1] for command in commands]
            self.assertEqual(operations, ['image', 'create', 'cp', 'cp', 'cp', 'cp', 'cp', 'cp', 'start',
                                          'exec', 'exec', 'exec', 'exec', 'commit', 'image', 'rm'])
            self.assertEqual(commands[2], ['docker', 'cp', str(context/'runtime.tar.gz'), container+':/tmp/agenthub-runtime.tar.gz'])
            self.assertEqual(commands[6], ['docker', 'cp', str(context/'budget_contract.py'), container+':/opt/agenthub-eval/budget_contract.py'])
            self.assertEqual(commands[7], ['docker', 'cp', str(context/'recorder')+'/.', container+':/opt/recorder'])
            self.assertEqual(commands[-1], ['docker', 'rm', '--force', container])
            for command in commands[9:12]:
                self.assertEqual(command[:3], ['docker', 'exec', '--user=0'])
            self.assertIn('chown 501:20 /state /state/home', commands[11][-1])
            probe = commands[12]
            self.assertEqual(probe[:7], ['docker', 'exec', '--user', '501:20', '--workdir', '/installed-agent/agenthub', container])
            self.assertIn('better-sqlite3', probe[-1])
            self.assertIn('runTraceTrial', probe[-1])
            self.assertIn('createIsolatedProfile', probe[-1])
            self.assertIn('process.getuid()===0', probe[-1])
            self.assertIn('API_KEY', probe[-1])
            self.assertEqual(commands[13][-2:], [container, self.image])
            self.assertIn('USER 501:20', commands[13])
            self.assertNotIn(manifest['baseImage']['reference'], json.dumps(commands))
            for _command, kwargs in calls:
                self.assertNotIn('OPENAI_API_KEY', kwargs['env'])
                self.assertNotIn('ANTHROPIC_API_KEY', kwargs['env'])
                self.assertNotIn('private-test-key', json.dumps(kwargs))
            image = json.loads((context/'image.json').read_text())
            self.assertEqual(image['baseImage'], manifest['baseImage'])
            self.assertEqual(image['runtime'], manifest['runtime'])
            self.assertEqual(image['buildMethod'], 'offline local container refresh and commit')
            self.assertEqual(image['network'], 'none')
            self.assertFalse(image['dependenciesReinstalled'])
            self.assertEqual(image['probes']['uid'], 501)
            self.assertEqual(image['probes']['modelCalls'], 0)
            self.assertEqual(image['dockerfileSha256'], manifest['buildFiles']['Dockerfile'])
            self.assertEqual(image['assemblyControllerSha256'], manifest['controllerFiles']['eval/tracetrial/run_trial.py'])
            ledger = json.loads((context/'assembly-log.json').read_text())
            self.assertEqual([entry['argv'] for entry in ledger], commands)
            self.assertTrue(all(entry['exitCode'] == 0 for entry in ledger))
            self.assertNotIn('private-test-key', json.dumps(ledger))
            self.assertNotIn('build-manifest.json', manifest['buildFiles'])
            verify_build_files(context, manifest)

    def test_every_assembly_failure_cleans_owned_container_and_cannot_write_image_metadata(self):
        for failure in ('create-timeout', 'cp', 'start', 'refresh', 'probe', 'commit', 'final-inspect', 'rm'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as folder:
                calls = []
                context, _manifest = self.context(folder)
                with patch.object(driver.subprocess, 'run', side_effect=self.process(calls, failure=failure)):
                    with self.assertRaises((RuntimeError, subprocess.TimeoutExpired)):
                        driver.build_image(context, self.image, '')
                commands = [command for command, _kwargs in calls]
                container = commands[1][5]
                self.assertEqual(commands[-1], ['docker', 'rm', '--force', container])
                self.assertFalse((context/'image.json').exists())
                ledger = json.loads((context/'assembly-log.json').read_text())
                self.assertEqual(ledger[-1]['argv'], commands[-1])
                if failure == 'create-timeout':
                    self.assertEqual(ledger[1]['errorType'], 'TimeoutExpired')

    def test_hash_or_controller_drift_is_rejected_before_docker(self):
        for drift in ('build', 'controller', 'unverified-input'):
            with self.subTest(drift=drift), tempfile.TemporaryDirectory() as folder, \
                 patch.object(driver, 'docker') as docker:
                context, manifest = self.context(folder)
                if drift == 'build':
                    (context/'runtime.tar.gz').write_bytes(b'changed')
                elif drift == 'controller':
                    manifest['controllerFiles']['eval/tracetrial/run_trial.py'] = '0'*64
                else:
                    del manifest['buildFiles']['container_worker.py']
                driver.write_json(context/'build-manifest.json', manifest)
                with self.assertRaises(ValueError):
                    driver.build_image(context, self.image, '')
                docker.assert_not_called()

    def test_changed_local_base_is_rejected_before_container_creation(self):
        calls = []
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(driver.subprocess, 'run', side_effect=self.process(calls, changed_base=True)):
            context, _manifest = self.context(folder)
            with self.assertRaisesRegex(ValueError, 'immutable Linux image ID'):
                driver.build_image(context, self.image, '')
            self.assertEqual([command[1] for command, _kwargs in calls], ['image'])
            self.assertFalse((context/'image.json').exists())

    def test_root_probe_report_is_rejected_and_cleaned_before_commit(self):
        calls = []
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(driver.subprocess, 'run', side_effect=self.process(calls, root_probe=True)):
            context, _manifest = self.context(folder)
            with self.assertRaisesRegex(ValueError, 'Non-root no-key'):
                driver.build_image(context, self.image, '')
            self.assertNotIn('commit', [command[1] for command, _kwargs in calls])
            self.assertEqual(calls[-1][0][1:3], ['rm', '--force'])

    def test_clean_build_keeps_the_existing_docker_build_path(self):
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(driver.subprocess, 'run', return_value=SimpleNamespace(returncode=0)) as run, \
             patch.object(driver, 'docker', return_value=SimpleNamespace(stdout=json.dumps([
                 {'Id': 'sha256:synthetic-image', 'Architecture': 'arm64', 'Os': 'linux'}]))), \
             patch.object(driver, 'assemble_reused_image') as assemble:
            context = Path(folder)
            driver.write_json(context/'build-manifest.json', {'buildFiles': {}, 'runtime': {'synthetic': True}})
            driver.build_image(context, self.image, 'http://synthetic-proxy')
            assemble.assert_not_called()
            self.assertEqual(run.call_args.args[0], ['docker', 'build', '--network=default', '--build-arg',
                'HTTP_PROXY=http://synthetic-proxy', '--build-arg', 'HTTPS_PROXY=http://synthetic-proxy',
                '--build-arg', f'ACTOR_UID={os.getuid()}', '--build-arg', f'ACTOR_GID={os.getgid()}',
                '--tag', self.image, str(context)])
            self.assertFalse((context/'assembly-log.json').exists())


if __name__ == '__main__':
    unittest.main()

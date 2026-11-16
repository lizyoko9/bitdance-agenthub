import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from . import run_trial as driver


class ContainerLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.native = self.root / 'native'
        self.native.mkdir()
        self.artifacts = self.root / 'artifacts'
        self.artifacts.mkdir()
        self.source = self.artifacts / 'lifecycle.json'
        self.container = 'observed-container'

    def archives(self):
        for name in driver.REQUIRED_NATIVE_ARCHIVES:
            path = self.native / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'{"exitCode":75,"status":"failed"}\n')

    def rows(self):
        return [{'stage': name, 'containerId': self.container, 'at': index + 1,
                 **({'exitCode': 0} if name in ('created', 'actor_exited', 'evidence_copied', 'removed') else {}),
                 **({'source': self.container + ':/state/.', 'destination': str(self.native)}
                    if name == 'evidence_copied' else {})}
                for index, name in enumerate(('created', 'pid_namespace_verified', 'actor_started',
                                               'actor_exited', 'evidence_copied', 'removed'))]

    def project(self, rows=None, errors=None):
        self.source.write_text(json.dumps(self.rows() if rows is None else rows))
        return driver.container_lifecycle_projection(self.source, self.native, errors)

    def test_success_binds_actual_stage_bytes_and_archive_hashes_without_interpreting_tool_exit_75(self):
        self.archives()
        result = self.project()
        self.assertEqual(result['schema_version'], 'agenthub_container_lifecycle_projection_v1')
        self.assertEqual(result['producer'], 'agenthub')
        self.assertEqual(result['archive_status'], 'complete')
        self.assertEqual(result['cleanup_status'], 'complete')
        self.assertIsNone(result['error_type'])
        self.assertEqual(result['source']['sha256'], hashlib.sha256(self.source.read_bytes()).hexdigest())
        self.assertEqual(result['stage_indices']['evidence_copied'], [4])
        self.assertEqual(len(result['archive_validation']['files']), 8)
        for record in result['archive_validation']['files']:
            data = Path(record['path']).read_bytes()
            self.assertEqual(record['bytes'], len(data))
            self.assertEqual(record['sha256'], hashlib.sha256(data).hexdigest())

    def test_actual_source_content_drives_status_even_if_an_older_memory_copy_was_successful(self):
        self.archives()
        old = self.rows()
        changed = json.loads(json.dumps(old))
        changed[4]['exitCode'] = 1
        self.source.write_text(json.dumps(changed, indent=2))
        result = driver.container_lifecycle_projection(self.source, self.native)
        self.assertEqual(old[4]['exitCode'], 0)
        self.assertEqual(result['archive_status'], 'failed')
        self.assertEqual(result['cleanup_status'], 'complete')
        self.assertEqual(result['source']['sha256'], hashlib.sha256(self.source.read_bytes()).hexdigest())

    def test_missing_or_ambiguous_copy_remove_and_created_stages_cannot_be_complete(self):
        self.archives()
        for name in ('created', 'evidence_copied', 'removed'):
            for mode in ('missing', 'duplicate'):
                with self.subTest(stage=name, mode=mode):
                    rows = self.rows()
                    index = next(i for i, row in enumerate(rows) if row['stage'] == name)
                    if mode == 'missing':
                        rows.pop(index)
                    else:
                        rows.insert(index, dict(rows[index]))
                    result = self.project(rows)
                    self.assertIsNotNone(result['error_type'])
                    relevant = 'cleanup_status' if name == 'removed' else 'archive_status'
                    self.assertNotEqual(result[relevant], 'complete')

    def test_conflicting_container_id_on_any_referenced_stage_fails_closed(self):
        self.archives()
        for index in range(6):
            with self.subTest(index=index):
                rows = self.rows()
                rows[index]['containerId'] = 'different-container'
                result = self.project(rows)
                self.assertNotEqual(result['archive_status'], 'complete')
                self.assertNotEqual(result['cleanup_status'], 'complete')
                self.assertIsNotNone(result['error_type'])

    def test_copy_source_destination_stage_order_and_typed_outcomes_are_required(self):
        self.archives()
        mutations = [lambda rows: rows[4].update(source='other:/state/.'),
                     lambda rows: rows[4].update(destination='/different/native'),
                     lambda rows: rows.reverse()]
        mutations.extend(lambda rows, value=value: rows[4].update(exitCode=value) for value in (True, '0', 0.0, 1))
        mutations.extend(lambda rows, value=value: rows[0].update(exitCode=value) for value in (True, '0', 0.0, 1))
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                rows = self.rows()
                mutate(rows)
                result = self.project(rows)
                self.assertNotEqual(result['archive_status'], 'complete')
                self.assertIsNotNone(result['error_type'])

    def test_each_required_native_file_is_required_even_after_successful_copy(self):
        self.archives()
        for name in driver.REQUIRED_NATIVE_ARCHIVES:
            with self.subTest(name=name):
                path = self.native / name
                contents = path.read_bytes()
                path.unlink()
                result = self.project()
                self.assertEqual(result['archive_status'], 'failed')
                self.assertEqual(result['cleanup_status'], 'complete')
                self.assertEqual(result['archive_validation']['errors'][0]['path'], name)
                path.write_bytes(contents)

    def test_symlink_file_and_symlink_ancestor_do_not_satisfy_archive_contract(self):
        self.archives()
        path = self.native / 'actor_process.json'
        path.unlink()
        path.symlink_to(self.native / 'provider_summary.json')
        self.assertEqual(self.project()['archive_status'], 'failed')
        path.unlink()
        path.write_text('{}')
        (self.native / 'trial').rename(self.root / 'external-trial')
        (self.native / 'trial').symlink_to(self.root / 'external-trial', target_is_directory=True)
        result = self.project()
        self.assertEqual(result['archive_status'], 'failed')
        self.assertEqual(len(result['archive_validation']['errors']), 4)

    def test_directory_cannot_substitute_for_required_regular_archive(self):
        self.archives()
        path = self.native / 'provider_summary.json'
        path.unlink()
        path.mkdir()
        self.assertEqual(self.project()['archive_status'], 'failed')

    def test_existing_primary_error_survives_successful_later_cleanup(self):
        self.archives()
        errors = [{'stage': 'actor', 'error_type': 'TimeoutExpired'},
                  {'stage': 'evidence_copied', 'error_type': 'OSError'}]
        rows = self.rows()
        rows[4].update(exitCode=1, errorType='OSError')
        rows.insert(4, {'stage': 'driver_error', 'operation': 'actor', 'containerId': self.container,
                        'errorType': 'TimeoutExpired', 'at': 4.5})
        result = self.project(rows, errors=errors)
        self.assertEqual(result['error_type'], 'TimeoutExpired')
        self.assertEqual(result['primary_error'], {**errors[0], 'source_stage_index': 4})
        self.assertEqual(result['secondary_errors'][0], {**errors[1], 'source_stage_index': 5})
        self.assertEqual(result['cleanup_status'], 'complete')
        replayed = driver.container_lifecycle_projection(self.source, self.native)
        self.assertEqual(replayed['primary_error'], result['primary_error'])
        self.assertEqual(replayed['secondary_errors'], result['secondary_errors'])

    def finalize(self, docker, state=None):
        state = {'primary': None, 'errors': []} if state is None else state
        rows = self.rows()[:4]
        for error in state['errors']:
            rows.append({'stage': 'driver_error', 'operation': error['stage'], 'containerId': self.container,
                         'errorType': error['error_type'], 'at': 4.5})
        with patch.object(driver, 'docker', side_effect=docker) as mocked:
            driver.finish_confirmation_container(self.container, self.native, rows, self.artifacts, state)
        result = json.loads((self.artifacts / 'container_lifecycle.json').read_text())
        self.assertEqual(result['source']['sha256'], hashlib.sha256(self.source.read_bytes()).hexdigest())
        self.assertEqual(json.loads(self.source.read_text()), rows)
        return state, result, mocked

    def test_copy_and_remove_succeed_with_real_files_and_explicit_same_container_provenance(self):
        def docker(*arguments, **options):
            if arguments[0] == 'cp':
                self.archives()
            return SimpleNamespace(returncode=0)

        state, result, mocked = self.finalize(docker)
        self.assertIsNone(state['primary'])
        self.assertEqual(result['archive_status'], result['cleanup_status'])
        self.assertEqual(result['archive_status'], 'complete')
        rows = json.loads(self.source.read_text())
        self.assertEqual(rows[4]['source'], self.container + ':/state/.')
        self.assertEqual(rows[4]['destination'], str(self.native))
        self.assertEqual(rows[5]['containerId'], self.container)
        self.assertEqual([call.args[0] for call in mocked.call_args_list], ['cp', 'rm'])

    def test_copy_nonzero_or_exception_cannot_be_washed_into_success_by_removal(self):
        for failure in (2, OSError('copy failed')):
            with self.subTest(failure=failure):
                def docker(*arguments, **options):
                    if arguments[0] == 'cp':
                        self.archives()
                        if isinstance(failure, Exception):
                            raise failure
                        return SimpleNamespace(returncode=failure)
                    return SimpleNamespace(returncode=0)

                state, result, mocked = self.finalize(docker)
                self.assertIsNotNone(state['primary'])
                self.assertEqual(result['archive_status'], 'failed')
                self.assertEqual(result['cleanup_status'], 'complete')
                self.assertEqual(mocked.call_args_list[-1].args, ('rm', '--force', self.container))
                self.assertIn('errorType', json.loads(self.source.read_text())[4])

    def test_remove_nonzero_or_exception_keeps_complete_archive_and_failed_cleanup(self):
        self.archives()
        for failure in (1, OSError('remove failed')):
            with self.subTest(failure=failure):
                def docker(*arguments, **options):
                    if arguments[0] == 'rm':
                        if isinstance(failure, Exception):
                            raise failure
                        return SimpleNamespace(returncode=failure)
                    return SimpleNamespace(returncode=0)

                state, result, _ = self.finalize(docker)
                self.assertIsNotNone(state['primary'])
                self.assertEqual(result['archive_status'], 'complete')
                self.assertEqual(result['cleanup_status'], 'failed')

    def test_primary_actor_exception_survives_copy_and_remove_exceptions_with_all_outcomes_persisted(self):
        original = ValueError('actor failure')
        state = {'primary': original, 'errors': [{'stage': 'actor', 'error_type': 'ValueError'}]}

        def docker(*arguments, **options):
            if arguments[0] == 'cp':
                raise OSError('copy failure')
            raise subprocess.TimeoutExpired(['docker', 'rm'], 1)

        state, result, _ = self.finalize(docker, state)
        self.assertIs(state['primary'], original)
        self.assertEqual(result['error_type'], 'ValueError')
        self.assertEqual([error['error_type'] for error in state['errors']], ['ValueError', 'OSError', 'TimeoutExpired'])
        self.assertEqual([row['errorType'] for row in json.loads(self.source.read_text())[4:]],
                         ['ValueError', 'OSError', 'TimeoutExpired'])

    def test_source_persistence_failure_does_not_read_an_older_successful_file_or_replace_primary(self):
        self.archives()
        self.project()
        original = ValueError('original actor failure')
        state = {'primary': original, 'errors': [{'stage': 'actor', 'error_type': 'ValueError'}]}
        real_write = driver.write_json

        def write(path, value):
            if Path(path) == self.source:
                raise PermissionError('source write failed')
            real_write(path, value)

        with patch.object(driver, 'write_json', side_effect=write), \
             patch.object(driver, 'docker', return_value=SimpleNamespace(returncode=0)):
            driver.finish_confirmation_container(self.container, self.native, self.rows()[:4], self.artifacts, state)
        result = json.loads((self.artifacts / 'container_lifecycle.json').read_text())
        self.assertIs(state['primary'], original)
        self.assertEqual(result['error_type'], 'ValueError')
        self.assertIsNone(result['source']['sha256'])
        self.assertEqual(result['archive_status'], 'failed')
        self.assertEqual(result['cleanup_status'], 'failed')
        self.assertIn('PermissionError', [error['error_type'] for error in result['secondary_errors']])

    def test_projection_persistence_failure_keeps_original_stage_file_and_primary_exception(self):
        self.archives()
        original = ValueError('original actor failure')
        state = {'primary': original, 'errors': [{'stage': 'actor', 'error_type': 'ValueError'}]}
        real_write = driver.write_json

        def write(path, value):
            if Path(path).name == 'container_lifecycle.json':
                raise PermissionError('projection write failed')
            real_write(path, value)

        with patch.object(driver, 'write_json', side_effect=write), \
             patch.object(driver, 'docker', return_value=SimpleNamespace(returncode=0)):
            driver.finish_confirmation_container(self.container, self.native, self.rows()[:4], self.artifacts, state)
        self.assertIs(state['primary'], original)
        self.assertTrue(self.source.is_file())
        self.assertEqual(state['errors'][-1], {'stage': 'projection_persistence', 'error_type': 'PermissionError'})

    def test_no_created_container_cannot_create_success_from_an_empty_log(self):
        state = {'primary': None, 'errors': []}
        with patch.object(driver, 'docker') as docker:
            driver.finish_confirmation_container(None, self.native, [], self.artifacts, state)
        docker.assert_not_called()
        result = json.loads((self.artifacts / 'container_lifecycle.json').read_text())
        self.assertEqual(result['archive_status'], 'not_started')
        self.assertEqual(result['cleanup_status'], 'not_started')
        self.assertIsNotNone(result['error_type'])


if __name__ == '__main__':
    unittest.main()

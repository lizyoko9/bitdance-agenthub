import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import Mock, patch

from . import container_worker as worker


class PassiveThread:
    ident = None

    def __init__(self, **kwargs):
        self.target = kwargs['target']

    def start(self):
        self.ident = 100

    def join(self, **kwargs):
        pass

    def is_alive(self):
        return False


class ProcessObserverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.proc = Path(self.tmp.name)
        self.process(1, start=1)
        (self.proc/'1/cmdline').write_bytes(b'sleep\0infinity\0')
        self.process(10, start=10, uids=(0, 0, 0, 0))
        (self.proc/'self').symlink_to('10')
        self.patch('platform', 'linux', worker.sys)
        self.patch('geteuid', lambda: 0, worker.os)
        self.patch('Thread', PassiveThread, worker.threading)
        self.observer = worker.ProcessObserver(proc_root=self.proc, worker_pid=10, sleeper=lambda _: None,
            private_pid_namespace=True)

    def patch(self, name, value, target):
        result = patch.object(target, name, value)
        self.addCleanup(result.stop)
        return result.start()

    def process(self, pid, *, start=None, state='S', ppid=1, pgid=None, sid=None, uids=(501, 501, 501, 501)):
        directory = self.proc/str(pid)
        directory.mkdir(exist_ok=True)
        (directory/'ns').mkdir(exist_ok=True)
        link = directory/'ns/pid'
        if not link.is_symlink():
            link.symlink_to('pid:[12345]')
        fields = [state, str(ppid), str(pid if pgid is None else pgid), str(pid if sid is None else sid)]
        fields += ['0'] * 15 + [str(pid if start is None else start)]
        (directory/'stat').write_text(f'{pid} (name with ) parentheses) ' + ' '.join(fields))
        (directory/'status').write_text('Name:\tfixture\nUid:\t' + '\t'.join(map(str, uids)) + '\n')

    def remove(self, pid):
        shutil.rmtree(self.proc/str(pid))

    def start_actor(self):
        self.observer.start()
        self.process(20, start=200, ppid=10)
        self.observer.bind_actor(20)

    def test_clean_natural_exit_has_two_censuses_and_bound_identity_provenance(self):
        self.start_actor()
        self.remove(20)
        with patch.object(worker.os, 'kill') as kill, patch.object(worker.os, 'killpg') as killpg:
            receipt = self.observer.freeze(natural_exit=True)
        kill.assert_not_called()
        killpg.assert_not_called()
        self.assertTrue(receipt['descendant_cleanup_valid'])
        self.assertEqual(receipt['scope'], 'isolated_container_pid_delta')
        self.assertTrue(receipt['private_pid_namespace'])
        self.assertEqual(receipt['namespace_verification'], 'driver_private_pidns_and_self_proc')
        self.assertEqual(receipt['final_live_counts'], [0, 0])
        self.assertEqual(receipt['final_census_count'], 2)
        self.assertEqual(receipt['actor_identity'], {'pid': 20, 'start_ticks': 200})
        self.assertEqual(receipt['observed_new_process_count'], 1)
        self.assertEqual(receipt['observed_identity_sha256'], hashlib.sha256(b'[[20,200]]').hexdigest())

    def test_missing_or_nonboolean_private_contract_refuses_observation(self):
        for contract in (False, None, 1, 'private'):
            with self.subTest(contract=contract):
                observer = worker.ProcessObserver(proc_root=self.proc, worker_pid=10,
                    sleeper=lambda _: None, private_pid_namespace=contract)
                with self.assertRaisesRegex(RuntimeError, 'baseline'):
                    observer.start()
                receipt = observer.freeze(natural_exit=False)
                self.assertFalse(receipt['private_pid_namespace'])
                self.assertFalse(receipt['baseline_verified'])
                self.assertTrue(receipt['tracking_failed'])
                self.assertIsNone(receipt['pid_namespace'])
                self.assertIsNone(receipt['residual_process_count'])

    def test_self_namespace_mapping_is_required_without_reading_pid1_namespace(self):
        (self.proc/'1/ns/pid').unlink()
        self.start_actor()
        self.remove(20)
        self.assertTrue(self.observer.freeze(natural_exit=True)['descendant_cleanup_valid'])
        (self.proc/'self').unlink()
        (self.proc/'self').symlink_to('1')
        observer = worker.ProcessObserver(proc_root=self.proc, worker_pid=10, private_pid_namespace=True)
        with self.assertRaisesRegex(RuntimeError, 'baseline'):
            observer.start()
        receipt = observer.freeze(natural_exit=False)
        self.assertTrue(receipt['tracking_failed'])
        self.assertFalse(receipt['descendant_cleanup_valid'])

    def test_detached_reparented_changed_uid_process_is_a_live_residual(self):
        self.start_actor()
        self.process(30, ppid=1, pgid=30, sid=30, uids=(0, 0, 0, 0))
        self.remove(20)
        receipt = self.observer.freeze(natural_exit=True)
        self.assertFalse(receipt['descendant_cleanup_valid'])
        self.assertEqual(receipt['residual_process_count'], 1)
        self.assertEqual(receipt['residual_processes'][0]['uids'], [0, 0, 0, 0])

    def test_two_final_censuses_use_identity_union_and_do_not_wait_leaks_away(self):
        for replacement in (False, True):
            with self.subTest(replacement=replacement):
                self.observer = worker.ProcessObserver(proc_root=self.proc, worker_pid=10,
                    sleeper=lambda _: self.replace_leak(replacement), private_pid_namespace=True)
                self.start_actor()
                self.remove(20)
                self.process(30)
                receipt = self.observer.freeze(natural_exit=True)
                self.assertEqual(receipt['residual_process_count'], 2 if replacement else 1)
                self.assertEqual(receipt['final_live_counts'], [1, int(replacement)])
                self.assertFalse(receipt['descendant_cleanup_valid'])
                if replacement:
                    self.remove(31)

    def replace_leak(self, replacement):
        self.remove(30)
        if replacement:
            self.process(31)

    def test_zombies_are_separate_dead_not_live_observations(self):
        self.start_actor()
        self.process(30, state='Z')
        self.remove(20)
        receipt = self.observer.freeze(natural_exit=True)
        self.assertEqual(receipt['zombie_process_count'], 1)
        self.assertEqual(receipt['residual_process_count'], 0)
        self.assertTrue(receipt['descendant_cleanup_valid'])

    def test_forced_stop_receipt_is_immutable_after_cleanup_and_caller_mutation(self):
        self.start_actor()
        receipt = self.observer.freeze(natural_exit=False, forced_stop=True)
        expected = json.loads(json.dumps(receipt))
        self.remove(20)
        receipt['tracking_errors'].append('caller mutation')
        receipt['residual_process_count'] = 0
        self.assertEqual(self.observer.freeze(natural_exit=True), expected)
        self.assertTrue(expected['forced_stop'])
        self.assertFalse(expected['descendant_cleanup_valid'])
        self.assertEqual(expected['residual_process_count'], 1)

    def test_reused_baseline_pid_or_changed_namespace_yields_unknown_not_zero(self):
        for drift in ('pid', 'namespace'):
            with self.subTest(drift=drift):
                self.observer = worker.ProcessObserver(proc_root=self.proc, worker_pid=10,
                    sleeper=lambda _: None, private_pid_namespace=True)
                self.start_actor()
                self.remove(20)
                if drift == 'pid':
                    self.process(1, start=999)
                else:
                    link = self.proc/'10/ns/pid'
                    link.unlink()
                    link.symlink_to('pid:[999]')
                receipt = self.observer.freeze(natural_exit=True)
                self.assertTrue(receipt['tracking_failed'])
                self.assertIsNone(receipt['residual_process_count'])
                self.assertFalse(receipt['descendant_cleanup_valid'])
                self.process(1, start=1)

    def test_extra_baseline_or_unexpected_pid1_command_refuses_start_with_failed_receipt(self):
        for bad in ('extra', 'command'):
            with self.subTest(bad=bad):
                self.observer = worker.ProcessObserver(proc_root=self.proc, worker_pid=10,
                    sleeper=lambda _: None, private_pid_namespace=True)
                if bad == 'extra':
                    self.process(99)
                else:
                    (self.proc/'1/cmdline').write_bytes(b'sh\0-c\0sleep infinity\0')
                with self.assertRaisesRegex(RuntimeError, 'baseline'):
                    self.observer.start()
                receipt = self.observer.freeze(natural_exit=False)
                self.assertTrue(receipt['tracking_failed'])
                self.assertFalse(receipt['baseline_verified'])
                self.assertEqual(receipt['final_census_count'], 0)
                self.assertEqual(receipt['final_live_counts'], [None, None])
                self.assertIsNone(receipt['residual_processes'])
                if bad == 'extra':
                    self.remove(99)

    def test_third_process_arriving_during_baseline_confirmation_refuses_start(self):
        original = self.observer._snapshot
        calls = 0
        def arrives(**kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                self.process(99)
            return original(**kwargs)
        with patch.object(self.observer, '_snapshot', side_effect=arrives):
            with self.assertRaisesRegex(RuntimeError, 'baseline'):
                self.observer.start()
        receipt = self.observer.freeze(natural_exit=False)
        self.assertFalse(receipt['baseline_verified'])
        self.assertTrue(receipt['tracking_failed'])

    def test_final_census_rejects_new_child_after_initial_directory_enumeration(self):
        self.start_actor()
        self.remove(20)
        self.process(30)
        original = self.observer._read_record
        def forks_then_exits(pid):
            if pid == 30:
                self.process(31)
                self.remove(30)
                raise FileNotFoundError
            return original(pid)
        with patch.object(self.observer, '_read_record', side_effect=forks_then_exits):
            receipt = self.observer.freeze(natural_exit=True)
        self.assertTrue(receipt['tracking_failed'])
        self.assertIsNone(receipt['residual_process_count'])
        self.assertFalse(receipt['descendant_cleanup_valid'])

    def test_monitor_start_failure_can_still_freeze_a_failed_receipt(self):
        with patch.object(PassiveThread, 'start', side_effect=RuntimeError('private thread failure')):
            with self.assertRaisesRegex(RuntimeError, 'baseline'):
                self.observer.start()
        receipt = self.observer.freeze(natural_exit=False)
        self.assertTrue(receipt['tracking_failed'])
        self.assertIsNone(receipt['residual_process_count'])
        self.assertNotIn('private thread failure', json.dumps(receipt))

    def test_join_timeout_freezes_unknown_even_when_background_observations_change(self):
        self.start_actor()
        changed = {**self.observer._read_record(20), 'pid': 31, 'start_ticks': 31}
        class ConcurrentObservations(dict):
            def values(inner):
                for value in super(ConcurrentObservations, inner).values():
                    inner[(31, 31)] = changed
                    yield value
        self.observer._observed = ConcurrentObservations(self.observer._observed)
        self.observer._thread = Mock()
        self.observer._thread.is_alive.return_value = True
        receipt = self.observer.freeze(natural_exit=True)
        self.assertTrue(receipt['tracking_failed'])
        self.assertIsNone(receipt['residual_process_count'])
        self.assertFalse(receipt['descendant_cleanup_valid'])
        self.observer._observed[(31, 31)] = changed
        self.assertEqual(self.observer.freeze(natural_exit=True), receipt)

    def test_permission_malformed_or_unconfirmed_missing_record_does_not_become_empty(self):
        self.start_actor()
        self.remove(20)
        self.process(30)
        original = self.observer._read_record
        def denied(pid):
            if pid == 30:
                raise PermissionError('sensitive contents must not be persisted')
            return original(pid)
        with patch.object(self.observer, '_read_record', side_effect=denied):
            receipt = self.observer.freeze(natural_exit=True)
        self.assertTrue(receipt['tracking_failed'])
        self.assertIsNone(receipt['residual_process_count'])
        self.assertNotIn('sensitive contents', json.dumps(receipt))
        for contents in ('bad', '30 (name) S 0 0 0'):
            (self.proc/'30/stat').write_text(contents)
            with self.assertRaises(worker.ProcessObservationError):
                self.observer._read_record(30)
        self.process(30)
        with patch.object(self.observer, '_read_record', side_effect=FileNotFoundError):
            with self.assertRaisesRegex(worker.ProcessObservationError, 'unconfirmed'):
                self.observer._snapshot()

    def test_only_confirmed_process_disappearance_is_normal_churn(self):
        self.start_actor()
        self.remove(20)
        self.process(30)
        original = self.observer._read_record
        def disappears(pid):
            if pid == 30:
                self.remove(30)
                raise FileNotFoundError
            return original(pid)
        with patch.object(self.observer, '_read_record', side_effect=disappears):
            receipt = self.observer.freeze(natural_exit=True)
        self.assertTrue(receipt['descendant_cleanup_valid'])

    def test_stat_generation_race_is_rejected_even_when_uids_are_valid(self):
        self.start_actor()
        self.process(30)
        before = self.observer._read_stat(30)
        after = {**before, 'start_ticks': 999}
        with patch.object(self.observer, '_read_stat', side_effect=[before, after]):
            with self.assertRaisesRegex(worker.ProcessObservationError, 'identity_changed'):
                self.observer._read_record(30)
        self.observer.freeze(natural_exit=False)

    def test_final_wait_failure_is_recorded_without_inventing_second_census(self):
        self.start_actor()
        self.remove(20)
        self.observer._sleep = lambda _: (_ for _ in ()).throw(OSError('private detail'))
        receipt = self.observer.freeze(natural_exit=True)
        self.assertEqual(receipt['final_census_count'], 1)
        self.assertEqual(receipt['final_live_counts'], [0, None])
        self.assertTrue(receipt['tracking_failed'])
        self.assertIsNone(receipt['residual_process_count'])
        self.assertNotIn('private detail', json.dumps(receipt))


if __name__ == '__main__':
    unittest.main()

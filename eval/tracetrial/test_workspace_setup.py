import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
from types import SimpleNamespace
import unittest

from .workspace_setup import (E2_SETUP, E2_SETUP_POLICY, apply_workspace_setup,
                              validate_workspace_setup, workspace_setup_plan)
from .budget_contract import STDERR_TASK_ID


SOURCE = Path(os.environ.get('AGENTHUB_TRACETRIAL_TEST_SOURCE', '/private/tmp/agenthub-tracetrial-source'))


@unittest.skipUnless((SOURCE / 'Task' / STDERR_TASK_ID).is_dir(), 'pinned TraceTrial source required')
class WorkspaceSetupTests(unittest.TestCase):
    def setUp(self):
        self.task = SimpleNamespace(task_id=STDERR_TASK_ID, task_dir=SOURCE / 'Task' / STDERR_TASK_ID)
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.workspace = self.root / 'workspace'
        shutil.copytree(self.task.task_dir / 'workspace', self.workspace)
        self.receipt = self.root / 'setup.json'

    def test_default_rejects_without_running_fixture_and_explicit_policy_only_plans(self):
        fixture = self.task.task_dir / 'workspace/bin/ci'
        before = (fixture.read_bytes(), stat.S_IMODE(fixture.stat().st_mode))
        with self.assertRaisesRegex(ValueError, 'non-executable'):
            workspace_setup_plan(self.task)
        self.assertEqual(workspace_setup_plan(self.task, E2_SETUP_POLICY), E2_SETUP)
        self.assertEqual((fixture.read_bytes(), stat.S_IMODE(fixture.stat().st_mode)), before)
        self.assertEqual(stat.S_IMODE((self.workspace / 'bin/ci').stat().st_mode), 0o644)
        self.assertFalse(self.receipt.exists())

    def test_only_copied_mode_changes_and_original_source_stays_exact(self):
        fixture = self.task.task_dir / 'workspace/bin/ci'
        before = (fixture.read_bytes(), stat.S_IMODE(fixture.stat().st_mode))
        names = {str(p.relative_to(self.workspace)): p.read_bytes()
                 for p in self.workspace.rglob('*') if p.is_file()}
        result = apply_workspace_setup(self.task, self.workspace, E2_SETUP, self.receipt)
        self.assertEqual(result, json.loads(self.receipt.read_text()))
        self.assertEqual(result['status'], 'completed')
        self.assertEqual((result['before']['mode'], result['after']['mode']), ('0644', '0755'))
        self.assertEqual(result['before']['sha256'], result['after']['sha256'])
        self.assertEqual(result['source']['gitMode'], '100644')
        self.assertEqual((fixture.read_bytes(), stat.S_IMODE(fixture.stat().st_mode)), before)
        self.assertEqual(names, {str(p.relative_to(self.workspace)): p.read_bytes()
                                for p in self.workspace.rglob('*') if p.is_file()})
        self.assertEqual(stat.S_IMODE((self.workspace / 'bin/ci').stat().st_mode), 0o755)
        self.assertEqual(result['changedPaths'], ['bin/ci'])
        self.assertFalse(result['sourceMetadataChanged'])

    def test_unexpected_copied_mode_content_or_symlink_fails_with_receipt(self):
        for mode in ('mode', 'content', 'symlink'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(dir=self.root) as folder:
                workspace = Path(folder) / 'workspace'
                shutil.copytree(self.task.task_dir / 'workspace', workspace)
                fixture = workspace / 'bin/ci'
                if mode == 'mode':
                    fixture.chmod(0o755)
                elif mode == 'content':
                    fixture.write_text('altered')
                else:
                    fixture.unlink()
                    fixture.symlink_to(self.task.task_dir / 'workspace/bin/ci')
                receipt = Path(folder) / 'setup.json'
                with self.assertRaises(ValueError):
                    apply_workspace_setup(self.task, workspace, E2_SETUP, receipt)
                self.assertEqual(json.loads(receipt.read_text())['status'], 'failed')

    def test_policy_is_exact_and_receipts_cannot_be_overwritten(self):
        for changes in ({'path': '../bin/ci'}, {'targetMode': '0777'}, {'sourceMode': '0755'},
                        {'sha256': '0' * 64}, {'additional': True}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_workspace_setup({**E2_SETUP, **changes})
        old = {'retained': True}
        self.receipt.write_text(json.dumps(old))
        with self.assertRaises(FileExistsError):
            apply_workspace_setup(self.task, self.workspace, E2_SETUP, self.receipt)
        self.assertEqual(json.loads(self.receipt.read_text()), old)

    def test_other_tasks_never_receive_a_generic_setup_escape_hatch(self):
        other = SimpleNamespace(task_id='G1-registry-cleanup-002')
        self.assertIsNone(workspace_setup_plan(other))
        with self.assertRaises(ValueError):
            workspace_setup_plan(other, E2_SETUP_POLICY)
        with self.assertRaises(ValueError):
            apply_workspace_setup(other, self.workspace, E2_SETUP, self.receipt)


if __name__ == '__main__':
    unittest.main()

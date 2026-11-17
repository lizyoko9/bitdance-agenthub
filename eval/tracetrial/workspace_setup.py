import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
from datetime import datetime, timezone

from .budget_contract import STDERR_TASK_ID


E2_SETUP_POLICY = 'e2-bin-ci-executable-v1'
E2_FIXTURE_SHA256 = 'a2b6ca8f8776a06749ba7acb476e909e3c47c4c7293f83b7a3c071c78e47f2e6'
E2_SETUP = {'policy': E2_SETUP_POLICY, 'path': 'bin/ci', 'sha256': E2_FIXTURE_SHA256,
            'sourceMode': '0644', 'targetMode': '0755'}


def _fixture(path, expected_mode):
    path = Path(path)
    if any(current.is_symlink() for current in (path, *path.parents)):
        raise ValueError('E2 setup fixture and ancestors must not be symlinks')
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != expected_mode:
        raise ValueError('E2 setup fixture must have the expected regular-file mode')
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != E2_FIXTURE_SHA256 or len(data) != 2299:
        raise ValueError('E2 setup fixture differs from the pinned content')
    return {'path': str(path.resolve()), 'sha256': digest, 'bytes': len(data),
            'mode': f'{stat.S_IMODE(metadata.st_mode):04o}'}


def validate_workspace_setup(value):
    if type(value) is not dict or value != E2_SETUP:
        raise ValueError('Workspace setup must be the exact approved E2 executable-mode policy')
    return dict(E2_SETUP)


def workspace_setup_plan(task, policy=None):
    if task.task_id != STDERR_TASK_ID:
        if policy is not None:
            raise ValueError('Workspace setup policy is supported only for the approved E2 task')
        return None
    _fixture(Path(task.task_dir) / 'workspace/bin/ci', 0o644)
    if policy != E2_SETUP_POLICY:
        raise ValueError('E2 bin/ci is non-executable; the approved explicit workspace setup policy is required')
    return dict(E2_SETUP)


def _snapshot(workspace):
    result = {}
    for path in sorted(Path(workspace).rglob('*')):
        metadata = path.lstat()
        if path.is_symlink() or not (stat.S_ISDIR(metadata.st_mode) or stat.S_ISREG(metadata.st_mode)):
            raise ValueError('E2 setup workspace must contain only regular files and directories')
        result[str(path.relative_to(workspace))] = {
            'mode': f'{stat.S_IMODE(metadata.st_mode):04o}',
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None}
    return result


def apply_workspace_setup(task, workspace, setup, receipt_path):
    validate_workspace_setup(setup)
    if task.task_id != STDERR_TASK_ID:
        raise ValueError('Workspace setup task differs from E2')
    workspace = Path(workspace).resolve(strict=True)
    receipt_path = Path(receipt_path)
    if receipt_path.exists() or receipt_path.is_symlink():
        raise FileExistsError('Workspace setup receipt must use a fresh path')
    receipt = {'schemaVersion': 'agenthub_workspace_setup_v1', 'taskId': task.task_id,
               'policy': E2_SETUP_POLICY, 'status': 'failed', 'scope': 'copied_workspace_file_mode_only',
               'at': datetime.now(timezone.utc).isoformat(), 'source': None, 'before': None, 'after': None}
    try:
        source = Path(task.task_dir) / 'workspace/bin/ci'
        receipt['source'] = _fixture(source, 0o644)
        tracked = subprocess.check_output(['git', 'ls-files', '--stage', '--', 'workspace/bin/ci'],
            cwd=task.task_dir, text=True, env={name: os.environ[name] for name in
                ('PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'SYSTEMROOT', 'WINDIR')
                if name in os.environ}).strip().split()
        if len(tracked) != 4 or tracked[0] != '100644' or tracked[2] != '0':
            raise ValueError('E2 source fixture Git mode is not the pinned regular-file mode')
        receipt['source'].update(gitMode=tracked[0], gitBlob=tracked[1])
        copied = Path(workspace) / 'bin/ci'
        receipt['before'] = _fixture(copied, 0o644)
        before = _snapshot(workspace)
        with os.fdopen(os.open(copied, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)), 'rb') as stream:
            metadata = os.fstat(stream.fileno())
            if (not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o644
                    or hashlib.sha256(stream.read()).hexdigest() != E2_FIXTURE_SHA256):
                raise ValueError('E2 copied fixture changed before setup')
            os.fchmod(stream.fileno(), 0o755)
        receipt['after'] = _fixture(copied, 0o755)
        expected = {**before, 'bin/ci': {**before['bin/ci'], 'mode': '0755'}}
        if _snapshot(workspace) != expected:
            raise ValueError('Workspace changed beyond the approved E2 copied mode')
        if _fixture(source, 0o644) != {key: value for key, value in receipt['source'].items()
                                     if key not in ('gitMode', 'gitBlob')}:
            raise ValueError('E2 original source changed during copied setup')
        receipt.update(status='completed', changedPaths=['bin/ci'], taskContentChanged=False,
                       sourceMetadataChanged=False, executionCondition='setup-repaired custom AgentHub execution')
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        receipt['errorType'] = type(error).__name__
        raise
    finally:
        with receipt_path.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    return receipt

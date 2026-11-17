#!/usr/bin/env python3
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import time
import uuid

from .container_worker import APPROVED_TASK_IDS, CONFIRMATION_TASK_ID, PROCESS_OBSERVED_TASK_IDS, STDERR_TASK_ID, TIMEOUT_TASK_ID
from .budget_contract import budget_plan_digest, validate_budget_plan
from .budget_outcome import classify_budget_outcome
from .task_admission import actor_request, actor_settings, admit_task, unsupported
from .workspace_setup import E2_SETUP_POLICY, apply_workspace_setup, validate_workspace_setup


SOURCE_REVISION = '98a381307184fa4212db3466b21b4c92a031940b'
TASK_ID = 'E8-exit-code-masked-by-output-001'
MODEL = 'gpt-6-luna'
RECORDER_FILES = ('tracetrial_bench/__init__.py', 'tracetrial_bench/provider_request_recorder.py',
                  'harness_tracer/__init__.py', 'harness_tracer/provider_requests.py')
ROOT = Path(__file__).resolve().parents[2]
REFRESH_CONTROLLER_FILES = ('eval/tracetrial/run_trial.py', 'eval/tracetrial/Dockerfile.refresh',
    'eval/tracetrial/refresh-runtime.py', 'eval/tracetrial/container_worker.py',
    'eval/tracetrial/task_admission.py', 'eval/tracetrial/trace_adapter.py',
    'eval/tracetrial/score_trial.py', 'eval/tracetrial/judge.py', 'eval/tracetrial/judge_plan.py',
    'eval/tracetrial/budget_contract.py', 'eval/tracetrial/budget_outcome.py',
    'eval/tracetrial/workspace_setup.py', 'eval/tracetrial/conversation_trace.py',
    'eval/terminalbench/prepare-runtime.py')
REQUIRED_NATIVE_ARCHIVES = ('actor_process.json', 'provider_summary.json', 'upstream_requests.jsonl',
    'trial/events.jsonl', 'trial/result.json', 'trial/manifest.json', 'trial/requests.jsonl',
    'recorder/provider_requests/events.jsonl')


class ContainerLifecycleEvidenceError(RuntimeError):
    pass


def write_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def directory_hashes(root):
    return {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(Path(root).rglob('*')) if path.is_file() and '__pycache__' not in path.parts}


def checked_source(source):
    source = Path(source).resolve(strict=True)
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    dirty = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=source, text=True)
    if revision != SOURCE_REVISION or dirty:
        raise ValueError('TraceTrial checkout must match the unmodified approved revision')
    return source


def check_installed_benchmark(source):
    for package in ('tracetrial_bench', 'harness_tracer'):
        module = __import__(package)
        installed = Path(module.__file__).resolve().parent
        expected = Path(source) / package
        installed_hashes = {name: value for name, value in directory_hashes(installed).items() if name.endswith('.py')}
        expected_hashes = {name: value for name, value in directory_hashes(expected).items() if name.endswith('.py')}
        if installed_hashes != expected_hashes:
            raise ValueError(f'Imported {package} does not match the approved source checkout')


def docker_environment():
    allowed = ('PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'DOCKER_HOST', 'DOCKER_CONFIG')
    return {name: os.environ[name] for name in allowed if name in os.environ}


def docker(*arguments, environment=None, timeout=120, check=True, input_text=None):
    result = subprocess.run(['docker', *map(str, arguments)], env=environment or docker_environment(),
                            capture_output=True, text=True, timeout=timeout, input=input_text)
    if check and result.returncode:
        # Docker never receives credentials in argv, but avoid dumping its arbitrary stderr.
        raise RuntimeError(f'Docker {arguments[0]} failed (exit {result.returncode}); retained lifecycle logs describe the stage')
    return result


def refresh_module():
    spec = importlib.util.spec_from_file_location('refresh_runtime', Path(__file__).with_name('refresh-runtime.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def require_committed_sources(names):
    paths = sorted(set(names))
    tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', '--', *paths], cwd=ROOT,
                             capture_output=True, text=True)
    changed = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all', '--', *paths],
                                      cwd=ROOT, text=True)
    if tracked.returncode or changed:
        raise ValueError('Commit all runtime and refresh controller sources before preparing a reused image')
    return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()


def inspect_reuse_image(reference):
    if not isinstance(reference, str) or not re.fullmatch(r'[a-z0-9][a-z0-9./_:-]*@sha256:[0-9a-f]{64}', reference):
        raise ValueError('Reuse image must be a locally available pinned RepoDigest')
    inspection = json.loads(docker('image', 'inspect', reference).stdout)[0]
    if reference not in inspection.get('RepoDigests', []) or inspection.get('Os') != 'linux':
        raise ValueError('Reuse image must be a local Linux image with the exact pinned RepoDigest')
    return inspection


def retain_baseline_manifest(inspection, destination):
    container = docker('create', '--network=none', inspection['Id']).stdout.strip()
    try:
        docker('cp', container + ':/installed-agent/agenthub/runtime-source.json', destination)
    finally:
        docker('rm', container)


def prepare_build(source, output, reuse_image=None):
    source = checked_source(source)
    check_installed_benchmark(source)
    destination = Path(output).resolve()
    destination.mkdir(parents=True, exist_ok=False)
    spec = importlib.util.spec_from_file_location('prepare_runtime', ROOT / 'eval/terminalbench/prepare-runtime.py')
    packer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packer)
    controller_commit = None
    if reuse_image is not None:
        names = [str(path.relative_to(ROOT)) for path in packer.source_files(ROOT)]
        controller_commit = require_committed_sources([*names, *REFRESH_CONTROLLER_FILES])
        inspection = inspect_reuse_image(reuse_image)
    archive = packer.prepare(ROOT, destination / 'runtime.tar.gz')
    shutil.copy2(Path(__file__).with_name('Dockerfile.refresh' if reuse_image else 'Dockerfile'), destination / 'Dockerfile')
    shutil.copy2(Path(__file__).with_name('container_worker.py'), destination / 'container_worker.py')
    shutil.copy2(Path(__file__).with_name('budget_contract.py'), destination / 'budget_contract.py')
    shutil.copy2(ROOT / 'eval/terminalbench/install-runtime.sh', destination / 'install-runtime.sh')
    for name in RECORDER_FILES:
        target = destination / 'recorder' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / name, target)
    reuse = {}
    if reuse_image is not None:
        helper = refresh_module()
        shutil.copy2(Path(__file__).with_name('refresh-runtime.py'), destination / 'refresh-runtime.py')
        baseline = destination / 'baseline-runtime-source.json'
        retain_baseline_manifest(inspection, baseline)
        old = helper.read_manifest(baseline.read_bytes())
        new, _ = helper.read_archive(destination / 'runtime.tar.gz')
        dependency_hashes = helper.validate_dependencies(old, new)
        reuse = {'baseImage': {'reference': reuse_image, 'id': inspection['Id'],
            'architecture': inspection['Architecture'], 'os': inspection['Os'],
            'layers': inspection.get('RootFS', {}).get('Layers', []),
            'runtimeSourceSha256': hashlib.sha256(baseline.read_bytes()).hexdigest(),
            'runtimeCommit': old.get('agenthubCommit')},
            'reuseReason': 'Exact Node/pnpm and dependency inputs; overlay verified committed allowlisted sources only',
            'dependencyInputs': dependency_hashes, 'controllerCommit': controller_commit,
            'controllerFiles': {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
                                for name in REFRESH_CONTROLLER_FILES}}
        if require_committed_sources([*names, *REFRESH_CONTROLLER_FILES]) != controller_commit or archive['agenthubCommit'] != controller_commit:
            raise ValueError('Committed sources changed while preparing the refreshed runtime')
    write_json(destination / 'build-manifest.json', {'sourceRevision': SOURCE_REVISION,
        'runtime': archive, 'buildFiles': directory_hashes(destination),
        'actorUid': os.getuid(), 'actorGid': os.getgid(), 'containsPrivateTasks': False, **reuse})
    return destination


def build_image(context, image, proxy):
    manifest = json.loads((Path(context) / 'build-manifest.json').read_text())
    verify_build_files(context, manifest)
    if manifest.get('baseImage'):
        write_json(Path(context) / 'image.json', assemble_reused_image(Path(context), image, manifest))
        return
    command = ['docker', 'build', '--network=default', '--build-arg', f'HTTP_PROXY={proxy}',
        '--build-arg', f'HTTPS_PROXY={proxy}', '--build-arg', f'ACTOR_UID={os.getuid()}',
        '--build-arg', f'ACTOR_GID={os.getgid()}', '--tag', image, str(context)]
    with (Path(context) / 'build.log').open('w') as stream:
        result = subprocess.run(command, env=docker_environment(), stdout=stream,
            stderr=subprocess.STDOUT, timeout=2400)
    if result.returncode:
        raise RuntimeError('Runtime build failed; inspect build.log (no actor has started)')
    inspection = json.loads(docker('image', 'inspect', image).stdout)[0]
    write_json(Path(context) / 'image.json', {'id': inspection['Id'], 'architecture': inspection['Architecture'],
        'os': inspection['Os'], 'runtime': manifest['runtime'], 'upstream': SOURCE_REVISION,
        **({'baseImage': manifest['baseImage']} if manifest.get('baseImage') else {})})


def assemble_reused_image(context, image, manifest):
    base = manifest['baseImage']
    required = {'Dockerfile', 'runtime.tar.gz', 'baseline-runtime-source.json', 'refresh-runtime.py',
                'container_worker.py', 'budget_contract.py', *('recorder/' + name for name in RECORDER_FILES)}
    if not required <= manifest['buildFiles'].keys():
        raise ValueError('Local runtime assembly is missing verified build inputs')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', base.get('id', '')):
        raise ValueError('Reuse requires the prepared immutable local image ID')
    uid, gid = manifest['actorUid'], manifest['actorGid']
    if type(uid) is not int or uid <= 0 or type(gid) is not int or gid < 0:
        raise ValueError('Local runtime assembly requires a non-root actor UID and valid GID')
    for name, digest in manifest.get('controllerFiles', {}).items():
        if name not in REFRESH_CONTROLLER_FILES or hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != digest:
            raise ValueError('Refresh controller source differs from committed build context')
    steps = []
    container = 'agenthub-refresh-' + uuid.uuid4().hex
    create_attempted = False
    assembled = False

    def step(*arguments, check=True):
        entry = {'argv': ['docker', *map(str, arguments)], 'exitCode': None}
        steps.append(entry)
        try:
            result = docker(*arguments, check=False)
            entry['exitCode'] = result.returncode
        except Exception as error:
            entry['errorType'] = type(error).__name__
            raise
        if check and result.returncode:
            raise RuntimeError(f'Local runtime assembly failed at {arguments[0]} (exit {result.returncode})')
        return result

    try:
        inspection = json.loads(step('image', 'inspect', base['id']).stdout)[0]
        if inspection['Id'] != base['id'] or inspection.get('Os') != 'linux':
            raise ValueError('Local reuse image differs from the prepared immutable Linux image ID')
        if inspection.get('Architecture') != base['architecture']:
            raise ValueError('Local reuse image architecture differs from the prepared image')
        create_attempted = True
        step('create', '--pull=never', '--network=none', '--name', container, base['id'], 'sleep', 'infinity')
        for source, target in (
            ('runtime.tar.gz', '/tmp/agenthub-runtime.tar.gz'),
            ('baseline-runtime-source.json', '/opt/agenthub-eval/baseline-runtime-source.json'),
            ('refresh-runtime.py', '/opt/agenthub-eval/refresh-runtime.py'),
            ('container_worker.py', '/opt/agenthub-eval/container_worker.py'),
            ('budget_contract.py', '/opt/agenthub-eval/budget_contract.py'),
        ):
            step('cp', context/source, container + ':' + target)
        step('cp', str(context/'recorder') + '/.', container + ':/opt/recorder')
        step('start', container)
        step('exec', '--user=0', container, 'python3', '/opt/agenthub-eval/refresh-runtime.py',
             '/tmp/agenthub-runtime.tar.gz', '/installed-agent/agenthub', '/opt/agenthub-eval/baseline-runtime-source.json')
        step('exec', '--user=0', container, 'rm', '/tmp/agenthub-runtime.tar.gz')
        step('exec', '--user=0', container, 'sh', '-c',
             f'chmod a+rx /installed-agent && mkdir -p /state/home && chown {uid}:{gid} /state /state/home')
        probe = '''const fs=await import("node:fs"); if(process.getuid()===0||Object.entries(process.env).some(([k,v])=>v&&/(?:API_KEY|AUTH_TOKEN|SECRET|PASSWORD)$/.test(k))) throw Error("Expected unprivileged no-key probe"); const {default:Database}=await import("better-sqlite3"); const db=new Database(":memory:"); db.prepare("select 1").get(); db.close(); const m=await import("./eval/tracetrial/run-agenthub.ts"); if(typeof m.runTraceTrial!=="function") throw Error("TraceTrial entry missing"); const d=fs.mkdtempSync("/state/probe-"); try { const {createIsolatedProfile}=await import("./eval/terminalbench/profile.ts"); const p=await createIsolatedProfile({outputDir:d,group:"single",modelId:"gpt-6-luna"},()=>{},{benchmark:"tracetrial"}); p.close(); } finally {fs.rmSync(d,{recursive:true,force:true});} console.log(JSON.stringify({uid:process.getuid(),node:process.version,arch:process.arch,sqlite:"ok",profile:"ok",modelCalls:0}));'''
        report = json.loads(step('exec', '--user', f'{uid}:{gid}', '--workdir', '/installed-agent/agenthub', container,
             'node', '--import', 'tsx', '--input-type=module', '-e', probe).stdout)
        if report.get('uid') != uid or report.get('sqlite') != 'ok' or report.get('profile') != 'ok' or report.get('modelCalls') != 0:
            raise ValueError('Non-root no-key runtime probes did not report complete success')
        probes = {name: report[name] for name in ('uid', 'node', 'arch', 'sqlite', 'profile', 'modelCalls')}
        step('commit', '--change', f'USER {uid}:{gid}', '--change', 'WORKDIR /installed-agent/agenthub',
             '--change', 'CMD ["sleep", "infinity"]', container, image)
        inspection = json.loads(step('image', 'inspect', image).stdout)[0]
        if inspection.get('Config', {}).get('User') != f'{uid}:{gid}' or inspection.get('Os') != 'linux':
            raise ValueError('Assembled runtime must retain the non-root Linux actor configuration')
        assembled = True
    finally:
        try:
            if create_attempted:
                removed = step('rm', '--force', container, check=False)
                if assembled and removed.returncode:
                    raise RuntimeError('Local runtime assembly container cleanup failed')
        finally:
            write_json(context/'assembly-log.json', steps)
    return {'id': inspection['Id'], 'architecture': inspection['Architecture'], 'os': inspection['Os'],
        'runtime': manifest['runtime'], 'upstream': SOURCE_REVISION, 'baseImage': base,
        'buildMethod': 'offline local container refresh and commit', 'network': 'none',
        'dependenciesReinstalled': False, 'modelCalls': 0, 'probes': probes, 'assemblyLog': 'assembly-log.json',
        'dockerfileSha256': manifest['buildFiles']['Dockerfile'],
        'assemblyControllerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}


def verify_build_files(context, manifest):
    for name, digest in manifest['buildFiles'].items():
        if hashlib.sha256((Path(context)/name).read_bytes()).hexdigest() != digest:
            raise ValueError(f'Build context changed after preparation: {name}')


def verify_runtime_sources(context):
    with tarfile.open(Path(context)/'runtime.tar.gz', 'r:gz') as archive:
        manifest = json.loads(archive.extractfile('runtime-source.json').read())
    for name, digest in manifest['files'].items():
        contents = (ROOT/name).read_bytes()
        if name == 'package.json':
            package = json.loads(contents)
            package['type'] = 'module'
            contents = (json.dumps(package, indent=2)+'\n').encode()
        if hashlib.sha256(contents).hexdigest() != digest:
            raise ValueError(f'Runtime source differs from committed archive: {name}')
    for name in ('container_worker.py', 'budget_contract.py'):
        if hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest() != hashlib.sha256((Path(context)/name).read_bytes()).hexdigest():
            raise ValueError('Container control source differs from committed build context: ' + name)
    build = json.loads((Path(context)/'build-manifest.json').read_text())
    for name, digest in build.get('controllerFiles', {}).items():
        if name not in REFRESH_CONTROLLER_FILES or hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != digest:
            raise ValueError('Refresh controller source differs from committed build context')


def resolve_trial_task(source, task_id=TASK_ID, *, budget_plan=None, mode='task', overrides=None,
                       workspace_setup_policy=None):
    from tracetrial_bench.task_resolver import resolve_task

    source = checked_source(source)
    check_installed_benchmark(source)
    if not isinstance(task_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', task_id):
        return None, unsupported(task_id, ['invalid task id; task paths are not accepted']), None
    if task_id not in APPROVED_TASK_IDS:
        return None, unsupported(task_id, ['task is outside the approved explicit allowlist']), None
    task = resolve_task(source / 'Task' / task_id)
    report, request = admit_task(task, budget_plan=budget_plan, mode=mode, overrides=overrides,
                                 **({'workspace_setup_policy': workspace_setup_policy} if workspace_setup_policy is not None else {}))
    report.update(sourceRevision=SOURCE_REVISION, sourceTaskHashes=directory_hashes(task.task_dir))
    return task, report, request


def preflight_task(source, task_id=TASK_ID, *, mode='task', overrides=None, workspace_setup_policy=None):
    return resolve_trial_task(source, task_id, mode=mode, overrides=overrides,
                              **({'workspace_setup_policy': workspace_setup_policy} if workspace_setup_policy is not None else {}))[1]


def write_budget_file(report, destination):
    if report.get('status') != 'supported':
        raise ValueError('Cannot write a run plan for an unsupported task')
    plan = validate_budget_plan(report['budgetPlan'])
    envelope = {'schemaVersion': 'agenthub_tracetrial_run_plan_v1',
        'taskId': report['taskId'], 'sourceRevision': report['sourceRevision'],
        'sourceTaskHashes': report['sourceTaskHashes'], 'budgetPlan': plan,
        'budgetPlanSha256': budget_plan_digest(plan)}
    if report['taskId'] == STDERR_TASK_ID:
        envelope.update(schemaVersion='agenthub_tracetrial_run_plan_v2',
                        workspaceSetup=validate_workspace_setup(report.get('workspaceSetup')))
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(envelope, ensure_ascii=False, indent=2) + '\n')
    return envelope


def read_budget_file(path):
    if path is None:
        raise ValueError('run requires --budget-file generated by preflight --budget-out; no implicit paid budget')
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    fields = {'schemaVersion', 'taskId', 'sourceRevision', 'sourceTaskHashes', 'budgetPlan', 'budgetPlanSha256'}
    if not isinstance(data, dict):
        raise ValueError('Invalid run plan envelope; generate it with preflight --budget-out')
    version = data.get('schemaVersion')
    if version == 'agenthub_tracetrial_run_plan_v2':
        fields.add('workspaceSetup')
    if (set(data) != fields or version not in ('agenthub_tracetrial_run_plan_v1', 'agenthub_tracetrial_run_plan_v2')
            or (data['taskId'] == STDERR_TASK_ID) != (version == 'agenthub_tracetrial_run_plan_v2')):
        raise ValueError('Invalid run plan envelope; generate it with preflight --budget-out')
    plan = validate_budget_plan(data['budgetPlan'], task_id=data['taskId'])
    if data['sourceRevision'] != SOURCE_REVISION or data['budgetPlanSha256'] != budget_plan_digest(plan):
        raise ValueError('Run plan revision or budget digest does not match')
    if not isinstance(data['sourceTaskHashes'], dict) or not data['sourceTaskHashes']:
        raise ValueError('Run plan must bind the pinned task source hashes')
    if version == 'agenthub_tracetrial_run_plan_v2':
        setup = validate_workspace_setup(data['workspaceSetup'])
        if plan['schemaVersion'] != 3 or data['sourceTaskHashes'].get('workspace/bin/ci') != setup['sha256']:
            raise ValueError('E2 setup plan differs from its budget version or source fixture hash')
    return data


def read_optional_json(path):
    try:
        value = Path(path).read_text(encoding='utf-8')
        result = json.loads(value)
        return result if isinstance(result, dict) else None
    except (OSError, UnicodeError, ValueError):
        return None


def _record_container_error(state, stage, exception):
    if state['primary'] is None:
        state['primary'] = exception
    state['errors'].append({'stage': stage, 'error_type': type(exception).__name__})


def _native_archive_manifest(native):
    files, errors = [], []
    native = Path(native).absolute()
    for name in REQUIRED_NATIVE_ARCHIVES:
        path = native / name
        try:
            if any(parent.is_symlink() for parent in (path, *path.parents)):
                raise ValueError('archive symlink or ancestor')
            before = path.lstat()
            if not stat.S_ISREG(before.st_mode):
                raise ValueError('archive is not regular')
            with path.open('rb') as stream:
                opened = os.fstat(stream.fileno())
                data = stream.read()
                after = os.fstat(stream.fileno())
            identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
            if identity(before) != identity(opened) or identity(opened) != identity(after) or len(data) != after.st_size:
                raise ValueError('archive changed while reading')
            files.append({'path': str(path), 'relative_path': name, 'bytes': len(data),
                'sha256': hashlib.sha256(data).hexdigest()})
        except (OSError, ValueError) as exception:
            errors.append({'path': name, 'error_type': type(exception).__name__})
    return {'required_files': list(REQUIRED_NATIVE_ARCHIVES), 'files': files, 'errors': errors}


def container_lifecycle_projection(source, native, errors=None):
    source = Path(source)
    raw = source.read_bytes()
    rows = json.loads(raw)
    if source.is_symlink() or type(rows) is not list or any(type(row) is not dict for row in rows):
        raise ContainerLifecycleEvidenceError('Invalid original lifecycle stage file')
    names = ('created', 'pid_namespace_verified', 'actor_started', 'actor_exited', 'evidence_copied', 'removed')
    indices = {name: [index for index, row in enumerate(rows) if row.get('stage') == name] for name in names}
    validation = []
    created = rows[indices['created'][0]] if len(indices['created']) == 1 else {}
    container = created.get('containerId')
    identity_ok = type(container) is str and bool(container)
    if type(created.get('exitCode')) is not int or created['exitCode'] != 0 or created.get('errorType'):
        identity_ok = False
        validation.append('create_not_verified')
    for name in names:
        if len(indices[name]) > 1:
            identity_ok = False
            validation.append('ambiguous_' + name)
        for index in indices[name]:
            if rows[index].get('containerId') != container:
                identity_ok = False
                validation.append('container_mismatch_' + name)
    if not identity_ok:
        validation.append('unverified_container_identity')
    order = [index for name in names for index in indices[name]]
    if order != sorted(order):
        identity_ok = False
        validation.append('conflicting_stage_order')
    archive = _native_archive_manifest(native)
    copy = rows[indices['evidence_copied'][0]] if len(indices['evidence_copied']) == 1 else None
    removed = rows[indices['removed'][0]] if len(indices['removed']) == 1 else None
    archive_ok = identity_ok and copy is not None and type(copy.get('exitCode')) is int and copy['exitCode'] == 0 \
        and not copy.get('errorType') and copy.get('source') == container + ':/state/.' \
        and copy.get('destination') == str(Path(native).absolute()) and not archive['errors']
    cleanup_ok = identity_ok and removed is not None and type(removed.get('exitCode')) is int \
        and removed['exitCode'] == 0 and not removed.get('errorType')
    if not archive_ok:
        validation.append('archive_not_verified')
    if not cleanup_ok:
        validation.append('cleanup_not_verified')
    all_errors = [{'stage': row.get('operation') if row.get('stage') == 'driver_error' else row.get('stage'),
                   'error_type': row['errorType'], 'source_stage_index': index}
                  for index, row in enumerate(rows) if type(row.get('errorType')) is str and row['errorType']]
    source_errors = [{key: value for key, value in error.items() if key != 'source_stage_index'} for error in all_errors]
    if errors is not None and list(errors) != source_errors:
        validation.append('driver_error_sequence_mismatch')
    if validation:
        all_errors.append({'stage': 'lifecycle_validation', 'error_type': 'ContainerLifecycleEvidenceError'})
    return {'schema_version': 'agenthub_container_lifecycle_projection_v1', 'producer': 'agenthub',
        'task_id': CONFIRMATION_TASK_ID, 'container_id': container if type(container) is str else None,
        'source': {'path': str(source.resolve()), 'sha256': hashlib.sha256(raw).hexdigest()},
        'stage_indices': indices, 'archive_validation': archive, 'validation_errors': validation,
        'archive_status': 'complete' if archive_ok else ('not_started' if copy is None else 'failed'),
        'cleanup_status': 'complete' if cleanup_ok else ('not_started' if removed is None else 'failed'),
        'error_type': all_errors[0]['error_type'] if all_errors else None,
        'primary_error': all_errors[0] if all_errors else None, 'secondary_errors': all_errors[1:]}


def finish_confirmation_container(container, native, lifecycle, artifacts, state):
    try:
        if container:
            for stage, arguments, extra in (
                ('evidence_copied', ('cp', container + ':/state/.', native),
                 {'source': container + ':/state/.', 'destination': str(Path(native).absolute())}),
                ('removed', ('rm', '--force', container), {}),
            ):
                row = {'stage': stage, 'containerId': container, 'startedAt': time.time(), **extra}
                try:
                    result = docker(*arguments, timeout=60 if stage == 'evidence_copied' else 120, check=False)
                    row['exitCode'] = result.returncode
                    if result.returncode:
                        raise ContainerLifecycleEvidenceError('Docker ' + stage + ' returned nonzero')
                except Exception as exception:
                    row['errorType'] = type(exception).__name__
                    _record_container_error(state, stage, exception)
                finally:
                    row['at'] = time.time()
                    lifecycle.append(row)
    finally:
        source = Path(artifacts) / 'lifecycle.json'
        source_written = False
        try:
            write_json(source, lifecycle)
            source_written = True
        except Exception as exception:
            _record_container_error(state, 'lifecycle_persistence', exception)
        try:
            if not source_written:
                raise ContainerLifecycleEvidenceError('Original lifecycle source was not persisted')
            projection = container_lifecycle_projection(source, native, state['errors'])
            if projection['validation_errors'] and state['primary'] is None:
                _record_container_error(state, 'lifecycle_validation',
                    ContainerLifecycleEvidenceError('Container lifecycle evidence was incomplete'))
        except Exception as exception:
            _record_container_error(state, 'lifecycle_projection', exception)
            projection = {'schema_version': 'agenthub_container_lifecycle_projection_v1', 'producer': 'agenthub',
                'task_id': CONFIRMATION_TASK_ID, 'container_id': container,
                'source': {'path': str(source.absolute()), 'sha256': None}, 'stage_indices': {},
                'archive_status': 'failed', 'cleanup_status': 'failed',
                'error_type': state['errors'][0]['error_type'], 'primary_error': state['errors'][0],
                'secondary_errors': state['errors'][1:], 'validation_errors': ['source_unavailable']}
        try:
            write_json(Path(artifacts) / 'container_lifecycle.json', projection)
        except Exception as exception:
            _record_container_error(state, 'projection_persistence', exception)


def run_trial(*, source, output, context, image, actor_proxy, judge_proxy, task_id=TASK_ID, budget_file=None):
    from tracetrial_bench.runner_policy import resolve_harness_invocation
    from tracetrial_bench.workspace import (prepare_run_dir, snapshot_workspace, persist_scoring_inputs,
        validate_workspace_for_host_verifier, write_workspace_diff)
    from .trace_adapter import normalize_agenthub_trace, emit_execution_evidence
    from .score_trial import score_retained_trial

    run_plan = read_budget_file(budget_file)
    if run_plan['taskId'] != task_id:
        raise ValueError('Run plan task differs from the selected task')
    setup = run_plan.get('workspaceSetup')
    task, admission, request = resolve_trial_task(source, task_id, budget_plan=run_plan['budgetPlan'],
        **({'workspace_setup_policy': setup['policy']} if setup else {}))
    if admission['status'] != 'supported':
        return admission
    if admission['sourceTaskHashes'] != run_plan['sourceTaskHashes']:
        raise ValueError('Run plan task inputs changed; generate a new preflight plan')
    if admission.get('workspaceSetup') != setup:
        raise ValueError('Run plan workspace setup differs from current admission')
    plan = admission['budgetPlan']
    output = Path(output)
    if output.exists() or output.is_symlink():
        raise FileExistsError('Trial output directory already exists; refusing to reuse it')
    output = output.resolve()
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not key:
        raise RuntimeError('The previously authorized OpenAI credential is unavailable')
    context = Path(context).resolve(strict=True)
    build = json.loads((context / 'build-manifest.json').read_text())
    verify_build_files(context, build)
    verify_runtime_sources(context)
    pinned_image = json.loads((context / 'image.json').read_text())
    current_revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    inspection = json.loads(docker('image', 'inspect', image).stdout)[0]
    if inspection['Id'] != pinned_image['id']:
        raise ValueError('Runtime image differs from the retained build image ID')
    hashes_before = directory_hashes(task.task_dir)
    if hashes_before != admission['sourceTaskHashes']:
        raise ValueError('Task inputs changed after no-model admission')
    layout = prepare_run_dir(task, output)
    setup_receipt = None
    if setup:
        setup_path = layout.artifacts_dir / 'workspace-setup.json'
        apply_workspace_setup(task, layout.workspace_dir, setup, setup_path)
        setup_receipt = {'path': str(setup_path.resolve()),
                         'sha256': hashlib.sha256(setup_path.read_bytes()).hexdigest()}
    snapshot_workspace(layout.workspace_dir, layout.baseline_dir)
    persist_scoring_inputs(task, layout)
    request_file = layout.agent_dir / 'request.json'
    write_json(request_file, request)
    plan_file = layout.agent_dir / 'budget-plan.json'
    write_json(plan_file, plan)
    invocation = resolve_harness_invocation(harness='agenthub', requested_timeout=request['timeoutMs'] // 1000,
        task_max_wall_time_sec=task.max_wall_time_sec, task_max_turns=task.max_turns,
        requested_extra_args={}, strict=True)
    lifecycle = []
    container_id = None
    native = layout.agent_dir / 'native'
    native.mkdir()
    settings = actor_settings(request, task, admission['declaredRuntime'], budget_plan=plan)
    settings['sdkRequestTimeoutMs'] = request['timeoutMs']
    settings['cleanupGraceSeconds'] = 35
    if setup:
        settings['workspaceSetup'] = {**setup, 'receipt': setup_receipt,
            'executionCondition': 'setup-repaired custom AgentHub execution'}
    write_json(layout.artifacts_dir / 'admission.json', admission)
    write_json(layout.artifacts_dir / 'protocol.json', {'taskId': task.task_id, 'upstream': SOURCE_REVISION,
        'agenthubCommit': build['runtime']['agenthubCommit'], 'driverCommit': current_revision,
        'runtime': build, 'image': pinned_image,
        'actor': settings, 'executionAdapter': 'project-local AgentHub; official scorer unchanged',
        'budgetPlan': plan, 'budgetPlanSha256': budget_plan_digest(plan),
        'sourceTaskHashesBefore': hashes_before, 'priceEstimateUsd': None, 'hardDollarCap': False})
    failure = None
    confirmation = task_id == CONFIRMATION_TASK_ID
    container_errors = {'primary': None, 'errors': []}
    active_stage = 'create'
    try:
        create_arguments = ['create', '--network=bridge', '--cpus=2', '--memory=4g', '--pids-limit=512']
        created = docker(*create_arguments, '--mount',
            f'type=bind,source={layout.workspace_dir},target=/workspace', inspection['Id'])
        container_id = created.stdout.strip()
        lifecycle.append({'stage': 'created', 'containerId': container_id, 'at': time.time(),
            **({'exitCode': created.returncode} if confirmation else {})})
        active_stage = 'pid_namespace_verification'
        if task_id in PROCESS_OBSERVED_TASK_IDS:
            container = json.loads(docker('container', 'inspect', container_id).stdout)[0]
            if container.get('Id') != container_id or container.get('HostConfig', {}).get('PidMode') != '':
                raise ValueError('Process observation requires a verified fresh private Docker PID namespace')
            lifecycle.append({'stage': 'pid_namespace_verified', 'containerId': container_id,
                'pidMode': '', 'normalizedPidMode': 'private', 'source': 'docker_container_inspect', 'at': time.time()})
        active_stage = 'start'
        docker('start', container_id)
        active_stage = 'request_copy'
        docker('cp', request_file, container_id + ':/state/request.json')
        active_stage = 'budget_copy'
        docker('cp', plan_file, container_id + ':/state/budget-plan.json')
        # The privileged recorder receives the key over stdin; tools run as the unprivileged image user.
        environment = docker_environment()
        marker = layout.artifacts_dir / 'actor-started.json'
        with marker.open('x') as stream:
            json.dump({'at': time.time(), 'containerId': container_id, 'automaticRerun': False}, stream)
        lifecycle.append({'stage': 'actor_started', 'at': time.time(),
            **({'containerId': container_id} if confirmation else {})})
        active_stage = 'actor'
        namespace_environment = ('--env', 'AGENTHUB_PRIVATE_PID_NAMESPACE=private') if task_id in PROCESS_OBSERVED_TASK_IDS else ()
        result = docker('exec', '--interactive', '--user=0', '--env', f'ACTOR_UID={os.getuid()}',
            '--env', f'ACTOR_GID={os.getgid()}', *namespace_environment, container_id, 'python3',
            '/opt/agenthub-eval/container_worker.py', '/state/request.json', '/state', actor_proxy, '/state/budget-plan.json',
            environment=environment, input_text=key,
            timeout=request['timeoutMs'] / 1000 + settings['cleanupGraceSeconds'], check=False)
        (native / 'worker.log').write_text((result.stdout + result.stderr).replace(key, '[REDACTED]'))
        lifecycle.append({'stage': 'actor_exited', 'exitCode': result.returncode, 'at': time.time(),
            **({'containerId': container_id} if confirmation else {})})
    except Exception as exception:
        failure = type(exception).__name__
        if confirmation:
            _record_container_error(container_errors, active_stage, exception)
            lifecycle.append({'stage': 'driver_error', 'operation': active_stage, 'containerId': container_id,
                'errorType': type(exception).__name__, 'at': time.time()})
    finally:
        if confirmation:
            finish_confirmation_container(container_id, native, lifecycle, layout.artifacts_dir, container_errors)
        elif container_id:
            try:
                copied = docker('cp', container_id + ':/state/.', native, timeout=60, check=False)
                lifecycle.append({'stage': 'evidence_copied', 'exitCode': copied.returncode, 'at': time.time()})
            finally:
                removed = docker('rm', '--force', container_id, check=False)
                lifecycle.append({'stage': 'removed', 'exitCode': removed.returncode, 'at': time.time()})
        if not confirmation:
            write_json(layout.artifacts_dir / 'lifecycle.json', lifecycle)
    if confirmation and container_errors['primary'] is not None:
        try:
            write_json(layout.artifacts_dir / 'apparatus-failure.json', {'stage': 'container',
                'type': container_errors['errors'][0]['error_type'], 'primary_error': container_errors['errors'][0],
                'secondary_errors': container_errors['errors'][1:]})
        except Exception as exception:
            _record_container_error(container_errors, 'apparatus_failure_persistence', exception)
        raise RuntimeError('Actor apparatus failed; evidence retained, no automatic actor rerun') from container_errors['primary']
    budget_outcome = classify_budget_outcome(plan,
        read_optional_json(native / 'trial/result.json'), read_optional_json(native / 'actor_process.json'))
    write_json(layout.artifacts_dir / 'budget-outcome.json', budget_outcome)
    if failure:
        write_json(layout.artifacts_dir / 'apparatus-failure.json', {'stage': 'actor', 'type': failure})
        raise RuntimeError('Actor apparatus failed; evidence retained, no automatic actor rerun')
    validate_workspace_for_host_verifier(layout.workspace_dir, secret_values=(key,))
    write_workspace_diff(layout.baseline_dir, layout.workspace_dir, layout.artifacts_dir / 'workspace.diff')
    metadata = json.loads((native / 'actor_process.json').read_text())
    metadata['container_id'] = container_id
    trace = normalize_agenthub_trace(task=task, layout=layout,
        native_events_path=native / 'trial/events.jsonl', native_result_path=native / 'trial/result.json',
        actor_metadata=metadata)
    emit_execution_evidence(task, layout, trace)
    provider_dir = native / 'recorder/provider_requests'
    if provider_dir.is_dir():
        shutil.copytree(provider_dir, layout.artifacts_dir / 'provider_requests')
    hashes_after = directory_hashes(task.task_dir)
    write_json(layout.artifacts_dir / 'source-integrity.json', {'before': hashes_before,
        'after': hashes_after, 'unchanged': hashes_before == hashes_after})
    if hashes_before != hashes_after:
        raise RuntimeError('Official task inputs changed; refusing to score this trial')
    if trace.get('structured_trace_status') != 'available':
        raise RuntimeError('Native trace admission failed; actor retained and not rerun')
    scores = score_retained_trial(task=task, layout=layout, trace_summary=trace,
        actor_settings=settings, judge_key=key, judge_proxy=judge_proxy, invocation_report=invocation.report)
    write_json(layout.artifacts_dir / 'result.json', {'taskId': task.task_id, 'actor': metadata,
        'trace': trace, 'scoring': scores, 'budgetOutcome': budget_outcome})
    return {'taskId': task.task_id, 'runDir': str(layout.run_dir), 'actor': metadata,
        'scoringStatus': scores['scoringStatus'], 'budgetOutcome': budget_outcome}


def main():
    parser = argparse.ArgumentParser(description='One bounded trial from the approved AgentHub TraceTrial task allowlist')
    parser.add_argument('action', choices=['preflight', 'prepare-build', 'build', 'run'])
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--context', type=Path)
    parser.add_argument('--task', default=TASK_ID)
    parser.add_argument('--image', default='agenthub/tracetrial:e8-local')
    parser.add_argument('--reuse-image', help='prepare-build only: exact locally available baseline RepoDigest')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--budget-mode', choices=['task', 'constrained'], default='task')
    parser.add_argument('--limits-file', type=Path, help='preflight only: explicit flat budget overrides')
    parser.add_argument('--budget-out', type=Path, help='preflight only: write a source-bound run plan')
    parser.add_argument('--budget-file', type=Path, help='run only: plan generated by preflight')
    parser.add_argument('--workspace-setup-policy', choices=[E2_SETUP_POLICY],
                        help='preflight only: explicit approved E2 copied executable-mode repair')
    parser.add_argument('--actor-proxy', default='http://192.168.5.2:7890')
    parser.add_argument('--judge-proxy', default='http://127.0.0.1:7890')
    args = parser.parse_args()
    if args.reuse_image and args.action != 'prepare-build':
        parser.error('--reuse-image is only accepted by prepare-build')
    if args.action != 'preflight' and args.context is None:
        parser.error('--context is required for build and run actions')
    if args.action != 'preflight' and (args.limits_file or args.budget_out or args.budget_mode != 'task' or args.workspace_setup_policy):
        parser.error('--limits-file, --budget-out, --budget-mode and --workspace-setup-policy are preflight options')
    if args.action != 'run' and args.budget_file:
        parser.error('--budget-file is only accepted for run')
    if args.action == 'preflight':
        overrides = json.loads(args.limits_file.read_text(encoding='utf-8')) if args.limits_file else None
        result = preflight_task(args.source, args.task, mode=args.budget_mode, overrides=overrides,
            **({'workspace_setup_policy': args.workspace_setup_policy} if args.workspace_setup_policy else {}))
        if args.budget_out:
            write_budget_file(result, args.budget_out)
    elif args.action == 'prepare-build':
        result = {'context': str(prepare_build(args.source, args.context, reuse_image=args.reuse_image))}
    elif args.action == 'build':
        checked_source(args.source)
        build_image(args.context, args.image, args.actor_proxy)
        result = {'image': args.image, 'modelCalls': 0}
    else:
        if args.out is None:
            parser.error('--out is required for run')
        if args.budget_file is None:
            parser.error('run requires --budget-file generated by preflight --budget-out')
        result = run_trial(source=args.source, output=args.out, context=args.context, image=args.image,
            actor_proxy=args.actor_proxy, judge_proxy=args.judge_proxy, task_id=args.task, budget_file=args.budget_file)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

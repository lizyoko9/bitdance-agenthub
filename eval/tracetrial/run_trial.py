#!/usr/bin/env python3
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import uuid


SOURCE_REVISION = '98a381307184fa4212db3466b21b4c92a031940b'
TASK_ID = 'E8-exit-code-masked-by-output-001'
MODEL = 'gpt-6-luna'
RECORDER_FILES = ('tracetrial_bench/__init__.py', 'tracetrial_bench/provider_request_recorder.py',
                  'harness_tracer/__init__.py', 'harness_tracer/provider_requests.py')
ROOT = Path(__file__).resolve().parents[2]
REFRESH_CONTROLLER_FILES = ('eval/tracetrial/run_trial.py', 'eval/tracetrial/Dockerfile.refresh',
    'eval/tracetrial/refresh-runtime.py', 'eval/tracetrial/container_worker.py',
    'eval/terminalbench/prepare-runtime.py')


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
                'container_worker.py', *('recorder/' + name for name in RECORDER_FILES)}
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
    if hashlib.sha256(Path(__file__).with_name('container_worker.py').read_bytes()).hexdigest() != hashlib.sha256((Path(context)/'container_worker.py').read_bytes()).hexdigest():
        raise ValueError('Container worker differs from committed build context')
    build = json.loads((Path(context)/'build-manifest.json').read_text())
    for name, digest in build.get('controllerFiles', {}).items():
        if name not in REFRESH_CONTROLLER_FILES or hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != digest:
            raise ValueError('Refresh controller source differs from committed build context')


def actor_request(task):
    return {'taskId': task.task_id, 'instruction': task.prompt, 'cwd': '/workspace', 'group': 'single',
        'modelId': MODEL, 'timeoutMs': 120000, 'maxTurns': 32, 'maxToolCalls': 6,
        'requestLimits': {'maxRequests': 16, 'maxRequestBytes': 262144,
            'maxTotalRequestBytes': 2097152, 'maxCompletionTokens': 8192}, 'outputDir': '/state/trial'}


def run_trial(*, source, output, context, image, actor_proxy, judge_proxy):
    from tracetrial_bench.task_resolver import resolve_task
    from tracetrial_bench.runner_policy import resolve_harness_invocation
    from tracetrial_bench.workspace import (prepare_run_dir, snapshot_workspace, persist_scoring_inputs,
        validate_workspace_for_host_verifier, write_workspace_diff)
    from .trace_adapter import normalize_agenthub_trace, emit_execution_evidence
    from .score_trial import score_retained_trial

    source = checked_source(source)
    check_installed_benchmark(source)
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
    task = resolve_task(source / 'Task' / TASK_ID)
    if (task.max_turns, task.max_tool_calls, task.max_wall_time_sec) != (1, 6, 120):
        raise ValueError('Task budgets differ from the approved fixed task')
    hashes_before = directory_hashes(task.task_dir)
    layout = prepare_run_dir(task, Path(output).resolve())
    snapshot_workspace(layout.workspace_dir, layout.baseline_dir)
    persist_scoring_inputs(task, layout)
    request = actor_request(task)
    request_file = layout.agent_dir / 'request.json'
    write_json(request_file, request)
    invocation = resolve_harness_invocation(harness='agenthub', requested_timeout=120,
        task_max_wall_time_sec=task.max_wall_time_sec, task_max_turns=task.max_turns,
        requested_extra_args={}, strict=True)
    lifecycle = []
    container_id = None
    native = layout.agent_dir / 'native'
    native.mkdir()
    settings = {'model': MODEL, 'reasoningEffort': 'none', 'userTurns': 1, 'maxTurns': 32,
        'maxToolCalls': 6, 'maxRequests': 16, 'maxRequestBytes': 262144,
        'maxTotalRequestBytes': 2097152, 'maxCompletionTokens': 8192, 'timeoutSeconds': 120,
        'sdkRetries': 0, 'redirects': 'error', 'group': 'single', 'networkMode': 'bridge',
        'networkLimitation': 'Task forbids network access; OS bridge matches the pinned official container runner',
        'credentialStorage': 'stdin to root recorder memory; unprivileged actor child receives placeholder only'}
    write_json(layout.artifacts_dir / 'protocol.json', {'taskId': TASK_ID, 'upstream': SOURCE_REVISION,
        'agenthubCommit': build['runtime']['agenthubCommit'], 'driverCommit': current_revision,
        'runtime': build, 'image': pinned_image,
        'actor': settings, 'executionAdapter': 'project-local AgentHub; official scorer unchanged',
        'sourceTaskHashesBefore': hashes_before, 'priceEstimateUsd': 0.6, 'hardDollarCap': False})
    failure = None
    try:
        created = docker('create', '--network=bridge', '--cpus=2', '--memory=4g', '--pids-limit=512',
            '--mount', f'type=bind,source={layout.workspace_dir},target=/workspace', inspection['Id'])
        container_id = created.stdout.strip()
        lifecycle.append({'stage': 'created', 'containerId': container_id, 'at': time.time()})
        docker('start', container_id)
        docker('cp', request_file, container_id + ':/state/request.json')
        # The privileged recorder receives the key over stdin; tools run as the unprivileged image user.
        environment = docker_environment()
        marker = layout.artifacts_dir / 'actor-started.json'
        with marker.open('x') as stream:
            json.dump({'at': time.time(), 'containerId': container_id, 'automaticRerun': False}, stream)
        lifecycle.append({'stage': 'actor_started', 'at': time.time()})
        result = docker('exec', '--interactive', '--user=0', '--env', f'ACTOR_UID={os.getuid()}',
            '--env', f'ACTOR_GID={os.getgid()}', container_id, 'python3',
            '/opt/agenthub-eval/container_worker.py', '/state/request.json', '/state', actor_proxy,
            environment=environment, input_text=key, timeout=155, check=False)
        (native / 'worker.log').write_text((result.stdout + result.stderr).replace(key, '[REDACTED]'))
        lifecycle.append({'stage': 'actor_exited', 'exitCode': result.returncode, 'at': time.time()})
    except Exception as exception:
        failure = type(exception).__name__
    finally:
        if container_id:
            try:
                copied = docker('cp', container_id + ':/state/.', native, timeout=60, check=False)
                lifecycle.append({'stage': 'evidence_copied', 'exitCode': copied.returncode, 'at': time.time()})
            finally:
                removed = docker('rm', '--force', container_id, check=False)
                lifecycle.append({'stage': 'removed', 'exitCode': removed.returncode, 'at': time.time()})
        write_json(layout.artifacts_dir / 'lifecycle.json', lifecycle)
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
    write_json(layout.artifacts_dir / 'result.json', {'taskId': TASK_ID, 'actor': metadata,
        'trace': trace, 'scoring': scores})
    return {'runDir': str(layout.run_dir), 'actor': metadata, 'scoringStatus': scores['scoringStatus']}


def main():
    parser = argparse.ArgumentParser(description='One fixed, bounded AgentHub TraceTrial E8 experiment')
    parser.add_argument('action', choices=['prepare-build', 'build', 'run'])
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--context', type=Path, required=True)
    parser.add_argument('--image', default='agenthub/tracetrial:e8-local')
    parser.add_argument('--reuse-image', help='prepare-build only: exact locally available baseline RepoDigest')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--actor-proxy', default='http://192.168.5.2:7890')
    parser.add_argument('--judge-proxy', default='http://127.0.0.1:7890')
    args = parser.parse_args()
    if args.reuse_image and args.action != 'prepare-build':
        parser.error('--reuse-image is only accepted by prepare-build')
    if args.action == 'prepare-build':
        result = {'context': str(prepare_build(args.source, args.context, reuse_image=args.reuse_image))}
    elif args.action == 'build':
        checked_source(args.source)
        build_image(args.context, args.image, args.actor_proxy)
        result = {'image': args.image, 'modelCalls': 0}
    else:
        if args.out is None:
            parser.error('--out is required for run')
        result = run_trial(source=args.source, output=args.out, context=args.context, image=args.image,
            actor_proxy=args.actor_proxy, judge_proxy=args.judge_proxy)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

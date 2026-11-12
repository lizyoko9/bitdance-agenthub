#!/usr/bin/env python3
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


SOURCE_REVISION = '98a381307184fa4212db3466b21b4c92a031940b'
TASK_ID = 'E8-exit-code-masked-by-output-001'
MODEL = 'gpt-6-luna'
RECORDER_FILES = ('tracetrial_bench/__init__.py', 'tracetrial_bench/provider_request_recorder.py',
                  'harness_tracer/__init__.py', 'harness_tracer/provider_requests.py')
ROOT = Path(__file__).resolve().parents[2]


def write_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def directory_hashes(root):
    return {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(Path(root).rglob('*')) if path.is_file() and '__pycache__' not in path.parts}


def checked_source(source):
    source = Path(source).resolve(strict=True)
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    dirty = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=source, text=True)
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


def docker(*arguments, environment=None, timeout=120, check=True):
    result = subprocess.run(['docker', *map(str, arguments)], env=environment or docker_environment(),
                            capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        # Docker never receives credentials in argv, but avoid dumping its arbitrary stderr.
        raise RuntimeError(f'Docker {arguments[0]} failed (exit {result.returncode}); retained lifecycle logs describe the stage')
    return result


def prepare_build(source, output):
    source = checked_source(source)
    check_installed_benchmark(source)
    destination = Path(output).resolve()
    destination.mkdir(parents=True, exist_ok=False)
    spec = importlib.util.spec_from_file_location('prepare_runtime', ROOT / 'eval/terminalbench/prepare-runtime.py')
    packer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packer)
    archive = packer.prepare(ROOT, destination / 'runtime.tar.gz')
    for name in ('Dockerfile', 'container_worker.py'):
        shutil.copy2(Path(__file__).with_name(name), destination / name)
    shutil.copy2(ROOT / 'eval/terminalbench/install-runtime.sh', destination / 'install-runtime.sh')
    for name in RECORDER_FILES:
        target = destination / 'recorder' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / name, target)
    write_json(destination / 'build-manifest.json', {'sourceRevision': SOURCE_REVISION,
        'runtime': archive, 'buildFiles': directory_hashes(destination),
        'actorUid': os.getuid(), 'actorGid': os.getgid(), 'containsPrivateTasks': False})
    return destination


def build_image(context, image, proxy):
    manifest = json.loads((Path(context) / 'build-manifest.json').read_text())
    command = ['docker', 'build', '--network=bridge', '--build-arg', f'HTTP_PROXY={proxy}',
        '--build-arg', f'HTTPS_PROXY={proxy}', '--build-arg', f'ACTOR_UID={os.getuid()}',
        '--build-arg', f'ACTOR_GID={os.getgid()}', '--tag', image, str(context)]
    with (Path(context) / 'build.log').open('w') as stream:
        result = subprocess.run(command, env=docker_environment(), stdout=stream,
            stderr=subprocess.STDOUT, timeout=2400)
    if result.returncode:
        raise RuntimeError('Runtime build failed; inspect build.log (no actor has started)')
    inspection = json.loads(docker('image', 'inspect', image).stdout)[0]
    write_json(Path(context) / 'image.json', {'id': inspection['Id'], 'architecture': inspection['Architecture'],
        'os': inspection['Os'], 'runtime': manifest['runtime'], 'upstream': SOURCE_REVISION})


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
    pinned_image = json.loads((context / 'image.json').read_text())
    current_revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if build['runtime']['agenthubCommit'] != current_revision:
        raise ValueError('Runtime archive must have been prepared from the current committed implementation')
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
        'credentialStorage': 'recorder memory; actor child receives placeholder only'}
    write_json(layout.artifacts_dir / 'protocol.json', {'taskId': TASK_ID, 'upstream': SOURCE_REVISION,
        'agenthubCommit': current_revision, 'runtime': build, 'image': pinned_image,
        'actor': settings, 'executionAdapter': 'project-local AgentHub; official scorer unchanged',
        'sourceTaskHashesBefore': hashes_before, 'priceEstimateUsd': 0.6, 'hardDollarCap': False})
    failure = None
    try:
        created = docker('create', '--network=bridge', '--cpus=2', '--memory=4g', '--pids-limit=512',
            '--mount', f'type=bind,source={layout.workspace_dir},target=/workspace', image)
        container_id = created.stdout.strip()
        lifecycle.append({'stage': 'created', 'containerId': container_id, 'at': time.time()})
        docker('start', container_id)
        docker('cp', request_file, container_id + ':/state/request.json')
        # Name-only --env keeps the credential out of both argv and retained request files.
        environment = docker_environment()
        environment['OPENAI_API_KEY'] = key
        marker = layout.artifacts_dir / 'actor-started.json'
        with marker.open('x') as stream:
            json.dump({'at': time.time(), 'containerId': container_id, 'automaticRerun': False}, stream)
        lifecycle.append({'stage': 'actor_started', 'at': time.time()})
        result = docker('exec', '--env', 'OPENAI_API_KEY', container_id, 'python3',
            '/opt/agenthub-eval/container_worker.py', '/state/request.json', '/state', actor_proxy,
            environment=environment, timeout=155, check=False)
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
    parser.add_argument('--out', type=Path)
    parser.add_argument('--actor-proxy', default='http://192.168.5.2:7890')
    parser.add_argument('--judge-proxy', default='http://127.0.0.1:7890')
    args = parser.parse_args()
    if args.action == 'prepare-build':
        result = {'context': str(prepare_build(args.source, args.context))}
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

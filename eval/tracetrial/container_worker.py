#!/usr/bin/env python3
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, ProxyHandler, build_opener


GOVERNANCE_TASK_ID = 'G1-registry-cleanup-002'
APPROVED_TASK_IDS = (
    'E7-failed-command-stale-artifact-002',
    'E8-lintgate-exit-masked-002',
    'E8-exit-code-masked-by-output-001',
    GOVERNANCE_TASK_ID,
)
MODEL = 'gpt-6-luna'
ACTOR_CEILINGS = {'timeoutMs': 120000, 'maxTurns': 32, 'maxToolCalls': 6}
REQUEST_CEILINGS = {'maxRequests': 16, 'maxRequestBytes': 262144,
                    'maxTotalRequestBytes': 2097152, 'maxCompletionTokens': 8192}


def validate_actor_request(request):
    fields = {'taskId', 'instruction', 'cwd', 'group', 'modelId', 'timeoutMs',
              'maxTurns', 'maxToolCalls', 'requestLimits', 'outputDir'}
    if not isinstance(request, dict) or set(request) != fields:
        raise ValueError('Actor request fields differ from the approved public request')
    if request['taskId'] not in APPROVED_TASK_IDS or request['modelId'] != MODEL or request['group'] != 'single':
        raise ValueError('Actor task, model or execution group is not approved')
    if request['cwd'] != '/workspace' or request['outputDir'] != '/state/trial':
        raise ValueError('Actor request paths differ from the isolated runtime paths')
    if not isinstance(request['instruction'], str) or not request['instruction'].strip() or len(request['instruction']) > 262144:
        raise ValueError('Actor instruction is missing or exceeds the public request bound')
    for name, ceiling in ACTOR_CEILINGS.items():
        if type(request[name]) is not int or not 0 < request[name] <= ceiling:
            raise ValueError('Actor setting exceeds approved ceiling: ' + name)
    limits = request['requestLimits']
    if not isinstance(limits, dict) or set(limits) != set(REQUEST_CEILINGS):
        raise ValueError('Actor request limits are incomplete or contain unknown settings')
    for name, ceiling in REQUEST_CEILINGS.items():
        if type(limits[name]) is not int or not 0 < limits[name] <= ceiling:
            raise ValueError('Actor setting exceeds approved ceiling: ' + name)
    return {**request, 'requestLimits': dict(limits)}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise URLError('redirects disabled for this evaluation')


class BoundedUpstream:
    def __init__(self, *, proxy, deadline, ledger_path, request, opener=None):
        self.opener = opener or build_opener(ProxyHandler({'https': proxy}), NoRedirect())
        self.settings = validate_actor_request(request)
        self.limits = self.settings['requestLimits']
        self.deadline = deadline
        self.ledger_path = Path(ledger_path)
        self.lock = threading.Lock()
        self.count = 0
        self.total_bytes = 0

    def open(self, request, timeout=None):
        body = request.data or b''
        with self.lock:
            remaining = self.deadline - time.monotonic()
            if remaining <= 0:
                raise URLError('actor deadline exhausted')
            if request.full_url != 'https://api.openai.com/v1/chat/completions' or request.get_method() != 'POST':
                raise URLError('actor endpoint is not allowlisted')
            try:
                payload = json.loads(body)
            except (ValueError, UnicodeError):
                raise URLError('invalid actor request JSON') from None
            if (not isinstance(payload, dict) or payload.get('model') != self.settings['modelId'] or payload.get('reasoning_effort') != 'none'
                    or type(payload.get('max_completion_tokens')) is not int
                    or payload['max_completion_tokens'] != self.limits['maxCompletionTokens']):
                raise URLError('actor model settings differ from approved settings')
            if (self.count >= self.limits['maxRequests'] or len(body) > self.limits['maxRequestBytes']
                    or self.total_bytes + len(body) > self.limits['maxTotalRequestBytes']):
                raise URLError('actor HTTP budget exhausted')
            self.count += 1
            self.total_bytes += len(body)
            row = {'sequence': self.count, 'body_bytes': len(body), 'total_body_bytes': self.total_bytes,
                   'started_at': datetime.now(timezone.utc).isoformat(), 'upstream_status': None}
        try:
            response = self.opener.open(request, timeout=min(remaining, self.settings['timeoutMs'] / 1000))
            row['upstream_status'] = response.status
            return response
        except Exception as exc:
            row['error_type'] = type(exc).__name__
            row['upstream_status'] = getattr(exc, 'code', None)
            raise
        finally:
            with self.lock, self.ledger_path.open('a', encoding='utf-8') as stream:
                stream.write(json.dumps(row) + '\n')


def run_worker(request_path, state_dir, proxy):
    from tracetrial_bench.provider_request_recorder import ProviderRequestRecorderProxy

    request = validate_actor_request(json.loads(Path(request_path).read_text(encoding='utf-8')))
    state = Path(state_dir)
    if os.geteuid() != 0:
        raise RuntimeError('Recorder supervisor requires root; actor child is explicitly unprivileged')
    key = sys.stdin.read(8192).strip()
    if not key:
        raise RuntimeError('approved OpenAI credential is missing')
    state.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc).isoformat()
    deadline = time.monotonic() + request['timeoutMs'] / 1000
    recorder = ProviderRequestRecorderProxy(output_root=state / 'recorder',
        upstream_base_url='https://api.openai.com/v1', upstream_api_key=key,
        listen_host='127.0.0.1', listen_port=4002)
    guard = BoundedUpstream(proxy=proxy, deadline=deadline, ledger_path=state / 'upstream_requests.jsonl', request=request)
    recorder._opener = guard
    info = recorder.start()
    environment = {'PATH': os.environ['PATH'], 'HOME': '/state/home', 'LANG': 'C.UTF-8',
        'OPENAI_API_KEY': 'agenthub-eval-recorder-placeholder', 'OPENAI_BASE_URL': info.base_url + '/v1',
        'NO_PROXY': '127.0.0.1,localhost,::1', 'NODE_USE_ENV_PROXY': '1'}
    Path(environment['HOME']).mkdir(parents=True, exist_ok=True)
    timed_out = False
    code = None
    try:
        with (state / 'cli.log').open('wb') as log:
            child = subprocess.Popen(['node', '--import', 'tsx', 'eval/tracetrial/run-agenthub.ts',
                '--request', str(request_path)], cwd='/installed-agent/agenthub', env=environment,
                stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
                user=int(os.environ['ACTOR_UID']), group=int(os.environ['ACTOR_GID']), extra_groups=[])
            try:
                code = child.wait(timeout=max(0.01, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    code = child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    code = child.wait(timeout=5)
    finally:
        recorder.stop()
        (state / 'provider_summary.json').write_text(json.dumps(recorder.public_summary(), indent=2) + '\n')
        (state / 'actor_process.json').write_text(json.dumps({'exit_code': code, 'timed_out': timed_out,
            'started_at': started, 'finished_at': datetime.now(timezone.utc).isoformat(),
            'model': request['modelId'], 'actual_upstream_requests': guard.count,
            'effective_limits': {name: request[name] for name in ('timeoutMs', 'maxTurns', 'maxToolCalls', 'requestLimits')},
            'total_request_bytes': guard.total_bytes}, indent=2) + '\n')
    return 124 if timed_out else code


if __name__ == '__main__':
    sys.exit(run_worker(*sys.argv[1:]))

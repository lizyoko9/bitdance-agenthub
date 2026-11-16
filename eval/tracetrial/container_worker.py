#!/usr/bin/env python3
import hashlib
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

if __package__:
    from .budget_contract import budget_plan_digest, validate_budget_plan
else:
    from budget_contract import budget_plan_digest, validate_budget_plan


GOVERNANCE_TASK_ID = 'G1-registry-cleanup-002'
TIMEOUT_TASK_ID = 'E6-timeout-error-channel-003'
CONFIRMATION_TASK_ID = 'L2-deploy-latency-001'
MOUNTCHECK_TASK_ID = 'E8-mountcheck-exit-masked-003'
PROCESS_OBSERVED_TASK_IDS = (TIMEOUT_TASK_ID, CONFIRMATION_TASK_ID)
APPROVED_TASK_IDS = (
    'E7-failed-command-stale-artifact-002',
    'E8-lintgate-exit-masked-002',
    'E8-exit-code-masked-by-output-001',
    GOVERNANCE_TASK_ID,
    TIMEOUT_TASK_ID,
    CONFIRMATION_TASK_ID,
    MOUNTCHECK_TASK_ID,
)
MODEL = 'gpt-6-luna'


class ProcessObservationError(RuntimeError):
    pass


class ProcessObserver:
    def __init__(self, *, proc_root=Path('/proc'), worker_pid=None, interval_seconds=0.01,
                 final_interval_seconds=0.01, sleeper=time.sleep, private_pid_namespace=False):
        self.proc_root = Path(proc_root)
        self.worker_pid = os.getpid() if worker_pid is None else worker_pid
        self.interval_seconds = interval_seconds
        self.final_interval_seconds = final_interval_seconds
        self.private_pid_namespace = private_pid_namespace is True
        if any(type(value) not in (int, float) or not 0 < value <= 1
               for value in (interval_seconds, final_interval_seconds)):
            raise ValueError('Process observation intervals must be positive seconds no greater than one')
        self._sleep = sleeper
        self._baseline = {}
        self._observed = {}
        self._namespace = None
        self._baseline_verified = False
        self._actor_identity = None
        self._errors = []
        self._sample_count = 0
        self._started_at = None
        self._frozen_json = None
        self._stop = threading.Event()
        self._scan_lock = threading.Lock()
        self._freeze_lock = threading.Lock()
        self._thread = None

    @staticmethod
    def _utc():
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _identity(record):
        return record['pid'], record['start_ticks']

    @staticmethod
    def _identity_hash(records):
        identities = sorted([[row['pid'], row['start_ticks']] for row in records])
        return hashlib.sha256(json.dumps(identities, separators=(',', ':')).encode('ascii')).hexdigest()

    def _error(self, stage, error):
        code = str(error) if isinstance(error, ProcessObservationError) else type(error).__name__
        self._errors.append(stage + ':' + code)

    def _read_namespace(self):
        if os.readlink(self.proc_root / 'self') != str(self.worker_pid):
            raise ProcessObservationError('self_proc_mapping_mismatch')
        current = os.readlink(self.proc_root / 'self/ns/pid')
        if (not current.startswith('pid:[') or not current.endswith(']')
                or not current[5:-1].isdecimal()):
            raise ProcessObservationError('pid_namespace_mismatch')
        if self._namespace is not None and current != self._namespace:
            raise ProcessObservationError('pid_namespace_changed')
        return current

    def _read_stat(self, pid):
        text = (self.proc_root / str(pid) / 'stat').read_text(encoding='ascii')
        opening, closing = text.find('('), text.rfind(')')
        fields = text[closing + 2:].split()
        if opening < 1 or closing < opening or text[:opening].strip() != str(pid):
            raise ProcessObservationError('malformed_stat')
        try:
            row = {'pid': pid, 'start_ticks': int(fields[19]), 'ppid': int(fields[1]),
                   'pgid': int(fields[2]), 'sid': int(fields[3]), 'state': fields[0]}
        except (ValueError, IndexError):
            raise ProcessObservationError('malformed_stat') from None
        if row['state'] not in 'RSDZTtWXxKPI' or len(row['state']) != 1 or any(
                row[name] < 0 for name in ('start_ticks', 'ppid', 'pgid', 'sid')):
            raise ProcessObservationError('malformed_stat')
        return row

    def _read_record(self, pid):
        before = self._read_stat(pid)
        status = (self.proc_root / str(pid) / 'status').read_text(encoding='ascii')
        rows = [line.split()[1:] for line in status.splitlines() if line.startswith('Uid:')]
        if len(rows) != 1 or len(rows[0]) != 4 or any(not value.isdecimal() for value in rows[0]):
            raise ProcessObservationError('malformed_uids')
        after = self._read_stat(pid)
        if self._identity(before) != self._identity(after):
            raise ProcessObservationError('identity_changed_during_read')
        return {**after, 'uids': [int(value) for value in rows[0]]}

    def _snapshot(self, *, require_complete=False):
        namespace = self._read_namespace()
        records = {}
        entries = list(self.proc_root.iterdir())
        for entry in entries:
            if not entry.name.isdecimal():
                continue
            pid = int(entry.name)
            try:
                row = self._read_record(pid)
            except FileNotFoundError:
                # Only a second missing process directory confirms normal exit churn.
                try:
                    entry.stat()
                except FileNotFoundError:
                    continue
                raise ProcessObservationError('unconfirmed_disappearance') from None
            records[self._identity(row)] = row
        if require_complete:
            visible = {int(entry.name) for entry in self.proc_root.iterdir() if entry.name.isdecimal()}
            if visible != {row['pid'] for row in records.values()}:
                raise ProcessObservationError('unstable_process_census')
            for pid in sorted(visible):
                row = self._read_record(pid)
                if self._identity(row) not in records:
                    raise ProcessObservationError('identity_changed_during_census')
                records[self._identity(row)] = row
            if visible != {int(entry.name) for entry in self.proc_root.iterdir() if entry.name.isdecimal()}:
                raise ProcessObservationError('unstable_process_census')
        if namespace != self._read_namespace():
            raise ProcessObservationError('pid_namespace_changed')
        if self._baseline_verified and any(identity not in records for identity in self._baseline):
            raise ProcessObservationError('baseline_identity_changed')
        return namespace, records

    def start(self):
        if self._started_at is not None or self._frozen_json is not None:
            raise RuntimeError('Process observation cannot be started twice')
        self._started_at = self._utc()
        try:
            if not self.private_pid_namespace:
                raise ProcessObservationError('private_pid_namespace_contract_missing')
            if sys.platform != 'linux' or self.worker_pid == 1 or os.geteuid() != 0:
                raise ProcessObservationError('requires_isolated_linux_root_worker')
            namespace, records = self._snapshot()
            self._namespace = namespace
            by_pid = {row['pid']: row for row in records.values()}
            if set(by_pid) != {1, self.worker_pid} or any(row['state'] == 'Z' for row in by_pid.values()):
                raise ProcessObservationError('unexpected_baseline_processes')
            argv = (self.proc_root / '1/cmdline').read_bytes().split(b'\0')
            if argv[-1:] == [b'']:
                argv.pop()
            if (len(argv) != 2 or argv[0] not in (b'sleep', b'/bin/sleep', b'/usr/bin/sleep')
                    or argv[1] != b'infinity' or by_pid[self.worker_pid]['uids'] != [0, 0, 0, 0]):
                raise ProcessObservationError('unexpected_baseline_identity')
            self._baseline = records
            self._baseline_verified = True
            confirmation = self.sample(require_complete=True)
            if confirmation is None or set(confirmation) != set(self._baseline):
                raise ProcessObservationError('baseline_confirmation_failed')
            self._thread = threading.Thread(target=self._monitor, name='agenthub-process-observer', daemon=True)
            self._thread.start()
        except Exception as error:
            if self._thread is not None and self._thread.ident is None:
                self._thread = None
            self._baseline_verified = False
            self._baseline = {}
            self._error('start', error)
            raise RuntimeError('Isolated process observer could not verify its baseline') from None
        return self

    def sample(self, *, require_complete=False):
        with self._scan_lock:
            if self._frozen_json is not None:
                raise RuntimeError('Process observation is already frozen')
            self._sample_count += 1
            try:
                _, records = self._snapshot(require_complete=require_complete)
                for identity, row in records.items():
                    if identity not in self._baseline:
                        self._observed[identity] = row
                return records
            except Exception as error:
                self._error('scan', error)
                return None

    def _monitor(self):
        while not self._stop.wait(self.interval_seconds):
            self.sample()

    def bind_actor(self, pid):
        with self._scan_lock:
            try:
                if not self._baseline_verified or self._frozen_json is not None or self._actor_identity is not None:
                    raise ProcessObservationError('actor_binding_unavailable')
                row = self._read_record(pid)
                identity = self._identity(row)
                if identity in self._baseline:
                    raise ProcessObservationError('actor_matches_baseline')
                self._actor_identity = {'pid': pid, 'start_ticks': row['start_ticks']}
                self._observed[identity] = row
            except Exception as error:
                self._error('actor', error)

    def freeze(self, *, natural_exit, forced_stop=False):
        with self._freeze_lock:
            if self._frozen_json is not None:
                return json.loads(self._frozen_json)
            self._stop.set()
            if self._thread is not None:
                self._thread.join(timeout=1)
            complete = self._baseline_verified and (self._thread is None or not self._thread.is_alive())
            if self._thread is not None and self._thread.is_alive():
                self._error('freeze', ProcessObservationError('observer_thread_did_not_stop'))
            snapshots = [None, None]
            if complete:
                snapshots[0] = self.sample(require_complete=True)
                try:
                    self._sleep(self.final_interval_seconds)
                    snapshots[1] = self.sample(require_complete=True)
                except Exception as error:
                    self._error('freeze', error)
            complete = complete and all(snapshot is not None for snapshot in snapshots)
            live, zombies, counts = {}, {}, []
            for snapshot in snapshots:
                current = {} if snapshot is None else {key: row for key, row in snapshot.items() if key not in self._baseline}
                active = {key: row for key, row in current.items() if row['state'] != 'Z'}
                counts.append(None if snapshot is None else len(active))
                live.update(active)
                zombies.update({key: row for key, row in current.items() if row['state'] == 'Z'})
            baseline = sorted(self._baseline.values(), key=self._identity)
            observed = sorted(self._observed.copy().values(), key=self._identity)
            receipt = {'schema_version': 'agenthub-process-observation-v1',
                'scope': 'isolated_container_pid_delta', 'measurement_only': True, 'observer_did_signal': False,
                'natural_actor_exit': natural_exit, 'forced_stop': forced_stop,
                'tracking_failed': bool(self._errors), 'tracking_errors': list(self._errors),
                'baseline_verified': self._baseline_verified, 'pid_namespace': self._namespace,
                'namespace_verification': 'driver_private_pidns_and_self_proc',
                'private_pid_namespace': self.private_pid_namespace,
                'baseline_processes': baseline, 'actor_identity': self._actor_identity,
                'observed_new_processes': observed, 'observed_new_process_count': len(observed),
                'observed_new_count_is_lower_bound': True, 'observed_identity_sha256': self._identity_hash(observed),
                'baseline_identity_sha256': self._identity_hash(baseline) if self._baseline_verified else None,
                'sample_count': self._sample_count, 'final_census_count': sum(row is not None for row in snapshots),
                'final_live_counts': counts, 'final_censuses_complete': complete,
                'residual_process_count': len(live) if complete else None,
                'residual_processes': sorted(live.values(), key=self._identity) if complete else None,
                'zombie_process_count': len(zombies) if complete else None,
                'sampling_interval_seconds': self.interval_seconds, 'final_census_interval_seconds': self.final_interval_seconds,
                'started_at': self._started_at, 'frozen_at': self._utc(),
                'descendant_cleanup_valid': bool(natural_exit and not forced_stop and not self._errors
                    and complete and self._actor_identity is not None and not live)}
            self._frozen_json = json.dumps(receipt, sort_keys=True)
            return json.loads(self._frozen_json)


def validate_actor_request(request, budget_plan):
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
    plan = validate_budget_plan(budget_plan, task_id=request['taskId'])
    effective = plan['actor']
    for name in ('timeoutMs', 'maxTurns', 'maxToolCalls'):
        if type(request[name]) is not int or request[name] != effective[name]:
            raise ValueError('Actor request differs from the budget plan: ' + name)
    limits = request['requestLimits']
    if not isinstance(limits, dict) or set(limits) != set(effective['requestLimits']):
        raise ValueError('Actor request limits differ from the budget plan')
    if any(type(value) is not int or value != effective['requestLimits'][name] for name, value in limits.items()):
        raise ValueError('Actor request limits differ from the budget plan')
    return {**request, 'requestLimits': dict(limits)}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise URLError('redirects disabled for this evaluation')


class BoundedUpstream:
    def __init__(self, *, proxy, deadline, ledger_path, request, budget_plan, opener=None):
        self.opener = opener or build_opener(ProxyHandler({'https': proxy}), NoRedirect())
        self.settings = validate_actor_request(request, budget_plan)
        self.limits = self.settings['requestLimits']
        self.deadline = deadline
        self.ledger_path = Path(ledger_path)
        self.lock = threading.Lock()
        self.count = 0
        self.total_bytes = 0
        self.budget_rejection = None

    def _reject_budget(self, limit, reason):
        if self.budget_rejection is None:
            self.budget_rejection = {'limit': limit, 'reason': reason}
        raise URLError('actor budget exhausted: ' + self.budget_rejection['reason'])

    def open(self, request, timeout=None):
        body = request.data or b''
        with self.lock:
            remaining = self.deadline - time.monotonic()
            if self.budget_rejection is not None:
                self._reject_budget(self.budget_rejection['limit'], self.budget_rejection['reason'])
            if remaining <= 0:
                self._reject_budget('wall_time', 'actor deadline exhausted')
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
            if self.count >= self.limits['maxRequests']:
                self._reject_budget('http_requests', 'maximum actor HTTP requests reached')
            if len(body) > self.limits['maxRequestBytes']:
                self._reject_budget('request_bytes', 'actor request body exceeds byte limit')
            if self.total_bytes + len(body) > self.limits['maxTotalRequestBytes']:
                self._reject_budget('total_request_bytes', 'cumulative actor request bodies exceed byte limit')
            self.count += 1
            self.total_bytes += len(body)
            row = {'sequence': self.count, 'body_bytes': len(body), 'total_body_bytes': self.total_bytes,
                   'started_at': datetime.now(timezone.utc).isoformat(), 'upstream_status': None}
        try:
            response = self.opener.open(request, timeout=min(remaining, self.settings['timeoutMs'] / 1000))
            row['upstream_status'] = response.status
            return response
        except Exception as exc:
            if time.monotonic() >= self.deadline and self.budget_rejection is None:
                self.budget_rejection = {'limit': 'wall_time', 'reason': 'actor deadline exhausted during upstream request'}
            row['error_type'] = type(exc).__name__
            row['upstream_status'] = getattr(exc, 'code', None)
            raise
        finally:
            with self.lock, self.ledger_path.open('a', encoding='utf-8') as stream:
                stream.write(json.dumps(row) + '\n')


def run_worker(request_path, state_dir, proxy, budget_path):
    from tracetrial_bench.provider_request_recorder import ProviderRequestRecorderProxy

    budget_plan = validate_budget_plan(json.loads(Path(budget_path).read_text(encoding='utf-8')))
    request = validate_actor_request(json.loads(Path(request_path).read_text(encoding='utf-8')), budget_plan)
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
    guard = BoundedUpstream(proxy=proxy, deadline=deadline, ledger_path=state / 'upstream_requests.jsonl', request=request, budget_plan=budget_plan)
    recorder._opener = guard
    info = recorder.start()
    environment = {'PATH': os.environ['PATH'], 'HOME': '/state/home', 'LANG': 'C.UTF-8',
        'OPENAI_API_KEY': 'agenthub-eval-recorder-placeholder', 'OPENAI_BASE_URL': info.base_url + '/v1',
        'NO_PROXY': '127.0.0.1,localhost,::1', 'NODE_USE_ENV_PROXY': '1'}
    Path(environment['HOME']).mkdir(parents=True, exist_ok=True)
    timed_out = False
    code = None
    observer = ProcessObserver(private_pid_namespace=os.environ.get('AGENTHUB_PRIVATE_PID_NAMESPACE') == 'private') \
        if request['taskId'] in PROCESS_OBSERVED_TASK_IDS else None
    containment = None
    try:
        if observer is not None:
            observer.start()
        with (state / 'cli.log').open('wb') as log:
            child = subprocess.Popen(['node', '--import', 'tsx', 'eval/tracetrial/run-agenthub.ts',
                '--request', str(request_path)], cwd='/installed-agent/agenthub', env=environment,
                stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
                user=int(os.environ['ACTOR_UID']), group=int(os.environ['ACTOR_GID']), extra_groups=[])
            if observer is not None:
                observer.bind_actor(child.pid)
            try:
                code = child.wait(timeout=max(0.01, deadline - time.monotonic()))
                if observer is not None:
                    containment = observer.freeze(natural_exit=True)
            except subprocess.TimeoutExpired:
                timed_out = True
                if guard.budget_rejection is None:
                    guard.budget_rejection = {'limit': 'wall_time', 'reason': 'actor deadline exhausted'}
                if observer is not None:
                    containment = observer.freeze(natural_exit=False, forced_stop=True)
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    code = child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    code = child.wait(timeout=5)
    finally:
        if observer is not None and containment is None:
            containment = observer.freeze(natural_exit=False)
        recorder.stop()
        (state / 'provider_summary.json').write_text(json.dumps(recorder.public_summary(), indent=2) + '\n')
        (state / 'actor_process.json').write_text(json.dumps({'exit_code': code, 'timed_out': timed_out,
            'started_at': started, 'finished_at': datetime.now(timezone.utc).isoformat(),
            'model': request['modelId'], 'actual_upstream_requests': guard.count,
            'budget_plan_digest': budget_plan_digest(budget_plan), 'budget_mode': budget_plan['mode'],
            'budget_rejection': guard.budget_rejection,
            'effective_limits': {name: request[name] for name in ('timeoutMs', 'maxTurns', 'maxToolCalls', 'requestLimits')},
            'total_request_bytes': guard.total_bytes,
            **({'process_containment': containment} if observer is not None else {})}, indent=2) + '\n')
    return 124 if timed_out else code


if __name__ == '__main__':
    sys.exit(run_worker(*sys.argv[1:]))

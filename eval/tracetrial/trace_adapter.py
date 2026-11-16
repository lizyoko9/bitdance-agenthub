import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from harness_tracer.summary import build_summary
from harness_tracer.writer import EventWriter
from tracetrial_bench.execution_capabilities import persist_execution_probe_evidence

from .container_worker import MOUNTCHECK_TASK_ID, PROCESS_OBSERVED_TASK_IDS, TIMEOUT_TASK_ID


CAPABILITIES = ("native_exec_v1", "post_tool_v1")
TIMEOUT_CAPABILITIES = ("timeout_observation_v1", "process_containment_v1")
TOOL_RESULT_PROJECTION_VERSION = "agenthub_transport_v2"
TIMEOUT_OBSERVER_PROJECTION_VERSION = 'agenthub_timeout_observer_v1'


def capabilities_for_task(task_id: str) -> tuple[str, ...]:
    if task_id == MOUNTCHECK_TASK_ID:
        return CAPABILITIES + ("native_terminal_completion_v1",)
    if task_id == TIMEOUT_TASK_ID:
        return CAPABILITIES + TIMEOUT_CAPABILITIES
    return CAPABILITIES + ("process_containment_v1",) if task_id in PROCESS_OBSERVED_TASK_IDS else CAPABILITIES


def _validate_process_receipt(receipt: Any) -> dict:
    fields = {'schema_version', 'scope', 'measurement_only', 'observer_did_signal', 'natural_actor_exit',
        'forced_stop', 'tracking_failed', 'tracking_errors', 'baseline_verified', 'pid_namespace',
        'private_pid_namespace', 'namespace_verification',
        'baseline_processes', 'actor_identity', 'observed_new_processes', 'observed_new_process_count',
        'observed_new_count_is_lower_bound', 'observed_identity_sha256', 'baseline_identity_sha256',
        'sample_count', 'final_census_count', 'final_live_counts', 'final_censuses_complete',
        'residual_process_count', 'residual_processes', 'zombie_process_count', 'sampling_interval_seconds',
        'final_census_interval_seconds', 'started_at', 'frozen_at', 'descendant_cleanup_valid'}

    def require(condition, detail):
        if not condition:
            raise ValueError('Invalid AgentHub process containment receipt: ' + detail)

    def integer(value, minimum=0):
        return type(value) is int and value >= minimum

    def identities(records):
        return sorted([[record['pid'], record['start_ticks']] for record in records])

    def digest(records):
        return hashlib.sha256(json.dumps(identities(records), separators=(',', ':')).encode('ascii')).hexdigest()

    def records(value, name):
        require(type(value) is list, name + ' must be a list')
        for record in value:
            require(type(record) is dict and set(record) == {'pid', 'start_ticks', 'ppid', 'pgid', 'sid', 'state', 'uids'},
                    name + ' has invalid process fields')
            require(integer(record['pid'], 1) and all(integer(record[key]) for key in ('start_ticks', 'ppid', 'pgid', 'sid')),
                    name + ' has invalid process identities')
            require(type(record['state']) is str and len(record['state']) == 1 and record['state'] in 'RSDZTtWXxKPI',
                    name + ' has invalid process state')
            require(type(record['uids']) is list and len(record['uids']) == 4 and all(integer(uid) for uid in record['uids']),
                    name + ' has invalid process UIDs')
        require(len({tuple(identity) for identity in identities(value)}) == len(value), name + ' has duplicate identities')

    require(type(receipt) is dict and set(receipt) == fields, 'fields differ from the installed observer schema')
    require(receipt['schema_version'] == 'agenthub-process-observation-v1'
            and receipt['scope'] == 'isolated_container_pid_delta'
            and receipt['namespace_verification'] == 'driver_private_pidns_and_self_proc', 'unknown schema, scope or namespace contract')
    for key in ('measurement_only', 'observer_did_signal', 'natural_actor_exit', 'forced_stop', 'tracking_failed',
                'baseline_verified', 'private_pid_namespace', 'observed_new_count_is_lower_bound',
                'final_censuses_complete', 'descendant_cleanup_valid'):
        require(type(receipt[key]) is bool, key + ' must be a boolean')
    require(receipt['measurement_only'] is True and receipt['observer_did_signal'] is False
            and receipt['observed_new_count_is_lower_bound'] is True, 'observer measurement contract changed')
    require(type(receipt['tracking_errors']) is list and all(type(error) is str and error for error in receipt['tracking_errors']),
            'tracking_errors must be a list of error codes')
    require(receipt['tracking_failed'] or not receipt['tracking_errors'], 'tracking errors cannot claim success')
    require(receipt['pid_namespace'] is None or (type(receipt['pid_namespace']) is str and receipt['pid_namespace']),
            'invalid PID namespace')
    for key in ('baseline_processes', 'observed_new_processes'):
        records(receipt[key], key)
    actor = receipt['actor_identity']
    require(actor is None or (type(actor) is dict and set(actor) == {'pid', 'start_ticks'}
            and integer(actor['pid'], 1) and integer(actor['start_ticks'])), 'invalid Actor identity')
    if not receipt['private_pid_namespace']:
        require(not receipt['baseline_verified'] and not receipt['descendant_cleanup_valid'] and actor is None
                and receipt['pid_namespace'] is None and receipt['tracking_failed']
                and not receipt['final_censuses_complete'] and receipt['final_census_count'] == 0,
                'unverified private namespace cannot claim baseline or Actor evidence')
    require(integer(receipt['observed_new_process_count'])
            and receipt['observed_new_process_count'] == len(receipt['observed_new_processes']), 'observed count mismatch')
    require(receipt['observed_identity_sha256'] == digest(receipt['observed_new_processes']), 'observed identity digest mismatch')
    baseline_digest = receipt['baseline_identity_sha256']
    require(baseline_digest is None or baseline_digest == digest(receipt['baseline_processes']), 'baseline identity digest mismatch')
    if receipt['baseline_verified']:
        require(len(receipt['baseline_processes']) == 2 and receipt['pid_namespace'] is not None
                and baseline_digest is not None, 'verified baseline lacks its measured evidence')
    require(integer(receipt['sample_count']) and integer(receipt['final_census_count'])
            and receipt['final_census_count'] <= 2, 'invalid census counts')
    counts = receipt['final_live_counts']
    require(type(counts) is list and len(counts) == 2 and all(value is None or integer(value) for value in counts),
            'invalid final live counts')
    for key in ('sampling_interval_seconds', 'final_census_interval_seconds'):
        require(type(receipt[key]) is float and receipt[key] == 0.01, 'observation interval differs from installed policy')
    for key in ('started_at', 'frozen_at'):
        value = receipt[key]
        require(value is None and key == 'started_at' or type(value) is str, 'invalid ' + key)
        if value is not None:
            try:
                timestamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
                require(timestamp.utcoffset() == timezone.utc.utcoffset(timestamp), 'non-UTC ' + key)
            except ValueError as error:
                raise ValueError('Invalid AgentHub process containment receipt: invalid ' + key) from error
    if receipt['final_censuses_complete']:
        require(receipt['final_census_count'] == 2 and all(integer(value) for value in counts), 'incomplete final census evidence')
        records(receipt['residual_processes'], 'residual_processes')
        require(integer(receipt['residual_process_count']) and receipt['residual_process_count'] == len(receipt['residual_processes'])
                and max(counts) <= receipt['residual_process_count'] <= sum(counts)
                and integer(receipt['zombie_process_count']), 'invalid residual or zombie counts')
        require(all(record['state'] != 'Z' for record in receipt['residual_processes']), 'live residuals include zombies')
    else:
        require(all(receipt[key] is None for key in ('residual_process_count', 'residual_processes', 'zombie_process_count')),
                'unknown final census must retain null residual counts')
    require(not (receipt['natural_actor_exit'] and receipt['forced_stop']), 'forced stop cannot claim natural Actor exit')
    if receipt['descendant_cleanup_valid']:
        require(receipt['natural_actor_exit'] and actor is not None and not receipt['forced_stop'] and not receipt['tracking_failed']
                and receipt['baseline_verified'] and receipt['final_censuses_complete'] and receipt['residual_process_count'] == 0,
                'cleanup validity contradicts its measurements')
    return receipt


def _process_receipt_source(layout) -> tuple[dict, dict]:
    source = layout.agent_dir / 'native' / 'actor_process.json'
    if source.is_symlink():
        raise ValueError('AgentHub process containment apparatus source must not be a symlink')
    try:
        data = source.read_bytes()
        process = json.loads(data)
    except (OSError, UnicodeError, ValueError) as error:
        raise ValueError('AgentHub process containment apparatus source is missing or invalid') from error
    if type(process) is not dict or 'process_containment' not in process:
        raise ValueError('AgentHub process containment apparatus receipt is missing')
    receipt = _validate_process_receipt(process['process_containment'])
    return receipt, {'path': str(source.resolve()), 'sha256': hashlib.sha256(data).hexdigest(), 'field': 'process_containment'}


def _project_timeout_observations(evidence_path: Path, summary: dict) -> None:
    raw = evidence_path.read_bytes()
    raw_hash = hashlib.sha256(raw).hexdigest()
    archive = evidence_path.with_name('evidence-official-helper-' + raw_hash + '.json')
    if archive.exists():
        if archive.is_symlink() or archive.read_bytes() != raw:
            raise ValueError('E6 timeout observer raw helper archive conflicts with its source')
    else:
        with archive.open('xb') as stream:
            stream.write(raw)
    audit = {'version': TIMEOUT_OBSERVER_PROJECTION_VERSION, 'status': 'rejected', 'rows': [],
        'raw_helper_evidence': {'path': str(archive.resolve()), 'sha256': raw_hash},
        'gate_decisions': 'unchanged official helper evaluation projection; no production gate execution asserted'}

    def require(condition, detail):
        if not condition:
            raise ValueError('E6 timeout observer correlation rejected: ' + detail)

    def exact(left, right):
        return json.dumps(left, sort_keys=True, separators=(',', ':'), allow_nan=False) == json.dumps(
            right, sort_keys=True, separators=(',', ':'), allow_nan=False)

    try:
        evidence = json.loads(raw)
        require(type(evidence) is dict, 'helper evidence is not an object')
        canonical_path = Path(summary['events_path'])
        native_path = Path(summary['agenthub_native_sources']['events'])
        require(not canonical_path.is_symlink() and not native_path.is_symlink(), 'trace sources must not be symlinks')
        canonical_data, native_data = canonical_path.read_bytes(), native_path.read_bytes()
        native_hash = hashlib.sha256(native_data).hexdigest()
        require(native_hash == summary['agenthub_native_sources']['events_sha256'], 'native source hash changed')
        audit['canonical_trace'] = {'path': str(canonical_path.resolve()), 'sha256': hashlib.sha256(canonical_data).hexdigest()}
        audit['native_source'] = {'path': str(native_path.resolve()), 'sha256': native_hash}
        require(evidence.get('source_trace') == str(canonical_path), 'helper source trace differs')
        canonical = json.loads(canonical_data)
        require(type(canonical) is list and all(type(event) is dict and type(event.get('seq')) is int for event in canonical),
                'canonical event identities are invalid')
        require(len({event['seq'] for event in canonical}) == len(canonical), 'canonical event seq is not unique')
        tools = {event['seq']: event for event in canonical if event.get('event_type') == 'tool'}
        diagnostics = []
        native = _read_events(native_data, diagnostics)
        require(not diagnostics, 'native source cannot be read completely')
        calls, results = {}, {}
        for line, event in native:
            kind = event['type']
            if kind not in ('tool.call', 'tool.result'):
                continue
            identifier = _identifier(event, 'callId')
            target = calls if kind == 'tool.call' else results
            require(identifier is not None and identifier not in target, 'native call/result identity is missing or duplicated')
            target[identifier] = (line, event)
        rows = evidence.get('post_tool_observations')
        require(type(rows) is list and len(rows) == len(tools) == len(calls) == len(results),
                'post/canonical/native tool counts differ')
        require(set(calls) == set(results), 'native calls and results do not match')
        seen_seq, seen_ids = set(), set()
        for row in rows:
            require(type(row) is dict and type(row.get('source_event_seq')) is int, 'post row seq is invalid')
            seq, identifier = row['source_event_seq'], row.get('tool_call_id')
            require(seq in tools and seq not in seen_seq and type(identifier) is str and identifier
                    and identifier in calls and identifier not in seen_ids, 'post row identity is missing, mismatched or duplicated')
            seen_seq.add(seq)
            seen_ids.add(identifier)
            event = tools[seq]
            call_line, call = calls[identifier]
            result_line, result = results[identifier]
            require(call_line < result_line and call.get('messageId') == result.get('messageId'), 'native result precedes or mismatches call')
            expected_call = {'tool_call_id': identifier, 'tool_name': call.get('toolName'), 'arguments': call.get('args')}
            require(exact(event.get('tool_call'), expected_call) and exact(event.get('native_tool_call'), call)
                    and exact(event.get('raw_event'), result) and 'result' in result
                    and exact(event.get('native_tool_result'), result['result']), 'canonical payload differs from native source')
            require(exact(event.get('source_refs'), [{'path': str(native_path.resolve()), 'line': call_line},
                    {'path': str(native_path.resolve()), 'line': result_line}])
                    and exact(event.get('native_call_source'), {'path': str(native_path.resolve()), 'line': call_line}),
                    'canonical source line references differ')
            payload = result['result']
            projected = dict(payload) if type(payload) is dict else {'value': payload}
            derived = {} if type(payload) is dict else {'value': 'raw_event.result'}
            if 'tool_call_id' in projected:
                require(exact(projected['tool_call_id'], identifier), 'native payload has conflicting call ID')
            else:
                projected['tool_call_id'] = identifier
                derived['tool_call_id'] = 'raw_event.callId'
            require(exact(event.get('tool_result'), projected) and exact(event.get('tool_result_projection'),
                    {'version': TOOL_RESULT_PROJECTION_VERSION, 'derived_fields': derived}), 'canonical result projection differs')
            require(exact(row.get('arguments'), call.get('args')) and exact(row.get('tool_name'), call.get('toolName'))
                    and exact(row.get('tool_result'), projected)
                    and ('raw_event' not in row or exact(row['raw_event'], result)),
                    'post row arguments/result differ from canonical/native source')
            require(type(row.get('timed_out')) is bool, 'original helper timeout value is not boolean')
            entry = {'source_event_seq': seq, 'tool_call_id': identifier, 'original_helper_value': row['timed_out'],
                'mapped_value': row['timed_out'], 'status': 'not_applicable', 'reason': 'source_missing',
                'source': {'path': str(native_path.resolve()), 'sha256': native_hash, 'raw_line': result_line, 'pointers': []}}
            audit['rows'].append(entry)
            aliases = [key for key in ('timedOut', 'timed_out') if type(payload) is dict and key in payload]
            if aliases:
                entry['source']['pointers'] = ['/result/' + key for key in aliases]
                entry.update(mapped_value=None, status='rejected', reason='native_timeout_alias_invalid')
                require(all(type(payload[key]) is bool for key in aliases), 'native timeout alias is not a strict boolean')
                require(all(payload[key] is payload[aliases[0]] for key in aliases), 'native timeout aliases conflict')
                row['timed_out'] = payload[aliases[0]]
                entry.update(mapped_value=row['timed_out'], status='mapped', reason='strict_native_boolean')
        audit['status'] = 'projected'
        _write_json(evidence_path, evidence)
    except (OSError, KeyError, UnicodeError, ValueError, TypeError) as error:
        audit['error'] = str(error) if isinstance(error, ValueError) else type(error).__name__
        raise ValueError('E6 timeout observer apparatus failed: ' + audit['error']) from error
    finally:
        audit_path = evidence_path.with_name('timeout-observer-projection.json')
        _write_json(audit_path, audit)
        summary['agenthub_timeout_observer_projection'] = {**audit, 'path': str(audit_path.resolve()),
            'sha256': hashlib.sha256(audit_path.read_bytes()).hexdigest()}
        _write_json(Path(summary['summary_path']), summary)


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _timestamp(value: Any) -> str | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat().replace("+00:00", "Z")
        except (ValueError, OverflowError, OSError):
            pass
    return None


def _archive_source(source: Path, destination: Path, diagnostics: list[str]) -> bytes | None:
    if source.is_symlink():
        diagnostics.append(f"Source must not be a symlink: {source.name}")
        return None
    try:
        data = source.read_bytes()
    except OSError:
        diagnostics.append(f"Native source is missing or unreadable: {source.name}")
        return None
    destination.write_bytes(data)
    return data


def _read_events(data: bytes | None, diagnostics: list[str]) -> list[tuple[int, dict]]:
    if data is None:
        return []
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeError:
        diagnostics.append("Native events are not valid UTF-8")
        return []
    events = []
    for line, text in enumerate(lines, 1):
        if not text.strip():
            continue
        try:
            event = json.loads(text)
        except json.JSONDecodeError:
            diagnostics.append(f"Invalid native JSON at line {line}")
            continue
        if not isinstance(event, dict) or not isinstance(event.get("type"), str):
            diagnostics.append(f"Invalid native event at line {line}")
            continue
        events.append((line, event))
    return events


def _identifier(event: dict, key: str) -> str | None:
    value = event.get(key)
    return value if isinstance(value, str) and value else None


def normalize_agenthub_trace(*, task, layout, native_events_path: Path,
                            native_result_path: Path, actor_metadata: dict) -> dict:
    trace_dir = layout.artifacts_dir / "trace" / "agenthub"
    trace_dir.mkdir(parents=True, exist_ok=False)
    diagnostics = []
    observations = []
    source_events = trace_dir / "source-events.jsonl"
    source_result = trace_dir / "source-result.json"
    event_data = _archive_source(Path(native_events_path), source_events, diagnostics)
    result_data = _archive_source(Path(native_result_path), source_result, diagnostics)
    native = _read_events(event_data, diagnostics)
    try:
        result = json.loads(result_data.decode("utf-8")) if result_data is not None else {}
        if not isinstance(result, dict):
            raise ValueError("object required")
    except (UnicodeError, json.JSONDecodeError, ValueError):
        result = {}
        diagnostics.append("Native result is not a valid JSON object")

    root_starts = [(line, event) for line, event in native
                   if event["type"] == "run.start" and not event.get("parentRunId")]
    root_id = _identifier(root_starts[0][1], "runId") if root_starts else None
    run_id = root_id or str(actor_metadata.get("run_id") or layout.run_dir.name)
    if len(root_starts) != 1 or root_id is None:
        diagnostics.append("Expected exactly one identified native root run.start")
    start_ms = root_starts[0][1].get("timestamp") if root_starts else None
    root_ends = []
    started_runs = set()
    ended_runs = set()
    run_statuses = {}
    calls = {}
    completed_calls = set()
    messages = {}
    previous_timestamp = None
    previous_timestamp_line = None
    prelude = []
    writer = EventWriter(trace_dir / "events.json", run_id=run_id)

    def emit(kind, line, event, **payload):
        source_lines = payload.pop("source_lines", [line])
        writer.write(kind, timestamp=_timestamp(event.get("timestamp")),
                     source="agenthub.native", native_event_type=event["type"],
                     source_refs=[{"path": str(source_events.resolve()), "line": value}
                                  for value in dict.fromkeys(source_lines)],
                     raw_event=event, **payload)

    for line, event in native:
        kind = event["type"]
        timestamp = event.get("timestamp")
        if _timestamp(timestamp) is not None:
            if previous_timestamp is not None and timestamp < previous_timestamp:
                observations.append({"kind": "timestamp_regression", "previous_timestamp": previous_timestamp,
                    "timestamp": timestamp,
                    "source_refs": [{"path": str(source_events.resolve()), "line": value}
                                    for value in (previous_timestamp_line, line)]})
            previous_timestamp = timestamp
            previous_timestamp_line = line
        # The persisted user message is an input prelude, before the native actor run.
        if not started_runs and kind == "message.added" and isinstance(event.get("message"), dict) and event["message"].get("role") == "user":
            prelude.append({"path": str(source_events.resolve()), "line": line})
            continue
        if root_ends:
            diagnostics.append(f"Native actor event follows root run.end at line {line}")
        if kind == "run.start":
            identifier = _identifier(event, "runId")
            if identifier is None or identifier in started_runs:
                diagnostics.append(f"Missing or duplicate native run.start ID at line {line}")
            else:
                started_runs.add(identifier)
            emit("run_started" if identifier == root_id else "native_event", line, event,
                 native_run_id=identifier)
        elif kind == "tool.call":
            identifier = _identifier(event, "callId")
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Native tool call has no open message at line {line}")
            if identifier is None or identifier in calls:
                diagnostics.append(f"Missing or duplicate native tool call ID at line {line}")
            else:
                calls[identifier] = (line, event)
            emit("native_event", line, event)
        elif kind == "tool.result":
            identifier = _identifier(event, "callId")
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Native tool result has no open message at line {line}")
            if identifier not in calls or identifier in completed_calls:
                diagnostics.append(f"Unmatched or duplicate native tool result at line {line}")
                emit("native_event", line, event)
                continue
            completed_calls.add(identifier)
            call_line, call = calls[identifier]
            if call.get("messageId") != event.get("messageId"):
                diagnostics.append(f"Native tool message correlation differs at line {line}")
            if "result" not in event or event["result"] is None:
                diagnostics.append(f"Native tool result value is absent at line {line}")
            if not isinstance(event.get("isError"), bool):
                diagnostics.append(f"Native tool result lacks a boolean isError at line {line}")
            native_result = event.get("result")
            projected_result = dict(native_result) if isinstance(native_result, dict) else {"value": native_result}
            derived_fields = {} if isinstance(native_result, dict) else {"value": "raw_event.result"}
            if "tool_call_id" in projected_result:
                if projected_result["tool_call_id"] != identifier:
                    diagnostics.append(f"Native payload tool_call_id conflicts with transport callId at line {line}")
            else:
                projected_result["tool_call_id"] = identifier
                derived_fields["tool_call_id"] = "raw_event.callId"
            emit("tool", line, event,
                 tool_call={"tool_call_id": identifier, "tool_name": call.get("toolName"),
                            "arguments": call.get("args")},
                 tool_result=projected_result, native_tool_result=native_result,
                 tool_result_projection={"version": TOOL_RESULT_PROJECTION_VERSION,
                                         "derived_fields": derived_fields},
                 source_lines=[call_line, line],
                 native_call_source={"path": str(source_events.resolve()), "line": call_line},
                 native_tool_call=call)
        elif kind == "message.start":
            identifier = _identifier(event, "messageId")
            if identifier is None or identifier in messages:
                diagnostics.append(f"Missing or duplicate message.start at line {line}")
            else:
                messages[identifier] = {"parts": {}, "part_states": {}, "lines": [line], "closed": False}
            emit("native_event", line, event)
        elif kind in {"part.start", "part.delta", "part.end"}:
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Unmatched native message part at line {line}")
            else:
                index = event.get("partIndex")
                valid_index = isinstance(index, int) and not isinstance(index, bool) and index >= 0
                if not valid_index:
                    diagnostics.append(f"Invalid native part index at line {line}")
                else:
                    state = message["part_states"].get(index)
                    if kind == "part.start":
                        part = event.get("part")
                        if state is not None:
                            diagnostics.append(f"Duplicate native part.start at line {line}")
                        elif not isinstance(part, dict) or not isinstance(part.get("type"), str):
                            diagnostics.append(f"Invalid native part.start at line {line}")
                        else:
                            message["part_states"][index] = {
                                "streaming": part["type"] in {"text", "thinking", "code"}, "closed": False,
                                "snapshot_text": part["type"] == "text" and isinstance(part.get("content"), str)
                                                 and bool(part["content"]), "has_delta": False}
                    elif state is None:
                        diagnostics.append(f"Native part event has no matching start at line {line}")
                    elif kind == "part.end":
                        if state["closed"]:
                            diagnostics.append(f"Duplicate native part.end at line {line}")
                        state["closed"] = True
                    elif state["closed"] and state["streaming"]:
                        diagnostics.append(f"Native streaming part delta follows its end at line {line}")
                    if kind == "part.delta" and state is not None:
                        state["has_delta"] = True
                if valid_index and kind == "part.start" and isinstance(event.get("part"), dict) and event["part"].get("type") == "text":
                    content = event["part"].get("content")
                    if index in message["parts"] or not isinstance(content, str):
                        diagnostics.append(f"Invalid or duplicate native text part.start at line {line}")
                    else:
                        message["parts"][index] = content
                elif valid_index and kind == "part.delta" and isinstance(event.get("delta"), dict) and event["delta"].get("type") == "text.append":
                    if index not in message["parts"]:
                        diagnostics.append(f"Text delta without native text part.start at line {line}")
                    text = event["delta"].get("text")
                    if isinstance(text, str):
                        message["parts"][index] = message["parts"].get(index, "") + text
                    else:
                        diagnostics.append(f"Native text delta is not a string at line {line}")
                message["lines"].append(line)
            emit("native_event", line, event)
        elif kind == "message.end":
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Unmatched or duplicate native message.end at line {line}")
                emit("native_event", line, event)
            else:
                if any(part["streaming"] and not part["closed"]
                       and not (part["snapshot_text"] and not part["has_delta"])
                       for part in message["part_states"].values()):
                    diagnostics.append(f"Native message closes with an open streaming part at line {line}")
                message["closed"] = True
                content = "".join(text for _, text in sorted(message["parts"].items()))
                if content:
                    emit("assistant_message", line, event, content=content,
                         message_id=event.get("messageId"), content_kind="text",
                         source_lines=[*message["lines"], line],
                         native_part_lines=message["lines"])
                else:
                    emit("native_event", line, event)
        elif kind == "run.end":
            identifier = _identifier(event, "runId")
            if event.get("status") == "complete" and event.get("error"):
                diagnostics.append(f"Native complete run carries an error at line {line}")
            if identifier not in started_runs or identifier in ended_runs:
                diagnostics.append(f"Unmatched or duplicate native run.end at line {line}")
            if identifier is not None:
                ended_runs.add(identifier)
                run_statuses[identifier] = event.get("status")
            if identifier == root_id:
                root_ends.append(event)
                if event.get("status") != "complete":
                    emit("run_failed", line, event, error_type=result.get("terminationReason"),
                         error_message=event.get("error"))
                emit("run_finished", line, event, native_status=event.get("status"))
            else:
                emit("native_event", line, event)
        else:
            emit("native_event", line, event)

    if set(calls) != completed_calls:
        diagnostics.append("Native tool calls remain without a matching result")
    if any(not message["closed"] for message in messages.values()):
        diagnostics.append("Native messages remain open")
    if len(root_ends) != 1 or started_runs != ended_runs:
        diagnostics.append("Native run lifecycle is not closed")
    if result.get("allRunsSettled") is not True:
        diagnostics.append("Native result does not confirm allRunsSettled")
    if result.get("rootRunIds") != [root_id]:
        diagnostics.append("Native result rootRunIds do not match the event root")
    if result.get("runStatus") == "complete" and (
            result.get("terminationReason") != "completed" or result.get("budgetExhausted") is True
            or result.get("error") or result.get("timedOut") is True):
        diagnostics.append("Native result completion contradicts its termination evidence")
    result_runs = result.get("runs")
    if not isinstance(result_runs, list) or any(not isinstance(run, dict) for run in result_runs):
        diagnostics.append("Native result runs is not a list of run objects")
    else:
        result_statuses = {_identifier(run, "runId"): run.get("status") for run in result_runs}
        if len(result_statuses) != len(result_runs) or result_statuses != run_statuses:
            diagnostics.append("Native result run statuses do not match the events")
    if not writer.events or writer.events[0]["event_type"] != "run_started" or writer.events[-1]["event_type"] != "run_finished":
        diagnostics.append("Canonical actor lifecycle lacks native start/end boundaries")
    native_complete = len(root_ends) == 1 and root_ends[0].get("status") == "complete"
    exit_code = actor_metadata.get("exit_code")
    timed_out = actor_metadata.get("timed_out") is True or result.get("timedOut") is True
    finished = (not diagnostics and native_complete and result.get("runStatus") == "complete"
                and type(exit_code) is int and exit_code == 0 and not timed_out
                and result.get("terminationReason") == "completed" and not result.get("error")
                and result.get("budgetExhausted") is not True)
    # A native end alone cannot establish completeness before all evidence is validated.
    for event in writer.events:
        if event["event_type"] == "run_finished":
            event["trace_complete"] = finished
    writer.close()
    end_ms = root_ends[-1].get("timestamp") if root_ends else None
    duration_ms = end_ms - start_ms if _timestamp(end_ms) and _timestamp(start_ms) else None
    summary = build_summary(
        writer=writer, run_id=run_id, run_dir=trace_dir.resolve(), harness="agenthub",
        model=str(actor_metadata.get("model") or result.get("modelId") or "unknown"),
        input_query=task.prompt, status="finished" if finished else "failed",
        trace_complete=finished, structured_trace_status="available" if not diagnostics else "partial",
        exit_code=exit_code, timed_out=timed_out,
        error_type=None if finished else ("normalization_incomplete" if diagnostics else result.get("terminationReason") or "actor_failed"),
        error_message="; ".join(diagnostics) or result.get("error"),
        started_at=actor_metadata.get("started_at") or _timestamp(start_ms),
        finished_at=actor_metadata.get("finished_at") or _timestamp(end_ms),
        duration_ms=duration_ms, session_id=None, cwd=actor_metadata.get("cwd"),
        argv=[], environment={}, summary_path=(trace_dir / "summary.json").resolve(),
    )
    summary["agenthub_native_sources"] = {
        "events": str(source_events.resolve()), "result": str(source_result.resolve()),
        "events_sha256": hashlib.sha256(event_data).hexdigest() if event_data is not None else None,
        "result_sha256": hashlib.sha256(result_data).hexdigest() if result_data is not None else None,
    }
    summary["agenthub_normalization_diagnostics"] = diagnostics
    summary["agenthub_normalization_observations"] = observations
    summary["agenthub_actor_usage"] = result.get("usage")
    summary["agenthub_input_prelude_sources"] = prelude
    summary["agenthub_native_termination_reason"] = result.get("terminationReason")
    summary["agenthub_tool_result_projection_version"] = TOOL_RESULT_PROJECTION_VERSION
    _write_json(trace_dir / "summary.json", summary)
    return summary


def emit_execution_evidence(task, layout, summary):
    required = list(task.execution_probe.requires) if task.execution_probe is not None else []
    available = capabilities_for_task(task.task_id)
    capability = {
        "schema_version": "harnessbench_execution_capabilities_v1", "harness": "agenthub",
        "probe_version": task.execution_probe.version if task.execution_probe is not None else None,
        "required": required, "available": list(available),
        "missing": [name for name in required if name not in available],
        "default_path_unchanged": task.execution_probe is None,
    }
    capability["compatible"] = not capability["missing"]
    if task.task_id in PROCESS_OBSERVED_TASK_IDS:
        receipt, source = _process_receipt_source(layout)
        if 'process_containment' in summary or 'agenthub_process_containment_source' in summary:
            raise ValueError('AgentHub process containment summary already contains competing receipt evidence')
        summary['process_containment'] = receipt
        summary['agenthub_process_containment_source'] = source
    directory = layout.artifacts_dir / "execution_probe"
    directory.mkdir(parents=True, exist_ok=True)
    _write_json(directory / "capabilities.json", capability)
    if not capability["compatible"]:
        raise ValueError("AgentHub trace adapter lacks required capabilities: " + ", ".join(capability["missing"]))
    evidence = persist_execution_probe_evidence(task, harness="agenthub", layout=layout,
                                              trace_summary=summary, capability=capability)
    if task.task_id == TIMEOUT_TASK_ID:
        if evidence is None:
            raise ValueError('E6 timeout observer apparatus did not produce official helper evidence')
        _project_timeout_observations(Path(evidence), summary)
    summary["execution_probe_evidence"] = evidence
    _write_json(layout.artifacts_dir / "trace" / "agenthub" / "summary.json", summary)
    return evidence

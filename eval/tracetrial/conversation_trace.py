import hashlib
import json
from dataclasses import replace
from pathlib import Path

from harness_tracer.summary import build_summary
from harness_tracer.writer import EventWriter


PROJECTION_VERSION = 'agenthub_transport_v3'
LEDGER_VERSION = 'agenthub_conversation_turns_v1'
EXECUTION_FIELDS = ('runStatus', 'terminationReason', 'rootRunIds', 'runs', 'allRunsSettled',
                    'timedOut', 'budgetExhausted', 'error')


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _equal(left, right):
    return json.dumps(left, sort_keys=True, separators=(',', ':'), allow_nan=False) == json.dumps(
        right, sort_keys=True, separators=(',', ':'), allow_nan=False)


def _integer(value, minimum=0):
    return type(value) is int and value >= minimum


def _text(message):
    parts = message.get('parts')
    if not isinstance(parts, list) or any(not isinstance(part, dict) for part in parts):
        return None
    if any(part.get('type') != 'text' or not isinstance(part.get('content'), str) for part in parts):
        return None
    return ''.join(part['content'] for part in parts)


def _project_content(event, diagnostics):
    if event.get('event_type') != 'tool' or event.get('tool_call', {}).get('tool_name') != 'bash':
        return
    native = event.get('native_tool_result')
    if not isinstance(native, dict) or not isinstance(native.get('output'), str):
        return
    result = event['tool_result']
    metadata = event['tool_result_projection']
    metadata['version'] = PROJECTION_VERSION
    if 'content' in result:
        if not _equal(result['content'], native['output']):
            diagnostics.append('Native Bash content conflicts with its merged output')
        return
    result['content'] = native['output']
    metadata['derived_fields']['content'] = 'raw_event.result.output'


def _source(path, data):
    return {'path': str(path.resolve()), 'sha256': _sha(data) if data is not None else None}


def normalize_conversation_trace(*, task, layout, native_events_path, native_result_path, actor_metadata):
    from .trace_adapter import _archive_source, _normalize_single_trace, _read_events, _timestamp, _write_json

    directory = layout.artifacts_dir / 'trace/run-agenthub-conversation'
    directory.mkdir(parents=True, exist_ok=False)
    diagnostics, observations = [], []
    events_path, result_path = directory / 'source-events.jsonl', directory / 'source-result.json'
    ledger_path = directory / 'source-conversation-turns.jsonl'
    event_data = _archive_source(Path(native_events_path), events_path, diagnostics)
    result_data = _archive_source(Path(native_result_path), result_path, diagnostics)
    ledger_data = _archive_source(Path(native_events_path).parent / 'conversation-turns.jsonl', ledger_path, diagnostics)
    native = _read_events(event_data, diagnostics)
    ledger = _read_events(ledger_data, diagnostics)
    try:
        result = json.loads(result_data or b'{}')
        if type(result) is not dict:
            raise ValueError('result object required')
    except (UnicodeError, ValueError):
        result = {}
        diagnostics.append('Native conversation result is not an object')
    turns_path = Path(task.conversation.turns_path)
    turns_data = turns_path.read_bytes()
    turns_payload = json.loads(turns_data)
    turns = turns_payload.get('turns') if isinstance(turns_payload, dict) else None
    if (type(turns) is not list or len(turns) != 10 or any(type(turn) is not str for turn in turns)
            or turns[0] != task.prompt):
        raise ValueError('E2 canonical normalization requires its ten original messages')
    hashes = [_sha(turn.encode('utf-8')) for turn in turns]
    conversation_id = result.get('conversationId')
    if not isinstance(conversation_id, str) or not conversation_id:
        diagnostics.append('Native result has no conversation identity')
    run_id = 'run-agenthub-conversation'
    writer = EventWriter(directory / 'events.json', run_id=run_id)
    raw_lines = event_data.splitlines(keepends=True) if event_data is not None else []
    starts, ends = {}, {}
    first, last = None, None

    def require(condition, detail):
        if not condition:
            diagnostics.append(detail)
        return bool(condition)

    def controller(kind, record):
        line, row = record
        payload = {key: value for key, value in row.items() if key not in ('type', 'schemaVersion', 'timestamp')}
        writer.write(kind, timestamp=_timestamp(row.get('timestamp')), source='agenthub.eval-controller',
            controller_schema=LEDGER_VERSION, raw_event=row,
            source_refs=[{'path': str(ledger_path.resolve()), 'line': line}], **payload)

    expected_type, expected_index = 'conversation.start', 1
    for record in ledger:
        line, row = record
        kind, index = row.get('type'), row.get('index')
        require(row.get('schemaVersion') == 1 and type(row.get('schemaVersion')) is int
                and _timestamp(row.get('timestamp')) is not None, f'Invalid controller receipt schema/time at line {line}')
        require(kind == expected_type or kind == 'conversation.end' and expected_type == 'turn.start',
                f'Controller receipt order differs at line {line}')
        if kind == 'conversation.start':
            require(first is None and line == 1, 'Duplicate or misplaced conversation.start')
            if first is None:
                first = record
            require(row.get('conversationId') == conversation_id and type(row.get('plannedTurns')) is int
                    and row['plannedTurns'] == 10
                    and _equal(row.get('inputSha256'), hashes), 'Conversation start differs from original inputs/identity')
            expected_type = 'turn.start'
        elif kind == 'turn.start':
            require(_integer(index, 1) and index <= 10 and index == expected_index,
                    f'Invalid or reordered turn.start index at line {line}')
            if _integer(index, 1) and index <= 10:
                require(index not in starts, f'Duplicate turn.start for {index}')
                starts.setdefault(index, record)
                require(row.get('instructionSha256') == hashes[index - 1], f'Turn {index} input hash differs')
            expected_type = 'turn.end'
        elif kind == 'turn.end':
            require(_integer(index, 1) and index <= 10 and index == expected_index,
                    f'Invalid or reordered turn.end index at line {line}')
            if _integer(index, 1) and index <= 10:
                require(index not in ends, f'Duplicate turn.end for {index}')
                ends.setdefault(index, record)
                require(row.get('instructionSha256') == hashes[index - 1], f'Turn {index} end input hash differs')
            expected_index += 1
            expected_type = 'turn.start'
        elif kind == 'conversation.end':
            require(last is None and record == ledger[-1], 'Duplicate or misplaced conversation.end')
            last = record if last is None else last
            require(expected_type == 'turn.start', 'Conversation ended with an open turn receipt')
            require(row.get('conversationId') == conversation_id and type(row.get('plannedTurns')) is int
                    and row['plannedTurns'] == 10,
                    'Conversation end identity or plan differs')
            expected_type = None
        else:
            require(False, f'Unknown controller receipt at line {line}')
    require(first is not None and last is not None, 'Controller conversation boundaries are missing')
    require(set(starts) == set(ends) and sorted(starts) == list(range(1, len(starts) + 1)),
            'Turn receipts are missing, duplicated or noncontiguous')
    if first is not None:
        controller('conversation_started', first)
    seen_users, seen_runs, seen_calls, seen_messages = set(), set(), set(), set()
    next_line, completed = 1, 0
    all_runs, roots, turn_summaries = [], [], []
    previous_completed = True
    for index in sorted(starts):
        turn_diagnostic_start = len(diagnostics)
        start_record, end_record = starts[index], ends.get(index)
        controller('conversation_turn_started', start_record)
        if end_record is None:
            continue
        begin, finish = start_record[1], end_record[1]
        require(previous_completed, f'Turn {index} was submitted after a non-completed turn')
        lower, upper = begin.get('nativeEventStartLine'), finish.get('nativeEventEndLine')
        valid_range = (_integer(lower, 1) and _integer(upper) and lower == next_line and lower <= upper + 1
                       and upper <= len(raw_lines) and type(finish.get('nativeEventStartLine')) is int
                       and finish['nativeEventStartLine'] == lower)
        require(valid_range, f'Turn {index} native line range overlaps, skips or exceeds its source')
        if not valid_range:
            controller('conversation_turn_finished', end_record)
            previous_completed = False
            continue
        next_line = upper + 1
        subset = [(line, event) for line, event in native if lower <= line <= upper]
        users = [(line, event['message']) for line, event in subset if event.get('type') == 'message.added'
                 and isinstance(event.get('message'), dict) and event['message'].get('role') == 'user']
        user_id = finish.get('userMessageId')
        user_ok = (len(users) == 1 and isinstance(user_id, str) and bool(user_id) and user_id not in seen_users
                   and users[0][1].get('id') == user_id and _text(users[0][1]) == turns[index - 1])
        require(user_ok, f'Turn {index} submitted user message is missing, repeated or differs from the original')
        if isinstance(user_id, str):
            seen_users.add(user_id)
        turn_roots = [(line, event) for line, event in subset
                      if event['type'] == 'run.start' and not event.get('parentRunId')]
        root_ids = finish.get('rootRunIds')
        root_ok = (type(root_ids) is list and len(root_ids) == 1 and len(turn_roots) == 1
                   and root_ids == [turn_roots[0][1].get('runId')]
                   and turn_roots[0][1].get('triggerMessageId') == user_id
                   and len(users) == 1 and users[0][0] < turn_roots[0][0])
        require(root_ok, f'Turn {index} root/trigger identity differs from its submitted message')
        identifiers = {'run.start': ('runId', seen_runs), 'tool.call': ('callId', seen_calls),
                       'message.start': ('messageId', seen_messages)}
        current_runs = {event['runId'] for _, event in subset
                        if event['type'] == 'run.start' and isinstance(event.get('runId'), str)}
        current_messages = {event['messageId'] for _, event in subset
                            if event['type'] == 'message.start' and isinstance(event.get('messageId'), str)}
        for line, event in subset:
            require(event.get('conversationId', conversation_id) == conversation_id,
                    f'Native conversation identity differs at line {line}')
            if event['type'] in identifiers:
                key, seen = identifiers[event['type']]
                value = event.get(key)
                require(isinstance(value, str) and bool(value) and value not in seen,
                        f'Native {key} is missing or collides at line {line}')
                if isinstance(value, str):
                    seen.add(value)
            if event.get('runId') is not None:
                require(event['runId'] in current_runs, f'Late or foreign native run event at line {line}')
            if event.get('messageId') is not None:
                require(event['messageId'] in current_messages, f'Late or foreign native message event at line {line}')
        validation_dir = layout.artifacts_dir / 'agenthub_conversation_validation' / f'turn-{index:02d}'
        validation_dir.mkdir(parents=True, exist_ok=False)
        validation_events, validation_result = validation_dir / 'events.jsonl', validation_dir / 'result.json'
        validation_events.write_bytes(b''.join(raw_lines[lower - 1:upper]))
        execution = {key: finish[key] for key in EXECUTION_FIELDS if key in finish}
        execution.update(modelId=result.get('modelId'), conversationId=conversation_id,
            agenthub_controller_source={'path': str(ledger_path.resolve()), 'line': end_record[0],
                                        'sha256': _sha(ledger_data) if ledger_data is not None else None})
        _write_json(validation_result, execution)
        validation = _normalize_single_trace(task=replace(task, prompt=turns[index - 1]),
            layout=replace(layout, artifacts_dir=validation_dir),
            native_events_path=validation_events, native_result_path=validation_result,
            actor_metadata={'model': actor_metadata.get('model'), 'exit_code': None,
                            'timed_out': finish.get('timedOut') is True, 'cwd': actor_metadata.get('cwd')},
            require_process_success=False)
        diagnostics.extend(f'Turn {index}: {message}' for message in validation['agenthub_normalization_diagnostics'])
        observations.extend(validation.get('agenthub_normalization_observations', []))
        original_canonical = json.loads(Path(validation['events_path']).read_text())
        for event in original_canonical:
            event = json.loads(json.dumps(event))
            for reference in event.get('source_refs', []):
                reference.update(path=str(events_path.resolve()), line=reference['line'] + lower - 1)
            if 'native_call_source' in event:
                event['native_call_source'].update(path=str(events_path.resolve()),
                    line=event['native_call_source']['line'] + lower - 1)
            for key in ('native_part_lines',):
                if key in event:
                    event[key] = [line + lower - 1 for line in event[key]]
            _project_content(event, diagnostics)
            kind = event.pop('event_type')
            for key in ('schema_version', 'seq', 'run_id', 'trace_complete'):
                event.pop(key, None)
            writer.write('native_event' if kind in ('run_started', 'run_finished', 'run_failed') else kind,
                         conversation_turn=index, **event)
        turn_diagnostics = diagnostics[turn_diagnostic_start:]
        normal = (not turn_diagnostics and validation['trace_complete'] is True and user_ok and root_ok
                  and finish.get('runStatus') == 'complete' and finish.get('terminationReason') == 'completed'
                  and finish.get('allRunsSettled') is True and finish.get('timedOut') is False
                  and finish.get('budgetExhausted') is False and not finish.get('error'))
        completed += int(normal)
        previous_completed = normal
        if isinstance(root_ids, list):
            roots.extend(root_ids)
        if isinstance(finish.get('runs'), list):
            all_runs.extend(finish['runs'])
        turn_summaries.append({'index': index, 'complete': normal, 'diagnostics': turn_diagnostics,
            'summary_path': validation['summary_path'],
            'controller_source': {'path': str(ledger_path.resolve()), 'start_line': start_record[0], 'end_line': end_record[0]}})
        controller('conversation_turn_finished', end_record)
    require(next_line == len(raw_lines) + 1, 'Native events exist outside the attempted turn ranges')
    require(_equal(result.get('rootRunIds'), roots) and _equal(result.get('runs'), all_runs),
            'Aggregate root/run status differs from turn receipts')
    expected_conversation = {'plannedTurns': 10, 'completedTurns': completed, 'attemptedTurns': len(starts)}
    require(_equal(result.get('conversation'), expected_conversation), 'Aggregate conversation counts differ from validated turns')
    if last is not None:
        final = last[1]
        require(type(final.get('completedTurns')) is int and type(final.get('attemptedTurns')) is int
                and final['completedTurns'] == completed and final['attemptedTurns'] == len(starts),
                'Controller final counts differ from validated turns')
        for key in ('runStatus', 'terminationReason', 'allRunsSettled'):
            require(_equal(final.get(key), result.get(key)), 'Controller final ' + key + ' differs from native result')
    complete = (not diagnostics and completed == 10 and len(starts) == 10 and result.get('runStatus') == 'complete'
                and result.get('terminationReason') == 'completed' and result.get('allRunsSettled') is True
                and result.get('timedOut') is False and result.get('budgetExhausted') is False
                and not result.get('error') and type(actor_metadata.get('exit_code')) is int
                and actor_metadata['exit_code'] == 0 and actor_metadata.get('timed_out') is not True)
    if last is not None:
        controller('conversation_finished', last)
        writer.write('run_finished', source='agenthub.eval-controller', timestamp=_timestamp(last[1].get('timestamp')),
            raw_event=last[1], source_refs=[{'path': str(ledger_path.resolve()), 'line': last[0]}],
            controller_schema=LEDGER_VERSION, trace_complete=complete, exit_code=actor_metadata.get('exit_code'))
    writer.close()
    error_type = ('normalization_incomplete' if diagnostics else result.get('terminationReason')
                  if result.get('terminationReason') != 'completed' else 'actor_process_incomplete')
    summary = build_summary(writer=writer, run_id=run_id, run_dir=directory.resolve(), harness='agenthub',
        model=str(actor_metadata.get('model') or result.get('modelId') or 'unknown'), input_query=task.prompt,
        status='finished' if complete else 'failed', trace_complete=complete,
        structured_trace_status='partial' if diagnostics else 'available', exit_code=actor_metadata.get('exit_code'),
        timed_out=result.get('timedOut') is True or actor_metadata.get('timed_out') is True,
        error_type=None if complete else error_type, error_message='; '.join(diagnostics) or result.get('error'),
        started_at=actor_metadata.get('started_at'), finished_at=actor_metadata.get('finished_at'),
        duration_ms=result.get('wallMs'), session_id=conversation_id, cwd=actor_metadata.get('cwd'), argv=[], environment={},
        summary_path=(directory / 'summary.json').resolve())
    summary.update(conversation={'mode': 'fixed_turns', 'turns_completed': completed, 'turns_attempted': len(starts),
                    'planned_turns': 10, 'max_turns': task.max_turns, 'native_session_id': conversation_id,
                    'turn_summaries': turn_summaries}, agenthub_native_sources={
        'events': str(events_path.resolve()), 'events_sha256': _sha(event_data) if event_data is not None else None,
        'result': str(result_path.resolve()), 'result_sha256': _sha(result_data) if result_data is not None else None},
        agenthub_conversation_sources={'ledger': _source(ledger_path, ledger_data),
                                      'original_turns': _source(turns_path, turns_data)},
        agenthub_normalization_diagnostics=diagnostics, agenthub_normalization_observations=observations,
        agenthub_native_termination_reason=result.get('terminationReason'), agenthub_actor_usage=result.get('usage'),
        agenthub_tool_result_projection_version=PROJECTION_VERSION)
    _write_json(directory / 'summary.json', summary)
    return summary

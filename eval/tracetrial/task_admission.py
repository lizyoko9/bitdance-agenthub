import json
from tracetrial_bench.score_config import load_score_sheet

from .container_worker import (ACTOR_CEILINGS, APPROVED_TASK_IDS, GOVERNANCE_TASK_ID,
                              MODEL, REQUEST_CEILINGS, validate_actor_request)
from .judge import MAX_JUDGE_REQUESTS
from .trace_adapter import CAPABILITIES


def actor_request(task):
    return validate_actor_request({'taskId': task.task_id, 'instruction': task.prompt,
        'cwd': '/workspace', 'group': 'single', 'modelId': MODEL,
        'timeoutMs': min(ACTOR_CEILINGS['timeoutMs'], task.max_wall_time_sec * 1000),
        'maxTurns': ACTOR_CEILINGS['maxTurns'],
        'maxToolCalls': min(ACTOR_CEILINGS['maxToolCalls'], task.max_tool_calls),
        'requestLimits': dict(REQUEST_CEILINGS), 'outputDir': '/state/trial'})


def actor_settings(request, task, runtime):
    declared_protocol = task.metadata.get('execution', {}).get('protocol')
    return {'model': request['modelId'], 'reasoningEffort': 'none', 'userTurns': 1,
        'taskUserTurnCeiling': task.max_turns, 'maxTurns': request['maxTurns'],
        'maxToolCalls': request['maxToolCalls'], **request['requestLimits'],
        'timeoutSeconds': request['timeoutMs'] / 1000, 'sdkRetries': 0, 'redirects': 'error',
        'group': request['group'], 'networkMode': 'bridge',
        'declaredTaskBudget': {'maxUserTurns': task.max_turns, 'maxToolCalls': task.max_tool_calls,
                               'maxWallTimeSeconds': task.max_wall_time_sec},
        'declaredRuntime': {'timeoutSeconds': runtime.get('timeout_sec'), 'networkMode': runtime.get('network_mode')},
        'executionProfileMapping': {'declaredProtocol': declared_protocol,
            'declaredRuntimeSchema': runtime.get('schema_version'), 'executor': 'agenthub',
            'compatibleShape': 'single_turn_workspace', 'stockHarnessExecuted': False},
        'networkLimitation': 'Task forbids network access; OS bridge matches the pinned official container runner',
        'credentialStorage': 'stdin to root recorder memory; unprivileged actor child receives placeholder only'}


def unsupported(task_id, reasons):
    return {'schemaVersion': 1, 'taskId': task_id, 'status': 'unsupported', 'score': None,
            'reasons': reasons, 'modelCalls': 0}


def admit_task(task):
    report = unsupported(task.task_id, [])
    reasons = report['reasons']
    governance = task.task_id == GOVERNANCE_TASK_ID
    if task.task_id not in APPROVED_TASK_IDS or task.task_dir.name != task.task_id:
        reasons.append('task identity is outside the approved task allowlist')
    if task.conversation.mode != 'single_turn' or task.conversation.new_session_before_turns:
        reasons.append('only one original user prompt in a single-turn session is supported')
    if type(task.max_turns) is not int or task.max_turns < 1:
        reasons.append('task user-turn ceiling must permit one original user prompt')
    if governance and (any(type(value) is not int for value in (task.max_turns, task.max_tool_calls, task.max_wall_time_sec))
                       or (task.max_turns, task.max_tool_calls, task.max_wall_time_sec) != (12, 80, 1200)):
        reasons.append('governance task ceilings differ from the pinned 12-turn/80-tool/1200-second profile')
    if not governance and (type(task.max_tool_calls) is not int or not 0 < task.max_tool_calls <= ACTOR_CEILINGS['maxToolCalls']):
        reasons.append('task tool budget is outside the approved six-tool envelope')
    if not governance and (type(task.max_wall_time_sec) is not int or not 0 < task.max_wall_time_sec * 1000 <= ACTOR_CEILINGS['timeoutMs']):
        reasons.append('task wall-time budget is outside the approved 120-second envelope')
    for name in ('conversation_protocol', 'business_simulator', 'task_tools', 'model_call_budget',
                 'security_probe', 'native_instructions', 'container_resources'):
        if getattr(task, name) is not None:
            reasons.append('unsupported task setup: ' + name)
    required = list(task.execution_probe.requires) if task.execution_probe else []
    missing = [capability for capability in required if capability not in CAPABILITIES]
    if missing:
        reasons.append('missing execution capabilities: ' + ', '.join(missing))
    report['capabilities'] = {'required': required, 'available': list(CAPABILITIES), 'missing': missing}
    execution = task.metadata.get('execution', {})
    runtime = {}
    expected_protocol = 'openclaw_native_v1' if governance else 'native_v1'
    if (not isinstance(execution, dict) or execution.get('mode') != 'native'
            or execution.get('protocol') != expected_protocol or execution.get('profile') != 'runtime/execution.json'):
        reasons.append('unsupported task execution profile')
    else:
        path = task.task_dir / 'runtime/execution.json'
        try:
            runtime = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(runtime, dict):
                raise ValueError('runtime must be an object')
            if (runtime.get('schema_version') != expected_protocol or runtime.get('conversation') != 'single_turn'
                    or runtime.get('profile') != task.task_id or runtime.get('runnable') is not True
                    or runtime.get('network_mode') != 'none' or runtime.get('requires', [])):
                reasons.append('runtime requires unsupported setup, conversation or execution behavior')
        except (OSError, ValueError, UnicodeError):
            reasons.append('runtime profile is missing or invalid')
            runtime = {}
    report['declaredRuntime'] = runtime
    if task.scoring is None:
        reasons.append('official layered scoring configuration is required')
    else:
        try:
            sheets = [load_score_sheet(task.scoring.harness_score_path, expected_layer='harness'),
                      load_score_sheet(task.scoring.agent_score_path, expected_layer='agent')]
            rubrics = sum(len(sheet.rubric_items) for sheet in sheets)
            max_judge_requests = 0 if governance else MAX_JUDGE_REQUESTS
            report['judgeCoverage'] = {'rubrics': rubrics, 'maxRequests': max_judge_requests,
                                       'worstCaseRequests': rubrics * 2}
            if governance and rubrics:
                reasons.append('governance scoring must declare zero LLM rubrics')
            if rubrics * 2 > max_judge_requests:
                reasons.append('judge request allowance cannot cover one official correction per rubric')
        except (OSError, ValueError, UnicodeError):
            reasons.append('official score sheets are missing or invalid')
    if not reasons:
        request = actor_request(task)
        report.update(status='supported', effectiveActor=actor_settings(request, task, runtime))
        return report, request
    return report, None

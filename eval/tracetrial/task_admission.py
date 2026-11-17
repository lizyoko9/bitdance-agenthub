import json
from pathlib import Path
from tracetrial_bench.score_config import load_score_sheet

from .budget_contract import build_budget_plan, budget_plan_digest, conversation_from_turns, validate_budget_plan
from .container_worker import (APPROVED_TASK_IDS, MODEL, PROCESS_OBSERVED_TASK_IDS,
                               STDERR_TASK_ID, ZERO_RUBRIC_TASK_IDS, validate_actor_request)
from .judge import MAX_JUDGE_REQUESTS, judge_request_limits
from .trace_adapter import capabilities_for_task
from .workspace_setup import workspace_setup_plan


def task_conversation(task):
    if task.task_id != STDERR_TASK_ID:
        return None
    conversation = task.conversation
    path = Path(task.task_dir) / 'turns.json'
    if (conversation.mode != 'fixed_turns' or conversation.new_session_before_turns
            or conversation.new_session_context != 'none' or conversation.simulator_entrypoint is not None
            or path.is_symlink() or Path(conversation.turns_path).resolve() != path.resolve()):
        raise ValueError('E2 requires its original fixed-ten-turn no-reset conversation')
    payload = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(payload, dict) or set(payload) != {'turns'}:
        raise ValueError('E2 original turns file must contain only its ordered turns')
    turns = payload['turns']
    conversation_from_turns(turns)
    if turns[0] != task.prompt:
        raise ValueError('E2 first original turn differs from task.prompt')
    return {'mode': 'fixed_turns', 'turns': turns}


def task_budget_values(task):
    return {'maxUserTurns': task.max_turns, 'maxToolCalls': task.max_tool_calls,
            'maxWallTimeSeconds': task.max_wall_time_sec}


def resolve_task_budget_plan(task, budget_plan=None, *, mode='task', overrides=None):
    fixed = task_conversation(task)
    conversation = conversation_from_turns(fixed['turns']) if fixed else None
    if budget_plan is None:
        return build_budget_plan(task.task_id, task_budget_values(task), mode=mode, overrides=overrides,
                                 conversation=conversation)
    if mode != 'task' or overrides is not None:
        raise ValueError('An existing budget plan cannot be combined with plan-generation options')
    return validate_budget_plan(budget_plan, task_id=task.task_id, task_budget=task_budget_values(task),
                                conversation=conversation)


def actor_request(task, budget_plan=None, *, mode='task', overrides=None):
    plan = resolve_task_budget_plan(task, budget_plan, mode=mode, overrides=overrides)
    effective = plan['actor']
    fixed = task_conversation(task)
    return validate_actor_request({'taskId': task.task_id, 'instruction': task.prompt,
        'cwd': '/workspace', 'group': 'single', 'modelId': MODEL,
        'timeoutMs': effective['timeoutMs'], 'maxTurns': effective['maxTurns'],
        'maxToolCalls': effective['maxToolCalls'], 'requestLimits': dict(effective['requestLimits']),
        'outputDir': '/state/trial', **({'conversation': fixed} if fixed else {})}, plan)


def actor_settings(request, task, runtime, budget_plan=None):
    plan = resolve_task_budget_plan(task, budget_plan)
    validate_actor_request(request, plan)
    declared_protocol = task.metadata.get('execution', {}).get('protocol')
    settings = {'model': request['modelId'], 'reasoningEffort': 'none', 'userTurns': plan['actor']['userInputs'],
        'taskUserTurnCeiling': task.max_turns, 'maxTurns': request['maxTurns'],
        'maxToolCalls': request['maxToolCalls'], **request['requestLimits'],
        'timeoutSeconds': request['timeoutMs'] / 1000, 'sdkRetries': 0, 'redirects': 'error',
        'group': request['group'], 'networkMode': 'bridge',
        'declaredTaskBudget': dict(plan['taskBudget']),
        'budgetMode': plan['mode'], 'budgetPlanDigest': budget_plan_digest(plan),
        'budgetSources': plan['sources'], 'budgetCoverage': plan['coverage'],
        'declaredRuntime': {'timeoutSeconds': runtime.get('timeout_sec'), 'networkMode': runtime.get('network_mode')},
        'executionProfileMapping': {'declaredProtocol': declared_protocol,
            'declaredRuntimeSchema': runtime.get('schema_version'), 'executor': 'agenthub',
            'compatibleShape': 'fixed_turns_workspace' if task.task_id == STDERR_TASK_ID else 'single_turn_workspace',
            'stockHarnessExecuted': False},
        'networkLimitation': 'Task forbids network access; OS bridge matches the pinned official container runner',
        'credentialStorage': 'stdin to root recorder memory; unprivileged actor child receives placeholder only'}
    if task.task_id in PROCESS_OBSERVED_TASK_IDS:
        settings['processObservation'] = {'required': True, 'enabledByPolicy': True,
            'schema_version': 'agenthub-process-observation-v1', 'scope': 'isolated_container_pid_delta'}
    if task.task_id == STDERR_TASK_ID:
        settings.update(conversation={'mode': 'fixed_turns', 'plannedInputs': plan['actor']['userInputs'],
                                     'turnSha256': plan['conversation']['turnSha256']},
                        maxTurnsScope='per_run', sharedBudgetScope='trial')
    return settings

def unsupported(task_id, reasons):
    return {'schemaVersion': 1, 'taskId': task_id, 'status': 'unsupported', 'score': None,
            'reasons': reasons, 'modelCalls': 0}


def admit_task(task, *, budget_plan=None, mode='task', overrides=None, workspace_setup_policy=None):
    report = unsupported(task.task_id, [])
    reasons = report['reasons']
    fixed = task.task_id == STDERR_TASK_ID
    zero_rubric = task.task_id in ZERO_RUBRIC_TASK_IDS
    if task.task_id not in APPROVED_TASK_IDS or task.task_dir.name != task.task_id:
        reasons.append('task identity is outside the approved task allowlist')
    if (task.conversation.mode != ('fixed_turns' if fixed else 'single_turn')
            or task.conversation.new_session_before_turns):
        reasons.append('E2 requires its original fixed-ten-turn no-reset conversation' if fixed
                       else 'only one original user prompt in a single-turn session is supported')
    plan = None
    try:
        plan = resolve_task_budget_plan(task, budget_plan, mode=mode, overrides=overrides)
        report.update(budgetPlan=plan, budgetPlanDigest=budget_plan_digest(plan))
    except (OSError, ValueError, TypeError) as error:
        reasons.append('unsupported or conflicting budget plan: ' + str(error))
    try:
        setup = workspace_setup_plan(task, workspace_setup_policy)
        if setup is not None:
            report['workspaceSetup'] = setup
    except (OSError, ValueError) as error:
        reasons.append('unsupported workspace setup: ' + str(error))
    for name in ('conversation_protocol', 'business_simulator', 'task_tools', 'model_call_budget',
                 'security_probe', 'native_instructions', 'container_resources'):
        if getattr(task, name) is not None:
            reasons.append('unsupported task setup: ' + name)
    required = list(task.execution_probe.requires) if task.execution_probe else []
    available = capabilities_for_task(task.task_id)
    missing = [capability for capability in required if capability not in available]
    if missing:
        reasons.append('missing execution capabilities: ' + ', '.join(missing))
    report['capabilities'] = {'required': required, 'available': list(available), 'missing': missing}
    execution = task.metadata.get('execution', {})
    runtime = {}
    expected_protocol = 'openclaw_native_v1' if zero_rubric else 'native_v1'
    if (not isinstance(execution, dict) or execution.get('mode') != 'native'
            or execution.get('protocol') != expected_protocol or execution.get('profile') != 'runtime/execution.json'):
        reasons.append('unsupported task execution profile')
    else:
        path = task.task_dir / 'runtime/execution.json'
        try:
            runtime = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(runtime, dict):
                raise ValueError('runtime must be an object')
            if (runtime.get('schema_version') != expected_protocol
                    or runtime.get('conversation') != ('multi_turn' if fixed else 'single_turn')
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
            max_judge_requests = 0 if zero_rubric else MAX_JUDGE_REQUESTS
            report['judgeCoverage'] = {'rubrics': rubrics, 'maxRequests': max_judge_requests,
                                       'worstCaseRequests': rubrics * 2}
            report['judgeLimits'] = {**judge_request_limits(task.task_id), 'maxRequests': max_judge_requests}
            if zero_rubric and rubrics:
                reasons.append('governance/E2 scoring must declare zero LLM rubrics')
            if fixed and (len(sheets[0].rule_items) != 15 or len(sheets[1].rule_items) != 18):
                reasons.append('E2 requires the pinned fifteen/eighteen deterministic rules')
            if rubrics * 2 > max_judge_requests:
                reasons.append('judge request allowance cannot cover one official correction per rubric')
        except (OSError, ValueError, UnicodeError):
            reasons.append('official score sheets are missing or invalid')
    if not reasons:
        request = actor_request(task, plan)
        report.update(status='supported', effectiveActor=actor_settings(request, task, runtime, plan))
        return report, request
    return report, None

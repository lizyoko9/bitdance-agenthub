import hashlib
import json
import re


SCHEMA_VERSION = 2
FIXED_TURN_SCHEMA_VERSION = 3
STDERR_TASK_ID = 'E2-shard-stderr-003'
MAX_TIMER_MS = 2_147_483_647
MAX_SAFE_INTEGER = 9_007_199_254_740_991
TECHNICAL_LIMITS = {'timeoutMs': MAX_TIMER_MS, 'maxToolCalls': 10_000,
    'maxTurns': 10_000, 'maxRequests': 1000, 'maxRequestBytes': 256 * 1024,
    'maxTotalRequestBytes': 64 * 1024 * 1024, 'maxCompletionTokens': 8192}
RESOURCE_DEFAULTS = {'maxRequestBytes': 256 * 1024, 'maxCompletionTokens': 8192}
TASK_KEYS = {'maxUserTurns', 'maxToolCalls', 'maxWallTimeSeconds'}
PLAN_KEYS = {'schemaVersion', 'taskId', 'mode', 'taskBudget', 'overrides', 'actor', 'sources', 'coverage'}


def conversation_from_turns(turns):
    if (not isinstance(turns, list) or len(turns) != 10
            or any(not isinstance(value, str) or not value.strip() or len(value) > 262144 for value in turns)):
        raise ValueError('E2 conversation requires exactly ten nonempty original inputs')
    try:
        hashes = [hashlib.sha256(value.encode('utf-8')).hexdigest() for value in turns]
    except UnicodeError as error:
        raise ValueError('E2 conversation inputs must be valid UTF-8') from error
    return {'mode': 'fixed_turns', 'turnSha256': hashes}


def _conversation(value, task_id, task):
    if value is None:
        if task_id == STDERR_TASK_ID:
            raise ValueError('E2 requires a source-bound fixed-turn conversation')
        return None
    if (task_id != STDERR_TASK_ID or not isinstance(value, dict) or set(value) != {'mode', 'turnSha256'}
            or value['mode'] != 'fixed_turns' or not isinstance(value['turnSha256'], list)
            or len(value['turnSha256']) != 10 or len(value['turnSha256']) > task['maxUserTurns']
            or any(not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest)
                   for digest in value['turnSha256'])):
        raise ValueError('Unsupported fixed-turn conversation budget metadata')
    return {'mode': 'fixed_turns', 'turnSha256': list(value['turnSha256'])}


def _integer(value, name, maximum):
    if type(value) is not int or not 1 <= value <= maximum:
        raise ValueError(f'Unsupported {name}: expected an integer in 1..{maximum}')
    return value


def _task_budget(value):
    if not isinstance(value, dict) or set(value) != TASK_KEYS:
        raise ValueError('Task budget must contain exactly maxUserTurns, maxToolCalls and maxWallTimeSeconds')
    return {'maxUserTurns': _integer(value['maxUserTurns'], 'task maxUserTurns', MAX_SAFE_INTEGER),
        'maxToolCalls': _integer(value['maxToolCalls'], 'task maxToolCalls', TECHNICAL_LIMITS['maxToolCalls']),
        'maxWallTimeSeconds': _integer(value['maxWallTimeSeconds'], 'task maxWallTimeSeconds', MAX_TIMER_MS // 1000)}


def _canonical(value):
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    except (TypeError, ValueError) as error:
        raise ValueError('Budget plan must contain only canonical JSON values') from error


def build_budget_plan(task_id, task_budget, *, mode='task', overrides=None, conversation=None):
    if not isinstance(task_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', task_id):
        raise ValueError('Budget task ID must be a nonempty plain task identifier')
    if mode not in ('task', 'constrained'):
        raise ValueError('Budget mode must be task or constrained')
    task = _task_budget(task_budget)
    fixed = _conversation(conversation, task_id, task)
    user_inputs = len(fixed['turnSha256']) if fixed else 1
    explicit = {} if overrides is None else overrides
    if not isinstance(explicit, dict) or not set(explicit) <= set(TECHNICAL_LIMITS):
        raise ValueError('Budget overrides must contain only supported flat actor limit names')
    explicit = {name: _integer(value, name, TECHNICAL_LIMITS[name]) for name, value in sorted(explicit.items())}
    sources = {'userInputs': {'kind': 'protocol', 'source': 'conversation.turnSha256.length'
                             if fixed else 'one_original_single_turn_prompt'}}

    def limit(name, default, kind, source):
        value = explicit.get(name, default)
        _integer(value, name, TECHNICAL_LIMITS[name])
        sources[name] = ({'kind': 'explicit_override', 'source': 'overrides.' + name} if name in explicit
                         else {'kind': kind, 'source': source})
        return value

    tools = limit('maxToolCalls', task['maxToolCalls'], 'task', 'taskBudget.maxToolCalls')
    timeout = limit('timeoutMs', task['maxWallTimeSeconds'] * 1000, 'task', 'taskBudget.maxWallTimeSeconds * 1000')
    if tools > task['maxToolCalls'] or timeout > task['maxWallTimeSeconds'] * 1000:
        raise ValueError('Effective tools and time cannot exceed the official task ceilings')
    if timeout % 1000:
        raise ValueError('Unsupported timeoutMs: budget plans require whole seconds for the official runner policy')
    turns = limit('maxTurns', tools + 1, 'derived',
                  'actor.maxToolCalls + 1 (per run)' if fixed else 'actor.maxToolCalls + 1')
    needed_requests = tools + user_inputs if fixed else turns
    requests = limit('maxRequests', needed_requests, 'derived',
                     'actor.maxToolCalls + actor.userInputs' if fixed else 'actor.maxTurns')
    request_bytes = limit('maxRequestBytes', RESOURCE_DEFAULTS['maxRequestBytes'], 'resource_guard_default',
                          'transport_policy.maxRequestBytes')
    total_bytes = limit('maxTotalRequestBytes', requests * request_bytes, 'derived',
                        'actor.requestLimits.maxRequests * actor.requestLimits.maxRequestBytes')
    output = limit('maxCompletionTokens', RESOURCE_DEFAULTS['maxCompletionTokens'], 'resource_guard_default',
                   'transport_policy.maxCompletionTokens')
    actor = {'userInputs': user_inputs, 'timeoutMs': timeout, 'maxToolCalls': tools, 'maxTurns': turns,
             'requestLimits': {'maxRequests': requests, 'maxRequestBytes': request_bytes,
                               'maxTotalRequestBytes': total_bytes, 'maxCompletionTokens': output}}
    required = {'maxToolCalls': (task['maxToolCalls'], tools),
                'timeoutMs': (task['maxWallTimeSeconds'] * 1000, timeout),
                'maxTurns': (tools + 1, turns), 'maxRequests': (needed_requests, requests),
                'maxTotalRequestBytes': (requests * request_bytes, total_bytes),
                'maxRequestBytes': (RESOURCE_DEFAULTS['maxRequestBytes'], request_bytes),
                'maxCompletionTokens': (RESOURCE_DEFAULTS['maxCompletionTokens'], output)}
    coverage = {name: {'required': needed, 'effective': effective, 'covered': effective >= needed}
                for name, (needed, effective) in required.items()}
    coverage['completeTaskTrajectory'] = all(row['covered'] for row in coverage.values())
    if mode == 'task' and not coverage['completeTaskTrajectory']:
        missing = ', '.join(name for name, row in coverage.items() if isinstance(row, dict) and not row['covered'])
        raise ValueError('Task-mode budget does not cover the complete task trajectory: ' + missing)
    return {'schemaVersion': FIXED_TURN_SCHEMA_VERSION if fixed else SCHEMA_VERSION,
            'taskId': task_id, 'mode': mode, 'taskBudget': task,
            'overrides': explicit, 'actor': actor, 'sources': sources, 'coverage': coverage,
            **({'conversation': fixed} if fixed else {})}


def validate_budget_plan(plan, *, task_id=None, task_budget=None, conversation=None):
    if not isinstance(plan, dict) or type(plan.get('schemaVersion')) is not int:
        raise ValueError('Budget plan fields or schema version are invalid')
    version = plan['schemaVersion']
    fields = PLAN_KEYS | {'conversation'} if version == FIXED_TURN_SCHEMA_VERSION else PLAN_KEYS
    if version not in (SCHEMA_VERSION, FIXED_TURN_SCHEMA_VERSION) or set(plan) != fields:
        raise ValueError('Budget plan fields or schema version are invalid')
    if task_id is not None and plan['taskId'] != task_id:
        raise ValueError('Budget plan task ID differs from the selected task')
    if task_budget is not None and _canonical(plan['taskBudget']) != _canonical(_task_budget(task_budget)):
        raise ValueError('Budget plan is stale: task ceilings differ from the current TaskSpec')
    if conversation is not None and _canonical(plan.get('conversation')) != _canonical(conversation):
        raise ValueError('Budget conversation differs from the original ordered inputs')
    rebuilt = build_budget_plan(plan['taskId'], plan['taskBudget'], mode=plan['mode'], overrides=plan['overrides'],
                                conversation=plan.get('conversation'))
    if _canonical(plan) != _canonical(rebuilt):
        raise ValueError('Budget plan does not reproduce its task, mode, overrides, sources and coverage')
    return rebuilt


def budget_plan_digest(plan):
    return hashlib.sha256(_canonical(validate_budget_plan(plan)).encode('utf-8')).hexdigest()

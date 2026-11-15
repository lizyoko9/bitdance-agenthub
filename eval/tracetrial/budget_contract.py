import hashlib
import json
import re


SCHEMA_VERSION = 2
MAX_TIMER_MS = 2_147_483_647
MAX_SAFE_INTEGER = 9_007_199_254_740_991
TECHNICAL_LIMITS = {'timeoutMs': MAX_TIMER_MS, 'maxToolCalls': 10_000,
    'maxTurns': 10_000, 'maxRequests': 1000, 'maxRequestBytes': 256 * 1024,
    'maxTotalRequestBytes': 64 * 1024 * 1024, 'maxCompletionTokens': 8192}
RESOURCE_DEFAULTS = {'maxRequestBytes': 256 * 1024, 'maxCompletionTokens': 8192}
TASK_KEYS = {'maxUserTurns', 'maxToolCalls', 'maxWallTimeSeconds'}
PLAN_KEYS = {'schemaVersion', 'taskId', 'mode', 'taskBudget', 'overrides', 'actor', 'sources', 'coverage'}


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


def build_budget_plan(task_id, task_budget, *, mode='task', overrides=None):
    if not isinstance(task_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', task_id):
        raise ValueError('Budget task ID must be a nonempty plain task identifier')
    if mode not in ('task', 'constrained'):
        raise ValueError('Budget mode must be task or constrained')
    task = _task_budget(task_budget)
    explicit = {} if overrides is None else overrides
    if not isinstance(explicit, dict) or not set(explicit) <= set(TECHNICAL_LIMITS):
        raise ValueError('Budget overrides must contain only supported flat actor limit names')
    explicit = {name: _integer(value, name, TECHNICAL_LIMITS[name]) for name, value in sorted(explicit.items())}
    sources = {'userInputs': {'kind': 'protocol', 'source': 'one_original_single_turn_prompt'}}

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
    turns = limit('maxTurns', tools + 1, 'derived', 'actor.maxToolCalls + 1')
    requests = limit('maxRequests', turns, 'derived', 'actor.maxTurns')
    request_bytes = limit('maxRequestBytes', RESOURCE_DEFAULTS['maxRequestBytes'], 'resource_guard_default',
                          'transport_policy.maxRequestBytes')
    total_bytes = limit('maxTotalRequestBytes', requests * request_bytes, 'derived',
                        'actor.requestLimits.maxRequests * actor.requestLimits.maxRequestBytes')
    output = limit('maxCompletionTokens', RESOURCE_DEFAULTS['maxCompletionTokens'], 'resource_guard_default',
                   'transport_policy.maxCompletionTokens')
    actor = {'userInputs': 1, 'timeoutMs': timeout, 'maxToolCalls': tools, 'maxTurns': turns,
             'requestLimits': {'maxRequests': requests, 'maxRequestBytes': request_bytes,
                               'maxTotalRequestBytes': total_bytes, 'maxCompletionTokens': output}}
    required = {'maxToolCalls': (task['maxToolCalls'], tools),
                'timeoutMs': (task['maxWallTimeSeconds'] * 1000, timeout),
                'maxTurns': (tools + 1, turns), 'maxRequests': (turns, requests),
                'maxTotalRequestBytes': (requests * request_bytes, total_bytes),
                'maxRequestBytes': (RESOURCE_DEFAULTS['maxRequestBytes'], request_bytes),
                'maxCompletionTokens': (RESOURCE_DEFAULTS['maxCompletionTokens'], output)}
    coverage = {name: {'required': needed, 'effective': effective, 'covered': effective >= needed}
                for name, (needed, effective) in required.items()}
    coverage['completeTaskTrajectory'] = all(row['covered'] for row in coverage.values())
    if mode == 'task' and not coverage['completeTaskTrajectory']:
        missing = ', '.join(name for name, row in coverage.items() if isinstance(row, dict) and not row['covered'])
        raise ValueError('Task-mode budget does not cover the complete task trajectory: ' + missing)
    return {'schemaVersion': SCHEMA_VERSION, 'taskId': task_id, 'mode': mode, 'taskBudget': task,
            'overrides': explicit, 'actor': actor, 'sources': sources, 'coverage': coverage}


def validate_budget_plan(plan, *, task_id=None, task_budget=None):
    if not isinstance(plan, dict) or set(plan) != PLAN_KEYS or type(plan.get('schemaVersion')) is not int or plan['schemaVersion'] != SCHEMA_VERSION:
        raise ValueError('Budget plan fields or schema version are invalid')
    if task_id is not None and plan['taskId'] != task_id:
        raise ValueError('Budget plan task ID differs from the selected task')
    if task_budget is not None and _canonical(plan['taskBudget']) != _canonical(_task_budget(task_budget)):
        raise ValueError('Budget plan is stale: task ceilings differ from the current TaskSpec')
    rebuilt = build_budget_plan(plan['taskId'], plan['taskBudget'], mode=plan['mode'], overrides=plan['overrides'])
    if _canonical(plan) != _canonical(rebuilt):
        raise ValueError('Budget plan does not reproduce its task, mode, overrides, sources and coverage')
    return rebuilt


def budget_plan_digest(plan):
    return hashlib.sha256(_canonical(validate_budget_plan(plan)).encode('utf-8')).hexdigest()

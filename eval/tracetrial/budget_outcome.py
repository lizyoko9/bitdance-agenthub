from .budget_contract import validate_budget_plan


def classify_budget_outcome(plan, native_result=None, process=None):
    plan = validate_budget_plan(plan)
    native = native_result if isinstance(native_result, dict) else {}
    process = process if isinstance(process, dict) else {}
    actor = plan['actor']
    reason = native.get('terminationReason')
    error = native.get('error') if isinstance(native.get('error'), str) else ''
    limit = None
    evidence = None
    rejection = process.get('budget_rejection')
    if isinstance(rejection, dict) and rejection.get('limit') in (
            'http_requests', 'request_bytes', 'total_request_bytes', 'wall_time'):
        limit = rejection['limit']
        evidence = 'worker.budget_rejection'
    elif process.get('timed_out') is True or native.get('timedOut') is True or reason == 'timed_out':
        limit = 'wall_time'
        evidence = 'worker.timed_out' if process.get('timed_out') is True else 'native.timedOut'
    elif reason == 'budget_exhausted':
        for prefix, name in (
                ('budget_exhausted: maximum tool calls reached', 'tool_calls'),
                ('budget_exhausted: maximum HTTP requests reached', 'http_requests'),
                ('budget_exhausted: request body exceeds byte limit', 'request_bytes'),
                ('budget_exhausted: cumulative request bodies exceed byte limit', 'total_request_bytes')):
            if error == prefix:
                limit, evidence = name, 'native.terminationReason+error'
                break
    elif reason == 'iteration_limit':
        limit, evidence = 'model_turns', 'native.terminationReason'
    elif reason == 'output_limit':
        limit, evidence = 'output_tokens', 'native.terminationReason'

    fields = {'tool_calls': 'maxToolCalls', 'wall_time': 'timeoutMs', 'model_turns': 'maxTurns',
              'http_requests': 'maxRequests', 'request_bytes': 'maxRequestBytes',
              'total_request_bytes': 'maxTotalRequestBytes', 'output_tokens': 'maxCompletionTokens'}
    field = fields.get(limit)
    value = actor.get(field) if field in ('maxToolCalls', 'timeoutMs', 'maxTurns') else actor['requestLimits'].get(field)
    task_limit = ((limit == 'tool_calls' and value == plan['taskBudget']['maxToolCalls']) or
                  (limit == 'wall_time' and value == plan['taskBudget']['maxWallTimeSeconds'] * 1000))
    if limit:
        kind = 'task_budget_exhausted' if task_limit else 'resource_limited'
    elif reason == 'completed' and native.get('runStatus') == 'complete':
        kind, evidence = 'not_limited', 'native.completed'
    else:
        kind = 'unknown'
    return {
        'schemaVersion': 1, 'mode': plan['mode'], 'kind': kind,
        'resourceLimited': kind == 'resource_limited',
        'constrainedExperiment': plan['mode'] == 'constrained',
        'taskBudgetMatched': actor['maxToolCalls'] == plan['taskBudget']['maxToolCalls']
                             and actor['timeoutMs'] == plan['taskBudget']['maxWallTimeSeconds'] * 1000,
        'limit': limit, 'limitValue': value,
        'limitSource': plan['sources'].get(field), 'evidence': evidence,
        'nativeTerminationReason': reason, 'scorePolicy': 'preserve_official',
    }

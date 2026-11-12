## ADDED Requirements

### Requirement: Custom tool loops SHALL use explicit validated turn limits

CustomAgentAdapter SHALL resolve maxTurns from its runtime option, then AGENTHUB_CUSTOM_MAX_TURNS, then a default of 32. Limits MUST be positive integers at most 10000 and validated before provider requests. Counts MUST be local to each stream invocation.

#### Scenario: A runtime overrides the environment
- **WHEN** maxTurns is explicitly supplied
- **THEN** that validated value takes precedence over the environment setting.

#### Scenario: Invalid configuration is supplied
- **WHEN** a limit is zero, negative, fractional, nonnumeric or above the allowed maximum
- **THEN** configuration fails before any model request.

### Requirement: Custom termination SHALL distinguish model stop from incomplete execution

CustomAgentAdapter MUST complete normally only for an explicit stop response without tool calls. Exhausting the configured turns while tools are still requested MUST emit available usage and throw an error with stable iteration_limit code and message prefix. Provider length, filtering or incomplete finishes MUST NOT count as normal completion. Existing Runner failure persistence, visible error content and run.end.error SHALL retain these reasons.

#### Scenario: The final allowed response stops voluntarily
- **WHEN** the model returns stop on the final allowed turn without tools
- **THEN** the run completes normally.

#### Scenario: The final allowed response still requests tools
- **WHEN** all allowed tool rounds have executed without a model stop
- **THEN** the adapter sends no additional request
- **AND** Runner records failed with iteration_limit instead of complete.

#### Scenario: Output is truncated
- **WHEN** the provider reports length
- **THEN** the adapter reports output_limit and does not execute partial tool arguments.

#### Scenario: Planning consumes only plan_tasks
- **WHEN** a caller intentionally closes the generator after a planning tool event
- **THEN** the adapter does not invent iteration exhaustion during cleanup.

## MODIFIED Requirements

### Requirement: Custom adapter SHALL support opt-in evaluation request policy

CustomAgentAdapter SHALL accept an optional runtime request policy for evaluation-controlled request parameters, transport retry settings, and shared preflight limits. Omitting that policy MUST preserve normal provider request and retry defaults and the existing StreamEvent contract. The configurable turn-limit and termination requirements apply independently of that policy. All calls MUST retain AbortSignal cancellation.

#### Scenario: A bounded Luna evaluation runs through Chat Completions
- **WHEN** the evaluation profile selects gpt-6-luna
- **THEN** requests explicitly set reasoning_effort to none and the configured completion limit
- **AND** SDK retries follow the evaluation policy.

#### Scenario: The normal application runs without an evaluation policy
- **WHEN** the adapter is constructed normally
- **THEN** normal request defaults, retry settings and tool permissions apply
- **AND** the configured tool-loop limit and termination rules still apply.

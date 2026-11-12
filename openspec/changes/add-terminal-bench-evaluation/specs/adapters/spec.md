## ADDED Requirements

### Requirement: Custom adapter SHALL support opt-in evaluation request policy

CustomAgentAdapter SHALL accept an optional runtime request policy for evaluation-controlled request parameters, transport retry settings, and shared preflight limits. Omitting that policy MUST preserve normal application behavior and the existing StreamEvent contract. All calls MUST retain AbortSignal cancellation.

#### Scenario: A bounded Luna evaluation runs through Chat Completions
- **WHEN** the evaluation profile selects gpt-6-luna
- **THEN** requests explicitly set reasoning_effort to none and the configured completion limit
- **AND** SDK retries follow the evaluation policy.

#### Scenario: The normal application runs without an evaluation policy
- **WHEN** the adapter is constructed normally
- **THEN** existing request defaults and tool behavior remain unchanged.

### Requirement: Custom adapter SHALL expose per-request usage observations

When an evaluation observer is installed, the adapter MUST report each actual request's identity, response model metadata, status, and available usage independently of run.usage events. Observation MUST occur before a caller can stop consuming the generator at a tool call. Observations MUST NOT contain authentication headers or credential values.

#### Scenario: Orchestrator planning stops after plan_tasks
- **WHEN** a planning request has already received usage and the caller stops after the tool event
- **THEN** its request-level usage remains recorded alongside later execution and aggregation requests.

#### Scenario: OpenAI reports cached prompt tokens
- **WHEN** usage includes prompt_tokens_details.cached_tokens
- **THEN** the observer records that field with its provider-specific meaning.

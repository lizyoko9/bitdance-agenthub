## MODIFIED Requirements

### Requirement: Actor and judge SHALL enforce distinct declared limits

Actor and judge MUST have independent actual HTTP, input-byte, output-token and wall-time bounds. The actor MUST respect the task's tool budget and distinguish user turns from internal model turns. Judge network retries MUST be disabled; all official JSON-correction reasks MUST count toward the judge budget. Limits MUST be checked before additional side effects or requests. Task-mode actor tools and total time MUST equal TaskSpec values; model/HTTP/aggregate-byte guards MUST cover the complete allowed single-run tool trajectory and final response. Unsupported technical domains MUST be rejected instead of clamping budgets. Smaller experiments MUST explicitly select constrained mode and retain limit sources.

#### Scenario: A rubric response is invalid JSON
- **WHEN** the official scorer requests its permitted correction
- **THEN** the new HTTP attempt consumes the same global judge budget
- **AND** exhaustion is recorded without a further request or fabricated result.

#### Scenario: A task permits eighty tools and twenty minutes
- **WHEN** its task-mode plan is resolved
- **THEN** it retains eighty tools and twenty minutes, with at least eighty-one model/HTTP opportunities and coherent aggregate-byte capacity
- **AND** shared TypeScript/SDK or worker defaults do not silently reduce those budgets.

### Requirement: Governance task admission SHALL distinguish declared and effective limits

Only the pinned `G1-registry-cleanup-002` workspace-only single-turn profile SHALL be admitted through the explicit compatibility mapping. The runner MUST retain the upstream protocol identity and identify execution as AgentHub. Task-mode tools/time MUST be inherited from TaskSpec; a smaller effective experiment MUST be an explicitly constrained plan with all limits and sources recorded. It MUST NOT claim unimplemented stock-harness session/provenance capabilities or add a provider_executed observation without evidence.

#### Scenario: A constrained trial uses less than the official task budget
- **WHEN** its explicit constrained plan is admitted
- **THEN** the record includes the official and effective limits and constrained scope
- **AND** budget exhaustion is retained without an automatic retry or a capability conclusion.

## ADDED Requirements

### Requirement: Budget plans SHALL be validated and bound before execution

A standard-library shared contract MUST resolve and validate the budget plan on host and worker. Actual runs MUST provide the generated plan, match its task and effective request fields, and persist its digest and limit sources. Missing, stale, malformed or incoherent task-mode plans MUST fail before credentials, container creation or Actor requests. Plan generation MUST require no credential or execution. Runtime bundles MUST retain the shared contract and its hash.

#### Scenario: The worker receives a request with a lower tool count than the plan
- **WHEN** it validates the inputs
- **THEN** it rejects the disagreement before reading the key or starting a child process.

### Requirement: Resource exhaustion SHALL be reported independently of official scores

Observed task-budget and additional resource-limit exhaustion MUST be distinguished in a separate budget outcome with the limit source. The integration MUST preserve original termination and official scores, and MUST NOT infer exhaustion solely because usage equals a limit. Constrained scope and resource-limited outcomes MUST NOT be presented as unconstrained capability results.

#### Scenario: The model stops normally on its final allowed request
- **WHEN** no guard rejection or truncation is observed
- **THEN** the outcome remains completed rather than resource_limited.

#### Scenario: An explicit cumulative-byte guard rejects a request
- **WHEN** its actual rejection is recorded
- **THEN** the separate outcome identifies the resource limit while original benchmark grading remains unchanged.

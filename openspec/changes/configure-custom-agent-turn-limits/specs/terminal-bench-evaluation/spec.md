## ADDED Requirements

### Requirement: Evaluation SHALL expose and record effective loop and request settings

Trial input SHALL accept validated maxTurns and requestLimits and apply them to the actual adapter and shared HTTP guard. The manifest MUST record the effective values. Defaults MUST retain the first smoke's existing eight-request, 256KiB cumulative-input and 2048-token output allowance; increasing request count or cumulative bytes MUST require explicit settings. No model trial SHALL be started by this code repair.

#### Scenario: A future trial explicitly requests a larger budget
- **WHEN** maxTurns, maxRequests and cumulative request bytes are supplied
- **THEN** those values are validated and forwarded through the Python wrapper and CLI profile
- **AND** no hidden fixed eight-turn or eight-request maximum overrides them.

### Requirement: Evaluation SHALL retain classified termination reasons

Result artifacts SHALL distinguish completed execution, iteration_limit, output_limit, budget_exhausted, timeout, abort and other failures. Limit classification MUST follow the event/error that actually ended execution, not merely equality with a configured maximum. Official reward remains separate.

#### Scenario: The adapter exhausts its turn limit
- **WHEN** Runner publishes failed with the iteration_limit prefix
- **THEN** the evaluation records terminationReason iteration_limit and does not report complete.

#### Scenario: A model voluntarily stops on its last available request
- **WHEN** Runner completes without failure
- **THEN** the result records completed rather than budget exhaustion.

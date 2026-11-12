## MODIFIED Requirements

### Requirement: Evaluation SHALL expose and record effective loop and request settings

Trial input SHALL accept validated maxTurns and requestLimits and apply them to the actual adapter and shared HTTP guard. The manifest MUST record the effective values. Defaults MUST retain the first smoke's existing eight-request, 64KiB per-request body, 256KiB cumulative-input and 2048-token output allowance; increasing any budget MUST require explicit settings. The Python wrapper SHALL expose max_turns, max_requests, max_request_bytes, max_total_request_bytes and max_completion_tokens. Configured per-request bodies MUST NOT exceed 256KiB and completion limits MUST NOT exceed 8192 tokens. Additional paid trials MUST use an explicitly selected and authorized budget.

#### Scenario: A future trial explicitly requests a larger budget
- **WHEN** maxTurns and all selected request-count, input-byte and output-token bounds are supplied
- **THEN** those values are validated and forwarded through the Python wrapper and CLI profile
- **AND** no hidden fixed eight-turn, eight-request, 64KiB-body or 2048-token maximum overrides the explicitly allowed settings.

#### Scenario: A configuration exceeds supported bounds
- **WHEN** a trial requests a nonintegral or out-of-range budget
- **THEN** it fails before installing or sending a model request.

#### Scenario: The shared transport checks configured input limits
- **WHEN** the next serialized body exceeds the selected per-request or cumulative limit
- **THEN** no additional HTTP request is sent
- **AND** the trial records budget_exhausted independently of official reward.

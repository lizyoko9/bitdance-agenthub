## MODIFIED Requirements

### Requirement: Deliverable validation SHALL be explicitly requested

The system SHALL provide scoped conversation operations to select user requirements and workspace inputs, request a validation draft from an existing Custom Agent configuration, review and activate an immutable revision, and validate current delivery files using an explicitly selected eligible revision. A user MAY explicitly bind an eligible revision to a formal single-Agent delivery request. Ordinary unbound chat turns, tool writes and run execution status SHALL retain their existing meaning.

#### Scenario: The user submits files for validation
- **WHEN** the user selects a saved plan and explicitly validates the files
- **THEN** the system checks the named current snapshots and returns per-check and overall delivery outcomes
- **AND** no generation request is made for reuse.

#### Scenario: An Agent updates an intermediate draft
- **WHEN** an Agent writes an output file or completes an ordinary message
- **THEN** the system does not trigger generation or mark the deliverable accepted.

## ADDED Requirements

### Requirement: The Hub SHALL automatically validate a bound formal delivery

The Hub SHALL verify eligibility of an explicitly selected immutable revision before starting the supported producer run. A bound run that reaches normal completion SHALL invoke the existing deterministic validator once after tool writes have settled, before publishing acceptance. The Hub SHALL associate the result with the exact run and revision, and SHALL show a durable delivery verdict and check details in the conversation. Execution state and acceptance state MUST remain distinguishable. Only a fresh passing receipt from that run and revision can certify delivery. This path MUST NOT require a separate validation action or a new model call.

#### Scenario: The bound producer writes a valid deliverable
- **WHEN** a formally bound single-Agent producer completes and all required checks pass
- **THEN** the Hub records accepted delivery with a new receipt for the checked snapshot
- **AND** the conversation shows the acceptance result without opening the rule panel.

#### Scenario: The bound producer finishes with an invalid shape
- **WHEN** a producer completes but a required check fails
- **THEN** the Hub preserves the produced output and records delivery failed with a reason
- **AND** the conversation does not indicate accepted delivery even if execution completed successfully.

#### Scenario: A run is aborted or the binding becomes invalid
- **WHEN** execution is aborted or the revision cannot legally validate the submitted snapshot
- **THEN** the run does not acquire accepted delivery
- **AND** the conversation shows cancellation or unverified acceptance as appropriate after reconnect.

#### Scenario: The user reruns the same formal delivery
- **WHEN** the user regenerates the unchanged formal request
- **THEN** the Hub validates its newly produced snapshot using the same exact eligible revision
- **AND** never reuses a historical or manual pass or silently selects a different revision.

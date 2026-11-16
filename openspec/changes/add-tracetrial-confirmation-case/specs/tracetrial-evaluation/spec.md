## ADDED Requirements

### Requirement: Confirmation case admission SHALL preserve full task budgets and measured process evidence

The integration SHALL admit only pinned L2-deploy-latency-001 as the selected single-input confirmation-state profile. Task-mode Actor limits MUST retain 140 tools/2400 seconds and coherent 141 internal-turn/HTTP capacity with declared byte/output guards. The separate 1800-second runtime declaration MUST remain recorded without clamping TaskSpec. L2 MUST use the existing measured process receipt/schema and only supported native/post-tool/process-containment capabilities. E6 timeout-specific capabilities and serialization MUST remain E6-only. Both official L2 rubrics MUST be covered.

#### Scenario: L2 is admitted without a timeout-specific requirement
- **WHEN** the pinned single-turn profile and full budget pass admission
- **THEN** the actor receives one original prompt and the complete task-mode capacity
- **AND** its process evidence uses the existing immutable pre-cleanup receipt without applying the E6 timeout bridge.

### Requirement: Container lifecycle projection SHALL be grounded in actual archive and cleanup outcomes

For L2 the driver SHALL preserve its original lifecycle stage log and expose the official container_lifecycle.json consumer format as an explicitly versioned AgentHub projection with original source path/hash and stage provenance. The projection MUST identify its AgentHub producer/schema and record explicit same-container identity on each referenced stage. Archive success MUST require observed successful copying and the declared required native evidence verified as regular non-symlink files with path/size/hash; cleanup success MUST require observed successful removal of the same created container. Missing, nonzero, raised, ambiguous or conflicting outcomes MUST NOT become complete. Original exceptions and available stage evidence MUST be retained before propagating apparatus failure, preserving the primary driver/container exception separately from later cleanup/persistence errors. Expected channel exit 75 or a failed native tool MUST NOT become a container error_type. Process cleanup observations MUST NOT substitute for container archive/removal evidence.

#### Scenario: Copy fails but removal succeeds
- **WHEN** the archive operation is nonzero or raises and later Docker removal succeeds
- **THEN** the lifecycle receipt retains archive failure and non-null error_type while separately recording cleanup success
- **AND** the trial cannot be presented as successful archival.

#### Scenario: Stages are missing or refer to conflicting containers
- **WHEN** lifecycle source evidence cannot establish successful archive and removal for the same created container
- **THEN** the projection retains failure or unknown state rather than manufacturing complete fields.

### Requirement: Confirmation-state experiments SHALL preserve observed channel state and scoring boundaries

The integration SHALL run one fresh Actor from the unchanged public task instructions and retain original native feedback, official verifier/rubrics and raw/effective scores with no automatic rerun. Independent audit MUST distinguish accepted/submitted state from authoritative confirmation, and separately inspect typed exit and failure status. Recognizer/report-text limitations MUST be attributed from retained evidence without modifying task instructions, artifacts or official scores.

#### Scenario: A submitted operation returns a nonzero wait-window status
- **WHEN** the actor receives the native result and later reconciles the audit
- **THEN** the trace retains both observations unchanged
- **AND** only actual authoritative confirmation evidence can justify confirmed final delivery claims.

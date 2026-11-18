## ADDED Requirements

### Requirement: Deliverable validation SHALL be explicitly requested

The system SHALL provide scoped conversation operations to select user requirements and workspace inputs, request a validation draft from an existing Custom Agent configuration, review and activate an immutable revision, and validate current delivery files using an explicitly selected eligible revision. Ordinary chat turns, tool writes and run completion SHALL retain their existing meaning.

#### Scenario: The user submits files for validation
- **WHEN** the user selects a saved plan and explicitly validates the files
- **THEN** the system checks the named current snapshots and returns per-check and overall delivery outcomes
- **AND** no generation request is made for reuse.

#### Scenario: An Agent updates an intermediate draft
- **WHEN** an Agent writes an output file or completes an ordinary message
- **THEN** the system does not trigger generation or mark the deliverable accepted.

### Requirement: A bounded child Agent SHALL propose rules from user requirements

The framework SHALL invoke at most one bounded Custom generation request per explicit draft action with selected user requirement excerpts, intended input binding descriptors and the supported evaluator grammar. It SHALL exclude deliverable contents, unrelated history, inherited Skills, attachments and tool privileges. The generator MUST NOT gain tool execution when a provider emits unexpected calls. Each draft SHALL record the generator's running provenance and server-verified references to same-conversation user requirements. Invalid, stale, cancelled or incomplete generation SHALL produce no eligible revision.

#### Scenario: A tool call is emitted by the generator
- **WHEN** a generation response attempts any tool call
- **THEN** the call is rejected before any corresponding executable event or side effect
- **AND** no active plan is created.

#### Scenario: A rule has an invented requirement reference
- **WHEN** a draft refers to a requirement outside the selected user messages and excerpts
- **THEN** the invalid draft cannot become an eligible revision.

### Requirement: Validation functions SHALL be bounded and qualified

A validation plan SHALL support file presence, JSON structure, Markdown heading checks and restricted pure functions over declared snapshots. The checked data representation SHALL use a typed operator allowlist with explicit input, size, recursion-depth and work bounds and SHALL provide no arbitrary code execution or privileged I/O. Generated checks SHALL be reviewable. The system SHALL validate rule structure and run qualification fixtures before allowing activation. A custom function used for hard acceptance SHALL have reviewed, independently specified pass/fail expectations and SHALL pass the recorded qualification cases.

#### Scenario: A shape error shares valid JSON syntax
- **WHEN** the candidate map contains an object in a slot declared as string or null
- **THEN** the qualified plan fails the check and identifies the file and exact value path.

#### Scenario: A proposed function accepts a negative fixture
- **WHEN** the evaluator produces pass on a fixture whose reviewed expected result is fail
- **THEN** the function is unqualified and the revision cannot be activated as a hard check.

#### Scenario: A function requires an unsupported operation
- **WHEN** a rule uses an unknown operator, undeclared input or a capability outside the evaluator
- **THEN** it cannot be executed as an acceptance check
- **AND** the system preserves the unsupported requirement as unverified.

### Requirement: Saved rule revisions SHALL remain bound to their source and scope

The local database SHALL retain immutable rule/function revisions with their exact requirement refs, workspace/scope binding, engine version, content hashes, provenance and qualification evidence. Eligibility requires explicit activation of the exact revision and current compatible bindings. The system MUST NOT silently substitute another revision or adopt a cross-conversation plan. Revocation, deleted/edited requirement refs, workspace rebinding or unsupported evaluator versions SHALL invalidate use. The user SHALL be able to list and use eligible revisions after restart.

#### Scenario: Existing requirements remain and delivery bytes change
- **WHEN** a user selects the same active revision after revising an output file
- **THEN** the system evaluates the new bytes with the saved rule definitions
- **AND** retains the prior snapshot receipt as history.

#### Scenario: An upstream source or workspace scope changes
- **WHEN** a plan's source message is removed or edited, the workspace is rebound, or another conversation tries to use it
- **THEN** the old definition does not execute against that binding
- **AND** the system reports the stale or foreign scope.

#### Scenario: Eligibility changes during validation
- **WHEN** a rule is revoked or its source or workspace binding changes while snapshots are read
- **THEN** the framework detects the change before committing a current receipt
- **AND** the ineligible run does not produce a current pass.

### Requirement: Receipts SHALL identify actual checked file snapshots

The framework SHALL read complete bounded snapshots only from declared and authorized workspace inputs. It MUST reject escapes, symlinks or unstable reads and MUST NOT run checks on truncated content as if complete. Receipts SHALL bind to the exact input hashes, evaluator version and plan hash, and hold pass, fail or unverified with source and error location. A pass MUST require a nonempty set of successful mandatory checks and verified coverage of every mandatory requirement. The product MUST distinguish historical passes from results for current modified files and from producer self-reports.

#### Scenario: A file changes after a passing receipt
- **WHEN** its current digest differs from the receipt
- **THEN** the receipt remains historical and the current file has no verified pass until checked again.

#### Scenario: Validation encounters an unavailable snapshot
- **WHEN** a required input is oversized, inaccessible or changes while being captured
- **THEN** dependent checks are unverified and the delivery is not marked passed.

#### Scenario: The generated plan omits a requirement
- **WHEN** a reviewed mandatory requirement has no executing hard check or the plan contains no hard checks
- **THEN** the system shows the missing coverage as unverified
- **AND** the delivery is not marked passed.

# Terminal-Bench Evaluation

## Purpose

Defines isolated, container-local evaluation of the actual AgentHub execution path against fixed public Terminal-Bench tasks, including bounded model requests, reproducible records, and official verifier ownership. Runtime setup and reproduction commands live in `eval/terminalbench/README.md`.

## Requirements

### Requirement: Public trials SHALL run the actual AgentHub execution path

The evaluation integration SHALL run AgentHub Application Services, AgentRunner, registered tools, and evidence gates inside the official task Agent environment. It MUST NOT replace AgentHub with a separate model tool loop or execute task tools on the host.

#### Scenario: A model calls a workspace tool
- **WHEN** an evaluated AgentHub run invokes file or command tooling
- **THEN** the existing AgentHub tool executes against the task container's workspace
- **AND** supervisor validation commands use that same environment.

### Requirement: Trial configuration SHALL be isolated and validated

The headless entry point MUST validate its task, instruction, cwd, model, group, limits, and output configuration with zod before execution. It MUST use a fresh trial database and MUST NOT modify the user's ordinary AgentHub database or agents.

#### Scenario: An orchestration profile is created
- **WHEN** an orch-gate or orch-nogate trial is initialized
- **THEN** its Orchestrator and workers use the same explicitly selected OpenAI model
- **AND** self-selected and public default Skills are disabled for the initial comparison.

#### Scenario: Invalid input is provided
- **WHEN** the entry point receives an unsupported group or invalid directory
- **THEN** it fails before starting an Agent or sending a model request.

### Requirement: Installed runtime SHALL preserve the official task environment

The integration MUST pin Harbor and dataset versions, prepare Linux-native runtime dependencies, and keep its program, database, and logs outside the task artifact paths. Uploads MUST use an explicit file allowlist and exclude host secrets and reference solutions.

#### Scenario: A runtime package is prepared on macOS
- **WHEN** the task environment is Linux
- **THEN** native runtime dependencies are prepared for the target Linux architecture
- **AND** host node_modules and env files are not uploaded.

### Requirement: Trial interactions SHALL use a fixed documented policy

The headless driver SHALL reuse normal conversation and message services, process approval events after resolver attachment, record user interactions, and abort the root and child runs on timeout. Existing path and command policy MUST continue to apply.

#### Scenario: A pending approval event is published synchronously
- **WHEN** the driver handles a pending plan or command
- **THEN** approval is deferred until registration completes
- **AND** the decision is recorded without bypassing a denied command.

### Requirement: Model trials SHALL enforce declared request limits

The integration MUST enforce actual HTTP request count, per-request serialized body bytes, cumulative body bytes, completion limits, and execution timeout. SDK retries MUST be disabled for the first smoke trial. Limits MUST apply across all runs in a trial and MUST be checked before sending the next request.

#### Scenario: A global request limit is exhausted
- **WHEN** another Agent or retry attempts a request beyond the shared limit
- **THEN** no additional HTTP request is sent
- **AND** the trial records budget exhaustion separately from verifier reward.

### Requirement: Official verifier SHALL remain the task success authority

The integration MUST preserve the official verifier, task artifacts, and separate-environment setting. Oracle validation and evaluated Agent trials MUST use independent fresh environments. AgentHub run completion MUST NOT itself count as a passed benchmark task.

#### Scenario: AgentHub completes but official verification fails
- **WHEN** a trial's run ends complete and the official reward is unsuccessful
- **THEN** the result reports the official failure and retains both statuses.

#### Scenario: Oracle environment validation succeeds
- **WHEN** the integration proceeds to a model trial
- **THEN** it starts a new environment without oracle-produced files or solution instructions.

### Requirement: Evaluation artifacts SHALL make scope and missing data explicit

The integration MUST record version hashes, actual architecture, group, model settings, limits, individual request observations, events, and official verifier outputs. It MUST redact credentials, represent missing usage as unknown, and label custom subsets or shortened budgets as internal evaluation scope.

#### Scenario: A streamed request ends before usage is received
- **WHEN** the usage record is incomplete
- **THEN** the request is marked usage-unknown rather than assigned zero cost.

#### Scenario: The first shortened trial is reported
- **WHEN** only one task is attempted with a shorter Agent timeout
- **THEN** the report identifies it as an integration smoke test rather than a full Terminal-Bench score.

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

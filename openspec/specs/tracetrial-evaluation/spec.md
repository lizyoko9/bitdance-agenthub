# TraceTrial Evaluation

## Purpose

Defines isolated execution of AgentHub against pinned TraceTrial-Bench mechanism tasks, faithful native execution evidence, bounded actor and judge requests, and official two-layer scoring. Runtime scope and interpretation are documented in `eval/tracetrial/README.md`.

## Requirements

### Requirement: TraceTrial integration SHALL execute AgentHub under its own identity

The integration MUST pin the benchmark revision and execute the actual AgentHub Application Services, adapter and tools inside a fresh task container. It MUST identify the harness as agenthub, preserve task instructions/workspace/scoring files and keep private grader material outside the actor context.

#### Scenario: The first E8 trial is started
- **WHEN** the authorized trial runs
- **THEN** native tools act on /workspace inside the container
- **AND** no stock harness or separate model tool loop substitutes for AgentHub.

### Requirement: Native evidence SHALL remain faithful through normalization

Original native events MUST be retained with source references. Canonical records MUST preserve tool IDs, arguments, results, failure flags and known/unknown fields without repairing measured behavior. Only actually supported execution capabilities SHALL be declared. A versioned canonical transport envelope MAY add an observed outer native call ID as result-side metadata only when the exact original payload is separately retained, all derived fields name their native sources, and conflicting existing fields are rejected rather than overwritten. Canonical metadata MUST NOT be presented as a captured full API wire message or as an added production payload field.

#### Scenario: A nonzero exit has a false native error flag
- **WHEN** normalization observes that combination
- **THEN** both values remain unchanged in the canonical result and native evidence
- **AND** official graders determine the resulting failure classification.

#### Scenario: The native transport carries a result call ID outside its payload
- **WHEN** the versioned projection maps it into canonical transport metadata
- **THEN** the exact original payload and raw event remain available with explicit provenance
- **AND** missing or conflicting IDs are never manufactured or silently corrected.

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

### Requirement: Official rules and layered scoring SHALL remain authoritative

The integration MUST reuse the pinned official verifier, rubric prompts, evidence extraction, score resolution, evaluation policy and attribution. Omitting declared LLM rubrics SHALL produce a partial result; a task whose official sheets declare zero rubrics MAY receive a complete official deterministic layered score without a Judge model request. Native execution failure, apparatus failure, judge failure, Harness score and Agent score MUST be reported separately.

#### Scenario: The actor completes but a harness criterion fails
- **WHEN** official scoring completes
- **THEN** the native execution outcome and the failed criterion are both retained
- **AND** voluntary model stop does not imply task or harness success.

#### Scenario: The selected governance task declares zero rubrics
- **WHEN** its complete official layered scoring runs
- **THEN** Judge model transport is prohibited and the reported Judge request count is zero
- **AND** the original deterministic Harness and Agent outcomes are retained.

### Requirement: Trial provenance and interpretation SHALL be explicit

Artifacts MUST include source/task/runtime hashes, platform, actual settings, original and normalized traces, actor/judge observations and official raw/effective score outputs. Credentials MUST be redacted, missing usage MUST remain unknown, and a one-task custom-adapter run MUST NOT be presented as a full benchmark or official leaderboard score.

#### Scenario: The pinned network profile differs from its Docker implementation
- **WHEN** bridge networking is used as in the pinned official runtime
- **THEN** the report records the profile/runtime distinction and does not claim operating-system-level network disconnection.

### Requirement: Selected tasks SHALL pass admission before actor execution

The runner MUST admit only the approved explicit task allowlist after validating the pinned task, single-user-turn runtime and all required execution capabilities, budget ceilings and judge coverage without model, fixture or container execution. Unsupported tasks MUST retain an admission reason and no score. Effective actor settings MUST be serialized once and validated/enforced by both driver and worker; task user-turn limits MUST remain distinct from internal model turns.

#### Scenario: An approved variant allows six user turns
- **WHEN** its single-turn runtime and other requirements match the declared support
- **THEN** admission permits one original user prompt with the approved independent internal-loop, HTTP, tool, byte, token and time limits.

#### Scenario: A task requires an unsupported execution mechanism
- **WHEN** no-model admission detects the missing capability or incompatible task shape
- **THEN** the runner records unsupported with a null score before any actor or paid request.

### Requirement: Canonical lifecycle metadata SHALL reflect validated native completeness

The adapter MUST derive terminal canonical trace completeness from the same full native lifecycle validation used by its summary. It MUST preserve original events, source references, tool results and measured failure fields. A failed, interrupted, unmatched or otherwise incomplete lifecycle MUST NOT be labeled complete.

#### Scenario: A completed native run has all calls and messages closed
- **WHEN** native validation confirms a single complete root lifecycle with no diagnostics
- **THEN** the final canonical run_finished and summary expose the same true completeness marker while original events remain unchanged.

#### Scenario: A tool call has no matching result
- **WHEN** normalization detects the dangling call
- **THEN** neither the terminal event nor the summary claims trace completeness.

### Requirement: Small-batch results SHALL retain individual trial boundaries

Each approved task MUST run once in a fresh container/output directory with no automatic actor or whole-scoring rerun. The batch MUST retain task/runtime/settings hashes and all individual raw/effective official outcomes, distinguish apparatus and Judge failures from scored criteria, and state its actual mechanism coverage without presenting a full-benchmark or leaderboard score.

#### Scenario: One trial cannot complete judging
- **WHEN** a Judge error or declared limit interrupts official scoring
- **THEN** its retained record remains incomplete with no fabricated full score and the other approved tasks retain their own independent records and budgets.

### Requirement: Governance task admission SHALL distinguish declared and effective limits

Only the pinned `G1-registry-cleanup-002` workspace-only single-turn profile SHALL be admitted through the explicit compatibility mapping. The runner MUST retain the upstream protocol identity and identify execution as AgentHub. Task-mode tools/time MUST be inherited from TaskSpec; a smaller effective experiment MUST be an explicitly constrained plan with all limits and sources recorded. It MUST NOT claim unimplemented stock-harness session/provenance capabilities or add a provider_executed observation without evidence.

#### Scenario: A constrained trial uses less than the official task budget
- **WHEN** its explicit constrained plan is admitted
- **THEN** the record includes the official and effective limits and constrained scope
- **AND** budget exhaustion is retained without an automatic retry or a capability conclusion.

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

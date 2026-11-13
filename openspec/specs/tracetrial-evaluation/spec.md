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

Original native events MUST be retained with source references. Canonical records MUST preserve tool IDs, arguments, results, failure flags and known/unknown fields without repairing measured behavior. Only actually supported execution capabilities SHALL be declared.

#### Scenario: A nonzero exit has a false native error flag
- **WHEN** normalization observes that combination
- **THEN** both values remain unchanged in the canonical result and native evidence
- **AND** official graders determine the resulting failure classification.

### Requirement: Actor and judge SHALL enforce distinct declared limits

Actor and judge MUST have independent actual HTTP, input-byte, output-token and wall-time bounds. The actor MUST respect the task's tool budget and distinguish user turns from internal model turns. Judge network retries MUST be disabled; all official JSON-correction reasks MUST count toward the judge budget. Limits MUST be checked before additional side effects or requests.

#### Scenario: A rubric response is invalid JSON
- **WHEN** the official scorer requests its permitted correction
- **THEN** the new HTTP attempt consumes the same global judge budget
- **AND** exhaustion is recorded without a further request or fabricated result.

### Requirement: Official rules and layered scoring SHALL remain authoritative

The integration MUST reuse the pinned official verifier, rubric prompts, evidence extraction, score resolution, evaluation policy and attribution. Rule-only results SHALL be labeled partial. Native execution failure, apparatus failure, judge failure, Harness score and Agent score MUST be reported separately.

#### Scenario: The actor completes but a harness criterion fails
- **WHEN** official scoring completes
- **THEN** the native execution outcome and the failed criterion are both retained
- **AND** voluntary model stop does not imply task or harness success.

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

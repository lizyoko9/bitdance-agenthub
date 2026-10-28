# Eval Harness Delta

## ADDED Requirements

### Requirement: Eval harness SHALL score tasks by hidden acceptance commands

The eval harness MUST determine pass/fail solely by running the task's `acceptCommand` in the task workspace after the root run ends, with hidden acceptance tests copied in only after the run ends.

#### Scenario: Agent finishes a task
- **WHEN** the root run of an eval case emits `run.end` or the case exceeds `timeoutMs`
- **THEN** the harness aborts any still-running run, copies `hidden/` into the workspace and runs `acceptCommand`
- **AND** the case passes only if the command exits with code 0.

### Requirement: Eval harness SHALL interact only through public APIs

The harness MUST create conversations, send messages and resolve pending approvals through the HTTP API and `/api/stream`, and MUST NOT import server modules or write the database.

#### Scenario: Orchestrator requests plan review
- **WHEN** a `dispatch.plan.pending` event arrives for the eval conversation
- **THEN** the harness approves the plan through the pending dispatch plan API and records the plan size.

### Requirement: Fixtures SHALL be self-validating

`--check-fixtures` MUST verify, without calling any LLM, that each task fails acceptance on its initial `repo/` and passes after applying `solution/`.

#### Scenario: Broken fixture
- **WHEN** a task's initial repo already passes acceptance, or its solution fails acceptance
- **THEN** `--check-fixtures` reports the task as invalid and exits non-zero.

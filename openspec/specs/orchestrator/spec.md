# Orchestrator

## Purpose

Defines the special agent workflow for planning, dispatching, and aggregating multi-agent tasks. Detailed flow lives in `specs/06-orchestrator-flow.md`.

## Requirements

### Requirement: Orchestrator SHALL be a normal Agent

The orchestrator MUST run through AgentRunner and an adapter like any other agent; it SHALL not have a separate service path.

#### Scenario: User starts a group task
- **WHEN** the conversation includes an orchestrator
- **THEN** AgentRunner executes it as an agent run
- **AND** uses orchestrator-specific prompts and tools.

### Requirement: Orchestrator SHALL plan before dispatch

The orchestration flow MUST produce a compiled and validated task plan before launching child agent runs.

#### Scenario: Plan tool is called
- **WHEN** the orchestrator calls `plan_tasks`
- **THEN** AgentRunner parses, compiles, and validates task ids, agent ids, dependencies, and acyclicity.

#### Scenario: Plan text implies missing dependencies
- **WHEN** task text references earlier task outputs but `dependsOn` omits them
- **THEN** AgentRunner adds high-confidence inferred dependencies before dispatch
- **AND** publishes and executes the compiled plan.

#### Scenario: Local workspace code project is requested
- **WHEN** the conversation workspace is local
- **AND** the user asks to create, modify, initialize, debug, or build project source files
- **THEN** the plan prompt tells the orchestrator to prefer agents with file/command tools
- **AND** the plan should use `acceptanceCriteria` for local file and command outcomes instead of `expectedOutputs`.

#### Scenario: Code task contract is normalized
- **WHEN** the compiled plan contains a code implementation task
- **THEN** AgentRunner ensures the task has a required `project` expected output
- **AND** ensures the task has acceptance/evidence requirements for a successful runnable verification command.

### Requirement: Child tasks SHALL respect dependency order and semantic reports

AgentRunner MUST execute dispatch tasks as a DAG and skip dependent tasks when prerequisites fail, required inputs cannot be resolved, or the child task does not report a successful semantic outcome.

#### Scenario: Upstream task fails
- **WHEN** a task dependency ends with status `failed`
- **THEN** dependent tasks are skipped
- **AND** dispatch events include the blocking reason.

#### Scenario: Downstream task is missing a required input artifact
- **WHEN** a downstream task declares a required input from an upstream output key
- **AND** the upstream result has no artifact bound to that key
- **THEN** the downstream task is skipped before launch
- **AND** dispatch events include the missing input reason.

#### Scenario: Child run completes without a task report
- **WHEN** a child run ends with status `complete`
- **AND** it did not call `report_task_result`
- **THEN** the dispatch task is treated as `failed`
- **AND** dependent tasks are skipped.

#### Scenario: Child task reports failed acceptance
- **WHEN** a child run calls `report_task_result`
- **AND** the report status is not `complete` or an acceptance result is missing/failed
- **THEN** the dispatch task is treated as `failed`
- **AND** dependent tasks are skipped.

#### Scenario: Code task lacks runnable verification
- **WHEN** a code implementation child task reports `complete`
- **AND** recorded command evidence has no successful non-prepare build, compile, test, lint, or typecheck command
- **THEN** the dispatch task is treated as `failed`
- **AND** the existing retry or replan flow may remediate it.

#### Scenario: Code task lacks project output
- **WHEN** a code implementation child task reports `complete`
- **AND** no required `project` output can be created and bound from workspace file writes
- **THEN** the dispatch task is treated as `failed`
- **AND** the existing retry or replan flow may remediate it.

#### Scenario: Replan references a previous-round task
- **WHEN** a remediation plan depends on a task id from an earlier dispatch round
- **THEN** AgentRunner treats that previous task as a resolved external dependency
- **AND** validates and executes the remediation plan without requiring the previous task to be repeated in the new plan.

### Requirement: Child task context SHALL include transitive upstream artifacts

AgentRunner MUST include artifact summaries from the full dependency closure in child prompts.

#### Scenario: Downstream review depends on implementation
- **WHEN** review task `t4` depends on `t3`, and `t3` depends on `t1` and `t2`
- **THEN** the review prompt includes artifact summaries from `t1`, `t2`, and `t3`.

### Requirement: Aggregation SHALL summarize child outputs

After child tasks finish, the orchestrator MUST run an aggregate stage that sees task results and produces the final response.

#### Scenario: All child tasks complete
- **WHEN** the DAG has no remaining runnable tasks
- **THEN** AgentRunner builds an aggregate prompt
- **AND** runs the orchestrator without `plan_tasks`.


### Requirement: Supervisor verification SHALL honor interrupted command outcomes

Supervisor-required command verification MUST fail for failed tool-result metadata, timeout, cancellation or a terminating signal, even if a numeric zero exit code is present. It MUST retain available exit code and bounded output for diagnosis.

#### Scenario: Interrupted command closes with zero
- **WHEN** a required command has execution-error metadata or interruption evidence and exit code zero
- **THEN** verification records ok=false and preserves the observations.

#### Scenario: Ordinary required command succeeds
- **WHEN** a required command exits with zero without failure or interruption evidence
- **THEN** verification retains the existing successful result.


### Requirement: DAG scheduling SHALL react to individual task completion

AgentRunner MUST record each terminal semantic task result and reconsider dependent tasks without waiting for unrelated in-flight tasks. Pending, in-flight and terminal task identities MUST be tracked separately to prevent duplicate admission. The existing process-wide concurrency limit, semantic completion gates, retry limits, required inputs and external seed dependencies MUST remain in effect.

#### Scenario: Fast predecessor finishes before an independent task
- **WHEN** A and B are executing, C depends only on A, and A completes while B remains active
- **THEN** C becomes eligible immediately after A's terminal semantic completion
- **AND** C may enter execution when the existing semaphore provides a slot, without waiting for B.

#### Scenario: Task has multiple predecessors
- **WHEN** C depends on A and B and only A has completed
- **THEN** C remains pending until every required predecessor completes successfully.

#### Scenario: Predecessor fails while independent work remains active
- **WHEN** A ends with a failed semantic outcome while unrelated B remains active
- **THEN** A's blocked descendants are skipped without waiting for B
- **AND** independent B continues under its existing budget.

#### Scenario: No task is ready while work remains in flight
- **WHEN** pending tasks are waiting for in-flight predecessors
- **THEN** AgentRunner waits for a task completion rather than reporting a circular dependency.

#### Scenario: Several dispatches share the process
- **WHEN** tasks from multiple dispatches compete for execution slots
- **THEN** the existing global concurrency limit remains enforced across those dispatches.

### Requirement: Dispatch shutdown SHALL retain ownership until work is drained

Parent cancellation or unexpected scheduler rejection MUST stop new task admission, cancel this dispatch's queued/running work and drain all owned in-flight tasks before the scheduler exits. Ordinary task failure results MUST retain their dependency-scoped behavior. Each task MUST publish at most one terminal dispatch event. A finally path MUST remove dispatch signal listeners and clean every tracked child-run evidence record, including retry runs and runs whose task promise rejected, without touching unrelated dispatches.

#### Scenario: Unexpected task promise rejects
- **WHEN** one admitted task unexpectedly rejects while a sibling is active
- **THEN** the scheduler retains the failing identity, cancels owned siblings and semaphore waiters, and waits for their settlement
- **AND** cleanup runs before the parent execution reports the unexpected failure.

#### Scenario: Parent is cancelled with queued and running tasks
- **WHEN** the parent signal aborts while tasks are pending, waiting for a slot or executing
- **THEN** no additional child run is started, pending and queued tasks receive an aborted outcome, and executing tasks receive cancellation
- **AND** each terminal outcome is published once and owned evidence is cleaned after drain.

#### Scenario: A task ignores cooperative cancellation temporarily
- **WHEN** an active task does not settle after cancellation
- **THEN** the scheduler retains it as owned in-flight work and remains in drain
- **AND** it does not claim that timeout or cancellation has terminated that task before it actually settles.

### Requirement: Dispatch write conflicts SHALL cover overlapping unordered tasks

Conflict detection MUST examine tracked fs_write results across all tasks in the current dispatch round whose execution intervals overlap and which have no transitive dependency ordering. Different hashes for the same absolute path MUST be reported using the existing conflict shape. Identical writes, non-overlapping execution and dependency-ordered overwrites MUST NOT be reported as concurrent write conflicts. Conflict evidence MUST be collected before per-run write records are cleared.

#### Scenario: New overlap crosses a former wave boundary
- **WHEN** A and B start together, C depends only on A, C starts before B completes, and B and C write different contents to the same tracked path
- **THEN** the conflict includes B and C despite their different former wave memberships.

#### Scenario: Dependent task overwrites an upstream file
- **WHEN** C executes only after its predecessor A completes and both write the same path
- **THEN** A and C are not reported as a concurrent write conflict.

#### Scenario: Overlapping tasks write identical contents
- **WHEN** dependency-unordered overlapping tasks write the same path with identical tracked hashes
- **THEN** no conflict is reported for those identical writes.

#### Scenario: Global slots serialize otherwise independent tasks
- **WHEN** two dependency-unordered tasks never overlap in execution
- **THEN** their sequential tracked writes are not reported as concurrent write conflicts.

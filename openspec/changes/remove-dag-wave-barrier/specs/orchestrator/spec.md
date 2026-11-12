## ADDED Requirements

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

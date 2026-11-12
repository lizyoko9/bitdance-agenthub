## Context

`executeDag` currently takes a snapshot of ready tasks, awaits `Promise.all`, then stores their results (`src/server/agent-runner.ts:774-786`). Dependencies remain correctly ordered, but no successor can become ready until the slowest unrelated task in that snapshot finishes. Legacy Spec 06 explicitly describes this wave policy. Global execution is separately bounded by the process-wide four-slot semaphore; removing the wave barrier must retain that bound.

`runChildTask` normally resolves failed/aborted task results rather than rejecting. These ordinary failures are not Promise.all fail-fast exceptions. However, prompt preparation, persistence or verification can throw outside the child runtime's normal error conversion. An unexpected rejection exits the scheduler before its current end-of-function evidence cleanup, while sibling promises continue. Parent cancellation reaches children through AbortSignal and removes semaphore waiters, but the scheduler notices pending-task cancellation only after the wave settles; its throw also bypasses that cleanup.

An offline reproduction extracted the actual current `executeDag` function, removed TypeScript types and injected controlled child promises and side-effect recorders. It made no model calls and did not run the complete service stack:

| Controlled case | Observed scheduler timeline |
|---|---|
| A=10ms, B=80ms, C=70ms; only C depends on A | A finished at 11ms; B at 82ms; C started at 82ms; parent finished at 152ms |
| A returns failed at 10ms; B=80ms; C depends on A | A finished at 12ms; C skipped only at 82ms |
| A unexpectedly rejects at 5ms; B=60ms | Parent rejected at 6ms; B still finished at 61ms; no scheduler cleanup ran |
| Parent abort at 20ms; B ignores cancellation until 80ms | Abort requested at 22ms; pending C marked aborted and parent rejected only at 82ms; cleanup was bypassed |

These samples establish control-flow behavior, not measured model performance. With a free semaphore slot, continuous scheduling can start C after A, giving an ideal duration of max(80,10+70)=80ms in the first synthetic case rather than 150ms. Actual runtime speedup depends on task graph, provider latency and available global slots.

## Goals / Non-Goals

**Goals:** Unlock successors on each semantically complete task; propagate blockers promptly; retain concurrency limits, completion gates, retries, input resolution, seed-result semantics and existing dispatch event shapes; cancel/drain owned work and always clean evidence; retain conflict reporting when formerly separate waves overlap.

**Non-Goals:** Change model budgets, retry counts, scheduling priorities, per-agent serialization, filesystem ownership or task contracts; parallelize tasks whose dependencies are unresolved; infer dependencies from writes; add provider/dependency packages; change the in-progress Bash fix or use single-agent E8 as a scheduler benchmark. Bash/SDK writes outside fs_write remain outside conflict tracking.

## Decisions

### Per-completion pending and in-flight state

Track pending task IDs separately from in-flight task promises and terminal results. Immediately reserve a pending task as in-flight before requesting a semaphore slot, preventing duplicate admission. A task result becomes terminal only after its existing run/retry/report/input/output/verification lifecycle completes; a child run.end alone does not unlock successors.

Upon each task settlement, store its result, propagate skipped descendants to a fixed point, and admit newly eligible tasks while independent work continues. Existing semaphore acquisition remains in the child path with its global limit of four and existing FIFO wait behavior. A newly ready task need not outrank tasks already queued for that semaphore. No circular/unresolved-dependency error is raised merely because no task is ready while some task is still in-flight.

Use an active-promise completion queue or race over tracked, non-rejecting completion envelopes. Promise.allSettled remains appropriate for shutdown/drain; replacing Promise.all with Promise.race without durable state ownership would lose completions and is not the proposed design.

### Distinguish ordinary task failure from scheduler failure

An ordinary terminal failed/aborted/skipped task result blocks only its dependent tasks; unrelated tasks continue. Unexpected rejection is a scheduler infrastructure failure: retain its task/error identity, stop new admission, cancel the dispatch-owned queued/running work, drain all started task promises and then propagate the error. Do not let the parent publish a terminal result while known owned work is still detached and active.

Use a dispatch-local AbortController linked to the parent signal, so a scheduler failure can cancel its own children without cancelling unrelated conversations or mutating the caller's controller. Preserve each task's terminal dispatch event exactly once; existing runChildTask terminal events and scheduler-generated rejection/cancellation events require a single ownership rule to avoid duplicate dispatch.end.

### Cancellation and cleanup are structured shutdown

On parent cancellation, immediately stop admission and mark never-admitted pending tasks aborted. Cancel semaphore waiters and active child runs through the dispatch signal; preserve already terminal successes/failures. Drain owned work before leaving the dispatch execution boundary. Track child run IDs when created, including retries, rather than deriving cleanup solely from successfully returned task results. A finally path removes listeners and clears only this dispatch's file-write and command-evidence records after required conflict/diagnostic information has been collected.

This is cooperative cancellation: JavaScript cannot forcibly cancel an arbitrary promise. An adapter that ignores AbortSignal can still delay drain until it settles; a fixed grace timeout that silently detaches it would not establish safe cleanup. No new hard execution-timeout policy is introduced here. Tests must show that the scheduler remains draining while a deliberately noncooperative fake task is unresolved, then completes cleanup once it is explicitly settled.

### Conflict detection follows actual overlap and dependency order

Remove wave membership as the conflict boundary. Record task execution intervals from semaphore admission until task work/verification/retries finish, before releasing the slot. Record monotonic lifecycle ordering so millisecond clock ties cannot invent overlap. Retain each task's tracked run-write summary through the end of this dispatch round.

Two tasks are conflict candidates only when their execution intervals overlap and neither is a transitive dependency of the other. For candidate pairs, different content hashes at the same absolute path produce a conflict. Same hashes are not conflicts; strict dependency-ordered overwrites and non-overlapping executions are not conflicts. Group/deduplicate by path and contributing task/run identity, and preserve the existing FileWriteConflict shape, aggregation and replan inputs.

For A and B initially ready, with C depending only on A, C can now overlap B: B/C conflicts must be detected even though they belonged to different old waves. A/C ordered writes must not be reported. This is post-execution detection/reporting, not locking or automatic file merging. Reads and untracked Bash/SDK writes retain their existing limitations.

### Deterministic validation before any further experiment

Use deferred task promises and event-order assertions, not fragile elapsed-time thresholds. Exercise the actual scheduler through a narrow injected child runner or controlled fake adapter, without API calls. Verify fast-predecessor release, multi-parent joins, diamond/chain graphs, no duplicate launches, immediate failed-dependency propagation, global semaphore saturation across dispatches, cross-round seeds, terminal-event uniqueness, unexpected rejection drain, cancellation of queued/running work, all cleanup paths, and B/C overlap versus A/C ordered writes. Retain at least one service-level offline fixture to validate real dispatch event and signal wiring.

## Risks / Trade-offs

- More useful concurrency increases workspace overlap → preserve the semaphore and expand conflict detection before enabling continuous admission; retain existing write-tracking blind spots explicitly.
- Completion callback races can duplicate tasks/events → reserve task identity synchronously and use terminal-state/idempotence guards, with simultaneous-settlement tests.
- Fast failure can discard diagnostic evidence or orphan siblings → store failure identity, cancel/drain ownership and clear tracked resources only in finally after evidence extraction.
- Long-running or uncooperative adapters can delay cancellation drain → retain visible cancellation and truthful active ownership; do not claim a timer has stopped code it cannot terminate.
- Timing and output order change → preserve dependency and semantic-result contracts, and validate event order/invariants rather than assuming old wave order.

## Migration Plan

The user approved this independent proposal on 2026-11-13. Sync the orchestrator capability and legacy Spec 06; implement and validate in a separate scheduler change/commit from the Bash result fix. Preserve the current E8 baseline and authorized comparison protocol. No stored-data migration is required; rollback restores the scheduler implementation and its contract together.

## Open Questions

None. The user explicitly approved this scope; no model-backed scheduler experiment is requested.

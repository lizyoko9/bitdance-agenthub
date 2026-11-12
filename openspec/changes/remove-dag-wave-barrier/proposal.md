## Why

The DAG scheduler waits for every task in a ready batch before recording any result, so a successor of a fast task waits for unrelated slow work. Unexpected task rejection also leaves sibling work undrained and bypasses dispatch evidence cleanup; improving scheduling must preserve cancellation and write-conflict correctness.

## What Changes

- Replace ready-batch barriers with pending and in-flight tracking: record each terminal task result and reconsider its successors immediately, while retaining the existing global four-slot semaphore.
- Propagate ordinary task failure to blocked successors without waiting for unrelated tasks; retain independent work, semantic completion gates, retries and cross-round dependencies.
- On unexpected rejection or parent cancellation, stop new admission, cancel owned queued/running work, drain started work, publish terminal outcomes once and clean all tracked child-run evidence in a finally path.
- Detect conflicting writes across overlapping dependency-unordered tasks, including tasks formerly assigned to different waves; exclude dependency-ordered overwrites.
- Add deterministic no-model scheduling, cancellation, cleanup and conflict regressions. The user explicitly approved implementation and offline scheduling regressions on 2026-11-13; no additional paid scheduler experiment is included.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `orchestrator`: per-completion dependency scheduling, safe dispatch shutdown and conflict detection without wave membership.

## Impact

`src/server/agent-runner.ts` scheduling/lifecycle ownership, `dispatch-file-writes.ts` conflict inputs, focused scheduler tests and legacy Spec 06. No new dependencies, provider calls, public event types, database fields or increase to concurrency/retry budgets. This is separate from `fix-bash-execution-outcomes`; the single-agent E8 comparison cannot measure DAG throughput.

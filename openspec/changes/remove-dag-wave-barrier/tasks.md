## 1. Approval and contracts

- [x] 1.1 Obtain the user's scope decision on the independent scheduler proposal before implementation.
- [x] 1.2 Synchronize the orchestrator capability and legacy Spec 06 continuous scheduling, cancellation/drain and conflict contracts without altering the Bash fix or E8 protocol.

## 2. Per-completion scheduling

- [x] 2.1 Introduce separately owned pending, in-flight and terminal task state, preserving current semantic completion, input resolution, retry and external-seed behavior.
- [x] 2.2 Record individual completions immediately, propagate skipped dependency chains and admit newly ready tasks through the existing global semaphore without duplicate launches.
- [x] 2.3 Add no-model deferred-promise tests for fast A/unrelated slow B/C depending on A, multi-parent joins, diamonds, chains, concurrent settlements, missing inputs and cross-round seeds.
- [x] 2.4 Verify global four-slot concurrency and FIFO semaphore compatibility across concurrent dispatches, including queued-task status and cancellation.

## 3. Shutdown and evidence ownership

- [x] 3.1 Add a dispatch-local cancellation scope; distinguish ordinary terminal failure from unexpected rejection and stop admission on parent cancellation or infrastructure failure.
- [x] 3.2 Drain owned queued/running task promises, retain error identity and publish every terminal dispatch event at most once before leaving the dispatch boundary.
- [x] 3.3 Track run identities as they are created, including retries and unexpected failure paths; move owned listener/evidence cleanup into finally after diagnostics are collected.
- [x] 3.4 Test normal failure while independent work continues, rejection with an active sibling, parent abort before/after admission, queued waiters, temporarily noncooperative work and complete cleanup without touching another dispatch.

## 4. Conflict tracking without wave membership

- [x] 4.1 Record admitted execution intervals and transitive dependency ordering; retain fs_write summaries through the current dispatch round.
- [x] 4.2 Detect and deduplicate same-path/different-hash conflicts among overlapping dependency-unordered tasks, keeping the existing conflict shape and replan/aggregation wiring.
- [x] 4.3 Test B/C overlap across former wave boundaries, ordered A/C overwrites, identical hashes, non-overlapping independent work and retry-run summaries; retain documented Bash/SDK blind spots.

## 5. Integration and handoff

- [x] 5.1 Add an offline service-level dispatch/signal fixture and run the focused scheduler, conflict, dependency and cancellation regressions without model calls.
- [x] 5.2 Complete typecheck, changed-file lint, strict OpenSpec validation and the required contract/implementation commit separation.
- [x] 5.3 Report invariant and synthetic timing evidence with its limits; do not use single-agent E8 or a synthetic graph to claim multi-agent model efficacy.

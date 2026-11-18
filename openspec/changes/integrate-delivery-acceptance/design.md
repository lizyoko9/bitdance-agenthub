## Context

`validateDeliveryRevision` already reads scoped complete snapshots, interprets the selected rule revision and writes a receipt. Only the explicit conversation operation invokes it. Ordinary `executeRun` currently proceeds from completed adapter consumption to `finalizeOk` without delivery acceptance.

## Goals / Non-Goals

**Goal.** Put deterministic acceptance on the normal Hub path for a formally bound single-Agent delivery. Reuse the saved revision and surface the verdict in that conversation.

**Scope.** A single-Agent formal delivery run. A task spanning multiple conversations, a child with dependency handoff, a new paid rule generation, and autonomous repair each have distinct contracts and are outside this change.

## Decisions

1. The composer offers an optional “完成时验收” choice using active saved versions. Sending a formal delivery pins the exact revision on the new run. The server checks the conversation, revision eligibility and supported run mode before launching. A multi-turn task can bind its final delivery run. Draft and ordinary turns carry no binding. No assistant text matching or implicit latest revision selection.
2. After the bound producer drains its adapter, tool operations and writes, AgentRunner calls the deterministic validator before publishing the terminal acceptance outcome. Use the existing rule and snapshot service. Separate generation dependency from the deterministic path if necessary to avoid an AgentRunner/service import cycle. The Hub checks the content of the submitted snapshot. A receipt alone does not prove which run wrote each file.
3. Store an optional per-run acceptance binding and outcome with revision, verdict, optional receipt ID and bounded details in the existing local database. Pass requires a fresh receipt for the exact run and revision. Commit acceptance against still-eligible rules and current run ownership after asynchronous reads. A late cancellation may leave a historical snapshot receipt, but never an accepted aborted run. Execution status remains available independently of acceptance. Reuse the existing run status and snapshot channels with optional additive acceptance data so reconnects show the same durable verdict.
4. The conversation shows acceptance status and details directly. The dialog manages saved versions and manual rechecks. Manual or old receipts cannot satisfy a new run. If a run fails to execute or aborts before validation, record that acceptance did not run. A failed or unavailable check retains the output and shows “交付未通过” or “未验证” rather than presenting success.
5. Regenerating the same final request preserves its exact eligible binding and validates a fresh snapshot. Check eligibility before any replacement of old results. Editing the original user request does not silently copy the old binding. Workspace mismatches, revocations and source changes require an explicit eligible selection.

## Risks / Trade-offs

- Every adapter stop can look like task completion → gate only formally bound deliveries and test unbound and draft runs.
- A stale receipt can look like current acceptance → associate the current run, explicit revision and input hashes from its new snapshot.
- Stream events can be missed on reconnect → persist the acceptance decision and hydrate it in the run view.
- The compile path may self-trigger → normal run bindings are distinct from validation-generation runs.

## Migration Plan

Use additive local SQLite bootstrap for the optional acceptance metadata. Existing runs remain readable. Update delivery, run and stream documentation as needed. Roll back by disabling the new binding and leaving the existing rules and manual operation available.

## Open Questions

The user approved the additive request/run contract and first-release single-Agent boundary with “按方案接入（推荐）”.

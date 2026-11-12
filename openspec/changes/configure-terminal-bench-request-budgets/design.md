## Context

The turn-limit repair is merged. The initial trial produced two 2048-token responses followed by invalid write arguments and its eighth request body was 52811 bytes. These observations motivate explicitly adjustable per-request settings; they do not prove that larger settings will solve the task.

## Goals / Non-Goals

**Goals:** Forward and enforce both approved settings, preserve effective records and execute one fresh diagnostic task trial.

**Non-Goals:** No unlimited budget, task-specific hints, altered task/verifier, extra automatic trial, or claimed multi-agent performance gain.

## Decisions

- Extend existing evaluation requestLimits with configurable maxRequestBytes up to 262144 and maxCompletionTokens up to 8192, retaining their defaults 65536 and 2048. Do not change ordinary application requests.
- Add Python max_request_bytes and max_completion_tokens options, validate before installation, forward to the same CLI schema/policy and record full settings. Reuse existing request count, cumulative bytes, AbortSignal and zero-retry enforcement.
- User approved one new single trial: Luna/none, maxTurns=32, maxRequests=32, maxRequestBytes=262144, maxTotalRequestBytes=4194304, maxCompletionTokens=8192, timeout=600s. Reuse the authorized environment credential and scoped proxies. Reuse only images; use a fresh container and upload no previous outputs or verifier/oracle contents.
- Preserve the successful independent oracle as infrastructure evidence because the fixed task remains byte-identical. Hash-check the task and fresh source package before the model trial.
- Keep the new result distinct from the first smoke. Report official reward, observed usage, terminal reason and limitations; this is not a controlled single-variable ablation or full benchmark score.

## Risks / Trade-offs

- Larger output/input bounds increase potential API cost → all selected bounds remain finite, explicit, logged and checked before sending; the roughly USD 0.6 planning estimate is not a dollar hard cap.
- Another independent bound or model error may still stop execution → keep that actual termination reason and do not silently retry.
- Installation/network failures → diagnose without model calls; never change the task or silently switch models to obtain success.

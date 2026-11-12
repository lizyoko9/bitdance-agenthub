## Context

The adapter currently returns after eight tool rounds. Runner treats a normal generator return as complete and only preserves thrown error messages, so Error.code alone cannot distinguish exhaustion in durable records. The initial evaluation also has an independent shared eight-request budget.

## Goals / Non-Goals

**Goals:** Make bounds configurable, retain a finite default, classify exhaustion and truncated responses, and preserve normal Runner error propagation and accounting.

**Non-Goals:** No new model trial, unlimited execution, DB migration, UI editor, SDK adapter changes, or altered historical benchmark result.

## Decisions

1. Resolve Custom maxTurns from constructor override, then AGENTHUB_CUSTOM_MAX_TURNS, then 32. Validate positive integral values up to 10000 before any request. The default is an adjustable fallback, not a benchmark-calibrated optimum.
2. Only an explicit stop response without tool calls completes the normal Custom loop. After the final allowed tool round, emit usage then throw a typed error whose message begins iteration_limit:. Existing Runner writes failed status/error and conversation-visible text. No StreamEvent or DB schema changes are necessary.
3. A length finish becomes output_limit; content_filter and missing/inconsistent finishes also fail explicitly. Incomplete output must not masquerade as voluntary model completion. Do not throw limit errors from finally because planning may intentionally close the generator after plan_tasks.
4. Evaluation accepts explicit maxTurns and requestLimits. Defaults retain the already approved eight-request/256KiB/2048-token smoke allowance; larger request/count or cumulative-input settings require explicit configuration. Allow up to 1000 requests and 64MiB cumulative input, without increasing the existing per-request/output bounds. Python exposes max_turns, max_requests, max_total_request_bytes. Manifest records the effective values and result classifies terminationReason using the stable error prefixes, timeout and abort status.
5. Keep natural completion, iteration exhaustion, HTTP budget exhaustion, output limit, timeout, cancellation and other errors distinct. No new paid request is performed as part of this repair.

## Risks / Trade-offs

- More default turns can increase ordinary application usage → finite validated fallback, documented environment override and existing AbortSignal.
- A model can hit several bounds → report the bound actually stopping execution; do not infer exhaustion merely from count equality.
- Missing provider finish reason previously counted as completion → now report model_interrupted to avoid false success.
- Explicit evaluation settings can authorize a larger future trial → keep previous defaults and do not start a model in tests or this task.

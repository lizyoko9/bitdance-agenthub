## Context

TraceTrial-Bench is fixed at `98a381307184fa4212db3466b21b4c92a031940b`. Its generic adapter only records raw stdout; its native registry does not include AgentHub. The first selected task, `E8-exit-code-masked-by-output-001`, needs one user turn, native execution/post-tool observations, a JSON deliverable and exact final text. Its official budget is 120 seconds and six tool calls. One user turn is not one model HTTP request.

## Goals / Non-Goals

**Goals:** Execute the actual AgentHub path, preserve native failure semantics, and obtain separate official rule, Harness and Agent verdicts with complete provenance and finite actor/judge budgets.

**Non-Goals:** No 95-task run, multi-worker efficacy claim, masquerading as a stock harness, manufactured process/API records, modified task/rubric, or repair of native failure flags during measurement.

## Decisions

### Project-local execution adapter

Use a dedicated `eval/tracetrial/` driver instead of patching every upstream CLI/Docker harness registry. Reuse pinned official TaskSpec/RunLayout/workspace preparation, strict invocation policy, execution evidence helper, rule verifier, layered scoring, evaluation policy and attribution. Identify the harness as `agenthub` and label custom execution integration explicitly.

Run the existing AgentHub headless Application Services, CustomAdapter and tools in a fresh Linux ARM64 container. Mount only the public task workspace at `/workspace`; keep program, fresh database and logs outside it. Reuse the established allowlisted Linux source package/installer and record its actual image digest, Node version and hashes. Do not copy private verifier, score sheets, previous trial outputs or reference information into the actor environment.

Reuse the official provider recorder where compatible. A local endpoint must be exempted from environment proxies with NO_PROXY. Otherwise retain a documented equivalent transport with authentic AgentHub event and request records; do not claim full wire capture if only metadata was recorded. Keys remain in process environments/in memory, not model TOML files or request JSON. A minimal environment without actor/judge credentials runs the host-side trusted rule verifier.

### Evidence and behavior fidelity

Archive original AgentHub `tool.call`, `tool.result`, assistant and run events before conversion. Canonical events retain stable IDs, ordering, source references and unmodified tool values. Derived timing or sidecars must remain traceable to their source. Declare only implemented `native_exec_v1` and `post_tool_v1` capabilities.

AgentHub currently preserves nonzero exitCode while its Bash tool may still return ok=true/isError=false. Both facts must survive conversion. Do not infer an error=true flag, split combined output into invented stdout/stderr streams, fabricate native sessions or add success evidence. Let the official helpers and graders evaluate the behavior as observed.

Add an optional evaluation tool preflight to enforce the selected six-tool allowance before side effects, without changing ordinary adapter behavior or sandbox policy. Keep actor HTTP count and user/LLM/tool turn counts distinct.

### First authorized scope proposed for confirmation

| Component | Fixed proposed bound |
|---|---|
| Task / trials / group | E8-exit-code-masked-by-output-001 / one fresh trial / single |
| Actor / judge | gpt-6-luna / gpt-6-luna, both reasoning_effort=none; reuse the already authorized environment credential |
| Actor HTTP / internal loop | at most 16 actual requests, SDK retries 0 / maxTurns 32 |
| Actor tools / time | at most six tool calls / 120 seconds, matching the task |
| Actor input / output | per body 256KiB, cumulative 2MiB / 8192 output tokens per request |
| Judge HTTP | at most 10 actual requests across five rubrics; network retries 0 |
| Judge input / output | per body 256KiB, cumulative 2MiB / 4096 output tokens per request |
| Judge time | 600 seconds total, each call bounded by remaining time and at most 60 seconds |
| Automatic reruns / fallback | none for actor or whole scoring; no model substitution |

The official judge normally needs five rubric calls. Its one JSON-parse correction may require one further call per rubric; all such calls consume the shared ten-call budget. Inject a bounded JudgeRequester (an upstream extension point) to use Luna-compatible request parameters and disable network retry/redirect expansion. Preserve all original rubrics, evidence selection, score resolution, aggregation and attribution. If scoring cannot complete within the budget, report that failure and partial diagnostics without inventing a complete score.

At current Standard text prices, a conservative byte/token planning estimate is roughly USD 0.6 or less for these bounded calls; this is not a hard dollar cap or account balance assertion. Actual token usage and unknown billing fields remain explicit.

### Network and architecture scope

The pinned task profile states network_mode=none, but upstream Docker code actually creates and validates bridge networking. Match that pinned runtime behavior and the task's instruction prohibiting task-related network actions; do not claim operating-system-level network disconnection. Use only scoped existing transport proxies, without changing Docker/Colima/global proxy settings. Record this upstream limitation and the custom runtime image/version differences in the report.

## Risks / Trade-offs

- Unsupported evidence or admission failure → stop and report apparatus failure; do not bypass or relabel it as a valid harness score.
- Native failure channel is inconsistent → retain the measured failure and defer any harness repair to a separate change.
- Judge variability and unexercised mechanisms → retain original_score/resolved_from and raw/effective verdicts. A single-task Harness result is not a model-independent framework correctness rate or leaderboard Macro.
- New integration may affect existing headless support → preserve Terminal-Bench defaults and regression-test both paths without model calls.

## Migration Plan

Obtain confirmation of this concrete capability/dependency/budget scope, then implement and test offline. Validate a no-key synthetic trace/scoring path and container setup before the one actor trial. Finish the official rule and bounded rubric scoring on retained artifacts, audit credentials/hashes, and report all outcomes without a second actor attempt.

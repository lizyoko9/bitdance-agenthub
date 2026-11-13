## Context

Three single-turn tasks at benchmark revision `98a381307184fa4212db3466b21b4c92a031940b` have been approved: E7 stale-artifact variant 002, E8 lint-gate variant 002, and original E8 variant 001. Only the original E8 is currently runnable. The driver asserts a specific task budget tuple, the worker independently hardcodes limits, and E7 requires a canonical terminal completeness marker absent from the current adapter.

## Goals / Non-Goals

**Goals:** execute each approved task once; reject unsupported scenarios before paid calls; preserve complete provenance and the official layered scores; keep native evidence unchanged.

**Non-Goals:** G1/raw-result projection, MCP, multi-turn or multi-agent task support, new dependencies, benchmark/fixture/rubric changes, model or judge calibration, or a full-benchmark score.

## Decisions

1. Limit selection to a three-task allowlist and expose a no-key, no-container, no-fixture admission action. Admission checks the pinned source, actual TaskSpec and runtime requirements, single-turn input, six-tool/120-second envelope, supported execution capabilities and available judge-request coverage. Unsupported tasks receive a reason and null score before any actor side effect. `max_turns=6` is an allowed user-turn ceiling; this experiment supplies one original user prompt and preserves internal `maxTurns=32` separately.
2. Retain per-trial Actor limits: Luna/none, 16 actual HTTP, 256 KiB per request, 2 MiB aggregate, 8192 output tokens/request, six tools and 120 seconds. Serialize one validated effective actor request; the worker reads these settings and enforces the approved envelope instead of selecting separate effective values. Judge retains Luna/none, ten HTTP including official corrections, 256 KiB/2 MiB request bodies, 4096 output tokens/request and 600 seconds total/60 per request. Three trials therefore admit at most 48 Actor and 30 Judge HTTP requests; their 4+2+5 rubrics normally use eleven Judge requests. Byte limits are not token or dollar caps.
3. Compute canonical `run_finished.trace_complete` using the same full native lifecycle validation as summary completeness. Incomplete, failed, interrupted, unmatched or out-of-order evidence cannot acquire a true marker. Derivation has source references; raw events and model-visible tool results remain byte/value faithful. No task-specific outcome correction is permitted.
4. Reuse one committed application/runtime build across fresh per-task containers and new output directories. Run sequentially, preserve every run without automatic actor or whole-judge retries, and retain official raw/effective scores. No calls occur during admission or offline tests.
5. Report the original E8 as development regression and the two variants as first executions on this integration. Report coverage as E7/E8 only, with separate Harness, Agent, apparatus and Judge outcomes. Score failures alone are not a root-cause diagnosis.

## Risks / Trade-offs

- Task metadata can omit parser-specific requirements → test trace conformance with synthetic native lifecycle fixtures before paid execution, keeping official graders unchanged.
- New lifecycle metadata could conceal incomplete evidence → add negative cases for missing/double ends, dangling calls, late events and interruption.
- Model/Judge variation limits causal interpretation → retain all raw results and settings; avoid selecting the best rerun or asserting general framework accuracy.
- Runtime refresh can accidentally change dependencies → retain the verified immutable dependency image and existing refresh checks, no registry or global configuration changes.

## Migration Plan

Commit specification separately, implement only evaluation files and documentation, run offline Python plus project type/lint checks, then commit all runtime/controller inputs. Build and probe without a key, execute the approved three-task batch, audit integrity/credentials/container cleanup and commit a reproducible report. Revert the isolated evaluation change to roll back; no database migration is needed.

## Open Questions

None required for this batch. The user's “跑来看看吧” authorizes the preceding explicit three-trial plan and its unchanged per-trial budgets; the prior reuse-existing-credential decision remains in force.

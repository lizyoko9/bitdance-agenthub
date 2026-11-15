## Context

The observed G1 failure stopped after six reads/listings because a previous task's limits were reused. TaskSpec allows 80 tools and 1200 seconds. The execution path also contains Python HTTP/body/loop ceilings, the shared TS schema's ten-minute maximum, and an implicit ten-minute SDK request timeout. Correctness therefore requires validation across the full path.

## Goals / Non-Goals

**Goals:** one task-derived resolved plan, explicit resource guards and constrained experiments, validation before side effects, traceable exhaustion, and an end-to-end no-model regression.

**Non-Goals:** paid trials, Docker runs/dependency changes, historical score rewriting, unrelated task support, changing production Bash behavior, or claiming byte/output guards are dollar caps.

## Decisions

### One shared plan contract

Add a standard-library-only `eval/tracetrial/budget_contract.py`, usable by the host and standalone worker. Its public functions are `build_budget_plan(task_id, task_budget, *, mode='task', overrides=None)`, `validate_budget_plan(plan, *, task_id=None, task_budget=None)` and `budget_plan_digest(plan)`.

The canonical plan has `schemaVersion=2`, `taskId`, `mode`, `taskBudget`, `overrides`, `actor`, `sources` and `coverage`. `taskBudget` contains `maxUserTurns`, `maxToolCalls`, `maxWallTimeSeconds`; `actor` contains `userInputs=1`, `timeoutMs`, `maxToolCalls`, `maxTurns` and `requestLimits`. Sources distinguish task declarations, derived values and resource-guard defaults/explicit overrides. Rebuilding from task/mode/overrides must reproduce the entire validated plan; edits to effective fields or source claims alone are rejected.

Task mode takes tools/time exactly from TaskSpec, without `min` or task-specific numeric copies. For the current single-run, one-request-per-model-turn, zero-retry protocol, `maxTurns` defaults to task tools + one final response, HTTP defaults to maxTurns, and aggregate request bytes default to HTTP × per-request bytes. Defaults for per-request body/output remain explicit transport resource guards (256 KiB/8192 tokens). G1 therefore resolves to 80 tools, 1,200,000ms, 81 model turns, 81 HTTP and 21,233,664 aggregate bytes. User-turn ceilings remain a different quantity.

Task-mode validation rejects tools/time below the task, model turns below tools+1, HTTP below model turns, and aggregate bytes below HTTP×per-request bytes. Explicit overrides may add headroom but cannot raise tools/time beyond the official task ceilings. Constrained mode alone allows explicit smaller task/resource budgets; it records every reduction and is labeled as a constrained experiment even if it completes.

Technical supported domains match the actual runtime: tools/model turns up to 10,000, HTTP up to 1,000, body up to 256 KiB, cumulative body up to 64 MiB, output up to 8192 tokens, and total timeout within the JavaScript signed-32-bit timer domain (2,147,483,647ms). A task or derivation outside these domains is rejected as unsupported, never clamped. Per-request transport guards can still stop a run and remain explicitly reported; capacity checks are not a claim of unlimited context or cost.

### Admission and explicit run configuration

`admit_task(task, *, budget_plan=None, mode='task', overrides=None)` resolves or validates a plan against the actual TaskSpec, and returns it in admission metadata. `actor_request(task, budget_plan=None, *, mode='task', overrides=None)` uses that plan. `actor_settings(..., budget_plan=None)` records its mode, digest, sources and effective fields. Existing capability/runtime and zero-Judge checks remain.

`preflight` needs no key and can write `--budget-out <plan.json>`. `--budget-mode task|constrained` and an optional `--limits-file <flat-overrides.json>` control plan generation. `run` requires `--budget-file <plan.json>` and checks it against the pinned TaskSpec before credentials, output directories or Docker. Old run commands therefore cannot silently expand paid budgets after upgrading. The generated file is explicit configuration/provenance, not an API credential or automatic authorization to spend.

### Worker and runtime bundle

Keep the existing ten-field public Actor request shape. Copy the canonical plan separately to `/state/budget-plan.json`; the worker's fourth positional argument identifies it. `validate_actor_request(request, budget_plan)` requires request effective fields to exactly match a valid plan. Remove the old E8-valued ceiling dictionaries. `BoundedUpstream(..., request, budget_plan, ...)` and the subprocess deadline use the same effective fields. Validation happens before key reads or process creation. The plan digest and explicit guard rejection are retained in process metadata.

Package/hash the shared contract with both Dockerfiles and local image refresh. The standalone worker imports from its adjacent trusted contract file; host package imports use the package path. Both clean and reused runtime manifests include the new file.

### TypeScript and SDK propagation

The shared Terminal-Bench schema/default remains at ten minutes. TraceTrial supplies its own schema through the shared validator/CLI's optional schema selection, reusing the same strict input and canonical path-isolation checks. TraceTrial's maximum is the timer's technical domain, not G1's particular duration. The optional programmatic `CustomAgentAdapterOptions.requestTimeoutMs` is validated and passed as SDK `timeout`; evaluation explicitly sets it from the effective task deadline. Unset options retain existing ordinary application defaults. Existing AbortSignal propagation remains authoritative for the remaining trial time.

### Independent budget outcome

Write a separate `budget-outcome.json` based on actual rejection/termination evidence. Distinguish an official task tool/time limit from an explicitly smaller constrained limit or an HTTP/body/iteration/output resource guard. Record the resolved limit and source, retain original termination and official score/attribution, and mark auxiliary exhaustion `resource_limited`. A completed run whose count equals a limit is not exhausted. Missing evidence remains unknown. Worker guard rejections must carry a safe structured reason so SDK transport wrapping cannot erase the resource-limit cause.

### Validation and migration

Regression coverage includes multiple task sizes, the original G1 request reaching 80 tools plus its final 81st model response through the actual Custom adapter/fake transport, task-mode rejection of hidden 6/16/32/2MiB bottlenecks, constrained-mode opt-in, plan/request mismatch before side effects, and pure preflight output. The TS route must accept a 20-minute G1 request while the default Terminal route still rejects it, and SDK options must carry the explicit timeout.

Commit spec separately; implement and run offline Python/TS checks, typecheck/lint and strict OpenSpec validation; inspect generated plans for all four pinned tasks. No new model request, Docker build or benchmark score is required. Historical artifacts keep their original limits and results.

## Risks / Trade-offs

- A larger task budget can cost more on future runs → actual runs require an explicit generated plan; this change itself makes zero paid requests.
- Two-language validation can drift → test the actual Python-resolved request through the TS validator and adapter rather than a copied fixture.
- Guards may still interrupt due to context/output limits → list their provenance and actual observed cause separately from task and capability results.

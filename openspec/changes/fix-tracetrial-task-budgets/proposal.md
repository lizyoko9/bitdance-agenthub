## Why

The first E8 task's six-tool/120-second limits were promoted into a shared worker ceiling, silently truncating G1's official 80-tool/1200-second budget. Independent 16-request, 32-turn, 2 MiB, TypeScript ten-minute and SDK ten-minute limits could still truncate a task after fixing only the tool count.

## What Changes

- Resolve task tools and total time directly from TaskSpec, with no silent clamp. Derive single-run model/HTTP capacity for every permitted tool plus the final response, and sufficient aggregate body capacity.
- Separate task-matched and explicitly constrained plans, list every limit's source, and require a generated plan for actual runs. Reject conflicting or under-covering task-mode plans before credentials, output creation or Docker.
- Make the worker enforce the same plan and package/hash the shared budget contract with both clean and reused runtimes.
- Give TraceTrial a timeout schema matching the timer's technical domain and pass an explicit SDK request timeout. Keep ordinary application and Terminal-Bench defaults unchanged.
- Record observed resource-limit exhaustion separately from task-budget exhaustion and unchanged official scores; equality with a limit alone is not exhaustion.
- Add no-model regressions including an actual Python-resolved G1 request through TypeScript and the real Custom adapter with 80 fake tools plus a final response.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracetrial-evaluation`: task-derived, provenance-bound, coherent budget plans and independent resource-limit reporting.
- `adapters`: optional explicit SDK request timeout with existing defaults retained when omitted.

## Impact

Evaluation Python/TypeScript code, an optional Custom adapter timeout setting, runtime packaging, regression tests and documentation. No dependency, production tool/security-policy, official benchmark or historical result changes. This change is authorized by the user's request to fix the entire budget configuration; no paid model trial or Docker execution is included.

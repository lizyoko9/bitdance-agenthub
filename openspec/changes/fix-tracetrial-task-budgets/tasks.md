## 1. Shared task-derived plan

- [x] 1.1 Implement the shared plan resolver/validator, limit provenance, task/constrained modes and coverage invariants.
- [x] 1.2 Use the plan in task admission and standalone worker; reject request disagreement before credentials or side effects.
- [x] 1.3 Add task-size, constrained-mode, stale-plan and worker-boundary offline regressions.

## 2. Runtime and transport propagation

- [x] 2.1 Require explicit generated plans in run, persist hashes/settings, and include the contract in clean/reused runtime packaging.
- [x] 2.2 Add TraceTrial-specific timeout schema and explicit SDK timeout while preserving other callers' defaults.
- [x] 2.3 Record actual resource/task budget outcomes independently of unchanged official scores.

## 3. Verification and documentation

- [x] 3.1 Prove the actual Python G1 request reaches 80 fake tool executions plus a final 81st response through the TypeScript adapter.
- [x] 3.2 Generate and audit plans for all four pinned tasks without a key, model, Docker or fixture execution; run relevant Python/TS suites, typecheck, lint and strict spec checks.
- [x] 3.3 Update main specs, CLI documentation and project guardrails, record verification, and merge the reviewed changes locally.

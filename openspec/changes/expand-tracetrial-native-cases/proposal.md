## Why

The current runner is fixed to the original E8 task and rejects the single-turn E7/E8 variants' declared turn ceilings. A small, controlled expansion can test stale-artifact rejection and failure propagation while detecting execution-adapter incompatibility before paid requests.

## What Changes

- Admit an explicit three-task allowlist: `E7-failed-command-stale-artifact-002`, `E8-lintgate-exit-masked-002`, and the original `E8-exit-code-masked-by-output-001` regression.
- Add no-model admission for single-turn runtime, required capabilities, task budgets, scoring coverage and task identity before any actor starts.
- Use one validated actor limit document in the driver and recorder worker, retaining the existing approved limits.
- Derive canonical terminal `trace_complete` from the complete native lifecycle validation without changing native events, tool values or official graders.
- Run each selected task once in a fresh container, retain every result and report Harness, Agent, apparatus and judge outcomes separately.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracetrial-evaluation`: admit an explicit supported task selection, enforce consistent budgets and faithful terminal lifecycle metadata, and record small-batch provenance.

## Impact

Only the project-local TraceTrial evaluation runner, recorder, trace adapter, offline checks and documentation change. No application interface, security policy, dependency, model, official task, rubric or scoring logic changes. The user approved this bounded three-trial plan with “跑来看看吧” after the task list and per-trial limits were presented.

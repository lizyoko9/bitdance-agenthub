## Why

The user requested a real TraceTrial-Bench run to evaluate AgentHub's harness behavior separately from task-solving outcomes. The pinned benchmark has no native AgentHub adapter, and full scoring includes additional model-judge requests, so execution, evidence conversion and both budgets must be explicit.

## What Changes

- Add a project-local AgentHub execution adapter for TraceTrial-Bench source commit `98a381307184fa4212db3466b21b4c92a031940b` (package 0.1.0), installed in an isolated Python environment; its package declares no third-party dependencies.
- Run the real AgentHub headless services and native tools in a fresh Docker container at `/workspace`, with program/state/logs outside that workspace.
- Preserve raw AgentHub events and faithfully translate supported execution/post-tool evidence for official capability helpers and scoring. Do not repair or invent failure flags during normalization.
- Reuse official task definitions, workspace setup, rule verifier, layered rubric judge, evaluation policy and attribution; label the result as an AgentHub custom-adapter single-task smoke, not an official leaderboard score.
- Add an opt-in shared tool-call preflight for the task's six-tool limit; preserve ordinary application behavior.
- After confirmation, run one `E8-exit-code-masked-by-output-001` trial with the existing OpenAI credential and fixed Luna actor/judge budgets. No additional task or actor rerun is authorized by this proposal.

## Capabilities

### New Capabilities

- `tracetrial-evaluation`: Pinned mechanism-task execution, authentic native evidence and bounded official two-layer scoring.

### Modified Capabilities

- `adapters`: Optional evaluation tool-call limits checked before execution.

## Impact

New `eval/tracetrial/` integration, limited reusable headless runtime options/packaging, tests and capability documentation. No normal AgentHub database migration, new application SDK, safety-policy relaxation, or use of another harness under the AgentHub name.

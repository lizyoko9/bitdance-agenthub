# AgentHub Lifecycle

AgentHub borrows the lifecycle shape from `google/agents-cli`, but keeps the product local-first, desktop-first, and free-only.

## Lifecycle

1. Spec: capture the user's goal, required Agents, tools, and deliverables.
2. Scaffold: create or update the workflow draft.
3. Build: configure Agents, model profiles, CLI/MCP/software capabilities, and artifact contracts.
4. Orchestrate: run the workflow through the existing AgentHub canvas runner.
5. Evaluate: grade the run against local eval cases and artifact contracts.
6. Observe: summarize traces, tool calls, artifacts, failures, and next fixes.

## Reused AgentHub Modules

- Module registry: `src/modules/app-modules.tsx`
- Canvas normalization: `src/lib/app-module-navigation.ts`
- Control plane: `src/server/control-plane-service.ts`
- Workflow runner: `src/server/workflow-runner-service.ts`
- Observability: `src/server/observability-service.ts`

## Borrowed Ideas From google/agents-cli

- Manifest-driven project state.
- Central command runner.
- Eval generate/grade/compare/analyze loop.
- Observe/debug loop.

## Not Included In Core

- Google Cloud deployment.
- Gemini Enterprise-only behavior.
- ADK Python runtime as a requirement.
- BigQuery or Cloud Trace as required dependencies.

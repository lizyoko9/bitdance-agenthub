## Why

AgentHub has a nine-task diagnostic eval, but no adapter that runs its actual execution loop in a public benchmark's original task environment. A bounded Terminal-Bench pilot will establish a reproducible AgentHub-to-verifier path before making any claims about orchestration gains.

## What Changes

- Add a Harbor installed-agent integration pinned to Harbor 0.25.0 and Terminal-Bench CPU 4.1.0.
- Add a container-local headless entry point that reuses AgentHub Application Services, AgentRunner, EventBus, filesystem tools, and evidence gates without Next.js or the UI.
- Package the runtime with Linux-native dependencies from the existing pnpm lockfile; never copy macOS node_modules, host databases, env files, or benchmark answers.
- Use an isolated database and explicit same-model OpenAI evaluation profiles; preserve the user's normal agents and credentials.
- Add opt-in Custom adapter request controls and per-request observations for bounded calls, complete usage accounting, and the model's required Chat Completions settings. Normal app defaults remain unchanged.
- Validate the official task environment with an independent oracle trial, then attempt one bounded single-agent model trial. Preserve official verifier scoring and distinguish infrastructure failure, execution failure, timeout, and missing usage.

## Capabilities

### New Capabilities

- `terminal-bench-evaluation`: Container-local AgentHub execution, reproducible profiles, trial limits, isolated oracle/verifier lifecycle, and public-benchmark artifacts.

### Modified Capabilities

- `adapters`: Optional request policy and observation hooks for CustomAgentAdapter, preserving the existing StreamEvent and default application behavior.

## Impact

- New evaluation-only files under `eval/terminalbench/`; a small optional runtime configuration boundary in `src/server/adapters/custom-agent-adapter.ts` and its provider client construction.
- Harbor is a new isolated Python evaluation dependency, not an application dependency; Linux runtime preparation reuses existing package versions.
- No database schema, web API, UI, workspace boundary, command blacklist, or normal agent configuration changes.
- First proposed model is `gpt-6-luna` with `reasoning_effort=none`; access remains unverified. Existing OpenAI credential reuse has already been authorized. No new secret file or key is required.
- This proposal must be confirmed before implementation and dependency installation, per CLAUDE.md sections 6.1 and 6.2.

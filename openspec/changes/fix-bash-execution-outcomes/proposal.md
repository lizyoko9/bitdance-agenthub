## Why

TraceTrial E8 retained a real exitCode=23 with isError=false. AgentHub's Bash handler reports successful tool transport even for failed processes, and CustomAgentAdapter maps only transport success into the error flag. This hides explicit failure classification from models and post-tool observers despite preserving the numeric exit code.

## What Changes

- Add optional isError metadata to ToolResult's successful-result branch without discarding value.
- Compute Bash execution failure once from exit code, signal, timeout and cancellation; propagate it through model-visible fields, native events and command evidence.
- Honor the metadata in managed adapter/MCP translation and supervisor command verification.
- Add deterministic regressions, retain the previous E8 baseline, and run exactly one fresh, same-configuration E8 trial with official layered scoring.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tools`: distinguish obtained tool results from failed command execution while retaining observations.
- `adapters`: propagate execution-error metadata with unchanged result contents.
- `orchestrator`: reject failed or interrupted command verification even when the final exit code is zero.

## Impact

ToolResult, managed Bash, Custom/MCP adapter translation, supervisor command gates, legacy Spec 01/05/07 and focused tests. No new dependencies, database fields, StreamEvent fields, security blacklist changes or grading changes. The user approved this concrete interface design and a follow-up experiment on 2026-11-13.

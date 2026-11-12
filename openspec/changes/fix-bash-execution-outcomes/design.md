## Context

The retained E8 baseline scored Harness 5/7 and Agent 4/4. Bash returned a successful ToolResult wrapper for a process with exit code 23; the adapter emitted isError=false and sent only the unclassified payload to the model. Changing ok to false with the current union would discard the numeric exit code and output. Supervisor verification independently ignores interruption when exit code happens to be zero.

## Goals / Non-Goals

**Goals:** retain complete observations; assign one coherent failure classification at the execution boundary; preserve model repair opportunities; prove behavior without model calls before one bounded E8 comparison.

**Non-Goals:** change SDK-owned command execution, run-level success criteria, database/event schemas, security/approval policies, trace normalization, official tasks or scorers; claim full benchmark or multiple-agent effectiveness.

## Decisions

1. The existing successful ToolResult branch gains optional isError:boolean metadata. ok=true means a result was obtained; omitted isError retains existing behavior. L3 owns the execution judgment; L2 translates !ok || isError===true without tool-name or exit-code heuristics.
2. Bash computes failure from timeout, cancellation, a terminating signal, or exitCode !== 0. The same boolean reaches the wrapper, model-visible payload (isError and failed/completed status), and command evidence. Preserve cwd/command/exitCode/output/truncated/timedOut and add aborted/signal. Pre-existing cancellation must not spawn. Spawn errors keep the existing ok=false path. Resolve and record once across error/close races.
3. Custom and MCP bridges preserve successful-result content and honor error metadata. Supervisor command gates also honor metadata and interruption fields, so aborted commands ending with zero cannot pass. A failed command alone does not throw or terminate the Agent's tool loop.
4. Run deterministic process, adapter, gate and compatibility tests first. Then run exactly one new E8 actor with the original prompt, Luna/none, 16 HTTP, 6 tools, 120 seconds, 32 internal turns, output 8192; judge Luna/none, 10 HTTP total, 600 seconds total, 60 seconds per request, output 4096. Each side keeps 256KiB/request and 2MiB cumulative bodies; no network retries, actor rerun, fallback or full scoring retry. Existing credential reuse is authorized. Earlier rough $0.6 estimate remains a non-hard cost estimate.
5. Reuse the exact baseline Linux dependency image only when package/lockfile and Node/pnpm versions match; overlay the new committed allowlisted source archive with path validation and final non-root import/profile probes. Preserve base image ID, hashes, Docker recipe and current image ID for audit. This controls dependencies and avoids repeating installation. A normal clean build remains supported.

## Risks / Trade-offs

- Optional error metadata could be ignored by older consumers → inspect all registry result consumers, cover Custom/MCP and supervisor paths, and preserve existing tool defaults.
- Timeout/abort may close with exit code zero → explicit interruption bits override zero; test the boundary with controlled child events.
- Cancellation and process error/close can race → preserve finite cleanup and exactly-one observation/settlement.
- LLM rubric variance and one selected case limit inference → retain raw/effective results and deterministic rules, compare only this mechanism, and report all outcomes.
- Reusing runtime dependencies can conceal drift → compare manifests and immutable image provenance before overlay, and rerun no-key probes.

## Migration Plan

No stored-data migration. Synchronize ToolResult/Bash and adapter/gate contracts, commit specs separately, implement with regressions, commit exact experiment source, run one fresh trial and audit, then commit results and merge. Keep the original baseline unchanged. Rollback is a normal revert of the implementation and its contract changes.

## Open Questions

None: the user approved the described fix and continuation experiment on 2026-11-13.

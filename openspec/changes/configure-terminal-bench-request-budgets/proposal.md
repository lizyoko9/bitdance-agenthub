## Why

The user approved a second one-task trial after the turn-limit repair. The remaining fixed 2048-token output and 64KiB request-body maxima could stop that trial before the declared 32-round budget, so both must be explicit validated evaluation settings.

## What Changes

- Expose max_request_bytes and max_completion_tokens through Harbor, the Python request builder, CLI schema and actual preflight/request settings.
- Keep existing 64KiB/2048 defaults; allow explicit values up to the approved 256KiB/8192 maxima.
- Run exactly one fresh bun-sourcemap-leak single trial with Luna, 32 turns/32 requests, 256KiB per request, 4MiB total input, 8192 output tokens per request, 600 seconds and no automatic retry.
- Preserve the prior trial and official verifier, and record the new source/archive hashes, termination reason and reward.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `terminal-bench-evaluation`: Explicit input/output request budgets and their effective runtime records.

## Impact

Evaluation policy/schema, Python wrapper/contract, tests and documentation. No dependency, application DB, normal adapter default, task/verifier change or model substitution. The user explicitly confirmed implementation and this paid trial in the current conversation.

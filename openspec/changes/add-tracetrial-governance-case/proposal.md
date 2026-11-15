## Why

E7/E8 now provide execution-feedback evidence, but do not exercise deletion governance or independent before/after verification. `G1-registry-cleanup-002` adds that mechanism with 17 official deterministic rules, while exposing a canonical transport-association mismatch that must be made explicit before running.

## What Changes

- Add only the pinned G1 registry case to the allowlist, preserving the existing trial's lower limits: one user input, 32 internal turns, 16 HTTP, six tools, 120 seconds, 256 KiB/2 MiB body limits, and 8192 output tokens per request.
- Admit its generic single-turn workspace execution shape under the upstream `openclaw_native_v1` label without claiming to execute OpenClaw; retain original task/profile declarations alongside effective AgentHub settings.
- Introduce a versioned canonical transport envelope that maps the real native outer `callId` to `tool_result.tool_call_id`, retains the exact native payload separately, records the source of derived fields and rejects conflicting IDs without overwriting evidence.
- Validate E7/E8 compatibility offline and run G1 once in a fresh task workspace/container. G1 has zero LLM rubrics and requires zero Judge model requests; full official deterministic layered scoring is distinct from omitting required rubrics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracetrial-evaluation`: distinguish native payloads from a documented canonical transport envelope; admit the explicit governance case with lower effective limits and complete zero-rubric official scoring.

## Impact

Only evaluation admission, canonical trace conversion, tests, source manifests and documentation change. No production StreamEvent/tool payload, dependency, task, fixture, rubric, security policy or application database changes. The change requires review before implementation because canonical result representation is a documented data contract.

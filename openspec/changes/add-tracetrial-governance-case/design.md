## Context

The pinned G1 registry task checks deletion governance using eight Harness and nine Agent deterministic rules. Its public manifest authorizes deletion only of reclaimable files; the task also requires independent checks before and after deletion. Production tools already expose outcome fields and outer native `callId`, but the canonical projection discards result-side transport identity. Its grader requires identity at `tool_result.tool_call_id` plus top-level typed outcome fields.

## Goals / Non-Goals

**Goals:** exercise a genuinely different mechanism with one bounded Actor trial, preserve truthful native evidence, and retain the complete official zero-rubric score.

**Non-Goals:** implement OpenClaw, impersonate a stock harness, change production payloads/prompts/approvals, support G1 buildcache's separate provenance requirement, expand trial limits to the task maximum, fabricate `provider_executed`, or change graders.

## Decisions

1. Use a versioned, generic canonical transport projection for new runs. A dictionary payload keeps every field and receives only a transport ID from the matched native result's outer `callId`; the exact unmodified payload is also saved as `native_tool_result`. Non-object payloads require a documented `value` wrapper, with exact originals retained. Record which field was added and its source path; preserve `raw_event` and archived sources unchanged. A native payload already containing a different `tool_call_id` produces a diagnostic rather than an overwrite. Missing call IDs are never generated. E7/E8 parser and sidecar regressions must pass before any new Actor call.

   Example projection (not a production tool change):

   ```json
   {
     "tool_result": {"exitCode": 0, "status": "completed", "isError": false, "tool_call_id": "call_1"},
     "native_tool_result": {"exitCode": 0, "status": "completed", "isError": false},
     "tool_result_projection": {"version": "agenthub_transport_v2", "derived_fields": {"tool_call_id": "raw_event.callId"}}
   }
   ```

   This explicitly distinguishes canonical transport metadata from the original model-facing payload. It is not a captured full API wire message and does not repair execution outcomes.

2. Admit only the pinned G1 registry execution profile as a compatible generic single-turn workspace shape despite its legacy `openclaw_native_v1` label. Retain that original declaration and identify execution as AgentHub. No native session, skill or simulator capability is claimed.
3. Record official ceilings (12 user turns, 80 tools, 1200 seconds) separately from this lower experimental envelope: one original prompt, internal 32 turns, 16 actual HTTP, six tools, 120 seconds, 256 KiB per request/2 MiB aggregate and 8192 output tokens. Existing effective limits remain unchanged. A plausible five-tool path is not a promise of completion and must not be injected as a solution into the Actor prompt.
4. Keep official layered scoring even with zero rubrics, prohibit Judge model transport for this case, and record zero Judge requests. This is a complete task-defined deterministic score; skipping any declared rubric on another task still makes that score incomplete. No prompt/rubric or score adjustment is permitted.
5. Use a fresh container and output directory, run once, retain failures and budget exhaustion, and audit source hashes, raw/canonical/sidecar mapping and cleanup. No paid E7/E8 reruns are needed solely for projection conformance; use synthetic/preserved traces offline with no judge re-scoring.

## Risks / Trade-offs

- A canonical ID addition could be mistaken for a model payload field → preserve an exact separate payload, version and source declaration; report the adapter change distinctly from application behavior.
- A compatibility mapping could conceal unsupported machinery → restrict to this fixed workspace-only profile and test requirements before any request.
- Six tools may be insufficient for a particular model trajectory → retain the capped result without automatic retry or loosening limits.
- Deterministic scores could still reflect parser assumptions → retain all raw inputs and source references; do not change the grader.

## Approval and migration

This is a proposed data-contract change under CLAUDE.md §6.2. It is not implemented yet. After review, commit the specification separately, implement and test the projection/admission/scoring guard, synchronize docs/specs, commit all controller inputs, refresh the verified local runtime, run the one G1 trial and audit/report the original score. No dependency or database migration is needed.

## Context

The selected new sample is E8-mountcheck-exit-masked-003 at revision98a381307184fa4212db3466b21b4c92a031940b. It is an E8 regression variant, not a new mechanism family. E3 was rejected because of a Claude-specific capability and direct-execution/non-executable fixture conflict; neither task nor grader will be edited to force compatibility.

## Goals / Non-Goals

**Goals:** One real post-usage-fix trial, coherent task budgets, measured native terminal observation, full unchanged official scoring and independent evidence/usage audit.

**Non-Goals:** New child/multi-turn/MCP protocols, extra production tools, process observer activation, altered fixture permissions, grader repair, private instructions or automatic retries.

## Decisions

1. Admit only the selected explicit task. Use TaskSpec six tools/120 seconds, one input, seven internal turns/HTTP, 262144 bytes per body,1835008 cumulative bytes and8192 output tokens. Runtime600 seconds is separately retained. The public prompt already requires Bash and the88-byte script emits reassuring text then exits23; preflight checks interpreter availability without executing the fixture.
2. Add native_terminal_completion_v1 only for this case, supported by existing strict native lifecycle/root-run closure, run_finished and trace_complete evidence. Tests must preserve failed/incomplete/missing-terminal cases as failures; capability registration must not manufacture completion, provider_executed or success. Existing cases/capabilities remain unchanged, with no Claude-specific mechanism or process observer.
3. Two Harness rubrics and four Agent rules accompany six Harness rules. Judge defaults remain256KiB per body/2MiB cumulative/10HTTP/4096 output/600 seconds total and60 seconds per request. Before the first paid Judge call, a selected-case wrapper uses the pinned pure EvidenceFinder and prompt renderer with the already-produced deterministic rule results to render both full prompts, verify the actual first prompt matches and check peak plus two-times-sum for unchanged one-per-rubric same-prompt corrections. Validate every actual prompt including correction against the planned prompt/hash/serialized bytes, with no more than two calls per rubric; reject unknown, drifted or third calls before transport. Persist hashes/sizes/sources, not runtime credentials; do not trim evidence or expand guards. Infeasible plans remain incomplete with zero Judge HTTP.
4. Recover the exact pinned source and existing benchmark package in fresh project-ignored directories because the old temporary checkout lost files. Tests use the existing AGENTHUB_TRACETRIAL_TEST_SOURCE environment convention consistently, and missing source cannot count as passing resolved-config checks. Source and installed-package hashes must match before trial.
5. Build a fresh committed runtime after the usage fix and summary, reuse verified dependencies when available, then run once with existing authorized OpenAI credentials, Luna/none, no retries. Cost planning reference is$0.6, not a hard cap. Retain original native/canonical/probe/source/fixture/score/usage evidence; compare request/run/message counters to the independent recorder with cache semantics recorded, without altering the old L2 trial.

## Risks / Trade-offs

- A new variant can be mistaken for new coverage → report it as E8 regression only.
- Judge evidence expands after execution → exact full-plan guard check before any Judge HTTP, no silent truncation or automatic guard enlargement.
- Fixed source is missing locally → fresh pinned checkout/install and active resolved-config tests rather than skipped checks.
- Usage changes alter accounting, not task-solving ability → distinguish normalized reconstruction, real-case feedback/score and performance claims.

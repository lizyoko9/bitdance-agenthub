## Context

The next case is E2-shard-stderr-003 at TraceTrial-Bench 98a381307184fa4212db3466b21b4c92a031940b. The official resolver reports fixed_turns with ten messages and no session reset; runtime declares multi_turn/openclaw_native_v1/1800 seconds. TaskSpec separately allows fourteen user inputs, 140 tools and 2400 seconds. Both sheets contain only rules: fifteen Harness and eighteen Agent items.

Current admission, request validation and native normalization require one original input/root. The E2 verifier reads only trace/run-* and tool_result.content or named streams; current AgentHub traces use trace/agenthub and merged output. Production Bash does not label the channels. The pinned bin/ci is a regular 2299-byte file, Git100644/mode0644, SHA256 a2b6ca8f8776a06749ba7acb476e909e3c47c4c7293f83b7a3c071c78e47f2e6; official preparation preserves permissions and has no executable-bit setup. A direct command cannot exercise stderr without an explicitly disclosed environment repair.

## Goals / Non-Goals

**Goals:** Faithfully deliver the original ten inputs to one real AgentHub conversation, preserve shared full-task budgets and actual turn/run evidence, correct only evaluation transport compatibility, distinguish delivered content from missing stream provenance, and run one approved fresh Actor with complete deterministic scoring.

**Non-Goals:** Production Bash/channel/history/prompt/security changes; replaying hidden tool history, pinning all messages, restoring lost codes, stock OpenClaw execution, child agents, arbitrary conversations, new dependencies, Judge calls, private-grader instructions, content edits, automatic retries or an untouched-stock-environment claim.

## Decisions

### 1. Narrow admission and request contract

Only E2-shard-stderr-003 receives a fixed-turn compatibility mapping for its declared openclaw_native_v1 profile. Validate official resolver mode fixed_turns, exactly ten string messages, first equal to task.prompt, no session reset, runtime multi_turn/none/runnable and no extra setup mechanisms. Retain all original source hashes, declared runtime1800 seconds and effective TaskSpec2400 seconds.

Extend only the TraceTrial request schema with optional strict conversation: {mode: fixed_turns, turns: string[]}. The original instruction field remains and must equal turns[0]. The first element is the initial prompt, not an additional input. Single-input requests and Terminal-Bench's strict schema stay unchanged. Worker validates all ordered per-message UTF-8 hashes, count, first instruction, task identity and budget before receiving credentials or launching the actor; counts alone are insufficient.

### 2. Source-bound v3 budget and explicit setup envelope

Retain old v2 plans and their strict reconstruction without reinterpretation. Only the new E2 plan uses schemaVersion3 and adds conversation: {mode: fixed_turns, turnSha256: [ten ordered hashes]}. Other taskBudget/overrides/actor/sources/coverage fields keep their existing roles. actor.userInputs is10; source envelopes also bind the original turns.json file hash.

| Limit | Effective value | Meaning |
|---|---:|---|
| User inputs | 10 | Original fixed sequence; TaskSpec ceiling14 separately retained |
| Tools | 140 | Shared across every run |
| timeoutMs | 2400000 | One trial-wide deadline |
| maxTurns | 141 | Per-AgentRun model-loop ceiling, not user turns |
| maxRequests | 150 | Shared HTTP: 140 tools plus ten final-response opportunities |
| maxRequestBytes | 262144 | Per HTTP serialized body |
| maxTotalRequestBytes | 39321600 | 37.5MiB shared body capacity |
| maxCompletionTokens | 8192 | Per HTTP output ceiling |

Coverage checks use tools+ten inputs for shared HTTP, tools+1 for each run's maxTurns, and exact task tools/time. Fourteen is a user ceiling, not four extra messages or a reason to claim arbitrary fourteen-input coverage. 149 requests in task mode must reject rather than clamp. Limits, actual per-run loops, shared model/HTTP counts and bytes are reported separately.

Retain the old agenthub_tracetrial_run_plan_v1 envelope for existing tasks. E2 uses a v2 envelope adding the exact workspaceSetup policy, original path/hash/mode and target mode, bound to the same source task hashes and validated budget digest. A preflight-only explicit --workspace-setup-policy e2-bin-ci-executable-v1 selection records the requested repair; no selection leaves the non-executable fixture unsupported. No generic chmod or caller-selected path/mode is accepted. Actual use of this policy requires the approval requested for this change and trial.

### 3. Metadata-only fixture setup, visibly different execution conditions

Original pinned source remains unchanged. After copying the workspace and before the measured baseline, verify bin/ci is a regular non-symlink with the pinned bytes/hash and expected original mode0644, then change only the copied file mode to0755. Persist artifacts/workspace-setup.json with policy, source/Git identity, copied path, before/after mode and byte hashes, timestamp and outcome. Baseline creation occurs after this setup, and both original-source and runtime-baseline provenance remain available. Refuse unexpected source mode/content, extra changes or any failed receipt.

No-model image/workspace probes verify the shebang interpreter, executable permission and /dev/urandom availability without running bin/ci or consuming a code. Record this as setup-repaired custom AgentHub execution in admission, protocol and report; official score rules remain unchanged, but results do not claim stock untouched environment equivalence. The alternative, silently trying bash/python wrappers, is rejected because the public task requires direct invocation.

### 4. One production conversation, sequential driver inputs

Create one profile/adapter/SQLite/conversation for the whole trial. Add a headless evaluation send(instruction) operation returning the existing service's messageId and runIds; retain legacy start() behavior. Register event subscription before sending a message. A controller conversation-turns.jsonl receipt records actual submission/boundary times, ordered input hash, userMessageId, root IDs, native event line ranges and per-turn outcome; it is distinct from original production events.

Advance only after the current turn has complete/completed/allRunsSettled, a real submitted message and fully closed expected root lifecycle. Model stop closes that turn; text such as DONE never skips the remaining official inputs. Failure, abort, unknown, zero roots, exception, missing closure or timeout prevents every subsequent submission. Do not send future inputs early or concatenate them into one prompt.

Use one absolute deadline/AbortSignal across all ten inputs and the existing once-created request/tool closures. A per-turn executeTrial wrapper receives only remaining time; worker/BoundedUpstream retain their single monotonic deadline and constrain each actual HTTP. SDK timeout2400000 is only an upper bound, not a resettable trial budget. Keep one15-second TS drain allowance and existing35-second outer worker grace, neither a fresh task-solving budget. Closing/recreating runtime or policies between turns is prohibited.

### 5. Preserve the measured production context policy

Use unmodified AgentRunner/buildHistoryFor. It currently selects the latest twenty complete DB messages, then serializes public text/code/artifact placeholders and applies model token limits; raw tool parts are not replayed across runs. Tool-loop assistant rows also consume the twenty-row selection even when they render empty. Consequently, earlier codes or the initial prompt can disappear; this is measured behavior, not an evaluation-adapter reason to pin/replay/expand history. No claim of full-history retention follows merely from using one conversation. Test the real service/SQLite/fake-fetch path and disclose observed retention gaps separately from stream metadata gaps.

### 6. Source-bound canonical conversation and output alias

Keep old single-root normalization and trace/agenthub behavior for existing tasks. E2 alone writes one canonical conversation under trace/run-agenthub-conversation; do not create a second equivalent trace. Use one contiguous sequence with one conversation_started/finished and ten conversation_turn_started/finished pairs around actual validated native roots. Derive conversation counts, status, last_event_seq and trace_complete from ordered controller receipts, actual user messages and each fully closed native lifecycle. Missing/repeated/reordered turns, root or message mismatch, late events, collisions and unclosed tools cannot acquire completion. Retain exact native files, payloads, IDs and per-line references; controller-derived boundaries name the ledger/hash sources rather than masquerading as production events. Writing back the final summary uses its actual path rather than a hard-coded agenthub directory.

Only E2's Bash transport receives agenthub_transport_v3. Alongside the existing observed outer-callId mapping, add content exactly equal to raw_event.result.output with an explicit derived-field/source annotation. Keep output/native_tool_result/raw_event unchanged and reject conflicting existing content. Do not add stdout, stderr, exit_code or inferred status. The E2 verifier already reads native exitCode/isError recursively. Cross-run callId collisions reject rather than get silently reassigned.

Exercise the official result_text, provenance classifier and scorer consumption without models. Native output alone must reproduce the recognition gap; the verbatim content alias must recover payload visibility while the source classification remains unlabeled-aggregate. The six explicit stderr-provenance rules must be allowed to fail under today's production merged output; normalization cannot turn that absence into labels or success.

### 7. Zero Judge and one approved experiment

Use an explicit zero-rubric task set containing existing G1 and new E2. Check both official sheets still have zero rubrics and prohibit Judge HTTP even on an unexpected callback. Run the unchanged full fifteen/eighteen rules and original layered resolution/policy/attribution, preserving raw and effective outcomes. Do not reuse Mountcheck's rubric planner or charge Judge requests.

After specification/run approval, complete real resolved Python-to-TS/profile-to-SDK fake-fetch coverage and independent review, commit sources, build an immutable Linux runtime and perform no-model dependency checks. Reuse the existing authorized OpenAI credential for exactly one fresh Luna/none Actor; SDK retries0, no automatic Actor/scoring rerun. Planning reference$5 is not a hard cap. Current pricing reference: https://developers.openai.com/api/docs/models/gpt-6-luna.md (input$0.10/M, cached$0.01/M, cache-write$0.125/M, output$0.50/M). Request-byte limits are not token counts or a billing guarantee.

Retain source/mode/setup/runtime/image/budget/turn/native/canonical/provider/rule/usage artifacts, independent reviews and every failed/incomplete condition. Report payload capture, explicit provenance, cross-turn retention, Agent honesty and adapter/scorer limitations independently. Do not infer full-benchmark, multi-agent or leaderboard performance.

## Risks / Trade-offs

- Setup repair changes execution conditions → explicit separate approval and mode receipt; original source and bytes unchanged, no untouched-environment claim.
- Multi-run adapter falsely completes → validate real submissions and each root closure, with adverse lifecycle tests before paid execution.
- Content alias washes missing provenance → source-bound verbatim alias only; no channel labels or failure-field repair.
- History loses earlier evidence → preserve production policy and classify measured loss, do not repair it inside the evaluator.
- Shared helpers regress old cases → old v2/envelope/single-turn paths stay exact and require regression checks.
- Tool/time/HTTP budgets reset across turns → single runtime/policy/deadline plus first/last-turn allocation and fake-clock tests.

## Migration Plan

Only after approval, synchronize the affected capability contract and evaluation documentation in a specification commit; implement/test separately. No SQL or dependency migration. Existing task plans remain v2 and existing run envelopes remain v1. Local merge follows the actual trial/report/audit, without pushing. Rollback removes E2 admission while retained original trials remain immutable.

## Open Questions

Approval is required for the new evaluation request/plan contracts, the narrowly disclosed runtime-copy executable-bit repair and the one bounded paid Actor trial. There are no unresolved task-selection or model/credential choices.

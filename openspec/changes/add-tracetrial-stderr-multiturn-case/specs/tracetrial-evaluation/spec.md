## MODIFIED Requirements

### Requirement: TraceTrial integration SHALL execute AgentHub under its own identity

The integration MUST pin the benchmark revision and execute the actual AgentHub Application Services, adapter and tools inside a fresh task container. It MUST identify the harness as agenthub, preserve task instructions/workspace/scoring content and keep private grader material outside the actor context. Workspace metadata MUST also remain unchanged except for an explicitly approved, source-bound setup policy defined by this capability; any such exception MUST be separately disclosed and MUST NOT change pinned source content or metadata.

#### Scenario: The first E8 trial is started
- **WHEN** the authorized trial runs
- **THEN** native tools act on /workspace inside the container
- **AND** no stock harness or separate model tool loop substitutes for AgentHub.

#### Scenario: A runtime copy receives the approved E2 executable-bit repair
- **WHEN** the explicit setup policy changes only copied bin/ci from mode0644 to0755
- **THEN** source content/mode remain unchanged and an actual before/after mode and byte-hash receipt is retained
- **AND** the result is identified as setup-repaired custom execution rather than an untouched stock environment.

### Requirement: Native evidence SHALL remain faithful through normalization

Original native events MUST be retained with source references. Canonical records MUST preserve tool IDs, arguments, results, failure flags and known/unknown fields without repairing measured behavior. Only actually supported execution capabilities SHALL be declared. A versioned canonical transport envelope MAY add an observed outer native call ID as result-side metadata only when the exact original payload is separately retained, all derived fields name their native sources, and conflicting existing fields are rejected rather than overwritten. Only the admitted E2 case MAY additionally receive a canonical content alias exactly equal to native Bash output under its explicit projection version and source annotation. No stdout/stderr label, exit code, status or failure classification SHALL be inferred by that alias. Canonical metadata MUST NOT be presented as a captured full API wire message or as an added production payload field.

#### Scenario: A nonzero exit has a false native error flag
- **WHEN** normalization observes that combination
- **THEN** both values remain unchanged in the canonical result and native evidence
- **AND** official graders determine the resulting failure classification.

#### Scenario: The native transport carries a result call ID outside its payload
- **WHEN** the versioned projection maps it into canonical transport metadata
- **THEN** the exact original payload and raw event remain available with explicit provenance
- **AND** missing or conflicting IDs are never manufactured or silently corrected.

#### Scenario: E2 sees merged native output without stream labels
- **WHEN** the selected-case projection exposes the identical string as canonical content
- **THEN** original output/native payload/raw event remain unchanged and the alias names its native source
- **AND** the official consumer can read the payload while explicit stderr-provenance checks can still fail.

### Requirement: Actor and judge SHALL enforce distinct declared limits

Actor and judge MUST have independent actual HTTP, input-byte, output-token and wall-time bounds. The actor MUST respect the task's tool budget and distinguish user turns from internal model turns. Judge network retries MUST be disabled; all official JSON-correction reasks MUST count toward the judge budget. Limits MUST be checked before additional side effects or requests. Task-mode actor tools and total time MUST equal TaskSpec values; model/HTTP/aggregate-byte guards MUST cover the complete allowed single-input or explicitly admitted fixed-turn trajectory and final replies. For fixed-turn execution, all runs MUST share one tool/HTTP/byte budget and one deadline; a per-run maxTurns field MUST NOT be treated as the user-input count or reset the shared allowances. Unsupported technical domains MUST be rejected instead of clamping budgets. Smaller experiments MUST explicitly select constrained mode and retain limit sources.

#### Scenario: A rubric response is invalid JSON
- **WHEN** the official scorer requests its permitted correction
- **THEN** the new HTTP attempt consumes the same global judge budget
- **AND** exhaustion is recorded without a further request or fabricated result.

#### Scenario: A task permits eighty tools and twenty minutes
- **WHEN** its task-mode plan is resolved
- **THEN** it retains eighty tools and twenty minutes, with at least eighty-one model/HTTP opportunities and coherent aggregate-byte capacity
- **AND** shared TypeScript/SDK or worker defaults do not silently reduce those budgets.

#### Scenario: The selected E2 has ten fixed inputs and 140 tools
- **WHEN** its complete task-mode plan is resolved
- **THEN** it retains 2400 seconds and shared 140 tools/150 HTTP/39321600 body bytes, with 262144 bytes and8192 output tokens per request
- **AND** each run has maxTurns141, the fourteen-user-input TaskSpec ceiling remains separately recorded and no extra inputs are manufactured.

### Requirement: Selected tasks SHALL pass admission before actor execution

The runner MUST admit only the approved explicit task allowlist after validating the pinned task, supported conversation/runtime shape and all required execution capabilities, budget ceilings and judge coverage without model, fixture or container execution. Existing seven tasks MUST retain their single-user-input mappings. Only E2-shard-stderr-003 SHALL additionally admit the exact original ten-message fixed_turns/no-reset conversation through the explicit multi_turn/openclaw_native_v1 compatibility mapping. Unsupported tasks MUST retain an admission reason and no score. Effective actor settings MUST be serialized once and validated/enforced by both driver and worker; task user-turn limits MUST remain distinct from internal model turns. The E2 fixture's unavailable executable permission MUST reject admission unless its narrowly defined setup policy is explicitly selected and approved.

#### Scenario: An approved variant allows six user turns
- **WHEN** its single-turn runtime and other requirements match the declared support
- **THEN** admission permits one original user prompt with the approved independent internal-loop, HTTP, tool, byte, token and time limits.

#### Scenario: A task requires an unsupported execution mechanism
- **WHEN** no-model admission detects the missing capability or incompatible task shape
- **THEN** the runner records unsupported with a null score before any actor or paid request.

#### Scenario: An E2 plan has altered or reordered original messages
- **WHEN** host or worker compares count, first instruction, ordered hashes and source binding
- **THEN** it rejects before the Actor starts rather than combining, replacing or silently accepting the altered inputs.

## ADDED Requirements

### Requirement: E2 request and plan versions SHALL preserve existing evaluation contracts

Only the TraceTrial request SHALL accept an optional strict conversation object containing mode=fixed_turns and the ordered original turns array. Its first value MUST equal instruction and the E2 sequence MUST contain exactly ten inputs. An E2 v3 budget SHALL add the conversation mode and ordered UTF-8 turnSha256 values, with actor.userInputs=10 and sources/coverage based on the fixed protocol. A setup-bearing E2 run-plan v2 envelope SHALL bind the requested setup policy and original path/hash/mode to current source hashes and the budget digest. Existing v2 budget plans, v1 run-plan envelopes, Terminal-Bench requests and seven single-input cases MUST retain their meanings and strict validation.

#### Scenario: An old single-input plan is replayed
- **WHEN** it is validated by the extended implementation
- **THEN** its original version, actor settings, digest and single-input behavior remain valid and unchanged.

#### Scenario: An E2 task-mode plan allows only149 requests
- **WHEN** it is checked against the original ten-turn protocol
- **THEN** it is rejected as insufficient capacity rather than clamped or accepted as complete-task coverage.

### Requirement: Fixed-turn execution SHALL advance only from actual settled production runs

The headless evaluator MUST create one profile, adapter, SQLite database and conversation, then send each original input exactly once and in order through the production conversation service. Subscription MUST precede submission. Only a real current-turn user message and fully closed, normally completed root lifecycle SHALL permit the next input. A model stop MUST end only the current turn. Failed/aborted/unknown/unsettled/zero-root/exception/timeout outcomes MUST stop the sequence without future submissions. Future input text MUST NOT be inserted into an earlier model prompt.

#### Scenario: A normal reply contains DONE on turn3
- **WHEN** that turn completes normally
- **THEN** the evaluator sends original turn4 rather than treating the text as completion of the whole conversation.

#### Scenario: A turn fails or cancellation occurs between inputs
- **WHEN** the evaluator observes the failure or shared abort
- **THEN** no later original message is submitted and the trial cannot claim all ten turns completed.

### Requirement: Fixed-turn budgets SHALL use one runtime and deadline

All E2 runs MUST retain the same request/tool policy closures and global HTTP/byte counters. TS execution and the worker/upstream recorder MUST enforce one absolute or monotonic task deadline across the ten inputs; SDK timeout is an upper bound and MUST NOT reset the trial clock. Per-turn execution MUST receive only remaining time. Existing TS15-second drain and outer worker35-second grace MUST remain cleanup allowances rather than renewed task time.

#### Scenario: One turn consumes the whole allowed tool budget
- **WHEN** the other nine inputs need only final replies
- **THEN** both first-turn and last-turn tool allocations can finish within150 shared requests
- **AND** a later extra tool or HTTP cannot obtain a fresh allowance.

#### Scenario: Nine turns have consumed elapsed task time
- **WHEN** turn10 starts
- **THEN** its execution receives only the remaining deadline and a shared timeout aborts/drains without a fresh2400-second window.

### Requirement: E2 conversation traces SHALL be grounded in ordered turn receipts

The controller MUST retain separate turn receipts with original input hashes, actual userMessageIds, rootRunIds, source-native event line ranges and outcomes. E2 SHALL produce exactly one canonical conversation under trace/run-* and retain the original native files unchanged. Conversation and turn boundaries MUST reference these real receipts and closed native runs; original raw_event and native_tool_result MUST remain deeply equal to their sources. Complete status SHALL require one conversation start/finish, ten ordered turn start/finish pairs, coherent summary.conversation.turns_completed and an actual last_event_seq. Missing, duplicate, reordered, mismatched, collided or unclosed evidence MUST NOT receive complete status. The final summary MUST be written to its actual retained path.

#### Scenario: Ten root runs are concatenated without submitted-message evidence
- **WHEN** E2 lifecycle validation processes that record
- **THEN** it rejects the unsupported turn-completeness claim rather than deriving success from a count alone.

#### Scenario: One completed real conversation is normalized
- **WHEN** ordered receipts and all ten native root closures agree
- **THEN** the official E2 consumer finds one canonical run-* trace and the final event sequence matches the summary
- **AND** no duplicate trace or fabricated production boundary is introduced.

### Requirement: E2 setup repair SHALL be explicit and limited to one copied executable mode

Without the approved e2-bin-ci-executable-v1 policy, the original non-executable bin/ci SHALL remain unsupported before Actor requests. The approved policy MUST validate the pinned regular/non-symlink path, bytes and original mode, change only the runtime copy mode0644 to0755 before baseline creation, and persist original source/Git mode, before/after content hashes/modes and actual outcome. Original checkout and task/scoring content MUST remain unchanged. Unexpected source metadata, content, symlinks, extra changes or failed receipts MUST stop execution. No-model interpreter, permission and /dev/urandom probes MUST NOT execute the fixture or consume verification codes. Results MUST disclose repaired custom setup.

#### Scenario: The default preflight sees mode0644
- **WHEN** no approved explicit repair policy is selected
- **THEN** it records unsupported/null with zero Actor calls rather than running a permission failure as a stderr experiment.

#### Scenario: The authorized setup successfully adjusts the copied file
- **WHEN** before/after byte hashes remain equal and copied mode becomes0755
- **THEN** the receipt and repaired execution condition are retained alongside the untouched original-source provenance
- **AND** wrappers, task-content changes and silent environmental equivalence claims remain prohibited.

### Requirement: E2 scoring SHALL disable Judge and preserve measured context behavior

E2 MUST join the explicit zero-rubric task set only when the pinned sheets contain fifteen Harness and eighteen Agent deterministic rules and zero rubrics. Judge transport MUST be prohibited, including unexpected callbacks. Official criteria, consumption, layered resolution, policy and attribution MUST remain unchanged. E2 SHALL use unmodified production prompts, tools and context/history policy; the evaluator MUST NOT replay hidden tools, pin old messages, restore lost codes, add stderr labels or bypass actual memory selection to increase scores. Reports MUST distinguish payload visibility, stream provenance, cross-turn retention and adapter/scorer limitations.

#### Scenario: The zero-rubric scorer attempts an HTTP request
- **WHEN** the E2 scoring path receives that callback
- **THEN** it fails explicitly before any Judge network request.

#### Scenario: Earlier tool evidence is omitted by production history selection
- **WHEN** a later official input asks for the earlier one-time code
- **THEN** the normal production context path and measured outcome are preserved and reported rather than repaired by an evaluation-only history replay.

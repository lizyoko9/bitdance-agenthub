# TraceTrial Evaluation

## Purpose

Defines isolated execution of AgentHub against pinned TraceTrial-Bench mechanism tasks, faithful native execution evidence, bounded actor and judge requests, and official two-layer scoring. Runtime scope and interpretation are documented in `eval/tracetrial/README.md`.

## Requirements

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

### Requirement: Official rules and layered scoring SHALL remain authoritative

The integration MUST reuse the pinned official verifier, rubric prompts, evidence extraction, score resolution, evaluation policy and attribution. Omitting declared LLM rubrics SHALL produce a partial result; a task whose official sheets declare zero rubrics MAY receive a complete official deterministic layered score without a Judge model request. Native execution failure, apparatus failure, judge failure, Harness score and Agent score MUST be reported separately.

#### Scenario: The actor completes but a harness criterion fails
- **WHEN** official scoring completes
- **THEN** the native execution outcome and the failed criterion are both retained
- **AND** voluntary model stop does not imply task or harness success.

#### Scenario: The selected governance task declares zero rubrics
- **WHEN** its complete official layered scoring runs
- **THEN** Judge model transport is prohibited and the reported Judge request count is zero
- **AND** the original deterministic Harness and Agent outcomes are retained.

### Requirement: Trial provenance and interpretation SHALL be explicit

Artifacts MUST include source/task/runtime hashes, platform, actual settings, original and normalized traces, actor/judge observations and official raw/effective score outputs. Credentials MUST be redacted, missing usage MUST remain unknown, and a one-task custom-adapter run MUST NOT be presented as a full benchmark or official leaderboard score.

#### Scenario: The pinned network profile differs from its Docker implementation
- **WHEN** bridge networking is used as in the pinned official runtime
- **THEN** the report records the profile/runtime distinction and does not claim operating-system-level network disconnection.

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

### Requirement: Canonical lifecycle metadata SHALL reflect validated native completeness

The adapter MUST derive terminal canonical trace completeness from the same full native lifecycle validation used by its summary. It MUST preserve original events, source references, tool results and measured failure fields. A failed, interrupted, unmatched or otherwise incomplete lifecycle MUST NOT be labeled complete.

#### Scenario: A completed native run has all calls and messages closed
- **WHEN** native validation confirms a single complete root lifecycle with no diagnostics
- **THEN** the final canonical run_finished and summary expose the same true completeness marker while original events remain unchanged.

#### Scenario: A tool call has no matching result
- **WHEN** normalization detects the dangling call
- **THEN** neither the terminal event nor the summary claims trace completeness.

### Requirement: Small-batch results SHALL retain individual trial boundaries

Each approved task MUST run once in a fresh container/output directory with no automatic actor or whole-scoring rerun. The batch MUST retain task/runtime/settings hashes and all individual raw/effective official outcomes, distinguish apparatus and Judge failures from scored criteria, and state its actual mechanism coverage without presenting a full-benchmark or leaderboard score.

#### Scenario: One trial cannot complete judging
- **WHEN** a Judge error or declared limit interrupts official scoring
- **THEN** its retained record remains incomplete with no fabricated full score and the other approved tasks retain their own independent records and budgets.

### Requirement: Governance task admission SHALL distinguish declared and effective limits

Only the pinned `G1-registry-cleanup-002` workspace-only single-turn profile SHALL be admitted through the explicit compatibility mapping. The runner MUST retain the upstream protocol identity and identify execution as AgentHub. Task-mode tools/time MUST be inherited from TaskSpec; a smaller effective experiment MUST be an explicitly constrained plan with all limits and sources recorded. It MUST NOT claim unimplemented stock-harness session/provenance capabilities or add a provider_executed observation without evidence.

#### Scenario: A constrained trial uses less than the official task budget
- **WHEN** its explicit constrained plan is admitted
- **THEN** the record includes the official and effective limits and constrained scope
- **AND** budget exhaustion is retained without an automatic retry or a capability conclusion.

### Requirement: Budget plans SHALL be validated and bound before execution

A standard-library shared contract MUST resolve and validate the budget plan on host and worker. Actual runs MUST provide the generated plan, match its task and effective request fields, and persist its digest and limit sources. Missing, stale, malformed or incoherent task-mode plans MUST fail before credentials, container creation or Actor requests. Plan generation MUST require no credential or execution. Runtime bundles MUST retain the shared contract and its hash.

#### Scenario: The worker receives a request with a lower tool count than the plan
- **WHEN** it validates the inputs
- **THEN** it rejects the disagreement before reading the key or starting a child process.

### Requirement: Resource exhaustion SHALL be reported independently of official scores

Observed task-budget and additional resource-limit exhaustion MUST be distinguished in a separate budget outcome with the limit source. The integration MUST preserve original termination and official scores, and MUST NOT infer exhaustion solely because usage equals a limit. Constrained scope and resource-limited outcomes MUST NOT be presented as unconstrained capability results.

#### Scenario: The model stops normally on its final allowed request
- **WHEN** no guard rejection or truncation is observed
- **THEN** the outcome remains completed rather than resource_limited.

#### Scenario: An explicit cumulative-byte guard rejects a request
- **WHEN** its actual rejection is recorded
- **THEN** the separate outcome identifies the resource limit while original benchmark grading remains unchanged.

### Requirement: Recognition diagnostics SHALL remain separate from official scoring

An explicit retained-evidence diagnostic SHALL preserve the pinned official checkout, original trial, original report and official score. It MUST label all recognition-extended results nonofficial, retain baseline and per-rule comparisons, verify input provenance and immutability, use fresh nonoverlapping output directories and prohibit Actor/model requests. Official criteria, typed status checks, report checks, rule identities and layered aggregation MUST remain unchanged.

#### Scenario: A retained Python deletion is not admitted by the original matcher
- **WHEN** the diagnostic replays its unchanged evidence with the documented recognition extension
- **THEN** it records separate unmodified-baseline, deletion-only and deletion-plus-inspection results with provenance
- **AND** no diagnostic result replaces the authoritative retained score.

### Requirement: Extended operation recognition SHALL require recorded and statically supported evidence

Python deletion recognition MUST statically bind supported literal targets without executing command text. Comments, string literals, dormant or ambiguous control flow, unknown or shadowed bindings and unsupported syntax MUST NOT establish deletion. Native directory inspection MUST validate complete successful structured listings, paths and sequence before proving candidate presence or post-delete absence. The extension MUST NOT invent execution, exit-code, status or output fields.

#### Scenario: A string mentions a removal function
- **WHEN** the command only prints or defines an unused deletion expression
- **THEN** it is not classified as an executed deletion operation.

#### Scenario: A later directory listing is partial or failed
- **WHEN** the diagnostic examines it for missing targets
- **THEN** it does not treat omitted names as evidence of absence.

### Requirement: Timeout case admission SHALL require measured observation capabilities

The integration SHALL admit only the explicitly selected E6-timeout-error-channel-003 single-input profile after validating its pinned source, task-derived budget, timeout/post-tool mapping and installed Linux process observer. Effective Actor time MUST be the TaskSpec 120 seconds with six tools and coherent seven-turn/request capacity. All four official rubrics MUST be scored under unchanged bounded Judge policy.

#### Scenario: Runtime declares a longer timeout than TaskSpec
- **WHEN** E6 admission resolves its plan
- **THEN** effective time remains 120 seconds and the separate 600-second runtime declaration is retained without a silent min/clamp.

### Requirement: Process cleanup evidence SHALL be measured before external cleanup

The opt-in evaluation observer MUST verify an exclusive PID namespace baseline, identify processes by PID/start ticks without UID/PGID filtering, and freeze actual post-Actor live residual observations before any forced Worker or container cleanup. It MUST never send signals, invent descendant history, infer cleanup from kill invocation, convert failed scans into zero, or overwrite a failed frozen receipt. Native payloads and production cleanup behavior MUST remain unchanged.

#### Scenario: A detached process survives natural Actor exit
- **WHEN** either final census observes its new live identity
- **THEN** the receipt records a nonzero residual and false cleanup validity even if later container cleanup removes it.

#### Scenario: Actor execution reaches its wall-time limit
- **WHEN** the Worker is about to terminate the Actor
- **THEN** it first freezes forced-stop failure evidence and preserves that receipt after cleanup.

#### Scenario: A final census cannot be completed reliably
- **WHEN** permissions, malformed records, identity races or baseline drift prevent reliable measurement
- **THEN** tracking failure is explicit and an unknown residual count is not reported as zero or successful cleanup.

### Requirement: Timeout observer serialization SHALL preserve native field provenance

An E6-only versioned evaluation bridge MAY map a uniquely correlated strict native boolean `timedOut` into the flat observer `timed_out`. It MUST archive the unmodified helper evidence and retain original values, source file hashes/pointers and row identity. True and false MUST use the same rule; missing values MUST NOT be inferred and malformed/conflicting aliases MUST be rejected. Native/canonical payloads, other observer fields and helper-derived gate decisions MUST remain unchanged and MUST NOT be presented as newly executed production behavior.

#### Scenario: Native camelCase timeout is true
- **WHEN** the pinned helper fails to recognize its name but native identity and strict boolean value are unambiguous
- **THEN** the evaluation observation may carry that same true value with explicit projection provenance while raw helper evidence and native bytes remain available.

#### Scenario: Native timeout alias is false or malformed
- **WHEN** the bridge evaluates the source
- **THEN** false remains false and malformed or conflicting fields cannot be converted into a successful timeout observation.

### Requirement: Confirmation case admission SHALL preserve full task budgets and measured process evidence

The integration SHALL admit only pinned L2-deploy-latency-001 as the selected single-input confirmation-state profile. Task-mode Actor limits MUST retain 140 tools/2400 seconds and coherent 141 internal-turn/HTTP capacity with declared byte/output guards. The separate 1800-second runtime declaration MUST remain recorded without clamping TaskSpec. L2 MUST use the existing measured process receipt/schema and only supported native/post-tool/process-containment capabilities. E6 timeout-specific capabilities and serialization MUST remain E6-only. Both official L2 rubrics MUST be covered.

#### Scenario: L2 is admitted without a timeout-specific requirement
- **WHEN** the pinned single-turn profile and full budget pass admission
- **THEN** the actor receives one original prompt and the complete task-mode capacity
- **AND** its process evidence uses the existing immutable pre-cleanup receipt without applying the E6 timeout bridge.

### Requirement: Container lifecycle projection SHALL be grounded in actual archive and cleanup outcomes

For L2 the driver SHALL preserve its original lifecycle stage log and expose the official container_lifecycle.json consumer format as an explicitly versioned AgentHub projection with original source path/hash and stage provenance. The projection MUST identify its AgentHub producer/schema and record explicit same-container identity on each referenced stage. Archive success MUST require observed successful copying and the declared required native evidence verified as regular non-symlink files with path/size/hash; cleanup success MUST require observed successful removal of the same created container. Missing, nonzero, raised, ambiguous or conflicting outcomes MUST NOT become complete. Original exceptions and available stage evidence MUST be retained before propagating apparatus failure, preserving the primary driver/container exception separately from later cleanup/persistence errors. Expected channel exit 75 or a failed native tool MUST NOT become a container error_type. Process cleanup observations MUST NOT substitute for container archive/removal evidence.

#### Scenario: Copy fails but removal succeeds
- **WHEN** the archive operation is nonzero or raises and later Docker removal succeeds
- **THEN** the lifecycle receipt retains archive failure and non-null error_type while separately recording cleanup success
- **AND** the trial cannot be presented as successful archival.

#### Scenario: Stages are missing or refer to conflicting containers
- **WHEN** lifecycle source evidence cannot establish successful archive and removal for the same created container
- **THEN** the projection retains failure or unknown state rather than manufacturing complete fields.

### Requirement: Confirmation-state experiments SHALL preserve observed channel state and scoring boundaries

The integration SHALL run one fresh Actor from the unchanged public task instructions and retain original native feedback, official verifier/rubrics and raw/effective scores with no automatic rerun. Independent audit MUST distinguish accepted/submitted state from authoritative confirmation, and separately inspect typed exit and failure status. Recognizer/report-text limitations MUST be attributed from retained evidence without modifying task instructions, artifacts or official scores.

#### Scenario: A submitted operation returns a nonzero wait-window status
- **WHEN** the actor receives the native result and later reconciles the audit
- **THEN** the trace retains both observations unchanged
- **AND** only actual authoritative confirmation evidence can justify confirmed final delivery claims.

### Requirement: Confirmation Judge capacity SHALL cover its measured retained evidence without widening other task defaults

The L2 Judge SHALL use an explicitly declared 512KiB single serialized request guard while retaining the existing ten-HTTP, 2MiB cumulative, 4096-output-token and 600-second guards. Other tasks and generic requester defaults MUST remain 256KiB. The integration MUST record actual selected guards in admission/scoring settings and measure full unchanged official rubric inputs before a retained-evidence continuation. Capacity failures MUST retain incomplete/null results, never fabricated rubric values.

#### Scenario: The retained L2 trajectory produces a request above 256KiB
- **WHEN** exact unchanged official prompt serialization fits the approved 512KiB and the worst same-prompt correction total fits 2MiB
- **THEN** one explicitly authorized scoring continuation may use those limits in a fresh output directory
- **AND** the original Actor, report, payloads, failure fields and incomplete grading remain unchanged.

#### Scenario: A scoring view needs relocated files
- **WHEN** copied retained inputs are evaluated in a fresh directory
- **THEN** only the declared events_path, summary_path and execution_probe_evidence fields may point to byte-verified copies with an explicit relocation map
- **AND** original source provenance and all measured/native evidence remain unchanged.

### Requirement: Mountcheck admission SHALL require measured native terminal observation

The integration SHALL admit only pinned E8-mountcheck-exit-masked-003 through the selected allowlist, preserving TaskSpec six tools/120 seconds and coherent seven-turn/request capacity. It MUST expose native_exec_v1/post_tool_v1/native_terminal_completion_v1 using actual validated lifecycle and terminal evidence, without inventing success, provider execution or Claude-specific behavior. The single public prompt, original fixture and official scoring MUST remain unchanged.

#### Scenario: A native trace lacks a valid completed terminal lifecycle
- **WHEN** the selected case is normalized
- **THEN** failed/incomplete terminal evidence remains failed/incomplete rather than being repaired by capability declaration.

### Requirement: Mountcheck Judge input planning SHALL precede paid transport

Before the selected case sends its first Judge HTTP request, the integration MUST render all unchanged official rubric prompts from its actual retained rule/evidence state, confirm every actual requested prompt including corrections matches its planned prompt/hash/bytes with at most two calls per rubric and validate both peak body size and worst same-prompt correction cumulative bytes against the declared256KiB/2MiB guards. The plan MUST retain size/hash provenance. Infeasible evidence MUST remain incomplete without any Judge HTTP, evidence trimming, fabricated grades or automatic guard changes. The Actor MUST run once with original instructions and no automatic rerun.

#### Scenario: Full rubric evidence exceeds a declared byte guard
- **WHEN** the exact post-Actor input plan is checked before transport
- **THEN** grading retains an explicit resource limitation and zero Judge HTTP instead of sending a partial unplanned grading run.

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

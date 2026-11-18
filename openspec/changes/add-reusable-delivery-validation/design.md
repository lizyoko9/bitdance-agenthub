## Context

Dispatched children can report acceptance results and the supervisor can run required commands. Ordinary Agent completion records execution status. E2 showed a separate content issue: an Agent authored both an output and its expected shape, and its script accepted a shape the user had explicitly prohibited. A check applied to an earlier draft also misses later edits.

## Goals / Non-Goals

**Goals** include an opt-in workspace-file delivery flow, an isolated child Agent to propose rules and functions, reusable stored revisions, and reproducible checks on submitted bytes.

**Scope for v1** is one conversation and its current workspace, with explicitly selected saved revisions and separately recorded checks. Cross-conversation sharing, semantic grading, autonomous repair, arbitrary JS/Python execution and benchmark integration are deferred.

## Decisions

### Conversation entry and final submission

Add a compact Delivery validation panel for a conversation. The user selects one or more prior user messages or excerpts, names the expected workspace-relative files, and chooses an existing non-orchestrator Custom Agent configuration. Generating a draft is an explicit operation. The screen shows the source quotes, checked paths, rules, function expressions and a source-to-check coverage list. Each selected requirement must be mapped to at least one check or shown as unverified. The user reviews that mapping and can approve a qualified draft, list and select saved revisions, and click Validate current files. This last action submits the candidate snapshot for evaluation and can be repeated as the producer fixes files. Plain messages and intermediate writes trigger neither generation nor validation.

Use scoped list, draft, activate, revoke and validate operations in the conversation API with Zod input validation and the existing conversation access pattern. The server resolves conversation, workspace, referenced user messages and selected existing Agent configuration. The UI displays generator errors separately from check failures. An invalidated plan stays visible as historical data when its conversation remains readable. The service may decline missing, foreign or stale references. v1 supports read-only workspace-file checks and displays delivery status alongside run state. It does not reclassify `run.end` or make a dispatched task auto-submit.

### Child generator input and lifetime

The delivery workflow calls a purpose-specific child through AgentRunner, reusing the Custom adapter and credential resolution for the selected Agent. Record the generator run ID and attach a live parent run ID where present. A user-triggered workflow outside an active producer run still records the job's originating user message and generator run. Generate before inspecting any candidate bytes. The model receives only bounded selected user requirement text, user-selected file aliases/formats and the grammar. Match proposed rule references to those inputs server-side. Use a fixed generation prompt and empty history, attachments, inherited Skills and tool permissions. Use Custom only, because other adapters may make native tools available.

For this purpose, enforce zero allowed tool operations at execution before publication or dispatch, independent of advertised definitions. Ordinary Custom execution can resolve names via the registry even if their schemas were absent, so keep this guard in the generation path. Do not include workspace paths, submitted files, old reports or benchmark-private material in generation prompts. The schema accepts one bounded JSON draft from the completed response. Limit one request per explicit draft invocation, zero retries, max 4096 output tokens, 45 seconds and at most 16 KiB total user excerpts. Cancel with the owning action and discard partial, invalid, cancelled or stale results. A generator never waits on a producer, invokes another generator or occupies a dispatch semaphore while awaiting a child. Reuse and validation execute no model requests. Verification during development uses fake transport.

### Rule and function representation

Persist a typed data representation for functions and display a readable rendering in the review. For example:

```text
check tally(rows, summary) =
  equals(count(rows), add(summary.deleted, summary.kept))
```

Support basic file presence, JSON shape and Markdown ATX heading checks outside code fences. Support finite, typed expression nodes for literal values, declared input aliases, field access, type checks, boolean combinations, equality, count, sum, addition, and bounded per-item predicates. Expressions operate over named JSON or UTF-8 text snapshots supplied by the host. A per-item predicate can catch a JSON map value that is an object where a string or null is required. Use the runtime interpreter for these expressions. It has no host functions, shell, dynamic code loading, general loops, network or direct workspace access. Limit at most 32 checks, 256 expression nodes total, 12 levels of nesting, 10,000 evaluation steps and bounded diagnostics. Use finite numeric values, own-key property lookup, strict types and errors for missing or unparseable inputs. Unsupported requirements stay explicitly unverified.

Validate syntax, declared operands, unique IDs, source refs, operators and limits before saving any actionable draft. Require independent expected outcomes before a generated function becomes a hard check. Run framework fixture cases for built-ins and record a verified positive and negative fixture for each custom function before activation. The user reviews the rule and expected outcomes, including any Agent-suggested examples. A generated claim of passing supplies no qualification by itself. In v1 unsupported requirements are recorded as unverified and user activation does not grant new capabilities.

### Immutable plans and evidence

Keep a revision table and a separate receipt table in SQLite. Each revision records an ID, stable plan ID, revision, conversation and workspace binding, selected message refs and exact excerpt hashes, requirement digest, input bindings, rules/function definition and definition hash, engine version, generator run/model, qualification results and activation/revocation metadata. The rules, sources, scope and parameters are immutable. A changed requirement, binding or function produces a new revision. Old revisions remain reviewable and reusable only with their original current source and matching workspace, and only by explicitly selecting that exact qualified revision. Unsupported engines, edited/deleted requirement sources and rebound workspace roots invalidate existing bindings. History clear and conversation deletion must not leave usable orphan rules or pending activation.

A validation receipt records revision ID, rule/engine hashes, input-file hashes and the outcomes. Files are bound to their submitted snapshots, not just filenames. Change in output bytes leaves the prior receipt valid as history and current delivery unverified until checked again. Do not save complete workspace bytes or API secrets in plans or receipts. Each read uses a framework-owned allowlist of user-selected inputs and workspace containment with symlink rejection, regular-file checks, bounded read and snapshot consistency checks. Cap 8 files at 256 KiB per input and 1 MiB total. Never validate a truncated prefix as complete. Missing required files fail presence checks. Invalid data, absent inputs, unsupported features and system errors cannot silently pass. When a concrete format check detects malformed JSON it fails; checks that depend on unavailable parsed data are unverified.

### Reporting and reuse

A check result names the requirement, file or structured path, expected and observed type or value, and status. A required failure makes the delivery failed. Missing, stale, unsupported or incomplete verification leaves the affected requirement unverified. Overall pass requires at least one hard check, all mandatory checks passing on the current snapshot and every mandatory requirement covered by a qualifying check. An empty generated plan or uncovered mandatory requirement cannot pass. Before committing a receipt after asynchronous file I/O, recheck activation/revocation, the live requirement references and workspace binding, and commit only if they remain eligible. Keep generation/qualification errors distinct from delivery failure. Reuse reads an activated plan version by ID and applies it to current snapshots in the same binding. No new generation is needed when file bytes change. Do not bind by similar filenames, substitute the latest version, re-enable a revoked plan or copy benchmark-specific expected outputs.

## Risks / Trade-offs

- Generated checks can mirror producer mistakes → generate from authorized requirements, validate source references, qualify each custom function against reviewed counterexamples and freeze the definition before use.
- Permissions can leak through inherited context or registry dispatch → use a dedicated no-tools, no-Skills, no-history generator purpose and enforce rejection before any tool side effect.
- Later workspace edits can make a pass appear current → bind each receipt to snapshot hashes and require a fresh read before claiming the receipt covers current bytes.
- Expressive constraints can be unsupported by the interpreter → report the specific unmet coverage and let the user judge it separately.

## Migration Plan

Add tables to the local Drizzle schema/bootstrap and keep existing SQLite data readable. Wire the feature behind its explicit conversation entry. Test a fresh database and upgrading one with ordinary conversations, run and artifact records. Use the local Next 16.2.6 guides before route/component edits. Update the project index and detailed specs with activation, retention, snapshot and cancellation semantics. Reverting the feature disables the entry and preserves existing table data.

## Open Questions

The user confirmed the bounded function representation, explicit activation and same-conversation scope with “按方案实现（推荐）”. Development verification uses fake model transport.

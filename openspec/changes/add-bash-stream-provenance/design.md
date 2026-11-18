## Context

Native `bash` currently attaches the same append callback to both child pipes and retains up to 10,000 UTF-16 code units in one string. `chunk.toString('utf8')` also decodes each chunk independently. The E2 trace therefore contains diagnostics but cannot establish their pipe of origin. Process failure classification already has a separate, observed-fact contract and must remain intact.

The successful tool-result value is JSON throughout the registry, Custom adapter, AgentRunner, SQLite `messages.parts`, SSE/store and result-detail formatter. Named fields can travel through that path without SQL columns or new generic event types. SDK-owned shell implementations are separate tools.

## Goals / Non-Goals

**Goals:** expose truthful retained stdout/stderr, describe omissions, preserve legacy consumers, and prove capture and transport with no model requests.

**Non-Goals:** change exit classification, blacklist/approval rules, shell selection, capture capacity, history/compaction, SDK shell results, official benchmark scoring, or retained benchmark evidence. A paid E2 rerun requires a separate bounded plan.

## Decisions

### 1. Add pipe fields to obtained observations

Add `stdout: string`, `stderr: string`, `stdoutTruncated: boolean`, and `stderrTruncated: boolean` to the existing obtained Bash value. Keep `output`, `truncated`, lifecycle facts, wrapper `isError`, status and failure unchanged in meaning. Rejected commands and spawn errors retain the existing error branch. Pre-spawn cancellation retains its existing obtained aborted observation; empty strings mean no text observed, not proof that a child ran or reached EOF.

Capture text at the actual stdout/stderr callbacks. The labels describe the shell pipes after redirection: `2>&1` can place a program's diagnostic in the stdout pipe. Never infer channels from words or split an old merged result. Nonempty stderr is not a failure classifier.

### 2. Share the existing capture budget

Keep a single 10,000-UTF-16-unit budget over retained decoded text. The named strings partition the retained raw merged text; they do not each receive a separate allowance. `output` retains that merged view and the existing synthetic truncation/interruption/cleanup notes. Named strings contain actual decoded pipe text only.

Once any text is omitted, freeze capture globally. If a surrogate-safe prefix leaves one unused code unit, do not fill it from a later callback. Continue decoding and observing subsequent data to set the omission flag for each affected pipe. Flags describe observed text omitted by this cap; timeout or destroyed streams can leave unseen data and do not themselves prove cap truncation.

Separate 10,000-unit buffers would enlarge capacity and change budget semantics. Parsing labels from `output` would invent provenance. The chosen additive contract preserves the existing cap, but stdout can still consume it before late stderr arrives; fair allocation, spill files and recovery are separate work.

### 3. Decode each pipe incrementally

Use one built-in `node:string_decoder` UTF-8 decoder per pipe. Feed Buffer chunks independently; flush each decoder at most once on its end event, with an idempotent fallback during result finalization. Do not wait for end: forced pipe destruction may proceed directly to close. Keep settlement, error, abort, timeout and inherited-stdio cleanup guards, and ignore data after settlement.

Choose a Unicode-safe retained prefix at the shared cap. This intentionally corrects split UTF-8/surrogate edge cases; ordinary output and existing annotations remain compatible. The merged order is the order in which decoded text becomes available to the tool, not a guaranteed global ordering of writes across two OS pipes. Windows keeps its existing UTF-8 preamble; the tool cannot guarantee the encoding of every external program.

### 4. Verify generic transport without widening it

Keep the existing `output` preview, supervisor diagnostic fallback and canonical `content` alias. Full result JSON carries the four new fields into model tool messages, persisted messages and result details. Do not duplicate named fields into canonical `content`. Actual serialized request-byte guards remain unchanged; the additive contract carries roughly one extra copy of retained raw text, plus escaping and field overhead, rather than increasing the capture cap.

Validation will exercise safe child processes and controlled streams, the Custom tool-result request path using fake transport, and persistence/consumer paths where needed. A fresh native observation can pass through the existing canonical projection and pinned E2 provenance helper to establish `typed-stderr`; this is a consumer regression, not a benchmark score or evidence of solving the original E2 case. No old trace is relabeled or rescored.

## Risks / Trade-offs

- Additional serialized text and repeated tool history increase request size → retain the shared cap and actual UTF-8 JSON-byte guards; measure representative request changes without changing admission limits.
- Lifecycle races can flush twice or lose the final decoder fragment → make decoder finalization idempotent and retain single-settlement/evidence guards; cover close/end/error/abort races.
- Cap flags could be mistaken for a completeness guarantee → document their narrow size-omission meaning alongside existing interruption and cleanup metadata.
- Provenance can be mistaken for benchmark success → report only the observed capture/transport checks; keep first-turn/model behavior and official gates outside this change.

## Migration Plan

After contract approval, implement capture and focused tests, synchronize the tools capability and detailed tool/platform wording, run focused regressions plus typecheck/lint, and commit implementation separately from planning. The generic JSON storage needs no migration. Historical records remain readable with absent fields. Rollback is an ordinary code revert; no stored evidence is rewritten.

## Open Questions

None for this scope. The user confirmed the additive result contract and no-model regressions on 2026-11-18: “按方案实现并做无模型回归（推荐）”. No paid benchmark rerun is included.

# Verification

## Implemented and reviewed

Shared strict usage parsing and per-response snapshots now feed request observers and Custom run/message events. Snapshots accumulate once after a response. Cache aliases use documented precedence, explicit zero remains valid, invalid/missing request values remain null. New Custom usage JSON carries the optional inputTokensIncludeCache marker; shared store/API/UI arithmetic consumes it per record, preserving legacy unmarked totals. Message reconciliation and persistence retain the marker. No SQL column or DDL changed, so no db:push was needed.

Production implementation commit: bbe0222. Detailed and capability contracts were synchronized before implementation. Independent review found no blockers. The user received the root causes and core total formula before the real trial.

## Checks

- Relevant production TypeScript: 9 files, 139 tests passed; the corrected required event fixture subsequently passed all five store tests.
- Actual consumer coverage includes store totals/groupings, a Next GET handler and AgentRunner/SQLite reload and event preservation.
- Final typecheck and lint passed at c2c1a86; temporary mobile dependency symlink removed.
- Retained L2 normalized reconstruction preserves the original provider-summary hash and all 135 original trial files. Cache-write parses as 73,326 after alias repair; input/output 373,270/2,585 gives total 375,855 through the actual consumer helper, versus the incorrect double-counted 749,062. This is synthetic normalized reconstruction, not SSE replay or a new score.

## Actual evidence

One approved E8-mountcheck-exit-masked-003 trial ran at immutable runtime/controller commit c2c1a86d28ba9b36318e524d8e14ce2e438102db. Runtime identity is established by the build archive/image chain, not the headless manifest, whose commit field remains null inside the no-Git runtime.

Three requests reported input 8,056, output 155, cache-read 5,212 and cache-write 2,835. The independent usage audit passed 53 checks with no issues: recorder and ledger mutually-known values agree per request; run totals, lastInput 2,838, message values/markers and read-only SQLite objects match. The actual shared helper returns prompt 8,056/total 8,211 for native and persisted records. Message schema does not expose cache-write; its absence is not a measured zero. The original trial did not change during auditing.

Official raw/effective scores were both 100/pass (Harness 8/8, Agent 4/4), but there was no paired same-task pre-fix trial. This supports the observed accounting fix and E8 feedback regression, not a claim that accounting raised task performance. Unknown historical values, billing accuracy, UI live rendering and public usage emission on all abort/error paths were not established.

Full report: eval/tracetrial/results/2026-11-17-mountcheck-and-usage.md. Local fast-forward merge is recorded after final report review; no push is authorized or performed.

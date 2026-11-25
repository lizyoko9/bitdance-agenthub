## Decisions

AgentRunner uses the synchronous SQLite query methods already used by history snapshots and message-part flushers. Each adapter event's message mutation (or in-memory delta append) is immediately followed by publication with no asynchronous boundary. Derived artifact/deploy parts and synthesized tool or message terminal events follow the same rule. Error visualization, unresolved tool failures and terminal status writes use the same synchronous write and publication boundary.

The two snapshot readers retain their current synchronous cursor capture, flush and read. This requires no event schema changes, extra per-delta DB writes or transport changes.

The regression drives AgentRunner with a scripted adapter and queues a snapshot around the write boundary. It inspects SQLite-derived full and paged snapshots and passes the retained events through the existing frontend replay projection.

Both readers exposed a stale cursor on the previous revision for text deltas, tool results, and normal message completion. The repaired replay excludes those events when the read already contains their changes and still returns later events. The tests also cover the synthesized tool failure when a run throws. The isolated release verification passed 665 tests with 12 skipped and used no model provider.

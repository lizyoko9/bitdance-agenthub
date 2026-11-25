## Why

AgentRunner yields between updating message state and publishing the corresponding sequenced event. SQLite writes and buffered deltas can already be visible to a snapshot at that point. A snapshot with the older event cursor then causes the client to replay an update it already contains.

## What Changes

- Apply AgentRunner message mutations and publish their events in one synchronous execution turn.
- Keep both history snapshot formats, SSE event shapes, and the coalesced delta-write window.
- Verify the boundary with real SQLite, the streaming runner, and deterministic offline replay.

## Capabilities

### New Capabilities

### Modified Capabilities

- `stream-events`: runner message state and snapshot cursor consistency.

## Impact

AgentRunner persistence and publication, streaming recovery verification, and the message snapshot contract. This change uses the existing synchronous SQLite methods.

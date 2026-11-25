## Why

The event replay window limits the number of events. A workload with large deltas can retain substantially more memory than one with the same event count and smaller payloads.

## What Changes

- Apply a shared 32 MiB UTF-8 JSON payload budget to EventBus replay alongside the existing count policy.
- Replay a publish-time snapshot of each retained event. Reuse the existing snapshot recovery path when a reconnect cursor crosses an evicted gap.
- Verify delivery and retention with synthetic events.

## Capabilities

### New Capabilities

### Modified Capabilities

- `stream-events`: byte-bounded replay, immutable replay snapshots and gap detection.

## Impact

Server-side EventBus storage and replay. The SSE event and cursor formats are unchanged.

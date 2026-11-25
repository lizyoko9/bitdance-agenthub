## Why

The backend now bounds event replay. The web client can still retain an unlimited event queue while recovery waits for its snapshot and can apply queued events without that snapshot after a failure. The chat also loads full message histories, keeps visited histories in memory, and renders every loaded row.

## What Changes

- Bound and cancel client SSE recovery and retry failures with backoff.
- Add web history pages, bound resident chat history, and render a variable-height viewport window.
- Keep deep links, approvals, optimistic sending and live streaming consistent across recovery, pagination and eviction.
- Compare heap, mounted message count and user-visible behavior on a browser fixture without model calls.

## Capabilities

### New Capabilities

### Modified Capabilities

- `stream-events`: bounded, cursor-aware recovery.
- `frontend`: seekable web history, bounded caches and virtualized chat rows.

## Impact

Web StreamProvider, message history routes, chat state and message navigation. Existing full-history consumers retain their current response. No dependency or database migration.

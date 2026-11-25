## Recovery

- A recovery attempt owns a snapshot generation, abort controller and bounded SSE queue. Count decoded event payloads at their UTF-8 wire length before adding them to the queue, with limits of 1,000 events and 4 MiB. Control events do not occupy queue entries.
- Fetch the latest message page and its event cursor, conversation list and current approval state. Apply an accepted recovery snapshot and later events in order. Filter message events only where the snapshot covers the relevant conversation and sequence.
- On overflow, timeout or fetch failure, invalidate the incomplete attempt and release its queue. Retry recovery with bounded backoff. If all attempts fail, expose a retryable recovery state. Keep the previous accepted chat state visible until there is a usable snapshot. Track applied progress separately from received but uncommitted events.
- Abort prior attempts on disconnect, unmount, superseding recovery and active conversation changes. Keep approval reconciliation and message terminal state consistent.

## Web history and navigation

- Add `GET /api/conversations/:id/messages/history` with latest, older, newer and around-message windows. Use the stable persisted pair `(createdAt, id)` for keyset pagination. Return oldest-to-newest messages, continuation information and a synchronous snapshot event cursor. Use 50 rows per request by default. Keep the existing full-history endpoint for mobile and export.
- Keep up to 200 settled messages in the active contiguous chat window and retain the two most recently used inactive histories. Preserve active or optimistic messages, drafts and approvals independently. Eviction releases both row objects and window metadata. A history jump replaces the window when it crosses a gap and provides a path back to the latest messages.
- Track a bounded per-conversation record of live mutations and removals by SSE cursor. A late history response preserves newer row state, skips removed rows and yields to an intervening accepted recovery snapshot.
- Render a variable-height overscanned viewport slice with measured spacers. Maintain the visible message anchor during prepend and remeasurement, and follow live output while the viewport is at the latest end.
- Use one message-ID navigation path for search, pin, outline and quotes. Load an around-message window when necessary and scroll after mounting the target. Preserve edit and regenerate decisions using server-derived eligibility rather than an arbitrary history-window boundary.

## Acceptance

Test exact queue limits, stalled snapshots, retries, reconnects, conversation switching, chronological cursor tie-breaks, stale fetches, eviction with drafts and active runs, history navigation, variable row heights, and live bottom-follow. In Chromium, use deterministic fixture histories to measure mounted rows and JavaScript heap and exercise navigation with no paid requests.

### Verification results

The same 600-message synthetic fixture in local Chrome went from 600 mounted rows and 76,405,076 bytes of post-GC used JS heap to 4 mounted rows and 19,096,044 bytes. The current history case also checks the older-page anchor after prepend, a jump to an unloaded pin, and return to the latest message. The compatible delivery receipt flow passed its Chrome regression. These are single fixture measurements with test data and local font responses, and required no model requests.

## Decisions

- Limit replay to 32 MiB of UTF-8 encoded event JSON before SSE framing. This measures retained payload size independently of entry count. JavaScript objects, heap usage and per-connection queues have separate overheads.
- Preserve the current count policy. With the default target of 5,000 entries, crossing 10,000 compacts to at most the latest 5,000. On each publish, evict oldest entries until both limits are satisfied. Retain only a contiguous suffix.
- Serialize once when booking an event for replay and store that immutable string. The message runner can mutate the original part as deltas arrive. A replay uses the published state and later deltas in sequence. Decode only requested replay events. Live subscribers receive the same immediate event object as before.
- An event larger than the complete budget or an event that cannot be serialized ends the retained suffix. Preserve live dispatch. A reconnect that needs the missing event gets the existing `resync` signal, while a cursor at or after it can replay later retained events.

## Verification

Use synthetic multi-conversation events and the existing snapshot projection. Cover UTF-8 and JSON byte accounting, additive budgets, contiguous replay, oversized events, and mutable message parts. Capture payload and heap measurements separately.

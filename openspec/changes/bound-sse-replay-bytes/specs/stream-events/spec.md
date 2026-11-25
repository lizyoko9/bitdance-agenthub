## ADDED Requirements

### Requirement: SSE replay SHALL bound retained event payloads

EventBus MUST retain a contiguous suffix of publish-time event snapshots under both the event-count policy and a 32 MiB total UTF-8 JSON payload budget. The byte budget excludes SSE framing. Live event delivery and event IDs MUST be independent of replay eviction.

#### Scenario: Byte pressure evicts events before the count threshold
- **WHEN** adding an event would exceed the byte budget
- **THEN** EventBus evicts the oldest events until the bytes fit
- **AND** a cursor that needs an evicted event follows the ordinary resync path.

#### Scenario: One event exceeds the entire replay budget
- **WHEN** a serializable event is individually larger than the replay budget
- **THEN** it still reaches live subscribers and receives its normal event ID
- **AND** a reconnect needing that event receives resync, while cursors at or after it can recover later retained events.

#### Scenario: Published part state is subsequently updated
- **WHEN** a published part object is mutated as later deltas arrive
- **THEN** replay returns the part snapshot from its original publication and the later deltas in order.

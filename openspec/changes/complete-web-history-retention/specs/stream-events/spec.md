## ADDED Requirements

### Requirement: The web client SHALL bound incomplete snapshot recovery

The web client MUST bound queued stream payloads by both event count and UTF-8 bytes during snapshot recovery. It MUST invalidate timed-out, failed, oversized or superseded recovery attempts and recover from a fresh snapshot with bounded retries. Only a current successful snapshot may establish the boundary for applying buffered events.

#### Scenario: A slow snapshot exhausts the recovery queue
- **WHEN** a recovery queue exceeds either limit
- **THEN** the client cancels that attempt and releases its queue
- **AND** it recovers from a new snapshot without applying the discarded suffix to an old snapshot.

#### Scenario: The active conversation changes
- **WHEN** the user switches conversations before a recovery snapshot completes
- **THEN** the previous attempt cannot overwrite the current conversation state
- **AND** the current recovery reconciles messages and pending approvals before applying subsequent covered events.

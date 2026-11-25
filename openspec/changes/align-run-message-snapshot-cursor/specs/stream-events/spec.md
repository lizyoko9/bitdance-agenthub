## ADDED Requirements

### Requirement: AgentRunner message publication SHALL agree with the snapshot cursor

AgentRunner MUST update message state and publish the corresponding SSE events without an asynchronous boundary between the mutation and publication. A snapshot obtainable between execution turns MUST NOT include a message update whose event follows its cursor.

#### Scenario: A snapshot is requested as the runner appends a delta
- **WHEN** the runner observes a delta and the snapshot is requested around the mutation
- **THEN** the full and paged readers either omit the delta and return a cursor that permits replay, or include it and return a cursor covering its event
- **AND** applying subsequent buffered message events does not append the same delta again.

#### Scenario: A tool result or terminal message state is recorded
- **WHEN** the runner records a tool result or terminal message mutation and publishes its event
- **THEN** the snapshot includes that change only with a cursor covering the corresponding publication.

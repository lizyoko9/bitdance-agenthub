## ADDED Requirements

### Requirement: Web chat history SHALL load and render bounded windows

The web chat MUST load recent, older, newer and around-message history windows through cursor-based routes while retaining the full-history contract for existing consumers. It MUST bound cached settled histories and rendered rows independently, preserve optimistic and active message handling, and restore evicted history from persisted data.

#### Scenario: The user loads an older page
- **WHEN** a user loads earlier messages in a long conversation
- **THEN** the server returns a stable page with no gaps or duplicate keys inside the requested range
- **AND** the visible row stays anchored while the client renders only the viewport and its overscan.

#### Scenario: A navigation target is outside the resident history
- **WHEN** the user jumps to an unloaded search result, pin or quoted message
- **THEN** the web chat loads a window containing the target, mounts and highlights it
- **AND** the user can return to the latest window.

#### Scenario: SSE updates a message while a history request is pending
- **WHEN** an older history response arrives after a newer live update, terminal outcome, or removal
- **THEN** the history window preserves the newer message state or deletion.

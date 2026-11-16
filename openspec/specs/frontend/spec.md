# Frontend

## Purpose

Defines client state, event application, and major UI boundaries. Detailed frontend notes live in `specs/09-frontend-architecture.md`.

## Requirements

### Requirement: Frontend SHALL consume server APIs and SSE

The frontend MUST use REST routes and SSE stream events; it SHALL not import or call LLM SDKs directly.

#### Scenario: User sends a message
- **WHEN** the UI posts to the messages API
- **THEN** server-side AgentRunner invokes the adapter
- **AND** UI updates arrive through SSE events.

### Requirement: Store reducers SHALL apply StreamEvent deterministically

Zustand reducers MUST update conversation, message, artifact, pending write, pending bash command, dispatch, and usage state from `StreamEvent` payloads.

#### Scenario: `part.delta` arrives
- **WHEN** the event references an existing part
- **THEN** the store appends content to that part without reordering other parts.

#### Scenario: A failed run leaves an open tool call
- **WHEN** `run.end` arrives with `status='failed'` or `status='aborted'`
- **THEN** the store marks streaming messages from that run as terminal
- **AND** appends local error `tool_result` parts for any unmatched `tool_use` call ids.

### Requirement: Artifact preview SHALL be separate from chat rendering

The UI MUST render artifact previews in a dedicated panel and render chat artifact references as cards or links.

#### Scenario: User clicks artifact ref
- **WHEN** an `artifact_ref` part is selected
- **THEN** the preview panel opens the referenced artifact.

### Requirement: Preview URLs SHALL be one-click actions

For `web_app` artifacts and ready deployment status parts, the UI MUST provide open and copy actions for the preview URL. Deployment cards SHOULD distinguish local previews from externally published static deployments.

#### Scenario: Deployment card is ready
- **WHEN** a `deploy_status` part has `status='ready'`
- **THEN** the chat renders a deployment card with open and copy controls.

#### Scenario: Deployment card has external publish metadata
- **WHEN** a `deploy_status` part has `deploymentType='external_static'`
- **THEN** the card labels it as an external static publish
- **AND** shows the local preview fallback when available.

### Requirement: Agent builder SHALL expose adapter-specific fields

Create/edit agent UI MUST show provider, model, tool, key, and base URL fields according to selected adapter semantics.

#### Scenario: User selects Codex adapter
- **WHEN** `adapterKind='codex'`
- **THEN** provider and AgentHub tool checkboxes are hidden
- **AND** Base URL copy says it must support Codex/Responses.

### Requirement: Usage consumers SHALL normalize prompt totals per record exactly once

For marked records inputTokens MUST be treated as the total prompt including cache details; for unmarked records the legacy prompt total MUST remain inputTokens+cacheReadTokens+optional cacheCreationTokens. Shared pure arithmetic MUST drive message totals, conversation/store groups and the usage-summary API before aggregation. Cache counters MUST NOT be added again to marked input. Display labels and hit-rate denominators MUST reflect total prompt semantics without provider-independent billing-rate claims.

#### Scenario: Marked and historical usage are mixed
- **WHEN** the UI or API aggregates both kinds of records
- **THEN** each record is normalized by its own marker and total equals normalized prompt plus output
- **AND** by-agent/model groups agree with the aggregate rather than depending on current provider settings.

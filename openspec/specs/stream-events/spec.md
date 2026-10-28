# Stream Events

## Purpose

Defines the event contract connecting adapters, AgentRunner persistence, SSE transport, and frontend reducers. Detailed event shape lives in `specs/02-stream-events.md`.

## Requirements

### Requirement: StreamEvent SHALL be the only live update protocol

All agent output, tool activity, artifact creation, pending approvals, dispatch state, and usage updates SHALL flow through `StreamEvent` before reaching the UI.

#### Scenario: Adapter emits text
- **WHEN** an adapter starts a text part
- **THEN** AgentRunner persists the part
- **AND** EventBus publishes the same event to SSE subscribers.

### Requirement: SSE transport SHALL support gap recovery
The SSE endpoint SHALL tag every StreamEvent with a monotonic `id` (`<bootId>-<seq>`) and keep a bounded replay buffer. Details live in `specs/02-stream-events.md` §断线恢复.

#### Scenario: Short disconnect
- **WHEN** a client reconnects with a `Last-Event-ID` still inside the replay buffer
- **THEN** the server replays every event after that id before streaming new ones.

#### Scenario: Unrecoverable gap
- **WHEN** the id is from a previous process, older than the buffer, or malformed
- **THEN** the server sends a `resync` control message
- **AND** the client refetches snapshots and applies only queued message events newer than the snapshot's `eventId`.

#### Scenario: Delta persistence
- **WHEN** an adapter emits `part.delta`
- **THEN** AgentRunner coalesces DB writes per 100ms window and flushes before any message snapshot read and when the stream ends.

### Requirement: Message streaming SHALL be bracketed

Each agent message MUST begin with `message.start` and finish with `message.end`, with part and tool events associated to the message id between those boundaries.

#### Scenario: Run completes normally
- **WHEN** the final adapter event has been consumed
- **THEN** the message status is updated to `complete`
- **AND** the run ends with status `complete`.

### Requirement: User messages SHALL be broadcast to all clients

A newly created user message MUST be published as a `message.added` event carrying the full message, so that clients other than the sender (e.g. a desktop client viewing a conversation a mobile client just posted into) insert it in real time. The message is already persisted by the time the event is published, so subscribers MUST apply it idempotently by message id rather than re-creating it.

#### Scenario: A second client receives another client's user message
- **WHEN** a user message is created from any client
- **THEN** EventBus publishes a `message.added` event with the full message row
- **AND** every other subscribed client upserts it by id
- **AND** the sending client (which already inserted it optimistically and reconciled via the POST response) is unaffected.

### Requirement: Message removals SHALL be broadcast to all clients

When messages are deleted server-side (withdraw, edit-and-resend, or regenerate), the deletion MUST be published as a `message.removed` event carrying the removed `messageIds` and `artifactIds`, so that clients other than the initiator drop them in real time. Subscribers MUST apply it idempotently (re-removing already-removed ids is a no-op), so the initiating client — which already reconciled via the HTTP response — is unaffected.

#### Scenario: A second client sees a withdraw/edit/regenerate
- **WHEN** withdraw, edit-and-resend, or regenerate deletes messages from any client
- **THEN** EventBus publishes a `message.removed` event with the deleted messageIds and artifactIds
- **AND** every other subscribed client removes those messages and artifacts by id.

### Requirement: Usage events SHALL update durable accounting

Adapters SHALL emit `message.usage` and `run.usage` when provider usage data is available, and AgentRunner MUST persist those payloads without coupling to provider-specific token fields.

#### Scenario: Codex reports turn usage
- **WHEN** Codex emits `turn.completed.usage`
- **THEN** the adapter emits `message.usage`
- **AND** the adapter emits `run.usage` with the effective model id.

### Requirement: Deployment events SHALL inject deploy status parts

Adapters SHALL emit `deploy.status` when an AgentHub deploy tool finishes, and AgentRunner MUST convert that event into a `deploy_status` message part.

#### Scenario: Deploy tool returns ready
- **WHEN** `deploy_artifact` or `deploy_workspace` returns a ready deployment record
- **THEN** the adapter emits `deploy.status`
- **AND** AgentRunner persists and publishes a `part.start` for `deploy_status`.

### Requirement: Bash approval events SHALL drive pending command UI

When a command approval gate is triggered, AgentHub MUST publish a pending command event and a resolved command event so all connected clients can render and clear the approval state.

#### Scenario: Key command waits for approval
- **WHEN** an agent requests a command that requires approval
- **THEN** AgentHub publishes `bash_command.pending` with the command, cwd, agent id, run id, and reason.

#### Scenario: Pending command is resolved
- **WHEN** the user approves, rejects, or the run is aborted
- **THEN** AgentHub publishes `bash_command.resolved`
- **AND** frontend reducers remove that pending command id.

### Requirement: Errors SHALL be visible in conversation state

Failures MUST be represented in both AgentRun status and conversation-visible message content.

#### Scenario: Provider rejects a request
- **WHEN** the adapter throws a provider error
- **THEN** AgentRunner marks streaming messages as `error`
- **AND** persists and publishes error `tool_result` events for unresolved tool calls in the run
- **AND** appends or creates a visible `[失败]` message.

# Adapters

## Purpose

Defines the AgentPlatformAdapter contract and provider-specific boundaries. Detailed adapter notes live in `specs/05-adapter-interface.md`.

## Requirements

### Requirement: Adapters SHALL translate provider output to StreamEvent

Each adapter MUST expose `stream(input, signal)` and yield only AgentHub `StreamEvent` objects to the application layer.

#### Scenario: Custom model emits tool calls
- **WHEN** Chat Completions streaming returns function tool call deltas
- **THEN** CustomAgentAdapter accumulates arguments
- **AND** emits AgentHub `tool.call` and `tool.result` events.

### Requirement: CustomAgentAdapter SHALL use Chat Completions compatible providers

CustomAgentAdapter SHALL call OpenAI Chat Completions-compatible endpoints for DeepSeek, OpenAI, and Volcano Ark, with provider-specific base URLs and keys.

#### Scenario: DeepSeek model responds with reasoning
- **WHEN** DeepSeek streams `reasoning_content`
- **THEN** the adapter emits thinking parts
- **AND** includes reasoning content in the assistant message for subsequent turns.

### Requirement: ClaudeCodeAdapter SHALL bridge SDK tool approvals

ClaudeCodeAdapter MUST use `@anthropic-ai/claude-agent-sdk` and route supported tool approvals through AgentHub path checks, pending writes, and command blacklist policy.

#### Scenario: Claude Code proposes a file write in review mode
- **WHEN** the SDK asks to use a write/edit tool
- **THEN** the adapter creates a pending write
- **AND** waits for user approval before allowing the SDK tool.

### Requirement: Claude skills SHALL use isolated owned files

ClaudeCodeAdapter MUST create fresh skill directories under a verified workspace parent chain, reject symlinked parents, and use invocation-unique skill names in both frontmatter and SDK filtering. An empty skill set MUST be passed explicitly to avoid loading unrelated workspace skills. Cleanup MUST remove only the files and empty directories created by that invocation whose identities still match.

#### Scenario: Workspace skills parent is a symlink
- **WHEN** `.claude` or `.claude/skills` is a symlink
- **THEN** skill materialization is refused without writing or deleting its target.

#### Scenario: Concurrent runs use different skills
- **WHEN** two runs materialize skills in the same workspace
- **THEN** their directories differ even when names or indexes collide
- **AND** finishing either run does not change the other run's files.

#### Scenario: Users add files to a materialized directory
- **WHEN** cleanup finds unrelated files or replaced directories
- **THEN** it preserves those resources rather than recursively deleting them.

### Requirement: CodexAdapter SHALL use the Codex SDK

CodexAdapter MUST use `@openai/codex-sdk` `runStreamed()` rather than treating CLI spawn as the primary integration path.

#### Scenario: Codex run starts
- **WHEN** a Codex agent receives a prompt
- **THEN** the adapter starts or resumes a Codex thread
- **AND** translates thread, item, tool, and usage events into StreamEvent.

### Requirement: SDK adapters SHALL expose allowlisted AgentHub tools through MCP

Claude Code and Codex adapters MUST expose allowlisted AgentHub tools through adapter-owned MCP bridges rather than consuming per-agent `toolNames`.

#### Scenario: Codex creates and deploys an artifact or workspace build
- **WHEN** Codex calls the AgentHub MCP `write_artifact`, `deploy_artifact`, or `deploy_workspace` tool
- **THEN** the adapter translates the MCP result into `artifact.create` or `deploy.status`.

#### Scenario: SDK agent asks a structured user question
- **WHEN** Claude Code or Codex calls the AgentHub MCP `ask_user` tool
- **THEN** AgentHub routes it through the shared pending question flow.

### Requirement: Codex Base URL SHALL be Responses compatible

CodexAdapter MUST only accept Codex/Responses-compatible endpoints for `apiBaseUrl`; Chat Completions-only providers such as DeepSeek MUST be rejected or reported with a clear compatibility error.

#### Scenario: User configures DeepSeek for Codex
- **WHEN** `apiBaseUrl` points at `api.deepseek.com`
- **THEN** the adapter rejects the run before reconnect loops
- **AND** the error tells the user to use CustomAgentAdapter.

### Requirement: SDK runtime configuration SHALL be isolated

CodexAdapter MUST set `CODEX_HOME` and `CODEX_SQLITE_HOME` to AgentHub-managed data paths and strip unrelated external `CODEX_*` variables except certificate configuration.

#### Scenario: User has CC Switch configured locally
- **WHEN** AgentHub starts Codex SDK
- **THEN** the child runtime does not read the user's `~/.codex` config
- **AND** AgentHub per-agent settings determine key and base URL.

### Requirement: Custom adapter SHALL support opt-in evaluation request policy

CustomAgentAdapter SHALL accept an optional runtime request policy for evaluation-controlled request parameters, transport retry settings, and shared preflight limits. Omitting that policy MUST preserve normal application behavior and the existing StreamEvent contract. All calls MUST retain AbortSignal cancellation.

#### Scenario: A bounded Luna evaluation runs through Chat Completions
- **WHEN** the evaluation profile selects gpt-6-luna
- **THEN** requests explicitly set reasoning_effort to none and the configured completion limit
- **AND** SDK retries follow the evaluation policy.

#### Scenario: The normal application runs without an evaluation policy
- **WHEN** the adapter is constructed normally
- **THEN** existing request defaults and tool behavior remain unchanged.

### Requirement: Custom adapter SHALL expose per-request usage observations

When an evaluation observer is installed, the adapter MUST report each actual request's identity, response model metadata, status, and available usage independently of run.usage events. Observation MUST occur before a caller can stop consuming the generator at a tool call. Observations MUST NOT contain authentication headers or credential values.

#### Scenario: Orchestrator planning stops after plan_tasks
- **WHEN** a planning request has already received usage and the caller stops after the tool event
- **THEN** its request-level usage remains recorded alongside later execution and aggregation requests.

#### Scenario: OpenAI reports cached prompt tokens
- **WHEN** usage includes prompt_tokens_details.cached_tokens
- **THEN** the observer records that field with its provider-specific meaning.

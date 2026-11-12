# Agent Builder

## Purpose

Defines how users create and edit non-orchestrator agents from the UI. Detailed behavior lives in `specs/10-agent-builder.md`.

## Requirements

### Requirement: User-created agents SHALL default to Custom adapter

New agents MUST default to `adapterName='custom'` unless the user selects Claude Code or Codex SDK adapter.

#### Scenario: User opens create dialog
- **WHEN** no existing agent is being edited
- **THEN** adapter kind defaults to Custom
- **AND** provider defaults to DeepSeek.

### Requirement: New custom agents SHALL start with an editable harness prompt

The create dialog MUST prefill `systemPrompt` with a concise Custom agent scaffold that explains goal handling, context loading, tool use, artifact output, workspace safety, and final response expectations.

#### Scenario: User opens create dialog
- **WHEN** no existing agent is being edited
- **THEN** the System Prompt field contains the default Custom agent scaffold
- **AND** the user can edit or replace it before saving.

### Requirement: Custom agents SHALL require provider and model

Custom agents MUST have `modelProvider` and a non-empty `modelId`; SDK agents SHALL ignore `modelProvider`.

#### Scenario: User clears custom model id
- **WHEN** adapter kind is Custom
- **THEN** form submission is rejected.

### Requirement: SDK agents SHALL use built-in tool sets

Claude Code and Codex agents MUST persist `toolNames=[]` because their tools come from the SDK runtime rather than AgentHub `toolRegistry`.

#### Scenario: User switches from Custom to Codex
- **WHEN** the form is submitted
- **THEN** the saved agent has no custom tool names.

### Requirement: Custom agents SHALL expose structured question tooling

The agent builder MUST allow custom agents to enable `ask_user`, and newly created custom agents SHOULD include it in the default tool set.

#### Scenario: User creates a custom agent
- **WHEN** the create dialog opens for a Custom adapter agent
- **THEN** `ask_user` is available in the tool checklist
- **AND** it is selected by default.

### Requirement: Custom agents SHALL provide tool presets

The agent builder MUST provide one-click tool presets for common custom-agent roles, including all-purpose, local-code, artifact, and review workflows.

#### Scenario: User selects local-code preset
- **WHEN** the user clicks the local-code tool preset
- **THEN** the selected tools include `deploy_workspace`, `read_artifact`, `fs_read`, `fs_write`, and `bash`
- **AND** artifact creation tools are not selected unless the user adds them manually.

#### Scenario: User creates a custom agent
- **WHEN** the create dialog opens for a Custom adapter agent
- **THEN** the default preset is all-purpose
- **AND** both artifact tools and local workspace file/command tools are selected.

### Requirement: Codex agent configuration SHALL reject unsupported base URLs

The agent builder MUST validate known unsupported Codex base URLs before saving or running the agent.

#### Scenario: DeepSeek URL is entered for Codex
- **WHEN** the Base URL host is `api.deepseek.com`
- **THEN** the UI shows a Codex/Responses compatibility error.

### Requirement: API key hints SHALL match adapter fallback

The UI MUST display key fallback hints that match AgentRunner's key resolution for selected adapter/provider.

#### Scenario: Codex key field is empty
- **WHEN** a Codex agent is saved without per-agent key
- **THEN** runtime falls back to app OpenAI key, `CODEX_API_KEY`, or `OPENAI_API_KEY`.

### Requirement: Agent creation SHALL expose a full-page Agent Studio

The main create-agent entry point MUST open a full-page Agent Studio that lets users choose template-based creation or custom creation.

#### Scenario: User clicks Create Agent from the agent library
- **WHEN** the user clicks the agent library's "Create Agent" action
- **THEN** the app navigates to `/agents/new`
- **AND** the page shows template-market and custom-creation entry points.

#### Scenario: User edits an existing agent
- **WHEN** the user edits an existing agent from the agent library or agent popover
- **THEN** the existing detailed edit dialog is shown
- **AND** edit validation and persistence behavior remain unchanged.

### Requirement: Built-in templates SHALL generate editable drafts

Agent Studio MUST provide built-in template blueprints that generate editable `AgentConfigDraft` values without creating database rows until the user confirms.

#### Scenario: User browses templates
- **WHEN** the user opens `/agents/new`
- **THEN** templates are shown as a full-width searchable/filterable card grid
- **AND** the page does not keep a template list sidebar beside the detail/configuration view.

#### Scenario: User selects a built-in template
- **WHEN** the user clicks a template card, "use template", or "view details"
- **THEN** the app opens a dedicated template detail/configuration view for that template
- **AND** it shows scenarios, recommended model, Skills preview, RAG needs, MCP needs, tool permissions, and risk level
- **AND** it creates an editable draft from the template.

#### Scenario: User saves a template-created draft
- **WHEN** the user confirms the draft
- **THEN** the app persists the agent through the existing `/api/agents` create path
- **AND** the saved agent is a normal user-created agent.

#### Scenario: Template references future specialization modules
- **WHEN** a template lists Skills, RAG needs, or MCP needs in Phase 1
- **THEN** those items are capability/dependency previews only
- **AND** no Skill, knowledge base, or MCP database configuration is persisted by the template path.

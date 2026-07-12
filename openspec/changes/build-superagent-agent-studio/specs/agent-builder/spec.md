## ADDED Requirements

### Requirement: Agent creation SHALL use a full-page Agent Studio entry
The agent builder SHALL provide a full-page Agent Studio for creating new agents, instead of relying only on a single configuration form.

#### Scenario: User starts creating an agent
- **WHEN** the user activates the main "Create Agent" action
- **THEN** the app opens the Agent Studio creation page
- **AND** the page offers both template-based creation and custom creation.

#### Scenario: User edits an existing agent
- **WHEN** the user edits an existing agent
- **THEN** the app may continue to use the existing detailed editor
- **AND** the edit path MUST preserve current validation and persistence behavior until it is explicitly migrated.

### Requirement: Template market SHALL create editable agent drafts
The Agent Studio SHALL allow users to choose an Agent template and convert it into an editable draft before any agent is persisted.

#### Scenario: User selects a template
- **WHEN** the user opens a template detail page
- **THEN** the UI shows the template's scenario, default behavior, recommended model, required Skills, knowledge needs, MCP needs, tool permissions, and risk level.

#### Scenario: User creates from a template
- **WHEN** the user chooses to use a template
- **THEN** the system generates an editable agent draft
- **AND** the user can change model, system prompt, Skills, knowledge bases, MCP servers, and tools before saving.

#### Scenario: User saves a template-created agent
- **WHEN** the user confirms creation
- **THEN** the app persists a user-owned agent through the normal agent creation service
- **AND** does not persist secrets from the template itself.

### Requirement: Agent templates SHALL be blueprints rather than live agent configs
Agent templates SHALL be reusable creation blueprints. User-created agents SHALL be independent instances after creation.

#### Scenario: Template changes after agent creation
- **WHEN** a template is updated
- **THEN** existing agents created from that template keep their saved configuration
- **AND** any upgrade to a newer template version requires an explicit user action.

#### Scenario: Agent is created from a template
- **WHEN** the agent is saved
- **THEN** the saved agent records the template source and a configuration snapshot sufficient to explain its origin.

### Requirement: Agent Studio SHALL configure specialization modules
Agent Studio SHALL let users configure Skills, RAG knowledge bases, MCP servers, and tool permissions as separate specialization modules.

#### Scenario: User configures Skills
- **WHEN** the user selects one or more Skills
- **THEN** the page shows the behavior/workflow those Skills add
- **AND** the final agent draft includes the selected Skill ids.

#### Scenario: User configures knowledge bases
- **WHEN** the user binds knowledge bases
- **THEN** the page shows which knowledge bases the agent can search
- **AND** the agent draft includes only those selected knowledge base ids.

#### Scenario: User configures MCP servers
- **WHEN** the user binds MCP servers
- **THEN** the page shows transport, trust level, connection status, and risk warnings
- **AND** the agent draft includes only those selected MCP server ids.

### Requirement: Agent Studio SHALL show a final capability preview
Before saving, Agent Studio SHALL show a capability preview that summarizes the model, system prompt, Skills, knowledge bases, MCP servers, tool permissions, and unresolved dependencies.

#### Scenario: Draft has missing dependencies
- **WHEN** the selected template or modules require missing configuration
- **THEN** the final preview blocks creation or clearly marks the missing dependency as required.

#### Scenario: Draft grants powerful tools
- **WHEN** the draft includes file write, bash, deploy, or external MCP permissions
- **THEN** the final preview shows those permissions and their approval policy before saving.

### Requirement: AgentHub SHALL provide a Skills marketplace
AgentHub SHALL present Skills in a marketplace-style browse view with categories, search, and sorting, covering both installed Skills and a curated catalog of not-yet-installed Skills.

#### Scenario: User browses the Skills marketplace
- **WHEN** the user opens the Skills marketplace
- **THEN** Skills are shown as cards, filterable by category with search and sort
- **AND** each card shows name, description, category, source, public state, and how many agents use it.

#### Scenario: User installs a catalog Skill
- **WHEN** the user installs a Skill from the curated catalog
- **THEN** AgentHub fetches its source through the hardened Skill fetch path (host allowlist + SSRF checks)
- **AND** shows a parsed preview (name/description/instruction only, discarding any tool-permission fields) before persisting it as an imported Skill
- **AND** the user click is the authorization; the LLM-driven approval gate is not required for user-initiated installs.

#### Scenario: User marks a Skill public
- **WHEN** the user toggles a Skill as public in the library/marketplace or Agent Studio
- **THEN** the Skill becomes part of every agent's effective Skill set
- **AND** the change does not alter any agent's explicitly selected Skill ids.

#### Scenario: Agent Studio shows public Skills as already attached
- **WHEN** the user configures Skills for an agent
- **THEN** public Skills are shown as already attached and do not consume a per-agent selection slot
- **AND** the user changes a Skill's public state from the library/marketplace, not from a single agent's config.

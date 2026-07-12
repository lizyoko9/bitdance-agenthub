## ADDED Requirements

### Requirement: Persistence SHALL store agent templates separately from agents
The database SHALL store reusable agent templates separately from user-created agent rows.

#### Scenario: Template is listed in the market
- **WHEN** the Agent Studio loads templates
- **THEN** it reads template metadata without requiring an agent row to exist.

#### Scenario: Agent is created from a template
- **WHEN** the user saves a template-created agent
- **THEN** the saved agent records the source template id and a snapshot/version reference
- **AND** later template updates do not mutate the existing agent row.

### Requirement: Persistence SHALL store Skill packs as reusable instruction modules
The database SHALL store Skills as reusable modules that can be selected by agents and templates.

#### Scenario: Agent selects a Skill
- **WHEN** the agent is saved with a Skill
- **THEN** the persisted configuration can resolve that Skill during AgentRunner context assembly.

### Requirement: Persistence SHALL mark Skills as public or opt-in
The `skills` store SHALL carry a public flag so a Skill can either be auto-attached to every agent (public) or selected per agent (opt-in). The flag SHALL default to opt-in so existing rows and agents are unaffected.

#### Scenario: Skill is marked public
- **WHEN** a Skill's public flag is set and the Skill is enabled
- **THEN** every agent's effective Skill set includes it during context assembly
- **AND** agents do not need to list it in their selected Skill ids.

#### Scenario: Skill is not public
- **WHEN** a Skill is not public
- **THEN** it is included only for agents that select its id.

#### Scenario: Public flag defaults to opt-in
- **WHEN** a Skill row is created or migrated without an explicit public flag
- **THEN** it defaults to opt-in (not public)
- **AND** existing agents behave unchanged.

#### Scenario: Marketplace-installed Skill records its source
- **WHEN** a Skill is installed from the curated catalog
- **THEN** it is stored as an imported Skill with its source URL recorded
- **AND** no tool-permission fields from the source are persisted.

### Requirement: Persistence SHALL store knowledge bases and document chunks
The database SHALL store knowledge bases, source documents, and searchable chunks for RAG-lite retrieval.

#### Scenario: Knowledge document is ingested
- **WHEN** a document is added to a knowledge base
- **THEN** its metadata and chunks are persisted
- **AND** retrieval can limit results to the agent's selected knowledge base ids.

### Requirement: Persistence SHALL store MCP servers globally and bind them per agent
The database SHALL define MCP servers globally and persist per-agent MCP server selections.

#### Scenario: Agent enables an MCP server
- **WHEN** the agent is saved with an MCP server id
- **THEN** runtime resolves that id from the global MCP server registry
- **AND** disabled or missing servers are not exposed to the agent.

### Requirement: Templates SHALL NOT persist user secrets
Agent templates SHALL declare required credentials and integrations, but SHALL NOT store user API keys or private MCP credentials as template defaults.

#### Scenario: Template requires an external service
- **WHEN** the user creates from that template
- **THEN** the template can ask the user to configure the dependency
- **AND** any secret value is stored only in the user's agent/settings/server configuration path.

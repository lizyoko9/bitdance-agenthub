## ADDED Requirements

### Requirement: Skills SHALL NOT grant executable permissions by themselves
Skills SHALL be reusable instruction/workflow packs. They SHALL NOT expand the agent's executable tool permissions unless the user also enables the required tools.

#### Scenario: Skill recommends a file-writing workflow
- **WHEN** the agent selects that Skill without `fs_write`
- **THEN** runtime may inject the Skill's workflow guidance
- **AND** the agent still cannot call `fs_write`.

### Requirement: Knowledge tools SHALL be scoped to bound knowledge bases
AgentHub SHALL expose knowledge retrieval through explicit tools scoped to the current agent's selected knowledge base ids.

#### Scenario: Agent searches knowledge
- **WHEN** the agent calls `search_knowledge`
- **THEN** results come only from knowledge bases bound to that agent
- **AND** returned snippets are bounded by the configured token/length limits.

#### Scenario: Agent reads a knowledge document
- **WHEN** the agent calls `read_knowledge_doc`
- **THEN** the document must belong to one of the agent's selected knowledge bases.

### Requirement: MCP tools SHALL use namespaced tool names
External MCP tools SHALL use namespaced names to avoid collisions with AgentHub-managed tools.

#### Scenario: MCP server exposes a tool
- **WHEN** the tool is made available to an agent
- **THEN** its name follows `mcp__<serverName>__<toolName>`
- **AND** the tool is available only when that MCP server is enabled for the agent.

### Requirement: Powerful specialization tools SHALL appear in capability preview
Agent Studio SHALL summarize file, command, deployment, knowledge, and external MCP permissions before saving an agent.

#### Scenario: Draft includes external MCP
- **WHEN** the draft includes any MCP server
- **THEN** the preview shows the server name, transport, trust level, and approval expectation.

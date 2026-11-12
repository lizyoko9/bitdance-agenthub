## ADDED Requirements

### Requirement: Adapter input SHALL include resolved specialization configuration
AgentRunner SHALL resolve an agent's selected Skills, knowledge bases, MCP servers, and tool policy before invoking an adapter.

#### Scenario: Custom agent run starts
- **WHEN** the agent has selected Skills and knowledge bases
- **THEN** CustomAgentAdapter receives system/context content and tools derived from the resolved specialization configuration.

#### Scenario: SDK agent run starts
- **WHEN** the agent has selected MCP servers
- **THEN** Claude Code or Codex adapter receives only the MCP servers enabled for that agent.

### Requirement: Adapters SHALL degrade gracefully when specialization dependencies fail
Specialization dependency failures SHALL be isolated and reported without crashing unrelated agent capabilities.

#### Scenario: One MCP server fails to connect
- **WHEN** an agent has multiple MCP servers enabled
- **THEN** the failed server's tools are not exposed
- **AND** the run can continue with other enabled tools when safe.

#### Scenario: Knowledge retrieval fails
- **WHEN** retrieval for a bound knowledge base fails
- **THEN** the adapter run reports a clear warning or tool error
- **AND** does not expose documents from unbound knowledge bases as fallback.

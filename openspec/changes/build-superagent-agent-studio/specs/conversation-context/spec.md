## ADDED Requirements

### Requirement: Agent specialization context SHALL be assembled in a deterministic order
AgentRunner SHALL assemble specialization context in a deterministic order so model behavior is explainable and testable.

#### Scenario: Agent has prompt, Skills, RAG, and tools
- **WHEN** AgentRunner builds the run input
- **THEN** it orders context as base system prompt, AgentHub safety/tool guidance, Skill instructions, retrieved knowledge snippets, MCP/tool availability, conversation context, and current user turn.

### Requirement: Skill instructions SHALL fit within context budget
Selected Skill instructions SHALL be injected within the model-aware context budget.

#### Scenario: Selected Skills exceed budget
- **WHEN** the combined Skill instructions are too large
- **THEN** AgentRunner keeps required safety/tool guidance
- **AND** trims or summarizes lower-priority Skill content before dropping current user context.

### Requirement: Effective Skills SHALL combine the public pool and per-agent selection
AgentRunner SHALL resolve an agent's effective Skills as the de-duplicated union of enabled public Skills and the agent's selected Skill ids, through a single resolution path shared by all adapters, before applying progressive disclosure.

#### Scenario: Agent has both public and selected Skills
- **WHEN** AgentRunner assembles Skill context
- **THEN** it includes all enabled public Skills plus the agent's selected Skills
- **AND** a Skill present in both is included once.

#### Scenario: Inline budget prioritizes agent-selected Skills
- **WHEN** the combined Skills exceed the inline budget
- **THEN** agent-selected Skills take inline priority over public Skills
- **AND** lower-priority Skills degrade to catalog + `load_skill` rather than being dropped.

#### Scenario: Disabled or missing Skill in the effective set
- **WHEN** a public Skill is disabled, or a selected Skill id is missing/deleted/disabled
- **THEN** it is excluded from the effective set at resolution time
- **AND** the run is not interrupted.

### Requirement: Retrieved knowledge SHALL be relevant and bounded
RAG content SHALL be injected only as relevant snippets or exposed through retrieval tools, not by dumping entire knowledge bases into the prompt.

#### Scenario: Agent has bound knowledge bases
- **WHEN** the user asks a domain question
- **THEN** runtime may retrieve relevant snippets from bound knowledge bases
- **AND** injected content is bounded by token/length limits.

### Requirement: Specialization modules SHALL NOT override safety constraints
Skills, template prompts, RAG snippets, and MCP descriptions SHALL NOT override AgentHub safety constraints or tool approval policy.

#### Scenario: Skill text conflicts with tool policy
- **WHEN** a Skill instruction tells the agent to write files directly
- **AND** the agent lacks write permission or is in review mode
- **THEN** the tool policy remains authoritative.

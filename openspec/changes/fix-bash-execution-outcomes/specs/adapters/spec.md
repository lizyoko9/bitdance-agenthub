## ADDED Requirements

### Requirement: Managed tool translation SHALL retain execution-error metadata

AgentHub tool consumers in CustomAgentAdapter and SDK MCP bridges MUST classify a result as an error when ok=false or successful-result isError=true. Successful-result values MUST remain intact for the model and corresponding native result surfaces. Consumers MUST NOT infer command success from output text. Omitted metadata MUST preserve existing behavior; command failure MUST NOT by itself abort the model's tool loop.

#### Scenario: Obtained command result carries an execution error
- **WHEN** an obtained tool value carries isError=true metadata
- **THEN** Custom tool.result and MCP results expose isError=true
- **AND** the original value remains visible to the model, allowing a later repair attempt.

#### Scenario: Existing tool omits metadata
- **WHEN** a successful tool returns only ok=true and value
- **THEN** existing non-error translation and content remain unchanged.

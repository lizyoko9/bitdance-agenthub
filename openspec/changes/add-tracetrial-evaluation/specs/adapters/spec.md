## ADDED Requirements

### Requirement: Custom adapter SHALL support opt-in evaluation tool preflight

CustomAgentAdapter SHALL allow an evaluation runtime to enforce a shared tool-call allowance before tool side effects. Omitting this policy MUST preserve ordinary tool permissions, safety checks and execution behavior. Budget rejection MUST remain distinguishable from model stop and preserve available accounting and evidence.

#### Scenario: An evaluated trial attempts another tool after exhausting its allowance
- **WHEN** the configured preflight rejects the additional tool
- **THEN** the tool does not execute
- **AND** the run records the budget reason rather than completing normally.

#### Scenario: The ordinary application has no evaluation tool policy
- **WHEN** a permitted tool is called
- **THEN** existing workspace, approval and command safety checks continue to apply.

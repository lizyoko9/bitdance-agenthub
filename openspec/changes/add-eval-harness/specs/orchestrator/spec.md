# Orchestrator Delta

## ADDED Requirements

### Requirement: Evidence gates SHALL be disableable for evaluation only

AgentRunner MUST keep evidence gates enabled by default. When the process starts with `AGENTHUB_EVAL_EVIDENCE_GATES=off`, child task completion MUST be taken from the child's own report without running `requiredCommands`, evaluating evidence requirements, or enforcing required project outputs. A child report with status `failed` or `blocked` MUST still fail the task.

#### Scenario: Gates disabled
- **WHEN** the server runs with `AGENTHUB_EVAL_EVIDENCE_GATES=off`
- **AND** a child task reports `complete` without required evidence
- **THEN** the dispatch task is treated as `complete`.

#### Scenario: Default
- **WHEN** the variable is unset or any other value
- **THEN** evidence gates behave exactly as specified in the evidence-gate requirements.

## ADDED Requirements

### Requirement: Tool results SHALL preserve obtained execution failures

The successful-result branch of ToolResult SHALL accept optional boolean isError metadata while retaining value. ok=true SHALL mean a tool result was obtained; isError=true SHALL mark a failed underlying action. Omitting isError MUST retain existing behavior. Tool failure without an obtained result SHALL retain ok=false and an error string.

#### Scenario: A command returns a nonzero exit
- **WHEN** Bash obtains a result with a nonzero exit code
- **THEN** it retains the complete bounded output and numeric exit code
- **AND** the successful-result wrapper carries isError=true.

### Requirement: Bash SHALL classify process outcomes consistently

Bash MUST compute failure from a nonzero or unknown exit code, a terminating signal, timeout or cancellation. The same classification MUST reach wrapper metadata, model-visible isError and failed/completed status, and command evidence. Existing result fields MUST remain available, with aborted and signal observations added. A failed command MUST remain available for subsequent model reasoning. Cancellation known before execution MUST prevent spawning; each command MUST record and settle at most once.

#### Scenario: Success-shaped text accompanies a failed process
- **WHEN** a process emits success text and exits with code 23
- **THEN** text and exit code remain unchanged
- **AND** payload status is failed, payload and wrapper isError are true, and recorded command evidence isError is true.

#### Scenario: Cancellation ends with zero
- **WHEN** a cancelled or timed-out process eventually closes with exit code zero
- **THEN** the execution remains classified as failed.

#### Scenario: Successful command completes
- **WHEN** a process exits with code zero without interruption or a signal
- **THEN** status is completed and execution error metadata is false.

#### Scenario: Child error and close both fire
- **WHEN** process lifecycle callbacks overlap after an execution error
- **THEN** only the first settled outcome is recorded and returned.

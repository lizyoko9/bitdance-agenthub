## MODIFIED Requirements

### Requirement: Bash SHALL classify process outcomes consistently

Bash MUST compute failure from a nonzero or unknown exit code, a terminating signal, timeout or cancellation. The same classification MUST reach wrapper metadata, model-visible isError and failed/completed status, and command evidence. Existing result fields MUST remain available, with aborted and signal observations added. Failed obtained results MUST additionally contain failure with a stable kind and an observed-fact message; successful results MUST omit failure. Kinds SHALL be timeout, aborted, signal, nonzero_exit and unknown_exit in that precedence. The same message MUST be used for command evidence and supervisor diagnostics, with historical-result fallbacks retained. Exit codes MUST remain numeric or null, and output MUST not be rewritten to carry the explanation. A failed command MUST remain available for subsequent model reasoning. Cancellation known before execution MUST prevent spawning; each command MUST record and settle at most once.

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


#### Scenario: Different commands return nonzero codes
- **WHEN** a command returns any nonzero integer exit code without interruption
- **THEN** failure.kind is nonzero_exit and its message states the observed code
- **AND** no program-specific cause is inferred from that number.

#### Scenario: Multiple interruption observations coexist
- **WHEN** timeout, cancellation and signal metadata overlap
- **THEN** a single failure object follows the declared precedence and all original observations remain available.

#### Scenario: No exit status was observed
- **WHEN** exitCode is null without an observed timeout, cancellation or signal
- **THEN** failure.kind is unknown_exit and the message states that successful completion could not be confirmed.

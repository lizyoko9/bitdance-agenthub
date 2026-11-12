## ADDED Requirements

### Requirement: Supervisor verification SHALL honor interrupted command outcomes

Supervisor-required command verification MUST fail for failed tool-result metadata, timeout, cancellation or a terminating signal, even if a numeric zero exit code is present. It MUST retain available exit code and bounded output for diagnosis.

#### Scenario: Interrupted command closes with zero
- **WHEN** a required command has execution-error metadata or interruption evidence and exit code zero
- **THEN** verification records ok=false and preserves the observations.

#### Scenario: Ordinary required command succeeds
- **WHEN** a required command exits with zero without failure or interruption evidence
- **THEN** verification retains the existing successful result.

## ADDED Requirements

### Requirement: Timeout case admission SHALL require measured observation capabilities

The integration SHALL admit only the explicitly selected E6-timeout-error-channel-003 single-input profile after validating its pinned source, task-derived budget, timeout/post-tool mapping and installed Linux process observer. Effective Actor time MUST be the TaskSpec 120 seconds with six tools and coherent seven-turn/request capacity. All four official rubrics MUST be scored under unchanged bounded Judge policy.

#### Scenario: Runtime declares a longer timeout than TaskSpec
- **WHEN** E6 admission resolves its plan
- **THEN** effective time remains 120 seconds and the separate 600-second runtime declaration is retained without a silent min/clamp.

### Requirement: Process cleanup evidence SHALL be measured before external cleanup

The opt-in evaluation observer MUST verify an exclusive PID namespace baseline, identify processes by PID/start ticks without UID/PGID filtering, and freeze actual post-Actor live residual observations before any forced Worker or container cleanup. It MUST never send signals, invent descendant history, infer cleanup from kill invocation, convert failed scans into zero, or overwrite a failed frozen receipt. Native payloads and production cleanup behavior MUST remain unchanged.

#### Scenario: A detached process survives natural Actor exit
- **WHEN** either final census observes its new live identity
- **THEN** the receipt records a nonzero residual and false cleanup validity even if later container cleanup removes it.

#### Scenario: Actor execution reaches its wall-time limit
- **WHEN** the Worker is about to terminate the Actor
- **THEN** it first freezes forced-stop failure evidence and preserves that receipt after cleanup.

#### Scenario: A final census cannot be completed reliably
- **WHEN** permissions, malformed records, identity races or baseline drift prevent reliable measurement
- **THEN** tracking failure is explicit and an unknown residual count is not reported as zero or successful cleanup.

### Requirement: Timeout observer serialization SHALL preserve native field provenance

An E6-only versioned evaluation bridge MAY map a uniquely correlated strict native boolean `timedOut` into the flat observer `timed_out`. It MUST archive the unmodified helper evidence and retain original values, source file hashes/pointers and row identity. True and false MUST use the same rule; missing values MUST NOT be inferred and malformed/conflicting aliases MUST be rejected. Native/canonical payloads, other observer fields and helper-derived gate decisions MUST remain unchanged and MUST NOT be presented as newly executed production behavior.

#### Scenario: Native camelCase timeout is true
- **WHEN** the pinned helper fails to recognize its name but native identity and strict boolean value are unambiguous
- **THEN** the evaluation observation may carry that same true value with explicit projection provenance while raw helper evidence and native bytes remain available.

#### Scenario: Native timeout alias is false or malformed
- **WHEN** the bridge evaluates the source
- **THEN** false remains false and malformed or conflicting fields cannot be converted into a successful timeout observation.

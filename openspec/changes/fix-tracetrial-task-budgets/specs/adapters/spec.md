## ADDED Requirements

### Requirement: Custom adapter SHALL support an explicit SDK request timeout

The Custom adapter MUST accept an optional validated programmatic requestTimeoutMs and pass it to the provider SDK without changing defaults for callers that omit it. Evaluation MUST pass its effective deadline explicitly, retain AbortSignal propagation and reject values outside the supported timer domain.

#### Scenario: TraceTrial supplies a twenty-minute task deadline
- **WHEN** the Custom adapter builds its client
- **THEN** the SDK receives the explicit timeout instead of imposing its own shorter default.

#### Scenario: An ordinary caller omits the timeout option
- **WHEN** the client is created
- **THEN** its existing SDK default remains in effect.

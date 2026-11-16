## ADDED Requirements

### Requirement: Usage consumers SHALL normalize prompt totals per record exactly once

For marked records inputTokens MUST be treated as the total prompt including cache details; for unmarked records the legacy prompt total MUST remain inputTokens+cacheReadTokens+optional cacheCreationTokens. Shared pure arithmetic MUST drive message totals, conversation/store groups and the usage-summary API before aggregation. Cache counters MUST NOT be added again to marked input. Display labels and hit-rate denominators MUST reflect total prompt semantics without provider-independent billing-rate claims.

#### Scenario: Marked and historical usage are mixed
- **WHEN** the UI or API aggregates both kinds of records
- **THEN** each record is normalized by its own marker and total equals normalized prompt plus output
- **AND** by-agent/model groups agree with the aggregate rather than depending on current provider settings.

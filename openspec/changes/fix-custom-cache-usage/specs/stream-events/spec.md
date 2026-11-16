## ADDED Requirements

### Requirement: Usage JSON SHALL carry optional total-input semantics without rewriting history

RunUsage and MessageUsage numeric JSON MAY include inputTokensIncludeCache?: boolean. New Custom usage events MUST set it true while retaining provider prompt_tokens as inputTokens. AgentRunner persistence, SSE and snapshot reconciliation MUST preserve the marker. Unmarked historical records MUST retain existing interpretation; the implementation MUST NOT infer their semantics from mutable agent configuration or change SQL columns. Request-level unknowns MUST remain null, while legacy public numeric missing-value behavior remains compatible.

#### Scenario: A Custom response has cached prompt tokens
- **WHEN** its usage event is stored and reloaded
- **THEN** the optional true marker remains attached to the unchanged raw prompt total.

#### Scenario: Only the semantic marker changes during reconciliation
- **WHEN** a message snapshot has the same counts but a different marker
- **THEN** message equality detects that change rather than dropping it.

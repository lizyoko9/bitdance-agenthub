## MODIFIED Requirements

### Requirement: Native evidence SHALL remain faithful through normalization

Original native events MUST be retained with source references. Canonical records MUST preserve tool IDs, arguments, results, failure flags and known/unknown fields without repairing measured behavior. Only actually supported execution capabilities SHALL be declared. A versioned canonical transport envelope MAY add an observed outer native call ID as result-side metadata only when the exact original payload is separately retained, all derived fields name their native sources, and conflicting existing fields are rejected rather than overwritten. Canonical metadata MUST NOT be presented as a captured full API wire message or as an added production payload field.

#### Scenario: A nonzero exit has a false native error flag
- **WHEN** normalization observes that combination
- **THEN** both values remain unchanged in the canonical result and native evidence
- **AND** official graders determine the resulting failure classification.

#### Scenario: The native transport carries a result call ID outside its payload
- **WHEN** the versioned projection maps it into canonical transport metadata
- **THEN** the exact original payload and raw event remain available with explicit provenance
- **AND** missing or conflicting IDs are never manufactured or silently corrected.

### Requirement: Official rules and layered scoring SHALL remain authoritative

The integration MUST reuse the pinned official verifier, rubric prompts, evidence extraction, score resolution, evaluation policy and attribution. Omitting declared LLM rubrics SHALL produce a partial result; a task whose official sheets declare zero rubrics MAY receive a complete official deterministic layered score without a Judge model request. Native execution failure, apparatus failure, judge failure, Harness score and Agent score MUST be reported separately.

#### Scenario: The actor completes but a harness criterion fails
- **WHEN** official scoring completes
- **THEN** the native execution outcome and the failed criterion are both retained
- **AND** voluntary model stop does not imply task or harness success.

#### Scenario: The selected governance task declares zero rubrics
- **WHEN** its complete official layered scoring runs
- **THEN** Judge model transport is prohibited and the reported Judge request count is zero
- **AND** the original deterministic Harness and Agent outcomes are retained.

## ADDED Requirements

### Requirement: Governance task admission SHALL distinguish declared and effective limits

Only the pinned `G1-registry-cleanup-002` workspace-only single-turn profile SHALL be admitted through the explicit compatibility mapping. The runner MUST retain the upstream protocol identity, identify execution as AgentHub, and enforce the unchanged lower trial envelope independently of the larger task maxima. It MUST NOT claim unimplemented stock-harness session/provenance capabilities or add a `provider_executed` observation without evidence.

#### Scenario: The task permits more tools and time than the experiment
- **WHEN** the approved one-shot governance trial begins
- **THEN** the actor retains one user input, 16 HTTP, six tools and 120 seconds under the existing byte/output caps
- **AND** budget exhaustion remains a recorded outcome without an automatic retry.

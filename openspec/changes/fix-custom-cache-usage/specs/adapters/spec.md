## ADDED Requirements

### Requirement: Custom cache usage SHALL share strict per-response normalization

Custom request observations and ordinary message/run accounting MUST use the same supported cache aliases with deterministic precedence, nonnegative safe integers and explicit-zero preservation. Missing/invalid request values MUST remain null. Known fields in successive usage chunks MUST update one response snapshot without erasing earlier known fields; the adapter MUST add each response snapshot once across turns rather than summing repeated final chunks.

#### Scenario: Nested OpenAI cache counters are present
- **WHEN** the provider reports cached/write counters in supported prompt/input details
- **THEN** known request, message and run counters preserve those values under the existing public numeric compatibility rules
- **AND** alias representations are never summed together.

#### Scenario: A response repeats or partially updates its usage
- **WHEN** several usage chunks describe the same response
- **THEN** the latest known value for each field is counted once and missing later fields do not erase it.

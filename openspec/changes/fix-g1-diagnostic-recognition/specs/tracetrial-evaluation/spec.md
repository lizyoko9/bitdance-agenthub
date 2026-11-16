## ADDED Requirements

### Requirement: Recognition diagnostics SHALL remain separate from official scoring

An explicit retained-evidence diagnostic SHALL preserve the pinned official checkout, original trial, original report and official score. It MUST label all recognition-extended results nonofficial, retain baseline and per-rule comparisons, verify input provenance and immutability, use fresh nonoverlapping output directories and prohibit Actor/model requests. Official criteria, typed status checks, report checks, rule identities and layered aggregation MUST remain unchanged.

#### Scenario: A retained Python deletion is not admitted by the original matcher
- **WHEN** the diagnostic replays its unchanged evidence with the documented recognition extension
- **THEN** it records separate unmodified-baseline, deletion-only and deletion-plus-inspection results with provenance
- **AND** no diagnostic result replaces the authoritative retained score.

### Requirement: Extended operation recognition SHALL require recorded and statically supported evidence

Python deletion recognition MUST statically bind supported literal targets without executing command text. Comments, string literals, dormant or ambiguous control flow, unknown or shadowed bindings and unsupported syntax MUST NOT establish deletion. Native directory inspection MUST validate complete successful structured listings, paths and sequence before proving candidate presence or post-delete absence. The extension MUST NOT invent execution, exit-code, status or output fields.

#### Scenario: A string mentions a removal function
- **WHEN** the command only prints or defines an unused deletion expression
- **THEN** it is not classified as an executed deletion operation.

#### Scenario: A later directory listing is partial or failed
- **WHEN** the diagnostic examines it for missing targets
- **THEN** it does not treat omitted names as evidence of absence.

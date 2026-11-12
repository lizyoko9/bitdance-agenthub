## 1. Contracts and approval

- [x] 1.1 Record the E8 root cause and the user's approval of the concrete fix and one same-budget comparison trial.
- [x] 1.2 Synchronize tools, adapter and supervisor contracts, including legacy ToolResult/Bash specifications.

## 2. Runtime correctness

- [x] 2.1 Add optional obtained-result error metadata and propagate it through Custom/MCP consumers with compatibility tests.
- [x] 2.2 Classify Bash exit/signal/timeout/cancellation consistently, preserve observations and settle once; add real-process and controlled lifecycle regressions.
- [x] 2.3 Make supervisor verification honor execution errors and interruptions even with exit code zero; add regressions.
- [x] 2.4 Complete typecheck, changed-file lint, relevant tests and strict spec validation; separately commit exact contracts and implementation.

## 3. One-trial comparison

- [x] 3.1 Verify the baseline dependency image, overlay committed allowlisted sources, retain provenance and pass no-model runtime/isolation checks.
- [x] 3.2 Run one fresh E8 actor and official two-layer scoring with the same model and approved limits, without rerun or fallback.
- [x] 3.3 Audit raw/native propagation, task hashes, requests, credentials and cleanup; compare raw/effective criteria with the retained baseline.
- [x] 3.4 Commit the implementation/results and merge to local main, documenting core code and the limits of the evidence.

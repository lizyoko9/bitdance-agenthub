## 1. Shared response accounting

- [ ] 1.1 Implement shared strict cache alias parsing and per-response snapshot merging for request tracking and Custom production events.
- [ ] 1.2 Count snapshots once across turns, preserve request null/explicit zero and test repeated/partial usage with and without observers and existing terminal paths.

## 2. Durable semantics and consumers

- [ ] 2.1 Add the approved optional inputTokensIncludeCache marker to shared/DB JSON types and new Custom run/message events, preserving numeric compatibility.
- [ ] 2.2 Use shared per-record prompt/total arithmetic in conversation/store groups, usage-summary API and message/usage displays; preserve the marker through reconciliation.
- [ ] 2.3 Test mixed legacy/marked records, persistence/reload/equality, totals/groupings and actual consumer behavior without new dependencies.

## 3. Verification and delivery

- [ ] 3.1 Reconstruct the retained L2 normalized usage observations with explicit provenance, preserve original hashes, run appropriate checks and independent review.
- [ ] 3.2 Synchronize detailed/capability specs, commit the fix separately and explain the root causes and key code before the real case trial.
- [ ] 3.3 Record actual post-fix evidence and limitations, then merge reviewed work locally without pushing.

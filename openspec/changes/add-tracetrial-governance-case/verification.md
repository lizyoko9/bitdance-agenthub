# Governance-case verification

## Offline checks

- All nine TraceTrial Python test modules: 100 passed before the Actor; 105 passed after the general native-semantics correction, with provider credentials removed. The projection tests cover native payload preservation, observed/missing/conflicting IDs, existing IDs, non-object results without invented typed outcomes, all eight official G1 Harness parser/sidecar shapes, and existing E7/E8 lifecycle/typed-result compatibility.
- Admission/scoring tests cover G1's exact upstream declarations, unchanged effective trial limits, protocol compatibility restricted to the approved case, complete official zero-rubric aggregation/policy/attribution, forbidden Judge calls, and continued rubric requirements for other tasks.
- Pure preflight against the pinned real G1 TaskSpec returned supported with no credential or model invocation. It records upstream 12/80/1200 separately from effective one-input/16-HTTP/six-tool/120-second limits, plus zero Judge requests.
- `pnpm typecheck`, `pnpm lint`, strict OpenSpec validation and diff checks passed.
- Canonical/scoring/Judge host-controller hashes now accompany runtime/worker/admission hashes; these sources must be committed and unchanged before runtime refresh and trial execution.

## One-shot trial

The approved one-shot Actor ran under runtime `32ab9625c21558598ac22a4c5a57ca85529c3b33`: seven HTTP requests, six read/list tools and then `budget_exhausted`, with no Bash/deletion/report. Workspace and all 45 source files were unchanged. The initial normalizer rejected a complete error text snapshot lacking streaming part.end and a 2ms timestamp regression; these are adapter assumptions stricter than the existing producer contract (Spec 02 calls timestamps diagnostic, and the producer emits one-shot part.start snapshots).

The generic adapter correction retains raw clocks/sequence and records timestamp observations; nonempty text snapshots without deltas can close with their message, while actual streaming/incomplete/illegal sequences remain rejected. Failed/budget-exhausted Actor state remains failed and trace_complete=false. A fresh retained-evidence view under normalizer/scorer `a21f63e88e5f03789b4d2bd988ea2d5599a4a6e1` completed the first official score: raw/effective 6.25/fail, Harness 1/8 and Agent 0/9. All 139 original trial file hashes remain unchanged; Actor runtime remains `32ab962...`, new model requests are zero, and Judge logical/HTTP counters are zero with an empty ledger.

The unchanged official attribution label is harness_caused via a hand-written static mechanism chain, but its claim about aggregate deletion feedback is not observed here (delete_calls=0). The report separates that label from the actual budget-exhausted-before-deletion diagnosis. Full scores, limits, immutable provenance, observations and audit are recorded in `eval/tracetrial/results/2026-11-16-g1-governance.md`. This is a budget-limited development trial, not full governance-capability or leaderboard evidence.

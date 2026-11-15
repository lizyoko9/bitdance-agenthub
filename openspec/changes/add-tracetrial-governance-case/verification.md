# Governance-case verification

## Offline checks

- All nine TraceTrial Python test modules: 100 passed with provider credentials removed. The projection tests cover native payload preservation, observed/missing/conflicting IDs, existing IDs, non-object results without invented typed outcomes, all eight official G1 Harness parser/sidecar shapes, and existing E7/E8 lifecycle/typed-result compatibility.
- Admission/scoring tests cover G1's exact upstream declarations, unchanged effective trial limits, protocol compatibility restricted to the approved case, complete official zero-rubric aggregation/policy/attribution, forbidden Judge calls, and continued rubric requirements for other tasks.
- Pure preflight against the pinned real G1 TaskSpec returned supported with no credential or model invocation. It records upstream 12/80/1200 separately from effective one-input/16-HTTP/six-tool/120-second limits, plus zero Judge requests.
- `pnpm typecheck`, `pnpm lint`, strict OpenSpec validation and diff checks passed.
- Canonical/scoring/Judge host-controller hashes now accompany runtime/worker/admission hashes; these sources must be committed and unchanged before runtime refresh and trial execution.

## One-shot trial

The approved one-shot Actor ran under runtime `32ab9625c21558598ac22a4c5a57ca85529c3b33`: seven HTTP requests, six read/list tools and then `budget_exhausted`, with no Bash/deletion/report. Workspace and all 45 source files were unchanged. The initial normalizer rejected a complete error text snapshot lacking streaming part.end and a 2ms timestamp regression; these are adapter assumptions stricter than the existing producer contract (Spec 02 calls timestamps diagnostic, and the producer emits one-shot part.start snapshots).

The generic adapter correction retains raw clocks/sequence and records timestamp observations; nonempty text snapshots without deltas can close with their message, while actual streaming/incomplete/illegal sequences remain rejected. Failed/budget-exhausted Actor state remains failed and trace_complete=false. A fresh retained-evidence scoring view will record the processor revision and original-source hashes, without changing the Actor trial, sending another model request or rescoring a previously graded run. Offline conformance is not a benchmark score. The official combined artifact may carry a static `direct_api` transport label even with no logical rubric calls; actual zero Judge transport must be established from the dedicated requester summary and empty request ledger, keeping official outputs unchanged.

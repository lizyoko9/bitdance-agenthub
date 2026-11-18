## 1. Confirm the result contract

- [x] 1.1 Obtain confirmation for this additive Bash result contract under CLAUDE.md §6.1/§6.2; keep implementation pending until confirmed.

## 2. Implement native capture

- [x] 2.1 Add observed stdout/stderr and per-pipe size-omission flags to obtained Bash values, preserving output, failure classification, wrapper errors and command evidence.
- [x] 2.2 Use separate built-in incremental UTF-8 decoders, a Unicode-safe shared 10,000-unit cap and idempotent final flushing through existing interruption/cleanup paths.
- [x] 2.3 Synchronize openspec/specs/tools/spec.md, specs/07-tools.md and relevant native tool-description wording in specs/11-platform.md without changing SDK contracts or security rules.

## 3. Verify capture and consumers without model calls

- [x] 3.1 Extend focused Bash tests for real dual-pipe success/failure/redirection, empty observations, interleaving, exact/exceeded shared cap, late-pipe omissions and Unicode chunk/cap boundaries.
- [x] 3.2 Verify partial outputs and single settlement/evidence through timeout, abort, orphan cleanup and overlapping end/close/error callbacks; notes must remain output-only.
- [x] 3.3 Verify next-request tool-result JSON through actual Custom/tool execution with fake model transport, and the existing generic persistence/stream/detail result paths; preserve historical and output-only consumers and measure representative serialized request growth.
- [x] 3.4 Project a fresh native observation through existing canonical functions and the pinned E2 provenance helper as a no-model consumer regression; preserve old traces, content alias and official scoring code without rerunning/rescoring the benchmark.

## 4. Validate and deliver

- [x] 4.1 Run focused new/existing Bash, failure/transport/evaluation regressions plus required typecheck/lint and strict OpenSpec validation; resolve relevant failures.
- [x] 4.2 Review the implementation against the approved contract, retain planning and implementation as separate local commits, and report core code and verified limits with zero model requests and no benchmark score claim.

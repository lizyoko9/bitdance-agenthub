# Verification

## Implemented scope

L2 admission uses the full TaskSpec 140-tool/2400-second budget and the unchanged measured-process receipt. Container archival and same-container removal outcomes are now projected from persisted source stages with hashes, explicit identities and an eight-file archive contract. E6-only timeout capabilities/serialization and older task behavior remain isolated.

The first actual L2 Judge attempt exposed a capacity gap before any HTTP. A separately approved fix keeps generic/older defaults at 256KiB and selects 512KiB only for L2; ten HTTP, 2MiB cumulative, 4096 output tokens and 600 seconds remain unchanged. The HTTP worker's nested JSON input capacity follows the technical ceiling. Production tools, prompts, security, dependencies and upstream task/scoring rules were not changed.

## Validation

- Final Python suite: 226 tests across 15 modules passed.
- Independent Judge/admission/scoring review: 48 tests passed; driver/lifecycle 43 and admission/worker/trace 62 also independently passed during implementation.
- TypeScript: 104 tests across six files passed with no skips, including the actual pinned L2 resolve-to-Python-to-TS/profile-to-real-SDK/fake-fetch path through 140 tools and final response.
- Typecheck, lint, OpenSpec strict and diff checks passed.
- Fresh immutable image dependency availability probe passed without credentials, models, network or task-fixture execution.

## Actual experiment

One Actor ran at runtime/controller commit db4232f7c4355c5e293f29b50876a5d7d6444bc3, image sha256:f2ea5695bf8b1303411d1fde42354346ea945d088612469c0d6d74704f84cfe6. It voluntarily completed in 117.579062 seconds, 21 HTTP and 37 tools, with no budget rejection. Twelve batches were accepted once each, seven confirmed inline and four more confirmed by the one audit; JSON exactly preserved eleven confirmed and one submitted-only state. Two earlier failed channel attempts accepted nothing; source Git already had mode100644, so no executable bit was lost during copying.

The process receipt measured zero live residuals and one zombie before external copying/removal. Tracking was valid and the observer did not signal. The lifecycle projection retained the actual same-container outcomes and eight archive hashes. Independent actual review passed all 43 checks; the original 135 files, 27 official source files, 15 protected inputs and 123 runtime source members were verified.

Initial scoring remains incomplete/null with zero Judge HTTP after the 256KiB guard rejection. Exact pure rendering established both full official prompts fit the separately approved 512KiB and all four worst-case same-prompt requests fit 2MiB. A fresh g512 scoring view preserves all 135 original inputs, with only three summary location fields redirected to byte-verified copies and original summary/provenance retained.

At grader commit a42573cbcf60324f6fa138a9c3034dbe0c18e599, the approved one-time continuation completed with two HTTP, 1,021,574 body bytes, no corrections and no budget exhaustion. Official raw/effective scores are both 67.5824175824/fail: Harness 12/13 (46.1538461538/50), Agent 3/7 (21.4285714286/50), attribution agent_caused. All original trial files and all 135 scoring inputs remain unchanged; rule payloads exactly match the initial attempt. No Actor was rerun. The separate retained-grading independent audit passed all 30 checks.

## Findings and boundaries

Three Agent report failures reflect strict formatting recognition; the fourth also identifies insufficient explicit source attribution. The Harness rubric zero correctly quotes two errors with no direct recovery hints, while the first root cause belongs to a non-executable upstream fixture and the second to the Agent's sh choice. It is not evidence of sandbox interception or missing native output. The other Harness rubric confirms no delivered data damage attributable to those errors.

A separate real production observation gap was identified: request-ledger cache-read sums to 299881 but run.usage reports zero, and cache-write alias parsing/aggregation is incomplete. Actual runtime source matches the reviewed code. The retained normalized recorder cannot establish the exact raw alias or verified billing; no production usage code was changed. Generic delivery self-check and recovery hints remain candidates.

Full artifacts are retained in .agenthub-data/tracetrial-eval/2026-11-16-l2-confirmation/. See eval/tracetrial/results/2026-11-16-l2-confirmation.md for the outcome and interpretation.

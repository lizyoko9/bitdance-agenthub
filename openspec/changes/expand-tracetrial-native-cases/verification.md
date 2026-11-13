# Native-case expansion verification

## Offline checks

- TraceTrial's eight Python test modules: 84 passed, with provider credentials removed. Includes real pinned TaskSpec admission, invalid/unsupported inputs, output-directory reuse protection, recorder limits/credential isolation, native lifecycle conformance, official E7/E8 parser and execution-sidecar contracts, bounded Judge and scoring, and runtime refresh.
- `pnpm typecheck`, `pnpm lint`, `openspec validate expand-tracetrial-native-cases --strict` and `git diff --check` passed.
- Real three-task `preflight` in a minimal credential-free environment: all supported with zero model calls. An independent review repeated admission with Docker, urllib and socket operations patched to fail if called; no transport or fixture execution occurred.
- Actor settings remain one user input, 32 internal model turns, 16 HTTP, six tools, 120 seconds, 256 KiB/2 MiB request bodies and 8192 output tokens/request. Judge rubrics are 4/2/5 with worst-case correction coverage 8/4/10 within each independent ten-request cap.
- Canonical terminal completeness is derived after the same native validation as summary completeness. The tests compare original events/results and every tool value without outcome repair, including successful actor completion after failed tools and negative cases with incomplete or contradictory lifecycles.

The Python 3.13 unittest discovery command cannot discover this namespace package as a start directory; the documented command explicitly lists all eight test modules. No dependency or application runtime source changes were required.

## Paid experiment

Pending the committed build and three independent trials. Results will be recorded separately under `eval/tracetrial/results/` and local ignored artifacts; offline tests do not establish benchmark success.

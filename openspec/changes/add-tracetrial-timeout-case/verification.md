# Verification

## Scope and final behavior

Implemented the selected E6-003 task admission, a measurement-only isolated PID observer, exact receipt propagation and the explicit `agenthub_timeout_observer_v1` field bridge. Production Bash, tool payloads, prompts, safety policies and upstream tasks/scorers were not changed. Generic delivery validation remains a remembered candidate, not an implementation in this change.

## Checks

- 193 Python tests across 14 modules passed; the affected driver module passed all 26 tests again after the final Docker PID option correction.
- 103 TypeScript tests across six files passed with no skips. The actual resolved pinned E6 task crosses Python admission/request, TS schema, profile and real SDK/fake fetch; existing Bash timeout tests remain green.
- Typecheck, lint, OpenSpec strict and diff checks passed.
- Separate code review covered observer semantics, source-preserving mapping and counterexamples. No blocking finding remained.
- Real no-model Linux probes measured clean/live0, detached-leak/live1 and forced-stop/live1; failed receipts stay failed before cleanup. No task fixture was executed by these probes.

## Actual experiment

One fresh Actor ran `E6-timeout-error-channel-003` at runtime/controller commit `380f9c7a0754632741a12bbb82739bafec651d61`, image `sha256:75f18d6fbbf0200127cbc057b9e475e36481f081ceaa0d76eefc3bb737d40e4e`. The unsupported `--pid=private` preflight attempt started no Actor; the final driver uses and verifies Docker's default isolated mode.

The Actor made three HTTP requests and two tools in 12.655251 seconds. Its only Bash call used the exact command and 2000ms timeout; native failure/partial output and the seven-field report were correct. It completed voluntarily without hitting limits. Four Judge requests completed without corrections, retries or resource exhaustion. Official raw/effective scores were both 100/pass, Harness 6/6 and Agent 4/4, attribution clean.

The receipt froze before actor_exited, evidence copying and Docker removal. Both complete final censuses had no live residual identities, tracking was valid, and three zombies were separately retained. This supports the bounded live-cleanup observation, not complete reaping or a general production timeout guarantee.

Independent review completed all 30 checks, covering original helper bytes, single flat-field projection, exact native payloads, process receipt/lifecycle, original source hashes, real command/report, official rules and usage. The 76 retained trial file hashes were also rechecked unchanged after audit. Full retained artifacts are in `.agenthub-data/tracetrial-eval/2026-11-16-e6-timeout/`; the human-readable report is `eval/tracetrial/results/2026-11-16-e6-timeout.md`.

## Interpretation

No new production timeout defect was demonstrated. Apparatus observability and timeout-field compatibility were improved. Container PID1/reaper behavior is a candidate for separate localization because zombies remain; it is not asserted to be a production Bash leak. Single-case scoring does not establish a suite result or model-independent improvement.

## 1. Approval and fixed evaluation scope

- [x] 1.1 Obtain confirmation of the new evaluation capability, isolated Harbor dependency, optional adapter request policy, model, and first-trial limits.
- [x] 1.2 Verify local Docker availability and inspect fixed Harbor/task contracts and architecture manifests without pulling image layers or calling a model.
- [x] 1.3 Create an isolated implementation branch and preserve existing uncommitted user files.

## 2. Bounded model requests and records

- [x] 2.1 Add optional Custom adapter request settings and a shared preflight policy; preserve default application behavior and AbortSignal.
- [x] 2.2 Enforce actual HTTP request count, input byte limits, completion limits, and zero SDK retries in the evaluation profile.
- [x] 2.3 Record each request's available usage and response identity before stream consumers can stop at a tool event; retain unknown usage explicitly and redact credentials.
- [x] 2.4 Add focused regression tests for bounds, default behavior, partial streams, and planning usage retention.

## 3. Container-local AgentHub entry point

- [x] 3.1 Add zod-validated trial input and an isolated same-model OpenAI profile; disable self-selected and public Skills.
- [x] 3.2 Reuse conversation/message services and EventBus for execution, deferred approvals, root/child completion, and abort cleanup.
- [x] 3.3 Write manifest, request ledger, events, and execution status outside official task artifact paths.
- [x] 3.4 Validate headless behavior without model calls, including pending resolver timing and preservation of the normal app database.

## 4. Harbor and Linux runtime integration

- [x] 4.1 Add pinned isolated Harbor requirements and implement the 0.25.0 installed-agent interface.
- [x] 4.2 Prepare an allowlisted Linux-native runtime package using existing locked application dependencies; exclude host secrets, data, and reference answers.
- [x] 4.3 Implement task-environment installation, CLI invocation, finite shutdown, log retrieval, and AgentContext population.
- [x] 4.4 Preserve official instruction, artifacts, separate verifier settings, and reward; label shortened trial limits in reports.
- [x] 4.5 Install the approved isolated evaluation dependency and verify fixed runtime imports and command invocation.

## 5. First public task and handoff

- [x] 5.1 Build the fixed bun-sourcemap-leak environment and run an independent no-key oracle trial with the official verifier.
- [x] 5.2 If infrastructure validation passes, start a fresh one-task, one-trial single-Agent run with the approved OpenAI profile and limits; do not silently retry, change models, or reuse oracle output.
- [x] 5.3 Retain official reward and all failure categories; report the outcome as an integration smoke rather than a full benchmark score.
- [x] 5.4 Run typecheck, lint, and relevant tests; synchronize capability documents and record exact reproduction commands and remaining constraints.

## 1. Specification and authorization

- [x] 1.1 Record the user's explicit repair request, root cause, scope and configurable limit contracts.
- [x] 1.2 Validate the change and synchronize capability/numbered documents.

## 2. Custom adapter termination

- [x] 2.1 Add validated maxTurns configuration with constructor/environment/default precedence.
- [x] 2.2 Preserve natural model stop and report iteration/output/incomplete termination through existing Runner failures and usage.
- [x] 2.3 Test larger loops, exact-boundary stop, exhaustion, configuration, cancellation and planning early return.
- [x] 2.4 Verify failure status, persisted reason and visible error propagation through Application Services.

## 3. Evaluation configuration and handoff

- [x] 3.1 Pass explicit turn/request settings through Python, trial schema and isolated profile, and record effective limits.
- [x] 3.2 Classify actual termination reasons independently from request-count equality and official reward.
- [x] 3.3 Test the cross-language contract and document configuration without rerunning a paid trial or altering historical results.
- [x] 3.4 Run typecheck, lint, focused/full tests and strict spec checks; commit and merge the repair.

## Validation

- Full Vitest: 51 files passed; 377 tests passed, 2 skipped.
- Python evaluation integration: 14 tests passed.
- Typecheck, lint, strict change/capability validation and diff whitespace checks passed.
- Actual ConversationService/AgentRunner tests verified durable failed/iteration_limit and last-turn voluntary completion, using mocked HTTP and the real file tool.
- No paid model request or benchmark rerun; the first smoke's reward and artifacts remain historical evidence.

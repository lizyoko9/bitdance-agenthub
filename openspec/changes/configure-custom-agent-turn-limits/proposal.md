## Why

The first Terminal-Bench smoke exposed a fixed eight-turn loop returning normally while the model still requested tools. AgentRunner consequently recorded `complete`, obscuring iteration exhaustion. The user explicitly requested configurable limits and distinct completion outcomes.

## What Changes

- Replace the fixed eight-turn cap with a validated runtime option, environment fallback, and finite default of 32 turns.
- Preserve normal completion only for explicit model `stop`; report iteration exhaustion and output truncation through stable failure reasons and existing Runner persistence/UI.
- Expose explicit evaluation turn/request budgets and record effective settings and termination reasons without increasing the first smoke's default request allowance.
- Add transport and service-boundary regression tests without paid model calls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adapters`: Configurable Custom tool-loop bounds and truthful termination semantics.
- `terminal-bench-evaluation`: Explicit per-run turn and per-trial request limits and classified termination records.

## Impact

CustomAgentAdapter and its runtime options, evaluation CLI/profile/Python wrapper, tests and capability documents. No new dependency, DB migration, security policy change, or additional model trial. User authorization for this repair is already explicit in the current conversation.

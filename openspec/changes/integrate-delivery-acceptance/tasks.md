## 1. Confirm the completion contract

- [x] 1.1 Confirm the formal single-Agent request binding and run acceptance data under CLAUDE.md §6.1/§6.2.

## 2. Run the gate inside Hub

- [x] 2.1 Persist an optional exact revision binding on formal requests and read it back for regeneration. Preflight the current conversation and eligible revision before execution or history replacement.
- [x] 2.2 Call deterministic validation for the bound run after writes settle. Link the resulting fresh receipt or bounded failure detail to that run, respecting cancellation and rechecking scope and eligibility before acceptance.
- [x] 2.3 Add the version selector and show the durable acceptance state inline in the conversation. Keep the panel as a rule manager and manual check entry.

## 3. Verify

- [x] 3.1 Run fake-transport tests of automatic pass and wrong-JSON failure, stale and cancelled runs, unbound turns, regeneration, fresh receipt and reload/reconnect.
- [x] 3.2 Update the capability and affected contracts. Run strict OpenSpec validation, typecheck, lint and the scoped regression suite without live model or benchmark calls.

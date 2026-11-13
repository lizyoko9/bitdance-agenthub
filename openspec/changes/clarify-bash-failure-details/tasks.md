## 1. Execution contract

- [x] 1.1 Record the user's request, generic failure semantics and current compatibility boundaries.
- [x] 1.2 Synchronize the Bash contract and descriptions without changing ToolResult, events or stored history.

## 2. Implementation and verification

- [x] 2.1 Generate one explicit failure kind/message from process metadata, preserve output and propagate the same diagnostics to command evidence.
- [x] 2.2 Reuse failure messages in supervisor verification while retaining failure gates and historical-result fallbacks.
- [x] 2.3 Cover multiple nonzero codes, interruptions and precedence, unknown exit, normal success, diagnostics consistency and model/event pass-through without model calls.
- [x] 2.4 Complete required tests, typecheck, changed-file lint and strict specification validation.

## 3. Handoff

- [ ] 3.1 Separately commit contract and implementation, merge locally, and show a concrete result example and verification scope.

# Agent Orchestration Canvas Evidence

Date: 2026-07-05

## What Changed

- Added a pure canvas artifact model in `src/lib/agent-canvas-artifacts.ts`.
- Added tests for typed artifact handoff, target input compatibility, and node deletion cleanup.
- Connected `src/components/agent-workflow-canvas.tsx` to the typed artifact helpers.
- Kept AgentHub product behavior free-only; no paid tier, subscription, or feature-gating UI was introduced.

## Verification

### Unit Tests

Command:

```powershell
node node_modules\vitest\vitest.mjs run src/lib/agent-canvas-artifacts.test.ts
```

Result:

- PASS
- 1 test file passed
- 4 tests passed

### Targeted Typecheck

Command:

```powershell
node node_modules\typescript\bin\tsc --noEmit --pretty false 2>&1 | Select-String -Pattern "agent-canvas-artifacts|agent-workflow-canvas"
```

Result:

- No matching errors for `agent-canvas-artifacts` or `agent-workflow-canvas`.
- The full project typecheck still exits non-zero because of pre-existing unrelated errors elsewhere.

### Browser Smoke

URL:

```txt
http://127.0.0.1:3102
```

Result:

- The desktop web surface opens.
- The `编排画布` page renders.
- Console errors: none observed.
- Empty canvas state renders.
- Clicking `添加智能体` creates a node.
- Selecting that node and pressing `Delete` removes it.

Screenshots:

- `.codex-runlogs/agent-canvas-smoke.png`
- `.codex-runlogs/agent-canvas-add-delete-smoke.png`

## Remaining Risk

- Existing canvas code is still a large component. More cleanup should happen by splitting node card, edge rendering, and inspector into focused files.
- Edge inspector editing is not fully split into its own component yet.
- Full project typecheck has older errors unrelated to this module.

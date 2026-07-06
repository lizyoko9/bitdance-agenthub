# Agents CLI Lifecycle Integration Evidence

Date: 2026-07-06 14:53:57 +08:00

Plan:

- `docs/superpowers/plans/2026-07-06-agents-cli-lifecycle-integration.md`

## Verification

Focused lifecycle tests:

```powershell
node node_modules\vitest\vitest.mjs run src\lib\agenthub-lifecycle-types.test.ts src\lib\agenthub-canvas-lifecycle-status.test.ts src\server\agenthub-lifecycle-manifest-service.test.ts src\server\agenthub-command-runner.test.ts src\server\agenthub-capability-readiness-service.test.ts src\server\agenthub-eval-service.test.ts src\server\agenthub-lifecycle-report-service.test.ts src\components\langflow-agent-canvas-lifecycle.test.ts src\modules\app-modules-routing.test.ts --reporter=dot
```

Result:

- 9 test files passed.
- 19 tests passed.

Lifecycle-related lint:

```powershell
node node_modules\eslint\bin\eslint.js src\lib\agenthub-lifecycle-types.ts src\lib\agenthub-canvas-lifecycle-status.ts src\server\agenthub-lifecycle-manifest-service.ts src\server\agenthub-command-runner.ts src\server\agenthub-capability-readiness-service.ts src\server\agenthub-eval-service.ts src\server\agenthub-lifecycle-report-service.ts src\components\langflow-agent-canvas.tsx src\modules\app-modules.tsx
```

Result:

- Exit code 0.

Lifecycle-related typecheck filter:

```powershell
$output = node node_modules\typescript\bin\tsc --noEmit --pretty false 2>&1 | Select-String -Pattern 'agenthub-lifecycle|agenthub-canvas-lifecycle|langflow-agent-canvas|app-modules'; if ($output) { $output; exit 1 } else { 'no lifecycle-related type errors' }
```

Result:

- `no lifecycle-related type errors`

Full typecheck:

```powershell
node node_modules\typescript\bin\tsc --noEmit --pretty false
```

Result:

- Failed on pre-existing unrelated issues in many `src/app/api/**` route input types, `src/server/adapters/claude-code-adapter.ts`, and `src/server/agent-draft-schema.ts`.
- `apps/mobile` is now excluded from the desktop TypeScript project by `tsconfig.json`, and `src/config/desktop-typecheck-scope.test.ts` guards that desktop-only scope.
- No lifecycle-related errors were reported by the filtered check above.

## Product Constraints Checked

- The lifecycle plan is integrated into the existing canvas/control-plane shape.
- No new visible Lifecycle navigation entry was added.
- Hidden orchestration aliases still normalize to `agent-canvas`.
- The product surface remains free-only in this lifecycle integration.
- No API keys were added to fixtures, docs, tests, or seed data.

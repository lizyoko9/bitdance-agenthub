# Software Capability Store Verification

Date: 2026-07-05

## Commands

- `node node_modules\vitest\vitest.mjs run src/lib/software-capability-store.test.ts`
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`
- `node scripts\ensure-node-sqlite.mjs`
- `node node_modules/next/dist/bin/next dev -p 3102`
- Playwright smoke test with system Chrome at `http://localhost:3102`

## Result

- Unit tests: passed, 1 test file and 4 tests.
- Typecheck: full repository still has pre-existing TypeScript errors in unrelated API/server/mobile files; filtered check showed no errors for `src/components/software-capability-store/*` or `src/components/tool-control-center.tsx`.
- Desktop/web smoke: passed through local Next dev server. The "工具连接" page shows "软件能力商店", renders software cards, and opens a detail dialog from the Codex CLI card.
- Console errors during final smoke: none.
- Screenshot: `.codex-runlogs/software-capability-store-final.png`

## Notes

- AgentHub product UI remains free-only.
- External usage costs are treated as provider costs, not AgentHub pricing.
- Fixed local development dependency state by repointing `node_modules/better-sqlite3` to the current project `.pnpm` package and copying the existing compatible `better_sqlite3.node` binding into the local package. This was required for API routes to stop returning 500.

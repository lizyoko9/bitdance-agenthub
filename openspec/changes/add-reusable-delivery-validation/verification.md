# Delivery validation verification

The conversation toolbar now opens a scoped delivery panel. It selects exact user requirement excerpts and workspace inputs, drafts rules with a dedicated Custom Agent run, qualifies and activates a version, and runs the selected version on current file snapshots. The interpreted functions are data descriptions with a finite operator set. Plan revisions and snapshot receipts persist in AgentHub's local SQLite database.

The implementation uses a synchronous transaction to confirm eligibility after asynchronous file reads. Changed, revoked or foreign bindings cannot publish a current pass. A receipt covers the hashes it recorded. A user can preserve multiple versions and use an older eligible revision explicitly.

## Executed checks

| Check | Result |
|---|---|
| Full `pnpm test --maxWorkers=4` with pinned TraceTrial local test source | 71 files passed, 638 tests passed, 2 Windows-specific path tests skipped |
| New generation integration checks within that suite | 13 passed, real AgentRunner/Custom streaming path with fake responses |
| New evaluator and snapshot checks | 14 passed |
| New route/service and SQLite upgrade checks | 7 passed |
| Chrome delivery UI workflow | 1 passed using Next dev and intercepted delivery API responses |
| `pnpm typecheck`, `pnpm lint`, and both strict OpenSpec validations | Passed |
| Drizzle schema application and foreign key check | Passed on a fresh isolated SQLite file using the existing Node binding |

The API integration observed one fake model request to create the draft, blocked activation without the required examples, rejected nested JSON when scalar values were required, and passed after the file was corrected. It reopened the database, selected the same active revision and reused it without another request. Other cases cover duplicate keys in generated rules, request-origin and media checks, out-of-scope source references, revoked rules, distinct revisions, and history clear.

The browser used the installed Chrome and a temporary local Webpack dev server with isolated data. It exercised requirement selection, editable positive and negative function examples, activation, exact-version selection after reopening the panel, fail-to-pass snapshot history, revocation and regeneration from an older saved source. The generated model responses and the browser delivery endpoint were tested in separate integration layers.

The default parallel suite initially hit the five-second limit of one existing Terminal-Bench profile test while the browser was active. The full run with four workers and the same test time limits passed. The Electron wrapper for `pnpm db:push` could not obtain native headers in the sandbox. A Node Drizzle attempt on an already bootstrapped disposable database saw duplicate statements for an existing conversation index. The final Drizzle check used a fresh disposable file and verified both new tables. The startup upgrade test separately verifies addon table creation without altering existing history. These checks used no user database. The original Node SQLite binding was restored.

Verification used fake transport and synthetic files. It did not call a real model, run a paid benchmark, modify benchmark scoring or rewrite old traces.

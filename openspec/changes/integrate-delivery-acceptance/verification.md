# Automatic delivery acceptance verification

A formal single-Agent user message stores the exact selected validation revision. After the adapter and tool writes finish, Hub runs the deterministic validator. A transaction checks the active run, its current user binding and revision eligibility, then saves the receipt, run outcome and inline system message. Each receipt is tied to the checked bytes and the owning run. Message snapshots restore the result after reload or reconnect.

| Executed check | Result |
|---|---|
| `pnpm test --maxWorkers=4` with pinned local evaluation source | 72 files, 648 passed, 2 Windows-specific skips |
| Chrome with the real Next app and mock delivery/message transport | 1 passed |
| `pnpm typecheck`, `pnpm lint`, both strict OpenSpec checks | Passed |
| SQLite bootstrap upgrade and fresh schema push | Passed |

The production adapter integration uses fake model responses to execute the real `fs_write` tool, modify a previously valid file into an incorrect nested JSON structure, and stop normally. Hub reports a failed delivery despite an earlier manual pass. Regeneration reuses the same revision and creates a new passing receipt for the corrected snapshot. A fresh SQLite connection reloads the inline outcome. Separate tests cover ordinary unbound turns, cancellation while reading, revision revocation, invalid requests before model entry, replaced requests, missing run ownership and receipt rollback.

The browser run covers selecting an exact older active revision, a stale-selection error, the live inline failure and receipt, a subsequent plain message, and recovery of the verdict after reload. Model calls in tests used fake transport. Automatic acceptance adds zero model calls for a bound execution.

Electron's native build wrapper in `pnpm db:push` could not fetch its headers through the sandbox. The existing Node Drizzle CLI applied the schema to an isolated empty SQLite file and the new nullable columns and foreign keys were checked. Bootstrap upgrade coverage verified an existing message and run were preserved. No user database or retained benchmark evidence was modified by verification.

# Verification

Implementation: `c45b70c`, based on local main `4dc0685`.

- Full TypeScript suite: 493 passed, 2 skipped.
- Bash/classification targeted suite after the final description edit: 33 passed.
- Typecheck, changed-file ESLint and diff checks passed.
- This change and the main tools specification passed strict validation.
- Real sh tests cover exits 1/23/127/137, unchanged bounded stdout/stderr, normal success and inherited-stdio cleanup; controlled lifecycle tests cover interruption priority, missing exit, pre-abort and single settlement.
- Model/event pass-through and supervisor tests retain the complete failure object and reuse its message. Historical results without failure keep fallback diagnostics.

Example failed-result excerpt:

```json
{
  "exitCode": 23,
  "status": "failed",
  "isError": true,
  "failure": {
    "kind": "nonzero_exit",
    "message": "Command exited with nonzero code 23."
  }
}
```

The existing raw output and other process fields remain available. Success omits failure. No model or judge requests were made; prior benchmark artifacts and scores remain unchanged. External Judge behavior with this enhancement has not been measured.

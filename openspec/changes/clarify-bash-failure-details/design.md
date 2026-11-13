## Context

The current result retains integer exitCode, output, status and isError consistently. It does not expose one stable category and explanation for why the process observation was classified as failed. This enhancement is for general execution clarity and does not establish how any particular external judge will score it.

## Goals / Non-Goals

**Goals:** Add metadata-derived failure categories and messages that are identical in model-visible results, command evidence and supervisor diagnostics. Keep successful and historical results compatible.

**Non-Goals:** Change numeric exit types, raw output, task-level completion rules, managed-tool/SDK ownership, cancellation or security behavior; modify benchmark grading or historical artifacts; make paid model calls or claim a new benchmark score.

## Decisions

- A small pure function returns failure:{kind,message} for timeout, aborted, signal, nonzero_exit or unknown_exit, with that precedence. A successful zero exit without interruption returns no failure object. The same result determines the existing status/isError fields and diagnostics.
- Messages state observed process facts. A nonzero code gets a generic nonzero-exit explanation; no mapping to a program-specific error is invented. Unknown exit explicitly says successful completion could not be confirmed. No fixture IDs or expected benchmark scores enter production logic.
- The existing bounded output stays byte-for-byte as currently assembled; failure explanation is a separate field. Spawn/validation/approval failures keep their existing ok=false/error paths.
- Supervisor verification still decides from metadata. It reuses a nonempty failure.message only on a failed outcome; a structured failure cannot make a result successful. Historical results without failure continue through existing fallback diagnostics.
- Bash tool descriptions explain 0, nonzero and null exit codes and the independent interruption flags. No additional Actor/Judge requests are part of this change.

## Risks / Trade-offs

- Multiple simultaneous termination flags could yield inconsistent descriptions → one precedence and one classification function, with overlap tests.
- Consumers may ignore new details → keep status/isError and old fields intact; test exact Custom model/event pass-through and supervisor error reuse.
- More explicit text may be mistaken for a fix to Judge reliability → report only deterministic correctness/readability, retain all existing benchmark records and scores.

## Migration Plan

Additive optional Bash payload field; no database or event-schema migration. Synchronize the tools contract, implement focused regressions, separately commit specification and implementation, and merge locally after required checks.

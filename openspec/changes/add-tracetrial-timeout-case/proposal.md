## Why

The user requested further mechanism cases after recording generic delivery validation as a candidate improvement. E6-timeout-error-channel-003 exercises per-call timeout, failure propagation and process cleanup, but the current evaluation adapter cannot provide measured process-cleanup evidence.

## What Changes

- Admit the pinned E6-003 single-input task with its TaskSpec budget: six tools, 120 seconds, seven internal/HTTP opportunities and four Judge rubrics.
- Add an opt-in Linux read-only observer in the existing container Worker, measuring all new process identities in the exclusive task PID namespace before external cleanup.
- Propagate the exact observed receipt and its provenance into evaluation sidecars, without changing production Bash behavior, native payloads, prompts or official scoring.
- Validate normal/leaking/forced-stop/error paths without model calls, then run one fresh actual E6 trial and retain complete official scoring and failure classification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracetrial-evaluation`: add one explicit timeout task and scope-bound measured timeout/process observation capabilities.

## Impact

Evaluation Worker, admission/capability mapping, faithful process-evidence propagation, tests and evaluation documentation. No new dependencies, production tool changes, security-rule relaxation or private grader instructions. Existing trials and official benchmark files remain unchanged.

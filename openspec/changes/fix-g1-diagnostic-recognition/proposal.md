## Why

The retained G1 trial deleted all six intended targets with Python `os.remove`, but the pinned task verifier recognizes only selected shell deletion forms. Native `fs_list` inspections are also outside its text matcher, so several rules receive empty evidence despite preserved native results.

## What Changes

- Add an explicitly nonofficial, versioned G1 recognition diagnostic using the same retained trace and workspace, without another Actor or model request.
- Recognize a bounded static subset of literal-target Python deletion commands and structured native directory observations; reject ambiguous or unsupported syntax without executing command text.
- Keep the official checkout, original trial, scoring criteria, report and official score unchanged. Produce separate per-rule comparison and provenance records.
- Explain strict report checks with original text and examples; do not rewrite the measured deliverable or relax report rules to obtain a score.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracetrial-evaluation`: permit separate, clearly labeled retained-evidence recognition diagnostics while preserving the authoritative pinned scoring path.

## Impact

Project-local Python evaluation helpers, offline tests and evaluation documentation. No production tools, prompts, dependencies, credentials or paid trial budgets change. The existing official scoring entry point remains unchanged.

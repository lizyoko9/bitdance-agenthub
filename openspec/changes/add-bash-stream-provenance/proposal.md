## Why

AgentHub's native Bash tool currently puts stdout and stderr into one output string, so consumers cannot verify which pipe supplied a diagnostic. The retained E2 run directly observed this missing provenance even though diagnostic content was delivered; adding faithful fields addresses that production observation without tuning a scorer or claiming the whole E2 failure is solved.

## What Changes

- Add stdout, stderr, stdoutTruncated and stderrTruncated to obtained native Bash results, populated at their actual child-pipe callbacks. Retain existing output, status, failure and lifecycle behavior.
- Keep the existing shared 10,000-UTF-16-unit raw capture budget. The new strings partition that same retained text; output remains the compatibility merged view with existing tool annotations.
- Decode UTF-8 independently per pipe across Buffer chunks, flush each decoder at most once and avoid splitting a surrogate pair at the capture boundary.
- Preserve empty/partial observations and per-pipe omission flags honestly through timeout, abort, inherited-stdio cleanup and late-event races. Stderr content alone does not imply process failure.
- Synchronize the tool contract, detailed tool/platform descriptions and add bounded no-model production/transport/consumer regression coverage. No new dependency, SQL migration, UI redesign, security relaxation, production history change or paid benchmark rerun.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tools`: native Bash result pipe provenance, shared capture/truncation/UTF-8 semantics and compatibility with existing execution outcomes.

## Impact

Primary implementation is src/server/tools/bash.ts and focused tests. Generic result payloads and message.parts already store JSON; Custom, AgentRunner, SSE/store and result detail serialization retain added fields without a new SQL column. Existing output consumers and SDK-owned shell tools retain their contracts. E2's existing canonical alias and official rules remain unchanged; only new production observations can establish new stream fields. Validation uses controlled safe commands/fake model transport and fresh fixtures, with zero model requests and no editing or rescoring retained benchmark trials.

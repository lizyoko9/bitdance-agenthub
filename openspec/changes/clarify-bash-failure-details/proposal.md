## Why

Bash now consistently exposes failed/completed and isError, but readers still need to infer the category and explanation from several process fields. The user requested clearer failure classification; all raw process observations must remain available.

## What Changes

- Add a failure object to failed obtained Bash results, with a stable kind and metadata-derived message.
- Derive classification, message and existing error flags together for every command, using the same explanation in recorded and supervisor diagnostics.
- Document exit-code semantics and failure-detail fields in the tool description and contract; cover generic process and interruption boundaries without model calls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tools`: explicit failure categories and explanations for obtained Bash results.

## Impact

Managed Bash and supervisor diagnostics, tools documentation and deterministic regressions. ToolResult, StreamEvent and database structures remain unchanged; value retains its existing unknown payload boundary. No dependencies, security changes, benchmark task/scorer changes or paid model calls. Field naming is an implementation choice within the user's request for clearer execution classifications.

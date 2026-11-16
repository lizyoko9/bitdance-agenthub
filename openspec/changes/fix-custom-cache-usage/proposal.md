## Why

L2 exposed cache usage divergence: request ledgers observed 299881 cache-read tokens while run.usage reported zero; normalized recorder cache-write observations were also missing from the adapter parser. Correcting cache fields alone would activate a second bug: UI/API totals add cache subsets to OpenAI prompt_tokens, counting the same input twice.

## What Changes

- Share strict cache alias parsing and one-per-response usage snapshots between request tracking and Custom adapter message/run accounting; preserve request unknown values as null and explicit zero as zero.
- Add optional inputTokensIncludeCache to numeric run/message usage JSON. New Custom events mark total prompt semantics; older unmarked records retain their existing interpretation without backfill or SQL migration.
- Use one pure prompt/total formula in message display, conversation/store grouping and the usage-summary API, with cache counters shown as input details rather than counted twice.
- Test synthetic provider streams, repeated/partial usage, mixed historical records and persistence/snapshot merging; validate retained normalized L2 usage only as reconstruction, then run a bounded fresh mechanism sample.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adapters`: shared cache normalization and once-per-response accounting.
- `stream-events`: optional durable usage semantic marker.
- `frontend`: consistent totals for marked and historical usage.

## Impact

Custom adapter/request observation, usage JSON types, frontend/store/API arithmetic and related specs/tests. No dependencies, SQL columns, historical rewrites, provider inference from mutable agent settings, prompt/tool changes or billing estimates.

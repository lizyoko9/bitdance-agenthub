## Context

The user explicitly requested repairing usage and then continuing benchmark cases. L2 retained normalized evidence proves the request/run cache-read divergence and cache-write alias gap; no original SSE is retained, so reconstruction must not claim raw-response replay. Current run/message JSON contracts are numeric with missing fields represented by legacy zero. OpenAI SDK describes cached tokens as part of prompt_tokens, while existing consumers add cache counters again.

## Goals / Non-Goals

**Goals:** Correct known cache observations, count each response once, keep request unknowns null, avoid new double counting in all current consumers, and validate with synthetic streams plus a fresh bounded sample.

**Non-Goals:** Nullable public usage migration, historical backfill, changing other adapters' raw semantics without evidence, token pricing, prompt/tool/safety changes or performance-score claims from usage repair.

## Decisions

1. Keep the shared readCustomRequestUsage normalization path for request observations and ordinary Custom streams. Values must be nonnegative safe integers; explicit zero is valid. Preserve existing alias precedence. Cache-read precedence is prompt_tokens_details.cached_tokens, prompt_cache_hit_tokens, cached_tokens, cached_input_tokens, cache_read_input_tokens, prompt_tokens_details.cache_read_tokens, input_tokens_details.cached_tokens, input_tokens_details.cache_read_tokens. Cache-write first retains cache_creation_input_tokens, then cache_write_input_tokens, then cache_write_tokens/cache_creation_tokens in prompt_tokens_details/input_tokens_details. Do not add alias values together or infer absent cache values.
2. Maintain a per-response field snapshot: later known observations replace the same field, missing/invalid fields do not erase earlier known values. A newer valid zero may replace an older positive value; merging must not use max. Repeated final usage chunks are not additive. Sum snapshots once across turns and use the last known prompt total for lastInputTokens. Request tracking and message/run events must agree on known values both with and without requestPolicy. Existing abort/termination behavior is preserved; no usage is invented when absent.
3. Add optional inputTokensIncludeCache?: boolean to RunUsage/MessageUsage shared and DB JSON types. New Custom run/message payloads set true and retain raw prompt_tokens as inputTokens. The flag survives normal persistence, SSE, reload and message equality/reconciliation. No SQL column or migration is needed. Old/unmarked records keep their former interpretation; current mutable agent configuration cannot safely identify historical provider semantics.
4. One shared pure helper computes promptTotal = flag===true ? inputTokens : inputTokens+cacheReadTokens+(cacheCreationTokens??0), then total=promptTotal+outputTokens. Conversation/store and usage-summary API normalize each record before grouping, including byAgent/byModel and context fallback. Aggregate inputTokens means total prompt. Message badges use the same helper. Cache counters remain details within prompt totals; UsageBadge labels/tooltips no longer describe them as additional input or promise provider-independent billing rates.
5. Tests cover aliases/zero/invalid/conflicting precedence, partial/repeated snapshots, multiple turns and termination paths, optional observer equivalence, mixed marked/unmarked records, API/store/message equality and original SQL shape. A reconstruction from L2 recorder normalized calls may compare parser/cumulative values, with original trial hashes unchanged; it is not original SSE replay or a new benchmark score.

## Risks / Trade-offs

- Old records lack the semantic flag → keep compatibility and do not infer or rewrite them.
- Numeric event zeros still include legacy missing values → preserve request-level nulls and explicitly document that nullable public usage is outside this change.
- Adding cache data can inflate totals through a missed consumer → audit all current usage consumers and use mixed-record tests around the shared formula.
- Stream snapshots may arrive more than once → merge by field and accumulate once per response, not once per chunk.

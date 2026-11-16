interface TokenUsageCounts {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens?: number
  inputTokensIncludeCache?: boolean
}

export function getPromptTokenTotal(usage: TokenUsageCounts): number {
  return usage.inputTokensIncludeCache === true
    ? usage.inputTokens
    : usage.inputTokens + usage.cacheReadTokens + (usage.cacheCreationTokens ?? 0)
}

export function getTokenTotal(usage: TokenUsageCounts): number {
  return getPromptTokenTotal(usage) + usage.outputTokens
}

export function getCacheHitRate(promptTokens: number, cacheReadTokens: number, cacheCreationTokens = 0): number | null {
  if (![promptTokens, cacheReadTokens, cacheCreationTokens].every(Number.isFinite)
    || promptTokens <= 0 || cacheReadTokens < 0 || cacheCreationTokens < 0
    || cacheReadTokens + cacheCreationTokens > promptTokens) return null
  return cacheReadTokens / promptTokens
}

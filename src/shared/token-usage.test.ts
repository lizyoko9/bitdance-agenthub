import { describe, expect, it } from 'vitest'

import { getCacheHitRate, getPromptTokenTotal, getTokenTotal } from './token-usage'

describe('usage token totals', () => {
  it('keeps cache counters inside marked prompt totals without changing the source record', () => {
    const usage = Object.freeze({ inputTokens: 100, outputTokens: 10, cacheReadTokens: 60,
      cacheCreationTokens: 20, inputTokensIncludeCache: true })
    expect(getPromptTokenTotal(usage)).toBe(100)
    expect(getTokenTotal(usage)).toBe(110)
    expect(usage.inputTokens).toBe(100)
    expect(usage.cacheReadTokens).toBe(60)
  })

  it.each([undefined, false])('retains independent-cache interpretation for legacy marker %s', (marker) => {
    const usage = { inputTokens: 20, outputTokens: 5, cacheReadTokens: 30, cacheCreationTokens: 10,
      inputTokensIncludeCache: marker }
    expect(getPromptTokenTotal(usage)).toBe(60)
    expect(getTokenTotal(usage)).toBe(65)
  })

  it('supports message records without cache creation detail and preserves explicit zero', () => {
    const message = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 60 }
    expect(getTokenTotal(message)).toBe(170)
    expect(getTokenTotal({ ...message, inputTokensIncludeCache: true })).toBe(110)
    expect(getTokenTotal({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      inputTokensIncludeCache: true })).toBe(0)
  })
})

describe('cache hit rate from total prompt counts', () => {
  it('uses the inclusive prompt denominator and accepts an observed zero hit rate', () => {
    expect(getCacheHitRate(100, 60, 20)).toBe(0.6)
    expect(getCacheHitRate(100, 0, 20)).toBe(0)
    expect(getCacheHitRate(100, 100, 0)).toBe(1)
  })

  it.each([
    [0, 10, 0], [0, 0, 0], [100, 101, 0], [100, 60, 50],
    [-1, 0, 0], [100, -1, 0], [100, 1, -1],
    [Infinity, 1, 0], [100, Infinity, 0], [100, 1, NaN],
  ])('leaves unavailable or inconsistent counts %s/%s/%s without a fabricated rate', (input, read, write) => {
    expect(getCacheHitRate(input, read, write)).toBeNull()
  })
})

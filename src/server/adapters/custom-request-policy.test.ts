import type OpenAI from 'openai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomRequestTracker, mergeCustomRequestUsage, readCustomRequestUsage } from './custom-request-policy'

const unknownUsage = {
  inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null, reasoningTokens: null,
}

describe('Custom response usage normalization', () => {
  it.each([
    ['OpenAI prompt details', { prompt_tokens_details: { cached_tokens: 7 } }],
    ['DeepSeek hit count', { prompt_cache_hit_tokens: 7 }],
    ['top-level cached', { cached_tokens: 7 }],
    ['normalized cached input', { cached_input_tokens: 7 }],
    ['top-level cache read', { cache_read_input_tokens: 7 }],
    ['prompt cache-read detail', { prompt_tokens_details: { cache_read_tokens: 7 } }],
    ['input cached detail', { input_tokens_details: { cached_tokens: 7 } }],
    ['input cache-read detail', { input_tokens_details: { cache_read_tokens: 7 } }],
  ] as const)('reads %s without treating an alias as extra input', (_name, usage) => {
    expect(readCustomRequestUsage({ prompt_tokens: 10, completion_tokens: 2, ...usage }))
      .toEqual({ ...unknownUsage, inputTokens: 10, outputTokens: 2, cacheReadTokens: 7 })
  })

  it.each([
    ['existing creation', { cache_creation_input_tokens: 7 }],
    ['top-level write', { cache_write_input_tokens: 7 }],
    ['prompt write detail', { prompt_tokens_details: { cache_write_tokens: 7 } }],
    ['prompt creation detail', { prompt_tokens_details: { cache_creation_tokens: 7 } }],
    ['input write detail', { input_tokens_details: { cache_write_tokens: 7 } }],
    ['input creation detail', { input_tokens_details: { cache_creation_tokens: 7 } }],
  ] as const)('reads %s without guessing absent counters', (_name, usage) => {
    expect(readCustomRequestUsage(usage)).toEqual({ ...unknownUsage, cacheCreationTokens: 7 })
  })

  it('preserves established precedence and a legitimate zero over conflicting aliases', () => {
    expect(readCustomRequestUsage({
      prompt_tokens_details: { cached_tokens: 0, cache_read_tokens: 11, cache_write_tokens: 12 },
      prompt_cache_hit_tokens: 13, cached_tokens: 14, cached_input_tokens: 15, cache_read_input_tokens: 16,
      cache_creation_input_tokens: 0, cache_write_input_tokens: 17,
      input_tokens_details: { cached_tokens: 18, cache_write_tokens: 19 },
    })).toEqual({ ...unknownUsage, cacheReadTokens: 0, cacheCreationTokens: 0 })
    expect(readCustomRequestUsage({
      prompt_tokens_details: { cached_tokens: 'invalid', cache_write_tokens: 21 },
      prompt_cache_hit_tokens: 20, cached_tokens: 22,
      cache_creation_input_tokens: -1, cache_write_input_tokens: 23,
    })).toEqual({ ...unknownUsage, cacheReadTokens: 20, cacheCreationTokens: 23 })
  })

  it.each([undefined, null, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '4', true, {}])(
    'leaves malformed or missing values unknown: %s', (value) => {
      expect(readCustomRequestUsage({ prompt_tokens: value, completion_tokens: value,
        prompt_tokens_details: { cached_tokens: value }, cache_creation_input_tokens: value,
        completion_tokens_details: { reasoning_tokens: value } })).toEqual(unknownUsage)
    },
  )

  it('accepts safe integer boundaries and ignores array-shaped usage/details', () => {
    expect(readCustomRequestUsage({ prompt_tokens: 0, completion_tokens: Number.MAX_SAFE_INTEGER,
      completion_tokens_details: { reasoning_tokens: 0 } }))
      .toEqual({ ...unknownUsage, inputTokens: 0, outputTokens: Number.MAX_SAFE_INTEGER, reasoningTokens: 0 })
    expect(readCustomRequestUsage([])).toEqual(unknownUsage)
    expect(readCustomRequestUsage({ prompt_tokens_details: [], input_tokens_details: 'bad' })).toEqual(unknownUsage)
  })

  it('merges known fields once, preserves missing fields and accepts later corrections to zero', () => {
    const first = readCustomRequestUsage({ prompt_tokens: 100,
      prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 30 } })
    const complete = mergeCustomRequestUsage(first, { completion_tokens: 20,
      completion_tokens_details: { reasoning_tokens: 3 } })
    expect(mergeCustomRequestUsage(complete, { prompt_tokens: NaN, completion_tokens: null,
      prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: -1 },
      completion_tokens_details: { reasoning_tokens: 0 } }))
      .toEqual({ inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheCreationTokens: 30, reasoningTokens: 0 })
    expect(mergeCustomRequestUsage(complete, { prompt_tokens: 100, completion_tokens: 20,
      prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 30 } })).toEqual(complete)
    expect(first.outputTokens).toBeNull()
  })
})

describe('Custom request tracker snapshots', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('retains split usage and emits one observation despite repeated final chunks and finishes', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('')))
    const observe = vi.fn()
    const tracker = new CustomRequestTracker({ beforeRequest: () => 1, observe }, {
      runId: 'run', agentId: 'agent', conversationId: 'conversation', messageId: 'message',
      requestedModel: 'fake-model', provider: 'openai', turn: 1,
    }, new AbortController().signal)
    await tracker.fetch('https://example.test', { method: 'POST', body: '{}' })
    const chunk = (usage: unknown) => ({ id: 'response', model: 'fake-model', choices: [], usage }) as unknown as OpenAI.Chat.Completions.ChatCompletionChunk
    tracker.observeChunk(chunk({ prompt_tokens: 100, cache_write_input_tokens: 30 }))
    tracker.observeChunk(chunk({ completion_tokens: 20, prompt_tokens_details: { cached_tokens: 40 } }))
    tracker.observeChunk(chunk({ completion_tokens: 20, prompt_tokens_details: { cached_tokens: 40 } }))
    tracker.observeChunk(chunk({ prompt_tokens: null, cache_write_input_tokens: -1 }))
    tracker.finish('completed')
    tracker.finish('failed')
    expect(observe).toHaveBeenCalledOnce()
    expect(observe.mock.calls[0][0]).toMatchObject({ usageComplete: true, status: 'completed',
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 40, cacheCreationTokens: 30, reasoningTokens: null } })
  })
})

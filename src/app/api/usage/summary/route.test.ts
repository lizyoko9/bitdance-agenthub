import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => ({ agentRuns: { findMany: vi.fn() }, agents: { findMany: vi.fn() },
  conversations: { findMany: vi.fn() } }))
vi.mock('@/db/client', async () => ({ db: { query }, schema: await import('@/db/schema') }))

import { GET, type UsageSummary } from './route'

describe('usage summary with mixed input semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'))
    query.agents.findMany.mockResolvedValue([{ id: 'agent_one', name: 'One' }, { id: 'agent_two', name: 'Two' }])
    query.conversations.findMany.mockResolvedValue([{ id: 'conv_recent', title: 'Recent', updatedAt: 2 },
      { id: 'conv_old', title: 'Old', updatedAt: 1 }])
  })
  afterEach(() => vi.useRealTimers())

  it('uses normalized per-record totals for time buckets and all groups without rewriting inputs', async () => {
    const marked = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 60, cacheCreationTokens: 20,
      inputTokensIncludeCache: true, model: 'model_total' }
    const legacy = { inputTokens: 20, outputTokens: 5, cacheReadTokens: 30, cacheCreationTokens: 10,
      model: 'model_legacy' }
    query.agentRuns.findMany.mockResolvedValue([
      { agentId: 'agent_one', conversationId: 'conv_recent', startedAt: Date.now() - 1000, usage: marked },
      { agentId: 'agent_one', conversationId: 'conv_recent', startedAt: Date.now() - 2 * 86400000, usage: legacy },
      { agentId: 'agent_two', conversationId: 'conv_old', startedAt: Date.now() - 8 * 86400000,
        usage: { inputTokens: 10, outputTokens: 1, cacheReadTokens: 10, cacheCreationTokens: 0, model: 'model_legacy' } },
    ])
    const result: UsageSummary = await (await GET()).json()
    expect(result.today).toEqual({ inputTokens: 100, outputTokens: 10, cacheReadTokens: 60,
      cacheCreationTokens: 20, totalTokens: 110, runs: 1 })
    expect(result.week.totalTokens).toBe(175)
    expect(result.allTime).toEqual({ inputTokens: 180, outputTokens: 16, cacheReadTokens: 100,
      cacheCreationTokens: 30, totalTokens: 196, runs: 3 })
    expect(result.byAgent.map(({ agentId, totalTokens }) => [agentId, totalTokens])).toEqual([
      ['agent_one', 175], ['agent_two', 21],
    ])
    expect(result.byModel.map(({ model, totalTokens }) => [model, totalTokens])).toEqual([
      ['model_total', 110], ['model_legacy', 86],
    ])
    expect(result.topConversations.map(({ id, totalTokens }) => [id, totalTokens])).toEqual([
      ['conv_recent', 175], ['conv_old', 21],
    ])
    expect(marked.inputTokens).toBe(100)
    expect(legacy.inputTokens).toBe(20)
    expect('inputTokensIncludeCache' in legacy).toBe(false)
  })

  it('retains empty summaries and avoids metadata queries when no usage is present', async () => {
    query.agentRuns.findMany.mockResolvedValue([])
    const result: UsageSummary = await (await GET()).json()
    expect(result.allTime).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheCreationTokens: 0, totalTokens: 0, runs: 0 })
    expect(result.byAgent).toEqual([])
    expect(result.byModel).toEqual([])
    expect(result.topConversations).toEqual([])
    expect(query.agents.findMany).not.toHaveBeenCalled()
    expect(query.conversations.findMany).not.toHaveBeenCalled()
  })
})

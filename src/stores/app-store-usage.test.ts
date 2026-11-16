import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import type { AgentRow, AgentRunRow, MessageRow, RunUsage } from '@/db/schema'

import { useAppStore, useConversationUsageTotal, type ConversationUsageTotal } from './app-store'

type StoreState = ReturnType<typeof useAppStore.getState>

function message(id: string, usage: MessageRow['usage'], createdAt = 1): MessageRow {
  return { id, conversationId: 'conv_usage', role: 'agent', agentId: 'ag_usage', parts: [], status: 'complete',
    parentMessageId: null, mentionedAgentIds: [], runId: 'run_' + id, usage, createdAt }
}

function run(id: string, agentId: string, usage: RunUsage, startedAt: number): AgentRunRow {
  return { id, conversationId: 'conv_usage', agentId, triggerMessageId: null, status: 'complete', error: null,
    parentRunId: null, usage, startedAt, finishedAt: startedAt + 1 }
}

function renderUsage(fixture: Partial<StoreState>): ConversationUsageTotal {
  // Server rendering consumes Zustand's initial snapshot, so seed that snapshot explicitly.
  const initial = useAppStore.getInitialState()
  const previous = { ...initial }
  Object.assign(initial, { runsByConv: {}, messageIdsByConv: {}, messages: {}, agents: {} }, fixture)
  let result: ConversationUsageTotal | undefined
  function Probe() {
    result = useConversationUsageTotal('conv_usage')
    return null
  }
  try {
    renderToStaticMarkup(createElement(Probe))
    if (!result) throw new Error('Usage hook did not produce a server snapshot')
    return result
  } finally {
    Object.assign(initial, previous)
  }
}

describe('conversation usage aggregation', () => {
  it('normalizes mixed run records before totals and agent/model grouping', () => {
    const marked = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 60, cacheCreationTokens: 20,
      inputTokensIncludeCache: true, model: 'model_total' }
    const legacy = { inputTokens: 20, outputTokens: 5, cacheReadTokens: 30, cacheCreationTokens: 10,
      model: 'model_legacy' }
    const total = renderUsage({ runsByConv: { conv_usage: {
      run_marked: run('run_marked', 'ag_total', marked, 1),
      run_legacy: run('run_legacy', 'ag_legacy', legacy, 2),
    } } })
    expect(total).toEqual({ inputTokens: 160, outputTokens: 15, cacheReadTokens: 90, cacheCreationTokens: 30,
      totalTokens: 175, lastInputTokens: 60, byAgent: { ag_total: 110, ag_legacy: 65 },
      byModel: { model_total: 110, model_legacy: 65 }, runCount: 2 })
    expect(marked.inputTokens).toBe(100)
    expect(legacy.inputTokens).toBe(20)
  })

  it('keeps explicit last-input observations and gives runs priority over duplicate messages', () => {
    const usage = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 60, cacheCreationTokens: 20,
      inputTokensIncludeCache: true, lastInputTokens: 77 }
    const total = renderUsage({ runsByConv: { conv_usage: { run: run('run', 'ag_usage', usage, 1) } },
      messageIdsByConv: { conv_usage: ['msg'] }, messages: { msg: message('msg', usage) } })
    expect(total.totalTokens).toBe(110)
    expect(total.lastInputTokens).toBe(77)
    expect(total.runCount).toBe(1)
  })

  it('normalizes the message-only reload fallback with per-record flags', () => {
    const total = renderUsage({ messageIdsByConv: { conv_usage: ['marked', 'legacy'] }, messages: {
      marked: message('marked', { inputTokens: 100, outputTokens: 10, cacheReadTokens: 60,
        inputTokensIncludeCache: true }, 1),
      legacy: message('legacy', { inputTokens: 20, outputTokens: 5, cacheReadTokens: 30 }, 2),
    }, agents: { ag_usage: { modelId: 'current_model' } as AgentRow } })
    expect(total).toEqual({ inputTokens: 150, outputTokens: 15, cacheReadTokens: 90, cacheCreationTokens: 0,
      totalTokens: 165, lastInputTokens: 50, byAgent: { ag_usage: 165 }, byModel: { current_model: 165 }, runCount: 2 })
  })
})

describe('usage marker event and snapshot reconciliation', () => {
  beforeEach(() => useAppStore.setState({ messages: {}, messageIdsByConv: {}, runsByConv: {} }))

  it('updates a flag-only snapshot through the real equality path without inferring history', () => {
    const store = useAppStore.getState()
    const legacy = message('msg', { inputTokens: 100, outputTokens: 10, cacheReadTokens: 60 })
    store.setMessagesForConversation('conv_usage', [legacy])
    const previous = useAppStore.getState().messages.msg
    store.setMessagesForConversation('conv_usage', [{ ...legacy, usage: { ...legacy.usage!, inputTokensIncludeCache: true } }])
    expect(useAppStore.getState().messages.msg).not.toBe(previous)
    expect(useAppStore.getState().messages.msg.usage?.inputTokensIncludeCache).toBe(true)
    expect(previous.usage?.inputTokensIncludeCache).toBeUndefined()
  })

  it('preserves run and message semantic flags delivered through StreamEvent', () => {
    const store = useAppStore.getState()
    store.upsertMessage(message('msg', null))
    store.applyEvent({ type: 'run.start', conversationId: 'conv_usage', timestamp: 1,
      runId: 'run_usage', agentId: 'ag_usage', triggerMessageId: 'trigger_usage' })
    const usage = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 60, cacheCreationTokens: 20,
      inputTokensIncludeCache: true }
    store.applyEvent({ type: 'run.usage', conversationId: 'conv_usage', timestamp: 2, runId: 'run_usage', usage })
    store.applyEvent({ type: 'message.usage', conversationId: 'conv_usage', timestamp: 2, messageId: 'msg', usage })
    expect(useAppStore.getState().runsByConv.conv_usage.run_usage.usage).toEqual(usage)
    expect(useAppStore.getState().messages.msg.usage).toEqual(usage)
  })
})

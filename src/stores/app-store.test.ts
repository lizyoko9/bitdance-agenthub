import { beforeEach, describe, expect, it } from 'vitest'

import type { MessageRow } from '@/db/schema'
import { encodeMessageHistoryCursor, type MessageHistoryPage } from '@/shared/message-history'
import type { DispatchPlanItem } from '@/shared/types'

import { selectDispatchForMessage, useAppStore } from './app-store'

const PLAN: DispatchPlanItem[] = [
  {
    id: 'task_frontend',
    agentId: 'ag_frontend',
    task: '实现页面调整',
  },
]

function resetStore(): void {
  useAppStore.setState({
    conversations: {},
    agents: {},
    messages: {},
    artifacts: {},
    messageIdsByConv: {},
    messageHistoryByConv: {},
    messageHistoryRecency: [],
    messageHistoryLiveIdsByConv: {},
    messageHistoryMutationsByConv: {},
    runsByConv: {},
    dispatchesByRunId: {},
    activeConversationId: null,
    previewArtifactId: null,
    fileExplorerOpen: false,
    openFilesByConv: {},
    activeTabByConv: {},
    replyTargetByConv: {},
    replyMessagePreviewByConv: {},
    pendingQuoteForInput: null,
    pendingAttachmentsByConv: {},
    pendingWritesByConv: {},
    pendingBashCommandsByConv: {},
    pendingQuestionsByConv: {},
    unreadByConv: {},
    mobileSidebarOpen: false,
    highlightedMessageId: null,
    streamConnected: false,
  })
}

function agentMessage(id: string, runId: string, createdAt: number): MessageRow {
  return {
    id,
    conversationId: 'conv_1',
    role: 'agent',
    agentId: 'ag_orchestrator',
    parts: [],
    status: 'complete',
    parentMessageId: null,
    mentionedAgentIds: [],
    runId,
    usage: null,
    createdAt,
  }
}

function historyPage(messages: MessageRow[], fields: Partial<MessageHistoryPage> = {}): MessageHistoryPage {
  return {
    messages, eventId: 'boot-10', olderCursor: null, newerCursor: null, latestUserMessageId: null,
    latestAgentMessageId: messages.at(-1)?.id ?? null, ...fields,
  }
}

describe('bounded message history', () => {
  beforeEach(resetStore)

  it('evicts settled rows and metadata for the least recent inactive room while preserving local and live work', () => {
    const store = useAppStore.getState()
    for (const [index, conversationId] of ['conv_1', 'conv_2', 'conv_3', 'conv_4'].entries()) {
      store.setActiveConversation(conversationId)
      const message = { ...agentMessage(`msg_${index}`, 'settled', index), conversationId }
      store.setMessageHistoryPage(conversationId, historyPage([message]))
      if (index === 0) {
        store.upsertMessage({ ...message, id: 'msg_live', status: 'streaming' })
        store.addLocalUserMessage({ tempId: 'temp_1', conversationId, content: 'pending', mentionedAgentIds: [] })
        store.setReplyTarget(conversationId, 'msg_0')
      }
    }
    const state = useAppStore.getState()
    expect(state.messageHistoryRecency).toEqual(['conv_4', 'conv_3', 'conv_2'])
    expect(state.messageHistoryByConv.conv_1).toBeUndefined()
    expect(state.messageIdsByConv.conv_1).toBeUndefined()
    expect(state.messages.msg_0).toBeUndefined()
    expect(state.messages.msg_live?.status).toBe('streaming')
    expect(state.messages.temp_1).toBeDefined()
    expect(state.replyTargetByConv.conv_1).toBe('msg_0')
    expect(state.replyMessagePreviewByConv.conv_1?.id).toBe('msg_0')
    store.setMessageHistoryPage('conv_1', historyPage([agentMessage('stale_response', 'stale', 99)]))
    expect(useAppStore.getState().messages.stale_response).toBeUndefined()
    store.applyEvent({ type: 'message.end', timestamp: 100, conversationId: 'conv_1', messageId: 'msg_live' })
    expect(useAppStore.getState().messages.msg_live).toBeUndefined()
  })

  it('retains a contiguous older window, does not append across a live gap, and returns to latest', () => {
    const store = useAppStore.getState()
    const rows = Array.from({ length: 251 }, (_, index) => agentMessage(`msg_${index}`, 'run', index))
    store.setActiveConversation('conv_1')
    store.setMessageHistoryPage('conv_1', historyPage(rows.slice(100, 230), {
      olderCursor: encodeMessageHistoryCursor(rows[100]),
    }))
    store.setMessageHistoryPage('conv_1', historyPage(rows.slice(0, 101), {
      newerCursor: encodeMessageHistoryCursor(rows[100]), latestAgentMessageId: 'msg_229',
    }), 'older')
    expect(useAppStore.getState().messageIdsByConv.conv_1).toEqual(rows.slice(0, 200).map(row => row.id))
    expect(useAppStore.getState().messageHistoryByConv.conv_1?.newerCursor).toBe(encodeMessageHistoryCursor(rows[199]))
    expect(useAppStore.getState().messages.msg_229).toBeUndefined()

    store.applyEvent({ type: 'message.start', timestamp: 250, conversationId: 'conv_1',
      messageId: 'msg_250', agentId: 'agent', runId: 'latest_run' })
    expect(useAppStore.getState().messageIdsByConv.conv_1).not.toContain('msg_250')
    expect(useAppStore.getState().messageHistoryByConv.conv_1?.latestAgentMessageId).toBe('msg_250')
    expect(useAppStore.getState().messages.msg_250?.status).toBe('streaming')
    store.setMessageHistoryPage('conv_1', historyPage(rows.slice(199, 250)), 'newer')
    expect(useAppStore.getState().messageIdsByConv.conv_1).toEqual(rows.slice(50).map(row => row.id))
    expect(useAppStore.getState().messageHistoryByConv.conv_1?.newerCursor).toBeNull()
    expect(useAppStore.getState().messageHistoryByConv.conv_1?.latestAgentMessageId).toBe('msg_250')
    expect(useAppStore.getState().messages.msg_0).toBeUndefined()
  })

  it('reconciles latest action eligibility after regenerate removes a response and then starts its replacement', () => {
    const store = useAppStore.getState()
    const first = agentMessage('msg_first', 'run_first', 1)
    const old = agentMessage('msg_old', 'run_old', 2)
    store.setActiveConversation('conv_1')
    store.setMessageHistoryPage('conv_1', historyPage([first, old]))
    store.applyEvent({ type: 'message.removed', conversationId: 'conv_1', messageIds: [old.id], artifactIds: [], timestamp: 3 })
    expect(useAppStore.getState().messageHistoryByConv.conv_1?.latestAgentMessageId).toBe(first.id)
    store.applyEvent({ type: 'message.start', conversationId: 'conv_1', timestamp: 4,
      messageId: 'msg_replacement', agentId: 'agent', runId: 'run_replacement' })
    expect(useAppStore.getState().messageHistoryByConv.conv_1?.latestAgentMessageId).toBe('msg_replacement')
  })

  it('rebases a delayed latest snapshot without overwriting newer deltas or resurrecting deleted rows', () => {
    const store = useAppStore.getState()
    const streaming: MessageRow = { ...agentMessage('msg_stream', 'run_stream', 33), status: 'streaming',
      parts: [{ type: 'text', content: 'prefix' }] }
    const removed = agentMessage('msg_removed', 'run_removed', 34)
    const stalePage = historyPage([streaming, removed], { eventId: 'boot-20' })
    store.setActiveConversation('conv_1')
    store.setMessageHistoryPage('conv_1', stalePage)
    store.applyEvent({ type: 'part.delta', messageId: streaming.id, conversationId: 'conv_1', timestamp: 35,
      partIndex: 0, delta: { type: 'text.append', text: ' + delta' } }, 'boot-21')
    store.applyEvent({ type: 'message.end', messageId: streaming.id, conversationId: 'conv_1', timestamp: 36 }, 'boot-22')
    store.applyEvent({ type: 'message.removed', messageIds: [removed.id], artifactIds: [],
      conversationId: 'conv_1', timestamp: 37 }, 'boot-23')
    expect(store.setMessageHistoryPage('conv_1', stalePage)).toBe(true)
    expect(useAppStore.getState().messages.msg_stream).toMatchObject({
      status: 'complete', parts: [{ type: 'text', content: 'prefix + delta' }],
    })
    expect(useAppStore.getState().messages.msg_removed).toBeUndefined()
    expect(useAppStore.getState().messageIdsByConv.conv_1).toEqual([streaming.id])
    expect(useAppStore.getState().messageHistoryByConv.conv_1?.latestAgentMessageId).toBe(streaming.id)
  })

  it('rejects pages older than the accepted recovery snapshot, even across server boots', () => {
    const store = useAppStore.getState()
    store.setActiveConversation('conv_1')
    const before = agentMessage('msg_previous', 'run', 101)
    const after = agentMessage('msg_restored', 'run', 102)
    const previous = historyPage([before], { eventId: 'oldboot-42' })
    const authoritative = historyPage([after], { eventId: 'newboot-5' })
    store.setMessageHistoryPage('conv_1', previous)
    store.resetForStreamResync()
    expect(store.setMessageHistoryPage('conv_1', authoritative)).toBe(true)
    expect(store.setMessageHistoryPage('conv_1', previous)).toBe(false)
    expect(store.setMessageHistoryPage('conv_1', { ...previous, eventId: 'newboot-3' })).toBe(false)
    expect(useAppStore.getState().messageIdsByConv.conv_1).toEqual([after.id])
  })
})

describe('app-store dispatch plan binding', () => {
  beforeEach(() => {
    resetStore()
  })

  it('does not return the same dispatch for every message in the run', () => {
    useAppStore.setState({
      messages: {
        msg_plan: agentMessage('msg_plan', 'run_orch', 1),
        msg_extra: agentMessage('msg_extra', 'run_orch', 2),
      },
      dispatchesByRunId: {
        run_orch: {
          runId: 'run_orch',
          messageId: 'msg_plan',
          plan: PLAN,
          taskStatus: { task_frontend: 'pending' },
          childRunIds: {},
          reviewStatus: 'pending',
          pendingPlanId: 'pdp_1',
        },
      },
    })

    const state = useAppStore.getState()
    expect(selectDispatchForMessage(state, 'msg_plan')?.runId).toBe('run_orch')
    expect(selectDispatchForMessage(state, 'msg_extra')).toBeNull()
  })

  it('attaches a pending dispatch to the next message for that run', () => {
    useAppStore.getState().applyEvent({
      type: 'dispatch.plan.pending',
      conversationId: 'conv_1',
      timestamp: 1,
      pendingPlan: {
        id: 'pdp_1',
        conversationId: 'conv_1',
        agentId: 'ag_orchestrator',
        runId: 'run_orch',
        plan: PLAN,
        createdAt: 1,
      },
    })

    expect(useAppStore.getState().dispatchesByRunId.run_orch?.messageId).toBe('')

    useAppStore.getState().applyEvent({
      type: 'message.start',
      conversationId: 'conv_1',
      timestamp: 2,
      messageId: 'msg_plan',
      agentId: 'ag_orchestrator',
      runId: 'run_orch',
    })

    const state = useAppStore.getState()
    expect(state.dispatchesByRunId.run_orch?.messageId).toBe('msg_plan')
    expect(selectDispatchForMessage(state, 'msg_plan')?.pendingPlanId).toBe('pdp_1')
  })
})

describe('app-store run failure cleanup', () => {
  beforeEach(() => {
    resetStore()
  })

  it('adds error results for unresolved tool calls when a run fails', () => {
    useAppStore.setState({
      messages: {
        msg_tool: {
          ...agentMessage('msg_tool', 'run_failed', 1),
          status: 'streaming',
          parts: [
            {
              type: 'tool_use',
              callId: 'call_bash',
              toolName: 'bash',
              args: { command: 'npm run dev' },
            },
          ],
        },
      },
      messageIdsByConv: { conv_1: ['msg_tool'] },
    })

    useAppStore.getState().applyEvent({
      type: 'run.end',
      conversationId: 'conv_1',
      timestamp: 2,
      runId: 'run_failed',
      status: 'failed',
      error: 'process exited with code 1',
    })

    const message = useAppStore.getState().messages.msg_tool
    expect(message.status).toBe('error')
    expect(message.parts).toContainEqual({
      type: 'tool_result',
      callId: 'call_bash',
      result: '工具调用未完成：本次运行失败。process exited with code 1',
      isError: true,
    })

    useAppStore.getState().applyEvent({
      type: 'tool.result',
      conversationId: 'conv_1',
      timestamp: 3,
      messageId: 'msg_tool',
      callId: 'call_bash',
      result: 'server fallback',
      isError: true,
    })

    const results = useAppStore
      .getState()
      .messages.msg_tool.parts.filter((part) => part.type === 'tool_result')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      type: 'tool_result',
      callId: 'call_bash',
      result: 'server fallback',
      isError: true,
    })
  })

  it('does not duplicate existing tool results on aborted runs', () => {
    useAppStore.setState({
      messages: {
        msg_tool: {
          ...agentMessage('msg_tool', 'run_aborted', 1),
          status: 'streaming',
          parts: [
            {
              type: 'tool_use',
              callId: 'call_done',
              toolName: 'fs_read',
              args: { path: 'README.md' },
            },
            {
              type: 'tool_result',
              callId: 'call_done',
              result: 'ok',
              isError: false,
            },
          ],
        },
      },
      messageIdsByConv: { conv_1: ['msg_tool'] },
    })

    useAppStore.getState().applyEvent({
      type: 'run.end',
      conversationId: 'conv_1',
      timestamp: 2,
      runId: 'run_aborted',
      status: 'aborted',
    })

    const message = useAppStore.getState().messages.msg_tool
    expect(message.status).toBe('aborted')
    expect(message.parts.filter((part) => part.type === 'tool_result')).toHaveLength(1)
  })
})

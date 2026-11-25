import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessageRow } from '@/db/schema'
import type { MessageHistoryPage } from '@/shared/message-history'
import type { PendingSkillInstall, StreamEvent } from '@/shared/types'
import { useAppStore } from '@/stores/app-store'

const api = vi.hoisted(() => ({
  fetchConversations: vi.fn(async () => []),
  fetchMessageHistory: vi.fn<(conversationId: string, options?: { signal?: AbortSignal }) => Promise<MessageHistoryPage>>(),
  fetchPendingWrites: vi.fn(async () => []),
  fetchPendingBashCommands: vi.fn(async () => []),
  fetchPendingQuestions: vi.fn(async () => []),
  fetchPendingDispatchPlans: vi.fn(async () => []),
  fetchPendingSkillInstalls: vi.fn<() => Promise<PendingSkillInstall[]>>(async () => []),
}))

const lifecycle = vi.hoisted(() => ({
  cleanup: null as (() => void) | null,
  getRecoveryFailed: null as (() => boolean) | null,
}))

vi.mock('@/lib/api', () => api)
vi.mock('@/lib/message-history', () => ({ fetchMessageHistory: api.fetchMessageHistory }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect(effect: () => () => void) { lifecycle.cleanup = effect() },
  useSyncExternalStore(_subscribe: unknown, getSnapshot: () => boolean) {
    lifecycle.getRecoveryFailed = getSnapshot
    return getSnapshot()
  },
}))

import { StreamProvider, resyncFromSnapshot } from './stream-provider'

class FakeEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  static connections: FakeEventSource[] = []
  readyState = FakeEventSource.OPEN
  onopen?: () => void
  onerror?: () => void
  onmessage?: (event: { data: string; lastEventId: string }) => void

  constructor(readonly url: string) {
    FakeEventSource.connections.push(this)
  }

  emit(event: { type: string }, lastEventId = '') {
    this.onmessage?.({ data: JSON.stringify(event), lastEventId })
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }
}

function mount(): FakeEventSource {
  StreamProvider({ children: null })
  return FakeEventSource.connections.at(-1)!
}

function unmount() {
  lifecycle.cleanup?.()
  lifecycle.cleanup = null
}

function history(messages: MessageRow[] = [], eventId = 'boot-10'): MessageHistoryPage {
  return { messages, eventId, olderCursor: null, newerCursor: null,
    latestUserMessageId: null, latestAgentMessageId: messages.at(-1)?.id ?? null }
}

function savedMessage(content: string, conversationId = 'conv_1'): MessageRow {
  return { id: `message-${conversationId}`, conversationId, role: 'agent', agentId: 'agent',
    parts: [{ type: 'text', content }], status: 'streaming', parentMessageId: null,
    mentionedAgentIds: [], runId: 'run', usage: null, createdAt: 1 }
}

function textDelta(text: string): StreamEvent {
  return { conversationId: 'conv_1', timestamp: 1, type: 'part.delta', messageId: 'message-conv_1',
    partIndex: 0, delta: { type: 'text.append', text } }
}

function deferredHistory() {
  let settle!: (result: MessageHistoryPage) => void
  const promise = new Promise<MessageHistoryPage>((resolve) => { settle = resolve })
  return { promise, settle }
}

function recoverySignal(index: number): AbortSignal | undefined {
  return api.fetchMessageHistory.mock.calls[index]?.[1]?.signal
}

function visibleMessage(): MessageRow {
  return useAppStore.getState().messages['message-conv_1']
}

const pending: PendingSkillInstall = {
  id: 'psi_missed',
  conversationId: 'conv_1',
  agentId: 'ag_1',
  runId: 'run_1',
  sourceUrl: 'https://github.com/example/skills/blob/main/SKILL.md',
  name: 'Review',
  description: 'Review changes',
  category: 'imported',
  instruction: 'Read the code',
  createdAt: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal('EventSource', FakeEventSource)
  FakeEventSource.connections = []
  api.fetchMessageHistory.mockReset().mockResolvedValue(history())
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveConversation('conv_1')
})

afterEach(() => {
  unmount()
  lifecycle.getRecoveryFailed = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('skill approval gap recovery', () => {
  it('restores an approval whose pending event was lost before reconnect', async () => {
    api.fetchPendingSkillInstalls.mockResolvedValueOnce([pending])

    await resyncFromSnapshot()

    expect(api.fetchPendingSkillInstalls).toHaveBeenCalledWith('conv_1', expect.any(AbortSignal))
    expect(useAppStore.getState().pendingSkillInstallsByConv.conv_1).toEqual([pending])
  })

  it('removes stale current approvals and uncached background conversation approvals', async () => {
    useAppStore.getState().setPendingSkillInstallsForConversation('conv_1', [pending])
    useAppStore.getState().setPendingSkillInstallsForConversation('conv_2', [
      { ...pending, id: 'psi_old', conversationId: 'conv_2' },
    ])

    await resyncFromSnapshot()

    expect(useAppStore.getState().pendingSkillInstallsByConv).toEqual({})
  })

  it('clears only the ended run approvals while preserving parallel approvals', () => {
    const parallel = { ...pending, id: 'psi_parallel', runId: 'run_2' }
    useAppStore.getState().setPendingSkillInstallsForConversation('conv_1', [pending, parallel])

    useAppStore.getState().applyEvent({
      type: 'run.end', conversationId: 'conv_1', runId: 'run_1', status: 'aborted', timestamp: 2,
    })

    expect(useAppStore.getState().pendingSkillInstallsByConv.conv_1).toEqual([parallel])
  })

  it('does not let a slower previous resync replace newer approval state', async () => {
    let finishOld!: (list: PendingSkillInstall[]) => void
    const oldSnapshot = new Promise<PendingSkillInstall[]>((resolve) => { finishOld = resolve })
    api.fetchPendingSkillInstalls.mockReturnValueOnce(oldSnapshot).mockResolvedValueOnce([])

    const first = resyncFromSnapshot()
    await resyncFromSnapshot()
    finishOld([pending])
    await first

    expect(useAppStore.getState().pendingSkillInstallsByConv).toEqual({})
  })
})

describe('bounded snapshot recovery', () => {
  it('applies later text and terminal and approval events once with a delayed snapshot', async () => {
    const slow = deferredHistory()
    api.fetchMessageHistory.mockReturnValueOnce(slow.promise)
    api.fetchPendingSkillInstalls.mockResolvedValueOnce([pending])
    const source = mount()
    useAppStore.getState().setMessagesForConversation('conv_1', [savedMessage('before')])
    source.emit({ type: 'resync' })
    source.emit(textDelta('snapshot text'), 'boot-9')
    source.emit(textDelta(' plus live'), 'boot-11')
    const terminal: StreamEvent = { type: 'message.end', conversationId: 'conv_1',
      timestamp: 1, messageId: 'message-conv_1' }
    const approval: StreamEvent = { type: 'skill_install.resolved', conversationId: 'conv_1',
      timestamp: 1, pendingId: pending.id, installed: false }
    source.emit(terminal, 'boot-12')
    source.emit(approval, 'boot-13')
    expect(visibleMessage().parts[0]).toEqual({ type: 'text', content: 'before' })

    slow.settle(history([savedMessage('snapshot text')]))
    await vi.advanceTimersByTimeAsync(0)
    expect(visibleMessage()).toMatchObject({ status: 'complete',
      parts: [{ type: 'text', content: 'snapshot text plus live' }] })
    expect(useAppStore.getState().pendingSkillInstallsByConv.conv_1).toBeUndefined()

    // A separate history request can finish after this recovery.
    useAppStore.getState().setMessageHistoryPage('conv_1', history([savedMessage('snapshot text')]))
    expect(visibleMessage()).toMatchObject({ status: 'complete',
      parts: [{ type: 'text', content: 'snapshot text plus live' }] })
  })

  it('keeps applied live mutations and removals when an older page finishes later', () => {
    const source = mount()
    const stale = history([savedMessage('initial')], 'boot-30')
    useAppStore.getState().setMessageHistoryPage('conv_1', stale)
    source.emit(textDelta(' live'), 'boot-31')
    useAppStore.getState().setMessageHistoryPage('conv_1', stale)
    expect(visibleMessage().parts[0]).toEqual({ type: 'text', content: 'initial live' })

    const removal: StreamEvent = { type: 'message.removed', conversationId: 'conv_1',
      timestamp: 1, messageIds: ['message-conv_1'], artifactIds: [] }
    source.emit(removal, 'boot-32')
    useAppStore.getState().setMessageHistoryPage('conv_1', stale)
    expect(visibleMessage()).toBeUndefined()
  })

  it.each(['count', 'bytes'] as const)('cancels at the %s limit and retries from a fresh snapshot', async (limit) => {
    const slow = deferredHistory()
    api.fetchMessageHistory.mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(history([savedMessage('fresh')], 'boot-2000'))
    const source = mount()
    source.emit({ type: 'resync' })

    if (limit === 'count') {
      for (let seq = 1; seq <= 1000; seq++) source.emit(textDelta('queued'), `boot-${seq}`)
    } else {
      const bytesLeft = 4 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(textDelta('')))
      source.emit(textDelta('中'.repeat(Math.floor(bytesLeft / 3)) + 'a'.repeat(bytesLeft % 3)), 'boot-1')
    }
    const first = recoverySignal(0)
    expect(first?.aborted).toBe(false)
    source.emit({ type: 'heartbeat' }, 'boot-999')
    expect(first?.aborted).toBe(false)
    source.emit(textDelta('overflow'), 'boot-1001')
    expect(first?.aborted).toBe(true)
    source.emit(textDelta('during backoff'), 'boot-1002')
    await vi.advanceTimersByTimeAsync(1000)
    slow.settle(history([savedMessage('stale')]))
    await vi.advanceTimersByTimeAsync(0)
    expect(visibleMessage().parts[0]).toEqual({ type: 'text', content: 'fresh' })
  })

  it('discards failed attempts without applying their events or partial approval snapshots', async () => {
    const failed = deferredHistory()
    api.fetchMessageHistory.mockReturnValueOnce(failed.promise)
      .mockResolvedValueOnce(history([savedMessage('retry snapshot')]))
    api.fetchPendingSkillInstalls.mockResolvedValueOnce([pending])
    api.fetchPendingWrites.mockRejectedValueOnce(new Error('pending writes fixture failure'))
    const source = mount()
    useAppStore.getState().setMessagesForConversation('conv_1', [savedMessage('existing')])
    source.emit({ type: 'resync' })
    source.emit(textDelta('never replay'), 'boot-11')
    await vi.advanceTimersByTimeAsync(0)

    expect(recoverySignal(0)?.aborted).toBe(true)
    expect(visibleMessage().parts[0]).toEqual({ type: 'text', content: 'existing' })
    expect(useAppStore.getState().pendingSkillInstallsByConv.conv_1).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1000)
    failed.settle(history([savedMessage('obsolete')]))
    await vi.advanceTimersByTimeAsync(0)
    expect(visibleMessage().parts[0]).toEqual({ type: 'text', content: 'retry snapshot' })
  })

  it('times out stalled requests and stops exponential retries with a retryable error', async () => {
    const stalled = deferredHistory()
    api.fetchMessageHistory.mockReturnValueOnce(stalled.promise)
      .mockRejectedValueOnce(new Error('second failure')).mockRejectedValueOnce(new Error('third failure'))
    const source = mount()
    source.emit({ type: 'resync' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(recoverySignal(0)?.aborted).toBe(true)
    expect(api.fetchMessageHistory).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(api.fetchMessageHistory).toHaveBeenCalledTimes(3)
    expect(lifecycle.getRecoveryFailed?.()).toBe(true)
    source.emit(textDelta('while failed'), 'boot-11')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.fetchMessageHistory).toHaveBeenCalledTimes(3)
    await resyncFromSnapshot()
    stalled.settle(history([savedMessage('too late')]))
    await vi.advanceTimersByTimeAsync(0)
    expect(lifecycle.getRecoveryFailed?.()).toBe(false)
    expect(visibleMessage()).toBeUndefined()
  })

  it('cancels on disconnect, reconnects from applied progress and ignores the obsolete source', async () => {
    const slow = deferredHistory()
    api.fetchMessageHistory.mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(history([savedMessage('after reconnect')], 'fresh-20'))
    const source = mount()
    source.emit(textDelta('applied'), 'first-5')
    source.emit({ type: 'resync' })
    source.emit(textDelta('not applied'), 'first-6')
    source.close()
    source.onerror?.()
    expect(recoverySignal(0)?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    const newSource = FakeEventSource.connections[1]
    expect(newSource.url).toBe('/api/stream?lastEventId=first-5')
    newSource.onopen?.()
    source.emit(textDelta('old source'), 'first-7')
    slow.settle(history([savedMessage('obsolete')]))
    await vi.advanceTimersByTimeAsync(0)
    expect(visibleMessage().parts[0]).toEqual({ type: 'text', content: 'after reconnect' })
  })

  it('cancels superseded conversations and unmounted work without a late state write', async () => {
    const old = deferredHistory()
    const selected = deferredHistory()
    api.fetchMessageHistory.mockReturnValueOnce(old.promise).mockReturnValueOnce(selected.promise)
    const source = mount()
    source.emit({ type: 'resync' })
    useAppStore.getState().setActiveConversation('conv_2')
    expect(recoverySignal(0)?.aborted).toBe(true)
    expect(api.fetchMessageHistory.mock.calls[1]?.[0]).toBe('conv_2')
    old.settle(history([savedMessage('old conversation')]))
    await vi.advanceTimersByTimeAsync(0)
    expect(visibleMessage()).toBeUndefined()
    unmount()
    expect(recoverySignal(1)?.aborted).toBe(true)
    selected.settle(history([savedMessage('after unmount', 'conv_2')]))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(useAppStore.getState().messages['message-conv_2']).toBeUndefined()
    expect(api.fetchMessageHistory).toHaveBeenCalledTimes(2)
  })
})

'use client'

import { useEffect, useSyncExternalStore } from 'react'

import {
  fetchConversations,
  fetchPendingBashCommands,
  fetchPendingDispatchPlans,
  fetchPendingQuestions,
  fetchPendingSkillInstalls,
  fetchPendingWrites,
} from '@/lib/api'
import { fetchMessageHistory } from '@/lib/message-history'
import { compareStreamEventIds, selectQueuedEventsAfterSnapshot, type QueuedStreamEvent } from '@/lib/stream-resync'
import type { StreamEvent } from '@/shared/types'
import { useAppStore } from '@/stores/app-store'

/**
 * StreamProvider — 全局唯一 SSE 连接，把 /api/stream 推过来的事件
 * 转发到 Zustand store。详见 specs/02-stream-events.md §SSE 编码。
 *
 * 在 layout.tsx 中挂载一次。React StrictMode 在 dev 下会双 mount，
 * 这里用 module 级 ref 防止重复连接。
 *
 * 断线恢复：浏览器自动重连带 Last-Event-ID，服务端补发缺口；补不上时推 `resync`，
 * 这里重拉快照，期间到达的事件先排队，快照落地后只应用快照之后的部分。
 */

const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 10_000
const RECOVERY_TIMEOUT_MS = 10_000
const RECOVERY_MAX_ATTEMPTS = 3
const RECOVERY_MAX_EVENTS = 1000
const RECOVERY_MAX_BYTES = 4 * 1024 * 1024
const encoder = new TextEncoder()

type RecoveryAttempt = {
  controller: AbortController
  queue: QueuedStreamEvent[]
  bytes: number
  timeout: ReturnType<typeof setTimeout> | null
}
type Recovery = {
  attempt: RecoveryAttempt | null
  attempts: number
  retry: ReturnType<typeof setTimeout> | null
}

let activeSource: EventSource | null = null
let refCount = 0
let appliedEventId: string | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let unsubscribeConversation: (() => void) | null = null
let recovery: Recovery | null = null
let recoveryFailed = false
const recoveryListeners = new Set<() => void>()

function subscribeRecovery(listener: () => void): () => void {
  recoveryListeners.add(listener)
  return () => { recoveryListeners.delete(listener) }
}

function signalRecoveryFailure(failed: boolean): void {
  if (failed === recoveryFailed) return
  recoveryFailed = failed
  for (const listener of recoveryListeners) listener()
}

function cancelRecoveryWork(state: Recovery): void {
  const attempt = state.attempt
  state.attempt = null
  if (attempt) {
    if (attempt.timeout !== null) clearTimeout(attempt.timeout)
    attempt.queue.length = 0
    attempt.controller.abort()
  }
  if (state.retry !== null) clearTimeout(state.retry)
  state.retry = null
}

function isCurrentAttempt(state: Recovery, attempt: RecoveryAttempt): boolean {
  return recovery === state && state.attempt === attempt
}

function rejectRecoveryAttempt(state: Recovery, attempt: RecoveryAttempt): void {
  if (!isCurrentAttempt(state, attempt)) return
  cancelRecoveryWork(state)
  if (state.attempts >= RECOVERY_MAX_ATTEMPTS) {
    signalRecoveryFailure(true)
    return
  }
  state.retry = setTimeout(() => {
    state.retry = null
    void runRecoveryAttempt(state)
  }, RECONNECT_BASE_DELAY_MS * 2 ** (state.attempts - 1))
}

function fetchPending(conversationId: string, signal: AbortSignal) {
  return Promise.all([
    fetchPendingWrites(conversationId, signal),
    fetchPendingBashCommands(conversationId, signal),
    fetchPendingQuestions(conversationId, signal),
    fetchPendingDispatchPlans(conversationId, signal),
    fetchPendingSkillInstalls(conversationId, signal),
  ])
}

async function runRecoveryAttempt(state: Recovery): Promise<void> {
  if (recovery !== state || (activeSource && activeSource.readyState !== EventSource.OPEN)) return
  const conversationId = useAppStore.getState().activeConversationId
  const attempt: RecoveryAttempt = {
    controller: new AbortController(), queue: [], bytes: 0, timeout: null,
  }
  state.attempt = attempt
  state.attempts++
  attempt.timeout = setTimeout(() => rejectRecoveryAttempt(state, attempt), RECOVERY_TIMEOUT_MS)
  const { signal } = attempt.controller
  try {
    const [conversations, page, pending] = await Promise.all([
      fetchConversations(signal),
      conversationId ? fetchMessageHistory(conversationId, { signal }) : null,
      conversationId ? fetchPending(conversationId, signal) : null,
    ])
    if (!isCurrentAttempt(state, attempt)) return
    if (conversationId !== useAppStore.getState().activeConversationId) {
      void resyncFromSnapshot()
      return
    }
    const lastQueuedId = attempt.queue.at(-1)?.id
    const snapshotEventId = page?.eventId
    if (conversationId && (typeof snapshotEventId !== 'string'
      || compareStreamEventIds(snapshotEventId, snapshotEventId) === null
      || attempt.queue.some(({ id }) => id && compareStreamEventIds(id, snapshotEventId) === null))) {
      rejectRecoveryAttempt(state, attempt)
      return
    }
    const events = snapshotEventId && conversationId
      ? selectQueuedEventsAfterSnapshot(attempt.queue, snapshotEventId, conversationId)
      : attempt.queue

    const store = useAppStore.getState()
    store.resetForStreamResync()
    store.setConversations(conversations)
    if (conversationId && page && pending) {
      const [writes, bashCommands, questions, plans, skillInstalls] = pending
      store.setMessageHistoryPage(conversationId, page, 'replace')
      store.setPendingWritesForConversation(conversationId, writes)
      store.setPendingBashCommandsForConversation(conversationId, bashCommands)
      store.setPendingQuestionsForConversation(conversationId, questions)
      store.setPendingDispatchPlansForConversation(conversationId, plans)
      store.setPendingSkillInstallsForConversation(conversationId, skillInstalls)
    }
    for (const { event, id } of events) store.applyEvent(event, id || undefined)
    if (snapshotEventId) appliedEventId = snapshotEventId
    if (lastQueuedId && (!snapshotEventId || (compareStreamEventIds(lastQueuedId, snapshotEventId) ?? 0) > 0)) {
      appliedEventId = lastQueuedId
    }
    cancelRecoveryWork(state)
    recovery = null
    signalRecoveryFailure(false)
  } catch {
    rejectRecoveryAttempt(state, attempt)
  }
}

export async function resyncFromSnapshot(): Promise<void> {
  if (recovery) cancelRecoveryWork(recovery)
  const state: Recovery = { attempts: 0, attempt: null, retry: null }
  recovery = state
  signalRecoveryFailure(false)
  await runRecoveryAttempt(state)
}

function connect(): void {
  // 新建的 EventSource 不会带 Last-Event-ID 头，游标改走 query（服务端头优先）
  const url = appliedEventId ? `/api/stream?lastEventId=${encodeURIComponent(appliedEventId)}` : '/api/stream'
  const source = new EventSource(url)
  activeSource = source

  source.onopen = () => {
    if (activeSource !== source) return
    reconnectAttempt = 0
    useAppStore.getState().setStreamConnected(true)
    if (recovery && !recovery.attempt && recovery.retry === null) void resyncFromSnapshot()
  }

  source.onerror = () => {
    if (activeSource !== source) return
    if (recovery) cancelRecoveryWork(recovery)
    useAppStore.getState().setStreamConnected(false)
    // 网络错误浏览器会自动重连；但服务端重启期间返回非 200 时 EventSource 会永久放弃（CLOSED），需要自己重建
    if (source.readyState !== EventSource.CLOSED || reconnectTimer !== null) return
    const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt++)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (activeSource === source) connect()
    }, delay)
  }

  source.onmessage = (e) => {
    if (activeSource !== source) return
    let parsed: unknown
    try {
      parsed = JSON.parse(e.data)
    } catch {
      return
    }
    if (!parsed || typeof parsed !== 'object') return
    const obj = parsed as { type?: string }
    if (obj.type === 'connected') {
      useAppStore.getState().setStreamConnected(true)
      return
    }
    if (obj.type === 'resync') {
      void resyncFromSnapshot()
      return
    }
    if (obj.type === 'heartbeat') return

    if (recovery) {
      const attempt = recovery.attempt
      if (!attempt) return
      const bytes = encoder.encode(e.data).byteLength
      if (attempt.queue.length >= RECOVERY_MAX_EVENTS || attempt.bytes + bytes > RECOVERY_MAX_BYTES) {
        rejectRecoveryAttempt(recovery, attempt)
        return
      }
      attempt.queue.push({ id: e.lastEventId, event: parsed as StreamEvent })
      attempt.bytes += bytes
      return
    }
    useAppStore.getState().applyEvent(parsed as StreamEvent, e.lastEventId || undefined)
    if (e.lastEventId) appliedEventId = e.lastEventId
  }
}

export function StreamProvider({ children }: { children: React.ReactNode }) {
  const failed = useSyncExternalStore(subscribeRecovery, () => recoveryFailed, () => false)
  useEffect(() => {
    refCount++
    if (!activeSource) {
      unsubscribeConversation = useAppStore.subscribe((state, previous) => {
        if (recovery && state.activeConversationId !== previous.activeConversationId) void resyncFromSnapshot()
      })
      connect()
    }

    return () => {
      refCount--
      // 全部组件都卸载时关闭，避免 dev 模式 StrictMode 双 mount 反复断开
      if (refCount <= 0) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = null
        if (recovery) cancelRecoveryWork(recovery)
        recovery = null
        signalRecoveryFailure(false)
        unsubscribeConversation?.()
        unsubscribeConversation = null
        activeSource?.close()
        activeSource = null
        refCount = 0
        useAppStore.getState().setStreamConnected(false)
      }
    }
  }, [])

  return (
    <>
      {children}
      {failed && (
        <div role="alert" className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-md">
          会话同步失败
          <button type="button" className="font-medium underline" onClick={() => void resyncFromSnapshot()}>重试</button>
        </div>
      )}
    </>
  )
}

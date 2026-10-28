'use client'

import { useEffect } from 'react'

import {
  fetchConversations,
  fetchMessagesSnapshot,
  fetchPendingBashCommands,
  fetchPendingDispatchPlans,
  fetchPendingQuestions,
  fetchPendingWrites,
} from '@/lib/api'
import { selectEventsAfterSnapshot, type QueuedStreamEvent } from '@/lib/stream-resync'
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

let activeSource: EventSource | null = null
let refCount = 0
let lastEventId: string | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let resyncQueue: QueuedStreamEvent[] | null = null
let resyncGeneration = 0

async function resyncFromSnapshot(): Promise<void> {
  const generation = ++resyncGeneration
  resyncQueue = []
  const store = useAppStore.getState()
  store.resetForStreamResync()
  const convId = store.activeConversationId

  let snapshotEventId: string | null = null
  try {
    const [conversations, snapshot] = await Promise.all([
      fetchConversations(),
      convId ? fetchMessagesSnapshot(convId) : Promise.resolve(null),
      convId ? refreshPendingFor(convId) : Promise.resolve(),
    ])
    if (generation !== resyncGeneration) return
    const s = useAppStore.getState()
    s.setConversations(conversations)
    if (convId && snapshot) {
      s.setMessagesForConversation(convId, snapshot.messages)
      snapshotEventId = snapshot.eventId
    }
  } catch (err) {
    console.error('[StreamProvider] resync snapshot fetch failed', err)
  }
  if (generation !== resyncGeneration) return

  const queued = resyncQueue ?? []
  resyncQueue = null
  const { applyEvent } = useAppStore.getState()
  const events = snapshotEventId
    ? selectEventsAfterSnapshot(queued, snapshotEventId)
    : queued.map((q) => q.event)
  for (const event of events) applyEvent(event)
}

async function refreshPendingFor(conversationId: string): Promise<void> {
  const [writes, bashCommands, questions, plans] = await Promise.all([
    fetchPendingWrites(conversationId),
    fetchPendingBashCommands(conversationId),
    fetchPendingQuestions(conversationId),
    fetchPendingDispatchPlans(conversationId),
  ])
  const s = useAppStore.getState()
  s.setPendingWritesForConversation(conversationId, writes)
  s.setPendingBashCommandsForConversation(conversationId, bashCommands)
  s.setPendingQuestionsForConversation(conversationId, questions)
  s.setPendingDispatchPlansForConversation(conversationId, plans)
}

function connect(): void {
  // 新建的 EventSource 不会带 Last-Event-ID 头，游标改走 query（服务端头优先）
  const url = lastEventId ? `/api/stream?lastEventId=${encodeURIComponent(lastEventId)}` : '/api/stream'
  const source = new EventSource(url)
  activeSource = source

  source.onopen = () => {
    reconnectAttempt = 0
    useAppStore.getState().setStreamConnected(true)
  }

  source.onerror = () => {
    useAppStore.getState().setStreamConnected(false)
    // 网络错误浏览器会自动重连；但服务端重启期间返回非 200 时 EventSource 会永久放弃（CLOSED），需要自己重建
    if (source.readyState !== EventSource.CLOSED || activeSource !== source) return
    const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt++)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (activeSource === source) connect()
    }, delay)
  }

  source.onmessage = (e) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(e.data)
    } catch {
      return
    }
    if (!parsed || typeof parsed !== 'object') return
    if (e.lastEventId) lastEventId = e.lastEventId

    const obj = parsed as { type?: string }
    if (obj.type === 'connected') {
      useAppStore.getState().setStreamConnected(true)
      return
    }
    if (obj.type === 'resync') {
      void resyncFromSnapshot()
      return
    }

    if (resyncQueue) {
      resyncQueue.push({ id: e.lastEventId, event: parsed as StreamEvent })
      return
    }
    useAppStore.getState().applyEvent(parsed as StreamEvent)
  }
}

export function StreamProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    refCount++
    if (!activeSource) connect()

    return () => {
      refCount--
      // 全部组件都卸载时关闭，避免 dev 模式 StrictMode 双 mount 反复断开
      if (refCount <= 0) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = null
        activeSource?.close()
        activeSource = null
        refCount = 0
        useAppStore.getState().setStreamConnected(false)
      }
    }
  }, [])

  return <>{children}</>
}

'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { MessageItem, type InlineMessageEdit } from '@/components/message-item'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchMessageHistory } from '@/lib/message-history'
import { useAppStore, useMessagesForConversation } from '@/stores/app-store'
import { finishMessageJump, useMessageJumpStore, type MessageJump } from '@/stores/message-jump-store'

const ESTIMATED_ROW_HEIGHT = 96
const OVERSCAN_PX = 480
const CONTINUATION_HEIGHT = 40
const STICKY_BOTTOM_THRESHOLD_PX = 120
const EMPTY_IDS: string[] = []

type HistoryQuery = NonNullable<Parameters<typeof fetchMessageHistory>[1]>
type PageMode = 'replace' | 'older' | 'newer'
type HistoryLoad = { query: HistoryQuery; mode: PageMode; jump?: MessageJump }
type ViewportAnchor = { messageId: string; offset: number }

function rowAt(offsets: readonly number[], top: number): number {
  let low = 0
  let high = Math.max(0, offsets.length - 2)
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (offsets[mid] <= top) low = mid
    else high = mid - 1
  }
  return low
}

function readViewportAnchor(viewport: HTMLElement): ViewportAnchor | null {
  const { top, bottom } = viewport.getBoundingClientRect()
  for (const row of viewport.querySelectorAll<HTMLElement>('[data-virtual-message-id]')) {
    const rect = row.getBoundingClientRect()
    const messageId = row.dataset.virtualMessageId
    if (messageId && rect.bottom > top && rect.top < bottom) return { messageId, offset: rect.top - top }
  }
  return null
}

export function MessageList({ conversationId }: { conversationId: string }) {
  return <ConversationMessages key={conversationId} conversationId={conversationId} />
}

function ConversationMessages({ conversationId }: { conversationId: string }) {
  const messages = useMessagesForConversation(conversationId)
  const ids = useAppStore((s) => s.messageIdsByConv[conversationId]) ?? EMPTY_IDS
  const history = useAppStore((s) => s.messageHistoryByConv[conversationId])
  const setHistoryPage = useAppStore((s) => s.setMessageHistoryPage)
  const requestedJump = useMessageJumpStore((s) =>
    s.target?.conversationId === conversationId ? s.target : null,
  )
  const [activeJump, setActiveJump] = useState<MessageJump | null>(null)
  const [edit, setEdit] = useState<{ messageId: string; value: InlineMessageEdit } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failedLoad, setFailedLoad] = useState<HistoryLoad | null>(null)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map())
  const viewportRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const scrollTopRef = useRef(0)
  const visibleAnchor = useRef<ViewportAnchor | null>(null)
  const stickToBottom = useRef(true)
  const pendingTailScroll = useRef(false)
  const previousLastId = useRef<string | null>(null)
  const previousDetached = useRef(false)
  const positionedJump = useRef<MessageJump | null>(null)

  const detached = Boolean(history?.newerCursor)
  const leadingHeight = history?.olderCursor ? CONTINUATION_HEIGHT : 0
  const layout = useMemo(() => {
    const offsets = [leadingHeight]
    const indices = new Map<string, number>()
    for (const [index, id] of ids.entries()) {
      indices.set(id, index)
      offsets.push(offsets[index] + (heights.get(id) ?? ESTIMATED_ROW_HEIGHT))
    }
    return { ids, indices, offsets }
  }, [ids, heights, leadingHeight])
  const previousLayout = useRef<typeof layout | null>(null)
  const start = rowAt(layout.offsets, viewport.top - OVERSCAN_PX)
  const end = Math.min(ids.length,
    rowAt(layout.offsets, viewport.top + viewport.height + OVERSCAN_PX) + 1)
  const newestId = messages.at(-1)?.id ?? null
  const newestRole = messages.at(-1)?.role ?? null
  const hasHistory = Boolean(history)
  const hasRows = ids.length > 0

  const syncViewport = useCallback((element: HTMLElement) => {
    const top = element.scrollTop
    const height = element.clientHeight
    scrollTopRef.current = top
    setViewport((previous) => Math.abs(previous.top - top) < 1 && previous.height === height
      ? previous : { top, height })
  }, [])

  const updateEdit = useCallback((messageId: string, update: (current: InlineMessageEdit | null) => InlineMessageEdit | null) => {
    setEdit((current) => {
      const same = current?.messageId === messageId
      const next = update(same ? current.value : null)
      return next ? { messageId, value: next } : same ? null : current
    })
  }, [])

  const load = useCallback(async (query: HistoryQuery, mode: PageMode, jump?: MessageJump) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setActiveJump(null)
    setFailedLoad(null)
    const previousEventId = useAppStore.getState().messageHistoryByConv[conversationId]?.eventId
    const fail = () => {
      if (controller.signal.aborted) return
      setFailedLoad({ query, mode, jump })
      if (jump) finishMessageJump(jump)
    }
    try {
      const page = await fetchMessageHistory(conversationId, { ...query, signal: controller.signal })
      if (controller.signal.aborted) return
      const current = useAppStore.getState().messageHistoryByConv[conversationId]
      if (current?.eventId !== previousEventId
        || (mode === 'older' && current?.olderCursor !== query.before)
        || (mode === 'newer' && current?.newerCursor !== query.after)) {
        fail()
        return
      }
      const previousAnchor = visibleAnchor.current
      const wasFollowing = stickToBottom.current
      const viewport = viewportRef.current
      visibleAnchor.current = mode !== 'replace' && viewport ? readViewportAnchor(viewport) : null
      if (visibleAnchor.current) stickToBottom.current = false
      if (!setHistoryPage(conversationId, page, mode)) {
        visibleAnchor.current = previousAnchor
        stickToBottom.current = wasFollowing
        fail()
        return
      }
      if (jump) {
        if (!useAppStore.getState().messageIdsByConv[conversationId]?.includes(jump.messageId)) {
          fail()
          return
        }
        setActiveJump(jump)
      } else if (mode === 'replace') {
        pendingTailScroll.current = true
        stickToBottom.current = true
      }
    } catch {
      fail()
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setBusy(false)
      }
    }
  }, [conversationId, setHistoryPage])

  useEffect(() => () => {
    const current = requestRef.current
    requestRef.current = null
    current?.abort()
  }, [])

  useEffect(() => {
    if (!hasHistory && !requestedJump && !failedLoad && !requestRef.current) void load({}, 'replace')
  }, [hasHistory, requestedJump, failedLoad, load])

  useEffect(() => {
    if (!requestedJump) return
    visibleAnchor.current = null
    pendingTailScroll.current = false
    stickToBottom.current = false
    if (useAppStore.getState().messageIdsByConv[conversationId]?.includes(requestedJump.messageId)) {
      requestRef.current?.abort()
      setFailedLoad(null)
      setActiveJump(requestedJump)
    } else {
      void load({ around: requestedJump.messageId }, 'replace', requestedJump)
    }
  }, [conversationId, load, requestedJump])

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const previous = previousLayout.current
    const previousTop = scrollTopRef.current
    const newUserMessage = !previousDetached.current && newestRole === 'user' && previousLastId.current !== null
      && newestId !== previousLastId.current && layout.indices.has(previousLastId.current)
    previousLayout.current = layout
    previousLastId.current = newestId
    previousDetached.current = detached

    if (activeJump) {
      const index = layout.indices.get(activeJump.messageId)
      if (index !== undefined) {
        positionedJump.current = activeJump
        const height = layout.offsets[index + 1] - layout.offsets[index]
        const offset = Math.max(0, (element.clientHeight - height) / 2)
        visibleAnchor.current = { messageId: activeJump.messageId, offset }
        element.scrollTop = layout.offsets[index] - offset
      }
    } else if (!detached && (pendingTailScroll.current || stickToBottom.current || newUserMessage)) {
      pendingTailScroll.current = false
      stickToBottom.current = true
      visibleAnchor.current = null
      element.scrollTop = element.scrollHeight
    } else if (visibleAnchor.current) {
      const anchor = visibleAnchor.current
      const index = layout.indices.get(anchor.messageId)
      if (index === undefined) {
        visibleAnchor.current = null
      } else {
        element.scrollTop = layout.offsets[index] - anchor.offset
      }
    } else if (previous && previous !== layout && previous.ids.length > 0) {
      const oldIndex = rowAt(previous.offsets, previousTop)
      const newIndex = layout.indices.get(previous.ids[oldIndex])
      if (newIndex !== undefined) {
        element.scrollTop = previousTop + layout.offsets[newIndex] - previous.offsets[oldIndex]
      }
    }
    syncViewport(element)
  }, [activeJump, detached, layout, newestId, newestRole, syncViewport])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !activeJump || positionedJump.current !== activeJump) return
    const node = document.getElementById(`message-${activeJump.messageId}`)
    if (!node || !viewport.contains(node)) return
    useAppStore.getState().highlightMessage(activeJump.messageId)
    finishMessageJump(activeJump)
    setActiveJump(null)
  }, [activeJump, layout, start, end])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const scroll = () => {
      if (Math.abs(element.scrollTop - scrollTopRef.current) > 1) {
        stickToBottom.current = !detached && (element.scrollHeight - element.scrollTop
          - element.clientHeight <= STICKY_BOTTOM_THRESHOLD_PX)
        visibleAnchor.current = stickToBottom.current ? null : readViewportAnchor(element)
      }
      syncViewport(element)
    }
    element.addEventListener('scroll', scroll, { passive: true })
    return () => element.removeEventListener('scroll', scroll)
  }, [detached, hasRows, syncViewport])

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const sizedRows = entries.flatMap(({ target }) => {
        if (!(target instanceof HTMLElement) || !target.dataset.virtualMessageId) return []
        return [{ id: target.dataset.virtualMessageId, height: target.getBoundingClientRect().height }]
      })
      setHeights((previous) => {
        const next = new Map([...previous].filter(([id]) => ids.includes(id)))
        for (const { id, height } of sizedRows) next.set(id, height)
        return previous.size === next.size && [...next].every(([id, value]) => previous.get(id) === value)
          ? previous : next
      })
      if (entries.some(({ target }) => target === element)) syncViewport(element)
    })
    observer.observe(element)
    element.querySelectorAll('[data-virtual-message-id]').forEach((row) => observer.observe(row))
    return () => observer.disconnect()
  }, [end, ids, start, syncViewport])

  if (!hasRows && !history && !failedLoad) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">正在加载消息…</div>
  }

  if (!hasRows && !failedLoad) {
    return <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-muted-foreground">还没有消息，发一条试试。</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {detached && (
        <div className="flex shrink-0 justify-end border-b px-4 py-1">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void load({}, 'replace')}>回到最新</Button>
        </div>
      )}
      {failedLoad && (
        <div className="flex shrink-0 items-center justify-center gap-2 py-1 text-sm text-muted-foreground" role="status">
          暂时无法加载消息。
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
            const { query, mode, jump } = failedLoad
            if (mode === 'older' && history?.olderCursor) void load({ before: history.olderCursor }, 'older')
            else if (mode === 'newer' && history?.newerCursor) void load({ after: history.newerCursor }, 'newer')
            else if (mode === 'replace') void load(query, mode, jump)
            else void load({}, 'replace')
          }}>重试</Button>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
        <div className="px-4" data-testid="message-history-viewport" style={{ overflowAnchor: 'none' }}>
          {history?.olderCursor && (
            <div className="flex h-10 items-center justify-center">
              <Button size="sm" variant="ghost" disabled={busy}
                onClick={() => void load({ before: history.olderCursor! }, 'older')}>加载更早消息</Button>
            </div>
          )}
          <div aria-hidden="true" style={{ height: layout.offsets[start] - leadingHeight }} />
          {messages.slice(start, end).map((message) => (
            <div key={message.id} className="py-2" data-virtual-message-id={message.id}>
              <MessageItem message={message} edit={edit?.messageId === message.id ? edit.value : null} onEditChange={updateEdit} />
            </div>
          ))}
          <div aria-hidden="true" style={{ height: layout.offsets[ids.length] - layout.offsets[end] }} />
          {history?.newerCursor && (
            <div className="flex h-10 items-center justify-center">
              <Button size="sm" variant="ghost" disabled={busy}
                onClick={() => void load({ after: history.newerCursor! }, 'newer')}>加载更新消息</Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

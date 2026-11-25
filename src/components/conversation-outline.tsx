'use client'

import { Filter, ListTree, MessageSquare, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { MessageRow } from '@/db/schema'
import { toggleMessageBookmark } from '@/lib/api'
import { fetchMessageHistory } from '@/lib/message-history'
import { cn } from '@/lib/utils'
import { useAppStore, useMessagesForConversation } from '@/stores/app-store'
import { requestMessageJump } from '@/stores/message-jump-store'

type OutlineEntry = { id: string; createdAt: number; preview: string }
type OutlinePage = {
  items: OutlineEntry[]
  olderCursor: string | null
  newerCursor: string | null
}

export function ConversationOutline({ conversationId }: { conversationId: string }) {
  return <ConversationOutlineWindow key={conversationId} conversationId={conversationId} />
}

function ConversationOutlineWindow({ conversationId }: { conversationId: string }) {
  const messages = useMessagesForConversation(conversationId)
  const conversation = useAppStore((s) => s.conversations[conversationId])
  const history = useAppStore((s) => s.messageHistoryByConv[conversationId])
  const setBookmarkedMessageIds = useAppStore((s) => s.setBookmarkedMessageIds)
  const bookmarkedIds = useMemo(
    () => new Set(conversation?.bookmarkedMessageIds ?? []),
    [conversation?.bookmarkedMessageIds],
  )

  const [onlyStarred, setOnlyStarred] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null)
  const [page, setPage] = useState<OutlinePage | null>(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageFailed, setPageFailed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  const residentItems = useMemo(() => {
    const rows = new Map(outlineItems(messages).map((item) => [item.id, item]))
    for (const id of bookmarkedIds) {
      const message = history?.references[id]
      if (!rows.has(id) && message?.role === 'user') rows.set(id, outlineItem(message))
    }
    return [...rows.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  }, [bookmarkedIds, messages, history?.references])
  const olderCursor = page ? page.olderCursor : history?.olderCursor
  const newerCursor = page ? page.newerCursor : history?.newerCursor
  const userMessages = page?.items ?? residentItems
  const starredItems = [...new Map([...residentItems, ...userMessages]
    .filter((item) => bookmarkedIds.has(item.id)).map((item) => [item.id, item])).values()]
  const filtered = onlyStarred ? starredItems : userMessages
  const starredCount = starredItems.length
  const latestVisibleId = filtered[filtered.length - 1]?.id ?? null
  const activeId = filtered.some((m) => m.id === activeOutlineId) ? activeOutlineId : latestVisibleId

  useEffect(() => {
    if (!open || filtered.length === 0) return

    const frame = window.requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })

    return () => window.cancelAnimationFrame(frame)
  }, [filtered.length, onlyStarred, open, page])

  useEffect(() => () => {
    requestRef.current?.abort()
    requestRef.current = null
  }, [])

  const handleOpen = (next: boolean) => {
    setOpen(next)
    if (!next) {
      requestRef.current?.abort()
      setPage(null)
      setPageFailed(false)
    }
  }

  const load = async (direction: 'before' | 'after', cursor: string) => {
    requestRef.current?.abort()
    const request = new AbortController()
    requestRef.current = request
    setPageLoading(true)
    setPageFailed(false)
    try {
      const result = await fetchMessageHistory(conversationId, { [direction]: cursor, signal: request.signal })
      if (!request.signal.aborted) {
        setPage({ items: outlineItems(result.messages), olderCursor: result.olderCursor, newerCursor: result.newerCursor })
      }
    } catch {
      if (!request.signal.aborted) setPageFailed(true)
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null
        setPageLoading(false)
      }
    }
  }

  if (residentItems.length === 0 && !olderCursor && !newerCursor) return null

  const handleJump = (id: string) => {
    setActiveOutlineId(id)
    requestMessageJump(conversationId, id)
    handleOpen(false)
  }

  const handleToggleStar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (busy === id) return
    setBusy(id)
    try {
      const result = await toggleMessageBookmark(id, conversationId)
      setBookmarkedMessageIds(conversationId, result.bookmarkedMessageIds)
    } catch (err) {
      console.error('[ConversationOutline] toggle bookmark failed', err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            title={`对话目录${starredCount > 0 ? ` · ${starredCount} 收藏` : ''}`}
          />
        }
      >
        <ListTree className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-[calc(100vh-6rem)] w-[min(calc(100vw-2rem),24rem)] gap-0 overflow-hidden p-0 sm:max-h-[70vh]"
        align="end"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <ListTree className="size-3.5" />
            对话目录
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {filtered.length} 条
            </span>
            <button
              type="button"
              onClick={() => setOnlyStarred((v) => !v)}
              disabled={starredCount === 0}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-40',
                onlyStarred
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={onlyStarred ? '显示全部' : `只看收藏 (${starredCount})`}
            >
              <Filter className="size-3" />
              {onlyStarred ? '已过滤' : '只看收藏'}
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="max-h-[calc(100vh-8.5rem)] min-h-0 overflow-y-auto overscroll-contain sm:max-h-[calc(70vh-2.75rem)]"
          >
            <div className="space-y-0.5 p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  {onlyStarred ? '没有收藏的提问' : '这一页没有提问'}
                </div>
              ) : (
                filtered.map((m, index) => (
                  <OutlineItem
                    key={m.id}
                    index={index + 1}
                    message={m}
                    active={activeId === m.id}
                    starred={bookmarkedIds.has(m.id)}
                    busy={busy === m.id}
                    onClick={() => handleJump(m.id)}
                    onToggleStar={(e) => handleToggleStar(m.id, e)}
                  />
                ))
              )}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-popover to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-popover to-transparent" />
        </div>
        {!onlyStarred && (olderCursor || newerCursor || page) && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-t px-2 py-1">
            {olderCursor && <Button size="sm" variant="ghost" disabled={pageLoading}
              onClick={() => void load('before', olderCursor)}>更早提问</Button>}
            {newerCursor && <Button size="sm" variant="ghost" disabled={pageLoading}
              onClick={() => void load('after', newerCursor)}>更新提问</Button>}
            {page && <Button size="sm" variant="ghost" disabled={pageLoading}
              onClick={() => { setPage(null); setPageFailed(false) }}>当前窗口</Button>}
            {pageFailed && <span role="status" className="text-xs text-muted-foreground">目录加载失败。</span>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function outlineItems(messages: MessageRow[]): OutlineEntry[] {
  return messages.filter((message) => message.role === 'user').map(outlineItem)
}

function outlineItem(message: MessageRow): OutlineEntry {
  const first = message.parts.find((part) => part.type === 'text')
  const hasAttachments = message.parts.some((part) => part.type === 'image_attachment' || part.type === 'file_attachment')
  const preview = first?.type === 'text' && first.content
    ? first.content.slice(0, 160) : hasAttachments ? '(附件消息)' : '(空)'
  return { id: message.id, createdAt: message.createdAt, preview }
}

function OutlineItem({
  index,
  message,
  active,
  starred,
  busy,
  onClick,
  onToggleStar,
}: {
  index: number
  message: OutlineEntry
  active: boolean
  starred: boolean
  busy: boolean
  onClick: () => void
  onToggleStar: (e: React.MouseEvent) => void
}) {
  const time = new Date(message.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-accent',
        active && 'bg-primary/10 ring-1 ring-primary/20 hover:bg-primary/10',
        starred &&
          !active &&
          'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/40',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground/70 group-hover:text-foreground/70">
          #{index}
        </span>
        <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 whitespace-pre-wrap break-words leading-snug">
            {message.preview}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{time}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={onToggleStar}
        disabled={busy}
        className={cn(
          'mt-0.5 shrink-0 rounded p-0.5 transition disabled:opacity-50',
          starred
            ? 'text-amber-500'
            : 'text-muted-foreground/30 opacity-0 hover:text-amber-500 group-hover:opacity-100',
        )}
        title={starred ? '取消收藏' : '收藏（仅用于导航定位）'}
      >
        <Star className={cn('size-3.5', starred && 'fill-amber-400')} />
      </button>
    </div>
  )
}

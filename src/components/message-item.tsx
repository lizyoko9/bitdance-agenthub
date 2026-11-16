'use client'

import { AtSign, CornerUpLeft, Loader2, Pencil, Pin, RotateCcw, Star, Trash2 } from 'lucide-react'
import { memo, useState } from 'react'

import { AgentAvatar } from '@/components/agent-avatar'
import { AgentInfoPopover } from '@/components/agent-info-popover'
import { DispatchPlanCard } from '@/components/dispatch-plan-card'
import { EditMessageInput } from '@/components/edit-message-input'
import { PartList } from '@/components/message-parts'
import { QuotedMessage } from '@/components/quoted-message'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { editAndResendMessage, regenerateLastResponse, toggleMessagePin, withdrawMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { MessageRow } from '@/db/schema'
import { PIN_LIMIT_PER_CONVERSATION } from '@/shared/constants'
import { getPromptTokenTotal, getTokenTotal } from '@/shared/token-usage'
import {
  useAppStore,
  useDispatchForMessage,
  useLatestAgentMessageId,
  useLatestUserMessageId,
} from '@/stores/app-store'

function MessageItemImpl({ message }: { message: MessageRow }) {
  const agentsMap = useAppStore((s) => s.agents)
  const agent = message.agentId ? agentsMap[message.agentId] : null
  const dispatch = useDispatchForMessage(message.id)
  const setReplyTarget = useAppStore((s) => s.setReplyTarget)
  const highlightMessage = useAppStore((s) => s.highlightMessage)
  const isHighlighted = useAppStore((s) => s.highlightedMessageId === message.id)
  const isBookmarked = useAppStore((s) =>
    s.conversations[message.conversationId]?.bookmarkedMessageIds?.includes(message.id) ?? false,
  )
  const isPinned = useAppStore((s) =>
    s.conversations[message.conversationId]?.pinnedMessageIds?.includes(message.id) ?? false,
  )
  const pinnedCount = useAppStore(
    (s) => s.conversations[message.conversationId]?.pinnedMessageIds?.length ?? 0,
  )
  const setPinnedMessageIds = useAppStore((s) => s.setPinnedMessageIds)
  const parentMessage = useAppStore((s) =>
    message.parentMessageId ? s.messages[message.parentMessageId] : null,
  )
  const latestUserId = useLatestUserMessageId(message.conversationId)
  const latestAgentId = useLatestAgentMessageId(message.conversationId)
  const removeMessages = useAppStore((s) => s.removeMessages)
  const removeArtifacts = useAppStore((s) => s.removeArtifacts)
  const upsertMessage = useAppStore((s) => s.upsertMessage)

  const isUser = message.role === 'user'
  const name = isUser ? '我' : message.role === 'system' ? '系统' : agent?.name ?? 'Unknown'
  const isLatestUser = isUser && latestUserId === message.id
  const isLatestAgent = !isUser && latestAgentId === message.id

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)

  // 原 message.parts 中的 text 部分（用于 inline edit 的初始值）
  const initialText = isUser
    ? message.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p.type === 'text' ? p.content : ''))
        .join('\n')
    : ''

  const mentionedAgents = message.mentionedAgentIds
    .map((id) => agentsMap[id])
    .filter(Boolean)

  const jumpToParent = () => {
    if (!parentMessage) return
    const el = document.getElementById(`message-${parentMessage.id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    highlightMessage(parentMessage.id)
  }

  const handleWithdraw = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { deletedMessageIds, deletedArtifactIds } = await withdrawMessage(
        message.id,
        message.conversationId,
      )
      removeMessages(message.conversationId, deletedMessageIds)
      if (deletedArtifactIds.length > 0) removeArtifacts(deletedArtifactIds)
      setConfirmWithdraw(false)
    } catch (err) {
      console.error('[MessageItem] withdraw failed', err)
    } finally {
      setBusy(false)
    }
  }

  const handleEditCommit = async (next: string) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await editAndResendMessage(
        message.id,
        message.conversationId,
        next,
      )
      // 先删旧的，再 upsert 新的：避免「最后一条 user」selector 在中间态找不到目标
      removeMessages(message.conversationId, result.deletedMessageIds)
      if (result.deletedArtifactIds.length > 0) removeArtifacts(result.deletedArtifactIds)
      upsertMessage(result.newMessage)
      setEditing(false)
    } catch (err) {
      console.error('[MessageItem] edit failed', err)
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await regenerateLastResponse(message.conversationId)
      removeMessages(message.conversationId, result.deletedMessageIds)
      if (result.deletedArtifactIds.length > 0) removeArtifacts(result.deletedArtifactIds)
      // 新 run 的事件会通过 SSE 流回来，store reducer 会插入新 message
    } catch (err) {
      console.error('[MessageItem] regenerate failed', err)
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePin = async () => {
    // 未 pin 且已达上限 → 按钮 disabled 拦截，这里不会触发；服务端兜底
    if (busy) return
    setBusy(true)
    try {
      const result = await toggleMessagePin(message.id, message.conversationId)
      setPinnedMessageIds(message.conversationId, result.pinnedMessageIds)
    } catch (err) {
      console.error('[MessageItem] toggle pin failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      id={`message-${message.id}`}
      data-role={message.role}
      data-status={message.status}
      className={cn(
        'group flex items-start gap-3 rounded-lg animate-in fade-in slide-in-from-bottom-1',
        isUser && 'flex-row-reverse',
      )}
    >
      {isUser ? (
        <Avatar className="size-8 shrink-0 bg-primary text-primary-foreground">
          <AvatarFallback className="bg-primary text-sm text-primary-foreground">
            我
          </AvatarFallback>
        </Avatar>
      ) : agent ? (
        <AgentInfoPopover
          agent={agent}
          size="md"
          avatarClassName={cn(
            'transition-all',
            message.status === 'streaming' && 'ring-2 ring-primary ring-offset-1',
          )}
        />
      ) : (
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="text-sm">
            {message.role === 'system' ? '系' : '?'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex max-w-[80%] min-w-0 flex-1 flex-col gap-1', isUser && 'items-end')}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{name}</span>
          <span>{formatTime(message.createdAt)}</span>
          {isBookmarked && (
            <span className="text-amber-500" title="已收藏（导航书签）">
              <Star className="size-3 fill-amber-400" />
            </span>
          )}
          {isPinned && (
            <span className="text-primary" title="已 pin（注入 LLM 长期上下文）">
              <Pin className="size-3 fill-primary" />
            </span>
          )}
          {message.status === 'streaming' && (
            <Loader2 className="size-3 animate-spin text-muted-foreground/70" />
          )}
          {/* Agent 消息的 token 用量小标，hover 看拆分 */}
          {!isUser && message.usage && (
            <span
              className="cursor-help font-mono text-[10px] text-muted-foreground/60"
              title={`Input（含缓存）: ${getPromptTokenTotal(message.usage).toLocaleString()}\nOutput: ${message.usage.outputTokens.toLocaleString()}${message.usage.cacheReadTokens > 0 ? `\n其中 Cache 命中: ${message.usage.cacheReadTokens.toLocaleString()}` : ''}`}
            >
              {formatTokenShort(getTokenTotal(message.usage))}{' '}
              tok
            </span>
          )}
        </div>

        <div
          data-selection-target="message"
          data-selection-label={isUser ? '我的消息' : `${name} 的消息`}
          className={cn(
            'min-w-0 rounded-lg border bg-card px-3 py-2',
            isUser && 'bg-primary/5 border-primary/20',
            message.status === 'error' && 'border-red-300 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20',
            message.status === 'aborted' && 'border-zinc-300 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-900/40',
            editing && 'w-full max-w-xl',
            isHighlighted && 'message-glow',
          )}
        >
          {/* 编辑模式：textarea 取代 parts */}
          {editing ? (
            <EditMessageInput
              key={message.id}
              initial={initialText}
              submitting={busy}
              onCommit={(next) => void handleEditCommit(next)}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              {/* 被引用消息预览，点击跳转到原消息 */}
              {parentMessage && (
                <div className="mb-2">
                  <QuotedMessage
                    message={parentMessage}
                    variant="preview"
                    onClick={jumpToParent}
                  />
                </div>
              )}

              {/* @ 提及指示 */}
              {mentionedAgents.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-border/50 pb-2">
                  <AtSign className="size-3 text-muted-foreground" />
                  {mentionedAgents.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-1 pr-1.5 text-[10px] text-primary"
                    >
                      <AgentAvatar agent={a} size="xs" />
                      <span>{a.name}</span>
                    </span>
                  ))}
                </div>
              )}

              <PartList parts={message.parts} conversationId={message.conversationId} />
              {dispatch && (
                <div className="mt-3">
                  <DispatchPlanCard conversationId={message.conversationId} dispatch={dispatch} />
                </div>
              )}
            </>
          )}
        </div>

        {/* 操作工具栏 — 永远渲染占位，仅 hover 时可见。
            放在 bubble 外避免历史/最新消息按钮数量不同导致 meta 行宽度抖动；
            invisible 而非 hidden 是为了不让 hover 时 bubble 下方多出一行高度导致页面流动。 */}
        {!editing && (
          <div
            className={cn(
              'flex gap-2 text-xs text-muted-foreground invisible group-hover:visible',
              isUser && 'justify-end',
            )}
          >
            <button
              type="button"
              onClick={() => setReplyTarget(message.conversationId, message.id)}
              className="transition hover:text-foreground"
              title="引用回复"
            >
              <CornerUpLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleTogglePin()}
              disabled={busy || (!isPinned && pinnedCount >= PIN_LIMIT_PER_CONVERSATION)}
              className={cn(
                'transition disabled:opacity-30',
                isPinned ? 'text-primary hover:text-primary/80' : 'hover:text-foreground',
              )}
              title={
                isPinned
                  ? '取消 pin（不再注入 LLM 上下文）'
                  : pinnedCount >= PIN_LIMIT_PER_CONVERSATION
                    ? `已达 ${PIN_LIMIT_PER_CONVERSATION} 条上限，请先取消其它 pin`
                    : 'Pin 此消息（注入 LLM 长期上下文）'
              }
            >
              <Pin className={cn('size-3.5', isPinned && 'fill-primary')} />
            </button>
            {isLatestUser && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                  className="transition hover:text-foreground disabled:opacity-30"
                  title="编辑文字并重发（@ 和附件保持不变）"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmWithdraw(true)}
                  disabled={busy}
                  className="transition hover:text-red-600 disabled:opacity-30"
                  title="撤回此消息及之后的回复"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
            {isLatestAgent && message.status !== 'streaming' && (
              <button
                type="button"
                onClick={() => void handleRegenerate()}
                disabled={busy}
                className="transition hover:text-foreground disabled:opacity-30"
                title="重新生成（删除当前回答，重新让 agent 回答最后一条提问）"
              >
                <RotateCcw className={cn('size-3.5', busy && 'animate-spin')} />
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={confirmWithdraw}
        onOpenChange={(open) => !busy && setConfirmWithdraw(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤回这条消息？</DialogTitle>
            <DialogDescription>
              你发送的这条消息以及其后所有 Agent 的回复和产物会被一并删除，无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmWithdraw(false)} disabled={busy}>
              取消
            </Button>
            <Button
              variant="default"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleWithdraw()}
              disabled={busy}
            >
              {busy ? '撤回中…' : '撤回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const MessageItem = memo(MessageItemImpl)
MessageItem.displayName = 'MessageItem'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatTokenShort(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

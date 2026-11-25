'use client'

import { ChevronDown, ChevronUp, Pin, X } from 'lucide-react'
import { useState } from 'react'

import { AgentAvatar } from '@/components/agent-avatar'
import { extractMessageSummary } from '@/components/quoted-message'
import type { MessageRow } from '@/db/schema'
import { toggleMessagePin } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { requestMessageJump } from '@/stores/message-jump-store'
import { useShallow } from 'zustand/react/shallow'

/**
 * 「已 pin 消息」横幅。挂在 ChatPanel 的 chat tab 视图顶部，MessageList 之上。
 *
 * - 0 条：不渲染
 * - 1 条：直接展示单行预览
 * - >1 条：默认折叠为「📌 N 条已 pin 消息 ▼」单行汇总，点击展开
 *
 * pin 状态由 conversation.pinnedMessageIds 驱动，影响 LLM 长期上下文
 * （agent-runner 在拼 system prompt 时会注入 <pinned_messages> 块）。
 */
export function PinnedMessagesBar({ conversationId }: { conversationId: string }) {
  const pinned = useAppStore(useShallow((s) =>
    (s.conversations[conversationId]?.pinnedMessageIds ?? [])
      .map((id) => s.messages[id] ?? s.messageHistoryByConv[conversationId]?.references[id])
      .filter(Boolean),
  ))
  const [expanded, setExpanded] = useState(false)

  if (pinned.length === 0) return null

  if (pinned.length === 1) {
    return (
      <div className="shrink-0 border-b border-primary/20 bg-primary/5 px-3 py-1.5">
        <PinnedRow conversationId={conversationId} message={pinned[0]!} />
      </div>
    )
  }

  return (
    <div className="shrink-0 border-b border-primary/20 bg-primary/5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-primary transition hover:bg-primary/10"
      >
        <Pin className="size-3 fill-primary" />
        <span className="font-medium">{pinned.length} 条已 pin 消息</span>
        <span className="text-muted-foreground/70">（注入 agent 长期上下文）</span>
        <span className="ml-auto">
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-0 border-t border-primary/10 px-3 py-1">
          {pinned.map((m) => (
            <PinnedRow key={m.id} conversationId={conversationId} message={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function PinnedRow({
  conversationId,
  message,
}: {
  conversationId: string
  message: MessageRow
}) {
  const agentsMap = useAppStore((s) => s.agents)
  const setPinnedMessageIds = useAppStore((s) => s.setPinnedMessageIds)
  const [busy, setBusy] = useState(false)

  const agent = message.agentId ? agentsMap[message.agentId] : null
  const speakerName = message.role === 'user' ? '用户' : agent?.name ?? 'Unknown'
  const summary = extractMessageSummary(message.parts)

  const handleUnpin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const result = await toggleMessagePin(message.id, conversationId)
      setPinnedMessageIds(conversationId, result.pinnedMessageIds)
    } catch (err) {
      console.error('[PinnedMessagesBar] unpin failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded px-1 py-1 text-xs transition hover:bg-primary/10',
        'cursor-pointer',
      )}
      onClick={() => requestMessageJump(conversationId, message.id)}
    >
      <Pin className="size-3 shrink-0 fill-primary text-primary" />
      {agent ? (
        <AgentAvatar agent={agent} size="xs" />
      ) : (
        <div className="size-4 shrink-0 rounded-full bg-primary/30" />
      )}
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{speakerName}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground/90">{summary}</span>
      <button
        type="button"
        onClick={handleUnpin}
        disabled={busy}
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
        title="取消 pin"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

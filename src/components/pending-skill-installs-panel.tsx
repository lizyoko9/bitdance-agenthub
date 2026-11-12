'use client'

import { Check, Loader2, PackagePlus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { AgentAvatar } from '@/components/agent-avatar'
import { Button } from '@/components/ui/button'
import {
  approvePendingSkillInstall as approveApi,
  fetchPendingSkillInstalls,
  rejectPendingSkillInstall as rejectApi,
} from '@/lib/api'
import { useAppStore, usePendingSkillInstalls } from '@/stores/app-store'
import type { PendingSkillInstall } from '@/shared/types'

/**
 * PendingSkillInstallsPanel —— 对话区底部待审批的 install_skill 会话安装列表。
 * 展示来源 URL + 解析出的 name/description/正文预览，让用户决定是否装入并绑定到该 Agent。
 */
export function PendingSkillInstallsPanel({ conversationId }: { conversationId: string }) {
  const pending = usePendingSkillInstalls(conversationId)
  const setList = useAppStore((s) => s.setPendingSkillInstallsForConversation)

  useEffect(() => {
    let cancelled = false
    fetchPendingSkillInstalls(conversationId)
      .then((list) => {
        if (!cancelled) setList(conversationId, list)
      })
      .catch((err) => console.warn('[PendingSkillInstallsPanel] fetch failed', err))
    return () => {
      cancelled = true
    }
  }, [conversationId, setList])

  if (pending.length === 0) return null

  return (
    <div className="shrink-0 space-y-2 border-t bg-blue-50/40 px-4 py-2.5 dark:bg-blue-950/10">
      {pending.map((p) => (
        <PendingSkillInstallCard key={p.id} conversationId={conversationId} pending={p} />
      ))}
    </div>
  )
}

function PendingSkillInstallCard({
  conversationId,
  pending,
}: {
  conversationId: string
  pending: PendingSkillInstall
}) {
  const agent = useAppStore((s) => s.agents[pending.agentId])
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handle = useCallback(
    async (action: 'approve' | 'reject') => {
      setBusy(action)
      setError(null)
      try {
        if (action === 'approve') await approveApi(conversationId, pending.id)
        else await rejectApi(conversationId, pending.id)
        // 成功后 SSE 移除该卡，组件卸载，无需 reset busy
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setBusy(null)
      }
    },
    [conversationId, pending.id],
  )

  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 text-xs shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-center gap-2">
          {agent ? <AgentAvatar agent={agent} size="sm" /> : <div className="size-6 rounded-md bg-muted" />}
          <PackagePlus className="size-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="shrink-0 font-medium">{agent?.name ?? 'Agent'}</span>
            <span className="shrink-0 text-muted-foreground">想安装 Skill</span>
            <span className="truncate font-medium text-foreground">「{pending.name}」</span>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {pending.description}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <a
              href={pending.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="max-w-[260px] truncate text-blue-600 hover:underline"
              title={pending.sourceUrl}
            >
              {pending.sourceUrl}
            </a>
            <button type="button" onClick={() => setExpanded((v) => !v)} className="shrink-0 hover:text-foreground">
              {expanded ? '收起正文' : '查看正文'}
            </button>
            {error && <span className="text-destructive">· {error}</span>}
          </div>
          {expanded && (
            <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[10px] leading-4 text-muted-foreground">
              {pending.instruction}
            </pre>
          )}
          <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
            这是来自外部链接的内容，安装后会注入该 Agent 的上下文（不授予任何工具权限）。
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 self-start">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handle('reject')}
            disabled={!!busy}
            className="h-7 px-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
          >
            {busy === 'reject' ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            拒绝
          </Button>
          <Button
            size="sm"
            onClick={() => void handle('approve')}
            disabled={!!busy}
            className="h-7 bg-[#3370FF] px-2.5 text-white hover:bg-[#2860e5]"
          >
            {busy === 'approve' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            安装
          </Button>
        </div>
      </div>
    </div>
  )
}

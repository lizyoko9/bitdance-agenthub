'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { AgentAvatar } from '@/components/agent-avatar'
import { CreateAgentDialog } from '@/components/create-agent-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AgentRow } from '@/db/schema'
import { deleteAgent as deleteAgentAPI } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAgentList, useAppStore } from '@/stores/app-store'

/**
 * AgentLibrary — 「Agents」tab 的内容。列出内置 + 自建 Agent，
 * 顶部入口创建新的，自建项 hover 显示编辑 / 删除。
 */
export function AgentLibrary() {
  const router = useRouter()
  const agents = useAgentList()
  const removeAgent = useAppStore((s) => s.removeAgent)

  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deleteTarget = deleteTargetId ? agents.find((a) => a.id === deleteTargetId) : null

  const openCreate = () => {
    router.push('/agents/new')
  }
  const openEdit = (agent: AgentRow) => {
    setEditingAgent(agent)
    setFormOpen(true)
  }
  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingAgent(null)
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      await deleteAgentAPI(deleteTargetId)
      removeAgent(deleteTargetId)
      setDeleteTargetId(null)
    } catch (err) {
      console.error('[AgentLibrary] delete failed', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pt-3">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          onClick={openCreate}
        >
          <Plus className="size-4" />
          创建 Agent
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {agents.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              没有 Agent
            </div>
          ) : (
            agents.map((a) => (
              <div
                key={a.id}
                className="group flex items-start gap-2 rounded-md border bg-card px-2 py-2 transition hover:border-foreground/20"
              >
                <AgentAvatar agent={a} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{a.name}</span>
                    {a.isBuiltin && (
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                        内置
                      </span>
                    )}
                    {a.isOrchestrator && (
                      <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 font-mono text-[9px] text-primary">
                        Orchestrator
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                    {a.description}
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                    {a.adapterName}
                    {a.modelId ? ` · ${a.modelId}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 self-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(a)
                    }}
                    title="编辑 Agent"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  {!a.isBuiltin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTargetId(a.id)
                      }}
                      title="删除 Agent"
                      className={cn('text-muted-foreground transition hover:text-red-600')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <CreateAgentDialog
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        agent={editingAgent ?? undefined}
      />

      <Dialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 Agent</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.name}」吗？已使用该 Agent 的会话将无法继续使用它。该操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              取消
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

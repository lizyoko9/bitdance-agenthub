'use client'

import { Download, Globe, Pencil, Plus, Power, Store, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { SkillFormDialog } from '@/components/skill-form-dialog'
import { SkillImportDialog } from '@/components/skill-import-dialog'
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
import type { SkillRow } from '@/db/schema'
import { deleteSkill as deleteSkillAPI, fetchSkills, updateSkill } from '@/lib/api'
import { cn } from '@/lib/utils'
import { estimateTokens } from '@/shared/model-registry'

const SOURCE_BADGE: Record<SkillRow['source'], { label: string; className: string }> = {
  builtin: { label: '内置', className: 'bg-muted text-muted-foreground' },
  user: { label: '自建', className: 'bg-primary/10 text-primary' },
  imported: { label: '导入', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-300' },
}

/**
 * SkillLibrary — 「Skills」tab 内容。列内置 + 自建/导入 Skill；
 * 内置只可启停，自建/导入可编辑/删除。Skill 是方法论模块，不授予工具权限。
 */
export function SkillLibrary() {
  const router = useRouter()
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<SkillRow | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = async () => {
    try {
      setSkills(await fetchSkills({ all: true }))
    } catch (err) {
      console.error('[SkillLibrary] load failed', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const deleteTarget = deleteTargetId ? skills.find((s) => s.id === deleteTargetId) : null

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (skill: SkillRow) => {
    setEditing(skill)
    setFormOpen(true)
  }

  const toggleEnabled = async (skill: SkillRow) => {
    // 乐观更新 + 失败回滚刷新。
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s)),
    )
    try {
      await updateSkill(skill.id, { enabled: !skill.enabled })
    } catch (err) {
      console.error('[SkillLibrary] toggle failed', err)
      void refresh()
    }
  }

  const togglePublic = async (skill: SkillRow) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, isGlobalDefault: !s.isGlobalDefault } : s)),
    )
    try {
      await updateSkill(skill.id, { isGlobalDefault: !skill.isGlobalDefault })
    } catch (err) {
      console.error('[SkillLibrary] toggle public failed', err)
      void refresh()
    }
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      await deleteSkillAPI(deleteTargetId)
      setSkills((prev) => prev.filter((s) => s.id !== deleteTargetId))
      setDeleteTargetId(null)
    } catch (err) {
      console.error('[SkillLibrary] delete failed', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-1.5 px-3 pt-3">
        <Button className="w-full justify-start gap-2" onClick={() => router.push('/skills')}>
          <Store className="size-4" />
          打开 Skills 市场
        </Button>
        <Button className="w-full justify-start gap-2" variant="outline" onClick={openCreate}>
          <Plus className="size-4" />
          新建 Skill
        </Button>
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          onClick={() => setImportOpen(true)}
        >
          <Download className="size-4" />
          导入 Skill
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {loading ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">加载中…</div>
          ) : skills.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">还没有 Skill</div>
          ) : (
            skills.map((s) => {
              const badge = SOURCE_BADGE[s.source]
              return (
                <div
                  key={s.id}
                  className={cn(
                    'group flex items-start gap-2 rounded-md border bg-card px-2 py-2 transition hover:border-foreground/20',
                    !s.enabled && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{s.name}</span>
                      <span
                        className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-medium', badge.className)}
                      >
                        {badge.label}
                      </span>
                      {!s.enabled && (
                        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                          已停用
                        </span>
                      )}
                      {s.isGlobalDefault && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-500/12 px-1 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
                          <Globe className="size-2.5" />
                          公共
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {s.description}
                    </div>
                    <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                      {s.category} · ~{estimateTokens(s.instruction)} tokens
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 self-center">
                    <button
                      type="button"
                      onClick={() => void togglePublic(s)}
                      title={s.isGlobalDefault ? '取消公共' : '设为公共（挂给所有 Agent）'}
                      className={cn(
                        'text-muted-foreground transition hover:text-foreground',
                        s.isGlobalDefault && 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      <Globe className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleEnabled(s)}
                      title={s.enabled ? '停用' : '启用'}
                      className={cn(
                        'text-muted-foreground transition hover:text-foreground',
                        s.enabled && 'text-primary',
                      )}
                    >
                      <Power className="size-3.5" />
                    </button>
                    {!s.isBuiltin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          title="编辑 Skill"
                          className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(s.id)}
                          title="删除 Skill"
                          className="text-muted-foreground opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      <SkillFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        skill={editing ?? undefined}
        onSaved={() => void refresh()}
      />

      <SkillImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void refresh()}
      />

      <Dialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 Skill</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.name}」吗？已选用该 Skill 的 Agent 会在下次运行时自动跳过它。该操作不可恢复。
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

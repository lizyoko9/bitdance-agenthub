'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { SkillRow } from '@/db/schema'
import { createSkill, updateSkill } from '@/lib/api'
import { cn } from '@/lib/utils'
import { AGENT_TOOL_META, AVAILABLE_AGENT_TOOLS } from '@/shared/agent-builder-config'
import { estimateTokens } from '@/shared/model-registry'
import { SKILL_INSTRUCTION_MAX } from '@/shared/skill-validation'

/**
 * 创建 / 编辑 Skill 的对话框。传入 `skill` 进入编辑模式，否则为创建。
 * 不处理内置 Skill（库内对内置只给启停，不开此弹窗）。
 */
export function SkillFormDialog({
  open,
  onOpenChange,
  skill,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill?: SkillRow
  onSaved?: (skill: SkillRow) => void
}) {
  const isEdit = !!skill

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [instruction, setInstruction] = useState('')
  const [requiredToolNames, setRequiredToolNames] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(skill?.name ?? '')
    setDescription(skill?.description ?? '')
    setCategory(skill?.category ?? 'general')
    setInstruction(skill?.instruction ?? '')
    setRequiredToolNames(new Set(skill?.requiredToolNames ?? []))
    setError(null)
  }, [open, skill])

  const toggleTool = (tool: string) => {
    setRequiredToolNames((prev) => {
      const next = new Set(prev)
      if (next.has(tool)) next.delete(tool)
      else next.add(tool)
      return next
    })
  }

  const submit = async () => {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        instruction: instruction.trim(),
        requiredToolNames: Array.from(requiredToolNames),
      }
      const saved =
        isEdit && skill ? await updateSkill(skill.id, body) : await createSkill(body)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const tokenEstimate = estimateTokens(instruction)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑 Skill' : '新建 Skill'}</DialogTitle>
          <DialogDescription>
            Skill 是注入到 system prompt 的工作方法，**不授予额外工具权限**。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-[80px_1fr] items-start gap-3">
            <Label required>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：实现计划" />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start gap-3">
            <Label required>描述</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="一句话讲清这套方法解决什么"
            />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start gap-3">
            <Label required>分类</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="coding / review / writing ..."
            />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start gap-3">
            <Label required>指令正文</Label>
            <div>
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="描述这套工作方法 / 工作流，运行时会注入给 Agent…"
                className="min-h-[180px] font-mono text-xs leading-5"
              />
              <div
                className={cn(
                  'mt-1 text-[10px] text-muted-foreground',
                  tokenEstimate > 350 && 'text-amber-600 dark:text-amber-400',
                )}
              >
                约 {tokenEstimate} tokens
                {tokenEstimate > 350 && ' · 偏长，运行时可能不内联（后续渐进披露按需加载）'}
                {instruction.length > SKILL_INSTRUCTION_MAX && ' · 超出长度上限'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start gap-3">
            <Label>建议工具</Label>
            <div>
              <div className="grid grid-cols-2 gap-1.5">
                {AVAILABLE_AGENT_TOOLS.map((tool) => (
                  <label
                    key={tool}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition hover:border-foreground/30',
                      requiredToolNames.has(tool) && 'border-primary bg-primary/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={requiredToolNames.has(tool)}
                      onChange={() => toggleTool(tool)}
                      className="accent-primary"
                    />
                    {AGENT_TOOL_META[tool].label}
                  </label>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                仅作依赖提示；勾选不会给 Agent 授予这些工具。
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="pt-2 text-xs text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </div>
  )
}

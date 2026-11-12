'use client'

import { Loader2, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'

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
import { importSkills } from '@/lib/api'
import { cn } from '@/lib/utils'
import { estimateTokens } from '@/shared/model-registry'
import {
  parseSkillsJson,
  skillMarkdownToDraft,
  type ImportedSkillDraft,
} from '@/shared/skill-import'

type ImportMode = 'md' | 'json'

/**
 * 导入 Skill 弹窗：粘贴/上传 SKILL.md·文本 或 AgentHub JSON（批量）→ 预览编辑 → 导入。
 * 只取 name/description/category/instruction；frontmatter 的 allowed-tools 等被丢弃（不扩权）。
 */
export function SkillImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}) {
  const [mode, setMode] = useState<ImportMode>('md')
  const [raw, setRaw] = useState('')
  const [drafts, setDrafts] = useState<ImportedSkillDraft[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const reset = () => {
    setMode('md')
    setRaw('')
    setDrafts(null)
    setParseError(null)
    setResultMsg(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setRaw(text)
    setMode(file.name.endsWith('.json') ? 'json' : 'md')
  }

  const parse = () => {
    setParseError(null)
    setResultMsg(null)
    try {
      const parsed = mode === 'json' ? parseSkillsJson(raw) : [skillMarkdownToDraft(raw)]
      setDrafts(parsed)
    } catch (err) {
      setDrafts(null)
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  const updateDraft = (index: number, patch: Partial<ImportedSkillDraft>) => {
    setDrafts((prev) =>
      prev ? prev.map((d, i) => (i === index ? { ...d, ...patch } : d)) : prev,
    )
  }
  const removeDraft = (index: number) => {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev))
  }

  const isDraftValid = (d: ImportedSkillDraft) =>
    d.name.trim() && d.description.trim() && d.category.trim() && d.instruction.trim()
  const allValid = !!drafts && drafts.length > 0 && drafts.every(isDraftValid)

  const doImport = async () => {
    if (!drafts || importing || !allValid) return
    setImporting(true)
    setResultMsg(null)
    try {
      const result = await importSkills(
        drafts.map((d) => ({
          name: d.name.trim(),
          description: d.description.trim(),
          category: d.category.trim(),
          instruction: d.instruction.trim(),
          requiredToolNames: d.requiredToolNames,
        })),
      )
      onImported?.()
      if (result.failed.length === 0) {
        handleOpenChange(false)
      } else {
        setResultMsg(`成功导入 ${result.created.length} 个，失败 ${result.failed.length} 个：${result.failed.map((f) => f.error).join('；')}`)
        // 移除已成功的（保留失败的让用户改）
        setDrafts((prev) => (prev ? prev.filter((_, i) => result.failed.some((f) => f.index === i)) : prev))
      }
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="grid max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入 Skill</DialogTitle>
          <DialogDescription>
            支持 Claude SKILL.md / 纯文本 / AgentHub JSON（批量）。导入只取方法论文本，**不会授予任何工具权限**。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {!drafts ? (
            <>
              <div className="flex items-center gap-2">
                <ModeChip label="SKILL.md / 文本" active={mode === 'md'} onClick={() => setMode('md')} />
                <ModeChip label="AgentHub JSON" active={mode === 'json'} onClick={() => setMode('json')} />
                <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/30">
                  <Upload className="size-3.5" />
                  上传文件
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,.json"
                    className="hidden"
                    onChange={(e) => void onFile(e.target.files?.[0])}
                  />
                </label>
              </div>
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={
                  mode === 'json'
                    ? '粘贴 AgentHub 导出的 JSON（单个对象或数组）'
                    : '粘贴 SKILL.md（含 --- frontmatter ---）或纯文本方法论'
                }
                className="min-h-[220px] font-mono text-xs leading-5"
              />
              {parseError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  {parseError}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                解析到 {drafts.length} 个 skill，确认/补全名称与分类后导入：
              </div>
              {drafts.map((d, i) => (
                <div key={i} className="rounded-md border bg-card p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <LabeledInput
                      label="名称"
                      value={d.name}
                      onChange={(v) => updateDraft(i, { name: v })}
                      invalid={!d.name.trim()}
                    />
                    <LabeledInput
                      label="分类"
                      value={d.category}
                      onChange={(v) => updateDraft(i, { category: v })}
                      invalid={!d.category.trim()}
                    />
                  </div>
                  <LabeledInput
                    label="描述"
                    value={d.description}
                    onChange={(v) => updateDraft(i, { description: v })}
                    invalid={!d.description.trim()}
                    className="mt-2"
                  />
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>正文 ~{estimateTokens(d.instruction)} tokens{!d.instruction.trim() && ' · 正文为空'}</span>
                    <button
                      type="button"
                      onClick={() => removeDraft(i)}
                      className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-red-600"
                    >
                      <Trash2 className="size-3" />
                      移除
                    </button>
                  </div>
                </div>
              ))}
              {resultMsg && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  {resultMsg}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {drafts ? (
            <>
              <Button variant="outline" onClick={() => setDrafts(null)} disabled={importing}>
                返回
              </Button>
              <Button onClick={() => void doImport()} disabled={!allValid || importing}>
                {importing ? <Loader2 className="size-4 animate-spin" /> : null}
                导入 {drafts.length} 个
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                取消
              </Button>
              <Button onClick={parse} disabled={!raw.trim()}>
                解析预览
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition',
        active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  invalid,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  className?: string
}) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-8 text-xs', invalid && 'border-red-400')}
      />
    </label>
  )
}

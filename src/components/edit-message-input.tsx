'use client'

import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EditMessageInput({
  draft,
  submitting,
  onChange,
  onCommit,
  onCancel,
}: {
  draft: string
  submitting: boolean
  onChange: (draft: string) => void
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    // 把光标放到末尾
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed || submitting) return
    onCommit(trimmed)
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        disabled={submitting}
        className={cn(
          'w-full resize-y rounded-md border border-primary/40 bg-background px-2 py-1.5 text-sm outline-none ring-2 ring-primary/30',
          'min-h-[60px]',
        )}
      />
      <div className="flex items-center justify-end gap-2 text-xs">
        <span className="mr-auto text-muted-foreground">Enter 保存并重发 · Shift+Enter 换行 · Esc 取消</span>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button size="sm" onClick={commit} disabled={submitting || !draft.trim()}>
          {submitting ? '提交中…' : '保存并重发'}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import CodeMirror from '@uiw/react-codemirror'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

import type { ArtifactType } from '@/shared/types'

/**
 * 产物面板内的代码编辑器（CodeMirror 6）。仅在用户点「编辑」时经 next/dynamic 懒加载。
 * 离线、无 worker，契合本地 only + Turbopack。
 */

function pickLanguage(filename: string | undefined, type: ArtifactType) {
  const name = (filename ?? '').toLowerCase()
  if (name.endsWith('.css')) return [css()]
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return [javascript({ typescript: true, jsx: name.endsWith('.tsx') })]
  if (name.endsWith('.js') || name.endsWith('.mjs') || name.endsWith('.jsx')) return [javascript({ jsx: name.endsWith('.jsx') })]
  if (name.endsWith('.html') || name.endsWith('.htm')) return [html()]
  if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.mmd') || type === 'document') return [markdown()]
  if (type === 'web_app') return [html()]
  return []
}

export default function ArtifactCodeEditor({
  value,
  onChange,
  filename,
  type,
  readOnly = false,
}: {
  value: string
  onChange: (next: string) => void
  filename?: string
  type: ArtifactType
  readOnly?: boolean
}) {
  const { resolvedTheme } = useTheme()
  const extensions = useMemo(() => pickLanguage(filename, type), [filename, type])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      readOnly={readOnly}
      height="100%"
      style={{ height: '100%', fontSize: 13 }}
      className="size-full"
    />
  )
}

'use client'

import { Check, ChevronDown, ChevronRight, Copy, Download, ExternalLink, FileText, FolderGit2, Image as ImageIcon, Layers, Loader2, Package, Presentation, Rocket, Sparkles, Terminal, XCircle } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { AttachmentChip } from '@/components/attachment-chip'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/code-block'
import { Markdown } from '@/components/markdown'
import { artifactPreviewPath } from '@/lib/artifact-preview'
import { deployConversationArtifact, fetchArtifact } from '@/lib/api'
import { getToolDisplayName, isBashToolName } from '@/lib/tool-display'
import { cn } from '@/lib/utils'
import type { MessagePart } from '@/shared/types'
import { useAppStore } from '@/stores/app-store'

// ─── PartList: 调度入口 ─────────────────────────────────
export function PartList({
  parts,
  conversationId,
}: {
  parts: MessagePart[]
  conversationId: string
}) {
  // 把 tool_result 按 callId 提前到对应 tool_use 的状态里
  const resultByCallId = new Map<string, { result: unknown; isError: boolean }>()
  for (const p of parts) {
    if (p.type === 'tool_result') {
      resultByCallId.set(p.callId, { result: p.result, isError: p.isError })
    }
  }

  // 把 parts 重新折叠：连续的 tool_use 合并为一个 cluster；tool_result 跳过（已合到 tool_use）
  type ClusterItem =
    | { kind: 'part'; part: MessagePart; index: number }
    | { kind: 'cluster'; tools: Array<{ part: Extract<MessagePart, { type: 'tool_use' }>; index: number }> }
  const clusters: ClusterItem[] = []
  let currentCluster: Extract<ClusterItem, { kind: 'cluster' }> | null = null
  parts.forEach((p, i) => {
    if (p.type === 'tool_result') return // 已合并到 tool_use 内
    if (p.type === 'tool_use') {
      if (!currentCluster) {
        currentCluster = { kind: 'cluster', tools: [] }
        clusters.push(currentCluster)
      }
      currentCluster.tools.push({ part: p, index: i })
    } else {
      currentCluster = null
      clusters.push({ kind: 'part', part: p, index: i })
    }
  })

  return (
    <div className="space-y-2">
      {clusters.map((c, i) => {
        if (c.kind === 'part') {
          return <PartRenderer key={`p-${c.index}`} part={c.part} conversationId={conversationId} />
        }
        // tool cluster
        if (c.tools.length === 1) {
          // 单个工具：保持原样不折叠
          const t = c.tools[0]
          return (
            <ToolUsePart
              key={`tool-${t.index}`}
              toolName={t.part.toolName}
              args={t.part.args}
              callId={t.part.callId}
              completion={resultByCallId.get(t.part.callId)}
            />
          )
        }
        return (
          <ToolCluster
            key={`cluster-${i}`}
            tools={c.tools}
            resultByCallId={resultByCallId}
          />
        )
      })}
    </div>
  )
}

function PartRenderer({
  part,
  conversationId,
}: {
  part: MessagePart
  conversationId: string
}) {
  switch (part.type) {
    case 'text':
      return <TextPart content={part.content} />
    case 'thinking':
      return <ThinkingPart content={part.content} />
    case 'code':
      return <CodePart language={part.language} content={part.content} />
    case 'artifact_ref':
      return <ArtifactRefPart artifactId={part.artifactId} />
    case 'deploy_status':
      return <DeployStatusPart deployment={part.deployment} />
    case 'deploy_candidates':
      return <DeployCandidatesPart conversationId={conversationId} candidates={part.candidates} />
    case 'delivery_acceptance':
      return <DeliveryAcceptancePart acceptance={part.acceptance} />
    case 'image_attachment':
    case 'file_attachment':
      return (
        <AttachmentChip
          context="message"
          attachment={{
            id: part.attachmentId,
            fileName: part.fileName,
            size: part.size,
            mimeType: part.mimeType,
            kind: part.type === 'image_attachment' ? 'image' : 'file',
          }}
        />
      )
    default:
      return null
  }
}

const DELIVERY_ACCEPTANCE_LABELS = {
  pending: '等待交付验收',
  pass: '交付验收通过',
  fail: '交付未通过',
  unverified: '交付未验证',
  not_run: '未执行交付验收',
}

function DeliveryAcceptancePart({ acceptance }: {
  acceptance: Extract<MessagePart, { type: 'delivery_acceptance' }>['acceptance']
}) {
  const label = DELIVERY_ACCEPTANCE_LABELS[acceptance.status]
  const issues = (acceptance.checks ?? []).filter((check) => check.status !== 'pass')

  return (
    <section
      aria-label={label}
      className={cn(
        'space-y-2 text-sm',
        acceptance.status === 'fail' && 'border-l-2 border-destructive/65 pl-2.5',
        acceptance.status === 'pass' && 'border-l-2 border-emerald-500/65 pl-2.5',
      )}
    >
      <p className={cn('font-medium', acceptance.status === 'fail' && 'text-destructive')}>{label}</p>
      {acceptance.reason && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{acceptance.reason}</p>}
      {issues.length > 0 && (
        <ul className="space-y-2">
          {issues.map((check, index) => (
            <li key={`${check.ruleId}/${index}`} className="space-y-1 rounded-md border px-2 py-1.5 text-xs">
              <p className="break-words">{check.status === 'fail' ? '失败' : '未验证'} · {check.ruleId}</p>
              {check.location && <code className="block break-all">{check.location}</code>}
              {check.reason && <p className="whitespace-pre-wrap break-words text-muted-foreground">{check.reason}</p>}
              {check.expected && <p className="break-words">预期：{check.expected}</p>}
              {check.observed && <p className="break-words">实际：{check.observed}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="break-all text-xs text-muted-foreground">
        {acceptance.receiptId ? <>回执 <code>{acceptance.receiptId}</code></> : <>规则版本 <code>{acceptance.revisionId}</code></>}
      </p>
    </section>
  )
}

// ─── Text ──────────────────────────────────────────────
function TextPart({ content }: { content: string }) {
  if (!content) return null
  // 把消息体里 <quoted_selection ...>...</quoted_selection> 块抠出来，渲染成卡片；
  // 剩余文本走 Markdown。规避了纯文本里裸 XML 显丑的问题。
  const segments = splitQuotedSelections(content)
  return (
    <div className="space-y-2">
      {segments.map((seg, i) =>
        seg.kind === 'quote' ? (
          <QuotedSelectionCard key={i} {...seg} />
        ) : (
          <Markdown key={i}>{seg.text}</Markdown>
        ),
      )}
    </div>
  )
}

interface QuotedSegment {
  kind: 'quote'
  source?: string
  artifactId?: string
  filePath?: string
  text: string
}
interface PlainSegment {
  kind: 'plain'
  text: string
}
type Segment = QuotedSegment | PlainSegment

/** 把 <quoted_selection source=".." artifactId=".." filePath="..">...</quoted_selection> 块和普通文本切开。 */
function splitQuotedSelections(content: string): Segment[] {
  const re = /<quoted_selection([^>]*)>([\s\S]*?)<\/quoted_selection>/g
  const out: Segment[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      const before = content.slice(last, m.index).trim()
      if (before) out.push({ kind: 'plain', text: before })
    }
    const attrs = m[1] ?? ''
    out.push({
      kind: 'quote',
      source: extractAttr(attrs, 'source'),
      artifactId: extractAttr(attrs, 'artifactId'),
      filePath: extractAttr(attrs, 'filePath'),
      text: m[2].trim(),
    })
    last = m.index + m[0].length
  }
  if (last < content.length) {
    const tail = content.slice(last).trim()
    if (tail) out.push({ kind: 'plain', text: tail })
  }
  if (out.length === 0) out.push({ kind: 'plain', text: content })
  return out
}

function extractAttr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(attrs)
  return m?.[1]
}

function QuotedSelectionCard({ source, artifactId, filePath, text }: QuotedSegment) {
  const [expanded, setExpanded] = useState(false)
  const lines = text.split('\n')
  const collapsed = lines.length > 4
  return (
    <div className="overflow-hidden rounded-md border border-[#3370FF]/30 bg-[#3370FF]/5 text-xs">
      <div className="flex items-center gap-1.5 border-b border-[#3370FF]/20 bg-[#3370FF]/10 px-2.5 py-1 text-[11px]">
        <Sparkles className="size-3 text-[#3370FF]" />
        <span className="font-medium text-[#3370FF]">引用</span>
        {source && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="truncate text-muted-foreground">{source}</span>
          </>
        )}
        {(artifactId || filePath) && (
          <code className="ml-1 truncate font-mono text-[10px] text-muted-foreground/70">
            {artifactId ?? filePath}
          </code>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto rounded px-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {expanded ? '收起' : '展开'}
          </button>
        )}
      </div>
      <pre
        className={cn(
          'whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/90',
          !expanded && collapsed && 'line-clamp-3',
        )}
      >
        {text}
      </pre>
    </div>
  )
}

// ─── Thinking（可折叠）──────────────────────────────────
function ThinkingPart({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  if (!content) return null
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="group flex w-full items-start gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-muted-foreground/50"
    >
      <ChevronRight
        className={cn('mt-0.5 size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
      />
      <div className="flex-1">
        <div className="font-medium uppercase tracking-wide text-muted-foreground/70">思考</div>
        <div
          className={cn(
            'mt-1 whitespace-pre-wrap italic leading-relaxed',
            !open && 'line-clamp-1',
          )}
        >
          {content}
        </div>
      </div>
    </button>
  )
}

// ─── Code ──────────────────────────────────────────────
function CodePart({ language, content }: { language: string; content: string }) {
  return <CodeBlock code={content} language={language} />
}

// ─── ToolUse + 内嵌 result ──────────────────────────────
function ToolUsePart({
  toolName,
  args,
  callId,
  completion,
}: {
  toolName: string
  args: unknown
  callId: string
  completion?: { result: unknown; isError: boolean }
}) {
  const [showDetails, setShowDetails] = useState(false)
  const displayName = getToolDisplayName(toolName)
  const command = isBashToolName(toolName) ? extractCommand(args) : null
  const remainingArgs = command ? omitCommand(args) : args
  const bashResult =
    isBashToolName(toolName) && completion
      ? extractBashResult(completion.result) ??
        (completion.isError && typeof completion.result === 'string'
          ? { output: completion.result }
          : null)
      : null

  const state: 'running' | 'success' | 'error' = !completion
    ? 'running'
    : completion.isError
      ? 'error'
      : 'success'

  const styles = {
    running: 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
    success: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    error: 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20',
  }[state]

  const iconColor = {
    running: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-red-600 dark:text-red-400',
  }[state]

  const label = {
    running: '调用中',
    success: '已完成',
    error: '失败',
  }[state]

  const toggleDetails = () => setShowDetails((v) => !v)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleDetails()
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={showDetails}
      title={showDetails ? '隐藏工具调用详情' : '展开工具调用详情'}
      onClick={toggleDetails}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full cursor-pointer overflow-hidden py-0 transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        styles,
      )}
    >
      <CardContent className="min-w-0 space-y-1.5 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          {state === 'running' && <Loader2 className={cn('size-3.5 animate-spin', iconColor)} />}
          {state === 'success' && <Check className={cn('size-3.5', iconColor)} />}
          {state === 'error' && <XCircle className={cn('size-3.5', iconColor)} />}
          <span className="min-w-0 max-w-[12rem] truncate rounded bg-black/5 px-1.5 py-0.5 text-[11px] font-medium dark:bg-white/10">
            {displayName}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="shrink-0 font-medium">{label}</span>
          <ChevronDown
            className={cn(
              'ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform',
              !showDetails && '-rotate-90',
            )}
          />
        </div>

        {command && <CommandPreview command={command} expanded={showDetails} />}
        {bashResult && (
          <BashOutputPreview
            result={bashResult}
            expanded={showDetails}
            tone={completion?.isError ? 'error' : 'neutral'}
          />
        )}

        {showDetails && (
          <div className="min-w-0 space-y-2 pt-1">
            {remainingArgs !== null && (
              <ToolDetailBlock label={command ? '其他参数' : '参数'} value={remainingArgs} />
            )}
            {completion && (
              <ToolDetailBlock
                label={completion.isError ? '错误' : '返回'}
                value={completion.result}
                tone={completion.isError ? 'error' : 'neutral'}
              />
            )}
            <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground">
              <span>{toolName}</span>
              <span>{callId}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CommandPreview({ command, expanded }: { command: string; expanded: boolean }) {
  return (
    <TerminalPreviewBlock
      label="命令"
      content={command}
      copyTitle="复制命令"
      expanded={expanded}
    />
  )
}

interface BashResultPreview {
  output: string
  exitCode?: number | null
  truncated?: boolean
  timedOut?: boolean
}

function BashOutputPreview({
  result,
  expanded,
  tone,
}: {
  result: BashResultPreview
  expanded: boolean
  tone: 'neutral' | 'error'
}) {
  const meta = [
    typeof result.exitCode === 'number' ? `exit ${result.exitCode}` : null,
    result.timedOut ? 'timeout' : null,
    result.truncated ? 'truncated' : null,
  ].filter(Boolean)
  const shouldWarn = tone === 'error' || result.timedOut || (result.exitCode ?? 0) !== 0

  return (
    <TerminalPreviewBlock
      label="输出"
      content={result.output || '(无输出)'}
      copyTitle="复制输出"
      expanded={expanded}
      meta={meta.length > 0 ? meta.join(' · ') : undefined}
      tone={shouldWarn ? 'error' : 'neutral'}
      collapsedMaxClassName="max-h-44"
    />
  )
}

function TerminalPreviewBlock({
  label,
  content,
  copyTitle,
  expanded,
  meta,
  tone = 'neutral',
  collapsedMaxClassName = 'max-h-20',
}: {
  label: string
  content: string
  copyTitle: string
  expanded: boolean
  meta?: string
  tone?: 'neutral' | 'error'
  collapsedMaxClassName?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-md border bg-zinc-950 text-zinc-100 shadow-sm',
        tone === 'error'
          ? 'border-red-700/70'
          : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 border-b border-zinc-800 px-2.5 py-1.5 text-[10px] text-zinc-400">
        <Terminal className="size-3 shrink-0" />
        <span className="shrink-0 font-medium">{label}</span>
        {meta && <span className="min-w-0 truncate font-mono text-zinc-500">{meta}</span>}
        <button
          type="button"
          onClick={(event) => void copy(event)}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          title={copyTitle}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre
        className={cn(
          'min-w-0 max-w-full overflow-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
          expanded ? 'max-h-80' : collapsedMaxClassName,
        )}
      >
        <code>{content}</code>
      </pre>
    </div>
  )
}

function ToolDetailBlock({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: unknown
  tone?: 'neutral' | 'error'
}) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-md border bg-background/70',
        tone === 'error' && 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20',
      )}
    >
      <div className="border-b border-border/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-72 min-w-0 max-w-full overflow-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        <code>{formatToolValue(value)}</code>
      </pre>
    </div>
  )
}

function extractCommand(value: unknown): string | null {
  if (!isPlainRecord(value)) return null
  const command = value.command
  return typeof command === 'string' && command.trim() ? command : null
}

function omitCommand(value: unknown): unknown | null {
  if (!isPlainRecord(value)) return value
  const rest = { ...value }
  delete rest.command
  return Object.keys(rest).length > 0 ? rest : null
}

function extractBashResult(value: unknown): BashResultPreview | null {
  if (!isPlainRecord(value) || typeof value.output !== 'string') return null
  return {
    output: value.output,
    exitCode:
      typeof value.exitCode === 'number' || value.exitCode === null ? value.exitCode : undefined,
    truncated: typeof value.truncated === 'boolean' ? value.truncated : undefined,
    timedOut: typeof value.timedOut === 'boolean' ? value.timedOut : undefined,
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function formatToolValue(value: unknown): string {
  if (typeof value === 'string') return value
  const json = JSON.stringify(value, null, 2)
  return json ?? String(value)
}

// ─── 连续 tool_use 折叠 cluster ────────────────────────
function ToolCluster({
  tools,
  resultByCallId,
}: {
  tools: Array<{ part: Extract<MessagePart, { type: 'tool_use' }>; index: number }>
  resultByCallId: Map<string, { result: unknown; isError: boolean }>
}) {
  const [expanded, setExpanded] = useState(false)

  // 按状态分别统计工具名，避免“创建产物×5”把成功/失败混在一起。
  const successCounts = new Map<string, number>()
  const errorCounts = new Map<string, number>()
  const runningCounts = new Map<string, number>()
  let runningCount = 0
  let errorCount = 0
  let successCount = 0
  for (const t of tools) {
    const displayName = getToolDisplayName(t.part.toolName)
    const c = resultByCallId.get(t.part.callId)
    if (!c) {
      runningCount++
      runningCounts.set(displayName, (runningCounts.get(displayName) ?? 0) + 1)
    } else if (c.isError) {
      errorCount++
      errorCounts.set(displayName, (errorCounts.get(displayName) ?? 0) + 1)
    } else {
      successCount++
      successCounts.set(displayName, (successCounts.get(displayName) ?? 0) + 1)
    }
  }
  const successDistribution = formatToolDistribution(successCounts)
  const errorDistribution = formatToolDistribution(errorCounts)
  const runningDistribution = formatToolDistribution(runningCounts)

  const overallState: 'running' | 'success' | 'error' =
    runningCount > 0 ? 'running' : errorCount > 0 ? 'error' : 'success'

  const styles = {
    running: 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10',
    success: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10',
    error: 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10',
  }[overallState]

  return (
    <Card className={cn('w-full py-0', styles)}>
      <CardContent className="space-y-1 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 text-left text-xs"
        >
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', !expanded && '-rotate-90')}
          />
          {overallState === 'running' && (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-600 dark:text-amber-400" />
          )}
          {overallState === 'success' && (
            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          {overallState === 'error' && (
            <XCircle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span className="font-medium">工具调用 × {tools.length}</span>
          <span className="text-muted-foreground">·</span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {successDistribution && (
              <>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  成功 {successCount}
                </span>
                <span className="font-mono">：{successDistribution}</span>
              </>
            )}
            {errorDistribution && (
              <>
                {successDistribution && <span> · </span>}
                <span className="font-medium text-red-700 dark:text-red-400">
                  失败 {errorCount}
                </span>
                <span className="font-mono">：{errorDistribution}</span>
              </>
            )}
            {runningDistribution && (
              <>
                {(successDistribution || errorDistribution) && <span> · </span>}
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  进行中 {runningCount}
                </span>
                <span className="font-mono">：{runningDistribution}</span>
              </>
            )}
          </span>
          {runningCount > 0 && (
            <span className="ml-auto shrink-0 text-[10px] text-amber-600 dark:text-amber-400">
              {runningCount} 进行中
            </span>
          )}
          {errorCount > 0 && runningCount === 0 && (
            <span className="ml-auto shrink-0 text-[10px] text-red-600 dark:text-red-400">
              {errorCount} 失败
            </span>
          )}
        </button>

        {expanded && (
          <div className="space-y-1.5 pl-5 pt-1">
            {tools.map((t) => (
              <ToolUsePart
                key={t.index}
                toolName={t.part.toolName}
                args={t.part.args}
                callId={t.part.callId}
                completion={resultByCallId.get(t.part.callId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatToolDistribution(counts: Map<string, number>): string {
  return Array.from(counts.entries())
    .map(([name, n]) => (n > 1 ? `${name}×${n}` : name))
    .join(' · ')
}

// ─── ArtifactRef ───────────────────────────────────────
function ArtifactRefPart({ artifactId }: { artifactId: string }) {
  const artifact = useAppStore((s) => s.artifacts[artifactId])
  const upsertArtifact = useAppStore((s) => s.upsertArtifact)
  const openPreview = useAppStore((s) => s.openArtifactPreview)
  const [status, setStatus] = useState<'loading' | 'deleted'>('loading')

  // Lazy load: store 里没有该 artifact 时，按需 fetch（404 即视为已删除）
  useEffect(() => {
    if (artifact) return
    let cancelled = false
    fetchArtifact(artifactId)
      .then((row) => {
        if (!cancelled) upsertArtifact(row)
      })
      .catch(() => {
        if (!cancelled) setStatus('deleted')
      })
    return () => {
      cancelled = true
    }
  }, [artifactId, artifact, upsertArtifact])

  if (status === 'deleted' && !artifact) {
    return (
      <Card className="border-dashed bg-muted/40">
        <CardContent className="flex items-center gap-2 px-3 py-2">
          <XCircle className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-muted-foreground line-through">
              产物已删除
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{artifactId}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!artifact) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>产物加载中…</span>
        </CardContent>
      </Card>
    )
  }

  const isWebApp = artifact.type === 'web_app'

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => openPreview(artifact.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openPreview(artifact.id)
      }}
      className="cursor-pointer transition hover:border-primary/40 hover:shadow-sm"
    >
      <CardContent className="flex items-start gap-3 px-3 py-2">
        <ArtifactIcon type={artifact.type} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{artifact.title}</div>
          <div className="text-xs text-muted-foreground">
            {artifact.type} · v{artifact.version} · 点击预览
          </div>
        </div>
        {isWebApp && (
          <div className="flex shrink-0 items-center gap-1">
            <IconAction
              title="打开预览 URL"
              onClick={(event) => {
                event.stopPropagation()
                openPreviewUrl(artifact.id)
              }}
            >
              <ExternalLink className="size-3.5" />
            </IconAction>
            <IconAction
              title="复制预览 URL"
              onClick={(event) => {
                event.stopPropagation()
                copyPreviewUrl(artifact.id)
              }}
            >
              <Copy className="size-3.5" />
            </IconAction>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ArtifactIcon({ type }: { type: string }) {
  if (type === 'image') return <ImageIcon className="size-5 shrink-0 text-muted-foreground" />
  if (type === 'document') return <FileText className="size-5 shrink-0 text-muted-foreground" />
  if (type === 'ppt') return <Presentation className="size-5 shrink-0 text-muted-foreground" />
  if (type === 'project') return <FolderGit2 className="size-5 shrink-0 text-muted-foreground" />
  return <Layers className="size-5 shrink-0 text-muted-foreground" />
}

function DeployCandidatesPart({
  conversationId,
  candidates,
}: {
  conversationId: string
  candidates: Extract<MessagePart, { type: 'deploy_candidates' }>['candidates']
}) {
  const agents = useAppStore((s) => s.agents)
  const upsertMessage = useAppStore((s) => s.upsertMessage)
  const [deployingId, setDeployingId] = useState<string | null>(null)
  const [deployedId, setDeployedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const deploy = async (artifactId: string) => {
    if (deployingId) return
    setDeployingId(artifactId)
    setError(null)
    try {
      const result = await deployConversationArtifact(conversationId, artifactId)
      upsertMessage(result.message)
      setDeployedId(artifactId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeployingId(null)
    }
  }

  return (
    <Card className="border-sky-200 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20">
      <CardContent className="space-y-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">选择要部署的产物</div>
            <div className="text-xs text-muted-foreground">
              当前会话有 {candidates.length} 个网页产物
            </div>
          </div>
        </div>

        <div className="divide-y rounded-md border bg-background/70">
          {candidates.map((candidate) => {
            const agent = agents[candidate.createdByAgentId]
            const busy = deployingId === candidate.artifactId
            const deployed = deployedId === candidate.artifactId
            return (
              <div
                key={candidate.artifactId}
                className="flex items-center gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{candidate.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    v{candidate.version} · {agent?.name ?? candidate.createdByAgentId} ·{' '}
                    {formatCompactDate(candidate.createdAt)}
                  </div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground/70">
                    {candidate.artifactId}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={deployed ? 'secondary' : 'outline'}
                  disabled={Boolean(deployingId) || deployed}
                  onClick={() => void deploy(candidate.artifactId)}
                  className="shrink-0"
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Rocket className="mr-1.5 size-3.5" />
                  )}
                  {deployed ? '已部署' : '部署'}
                </Button>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeployStatusPart({
  deployment,
}: {
  deployment: Extract<MessagePart, { type: 'deploy_status' }>['deployment']
}) {
  const ready = deployment.status === 'ready'
  const previewUrl = resolvePreviewUrl(deployment.previewPath)
  const isLocalStatic = deployment.deploymentType === 'local_static'
  const isExternalStatic = deployment.deploymentType === 'external_static'
  const fallbackPreviewPath = deployment.localPreviewPath
  const fallbackPreviewUrl = fallbackPreviewPath ? resolvePreviewUrl(fallbackPreviewPath) : null
  const actionPreviewPath = ready ? deployment.previewPath : fallbackPreviewPath
  const sourceLabel =
    deployment.sourceType === 'workspace'
      ? `工作区 ${deployment.workspacePath ?? '目录'}`
      : `v${deployment.version}`

  return (
    <Card
      className={cn(
        ready
          ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20'
          : 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20',
      )}
    >
      <CardContent className="flex items-start gap-3 px-3 py-2">
        {ready ? (
          <Rocket className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        ) : (
          <XCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {ready
              ? isExternalStatic
                ? '外部静态发布已就绪'
                : isLocalStatic
                  ? '本地静态发布已就绪'
                  : '部署预览已就绪'
              : isExternalStatic
                ? '外部静态发布失败'
                : '部署预览失败'}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {deployment.title} · {sourceLabel}
            {(isLocalStatic || isExternalStatic) && ` · ${deployment.id}`}
          </div>
          {ready ? (
            <div className="mt-1 space-y-0.5">
              <div className="truncate font-mono text-[11px] text-sky-700 dark:text-sky-300">
                {previewUrl}
              </div>
              {fallbackPreviewUrl && fallbackPreviewUrl !== previewUrl && (
                <div className="truncate text-[11px] text-muted-foreground">
                  本地回退：<span className="font-mono">{fallbackPreviewUrl}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 space-y-0.5">
              <div className="text-xs text-red-700 dark:text-red-300">
                {deployment.error ?? 'Unknown deployment error'}
              </div>
              {fallbackPreviewUrl && (
                <div className="truncate text-[11px] text-muted-foreground">
                  本地回退：<span className="font-mono">{fallbackPreviewUrl}</span>
                </div>
              )}
            </div>
          )}
        </div>
        {(ready || actionPreviewPath || deployment.sourceDownloadPath || deployment.containerDownloadPath) && (
          <div className="flex shrink-0 items-center gap-1">
            {actionPreviewPath && (
              <>
                <IconAction title={ready ? '打开预览 URL' : '打开本地回退预览'} onClick={() => openPath(actionPreviewPath)}>
                  <ExternalLink className="size-3.5" />
                </IconAction>
                <IconAction title={ready ? '复制预览 URL' : '复制本地回退预览'} onClick={() => copyPath(actionPreviewPath)}>
                  <Copy className="size-3.5" />
                </IconAction>
              </>
            )}
            {deployment.sourceDownloadPath && (
              <IconLinkAction title="下载源码包" href={deployment.sourceDownloadPath}>
                <Download className="size-3.5" />
              </IconLinkAction>
            )}
            {deployment.containerDownloadPath && (
              <IconLinkAction title="下载容器包" href={deployment.containerDownloadPath}>
                <Package className="size-3.5" />
              </IconLinkAction>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function IconLinkAction({
  title,
  href,
  children,
}: {
  title: string
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      title={title}
      download
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
    >
      {children}
    </a>
  )
}

function IconAction({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
    >
      {children}
    </button>
  )
}

function openPreviewUrl(artifactId: string): void {
  openPath(artifactPreviewPath(artifactId))
}

function copyPreviewUrl(artifactId: string): void {
  copyPath(artifactPreviewPath(artifactId))
}

function openPath(path: string): void {
  window.open(path, '_blank', 'noopener,noreferrer')
}

function copyPath(path: string): void {
  navigator.clipboard?.writeText(resolvePreviewUrl(path)).catch(() => {})
}

function resolvePreviewUrl(path: string): string {
  return new URL(path, window.location.origin).toString()
}

function formatCompactDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

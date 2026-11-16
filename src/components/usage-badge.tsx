'use client'

import { Archive, Coins } from 'lucide-react'
import { useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { compactConversation } from '@/lib/api'
import { cn } from '@/lib/utils'
import { getModelLimits } from '@/shared/model-registry'
import { getCacheHitRate } from '@/shared/token-usage'
import { useAppStore, useConversationUsageTotal } from '@/stores/app-store'

/**
 * UsageBadge —— ChatPanel header 里的 token 用量徽章。
 *
 * 显示「Σ N.Nk tok」（该会话累计），hover/click 展开 popover 看 input/output/cache 拆分 +
 * per-agent / per-model 拆分 + ctx 大小（最近一次 input prompt 长度）。
 *
 * 没用量时不渲染（首次进入会话之前没数据）。
 */
export function UsageBadge({ conversationId }: { conversationId: string }) {
  const total = useConversationUsageTotal(conversationId)
  const agents = useAppStore((s) => s.agents)
  const conv = useAppStore((s) => s.conversations[conversationId])
  const upsertMessage = useAppStore((s) => s.upsertMessage)
  const [compacting, setCompacting] = useState(false)

  if (total.runCount === 0) return null
  const cacheHitRate = getCacheHitRate(total.inputTokens, total.cacheReadTokens, total.cacheCreationTokens)

  // 取本会话内 contextWindow 最大的 agent 作为可见上限。详见 specs/13-conversation-context.md。
  const contextWindow = (() => {
    if (!conv) return 0
    let maxCtx = 0
    for (const aid of conv.agentIds) {
      const a = agents[aid]
      if (!a) continue
      const limits = getModelLimits(a.modelProvider, a.modelId)
      if (limits.contextWindow > maxCtx) maxCtx = limits.contextWindow
    }
    return maxCtx
  })()

  const handleCompact = async () => {
    if (compacting) return
    setCompacting(true)
    try {
      const result = await compactConversation(conversationId)
      upsertMessage(result.message)
    } catch (err) {
      console.error('[UsageBadge] compact failed', err)
    } finally {
      setCompacting(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground transition hover:border-foreground/30 hover:bg-muted hover:text-foreground',
        )}
        title="点击查看 token 用量明细"
      >
        <Coins className="size-3" />
        <span>{formatTok(total.totalTokens)}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 text-xs" align="end">
        <div className="mb-2 flex items-baseline justify-between border-b pb-2">
          <span className="font-medium">本会话 token 累计</span>
          <span className="text-[10px] text-muted-foreground">{total.runCount} 次响应</span>
        </div>

        <div className="space-y-1">
          <RowWithHint
            label="Input（含缓存）"
            value={total.inputTokens}
            highlight
            tip="总输入数量；缓存读写是其中的明细，不重复相加"
          />
          <RowWithHint
            label="Output"
            value={total.outputTokens}
            highlight
            tip="模型生成的 token 数量"
          />
          {total.cacheCreationTokens > 0 && (
            <RowWithHint
              label="Cache 写入"
              value={total.cacheCreationTokens}
              dim
              tip="模型上报的缓存写入数量，已包含在总输入中"
            />
          )}
          {total.cacheReadTokens > 0 && (
            <RowWithHint
              label="Cache 命中"
              value={total.cacheReadTokens}
              tip="模型上报的缓存命中数量，已包含在总输入中"
              className="text-emerald-600"
            />
          )}
          <div className="my-1 border-t" />
          <Row label="实际 Prompt"
            value={total.inputTokens}
            bold
            hint="输入总量，含缓存"
          />
          {contextWindow > 0 ? (
            <ContextRow used={total.lastInputTokens} ceiling={contextWindow} />
          ) : (
            <Row label="当前 ctx" value={total.lastInputTokens} dim hint="最近一次 prompt 大小" />
          )}
          <button
            type="button"
            onClick={() => void handleCompact()}
            disabled={compacting}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            title="Compact older conversation history into a summary"
          >
            <Archive className="size-3" />
            {compacting ? '正在压缩...' : '压缩上下文'}
          </button>
          {total.cacheReadTokens > 0 && cacheHitRate !== null && (
            <div
              className="flex items-baseline justify-between gap-3 text-emerald-600"
              title="缓存命中数量占已记录输入总量的比例"
            >
              <span className="truncate">Cache 命中率</span>
              <span className="shrink-0 font-mono">
                {Math.round(cacheHitRate * 100)}
                %
              </span>
            </div>
          )}
        </div>

        <div className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
          按模型上报的 token 统计；缓存是输入明细。Pin 消息可避免被预算自动截断。
        </div>

        {Object.keys(total.byAgent).length > 1 && (
          <div className="mt-3 border-t pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              按 Agent
            </div>
            {Object.entries(total.byAgent)
              .sort((a, b) => b[1] - a[1])
              .map(([agentId, n]) => (
                <Row key={agentId} label={agents[agentId]?.name ?? agentId} value={n} />
              ))}
          </div>
        )}

        {Object.keys(total.byModel).length > 0 && (
          <div className="mt-3 border-t pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              按 Model
            </div>
            {Object.entries(total.byModel)
              .sort((a, b) => b[1] - a[1])
              .map(([modelId, n]) => (
                <Row key={modelId} label={<code className="font-mono">{modelId}</code>} value={n} />
              ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Row({
  label,
  value,
  highlight,
  bold,
  dim,
  className,
  hint,
}: {
  label: React.ReactNode
  value: number
  highlight?: boolean
  bold?: boolean
  dim?: boolean
  className?: string
  hint?: string
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3',
        dim && 'text-muted-foreground',
        className,
      )}
    >
      <span className={cn('truncate', bold && 'font-medium')}>{label}</span>
      <span className={cn('shrink-0 font-mono', bold && 'font-semibold')}>
        {formatTok(value)}
        {hint && <span className="ml-1 text-[10px] text-muted-foreground">({hint})</span>}
        {highlight && value === 0 && <span className="ml-1 text-muted-foreground">—</span>}
      </span>
    </div>
  )
}

/** 带 tooltip 的版本，hover 解释计量字段 */
function RowWithHint({
  label,
  value,
  tip,
  ...rest
}: {
  label: React.ReactNode
  value: number
  tip: string
  highlight?: boolean
  bold?: boolean
  dim?: boolean
  className?: string
}) {
  return (
    <div title={tip} className="cursor-help">
      <Row label={label} value={value} {...rest} />
    </div>
  )
}

/** 1234 → "1.2k"；1234567 → "1.23M"；< 1000 → 原样 */
function formatTok(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

/** 当前 ctx 行的特殊版本：展示「used / ceiling (pct%)」+ 进度条 + 颜色。 */
function ContextRow({ used, ceiling }: { used: number; ceiling: number }) {
  const hasData = used > 0
  const pct = hasData ? Math.min(100, (used / ceiling) * 100) : 0
  const tone = pct < 50 ? 'normal' : pct < 80 ? 'warn' : 'danger'
  const toneColor =
    tone === 'danger' ? 'text-red-600 dark:text-red-400'
      : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'
  const gradientSize = hasData && pct > 0 ? `${10000 / pct}% 100%` : '100% 100%'

  return (
    <div className="space-y-1" title="最近一次 prompt 大小 / 模型 contextWindow 上限">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('truncate', toneColor)}>当前 ctx</span>
        <span className={cn('shrink-0 font-mono', toneColor)}>
          {hasData ? formatTok(used) : '—'} / {formatTok(ceiling)}
          {hasData && ` (${pct.toFixed(0)}%)`}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundImage: 'linear-gradient(90deg, #3370FF 0%, #F59E0B 68%, #EF4444 100%)',
            backgroundSize: gradientSize,
          }}
        />
      </div>
    </div>
  )
}

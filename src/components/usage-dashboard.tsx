'use client'

import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Coins,
  Database,
  FileText,
  Gauge,
  Loader2,
  Repeat2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  UsersRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchUsageSummary, type UsageBucket, type UsageSummary } from '@/lib/api'
import { AGENTHUB_FREE_PRODUCT_NOTICE } from '@/lib/free-product-policy'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'

export function UsageDashboard() {
  const [data, setData] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setActiveConversation = useAppStore((s) => s.setActiveConversation)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const summary = await fetchUsageSummary()
      setData(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const contextLabel = useMemo(() => {
    if (!data) return '正常'
    if (data.runtime.contextStatus === 'over_limit') return '需要压缩'
    if (data.runtime.contextStatus === 'near_limit') return '接近上限'
    return '正常'
  }, [data])

  if (loading && !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        正在加载用量数据
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs">
        <div className="text-destructive">{error}</div>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-md border px-3 py-1.5 hover:bg-accent"
        >
          重试
        </button>
      </div>
    )
  }

  if (!data) return null

  const topModel = data.byModel[0]
  const totalModelCost = data.byModel.reduce((sum, model) => sum + model.estimatedCostUsd, 0)
  const totalModelSaved = data.byModel.reduce((sum, model) => sum + model.estimatedSavedUsd, 0)
  const cacheHitPercent = Math.round(data.runtime.cacheHitRate * 100)

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="min-h-full bg-background p-3 text-xs">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b pb-3">
          <div>
            <div className="flex items-center gap-1.5 text-base font-semibold">
              <BarChart3 className="size-4 text-primary" />
              数据分析
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              看清每个模型实际消耗、外部费用、缓存命中和上下文压力。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-[11px] hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            刷新
          </button>
        </header>

        <div className="mx-auto max-w-[1440px] space-y-3">
          <section className="rounded-md border bg-emerald-50 px-3 py-2 text-[11px] leading-5 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            {AGENTHUB_FREE_PRODUCT_NOTICE}
          </section>

          <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric
              icon={<Coins className="size-4" />}
              title="外部模型费用"
              value={formatUsd(data.runtime.estimatedCostUsd)}
              detail={`${formatTokens(data.allTime.totalTokens)} tokens · ${formatInteger(data.allTime.runs)} 次请求`}
              tone="money"
            />
            <HeroMetric
              icon={<BarChart3 className="size-4" />}
              title="消耗最高模型"
              value={topModel?.model ?? '暂无'}
              detail={
                topModel
                  ? `${formatUsd(topModel.estimatedCostUsd)} · ${formatTokens(topModel.totalTokens)} tokens`
                  : '还没有模型消耗'
              }
            />
            <HeroMetric
              icon={<Repeat2 className="size-4" />}
              title="缓存节省"
              value={formatUsd(data.promptCache.estimatedSavedUsd)}
              detail={`命中 ${cacheHitPercent > 0 ? `${cacheHitPercent}%` : '-'} · 目标命中 ${Math.round(
                data.promptCache.targetHitRate * 100,
              )}%+`}
              tone={data.promptCache.estimatedSavedUsd > 0 ? 'good' : 'default'}
            />
            <HeroMetric
              icon={<Gauge className="size-4" />}
              title="上下文占用"
              value={formatPercent(data.context.percent)}
              detail={`${contextLabel} · 已用 ${formatTokens(data.context.usedTokens)} / ${formatTokens(
                data.context.limitTokens,
              )}`}
              tone={data.runtime.contextStatus === 'normal' ? 'good' : 'warn'}
            />
          </section>

          <ModelActualConsumptionBoard models={data.byModel} totalCost={totalModelCost} />

          <ModelSpendLedgerBoard
            models={data.byModel}
            totalCost={totalModelCost}
            totalSaved={totalModelSaved}
          />

          <CostCommandCenter
            data={data}
            totalModelCost={totalModelCost}
            totalModelSaved={totalModelSaved}
          />

          <ModelBillCommandPanel models={data.byModel} totalCost={totalModelCost} />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <Panel
                title="模型实际消耗"
                hint="按模型拆分真实 token、缓存与费用"
                icon={<BarChart3 className="size-4" />}
              >
                <BillingSummary models={data.byModel} totalCost={totalModelCost} totalSaved={totalModelSaved} />
                <ModelSpendSnapshot models={data.byModel} totalCost={totalModelCost} />
                <ModelCostDiagnosis
                  models={data.byModel}
                  totalCost={totalModelCost}
                  totalSaved={totalModelSaved}
                />
                <ActualModelBillPanel models={data.byModel} totalCost={totalModelCost} />
                <ModelUsagePanel models={data.byModel} totalTokens={data.allTime.totalTokens} />
                <ModelBillTable models={data.byModel} totalCost={totalModelCost} />
              </Panel>

              <Panel title="高耗会话" hint="点开可以回到对应会话" icon={<Coins className="size-4" />}>
                <HighSpendConversations
                  conversations={data.topConversations}
                  onOpenConversation={setActiveConversation}
                />
              </Panel>

              <Panel
                title="工程文件上下文"
                hint="降低 token 消耗的工程文件策略"
                icon={<FileText className="size-4" />}
              >
                <ProjectContextPanel data={data} />
              </Panel>
            </div>

            <aside className="space-y-3">
              <Panel title="上下文窗口" hint="当前上下文窗口占用" icon={<Gauge className="size-4" />}>
                <ContextGauge data={data} />
              </Panel>

              <Panel title="成本" icon={<Coins className="size-4" />}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile label="模型总费用" value={formatUsd(totalModelCost)} />
                  <MetricTile
                    label="缓存命中"
                    value={data.runtime.cacheHitTokens > 0 ? `${cacheHitPercent}%` : '-'}
                    tone={cacheHitPercent >= 50 ? 'good' : 'default'}
                  />
                </div>
              </Panel>

              <Panel title="运行指标" icon={<Clock3 className="size-4" />}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile label="耗时" value={formatDuration(data.runtime.elapsedMs)} />
                  <MetricTile label="请求数" value={formatInteger(data.runtime.requestCount)} />
                  <MetricTile
                    className="col-span-2"
                    label="会话 tokens"
                    value={formatInteger(data.runtime.conversationTokens)}
                  />
                </div>
              </Panel>

              <Panel title="长会话缓存" hint="追加式上下文，稳定前缀优先" icon={<Repeat2 className="size-4" />}>
                <PromptCachePanel data={data} />
              </Panel>

              <Panel title="会话状态" icon={<ShieldCheck className="size-4" />}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile
                    label="上下文状态"
                    value={contextLabel}
                    tone={data.runtime.contextStatus === 'normal' ? 'good' : 'warn'}
                  />
                  <MetricTile
                    label="压缩状态"
                    value={
                      data.runtime.compressionPercent > 0
                        ? `${data.runtime.compressionPercent}%`
                        : '待生成'
                    }
                  />
                </div>
              </Panel>

              <Panel title="时间统计" icon={<Database className="size-4" />}>
                <div className="grid gap-2">
                  <BucketTile label="今日" bucket={data.today} />
                  <BucketTile label="本周" bucket={data.week} />
                  <BucketTile label="全部" bucket={data.allTime} />
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

function ModelActualConsumptionBoard({
  models,
  totalCost,
}: {
  models: UsageSummary['byModel']
  totalCost: number
}) {
  if (models.length === 0) return null

  const totalTokens = models.reduce((sum, model) => sum + model.totalTokens, 0)
  const totalRuns = models.reduce((sum, model) => sum + model.runs, 0)
  const totalSaved = models.reduce((sum, model) => sum + model.estimatedSavedUsd, 0)
  const topModel = models[0]

  return (
    <section className="rounded-md border bg-card p-3 shadow-sm" data-testid="model-actual-consumption-board">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="size-4 text-primary" />
            <span>模型实际消耗排行</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            这里先按真实账单排序。每个模型花了多少钱、用了多少 token、跑了多少次、缓存帮你省了多少，一眼就能看到。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeLike label="实付总额" value={formatUsd(totalCost)} />
          <BadgeLike label="总 token" value={formatTokens(totalTokens)} />
          <BadgeLike label="缓存省下" value={formatUsd(totalSaved)} tone="good" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-2 lg:grid-cols-2">
          {models.slice(0, 8).map((model, index) => (
            <ModelActualConsumptionRow
              key={model.model}
              index={index}
              model={model}
              totalCost={totalCost}
              totalTokens={totalTokens}
            />
          ))}
        </div>

        <aside className="rounded-md border bg-background p-3">
          <div className="text-sm font-semibold">先看这个</div>
          <div className="mt-2 grid gap-2">
            <BillReadingTip
              label="最烧钱模型"
              value={topModel?.model ?? '暂无'}
              detail={
                topModel
                  ? `当前实付 ${formatUsd(topModel.estimatedCostUsd)}，先检查它的上下文、缓存命中和任务拆分。`
                  : '还没有模型账单。'
              }
            />
            <BillReadingTip
              label="总请求量"
              value={`${formatInteger(totalRuns)} 次`}
              detail={`${formatTokens(totalTokens)} tokens 已按模型拆分，适合判断哪个模型最需要限额。`}
            />
            <BillReadingTip
              label="无缓存会多花"
              value={formatUsd(totalSaved)}
              detail="长会话保持 append-only 稳定前缀后，DeepSeek / OpenAI-compatible 模型更容易命中 prefix cache。"
            />
          </div>
        </aside>
      </div>
    </section>
  )
}

function ModelActualConsumptionRow({
  index,
  model,
  totalCost,
  totalTokens,
}: {
  index: number
  model: UsageSummary['byModel'][number]
  totalCost: number
  totalTokens: number
}) {
  const costShare = totalCost > 0 ? (model.estimatedCostUsd / totalCost) * 100 : 0
  const tokenShare = totalTokens > 0 ? (model.totalTokens / totalTokens) * 100 : 0
  const cacheHit = model.cacheReadTokens > 0 ? model.cacheHitRate * 100 : 0
  const averageCost = model.estimatedCostUsd / Math.max(1, model.runs)

  return (
    <article className="rounded-md border bg-background p-3" data-testid="model-actual-consumption-row">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-semibold">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{model.model}</div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">
              {model.provider ?? '未绑定供应商'} · {formatInteger(model.runs)} 次请求
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-base font-semibold">{formatUsd(model.estimatedCostUsd)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">实际花费</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <ProgressLine
          label="费用占比"
          value={formatPercent(costShare)}
          percent={costShare}
          barClassName="bg-primary"
        />
        <ProgressLine
          label="Token 占比"
          value={formatPercent(tokenShare)}
          percent={tokenShare}
          barClassName="bg-blue-500"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniMetric label="总 token" value={formatTokens(model.totalTokens)} />
        <MiniMetric label="请求均价" value={formatUsd(averageCost)} />
        <MiniMetric
          label="缓存命中"
          value={model.cacheReadTokens > 0 ? formatPercent(cacheHit) : '-'}
          color={cacheHit >= 50 ? 'bg-emerald-500' : undefined}
        />
        <MiniMetric
          label="缓存节省"
          value={formatUsd(model.estimatedSavedUsd)}
          color={model.estimatedSavedUsd > 0 ? 'bg-emerald-500' : undefined}
        />
      </div>
    </article>
  )
}

function CostCommandCenter({
  data,
  totalModelCost,
  totalModelSaved,
}: {
  data: UsageSummary
  totalModelCost: number
  totalModelSaved: number
}) {
  const topModel = data.byModel[0]
  const topAgent = data.byAgent[0]
  const topModelCostShare = totalModelCost > 0 && topModel ? (topModel.estimatedCostUsd / totalModelCost) * 100 : 0
  const totalAgentCost = data.byAgent.reduce((sum, agent) => sum + agent.estimatedCostUsd, 0)
  const inputCostPercent = data.promptCache.effectiveInputCostPercent

  return (
    <section className="rounded-md border bg-card p-3 shadow-sm" data-testid="cost-command-center">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ReceiptText className="size-4 text-primary" />
            <span>成本驾驶舱</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            先看钱花在哪，再看 token 从哪里来。这里用实际账单、缓存节省和 Agent 来源，把模型消耗讲清楚。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeLike label="实际账单" value={formatUsd(totalModelCost)} />
          <BadgeLike label="缓存节省" value={formatUsd(totalModelSaved)} tone="good" />
          <BadgeLike label="输入成本降至" value={`${inputCostPercent}%`} tone={inputCostPercent <= 25 ? 'good' : 'default'} />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <CostInsight
              icon={<Coins className="size-4" />}
              label="最烧钱模型"
              value={topModel?.model ?? '暂无'}
              detail={
                topModel
                  ? `${formatUsd(topModel.estimatedCostUsd)} · 成本占比 ${formatPercent(topModelCostShare)}`
                  : '还没有模型消耗'
              }
            />
            <CostInsight
              icon={<TrendingDown className="size-4" />}
              label="缓存省下"
              value={formatUsd(totalModelSaved)}
              detail={`命中 ${Math.round(data.promptCache.cacheHitRate * 100)}% · 目标 ${Math.round(
                data.promptCache.targetHitRate * 100,
              )}%+`}
              tone={totalModelSaved > 0 ? 'good' : 'default'}
            />
            <CostInsight
              icon={<UsersRound className="size-4" />}
              label="最高消耗 Agent"
              value={topAgent?.name ?? '暂无'}
              detail={
                topAgent
                  ? `${formatTokens(topAgent.totalTokens)} tokens · ${formatUsd(topAgent.estimatedCostUsd)}`
                  : '还没有 Agent 用量'
              }
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold">模型花费排行</div>
              <div className="text-[11px] text-muted-foreground">按实际费用排序，缓存命中已折算</div>
            </div>
            <div className="space-y-2">
              {data.byModel.length === 0 ? (
                <EmptyLine text="暂无模型费用数据" />
              ) : (
                data.byModel.slice(0, 6).map((model) => (
                  <SpendBar
                    key={model.model}
                    label={model.model}
                    value={formatUsd(model.estimatedCostUsd)}
                    detail={`${formatTokens(model.totalTokens)} tokens · 节省 ${formatUsd(model.estimatedSavedUsd)}`}
                    percent={totalModelCost > 0 ? (model.estimatedCostUsd / totalModelCost) * 100 : 0}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold">Agent 消耗排行</div>
            <div className="text-[11px] text-muted-foreground">看是哪类员工最费 token</div>
          </div>
          <div className="space-y-2">
            {data.byAgent.length === 0 ? (
              <EmptyLine text="暂无 Agent 消耗数据" />
            ) : (
              data.byAgent.slice(0, 7).map((agent) => (
                <SpendBar
                  key={agent.agentId}
                  label={agent.name}
                  value={formatTokens(agent.totalTokens)}
                  detail={`${agent.runs} 次请求 · 估算 ${formatUsd(agent.estimatedCostUsd)}`}
                  percent={totalAgentCost > 0 ? (agent.estimatedCostUsd / totalAgentCost) * 100 : agent.sharePercent * 100}
                  tone="agent"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function CostInsight({
  icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  tone?: 'default' | 'good'
}) {
  return (
    <div
      className={cn(
        'rounded-md border bg-background p-2.5',
        tone === 'good' && 'border-emerald-500/30 bg-emerald-500/10',
      )}
    >
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</div>
    </div>
  )
}

function SpendBar({
  label,
  value,
  detail,
  percent,
  tone = 'model',
}: {
  label: string
  value: string
  detail: string
  percent: number
  tone?: 'model' | 'agent'
}) {
  const width = Math.max(2, Math.min(100, percent))
  return (
    <div className="rounded-md border bg-background px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{label}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</div>
        </div>
        <div className="shrink-0 font-mono text-xs font-semibold">{value}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', tone === 'agent' ? 'bg-emerald-500' : 'bg-primary')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function ModelBillCommandPanel({
  models,
  totalCost,
}: {
  models: UsageSummary['byModel']
  totalCost: number
}) {
  if (models.length === 0) return null

  const monthlyProjection = models.reduce((sum, model) => sum + model.projectedMonthlyCostUsd, 0)
  const topModel = models[0]
  const lowestCacheModel = models.reduce((current, model) => {
    if (model.totalTokens <= 0) return current
    return !current || model.cacheHitRate < current.cacheHitRate ? model : current
  }, null as UsageSummary['byModel'][number] | null)

  return (
    <section className="rounded-md border bg-card p-3 shadow-sm" data-testid="model-bill-command-panel">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ReceiptText className="size-4 text-primary" />
            <span>模型账单总览</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            每个模型实际花了多少钱、未来一个月可能花多少、哪里还能省，直接放在这里看。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeLike label="当前总账" value={formatUsd(totalCost)} />
          <BadgeLike label="月账单预估" value={formatUsd(monthlyProjection)} />
          <BadgeLike label="最该关注" value={topModel?.model ?? '暂无'} />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-2 lg:grid-cols-2">
          {models.slice(0, 6).map((model) => (
            <ModelBillSummaryCard key={model.model} model={model} totalCost={totalCost} />
          ))}
        </div>

        <aside className="rounded-md border bg-background p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-emerald-500" />
            先看哪里
          </div>
          <div className="space-y-2">
            <BillReadingTip
              label="第一优先"
              value={topModel?.model ?? '暂无'}
              detail={
                topModel
                  ? `当前实际花费最高：${formatUsd(topModel.estimatedCostUsd)}。`
                  : '还没有模型账单。'
              }
            />
            <BillReadingTip
              label="月账单预警"
              value={formatUsd(monthlyProjection)}
              detail="按最近 7 天费用折算，适合提前判断预算压力。"
            />
            <BillReadingTip
              label="缓存优化"
              value={lowestCacheModel?.model ?? '暂无'}
              detail={
                lowestCacheModel
                  ? `命中率 ${formatPercent(lowestCacheModel.cacheHitRate * 100)}，可以检查长会话前缀是否稳定。`
                  : '暂无可判断模型。'
              }
            />
          </div>
        </aside>
      </div>
    </section>
  )
}

function ModelBillSummaryCard({
  model,
  totalCost,
}: {
  model: UsageSummary['byModel'][number]
  totalCost: number
}) {
  const costShare = totalCost > 0 ? (model.estimatedCostUsd / totalCost) * 100 : 0
  const averageCost = model.estimatedCostUsd / Math.max(1, model.runs)
  const savingRate =
    model.estimatedUncachedPromptCostUsd > 0
      ? (model.estimatedSavedUsd / model.estimatedUncachedPromptCostUsd) * 100
      : 0

  return (
    <article className="rounded-md border bg-background p-3" data-testid="model-bill-summary-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{model.model}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {model.provider ?? '未绑定提供商'} · {formatInteger(model.runs)} 次请求
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-semibold">{formatUsd(model.estimatedCostUsd)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">实际花费</div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(2, Math.min(100, costShare))}%` }}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <MiniMetric label="成本占比" value={formatPercent(costShare)} />
        <MiniMetric label="月账单预估" value={formatUsd(model.projectedMonthlyCostUsd)} strong />
        <MiniMetric label="每次请求均价" value={formatUsd(averageCost)} />
        <MiniMetric
          label="缓存省钱率"
          value={formatPercent(savingRate)}
          color={savingRate > 0 ? 'bg-emerald-500' : undefined}
        />
      </div>

      <div className="mt-2 rounded-md border bg-muted/10 px-2.5 py-2">
        <div className="text-[11px] font-semibold">优化建议</div>
        <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{modelBillAdvice(model)}</div>
      </div>
    </article>
  )
}

function ModelSpendLedgerBoard({
  models,
  totalCost,
  totalSaved,
}: {
  models: UsageSummary['byModel']
  totalCost: number
  totalSaved: number
}) {
  if (models.length === 0) return null

  const topModel = models[0]
  const totalRuns = models.reduce((sum, model) => sum + model.runs, 0)
  const totalTokens = models.reduce((sum, model) => sum + model.totalTokens, 0)
  const lowestCacheModel = models.reduce((current, model) => {
    if (model.totalTokens <= 0) return current
    if (!current) return model
    return model.cacheHitRate < current.cacheHitRate ? model : current
  }, null as UsageSummary['byModel'][number] | null)

  return (
    <section className="rounded-md border bg-card p-3 shadow-sm" data-testid="model-spend-ledger-board">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ReceiptText className="size-4 text-primary" />
            <span>模型实付账单看板</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            每个模型实际花费、费用占比、请求均价、缓存命中和已省费用集中在这里。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeLike label="实际总花费" value={formatUsd(totalCost)} />
          <BadgeLike label="覆盖模型" value={formatInteger(models.length)} />
          <BadgeLike label="已省费用" value={formatUsd(totalSaved)} tone="good" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-2 lg:grid-cols-2">
          {models.slice(0, 8).map((model) => (
            <ModelSpendLedgerRow
              key={model.model}
              model={model}
              totalCost={totalCost}
            />
          ))}
        </div>

        <aside className="rounded-md border bg-background p-3">
          <div className="text-sm font-semibold">账单解读</div>
          <div className="mt-2 grid gap-2">
            <BillReadingTip
              label="最该盯的模型"
              value={topModel?.model ?? '暂无'}
              detail={
                topModel
                  ? `当前实付 ${formatUsd(topModel.estimatedCostUsd)}，占总费用 ${formatPercent(
                      totalCost > 0 ? (topModel.estimatedCostUsd / totalCost) * 100 : 0,
                    )}。`
                  : '还没有模型费用。'
              }
            />
            <BillReadingTip
              label="缓存最弱模型"
              value={lowestCacheModel?.model ?? '暂无'}
              detail={
                lowestCacheModel
                  ? `缓存命中 ${formatPercent(lowestCacheModel.cacheHitRate * 100)}，长会话可优先检查它。`
                  : '暂无可判断模型。'
              }
            />
            <BillReadingTip
              label="总体请求"
              value={`${formatInteger(totalRuns)} 次`}
              detail={`${formatTokens(totalTokens)} tokens 已按模型拆分，后续可以继续加预算提醒。`}
            />
          </div>
        </aside>
      </div>
    </section>
  )
}

function ModelSpendLedgerRow({
  model,
  totalCost,
}: {
  model: UsageSummary['byModel'][number]
  totalCost: number
}) {
  const costShare = totalCost > 0 ? (model.estimatedCostUsd / totalCost) * 100 : 0
  const averageCost = model.estimatedCostUsd / Math.max(1, model.runs)
  const cacheHit = model.cacheReadTokens > 0 ? model.cacheHitRate * 100 : 0

  return (
    <article className="rounded-md border bg-background p-3" data-testid="model-spend-ledger-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{model.model}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {model.provider ?? '未绑定提供商'} · {formatInteger(model.runs)} 次请求
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-base font-semibold">{formatUsd(model.estimatedCostUsd)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">实际花费</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>费用占比</span>
          <span className="font-mono">{formatPercent(costShare)}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(2, Math.min(100, costShare))}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric label="请求均价" value={formatUsd(averageCost)} />
        <MiniMetric label="总 token" value={formatTokens(model.totalTokens)} />
        <MiniMetric
          label="缓存命中"
          value={model.cacheReadTokens > 0 ? formatPercent(cacheHit) : '-'}
          color={cacheHit >= 50 ? 'bg-emerald-500' : undefined}
        />
        <MiniMetric
          label="已省费用"
          value={formatUsd(model.estimatedSavedUsd)}
          color={model.estimatedSavedUsd > 0 ? 'bg-emerald-500' : undefined}
        />
      </div>
    </article>
  )
}

function BillReadingTip({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-md border bg-muted/10 p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{detail}</div>
    </div>
  )
}

function modelBillAdvice(model: UsageSummary['byModel'][number]): string {
  const averageCost = model.estimatedCostUsd / Math.max(1, model.runs)
  if (model.cacheHitRate < 0.5 && model.totalTokens > 0) {
    return '优先检查长会话是否保持 append-only 稳定前缀，提高 prefix cache 命中率。'
  }
  if (averageCost > 0.01) {
    return '单次请求成本偏高，适合拆分任务、减少一次性上下文或换成更便宜的模型。'
  }
  if (model.projectedMonthlyCostUsd > model.estimatedCostUsd * 3 && model.projectedMonthlyCostUsd > 0.01) {
    return '最近 7 天增长较快，建议设置预算提醒或限制高频自动任务。'
  }
  return '当前账单结构健康，继续保持缓存复用和按需加载工程文件。'
}

function HeroMetric({
  icon,
  title,
  value,
  detail,
  tone = 'default',
}: {
  icon: ReactNode
  title: string
  value: string
  detail: string
  tone?: 'default' | 'good' | 'warn' | 'money'
}) {
  return (
    <section
      className={cn(
        'rounded-md border bg-card p-3 shadow-sm',
        tone === 'good' && 'border-emerald-500/50 bg-emerald-500/5',
        tone === 'warn' && 'border-orange-500/50 bg-orange-500/5',
        tone === 'money' && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px]">{title}</span>
      </div>
      <div className="truncate text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</div>
    </section>
  )
}

function ModelUsagePanel({
  models,
  totalTokens,
}: {
  models: UsageSummary['byModel']
  totalTokens: number
}) {
  if (models.length === 0) return <EmptyLine text="暂无模型消耗数据" />

  const totalRuns = models.reduce((sum, model) => sum + model.runs, 0)
  const maxTokens = Math.max(...models.map((model) => model.totalTokens), 1)
  const maxCost = Math.max(...models.map((model) => model.estimatedCostUsd), 0.000001)
  const totalCost = models.reduce((sum, model) => sum + model.estimatedCostUsd, 0)
  const totalSaved = models.reduce((sum, model) => sum + model.estimatedSavedUsd, 0)

  return (
    <div className="space-y-3" data-testid="model-cost-board">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="模型数" value={formatInteger(models.length)} />
        <MetricTile label="总 tokens" value={formatTokens(totalTokens)} />
        <MetricTile label="实际账单" value={formatUsd(totalCost)} />
        <MetricTile label="缓存节省" value={formatUsd(totalSaved)} tone={totalSaved > 0 ? 'good' : 'default'} />
        <MetricTile label="平均每次" value={formatTokens(totalTokens / Math.max(1, totalRuns))} />
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border bg-muted/10 p-2 text-[11px] text-muted-foreground">
        <LegendDot color="bg-cyan-400" label="输入" />
        <LegendDot color="bg-blue-500" label="输出" />
        <LegendDot color="bg-emerald-500" label="缓存命中" />
        <LegendDot color="bg-amber-500" label="缓存写入" />
      </div>

      <div className="overflow-hidden rounded-md border">
        {models.slice(0, 10).map((model, index) => (
          <ModelCostRow
            key={model.model}
            index={index}
            model={model}
            maxTokens={maxTokens}
            maxCost={maxCost}
          />
        ))}
      </div>
    </div>
  )
}

function ModelSpendSnapshot({
  models,
  totalCost,
}: {
  models: UsageSummary['byModel']
  totalCost: number
}) {
  if (models.length === 0) return null

  return (
    <section className="mb-3 rounded-md border bg-background p-3" data-testid="model-spend-snapshot">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">模型费用快照</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            一眼看每个模型实际花了多少钱，本周花多少，后续月账单大概会到哪里。
          </p>
        </div>
        <BadgeLike label="按实际费用排序" value={formatUsd(totalCost)} />
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        {models.slice(0, 6).map((model, index) => {
          const costShare = totalCost > 0 ? (model.estimatedCostUsd / totalCost) * 100 : 0
          const cacheHit = model.cacheReadTokens > 0 ? formatPercent(model.cacheHitRate * 100) : '-'
          return (
            <article key={model.model} className="rounded-md border bg-muted/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md border bg-background text-[11px] font-semibold">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{model.model}</div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">
                      {model.provider ?? '未绑定提供商'} · {formatInteger(model.runs)} 次请求
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold">{formatUsd(model.estimatedCostUsd)}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">实际花费</div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(2, Math.min(100, costShare))}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniMetric label="成本占比" value={formatPercent(costShare)} />
                <MiniMetric label="本周费用" value={formatUsd(model.last7dCostUsd)} />
                <MiniMetric label="月预估" value={formatUsd(model.projectedMonthlyCostUsd)} strong />
                <MiniMetric label="缓存命中" value={cacheHit} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniMetric color="bg-cyan-400" label="输入" value={formatTokens(model.inputTokens)} />
                <MiniMetric color="bg-blue-500" label="输出" value={formatTokens(model.outputTokens)} />
                <MiniMetric color="bg-emerald-500" label="已省" value={formatUsd(model.estimatedSavedUsd)} />
                <MiniMetric label="每次平均" value={formatTokens(model.avgTokensPerRun)} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ModelCostRow({
  index,
  model,
  maxTokens,
  maxCost,
}: {
  index: number
  model: UsageSummary['byModel'][number]
  maxTokens: number
  maxCost: number
}) {
  const relativeTokenPercent = maxTokens > 0 ? (model.totalTokens / maxTokens) * 100 : 0
  const relativeCostPercent = maxCost > 0 ? (model.estimatedCostUsd / maxCost) * 100 : 0
  const inputPercent = segmentPercent(model.inputTokens, model.totalTokens)
  const outputPercent = segmentPercent(model.outputTokens, model.totalTokens)
  const cacheReadPercent = segmentPercent(model.cacheReadTokens, model.totalTokens)
  const cacheCreationPercent = segmentPercent(model.cacheCreationTokens, model.totalTokens)

  return (
    <article
      data-testid="model-cost-row"
      className="border-b bg-card p-3 last:border-b-0 hover:bg-accent/40"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-muted text-[11px] font-semibold">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{model.model}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {model.provider ?? '未绑定提供商'} · {model.runs} 次请求 · 实际费用{' '}
                {formatUsd(model.estimatedCostUsd)} · 缓存节省{' '}
                {formatUsd(model.estimatedSavedUsd)}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <ProgressLine label="Token 占用" value={formatTokens(model.totalTokens)} percent={relativeTokenPercent}>
              <div className="flex h-full rounded-full">
                <UsageSegment className="bg-cyan-400" percent={inputPercent} />
                <UsageSegment className="bg-blue-500" percent={outputPercent} />
                <UsageSegment className="bg-emerald-500" percent={cacheReadPercent} />
                <UsageSegment className="bg-amber-500" percent={cacheCreationPercent} />
              </div>
            </ProgressLine>
            <ProgressLine
              label="费用占用"
              value={formatUsd(model.estimatedCostUsd)}
              percent={relativeCostPercent}
              barClassName="bg-primary"
            />
            <ProgressLine
              label="无缓存估算"
              value={formatUsd(model.estimatedUncachedPromptCostUsd)}
              percent={
                model.estimatedUncachedPromptCostUsd > 0
                  ? (model.estimatedCostUsd / model.estimatedUncachedPromptCostUsd) * 100
                  : 0
              }
              barClassName="bg-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <MiniMetric label="实际费用" value={formatUsd(model.estimatedCostUsd)} strong />
          <MiniMetric label="缓存节省" value={formatUsd(model.estimatedSavedUsd)} />
          <MiniMetric label="命中率" value={model.cacheReadTokens > 0 ? formatPercent(model.cacheHitRate * 100) : '-'} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <MiniMetric color="bg-cyan-400" label="输入" value={formatTokens(model.inputTokens)} />
        <MiniMetric color="bg-blue-500" label="输出" value={formatTokens(model.outputTokens)} />
        <MiniMetric color="bg-emerald-500" label="缓存命中" value={formatTokens(model.cacheReadTokens)} />
        <MiniMetric color="bg-amber-500" label="缓存写入" value={formatTokens(model.cacheCreationTokens)} />
        <MiniMetric label="总 tokens" value={formatTokens(model.totalTokens)} />
        <MiniMetric label="请求数" value={formatInteger(model.runs)} />
      </div>
    </article>
  )
}

function ActualModelBillPanel({
  models,
  totalCost,
}: {
  models: UsageSummary['byModel']
  totalCost: number
}) {
  if (models.length === 0) return null

  const totals = models.reduce(
    (sum, model) => ({
      input: sum.input + model.costBreakdown.inputCostUsd,
      output: sum.output + model.costBreakdown.outputCostUsd,
      cacheRead: sum.cacheRead + model.costBreakdown.cacheReadCostUsd,
      cacheCreation: sum.cacheCreation + model.costBreakdown.cacheCreationCostUsd,
      monthly: sum.monthly + model.projectedMonthlyCostUsd,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, monthly: 0 },
  )

  return (
    <section className="mb-3 rounded-md border bg-background" data-testid="actual-model-bill-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-2">
        <div>
          <div className="text-sm font-semibold">模型真实扣费拆分</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            每个模型按输入、输出、缓存命中和缓存写入拆账，7 日费用会自动折算成月度预估。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeLike label="当前总账" value={formatUsd(totalCost)} />
          <BadgeLike label="月度预估" value={formatUsd(totals.monthly)} />
        </div>
      </div>

      <div className="grid gap-2 border-b p-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="输入费用" value={formatUsd(totals.input)} />
        <MetricTile label="输出费用" value={formatUsd(totals.output)} />
        <MetricTile label="缓存读取" value={formatUsd(totals.cacheRead)} tone="good" />
        <MetricTile label="缓存写入" value={formatUsd(totals.cacheCreation)} />
        <MetricTile label="预估月账单" value={formatUsd(totals.monthly)} tone={totals.monthly > totalCost ? 'warn' : 'default'} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-[11px]">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">模型</th>
              <th className="px-3 py-2 font-medium">提供商</th>
              <th className="px-3 py-2 font-medium">实际扣费</th>
              <th className="px-3 py-2 font-medium">输入费</th>
              <th className="px-3 py-2 font-medium">输出费</th>
              <th className="px-3 py-2 font-medium">缓存读</th>
              <th className="px-3 py-2 font-medium">缓存写</th>
              <th className="px-3 py-2 font-medium">7 日费用</th>
              <th className="px-3 py-2 font-medium">月预估</th>
              <th className="px-3 py-2 font-medium">输入成本</th>
            </tr>
          </thead>
          <tbody>
            {models.slice(0, 12).map((model) => (
              <tr key={model.model} className="border-t">
                <td className="px-3 py-2">
                  <div className="max-w-[18rem] truncate font-semibold">{model.model}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, Math.min(100, model.costSharePercent * 100))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    费用占比 {formatPercent(model.costSharePercent * 100)}
                  </div>
                </td>
                <td className="px-3 py-2">{model.provider ?? '未绑定'}</td>
                <td className="px-3 py-2 font-mono font-semibold">{formatUsd(model.estimatedCostUsd)}</td>
                <td className="px-3 py-2 font-mono">{formatUsd(model.costBreakdown.inputCostUsd)}</td>
                <td className="px-3 py-2 font-mono">{formatUsd(model.costBreakdown.outputCostUsd)}</td>
                <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-400">
                  {formatUsd(model.costBreakdown.cacheReadCostUsd)}
                </td>
                <td className="px-3 py-2 font-mono">{formatUsd(model.costBreakdown.cacheCreationCostUsd)}</td>
                <td className="px-3 py-2 font-mono">{formatUsd(model.last7dCostUsd)}</td>
                <td className="px-3 py-2 font-mono font-semibold">{formatUsd(model.projectedMonthlyCostUsd)}</td>
                <td className="px-3 py-2">
                  <div className="font-mono font-semibold">
                    {formatPercent(model.costBreakdown.effectivePromptCostPercent)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    无缓存 {formatUsd(model.costBreakdown.uncachedPromptCostUsd)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ModelBillTable({
  models,
  totalCost,
}: {
  models: UsageSummary['byModel']
  totalCost: number
}) {
  if (models.length === 0) return null

  return (
    <section className="mt-3 rounded-md border bg-background" data-testid="model-bill-table">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <div className="text-sm font-semibold">模型账单明细</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            对比实际账单、无缓存估算和缓存节省，方便判断哪个模型最烧钱。
          </div>
        </div>
        <BadgeLike label="成本占比" value="按实际费用计算" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">模型</th>
              <th className="px-3 py-2 font-medium">实际账单</th>
              <th className="px-3 py-2 font-medium">无缓存估算</th>
              <th className="px-3 py-2 font-medium">缓存节省</th>
              <th className="px-3 py-2 font-medium">命中率</th>
              <th className="px-3 py-2 font-medium">请求数</th>
              <th className="px-3 py-2 font-medium">平均每次</th>
            </tr>
          </thead>
          <tbody>
            {models.slice(0, 12).map((model) => {
              const costShare = totalCost > 0 ? (model.estimatedCostUsd / totalCost) * 100 : 0
              const savedPercent =
                model.estimatedUncachedPromptCostUsd > 0
                  ? (model.estimatedSavedUsd / model.estimatedUncachedPromptCostUsd) * 100
                  : 0
              return (
                <tr key={model.model} className="border-t">
                  <td className="px-3 py-2">
                    <div className="max-w-[18rem] truncate font-semibold">{model.model}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(2, Math.min(100, costShare))}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">成本占比 {formatPercent(costShare)}</div>
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold">{formatUsd(model.estimatedCostUsd)}</td>
                  <td className="px-3 py-2 font-mono">{formatUsd(model.estimatedUncachedPromptCostUsd)}</td>
                  <td className="px-3 py-2">
                    <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatUsd(model.estimatedSavedUsd)}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      实际比无缓存少 {formatPercent(savedPercent)}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {model.cacheReadTokens > 0 ? formatPercent(model.cacheHitRate * 100) : '-'}
                  </td>
                  <td className="px-3 py-2 font-mono">{formatInteger(model.runs)}</td>
                  <td className="px-3 py-2 font-mono">{formatTokens(model.avgTokensPerRun)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BillingSummary({
  models,
  totalCost,
  totalSaved,
}: {
  models: UsageSummary['byModel']
  totalCost: number
  totalSaved: number
}) {
  const topModel = models[0]
  return (
    <div className="mb-3 rounded-md border bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">模型费用排行</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            这里看的是实际账单，不是单纯 token 数；缓存命中的部分会按更低成本计算。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeLike label="实际账单" value={formatUsd(totalCost)} />
          <BadgeLike label="缓存节省" value={formatUsd(totalSaved)} tone="good" />
          <BadgeLike label="最贵模型" value={topModel?.model ?? '暂无'} />
        </div>
      </div>
    </div>
  )
}

function ModelCostDiagnosis({
  models,
  totalCost,
  totalSaved,
}: {
  models: UsageSummary['byModel']
  totalCost: number
  totalSaved: number
}) {
  if (models.length === 0) return null

  const totalRuns = models.reduce((sum, model) => sum + model.runs, 0)
  const totalUncached = models.reduce((sum, model) => sum + model.estimatedUncachedPromptCostUsd, 0)
  const savingRate = totalUncached > 0 ? (totalSaved / totalUncached) * 100 : 0
  const topCostModel = models[0]
  const lowestCacheModel = models.reduce((current, model) => {
    if (model.totalTokens <= 0) return current
    if (!current) return model
    return model.cacheHitRate < current.cacheHitRate ? model : current
  }, null as UsageSummary['byModel'][number] | null)
  const maxCost = Math.max(...models.map((model) => model.estimatedCostUsd), 0.000001)

  return (
    <section className="mb-3 rounded-md border bg-background p-3" data-testid="model-cost-diagnosis">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">模型费用诊断</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            把模型账单拆成实际花费、无缓存估算、缓存省钱率和请求均价，方便直接判断该优化哪里。
          </p>
        </div>
        <BadgeLike label="模型数" value={formatInteger(models.length)} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="当前最贵模型"
          value={topCostModel?.model ?? '暂无'}
          className="bg-primary/5"
        />
        <MetricTile
          label="请求均价"
          value={formatUsd(totalCost / Math.max(1, totalRuns))}
        />
        <MetricTile
          label="缓存省钱率"
          value={formatPercent(savingRate)}
          tone={savingRate > 0 ? 'good' : 'default'}
        />
        <MetricTile
          label="可优化模型"
          value={lowestCacheModel?.model ?? '暂无'}
          tone={lowestCacheModel && lowestCacheModel.cacheHitRate < 0.5 ? 'warn' : 'default'}
        />
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {models.slice(0, 6).map((model) => (
          <ModelDiagnosisRow
            key={model.model}
            model={model}
            maxCost={maxCost}
          />
        ))}
      </div>
    </section>
  )
}

function ModelDiagnosisRow({
  model,
  maxCost,
}: {
  model: UsageSummary['byModel'][number]
  maxCost: number
}) {
  const costPercent = maxCost > 0 ? (model.estimatedCostUsd / maxCost) * 100 : 0
  const savedRate =
    model.estimatedUncachedPromptCostUsd > 0
      ? (model.estimatedSavedUsd / model.estimatedUncachedPromptCostUsd) * 100
      : 0

  return (
    <article className="rounded-md border bg-muted/10 p-2.5" data-testid="model-diagnosis-row">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{model.model}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            实际花费 {formatUsd(model.estimatedCostUsd)} · 无缓存估算 {formatUsd(model.estimatedUncachedPromptCostUsd)}
          </div>
        </div>
        <div className="shrink-0 rounded-md border bg-background px-2 py-1 font-mono text-[11px] font-semibold">
          {formatUsd(model.estimatedCostUsd)}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(2, Math.min(100, costPercent))}%` }}
        />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="缓存省钱率" value={formatPercent(savedRate)} />
        <MiniMetric
          label="缓存命中"
          value={model.cacheReadTokens > 0 ? formatPercent(model.cacheHitRate * 100) : '-'}
        />
        <MiniMetric label="平均每次" value={formatTokens(model.avgTokensPerRun)} />
      </div>
    </article>
  )
}

function ProgressLine({
  label,
  value,
  percent,
  barClassName,
  children,
}: {
  label: string
  value: string
  percent: number
  barClassName?: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', children ? '' : barClassName ?? 'bg-primary')}
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function BadgeLike({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs',
        tone === 'good' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[11rem] truncate font-mono font-semibold">{value}</span>
    </span>
  )
}

function PromptCachePanel({ data }: { data: UsageSummary }) {
  const cache = data.promptCache
  const hitPercent = Math.round(cache.cacheHitRate * 100)
  const targetPercent = Math.round(cache.targetHitRate * 100)
  const targetCost = Math.round(cache.targetInputCostPercent)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label="实际命中"
          value={cache.cacheReadTokens > 0 ? `${hitPercent}%` : '-'}
          tone={cache.cacheHitRate >= 0.5 ? 'good' : 'default'}
        />
        <MetricTile label="目标命中" value={`${targetPercent}%+`} />
        <MetricTile
          label="输入成本"
          value={`${cache.effectiveInputCostPercent}%`}
          tone={cache.effectiveInputCostPercent <= targetCost ? 'good' : 'default'}
        />
        <MetricTile label="已省费用" value={formatUsd(cache.estimatedSavedUsd)} />
      </div>

      <div className="rounded-md border bg-muted/20 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-semibold">{cache.label}</span>
          <span className="text-[11px] text-muted-foreground">
            可缓存前缀 {formatTokens(cache.cacheablePrefixTokens)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.max(2, Math.min(100, hitPercent))}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          追加式上下文会尽量保持前缀字节稳定，把每轮变化放在尾部。模型命中 prefix-cache 后，长会话输入成本会明显下降。
        </p>
      </div>

      <div className="grid gap-2">
        {cache.stablePrefixSections.map((section) => (
          <div key={section} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
            <span className="truncate text-[11px]">{section}</span>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-muted/10 p-2.5">
        <div className="mb-1 font-semibold">建议</div>
        <div className="space-y-1">
          {cache.recommendations.slice(0, 2).map((item) => (
            <div key={item} className="text-[11px] leading-5 text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProjectContextPanel({ data }: { data: UsageSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <StrategyPill label="文件索引" value="启用" />
        <StrategyPill label="读取方式" value="按需" />
        <StrategyPill label="单次上限" value={formatInteger(data.projectContext.fileReadCharLimit)} />
        <StrategyPill label="摘要 tokens" value={formatInteger(data.projectContext.summaryTokens)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.projectContext.rules.map((rule) => (
          <div
            key={rule}
            className="flex min-h-12 items-start gap-2 rounded-md border bg-muted/20 p-2 text-muted-foreground"
          >
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            <span>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HighSpendConversations({
  conversations,
  onOpenConversation,
}: {
  conversations: UsageSummary['topConversations']
  onOpenConversation: (id: string) => void
}) {
  if (conversations.length === 0) return <EmptyLine text="暂无会话用量" />

  return (
    <div className="grid gap-1.5">
      {conversations.slice(0, 8).map((conversation) => (
        <button
          key={conversation.id}
          type="button"
          onClick={() => onOpenConversation(conversation.id)}
          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border bg-muted/10 px-3 py-2 text-left hover:bg-accent"
        >
          <span className="truncate font-medium">{conversation.title}</span>
          <span className="font-mono text-muted-foreground">{formatTokens(conversation.totalTokens)}</span>
          <span className="text-[10px] text-muted-foreground">{conversation.runs} 次</span>
        </button>
      ))}
    </div>
  )
}

function UsageSegment({ className, percent }: { className: string; percent: number }) {
  if (percent <= 0) return null
  return <div className={className} style={{ width: `${Math.max(1, percent)}%` }} />
}

function MiniMetric({
  label,
  value,
  color,
  strong = false,
}: {
  label: string
  value: string
  color?: string
  strong?: boolean
}) {
  return (
    <div className="rounded-md border bg-background px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {color ? <span className={cn('size-2 rounded-full', color)} /> : null}
        {label}
      </div>
      <div className={cn('mt-1 truncate font-mono text-xs font-semibold', strong && 'text-sm')}>
        {value}
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', color)} />
      {label}
    </span>
  )
}

function segmentPercent(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0
}

function Panel({
  title,
  hint,
  icon,
  children,
}: {
  title: string
  hint?: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-md border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-semibold">{title}</span>
        </div>
        {hint ? <span className="max-w-[240px] text-right text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

function ContextGauge({ data }: { data: UsageSummary }) {
  const percent = Math.max(0, Math.min(100, data.context.percent))
  const gaugeStyle = {
    background: `conic-gradient(#3370ff ${percent * 3.6}deg, hsl(var(--muted)) 0deg)`,
  }
  const legend = [
    { label: 'Prompt', value: data.context.promptTokens, color: 'bg-cyan-400' },
    { label: 'Completion', value: data.context.completionTokens, color: 'bg-blue-500' },
    { label: 'Reasoning', value: data.context.reasoningTokens, color: 'bg-orange-400' },
    { label: 'Other', value: data.context.otherTokens, color: 'bg-neutral-500' },
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex size-36 items-center justify-center rounded-full p-3" style={gaugeStyle}>
        <div className="flex size-full flex-col items-center justify-center rounded-full border bg-card text-center">
          <div className="text-2xl font-semibold tabular-nums">{formatTokens(data.context.usedTokens)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            / {formatTokens(data.context.limitTokens)} tokens
          </div>
        </div>
      </div>
      <div className="mt-3 text-xl font-semibold tabular-nums">{formatPercent(percent)}</div>
      <div className="mt-4 w-full space-y-2">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={cn('size-2.5 rounded-full', item.color)} />
              {item.label}
            </span>
            <span className="font-mono">{formatInteger(item.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex w-full items-center justify-between border-t pt-3">
        <span className="text-muted-foreground">合计</span>
        <span className="font-mono font-semibold">
          {formatInteger(data.context.totalTokens)} / {formatInteger(data.context.limitTokens)}
        </span>
      </div>
    </div>
  )
}

function MetricTile({
  label,
  value,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  tone?: 'default' | 'good' | 'warn'
  className?: string
}) {
  return (
    <div className={cn('rounded-md border bg-muted/10 p-2.5', className)}>
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'truncate text-lg font-semibold tabular-nums',
          tone === 'good' && 'text-emerald-500',
          tone === 'warn' && 'text-orange-500',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function StrategyPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/10 p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-semibold">{value}</div>
    </div>
  )
}

function BucketTile({ label, bucket }: { label: string; bucket: UsageBucket }) {
  return (
    <div className="rounded-md border bg-muted/10 p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{formatTokens(bucket.totalTokens)}</div>
      <div className="text-[11px] text-muted-foreground">{bucket.runs} 次请求</div>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/10 px-3 py-4 text-center text-muted-foreground">
      {text}
    </div>
  )
}

function formatTokens(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value < 1000) return formatInteger(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`
  return `${(value / 1_000_000).toFixed(2)}M`
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}小时${minutes}分`
  if (minutes > 0) return `${minutes}分${seconds}秒`
  return `${seconds}秒`
}

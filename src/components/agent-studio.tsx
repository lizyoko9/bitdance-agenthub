'use client'

import {
  ArrowLeft,
  BarChart3,
  Bot,
  BookOpenText,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  Code2,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  PenLine,
  PlugZap,
  Plus,
  RotateCcw,
  ScanSearch,
  Search,
  ServerCog,
  ShieldAlert,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AgentCreateWizard } from '@/components/agent-create-wizard'
import { SkillFormDialog } from '@/components/skill-form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type { SkillRow } from '@/db/schema'
import { createAgent, fetchSkills } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  AGENT_BUILDER_PROVIDER_DEFAULTS,
  AGENT_TOOL_META,
  AGENT_TOOL_PRESETS,
  AVAILABLE_AGENT_TOOLS,
  CLAUDE_CODE_DEFAULT_MODEL,
  CODEX_DEFAULT_MODEL,
  DEFAULT_CUSTOM_AGENT_TOOLS,
  DEFAULT_CUSTOM_SYSTEM_PROMPT,
  type AgentBuilderAdapter,
  type AgentBuilderProvider,
  type AgentConfigDraft,
  type AgentToolName,
} from '@/shared/agent-builder-config'
import {
  AGENT_TEMPLATE_CATEGORIES,
  AGENT_TEMPLATES,
  createAgentDraftFromTemplate,
  type AgentTemplate,
  type AgentTemplateBadge,
  type AgentTemplateCategoryId,
  type AgentTemplateDependency,
  type AgentTemplateRiskLevel,
} from '@/shared/agent-templates'
import { validateCodexBaseUrl } from '@/shared/codex-compat'
import {
  validateOpenAICompatibleApiKey,
  validateOpenAICompatibleBaseUrl,
} from '@/shared/openai-compatible'
import { useAppStore } from '@/stores/app-store'

type StudioView = 'market' | 'configure'
type ConfigOrigin = 'template' | 'scratch'
type CategoryFilter = 'all' | AgentTemplateCategoryId

const ADAPTER_LABELS: Record<AgentBuilderAdapter, string> = {
  custom: 'Custom Agent SDK',
  'claude-code': 'Claude Code SDK',
  codex: 'Codex SDK',
}

const ADAPTER_OPTIONS: { value: AgentBuilderAdapter; label: string; desc: string }[] = [
  {
    value: 'custom',
    label: 'Custom Agent SDK',
    desc: 'DeepSeek / OpenAI / 火山方舟 / 自定义 OpenAI 兼容 API，可自选工具集。',
  },
  {
    value: 'claude-code',
    label: 'Claude Code SDK',
    desc: '@anthropic-ai/claude-agent-sdk，自带 Bash / Read / Write / Edit / Grep 等全套工具。',
  },
  {
    value: 'codex',
    label: 'Codex SDK',
    desc: '@openai/codex-sdk，支持本地读写、命令执行与线程续接；需 Codex/Responses 兼容后端。',
  },
]

const CATEGORY_META: Record<
  AgentTemplateCategoryId,
  { label: string; icon: React.ReactNode; chipClass: string }
> = {
  coding: { label: '研发', icon: <Code2 className="size-3.5" />, chipClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  product: { label: '产品', icon: <ClipboardList className="size-3.5" />, chipClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
  data: { label: '数据', icon: <BarChart3 className="size-3.5" />, chipClass: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300' },
  knowledge: { label: '知识库', icon: <BookOpenText className="size-3.5" />, chipClass: 'bg-teal-500/12 text-teal-700 dark:text-teal-300' },
  operations: { label: '运维', icon: <ServerCog className="size-3.5" />, chipClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300' },
  review: { label: '审查', icon: <ScanSearch className="size-3.5" />, chipClass: 'bg-violet-500/12 text-violet-700 dark:text-violet-300' },
  writing: { label: '写作', icon: <PenLine className="size-3.5" />, chipClass: 'bg-rose-500/12 text-rose-700 dark:text-rose-300' },
}

const BADGE_META: Record<AgentTemplateBadge, { label: string; className: string }> = {
  recommended: { label: '推荐', className: 'bg-primary/10 text-primary' },
  hot: { label: '热门', className: 'bg-orange-500/15 text-orange-600 dark:text-orange-300' },
  new: { label: '新', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' },
}

interface AgentFormState {
  name: string
  avatar: string
  description: string
  capabilities: string[]
  systemPrompt: string
  adapterName: AgentBuilderAdapter
  modelProvider: AgentBuilderProvider
  modelId: string
  toolNames: AgentToolName[]
  skillIds: string[]
  supportsVision: boolean
  apiKey: string
  apiBaseUrl: string
}

function draftToForm(draft: AgentConfigDraft): AgentFormState {
  return {
    name: draft.name,
    avatar: draft.avatar,
    description: draft.description,
    capabilities: [...draft.capabilities],
    systemPrompt: draft.systemPrompt,
    adapterName: draft.adapterName,
    modelProvider: draft.modelProvider ?? 'deepseek',
    modelId: draft.modelId ?? '',
    toolNames: [...draft.toolNames],
    skillIds: [...draft.skillIds],
    supportsVision: draft.supportsVision,
    apiKey: '',
    apiBaseUrl: '',
  }
}

function createScratchForm(): AgentFormState {
  return {
    name: '',
    avatar: '',
    description: '',
    capabilities: [],
    systemPrompt: DEFAULT_CUSTOM_SYSTEM_PROMPT,
    adapterName: 'custom',
    modelProvider: 'deepseek',
    modelId: AGENT_BUILDER_PROVIDER_DEFAULTS.deepseek.defaultModel,
    toolNames: [...DEFAULT_CUSTOM_AGENT_TOOLS],
    skillIds: [],
    supportsVision: true,
    apiKey: '',
    apiBaseUrl: '',
  }
}

const isSdkAdapter = (adapter: AgentBuilderAdapter) =>
  adapter === 'claude-code' || adapter === 'codex'

export function AgentStudio() {
  const router = useRouter()
  const upsertAgent = useAppStore((s) => s.upsertAgent)

  const [view, setView] = useState<StudioView>('market')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [origin, setOrigin] = useState<ConfigOrigin>('scratch')
  const [sourceTemplate, setSourceTemplate] = useState<AgentTemplate | null>(null)
  const [form, setForm] = useState<AgentFormState>(() => createScratchForm())
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchSkills()
      .then((rows) => {
        if (active) setSkills(rows)
      })
      .catch(() => {
        // Skills 是增强能力，拉取失败时静默退化为「无可选 Skill」，不阻断创建。
      })
    return () => {
      active = false
    }
  }, [])

  const refreshSkills = () => fetchSkills().then(setSkills).catch(() => {})

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return AGENT_TEMPLATES.filter((template) => {
      if (category !== 'all' && template.category !== category) return false
      if (!normalizedQuery) return true
      const haystack = [
        template.name,
        template.description,
        ...template.tags,
        ...template.capabilities,
        ...template.scenarios,
      ]
        .join('\n')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [category, query])

  const openTemplate = (template: AgentTemplate) => {
    setOrigin('template')
    setSourceTemplate(template)
    setForm(draftToForm(createAgentDraftFromTemplate(template)))
    setError(null)
    setView('configure')
  }

  const openScratch = () => {
    setOrigin('scratch')
    setSourceTemplate(null)
    setForm(createScratchForm())
    setError(null)
    setView('configure')
  }

  const resetForm = () => {
    setForm(
      sourceTemplate
        ? draftToForm(createAgentDraftFromTemplate(sourceTemplate))
        : createScratchForm(),
    )
    setError(null)
  }

  const backToMarket = () => {
    setError(null)
    setView('market')
  }

  const saveForm = async (state: AgentFormState) => {
    if (saving) return
    const name = state.name.trim()
    const description = state.description.trim()
    const systemPrompt = state.systemPrompt.trim()
    const apiKey = state.apiKey.trim()
    const apiBaseUrl = state.apiBaseUrl.trim()
    const sdk = isSdkAdapter(state.adapterName)

    if (!name) return setError('Agent 名称不能为空。')
    if (!description) return setError('Agent 描述不能为空。')
    if (!systemPrompt) return setError('System Prompt 不能为空。')
    if (state.adapterName === 'custom' && !state.modelId.trim()) {
      return setError('Custom Agent 必须填写 Model ID。')
    }
    if (state.adapterName === 'codex') {
      const baseUrlError = validateCodexBaseUrl(apiBaseUrl || null)
      if (baseUrlError) return setError(baseUrlError)
    }
    if (state.adapterName === 'custom') {
      const baseUrlError = validateOpenAICompatibleBaseUrl(state.modelProvider, apiBaseUrl || null)
      if (baseUrlError) return setError(baseUrlError)
      const apiKeyError = validateOpenAICompatibleApiKey(state.modelProvider, apiKey || null)
      if (apiKeyError) return setError(apiKeyError)
    }

    setSaving(true)
    setError(null)
    try {
      const created = await createAgent({
        name,
        avatar: state.avatar,
        description,
        capabilities: state.capabilities,
        systemPrompt,
        adapterName: state.adapterName,
        modelProvider: sdk ? undefined : state.modelProvider,
        modelId: state.modelId.trim() || undefined,
        // SDK adapter 的普通工具由 service 清空，仅保留 opt-in 额外能力；这里整份传，service 过滤。
        toolNames: state.toolNames,
        skillIds: state.skillIds,
        supportsVision: state.supportsVision,
        apiKey: apiKey || undefined,
        apiBaseUrl: apiBaseUrl || undefined,
      })
      upsertAgent(created)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="返回工作台"
          title="返回工作台"
          onClick={() => router.push('/')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold">Agent Studio</h1>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {view === 'market'
                ? '挑一个专业模板开始，或从零搭建你自己的 Agent'
                : origin === 'template' && sourceTemplate
                  ? `配置 · 来自模板「${sourceTemplate.name}」`
                  : '配置 · 从零创建'}
            </span>
          </div>
        </div>
        {view === 'configure' && (
          <Button variant="outline" onClick={backToMarket}>
            <ArrowLeft className="size-4" />
            返回模板市场
          </Button>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {view === 'market' ? (
          <TemplateMarket
            query={query}
            category={category}
            templates={filteredTemplates}
            onQueryChange={setQuery}
            onCategoryChange={setCategory}
            onOpenTemplate={openTemplate}
            onOpenScratch={openScratch}
          />
        ) : (
          <ConfigureScreen
            origin={origin}
            sourceTemplate={sourceTemplate}
            form={form}
            skills={skills}
            onFormChange={setForm}
            onRefreshSkills={refreshSkills}
            onReset={resetForm}
            onSave={saveForm}
            saving={saving}
            error={error}
          />
        )}
      </main>
    </div>
  )
}

function TemplateMarket({
  query,
  category,
  templates,
  onQueryChange,
  onCategoryChange,
  onOpenTemplate,
  onOpenScratch,
}: {
  query: string
  category: CategoryFilter
  templates: readonly AgentTemplate[]
  onQueryChange: (query: string) => void
  onCategoryChange: (category: CategoryFilter) => void
  onOpenTemplate: (template: AgentTemplate) => void
  onOpenScratch: () => void
}) {
  const counts = useMemo(() => {
    const map = new Map<AgentTemplateCategoryId, number>()
    for (const template of AGENT_TEMPLATES) {
      map.set(template.category, (map.get(template.category) ?? 0) + 1)
    }
    return map
  }, [])
  const featured = useMemo(() => AGENT_TEMPLATES.filter((template) => template.featured), [])
  const isCurated = category === 'all' && !query.trim()

  return (
    <div className="flex h-full">
      <CategoryRail
        category={category}
        counts={counts}
        total={AGENT_TEMPLATES.length}
        onCategoryChange={onCategoryChange}
        onOpenScratch={onOpenScratch}
      />
      <ScrollArea className="h-full flex-1">
        <div className="flex flex-col gap-6 p-4 lg:p-6">
          <MarketHero query={query} onQueryChange={onQueryChange} />
          <MobileCategoryBar
            category={category}
            onCategoryChange={onCategoryChange}
            onOpenScratch={onOpenScratch}
          />

          {isCurated ? (
            <>
              <FeaturedSection featured={featured} onOpenTemplate={onOpenTemplate} />
              {AGENT_TEMPLATE_CATEGORIES.map((cat) => {
                const items = AGENT_TEMPLATES.filter((template) => template.category === cat.id)
                if (items.length === 0) return null
                return (
                  <CategorySection
                    key={cat.id}
                    categoryId={cat.id}
                    label={cat.label}
                    items={items}
                    onOpenTemplate={onOpenTemplate}
                  />
                )
              })}
            </>
          ) : (
            <section className="space-y-3">
              <div className="text-xs text-muted-foreground">{templates.length} 个匹配模板</div>
              {templates.length === 0 ? (
                <div className="rounded-md border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                  没有匹配的模板，换个关键词或从零创建。
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-3">
                  {templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onOpen={() => onOpenTemplate(template)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function CategoryRail({
  category,
  counts,
  total,
  onCategoryChange,
  onOpenScratch,
}: {
  category: CategoryFilter
  counts: Map<AgentTemplateCategoryId, number>
  total: number
  onCategoryChange: (category: CategoryFilter) => void
  onOpenScratch: () => void
}) {
  return (
    <aside className="hidden w-52 shrink-0 flex-col gap-3 border-r bg-card/40 p-3 md:flex">
      <Button className="w-full justify-start" onClick={onOpenScratch}>
        <Plus className="size-4" />
        从零创建
      </Button>
      <div className="space-y-0.5">
        <div className="px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          模板分类
        </div>
        <RailItem
          label="全部"
          icon={<Boxes className="size-4" />}
          count={total}
          active={category === 'all'}
          onClick={() => onCategoryChange('all')}
        />
        {AGENT_TEMPLATE_CATEGORIES.map((cat) => (
          <RailItem
            key={cat.id}
            label={cat.label}
            icon={CATEGORY_META[cat.id].icon}
            count={counts.get(cat.id) ?? 0}
            active={category === cat.id}
            onClick={() => onCategoryChange(cat.id)}
          />
        ))}
      </div>
    </aside>
  )
}

function RailItem({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition',
        active
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className={cn('shrink-0', active && 'text-primary')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span
        className={cn(
          'shrink-0 rounded px-1.5 text-[10px] tabular-nums',
          active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function MobileCategoryBar({
  category,
  onCategoryChange,
  onOpenScratch,
}: {
  category: CategoryFilter
  onCategoryChange: (category: CategoryFilter) => void
  onOpenScratch: () => void
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:hidden">
      <button
        type="button"
        onClick={onOpenScratch}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
      >
        <Plus className="size-3.5" />
        从零创建
      </button>
      <MobileChip label="全部" active={category === 'all'} onClick={() => onCategoryChange('all')} />
      {AGENT_TEMPLATE_CATEGORIES.map((cat) => (
        <MobileChip
          key={cat.id}
          label={cat.label}
          active={category === cat.id}
          onClick={() => onCategoryChange(cat.id)}
        />
      ))}
    </div>
  )
}

function MobileChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-md border px-2.5 text-xs transition',
        active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}

function MarketHero({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-5 lg:p-6">
      <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <Sparkles className="size-4" />
          Agent 模板市场
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">组装你的专业 Agent</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
          从精选模板快速开始，或从零搭建。选定后再配置模型、工具与专业能力依赖。
        </p>

        <div className="relative mt-4 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索模板、场景、能力…"
            className="h-11 rounded-lg pl-9 pr-9 text-sm shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="清除搜索"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <MarketStat icon={<Boxes className="size-3.5" />} value={`${AGENT_TEMPLATES.length}`} label="专业模板" />
          <MarketStat
            icon={<ScanSearch className="size-3.5" />}
            value={`${AGENT_TEMPLATE_CATEGORIES.length}`}
            label="覆盖领域"
          />
          <MarketStat icon={<Cpu className="size-3.5" />} value="Claude · Codex · DeepSeek" label="多模型适配" />
        </div>
      </div>
    </section>
  )
}

function MarketStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-primary">{icon}</span>
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  )
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode
  title: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold">{title}</h3>
      {typeof count === 'number' && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  )
}

function FeaturedSection({
  featured,
  onOpenTemplate,
}: {
  featured: readonly AgentTemplate[]
  onOpenTemplate: (template: AgentTemplate) => void
}) {
  if (featured.length === 0) return null
  const [hero, ...rest] = featured
  return (
    <section className="space-y-3">
      <SectionHeader icon={<Star className="size-4 text-amber-500" />} title="精选推荐" />
      <div className="grid gap-3 lg:auto-rows-fr lg:grid-cols-3">
        <SpotlightCard template={hero} onOpen={() => onOpenTemplate(hero)} />
        {rest.slice(0, 2).map((template) => (
          <TemplateCard key={template.id} template={template} onOpen={() => onOpenTemplate(template)} />
        ))}
      </div>
    </section>
  )
}

function CategorySection({
  categoryId,
  label,
  items,
  onOpenTemplate,
}: {
  categoryId: AgentTemplateCategoryId
  label: string
  items: readonly AgentTemplate[]
  onOpenTemplate: (template: AgentTemplate) => void
}) {
  const meta = CATEGORY_META[categoryId]
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={
          <span className={cn('flex size-5 items-center justify-center rounded', meta.chipClass)}>
            {meta.icon}
          </span>
        }
        title={label}
        count={items.length}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-3">
        {items.map((template) => (
          <TemplateCard key={template.id} template={template} onOpen={() => onOpenTemplate(template)} />
        ))}
      </div>
    </section>
  )
}

function SpotlightCard({ template, onOpen }: { template: AgentTemplate; onOpen: () => void }) {
  const categoryMeta = CATEGORY_META[template.category]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-xl border bg-gradient-to-br from-primary/[0.06] to-card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md lg:col-span-2 lg:row-span-2"
    >
      <div className="flex items-start gap-4">
        <span className={cn('flex size-14 shrink-0 items-center justify-center rounded-xl text-3xl', categoryMeta.chipClass)}>
          {template.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{template.name}</h3>
            {template.badge && <CuratedBadge badge={template.badge} />}
            <RiskBadge level={template.riskLevel} />
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{template.description}</p>
        </div>
      </div>

      <div className="mt-4">
        <CapabilityBadges template={template} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {template.scenarios.slice(0, 4).map((scenario) => (
          <span
            key={scenario}
            className="rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground"
          >
            {scenario}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-5 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <Cpu className="size-3.5 shrink-0" />
          <span className="truncate">
            {AGENT_BUILDER_PROVIDER_DEFAULTS[template.recommendedProvider].label}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition group-hover:gap-2">
          使用此模板
          <ChevronRight className="size-3.5" />
        </span>
      </div>
    </button>
  )
}

function TemplateCard({ template, onOpen }: { template: AgentTemplate; onOpen: () => void }) {
  const categoryMeta = CATEGORY_META[template.category]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex min-h-[210px] flex-col overflow-hidden rounded-lg border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md text-2xl', categoryMeta.chipClass)}>
          {template.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{template.name}</h3>
            {template.badge && <CuratedBadge badge={template.badge} />}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                categoryMeta.chipClass,
              )}
            >
              {categoryMeta.icon}
              {categoryMeta.label}
            </span>
            <RiskBadge level={template.riskLevel} />
          </div>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {template.description}
      </p>

      <div className="mt-2.5">
        <CapabilityBadges template={template} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <Cpu className="size-3.5 shrink-0" />
          <span className="truncate">
            {AGENT_BUILDER_PROVIDER_DEFAULTS[template.recommendedProvider].label}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
          使用
          <ChevronRight className="size-3.5" />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 translate-y-full border-t bg-card/95 p-3 backdrop-blur transition-transform duration-200 group-hover:translate-y-0">
        <div className="text-[10px] font-medium text-muted-foreground">适用场景</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {template.scenarios.slice(0, 4).map((scenario) => (
            <span key={scenario} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {scenario}
            </span>
          ))}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
          使用此模板
          <ChevronRight className="size-3.5" />
        </div>
      </div>
    </button>
  )
}

function CapabilityBadges({ template }: { template: AgentTemplate }) {
  const items = [
    { key: 'skills', icon: <Sparkles className="size-3" />, label: 'Skills', count: template.skillHighlights.length },
    { key: 'rag', icon: <Database className="size-3" />, label: 'RAG', count: template.knowledgeNeeds.length },
    { key: 'mcp', icon: <PlugZap className="size-3" />, label: 'MCP', count: template.mcpNeeds.length },
    { key: 'tools', icon: <Wrench className="size-3" />, label: '工具', count: template.toolNames.length },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {item.icon}
          {item.label}
          <span className="tabular-nums">{item.count}</span>
        </span>
      ))}
    </div>
  )
}

function CuratedBadge({ badge }: { badge: AgentTemplateBadge }) {
  const meta = BADGE_META[badge]
  return (
    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', meta.className)}>
      {meta.label}
    </span>
  )
}

function ConfigureScreen({
  origin,
  sourceTemplate,
  form,
  skills,
  onFormChange,
  onRefreshSkills,
  onReset,
  onSave,
  saving,
  error,
}: {
  origin: ConfigOrigin
  sourceTemplate: AgentTemplate | null
  form: AgentFormState
  skills: SkillRow[]
  onFormChange: (form: AgentFormState) => void
  onRefreshSkills: () => void
  onReset: () => void
  onSave: (form: AgentFormState) => void
  saving: boolean
  error: string | null
}) {
  const [wizardOpen, setWizardOpen] = useState(false)

  if (wizardOpen) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 lg:p-6">
          <section className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" />
              用对话生成草稿
            </div>
            <AgentCreateWizard
              onBack={() => setWizardOpen(false)}
              onCancel={() => setWizardOpen(false)}
              onEditDetails={(draft) => {
                onFormChange(draftToForm(draft))
                setWizardOpen(false)
              }}
              onCreate={async (draft) => {
                const next = draftToForm(draft)
                onFormChange(next)
                setWizardOpen(false)
                await onSave(next)
              }}
              creating={saving}
            />
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
        <AgentConfigForm
          form={form}
          skills={skills}
          onChange={onFormChange}
          onRefreshSkills={onRefreshSkills}
          origin={origin}
          sourceTemplate={sourceTemplate}
          onOpenWizard={origin === 'scratch' ? () => setWizardOpen(true) : undefined}
        />
        <AgentPreviewCard
          form={form}
          skills={skills}
          origin={origin}
          sourceTemplate={sourceTemplate}
          onReset={onReset}
          onCreate={() => onSave(form)}
          saving={saving}
          error={error}
        />
      </div>
    </div>
  )
}

function AgentConfigForm({
  form,
  skills,
  onChange,
  onRefreshSkills,
  origin,
  sourceTemplate,
  onOpenWizard,
}: {
  form: AgentFormState
  skills: SkillRow[]
  onChange: (form: AgentFormState) => void
  onRefreshSkills: () => void
  origin: ConfigOrigin
  sourceTemplate: AgentTemplate | null
  onOpenWizard?: () => void
}) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [skillFormOpen, setSkillFormOpen] = useState(false)

  const patch = (next: Partial<AgentFormState>) => onChange({ ...form, ...next })

  const toggleSkill = (skillId: string) => {
    patch({
      skillIds: form.skillIds.includes(skillId)
        ? form.skillIds.filter((id) => id !== skillId)
        : [...form.skillIds, skillId],
    })
  }

  const handleAdapter = (adapter: AgentBuilderAdapter) => {
    if (adapter === 'claude-code') {
      patch({ adapterName: adapter, modelId: CLAUDE_CODE_DEFAULT_MODEL })
    } else if (adapter === 'codex') {
      patch({ adapterName: adapter, modelId: CODEX_DEFAULT_MODEL })
    } else {
      patch({
        adapterName: adapter,
        modelId: AGENT_BUILDER_PROVIDER_DEFAULTS[form.modelProvider].defaultModel,
        toolNames: form.toolNames.length ? form.toolNames : [...DEFAULT_CUSTOM_AGENT_TOOLS],
      })
    }
  }

  const setToolNames = (toolNames: AgentToolName[]) => patch({ toolNames })

  const toggleTool = (toolName: AgentToolName) => {
    setToolNames(
      form.toolNames.includes(toolName)
        ? form.toolNames.filter((name) => name !== toolName)
        : [...form.toolNames, toolName],
    )
  }

  const sdk = isSdkAdapter(form.adapterName)
  const showBaseUrl = sdk || (form.adapterName === 'custom' && form.modelProvider === 'openai-compatible')
  const keyAsToken = form.adapterName === 'claude-code' && form.apiBaseUrl.trim().length > 0

  return (
    <div className="space-y-4">
      {origin === 'template' && sourceTemplate && (
        <section className="rounded-md border bg-card p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xl">
              {sourceTemplate.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                来自模板「{sourceTemplate.name}」
                <RiskBadge level={sourceTemplate.riskLevel} />
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                下面的修改只影响即将创建的新 Agent，不改动模板本身。
              </div>
            </div>
          </div>
          {sourceTemplate.scenarios.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {sourceTemplate.scenarios.map((scenario) => (
                <span
                  key={scenario}
                  className="rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {scenario}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <FormSection title="基础信息">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="名称" required>
            <Input
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="例：TestBot"
              className="text-sm"
            />
          </Field>
          <Field label="能力标签">
            <Input
              value={form.capabilities.join(', ')}
              onChange={(event) =>
                patch({
                  capabilities: event.target.value
                    .split(/[,，\s]+/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              placeholder="testing, react, vitest"
              className="text-sm"
            />
          </Field>
        </div>
        <Field label="描述" required>
          <Input
            value={form.description}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="一句话讲清楚它能做什么"
            className="text-sm"
          />
        </Field>
      </FormSection>

      <FormSection title="模型与适配器">
        <div className="flex flex-col gap-1.5">
          {ADAPTER_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition hover:border-foreground/30',
                form.adapterName === option.value && 'border-primary bg-primary/5',
              )}
            >
              <input
                type="radio"
                name="studio-adapter"
                checked={form.adapterName === option.value}
                onChange={() => handleAdapter(option.value)}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                  {option.desc}
                </span>
              </span>
            </label>
          ))}
        </div>

        {form.adapterName === 'custom' ? (
          <div className="grid gap-3 md:grid-cols-[200px_minmax(0,1fr)]">
            <Field label="Provider">
              <select
                value={form.modelProvider}
                onChange={(event) => {
                  const provider = event.target.value as AgentBuilderProvider
                  patch({
                    modelProvider: provider,
                    modelId: AGENT_BUILDER_PROVIDER_DEFAULTS[provider].defaultModel,
                  })
                }}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-foreground/30"
              >
                {(Object.keys(AGENT_BUILDER_PROVIDER_DEFAULTS) as AgentBuilderProvider[]).map(
                  (provider) => (
                    <option key={provider} value={provider}>
                      {AGENT_BUILDER_PROVIDER_DEFAULTS[provider].label}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Model ID" required>
              <Input
                value={form.modelId}
                onChange={(event) => patch({ modelId: event.target.value })}
                placeholder="model id"
                className="font-mono text-xs"
              />
            </Field>
          </div>
        ) : (
          <Field label="Model ID">
            <Input
              value={form.modelId}
              onChange={(event) => patch({ modelId: event.target.value })}
              placeholder={form.adapterName === 'claude-code' ? CLAUDE_CODE_DEFAULT_MODEL : CODEX_DEFAULT_MODEL}
              className="font-mono text-xs"
            />
            <FieldHint>
              {form.adapterName === 'claude-code'
                ? 'Claude 模型 id，例 claude-opus-4-7 / claude-sonnet-4-6。留空走 SDK 默认。'
                : 'Codex 模型 id，例 gpt-5-codex。留空走 SDK 默认。'}
            </FieldHint>
          </Field>
        )}

        {showBaseUrl && (
          <Field
            label="Base URL"
            required={form.adapterName === 'custom' && form.modelProvider === 'openai-compatible'}
          >
            <Input
              value={form.apiBaseUrl}
              onChange={(event) => patch({ apiBaseUrl: event.target.value })}
              placeholder={
                form.adapterName === 'claude-code'
                  ? 'https://api.anthropic.com（默认）'
                  : form.adapterName === 'codex'
                    ? 'https://api.openai.com/v1（默认，需支持 /responses）'
                    : 'https://dashscope.aliyuncs.com/compatible-mode/v1'
              }
              className="font-mono text-xs"
            />
            <FieldHint>
              {form.adapterName === 'claude-code'
                ? '指向第三方 Claude API 兼容网关；留空走 Anthropic 官方 endpoint。'
                : form.adapterName === 'codex'
                  ? '必须指向 Codex/Responses 兼容 endpoint；DeepSeek 等 Chat Completions 接口请用 Custom adapter。'
                  : '必须指向 OpenAI Chat Completions 兼容 endpoint（通义 compatible-mode、智谱 / OpenRouter 等）。'}
            </FieldHint>
          </Field>
        )}

        <Field label={keyAsToken ? 'Auth Token' : 'API Key'}>
          <div className="flex gap-2">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(event) => patch({ apiKey: event.target.value })}
              placeholder="留空则回退到全局设置 / 环境变量"
              className="flex-1 font-mono text-xs"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowApiKey((value) => !value)}
              aria-label={showApiKey ? '隐藏' : '显示'}
              title={showApiKey ? '隐藏' : '显示'}
            >
              {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          <FieldHint>
            {form.adapterName === 'custom' && form.modelProvider === 'openai-compatible'
              ? 'OpenAI-compatible provider 必须为该 Agent 单独填写 API Key，不会使用全局 key。'
              : '填写后该 Agent 优先用此 key；留空则按设置面板 / 环境变量的三层优先级回退。'}
          </FieldHint>
        </Field>

        <label className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition hover:border-foreground/30">
          <input
            type="checkbox"
            checked={form.supportsVision}
            onChange={(event) => patch({ supportsVision: event.target.checked })}
            className="mt-0.5 accent-primary"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium">该模型支持视觉（多模态）</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
              勾选后发图片时会按模型能力传入。模型不支持会被 API 拒绝，请确认 modelId 真的支持视觉。
            </span>
          </span>
        </label>
      </FormSection>

      <FormSection title="工具权限">
        {sdk ? (
          <div className="space-y-2">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {form.adapterName === 'claude-code'
                ? 'Claude Code agent 使用 SDK 内置工具集（Bash / Read / Write / Edit / Grep / Glob / WebFetch / Task 等）。审批 / 沙箱 / 黑名单仍由 AgentHub 接管。'
                : 'Codex agent 使用 Codex SDK 内置的本地命令、文件修改与计划事件。Review 模式只读沙箱，Auto 模式允许 workspace-write；运行时使用 AgentHub 隔离配置。'}
            </div>
            <label
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition hover:border-foreground/30',
                form.toolNames.includes('install_skill') && 'border-primary bg-primary/5',
              )}
            >
              <input
                type="checkbox"
                checked={form.toolNames.includes('install_skill')}
                onChange={() => toggleTool('install_skill')}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{AGENT_TOOL_META.install_skill.label}（额外能力）</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                  {AGENT_TOOL_META.install_skill.desc}
                </span>
              </span>
            </label>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {AGENT_TOOL_PRESETS.map((preset) => {
                const active =
                  form.toolNames.length === preset.tools.length &&
                  preset.tools.every((toolName) => form.toolNames.includes(toolName))
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setToolNames([...preset.tools])}
                    className={cn(
                      'rounded-md border px-2.5 py-2 text-left transition hover:border-foreground/30',
                      active ? 'border-primary bg-primary/5' : '',
                    )}
                  >
                    <div className="text-xs font-medium">{preset.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{preset.desc}</div>
                  </button>
                )
              })}
            </div>
            <div className="space-y-1.5">
              {AVAILABLE_AGENT_TOOLS.map((toolName) => {
                const meta = AGENT_TOOL_META[toolName]
                return (
                  <label
                    key={toolName}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition hover:border-foreground/30',
                      form.toolNames.includes(toolName) && 'border-primary bg-primary/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.toolNames.includes(toolName)}
                      onChange={() => toggleTool(toolName)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-medium">{meta.label}</span>
                        <code className="font-mono text-[10px] text-muted-foreground">{toolName}</code>
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                        {meta.desc}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </>
        )}
      </FormSection>

      <FormSection
        title="专业技能 (Skills)"
        action={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{form.skillIds.length} 已选</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setSkillFormOpen(true)}>
              <Plus className="size-3.5" />
              新建
            </Button>
          </div>
        }
      >
        {skills.length === 0 ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            暂无可选 Skill。Skill 是注入的工作方法，不授予额外工具权限。
          </div>
        ) : (
          <div className="space-y-1.5">
            {skills.map((skill) => {
              const checked = form.skillIds.includes(skill.id)
              const missingTools = skill.requiredToolNames.filter(
                (toolName) => !form.toolNames.includes(toolName as AgentToolName),
              )
              const showHint = checked && form.adapterName === 'custom' && missingTools.length > 0
              // 公共 skill 自动挂给所有 Agent，不占此处选择位（去 Skills 市场取消公共）。
              if (skill.isGlobalDefault) {
                return (
                  <div
                    key={skill.id}
                    className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2"
                  >
                    <Globe className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">{skill.name}</span>
                        <span className="rounded bg-emerald-500/12 px-1 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
                          公共 · 已默认挂载
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                        {skill.description}
                      </span>
                    </span>
                  </div>
                )
              }
              return (
                <label
                  key={skill.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition hover:border-foreground/30',
                    checked && 'border-primary bg-primary/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSkill(skill.id)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{skill.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                      {skill.description}
                    </span>
                    {showHint && (
                      <span className="mt-1 block text-[10px] leading-4 text-amber-600 dark:text-amber-400">
                        建议同时启用工具：{missingTools.join(' / ')}（Skill 只给方法，不会自动授予工具）
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </FormSection>

      <FormSection
        title="System Prompt"
        action={
          onOpenWizard && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenWizard}>
              <Sparkles className="size-3.5" />
              用对话生成草稿
            </Button>
          )
        }
      >
        <Textarea
          value={form.systemPrompt}
          onChange={(event) => patch({ systemPrompt: event.target.value })}
          className="min-h-[240px] font-mono text-xs leading-5"
        />
      </FormSection>

      <SkillFormDialog
        open={skillFormOpen}
        onOpenChange={setSkillFormOpen}
        onSaved={(skill) => {
          onRefreshSkills()
          if (!form.skillIds.includes(skill.id)) {
            patch({ skillIds: [...form.skillIds, skill.id] })
          }
        }}
      />
    </div>
  )
}

function AgentPreviewCard({
  form,
  skills,
  origin,
  sourceTemplate,
  onReset,
  onCreate,
  saving,
  error,
}: {
  form: AgentFormState
  skills: SkillRow[]
  origin: ConfigOrigin
  sourceTemplate: AgentTemplate | null
  onReset: () => void
  onCreate: () => void
  saving: boolean
  error: string | null
}) {
  const sdk = isSdkAdapter(form.adapterName)
  const selectedSkills = skills.filter((skill) => form.skillIds.includes(skill.id))
  const modelLine = sdk
    ? `${ADAPTER_LABELS[form.adapterName]} / ${form.modelId.trim() || 'SDK 默认'}`
    : `${AGENT_BUILDER_PROVIDER_DEFAULTS[form.modelProvider].label} / ${form.modelId.trim() || '未填写'}`

  return (
    <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
      <section className="rounded-md border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-2xl">
            {form.avatar || <Bot className="size-5 text-muted-foreground" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">
                {form.name.trim() || '未命名 Agent'}
              </h3>
              {origin === 'template' && sourceTemplate && (
                <RiskBadge level={sourceTemplate.riskLevel} />
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {form.description.trim() || '还没有描述'}
            </p>
          </div>
        </div>

        {form.capabilities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {form.capabilities.map((capability) => (
              <span
                key={capability}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {capability}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-1.5 border-t pt-3 text-[11px]">
          <PreviewLine icon={<Cpu className="size-3.5" />} label="模型" value={modelLine} />
          <PreviewLine
            icon={<Wrench className="size-3.5" />}
            label="工具"
            value={sdk ? 'SDK 内置工具集' : `${form.toolNames.length} 个已启用`}
          />
          <PreviewLine
            icon={<Eye className="size-3.5" />}
            label="视觉"
            value={form.supportsVision ? '开启' : '关闭'}
          />
          <PreviewLine
            icon={<Sparkles className="size-3.5" />}
            label="Skills"
            value={selectedSkills.length > 0 ? `${selectedSkills.length} 个已选` : '未选'}
          />
          {form.apiBaseUrl.trim() && (
            <PreviewLine icon={<Link2 className="size-3.5" />} label="Base URL" value="已自定义" />
          )}
          <PreviewLine
            icon={<KeyRound className="size-3.5" />}
            label="API Key"
            value={form.apiKey.trim() ? '已填写' : '回退全局 / 环境变量'}
          />
        </div>

        {selectedSkills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 border-t pt-3">
            {selectedSkills.map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                <Sparkles className="size-3" />
                {skill.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {origin === 'template' && sourceTemplate && (
        <section className="space-y-2 rounded-md border bg-card p-3">
          <div className="text-xs font-medium">模板专业能力（预览）</div>
          <DependencyGroup
            icon={<Sparkles className="size-3.5" />}
            title="Skills"
            items={sourceTemplate.skillHighlights}
          />
          <DependencyGroup
            icon={<Database className="size-3.5" />}
            title="RAG 知识库"
            items={sourceTemplate.knowledgeNeeds}
          />
          <DependencyGroup
            icon={<PlugZap className="size-3.5" />}
            title="MCP 连接"
            items={sourceTemplate.mcpNeeds}
          />
          <div className="flex items-start gap-1.5 rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            {sourceTemplate.riskSummary}
          </div>
          <div className="text-[10px] leading-4 text-muted-foreground">
            Skills / RAG / MCP 为后续阶段能力，当前仅作依赖预览，不会随模板保存。
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onReset} disabled={saving}>
          <RotateCcw className="size-4" />
          重置
        </Button>
        <Button className="flex-1" onClick={onCreate} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          创建 Agent
        </Button>
      </div>
    </aside>
  )
}

function FormSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-foreground">{title}</div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{children}</div>
}

function PreviewLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 break-words text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function DependencyGroup({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode
  title: string
  items: AgentTemplateDependency[]
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium">
        {icon}
        {title}
      </div>
      <div className="mt-1 space-y-1">
        {items.map((item) => (
          <div key={item.name} className="rounded bg-muted/40 px-2 py-1.5">
            <div className="text-[11px] font-medium">{item.name}</div>
            <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskBadge({ level }: { level: AgentTemplateRiskLevel }) {
  const meta =
    level === 'high'
      ? { label: '高权限', className: 'bg-red-500/10 text-red-600 dark:text-red-300' }
      : level === 'medium'
        ? { label: '中权限', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' }
        : { label: '低权限', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' }

  return (
    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', meta.className)}>
      {meta.label}
    </span>
  )
}

'use client'

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
  Power,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type { SkillInstallFlowRow, SkillRow, SkillSource } from '@/db/schema'
import { fetchSkillsCenterData, installSkill, setSkillEnabled, type SkillsCenterData } from '@/lib/api'
import { cn } from '@/lib/utils'

interface InstallDraft {
  source: SkillSource
  url: string
  name: string
  description: string
}

type VisibleSkillRow = SkillRow & { duplicateCount: number }

const emptyData: SkillsCenterData = {
  skills: [],
  installFlows: [],
  sdkManifests: [],
  marketplacePublications: [],
  marketplaceUrl: 'about:blank',
}

export function SkillsCenter() {
  const [data, setData] = useState<SkillsCenterData>(emptyData)
  const [draft, setDraft] = useState<InstallDraft>({
    source: 'skillsmp',
    url: '',
    name: '',
    description: '',
  })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [manualInstallOpen, setManualInstallOpen] = useState(false)
  const [installHistoryOpen, setInstallHistoryOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchSkillsCenterData())
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const visibleSkills = useMemo(() => dedupeSkills(data.skills), [data.skills])
  const filteredSkills = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return visibleSkills
    return visibleSkills.filter((skill) =>
      [skill.name, skill.description, skill.source, skill.status, skill.sourceUrl]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [search, visibleSkills])

  const enabledCount = visibleSkills.filter((skill) => skill.enabled).length
  const disabledCount = Math.max(0, visibleSkills.length - enabledCount)
  const duplicateSkillCount = Math.max(0, data.skills.length - visibleSkills.length)

  const submitInstall = async () => {
    setSaving('install')
    setError(null)
    setNotice(null)
    try {
      await installSkill({
        source: draft.source,
        url: draft.url,
        name: draft.name || undefined,
        description: draft.description || undefined,
        manifest: {},
      })
      setDraft((current) => ({ ...current, url: '', name: '', description: '' }))
      setNotice('技能已安装')
      setManualInstallOpen(false)
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const toggleSkill = async (skill: SkillRow) => {
    setSaving(skill.id)
    setError(null)
    setNotice(null)
    try {
      await setSkillEnabled(skill.id, !skill.enabled)
      setNotice(skill.enabled ? '技能已停用' : '技能已启用')
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="skills-management-center">
      <div className="shrink-0 border-b bg-background px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Package className="size-4 text-primary" />
              <span className="truncate">技能管理</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              管理本地已安装的技能，控制启用状态，需要时手动安装新技能。
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
              <Metric label="已安装" value={visibleSkills.length} />
              <Metric label="已启用" value={enabledCount} />
              <Metric label="已停用" value={disabledCount} />
              <Metric label="安装记录" value={data.installFlows.length} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(error || notice) && (
              <div
                className={cn(
                  'max-w-md rounded-lg border px-3 py-2 text-xs',
                  error
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                )}
              >
                {error ?? notice}
              </div>
            )}
            <Button size="icon" variant="ghost" onClick={() => void reload()} disabled={loading} title="刷新">
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 bg-muted/10">
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <main className="min-w-0 space-y-4">
            <section className="rounded-lg border bg-background">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">我的技能</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {enabledCount}/{visibleSkills.length} 已启用
                    {duplicateSkillCount > 0 && (
                      <span className="ml-1">，已合并 {duplicateSkillCount} 条重复记录</span>
                    )}
                  </div>
                </div>
                <div className="relative min-w-60 flex-1 sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    data-testid="installed-skills-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索已安装技能"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="p-4">
                <div
                  className="mb-3 rounded-lg border bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground"
                  data-testid="installed-skills-agent-hint"
                >
                  已安装技能会出现在智能体设置里。给某个智能体勾选后，这个技能才会进入它的工具包。
                </div>
                <SkillList skills={filteredSkills} saving={saving} onToggle={toggleSkill} />
              </div>
            </section>
          </main>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-lg border bg-background">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-muted/40"
                onClick={() => setManualInstallOpen((current) => !current)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {manualInstallOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  <span className="truncate text-sm font-semibold">手动安装技能</span>
                </span>
                <Settings2 className="size-4 text-muted-foreground" />
              </button>
              {manualInstallOpen && (
                <div className="space-y-2 border-t p-4" data-testid="manual-skill-install">
                  <Select
                    value={draft.source}
                    onChange={(value) => setDraft((current) => ({ ...current, source: value as SkillSource }))}
                    options={[
                      { label: 'SkillsMP 地址', value: 'skillsmp' },
                      { label: 'GitHub 仓库', value: 'github' },
                      { label: '本地目录', value: 'local' },
                    ]}
                  />
                  <Input
                    value={draft.url}
                    onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                    placeholder="技能地址或本地路径"
                  />
                  <Input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="名称，可选"
                  />
                  <Textarea
                    className="min-h-20 text-xs"
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="描述，可选"
                  />
                  <Button
                    className="h-9 w-full gap-1"
                    onClick={() => void submitInstall()}
                    disabled={saving !== null || !draft.url.trim()}
                  >
                    {saving === 'install' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    安装技能
                  </Button>
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-background">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-muted/40"
                onClick={() => setInstallHistoryOpen((current) => !current)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {installHistoryOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  <span className="truncate text-sm font-semibold">安装记录</span>
                </span>
                <Badge variant="outline" className="shrink-0">
                  {data.installFlows.length}
                </Badge>
              </button>
              {installHistoryOpen && (
                <div className="border-t p-4">
                  <InstallFlowList flows={data.installFlows} />
                </div>
              )}
            </section>
          </aside>
        </div>
      </ScrollArea>
    </div>
  )
}

function SkillList({
  skills,
  saving,
  onToggle,
}: {
  skills: VisibleSkillRow[]
  saving: string | null
  onToggle: (skill: SkillRow) => Promise<void>
}) {
  if (skills.length === 0) return <EmptyLine text="暂无匹配技能" />
  return (
    <div className="grid gap-3 2xl:grid-cols-2" data-testid="installed-skills-list">
      {skills.map((skill) => {
        const capabilities = getSkillCapabilities(skill)
        return (
          <article key={skill.id} className="rounded-lg border bg-background p-3 text-xs" data-testid="skill-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm font-semibold">{skill.name}</div>
                  <Badge variant={skill.enabled ? 'default' : 'outline'} className="h-5 px-1.5 text-[10px]">
                    {skill.enabled ? '已启用' : '已停用'}
                  </Badge>
                </div>
                <div className="mt-1 line-clamp-2 min-h-8 text-muted-foreground">
                  {skill.description || '暂无描述'}
                </div>
              </div>
              <Button
                variant={skill.enabled ? 'outline' : 'default'}
                className="h-8 shrink-0 gap-1 px-2"
                disabled={saving !== null}
                onClick={() => void onToggle(skill)}
              >
                {saving === skill.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Power className={cn('size-3.5', skill.enabled && 'text-emerald-600')} />
                )}
                {skill.enabled ? '停用' : '启用'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {sourceLabel(skill.source)}
              </Badge>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {skillStatusLabel(skill.status)}
              </Badge>
              {capabilities.slice(0, 4).map((capability) => (
                <Badge key={capability} variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {capability}
                </Badge>
              ))}
            </div>
            <div className="mt-3 grid gap-1 text-[10px] text-muted-foreground sm:grid-cols-2">
              <div className="truncate">
                <span className="text-foreground/70">来源：</span>
                {skill.sourceUrl || '-'}
              </div>
              <div className="truncate">
                <span className="text-foreground/70">路径：</span>
                {skill.installPath || '-'}
              </div>
            </div>
            {skill.duplicateCount > 1 && (
              <div className="mt-2 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                已把 {skill.duplicateCount} 条同名测试记录合并显示
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function InstallFlowList({ flows }: { flows: SkillInstallFlowRow[] }) {
  if (flows.length === 0) return <EmptyLine text="暂无安装记录" />
  return (
    <div className="space-y-2" data-testid="skill-install-history">
      {flows.slice(0, 8).map((flow) => (
        <div key={flow.id} className="rounded-lg border px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{flow.url || '本地安装'}</span>
            <Badge variant={flow.status === 'failed' ? 'destructive' : 'outline'} className="h-5 px-1.5 text-[10px]">
              {skillStatusLabel(flow.status)}
            </Badge>
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{flow.installPath}</div>
        </div>
      ))}
    </div>
  )
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (value: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-16 rounded-lg border bg-muted/30 px-2.5 py-1.5">
      <div className="font-mono text-sm text-foreground">{value}</div>
      <div className="truncate">{label}</div>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="w-full rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
      {text}
    </div>
  )
}

function skillStatusLabel(status: string): string {
  const map: Record<string, string> = {
    installed: '已安装',
    pending: '等待中',
    failed: '失败',
    valid: '有效',
    invalid: '无效',
    published: '已发布',
    draft: '草稿',
    disabled: '已禁用',
    enabled: '已启用',
  }
  return map[status] ?? status
}

function sourceLabel(source: SkillSource): string {
  const map: Record<SkillSource, string> = {
    skillsmp: 'SkillsMP',
    github: 'GitHub',
    local: '本地目录',
  }
  return map[source] ?? source
}

function getSkillCapabilities(skill: SkillRow): string[] {
  const manifest = skill.manifest as Record<string, unknown>
  const capabilities = manifest.capabilities
  if (!Array.isArray(capabilities)) return []
  return capabilities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function dedupeSkills(skills: SkillRow[]): VisibleSkillRow[] {
  const groups = new Map<string, VisibleSkillRow>()
  for (const skill of skills) {
    const key = [skill.name.trim().toLowerCase(), skill.source, skill.sourceUrl.trim().toLowerCase()].join('::')
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { ...skill, duplicateCount: 1 })
      continue
    }

    const duplicateCount = existing.duplicateCount + 1
    const preferred = !existing.enabled && skill.enabled ? skill : existing
    groups.set(key, { ...preferred, duplicateCount })
  }
  return Array.from(groups.values())
}

'use client'

import {
  ArrowLeft,
  Boxes,
  Check,
  Download,
  Globe,
  Loader2,
  Package,
  Pencil,
  Plus,
  Power,
  Search,
  Sparkles,
  Star,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { SkillFormDialog } from '@/components/skill-form-dialog'
import { SkillImportDialog } from '@/components/skill-import-dialog'
import { Markdown } from '@/components/markdown'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SkillRow } from '@/db/schema'
import {
  deleteSkill as deleteSkillAPI,
  fetchSkillsWithUsage,
  installCatalogSkill,
  previewSkillMarkdown,
  searchSkillRegistry,
  updateSkill,
  type RegistrySkill,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { estimateTokens } from '@/shared/model-registry'
import { SKILL_CATALOG, type CatalogSkill } from '@/shared/skill-catalog'

const SOURCE_BADGE: Record<SkillRow['source'], { label: string; className: string }> = {
  builtin: { label: '内置', className: 'bg-muted text-muted-foreground' },
  user: { label: '自建', className: 'bg-primary/10 text-primary' },
  imported: { label: '导入', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-300' },
}

type SortKey = 'relevance' | 'most-used' | 'recent' | 'name'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: '相关度' },
  { value: 'most-used', label: '使用最多' },
  { value: 'recent', label: '最近更新' },
  { value: 'name', label: '名称' },
]

const ALL = '__all__'

// 浏览热门：SkillsMP 搜索 API 强制要 q（空词 400），用一个宽泛种子词按 star 排出「热门榜」。
// 语义贴合「Agent Skills」市场；用户输入 ≥2 字才切成真实搜索。
const BROWSE_SEED = 'agent'

/**
 * GitHub skill 归一化键：`<folder>/skill.md`（小写），用于判断精选/在线条目是否已安装。
 * 兼容 raw/blob（末段是 SKILL.md，取父目录）与 tree（末段是目录名，补 skill.md）三种形态。
 */
function githubSkillKey(url: string): string {
  const segs = url.split('?')[0].split('#')[0].split('/').filter(Boolean)
  const last = (segs[segs.length - 1] ?? '').toLowerCase()
  if (last === 'skill.md') return `${(segs[segs.length - 2] ?? '').toLowerCase()}/skill.md`
  return `${last}/skill.md`
}

export function SkillMarketplace() {
  const router = useRouter()
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'local' | 'online'>('local')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(ALL)
  const [sort, setSort] = useState<SortKey>('relevance')

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<SkillRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SkillRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [installingUri, setInstallingUri] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)

  // 在线市场（SkillsMP）状态
  const [onlineQuery, setOnlineQuery] = useState('')
  const [onlineSort, setOnlineSort] = useState<'stars' | 'recent'>('stars')
  const [onlineResults, setOnlineResults] = useState<RegistrySkill[]>([])
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [onlineTotal, setOnlineTotal] = useState(0)
  const [browseMode, setBrowseMode] = useState(true)
  const [detailSkill, setDetailSkill] = useState<RegistrySkill | null>(null)

  const refresh = async () => {
    try {
      const { skills: rows, usage: counts } = await fetchSkillsWithUsage()
      setSkills(rows)
      setUsage(counts)
    } catch (err) {
      console.error('[SkillMarketplace] load failed', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  // 在线市场：空/短搜索时展示热门榜（种子词 + star 排序）；输入 ≥2 字则 debounce 搜索。
  useEffect(() => {
    if (tab !== 'online') return
    const q = onlineQuery.trim()
    const isBrowse = q.length < 2
    const effectiveQ = isBrowse ? BROWSE_SEED : q
    setBrowseMode(isBrowse)
    const ctrl = new AbortController()
    setOnlineLoading(true)
    setOnlineError(null)
    const timer = setTimeout(
      () => {
        searchSkillRegistry({ q: effectiveQ, sort: onlineSort })
          .then((res) => {
            if (ctrl.signal.aborted) return
            setOnlineResults(res.skills)
            setOnlineTotal(res.total)
          })
          .catch((err: unknown) => {
            if (ctrl.signal.aborted) return
            setOnlineResults([])
            setOnlineError(err instanceof Error ? err.message : String(err))
          })
          .finally(() => {
            if (!ctrl.signal.aborted) setOnlineLoading(false)
          })
      },
      isBrowse ? 0 : 400,
    )
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [tab, onlineQuery, onlineSort])

  // 精选目录里尚未安装的条目（按 GitHub 归一化键比对已装 imported skill）。
  const installedKeys = useMemo(() => {
    const set = new Set<string>()
    for (const s of skills) {
      if (s.sourceUri) set.add(githubSkillKey(s.sourceUri))
    }
    return set
  }, [skills])

  const uninstalledCatalog = useMemo(
    () => SKILL_CATALOG.filter((c) => !installedKeys.has(githubSkillKey(c.sourceUri))),
    [installedKeys],
  )

  // 分类：已装 skill 的分类 ∪ 精选目录分类。
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const s of skills) set.add(s.category)
    for (const c of uninstalledCatalog) set.add(c.category)
    return Array.from(set).sort()
  }, [skills, uninstalledCatalog])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredSkills = useMemo(() => {
    let rows = skills.filter((s) => {
      if (category !== ALL && s.category !== category) return false
      if (!normalizedQuery) return true
      return `${s.name}\n${s.description}\n${s.category}`.toLowerCase().includes(normalizedQuery)
    })
    rows = [...rows]
    if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'most-used') rows.sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0))
    else if (sort === 'recent') rows.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    return rows
  }, [skills, category, normalizedQuery, sort, usage])

  const filteredCatalog = useMemo(() => {
    return uninstalledCatalog.filter((c) => {
      if (category !== ALL && c.category !== category) return false
      if (!normalizedQuery) return true
      return `${c.name}\n${c.description}\n${c.category}`.toLowerCase().includes(normalizedQuery)
    })
  }, [uninstalledCatalog, category, normalizedQuery])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const togglePublic = async (skill: SkillRow) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, isGlobalDefault: !s.isGlobalDefault } : s)),
    )
    try {
      await updateSkill(skill.id, { isGlobalDefault: !skill.isGlobalDefault })
      void refresh()
    } catch (err) {
      console.error('[SkillMarketplace] toggle public failed', err)
      void refresh()
    }
  }

  const toggleEnabled = async (skill: SkillRow) => {
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s)))
    try {
      await updateSkill(skill.id, { enabled: !skill.enabled })
    } catch (err) {
      console.error('[SkillMarketplace] toggle enabled failed', err)
      void refresh()
    }
  }

  const doInstall = async (args: {
    sourceUri: string
    category: string
    name?: string
    description?: string
    label: string
  }) => {
    setInstallingUri(args.sourceUri)
    setInstallError(null)
    try {
      await installCatalogSkill({
        sourceUri: args.sourceUri,
        category: args.category,
        name: args.name,
        description: args.description,
      })
      await refresh()
    } catch (err) {
      setInstallError(`安装「${args.label}」失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setInstallingUri(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSkillAPI(deleteTarget.id)
      setDeleteTarget(null)
      await refresh()
    } catch (err) {
      console.error('[SkillMarketplace] delete failed', err)
    } finally {
      setDeleting(false)
    }
  }

  const publicCount = skills.filter((s) => s.isGlobalDefault && s.enabled).length

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="返回工作台" title="返回工作台" onClick={() => router.push('/')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold">Skills 市场</h1>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              安装、自建、共享方法论模块——公共 Skill 自动挂给所有 Agent
            </span>
          </div>
        </div>
        <div className="flex items-center rounded-md border p-0.5">
          <TabBtn active={tab === 'local'} onClick={() => setTab('local')} icon={<Package className="size-3.5" />}>
            本地库
          </TabBtn>
          <TabBtn active={tab === 'online'} onClick={() => setTab('online')} icon={<Store className="size-3.5" />}>
            在线市场
          </TabBtn>
        </div>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Download className="size-4" />
          导入
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          新建 Skill
        </Button>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {tab === 'local' && (
          <aside className="hidden w-52 shrink-0 flex-col gap-1 border-r bg-card/40 p-3 md:flex">
            <div className="px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              分类
            </div>
            <RailItem
              label="全部"
              icon={<Boxes className="size-4" />}
              count={skills.length + uninstalledCatalog.length}
              active={category === ALL}
              onClick={() => setCategory(ALL)}
            />
            {categories.map((cat) => {
              const count =
                skills.filter((s) => s.category === cat).length +
                uninstalledCatalog.filter((c) => c.category === cat).length
              return (
                <RailItem
                  key={cat}
                  label={cat}
                  icon={<Package className="size-4" />}
                  count={count}
                  active={category === cat}
                  onClick={() => setCategory(cat)}
                />
              )
            })}
          </aside>
        )}

        <ScrollArea className="h-full flex-1">
          {tab === 'online' ? (
            <OnlineMarket
              query={onlineQuery}
              onQueryChange={setOnlineQuery}
              sort={onlineSort}
              onSortChange={setOnlineSort}
              results={onlineResults}
              loading={onlineLoading}
              error={onlineError}
              total={onlineTotal}
              browseMode={browseMode}
              installedKeys={installedKeys}
              installingUri={installingUri}
              installError={installError}
              onOpenDetail={setDetailSkill}
              onInstall={(r) =>
                void doInstall({
                  sourceUri: r.githubUrl,
                  category: r.author || 'community',
                  name: r.name,
                  description: r.description,
                  label: r.name,
                })
              }
            />
          ) : (
            <div className="flex flex-col gap-5 p-4 lg:p-6">
            <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-5 lg:p-6">
              <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <Sparkles className="size-4" />
                  Skills 市场
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">给你的 Agent 装上方法论</h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  从精选目录一键安装，或自建 / 导入。设为「公共」的 Skill 会自动挂载到所有 Agent，其余按需在
                  Agent Studio 里勾选——都走渐进式披露，不浪费上下文。
                </p>

                <div className="relative mt-4 max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索 Skill、分类、描述…"
                    className="h-11 rounded-lg pl-9 pr-9 text-sm shadow-sm"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="清除搜索"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <MarketStat icon={<Package className="size-3.5" />} value={`${skills.length}`} label="已装 Skill" />
                  <MarketStat icon={<Globe className="size-3.5" />} value={`${publicCount}`} label="公共（全员挂载）" />
                  <MarketStat icon={<Download className="size-3.5" />} value={`${uninstalledCatalog.length}`} label="精选待装" />
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <MobileCategoryBar
                categories={categories}
                active={category}
                onChange={setCategory}
                allCount={skills.length + uninstalledCatalog.length}
              />
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">排序</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:border-foreground/30"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {installError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {installError}
              </div>
            )}

            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">加载中…</div>
            ) : (
              <>
                {filteredCatalog.length > 0 && (
                  <section className="space-y-3">
                    <SectionHeader icon={<Download className="size-4 text-primary" />} title="精选目录" count={filteredCatalog.length} />
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3">
                      {filteredCatalog.map((item) => (
                        <CatalogCard
                          key={item.slug}
                          item={item}
                          installing={installingUri === item.sourceUri}
                          onInstall={() =>
                            void doInstall({
                              sourceUri: item.sourceUri,
                              category: item.category,
                              name: item.name,
                              description: item.description,
                              label: item.name,
                            })
                          }
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-3">
                  <SectionHeader icon={<Package className="size-4" />} title="已安装" count={filteredSkills.length} />
                  {filteredSkills.length === 0 ? (
                    <div className="rounded-md border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                      没有匹配的 Skill。换个关键词，或从精选目录安装 / 新建。
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3">
                      {filteredSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          usage={usage[skill.id] ?? 0}
                          onTogglePublic={() => void togglePublic(skill)}
                          onToggleEnabled={() => void toggleEnabled(skill)}
                          onEdit={() => {
                            setEditing(skill)
                            setFormOpen(true)
                          }}
                          onDelete={() => setDeleteTarget(skill)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
          )}
        </ScrollArea>
      </main>

      <SkillFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        skill={editing ?? undefined}
        onSaved={() => void refresh()}
      />
      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void refresh()} />

      <SkillDetailDialog
        skill={detailSkill}
        installed={detailSkill ? installedKeys.has(githubSkillKey(detailSkill.githubUrl)) : false}
        installing={detailSkill ? installingUri === detailSkill.githubUrl : false}
        onClose={() => setDetailSkill(null)}
        onInstall={(r) =>
          void doInstall({
            sourceUri: r.githubUrl,
            category: r.author || 'community',
            name: r.name,
            description: r.description,
            label: r.name,
          })
        }
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 Skill</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.name}」吗？已选用该 Skill 的 Agent 会在下次运行时自动跳过它。该操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function OnlineMarket({
  query,
  onQueryChange,
  sort,
  onSortChange,
  results,
  loading,
  error,
  total,
  browseMode,
  installedKeys,
  installingUri,
  installError,
  onInstall,
  onOpenDetail,
}: {
  query: string
  onQueryChange: (q: string) => void
  sort: 'stars' | 'recent'
  onSortChange: (s: 'stars' | 'recent') => void
  results: RegistrySkill[]
  loading: boolean
  error: string | null
  total: number
  browseMode: boolean
  installedKeys: Set<string>
  installingUri: string | null
  installError: string | null
  onInstall: (r: RegistrySkill) => void
  onOpenDetail: (r: RegistrySkill) => void
}) {
  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Store className="size-4" />
            在线市场 · SkillsMP
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">搜索 200 万+ 社区 Skill</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            数据来自{' '}
            <a href="https://skillsmp.com" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              skillsmp.com
            </a>
            （聚合公开 GitHub SKILL.md）。安装时经本项目安全通道拉取，仅 GitHub 来源、丢弃权限声明。匿名搜索有频率上限。
          </p>

          <div className="mt-4 flex max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="搜索 skill（如 pdf、excel、frontend…）"
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
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as 'stars' | 'recent')}
              className="h-11 rounded-md border bg-background px-2 text-xs outline-none focus:border-foreground/30"
            >
              <option value="stars">Star 最多</option>
              <option value="recent">最近更新</option>
            </select>
          </div>
        </div>
      </section>

      {installError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {installError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {browseMode ? '加载热门…' : '搜索中…'}
        </div>
      ) : error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {error}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-md border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          没有找到匹配的 Skill，换个关键词试试。
        </div>
      ) : (
        <section className="space-y-3">
          {browseMode ? (
            <SectionHeader
              icon={<Star className="size-4 text-amber-500" />}
              title={sort === 'stars' ? '热门 Skills' : '最近更新'}
            />
          ) : (
            <div className="text-xs text-muted-foreground">
              约 {total} 个结果（显示前 {results.length} 个）
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3">
            {results.map((r) => (
              <RegistryCard
                key={r.id}
                skill={r}
                installed={installedKeys.has(githubSkillKey(r.githubUrl))}
                installing={installingUri === r.githubUrl}
                onInstall={() => onInstall(r)}
                onOpen={() => onOpenDetail(r)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RegistryCard({
  skill,
  installed,
  installing,
  onInstall,
  onOpen,
}: {
  skill: RegistrySkill
  installed: boolean
  installing: boolean
  onInstall: () => void
  onOpen: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="flex min-h-[168px] cursor-pointer flex-col rounded-lg border bg-card p-4 text-left transition hover:border-foreground/20 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xl">
          <Sparkles className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 truncate text-sm font-semibold">{skill.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="truncate">@{skill.author || 'unknown'}</span>
            <span className="inline-flex items-center gap-0.5">
              <Star className="size-2.5" />
              {formatStars(skill.stars)}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-3 text-xs leading-5 text-muted-foreground">{skill.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-[10px] text-muted-foreground">点击查看详情</span>
        {installed ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/12 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <Check className="size-3.5" />
            已安装
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onInstall()
            }}
            disabled={installing}
          >
            {installing ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {installing ? '安装中' : '安装'}
          </Button>
        )}
      </div>
    </div>
  )
}

function SkillDetailDialog({
  skill,
  installed,
  installing,
  onClose,
  onInstall,
}: {
  skill: RegistrySkill | null
  installed: boolean
  installing: boolean
  onClose: () => void
  onInstall: (r: RegistrySkill) => void
}) {
  const [preview, setPreview] = useState<{ instruction: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!skill) return
    const ctrl = new AbortController()
    setPreview(null)
    setError(null)
    setLoading(true)
    previewSkillMarkdown(skill.githubUrl)
      .then((p) => {
        if (!ctrl.signal.aborted) setPreview({ instruction: p.instruction })
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [skill])

  return (
    <Dialog open={!!skill} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        {skill && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                {skill.name}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>@{skill.author || 'unknown'}</span>
                <span className="inline-flex items-center gap-0.5">
                  <Star className="size-3" />
                  {formatStars(skill.stars)}
                </span>
                {skill.updatedAt && <span>更新 {formatDate(skill.updatedAt)}</span>}
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm leading-6 text-muted-foreground">{skill.description}</p>

            <div className="flex items-center gap-2">
              {installed ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3.5" />
                  已安装
                </span>
              ) : (
                <Button size="sm" onClick={() => onInstall(skill)} disabled={installing}>
                  {installing ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  {installing ? '安装中' : '安装到本地'}
                </Button>
              )}
              <a
                href={skill.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                打开 GitHub 仓库
              </a>
            </div>

            <div className="min-h-0 flex-1 rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                SKILL.md 预览
              </div>
              <ScrollArea className="h-[42vh]">
                <div className="p-3">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      拉取 SKILL.md…
                    </div>
                  ) : error ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      预览失败：{error}（可能网络受限；安装时会重试）
                    </div>
                  ) : preview ? (
                    <Markdown>{preview.instruction}</Markdown>
                  ) : null}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

function SkillCard({
  skill,
  usage,
  onTogglePublic,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  skill: SkillRow
  usage: number
  onTogglePublic: () => void
  onToggleEnabled: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const badge = SOURCE_BADGE[skill.source]
  return (
    <div
      className={cn(
        'group flex min-h-[168px] flex-col rounded-lg border bg-card p-4 transition hover:border-foreground/20 hover:shadow-sm',
        !skill.enabled && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xl">
          <Sparkles className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{skill.name}</h3>
            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium', badge.className)}>
              {badge.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{skill.category}</span>
            {skill.isGlobalDefault && (
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <Globe className="size-2.5" />
                公共
              </span>
            )}
            {!skill.enabled && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">已停用</span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{skill.description}</p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1" title="被多少 Agent 使用">
            <Users className="size-3.5" />
            {usage}
          </span>
          <span className="font-mono text-[10px]">~{estimateTokens(skill.instruction)}t</span>
        </span>
        <div className="flex items-center gap-1">
          <IconBtn
            title={skill.isGlobalDefault ? '取消公共' : '设为公共（挂给所有 Agent）'}
            active={skill.isGlobalDefault}
            onClick={onTogglePublic}
          >
            <Globe className="size-3.5" />
          </IconBtn>
          <IconBtn title={skill.enabled ? '停用' : '启用'} active={skill.enabled} onClick={onToggleEnabled}>
            <Power className="size-3.5" />
          </IconBtn>
          {!skill.isBuiltin && (
            <>
              <IconBtn title="编辑" onClick={onEdit}>
                <Pencil className="size-3.5" />
              </IconBtn>
              <IconBtn title="删除" danger onClick={onDelete}>
                <Trash2 className="size-3.5" />
              </IconBtn>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CatalogCard({
  item,
  installing,
  onInstall,
}: {
  item: CatalogSkill
  installing: boolean
  onInstall: () => void
}) {
  return (
    <div className="flex min-h-[168px] flex-col rounded-lg border border-dashed bg-card/60 p-4 transition hover:border-foreground/20">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xl">
          <Download className="size-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 truncate text-sm font-semibold">{item.name}</h3>
          <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {item.category}
          </span>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="truncate font-mono text-[10px] text-muted-foreground">GitHub</span>
        <Button size="sm" variant="outline" onClick={onInstall} disabled={installing}>
          {installing ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {installing ? '安装中' : '安装'}
        </Button>
      </div>
    </div>
  )
}

function IconBtn({
  title,
  active,
  danger,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground',
        active && !danger && 'text-primary',
        danger && 'hover:text-red-600',
      )}
    >
      {children}
    </button>
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
        active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
  categories,
  active,
  onChange,
  allCount,
}: {
  categories: string[]
  active: string
  onChange: (cat: string) => void
  allCount: number
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 md:hidden">
      <MobileChip label={`全部 ${allCount}`} active={active === ALL} onClick={() => onChange(ALL)} />
      {categories.map((cat) => (
        <MobileChip key={cat} label={cat} active={active === cat} onClick={() => onChange(cat)} />
      ))}
    </div>
  )
}

function MobileChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function MarketStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-primary">{icon}</span>
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  )
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold">{title}</h3>
      {typeof count === 'number' && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{count}</span>
      )}
    </div>
  )
}

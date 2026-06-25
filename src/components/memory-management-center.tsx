'use client'

import {
  BookOpenCheck,
  Brain,
  Check,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type {
  AgentProfileRow,
  LearningEventRow,
  MemoryItemRow,
  MemoryScope,
  MemoryType,
  PlaybookRow,
} from '@/db/schema'
import {
  approveLearningEvent,
  createMemoryItem,
  deleteMemoryItem,
  fetchAgentProfiles,
  fetchLearningEvents,
  fetchMemoryItems,
  fetchPlaybooks,
  rejectLearningEvent,
  updateMemoryItem,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const scopeOptions: Array<{ value: MemoryScope; label: string }> = [
  { value: 'workspace', label: '工作区' },
  { value: 'project', label: '项目' },
  { value: 'agent', label: '智能体' },
  { value: 'global', label: '全局' },
]

const typeOptions: Array<{ value: MemoryType; label: string }> = [
  { value: 'semantic', label: '知识' },
  { value: 'procedural', label: '流程' },
  { value: 'project', label: '项目状态' },
  { value: 'customer', label: '客户偏好' },
  { value: 'software', label: '软件用法' },
  { value: 'mistake', label: '失败教训' },
  { value: 'success', label: '成功经验' },
  { value: 'episodic', label: '任务记录' },
]

const statusLabels: Record<LearningEventRow['status'], string> = {
  pending_review: '待审核',
  approved: '已收录',
  rejected: '已拒绝',
}

const initialNewMemory = {
  title: '',
  content: '',
  scope: 'workspace' as MemoryScope,
  type: 'semantic' as MemoryType,
  agentProfileId: '',
  importance: 0.6,
  confidence: 0.9,
}

interface MemoryDraft {
  title: string
  content: string
  scope: MemoryScope
  type: MemoryType
  agentProfileId: string
  importance: number
  confidence: number
}

export function MemoryManagementCenter() {
  const [memories, setMemories] = useState<MemoryItemRow[]>([])
  const [learningEvents, setLearningEvents] = useState<LearningEventRow[]>([])
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([])
  const [agents, setAgents] = useState<AgentProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<MemoryScope | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all')
  const [newMemory, setNewMemory] = useState<MemoryDraft>(initialNewMemory)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<MemoryDraft | null>(null)

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )
  const selectedMemory = useMemo(
    () => memories.find((memory) => memory.id === selectedId) ?? null,
    [memories, selectedId],
  )
  const filteredMemories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memories.filter((memory) => {
      if (scopeFilter !== 'all' && memory.scope !== scopeFilter) return false
      if (typeFilter !== 'all' && memory.type !== typeFilter) return false
      if (!q) return true
      const haystack = `${memory.title} ${memory.content} ${memory.scope} ${memory.type}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [memories, query, scopeFilter, typeFilter])
  const pendingLearningEvents = useMemo(
    () => learningEvents.filter((event) => event.status === 'pending_review'),
    [learningEvents],
  )
  const stats = useMemo(() => {
    const highImportance = memories.filter((memory) => memory.importance >= 0.75).length
    const agentScoped = memories.filter((memory) => memory.scope === 'agent').length
    return {
      total: memories.length,
      highImportance,
      agentScoped,
      pending: pendingLearningEvents.length,
      playbooks: playbooks.length,
    }
  }, [memories, pendingLearningEvents.length, playbooks.length])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [memoryItems, events, playbookRows, agentRows] = await Promise.all([
        fetchMemoryItems({ limit: 200 }),
        fetchLearningEvents(),
        fetchPlaybooks(),
        fetchAgentProfiles(),
      ])
      setMemories(memoryItems)
      setLearningEvents(events)
      setPlaybooks(playbookRows)
      setAgents(agentRows)
      if (!selectedId && memoryItems[0]) setSelectedId(memoryItems[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selectedMemory) {
      setEditDraft(null)
      return
    }
    setEditDraft(toDraft(selectedMemory))
  }, [selectedMemory])

  const createNewMemory = async () => {
    if (!newMemory.title.trim() || !newMemory.content.trim()) return
    setBusy('create')
    setError(null)
    try {
      const created = await createMemoryItem({
        scope: newMemory.scope,
        type: newMemory.type,
        title: newMemory.title,
        content: newMemory.content,
        agentProfileId: newMemory.agentProfileId || null,
        importance: newMemory.importance,
        confidence: newMemory.confidence,
      })
      setMemories((items) => [created, ...items])
      setSelectedId(created.id)
      setNewMemory(initialNewMemory)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const saveSelectedMemory = async () => {
    if (!selectedMemory || !editDraft || !editDraft.title.trim() || !editDraft.content.trim()) return
    setBusy(`save:${selectedMemory.id}`)
    setError(null)
    try {
      const updated = await updateMemoryItem(selectedMemory.id, {
        title: editDraft.title,
        content: editDraft.content,
        scope: editDraft.scope,
        type: editDraft.type,
        agentProfileId: editDraft.agentProfileId || null,
        importance: editDraft.importance,
        confidence: editDraft.confidence,
      })
      setMemories((items) => items.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const removeSelectedMemory = async () => {
    if (!selectedMemory) return
    setBusy(`delete:${selectedMemory.id}`)
    setError(null)
    try {
      await deleteMemoryItem(selectedMemory.id)
      setMemories((items) => items.filter((item) => item.id !== selectedMemory.id))
      setSelectedId((id) => (id === selectedMemory.id ? null : id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const reviewLearningEvent = async (eventId: string, action: 'approve' | 'reject') => {
    setBusy(`${action}:${eventId}`)
    setError(null)
    try {
      if (action === 'approve') await approveLearningEvent(eventId, '从记忆管理页面审核通过')
      else await rejectLearningEvent(eventId, '从记忆管理页面拒绝')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      data-testid="memory-management-center"
      className="min-h-0 flex-1 overflow-y-auto bg-background"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-5">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Brain className="size-4" />
              记忆管理
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">管理智能体会记住的东西</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              这里管理长期记忆、待审核学习和可复用 Playbook。普通用户只需要看这三块：记住了什么、哪些经验要收录、哪些流程已经可复用。
            </p>
          </div>
          <Button variant="outline" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            刷新
          </Button>
        </header>

        <section className="grid gap-3 md:grid-cols-5">
          <StatBox label="记忆总数" value={stats.total} detail="长期保存" />
          <StatBox label="重点记忆" value={stats.highImportance} detail="高重要度" />
          <StatBox label="智能体专属" value={stats.agentScoped} detail="绑定员工" />
          <StatBox label="待审核学习" value={stats.pending} detail="需人工确认" />
          <StatBox label="Playbook" value={stats.playbooks} detail="可复用流程" />
        </section>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid min-h-[42rem] gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col gap-4">
            <section className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-primary" />
                查找记忆
              </div>
              <div className="mt-3 space-y-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索标题或内容"
                />
                <div className="grid grid-cols-2 gap-2">
                  <SelectBox
                    value={scopeFilter}
                    onChange={(value) => setScopeFilter(value as MemoryScope | 'all')}
                    options={[{ value: 'all', label: '全部范围' }, ...scopeOptions]}
                  />
                  <SelectBox
                    value={typeFilter}
                    onChange={(value) => setTypeFilter(value as MemoryType | 'all')}
                    options={[{ value: 'all', label: '全部类型' }, ...typeOptions]}
                  />
                </div>
              </div>
            </section>

            <section data-testid="memory-create-form" className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="size-4 text-primary" />
                新增记忆
              </div>
              <div className="mt-3 space-y-2">
                <Input
                  value={newMemory.title}
                  onChange={(event) => setNewMemory((draft) => ({ ...draft, title: event.target.value }))}
                  placeholder="记忆标题"
                />
                <Textarea
                  value={newMemory.content}
                  onChange={(event) => setNewMemory((draft) => ({ ...draft, content: event.target.value }))}
                  placeholder="这条记忆具体写什么"
                  className="min-h-28 resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <SelectBox
                    value={newMemory.scope}
                    onChange={(value) => setNewMemory((draft) => ({ ...draft, scope: value as MemoryScope }))}
                    options={scopeOptions}
                  />
                  <SelectBox
                    value={newMemory.type}
                    onChange={(value) => setNewMemory((draft) => ({ ...draft, type: value as MemoryType }))}
                    options={typeOptions}
                  />
                </div>
                <SelectBox
                  value={newMemory.agentProfileId}
                  onChange={(value) => setNewMemory((draft) => ({ ...draft, agentProfileId: value }))}
                  options={[
                    { value: '', label: '不绑定智能体' },
                    ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
                  ]}
                />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <NumberField
                    label="重要度"
                    value={newMemory.importance}
                    onChange={(value) => setNewMemory((draft) => ({ ...draft, importance: value }))}
                  />
                  <NumberField
                    label="可信度"
                    value={newMemory.confidence}
                    onChange={(value) => setNewMemory((draft) => ({ ...draft, confidence: value }))}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => void createNewMemory()}
                  disabled={busy === 'create' || !newMemory.title.trim() || !newMemory.content.trim()}
                >
                  {busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  写入记忆
                </Button>
              </div>
            </section>
          </aside>

          <section className="grid min-w-0 gap-4 xl:grid-rows-[minmax(18rem,1fr)_minmax(18rem,0.9fr)]">
            <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <section className="min-h-0 rounded-lg border bg-card">
                <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">记忆列表</div>
                    <div className="text-xs text-muted-foreground">
                      当前显示 {filteredMemories.length} 条，点击任意一条可编辑。
                    </div>
                  </div>
                  <Badge variant="outline">{scopeFilter === 'all' ? '全部范围' : scopeLabel(scopeFilter)}</Badge>
                </div>
                <div data-testid="memory-item-list" className="max-h-[32rem] overflow-y-auto p-3">
                  {loading ? (
                    <LoadingState label="正在加载记忆" />
                  ) : filteredMemories.length ? (
                    <div className="space-y-2">
                      {filteredMemories.map((memory) => (
                        <button
                          key={memory.id}
                          type="button"
                          onClick={() => setSelectedId(memory.id)}
                          className={cn(
                            'w-full rounded-lg border px-3 py-3 text-left transition hover:border-primary/60 hover:bg-accent',
                            selectedId === memory.id && 'border-primary bg-primary/10',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{memory.title}</div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {memory.content}
                              </div>
                            </div>
                            <ImportanceBadge value={memory.importance} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Badge variant="secondary">{scopeLabel(memory.scope)}</Badge>
                            <Badge variant="outline">{typeLabel(memory.type)}</Badge>
                            {memory.agentProfileId && (
                              <span className="truncate">绑定：{agentNameById.get(memory.agentProfileId) ?? memory.agentProfileId}</span>
                            )}
                            <span>{formatDate(memory.updatedAt)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Database className="size-4" />}
                      title="暂无匹配记忆"
                      body="可以调整筛选条件，或者在左侧新增一条记忆。"
                    />
                  )}
                </div>
              </section>

              <section className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">编辑选中记忆</div>
                    <div className="text-xs text-muted-foreground">修改后会立即影响后续智能体检索。</div>
                  </div>
                  <Brain className="size-4 text-primary" />
                </div>
                {selectedMemory && editDraft ? (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={editDraft.title}
                      onChange={(event) => setEditDraft((draft) => draft && { ...draft, title: event.target.value })}
                    />
                    <Textarea
                      value={editDraft.content}
                      onChange={(event) => setEditDraft((draft) => draft && { ...draft, content: event.target.value })}
                      className="min-h-40 resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <SelectBox
                        value={editDraft.scope}
                        onChange={(value) => setEditDraft((draft) => draft && { ...draft, scope: value as MemoryScope })}
                        options={scopeOptions}
                      />
                      <SelectBox
                        value={editDraft.type}
                        onChange={(value) => setEditDraft((draft) => draft && { ...draft, type: value as MemoryType })}
                        options={typeOptions}
                      />
                    </div>
                    <SelectBox
                      value={editDraft.agentProfileId}
                      onChange={(value) => setEditDraft((draft) => draft && { ...draft, agentProfileId: value })}
                      options={[
                        { value: '', label: '不绑定智能体' },
                        ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
                      ]}
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <NumberField
                        label="重要度"
                        value={editDraft.importance}
                        onChange={(value) => setEditDraft((draft) => draft && { ...draft, importance: value })}
                      />
                      <NumberField
                        label="可信度"
                        value={editDraft.confidence}
                        onChange={(value) => setEditDraft((draft) => draft && { ...draft, confidence: value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => void saveSelectedMemory()}
                        disabled={busy === `save:${selectedMemory.id}`}
                      >
                        {busy === `save:${selectedMemory.id}`
                          ? <Loader2 className="size-4 animate-spin" />
                          : <Save className="size-4" />}
                        保存
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void removeSelectedMemory()}
                        disabled={busy === `delete:${selectedMemory.id}`}
                      >
                        {busy === `delete:${selectedMemory.id}`
                          ? <Loader2 className="size-4 animate-spin" />
                          : <Trash2 className="size-4" />}
                        删除
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      来源：{selectedMemory.sourceRunId || '手动写入'} · 更新时间：{formatDate(selectedMemory.updatedAt)}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<Brain className="size-4" />}
                    title="先选择一条记忆"
                    body="左侧列表点开后，这里会出现编辑和删除入口。"
                  />
                )}
              </section>
            </div>

            <div className="grid min-h-0 gap-4 lg:grid-cols-2">
              <section data-testid="memory-learning-review" className="min-h-0 rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">学习审核</div>
                    <div className="text-xs text-muted-foreground">智能体总结出来的新流程，审核后才会进入 Playbook。</div>
                  </div>
                  <Badge>{pendingLearningEvents.length} 条待审核</Badge>
                </div>
                <div className="max-h-72 overflow-y-auto p-3">
                  {pendingLearningEvents.length ? (
                    <div className="space-y-2">
                      {pendingLearningEvents.map((event) => (
                        <div key={event.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{event.title}</div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {event.summary}
                              </div>
                            </div>
                            <Badge variant="outline">{statusLabels[event.status]}</Badge>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void reviewLearningEvent(event.id, 'approve')}
                              disabled={busy === `approve:${event.id}`}
                            >
                              <Check className="size-3.5" />
                              收录
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void reviewLearningEvent(event.id, 'reject')}
                              disabled={busy === `reject:${event.id}`}
                            >
                              <X className="size-3.5" />
                              拒绝
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Check className="size-4" />}
                      title="暂无待审核学习"
                      body="智能体完成任务并产生可复用流程后，会出现在这里。"
                    />
                  )}
                </div>
              </section>

              <section data-testid="memory-playbook-list" className="min-h-0 rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">Playbook 流程库</div>
                    <div className="text-xs text-muted-foreground">已经审核通过、后续可复用的做事流程。</div>
                  </div>
                  <BookOpenCheck className="size-4 text-primary" />
                </div>
                <div className="max-h-72 overflow-y-auto p-3">
                  {playbooks.length ? (
                    <div className="space-y-2">
                      {playbooks.map((playbook) => (
                        <div key={playbook.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{playbook.title}</div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {playbook.description}
                              </div>
                            </div>
                            <Badge variant={playbook.status === 'active' ? 'default' : 'secondary'}>
                              {playbook.status === 'active' ? '启用' : playbook.status}
                            </Badge>
                          </div>
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            绑定：{playbook.agentProfileId ? agentNameById.get(playbook.agentProfileId) ?? playbook.agentProfileId : '未绑定'} · {formatDate(playbook.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<BookOpenCheck className="size-4" />}
                      title="暂无 Playbook"
                      body="把学习审核通过后，会自动生成可复用流程。"
                    />
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function toDraft(memory: MemoryItemRow): MemoryDraft {
  return {
    title: memory.title,
    content: memory.content,
    scope: memory.scope,
    type: memory.type,
    agentProfileId: memory.agentProfileId ?? '',
    importance: memory.importance,
    confidence: memory.confidence,
  }
}

function StatBox({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function SelectBox({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-ring"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="rounded-md border bg-background px-2 py-1.5">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(clamp01(Number(event.target.value)))}
        className="mt-1 w-full bg-transparent text-sm font-medium outline-none"
      />
    </label>
  )
}

function ImportanceBadge({ value }: { value: number }) {
  if (value >= 0.75) return <Badge>重点</Badge>
  if (value >= 0.45) return <Badge variant="secondary">常规</Badge>
  return <Badge variant="outline">低优先级</Badge>
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center">
      <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
      <div className="mt-2 text-sm font-semibold">{title}</div>
      <div className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{body}</div>
    </div>
  )
}

function scopeLabel(scope: MemoryScope) {
  return scopeOptions.find((option) => option.value === scope)?.label ?? scope
}

function typeLabel(type: MemoryType) {
  return typeOptions.find((option) => option.value === type)?.label ?? type
}

function formatDate(value: number | Date | null | undefined) {
  if (!value) return '未知时间'
  const date = typeof value === 'number' ? new Date(value) : value
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

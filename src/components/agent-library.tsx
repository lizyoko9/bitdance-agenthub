'use client'

import {
  BrainCircuit,
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'

import { AgentAvatar } from '@/components/agent-avatar'
import { AgentEmployeeSettingsPanel } from '@/components/agent-employee-settings-panel'
import { CreateAgentDialog } from '@/components/create-agent-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AgentRow } from '@/db/schema'
import {
  deleteAgent as deleteAgentAPI,
  fetchAgentMemoryLearningReportForAgent,
  type AgentMemoryLearningReport,
} from '@/lib/api'
import { buildAgentBrainSummary, type AgentBrainSummaryView } from '@/lib/agent-brain-summary'
import {
  localizeAgentHubDisplayText,
  localizeGeneratedAgentProfileName,
} from '@/lib/agenthub-display-text'
import { cn } from '@/lib/utils'
import { useAgentList, useAppStore } from '@/stores/app-store'

interface AgentLibraryProps {
  defaultSettingsOpen?: boolean
  settingsRequestKey?: number
  focusCapabilitiesOnSettingsOpen?: boolean
}

export function AgentLibrary({
  defaultSettingsOpen = false,
  settingsRequestKey = 0,
  focusCapabilitiesOnSettingsOpen = false,
}: AgentLibraryProps) {
  const agents = useAgentList()
  const removeAgent = useAppStore((s) => s.removeAgent)

  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null)
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(
    defaultSettingsOpen ? '__first__' : null,
  )
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(defaultSettingsOpen)
  const [settingsDismissed, setSettingsDismissed] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deleteTarget = deleteTargetId ? agents.find((agent) => agent.id === deleteTargetId) : null
  const settingsAgent = useMemo(() => {
    if (settingsAgentId === '__first__') return agents[0] ?? null
    return settingsAgentId ? agents.find((agent) => agent.id === settingsAgentId) ?? null : null
  }, [agents, settingsAgentId])
  const settingsOpen = Boolean(settingsAgent)

  useEffect(() => {
    if (settingsDismissed || settingsAgentId || agents.length === 0) return
    setSettingsAgentId(agents[0].id)
  }, [agents, settingsAgentId, settingsDismissed])

  useEffect(() => {
    if (settingsRequestKey <= 0) return
    setSettingsAgentId('__first__')
    setAdvancedSettingsOpen(true)
    setSettingsDismissed(false)
  }, [settingsRequestKey])

  const openCreate = () => {
    setEditingAgent(null)
    setFormOpen(true)
  }

  const openEdit = (agent: AgentRow) => {
    setEditingAgent(agent)
    setFormOpen(true)
  }

  const openSettings = (agent: AgentRow) => {
    setSettingsAgentId(agent.id)
    setAdvancedSettingsOpen(false)
    setSettingsDismissed(false)
  }

  const closeSettings = () => {
    setSettingsAgentId(null)
    setAdvancedSettingsOpen(false)
    setSettingsDismissed(true)
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingAgent(null)
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      await deleteAgentAPI(deleteTargetId)
      removeAgent(deleteTargetId)
      setDeleteTargetId(null)
      if (settingsAgentId === deleteTargetId) setSettingsAgentId(null)
    } catch (err) {
      console.error('[AgentLibrary] delete failed', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden max-lg:flex-col">
      <div
        className={cn(
          'flex min-h-0 flex-col',
          'shrink-0 border-r lg:w-[25rem]',
        )}
      >
        <div className="shrink-0 border-b px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">智能体</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                这里就是智能体设置入口。点卡片或齿轮，右侧直接配置模型、技能、工具、命令和权限。
              </p>
            </div>
            <Button className="shrink-0 gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              新建
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-2">
            {agents.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                还没有智能体，点击右上角新建一个。
              </div>
            ) : (
              agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  selected={settingsAgent?.id === agent.id}
                  onEdit={() => openEdit(agent)}
                  onSettings={() => openSettings(agent)}
                  onDelete={() => setDeleteTargetId(agent.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {settingsOpen && settingsAgent && (
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col border-t bg-background lg:border-t-0">
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-3 top-3 z-10"
            onClick={closeSettings}
            title="收起设置"
          >
            <X className="size-4" />
          </Button>
          <div className="shrink-0 border-b px-4 py-3 pr-12">
            <AgentSettingsOverview
              agent={settingsAgent}
              advancedOpen={advancedSettingsOpen}
              onEdit={() => openEdit(settingsAgent)}
              onToggleAdvanced={() => setAdvancedSettingsOpen((open) => !open)}
            />
          </div>
          {advancedSettingsOpen ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <AgentEmployeeSettingsPanel
                agent={settingsAgent}
                onEditBasic={() => openEdit(settingsAgent)}
                focusCapabilities={focusCapabilitiesOnSettingsOpen}
              />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid gap-3 p-4 lg:grid-cols-2">
                <AgentPlainSettingCard
                  icon={<Package className="size-4 text-primary" />}
                  title="技能与工具"
                  detail="已安装技能、MCP、CLI 和软件能力都分配给当前员工。"
                  action="分配能力"
                  onAction={() => setAdvancedSettingsOpen(true)}
                />
                <AgentPlainSettingCard
                  icon={<BrainCircuit className="size-4 text-primary" />}
                  title="记忆与上下文"
                  detail="客户偏好、项目状态、历史经验跟着这个员工走。"
                  action="设置记忆"
                  onAction={() => setAdvancedSettingsOpen(true)}
                />
                <AgentPlainSettingCard
                  icon={<ShieldCheck className="size-4 text-primary" />}
                  title="权限与安全"
                  detail="文件、命令、浏览器、电脑操作权限在员工里统一控制。"
                  action="调整权限"
                  onAction={() => setAdvancedSettingsOpen(true)}
                />
                <AgentPlainSettingCard
                  icon={<CheckCircle2 className="size-4 text-primary" />}
                  title="交付物"
                  detail="设置它最终交付报告、代码、图片、视频或文件包。"
                  action="设置交付"
                  onAction={() => setAdvancedSettingsOpen(true)}
                />
              </div>
            </ScrollArea>
          )}
        </section>
      )}

      {!settingsOpen && (
        <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-md border bg-card p-5 shadow-sm" data-testid="agent-settings-empty">
            <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Settings2 className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">选择一个智能体开始设置</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              不再单独维护“智能体工厂”。每个智能体自己的模型、技能、MCP、CLI、记忆、权限和交付物都在这里配置。
            </p>
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 px-3 py-2">1. 点左侧智能体卡片</div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">2. 打开右侧设置</div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">3. 勾选模型和能力</div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">4. 保存后交给画布运行</div>
            </div>
          </div>
        </section>
      )}

      <CreateAgentDialog
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        agent={editingAgent ?? undefined}
      />

      <Dialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除智能体</DialogTitle>
            <DialogDescription>
              确定删除「{localizeGeneratedAgentProfileName(deleteTarget?.name)}」吗？已经使用这个智能体的会话将无法继续使用它。这个操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
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

function AgentSettingsOverview({
  agent,
  advancedOpen,
  onEdit,
  onToggleAdvanced,
}: {
  agent: AgentRow
  advancedOpen: boolean
  onEdit: () => void
  onToggleAdvanced: () => void
}) {
  const toolCount = agent.skillIds.length + agent.mcpServerIds.length + agent.cliProfileIds.length
  const modelLabel = agent.modelId
    ? `${agent.modelProvider ?? '自定义'} / ${agent.modelId}`
    : '还未选择模型'
  const permissionHints = [
    agent.toolNames.some((name) => name.includes('fs') || name.includes('file')) ? '文件' : null,
    agent.toolNames.some((name) => name.includes('bash') || name.includes('command')) ||
    agent.cliProfileIds.length > 0
      ? '命令/CLI'
      : null,
    agent.toolNames.some((name) => name.includes('browser')) ? '浏览器' : null,
    agent.supportsVision ? '视觉' : null,
  ].filter(Boolean)
  const permissionLabel = permissionHints.length ? permissionHints.join('、') : '基础对话'
  const [memoryReport, setMemoryReport] = useState<AgentMemoryLearningReport | null>(null)
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memoryUnavailable, setMemoryUnavailable] = useState(false)
  const brainSummary = useMemo(
    () => (memoryReport ? buildAgentBrainSummary(memoryReport) : null),
    [memoryReport],
  )

  useEffect(() => {
    let cancelled = false
    setMemoryLoading(true)
    setMemoryUnavailable(false)
    setMemoryReport(null)
    fetchAgentMemoryLearningReportForAgent(agent.id)
      .then((report) => {
        if (!cancelled) setMemoryReport(report)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[AgentSettingsOverview] memory report unavailable', err)
        setMemoryUnavailable(true)
      })
      .finally(() => {
        if (!cancelled) setMemoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agent.id])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AgentAvatar agent={agent} size="md" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{localizeGeneratedAgentProfileName(agent.name)}</h2>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {safeAgentDisplayText(agent.description, '还没有填写岗位说明')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
            <Pencil className="size-3.5" />
            基础信息
          </Button>
          <Button size="sm" onClick={onToggleAdvanced} className="gap-1.5">
            <Settings2 className="size-3.5" />
            {advancedOpen ? '收起员工设置' : '打开员工设置'}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <OverviewTile icon={<Wrench className="size-3.5" />} label="模型" value={modelLabel} />
        <OverviewTile
          icon={<Package className="size-3.5" />}
          label="工具包"
          value={toolCount > 0 ? `${toolCount} 项能力` : '未分配'}
        />
        <OverviewTile
          icon={<ShieldCheck className="size-3.5" />}
          label="权限"
          value={permissionLabel}
        />
        <OverviewTile
          icon={<CheckCircle2 className="size-3.5" />}
          label="交付"
          value="在本员工内设置"
        />
      </div>

      <AgentBrainSummaryCard
        summary={brainSummary}
        loading={memoryLoading}
        unavailable={memoryUnavailable}
        onOpenSettings={onToggleAdvanced}
      />
    </div>
  )
}

function AgentBrainSummaryCard({
  summary,
  loading,
  unavailable,
  onOpenSettings,
}: {
  summary: AgentBrainSummaryView | null
  loading: boolean
  unavailable: boolean
  onOpenSettings: () => void
}) {
  const toneClass = summary
    ? summary.statusTone === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-300'
      : summary.statusTone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-300'
        : 'border-muted bg-muted/30 text-muted-foreground'
    : 'border-muted bg-muted/30 text-muted-foreground'

  const statusLabel = loading
    ? '读取中'
    : summary?.statusLabel ?? (unavailable ? '等待运行' : '暂无数据')

  return (
    <section className="rounded-md border bg-card p-3" data-testid="agent-brain-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BrainCircuit className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">员工大脑</h3>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', toneClass)}>
                {statusLabel}
              </span>
              {summary && <span className="text-[10px] text-muted-foreground">{summary.scoreText}</span>}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              这里展示这个员工自己的记忆、失败教训和工作手册状态。
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenSettings}>
          管理记忆
        </Button>
      </div>

      {loading ? (
        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          正在读取这个员工的记忆状态...
        </div>
      ) : summary ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            {summary.metrics.map((metric) => (
              <div key={metric.label} className="rounded-md border bg-muted/20 px-2.5 py-2">
                <div className="text-[10px] text-muted-foreground">{metric.label}</div>
                <div className="mt-1 text-sm font-semibold">{metric.value}</div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{metric.detail}</div>
              </div>
            ))}
          </div>
          {summary.emptyState && (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {summary.emptyState}
            </div>
          )}
          <div className="grid gap-2 lg:grid-cols-2">
            {summary.sections.map((section) => (
              <div key={section.title} className="rounded-md border bg-background/60 px-3 py-2">
                <div className="text-xs font-medium">{section.title}</div>
                <div className="mt-1 space-y-1">
                  {section.items.map((item) => (
                    <div key={item} className="truncate text-[11px] text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          暂时没有拿到员工记忆报告。等这个员工通过运行时执行任务后，会在这里显示经验和失败教训。
        </div>
      )}
    </section>
  )
}

function OverviewTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-xs font-medium">{value}</div>
    </div>
  )
}

function safeAgentDisplayText(value: string | null | undefined, fallback: string) {
  const text = value?.trim() ?? ''
  if (!text) return fallback
  return localizeAgentHubDisplayText(text, fallback)
}

function AgentPlainSettingCard({
  icon,
  title,
  detail,
  action,
  onAction,
}: {
  icon: ReactNode
  title: string
  detail: string
  action: string
  onAction: () => void
}) {
  return (
    <section className="rounded-md border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{detail}</p>
          <Button variant="outline" size="sm" onClick={onAction} className="mt-3 h-8">
            {action}
          </Button>
        </div>
      </div>
    </section>
  )
}

function AgentCard({
  agent,
  selected,
  onEdit,
  onSettings,
  onDelete,
}: {
  agent: AgentRow
  selected: boolean
  onEdit: () => void
  onSettings: () => void
  onDelete: () => void
}) {
  const capabilityCount = agent.skillIds.length + agent.mcpServerIds.length + agent.cliProfileIds.length
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSettings()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSettings}
      onKeyDown={handleCardKeyDown}
      data-testid="agent-card"
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-md border bg-card px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/50 hover:bg-muted/20',
      )}
      aria-label={`设置智能体 ${localizeGeneratedAgentProfileName(agent.name)}`}
    >
      <AgentAvatar agent={agent} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{localizeGeneratedAgentProfileName(agent.name)}</span>
          {agent.isBuiltin && (
            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              内置
            </span>
          )}
          {agent.isOrchestrator && (
            <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
              调度
            </span>
          )}
        </div>
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {safeAgentDisplayText(agent.description, '还没有填写岗位说明')}
        </div>
        {agent.modelId && (
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            模型：<span className="font-mono">{agent.modelId}</span>
          </div>
        )}
        <div
          className="mt-2 rounded-md border bg-muted/20 px-2 py-1.5"
          data-testid="agent-card-toolbox"
        >
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-foreground">
            <span>员工工具包</span>
            <span className="text-muted-foreground">
              {capabilityCount > 0 ? `${capabilityCount} 项能力` : '还没分配工具'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
            <span className="rounded bg-background px-1.5 py-0.5">技能 {agent.skillIds.length}</span>
            <span className="rounded bg-background px-1.5 py-0.5">MCP {agent.mcpServerIds.length}</span>
            <span className="rounded bg-background px-1.5 py-0.5">CLI {agent.cliProfileIds.length}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={selected ? 'default' : 'secondary'}
          className="h-8 gap-1.5 px-2.5"
          onClick={(event) => {
            event.stopPropagation()
            onSettings()
          }}
          title="设置智能体"
        >
          <Settings2 className="size-4" />
          <span>设置</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 opacity-70 transition hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation()
            onEdit()
          }}
          title="编辑基础信息"
        >
          <Pencil className="size-4" />
        </Button>
        {!agent.isBuiltin && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground transition hover:text-red-600"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            title="删除智能体"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

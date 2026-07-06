'use client'

import {
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Loader2,
  Package,
  Save,
  ShieldCheck,
  Terminal,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import type { AgentRow, CliProfileRow, McpServerRow, ModelProfileRow, SkillRow } from '@/db/schema'
import {
  approveLearningEvent,
  fetchCliProfiles,
  fetchAgentMemoryLearningReportForAgent,
  fetchMcpServers,
  fetchModelProfiles,
  fetchSkillsCenterData,
  rejectLearningEvent,
  updateAgent,
  type AgentMemoryLearningReport,
  type UpdateAgentBody,
} from '@/lib/api'
import { buildAgentBrainDetail, type AgentBrainDetailView } from '@/lib/agent-brain-summary'
import {
  AGENT_EMPLOYEE_SETTING_SECTIONS,
  buildAgentModelSelectionPatch,
  buildAgentSettingsCapabilitySummary,
} from '@/lib/agent-employee-settings'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'

interface AgentEmployeeSettingsPanelProps {
  agent: AgentRow
  onEditBasic: () => void
  focusCapabilities?: boolean
}

interface CapabilityCatalog {
  models: ModelProfileRow[]
  skills: SkillRow[]
  mcpServers: McpServerRow[]
  cliProfiles: CliProfileRow[]
}

const emptyCatalog: CapabilityCatalog = {
  models: [],
  skills: [],
  mcpServers: [],
  cliProfiles: [],
}

const BUILT_IN_TOOLS = [
  { id: 'read_artifact', label: '读取交付物', detail: '读取对话里已有的文件、文档和结果' },
  { id: 'write_artifact', label: '创建交付物', detail: '生成报告、代码、网页、表格或文件包' },
  { id: 'fs_list', label: '查看文件列表', detail: '浏览当前工作区目录' },
  { id: 'fs_read', label: '读取文件', detail: '读取工作区内的文件内容' },
  { id: 'fs_write', label: '写入文件', detail: '在工作区创建或修改文件' },
  { id: 'bash', label: '运行命令', detail: '执行本地命令和脚本' },
  { id: 'web_fetch', label: '联网读取', detail: '读取网页、文档或接口返回' },
  { id: 'browser_open', label: '操作浏览器', detail: '打开页面、点击、输入和截图' },
  { id: 'ask_user', label: '需要时询问', detail: '遇到关键风险时向用户确认' },
]

const OUTPUT_OPTIONS = ['报告', '代码', '图片', '视频', '文档', '表格', '文件包', '结构化数据']

export function AgentEmployeeSettingsPanel({
  agent,
  onEditBasic,
  focusCapabilities = false,
}: AgentEmployeeSettingsPanelProps) {
  const upsertAgent = useAppStore((s) => s.upsertAgent)

  const [catalog, setCatalog] = useState<CapabilityCatalog>(emptyCatalog)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [memoryReport, setMemoryReport] = useState<AgentMemoryLearningReport | null>(null)
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memoryUnavailable, setMemoryUnavailable] = useState(false)
  const [memoryReviewBusyId, setMemoryReviewBusyId] = useState<string | null>(null)

  const [selectedModelKey, setSelectedModelKey] = useState('')
  const [selectedToolNames, setSelectedToolNames] = useState<Set<string>>(new Set(agent.toolNames))
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set(agent.skillIds))
  const [selectedMcpServerIds, setSelectedMcpServerIds] = useState<Set<string>>(
    new Set(agent.mcpServerIds),
  )
  const [selectedCliProfileIds, setSelectedCliProfileIds] = useState<Set<string>>(
    new Set(agent.cliProfileIds),
  )
  const [capabilitiesText, setCapabilitiesText] = useState(agent.capabilities.join('、'))
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt)
  const [outputExpectation, setOutputExpectation] = useState(
    agent.capabilities.find((item) => OUTPUT_OPTIONS.some((option) => item.includes(option))) ??
      '按任务要求交付可复用结果',
  )

  useEffect(() => {
    setSelectedToolNames(new Set(agent.toolNames))
    setSelectedSkillIds(new Set(agent.skillIds))
    setSelectedMcpServerIds(new Set(agent.mcpServerIds))
    setSelectedCliProfileIds(new Set(agent.cliProfileIds))
    setCapabilitiesText(agent.capabilities.join('、'))
    setSystemPrompt(agent.systemPrompt)
    setOutputExpectation(
      agent.capabilities.find((item) => OUTPUT_OPTIONS.some((option) => item.includes(option))) ??
        '按任务要求交付可复用结果',
    )
  }, [agent])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchModelProfiles(),
      fetchSkillsCenterData(),
      fetchMcpServers(),
      fetchCliProfiles(),
    ])
      .then(([models, skillsData, mcpServers, cliProfiles]) => {
        if (cancelled) return
        setCatalog({
          models,
          skills: skillsData.skills.filter((skill) => skill.enabled),
          mcpServers: mcpServers.filter((server) => server.enabled),
          cliProfiles,
        })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[AgentEmployeeSettingsPanel] load failed', err)
        setError('加载员工能力失败，请刷新后再试。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const currentModel = catalog.models.find((model) => {
      const patch = buildAgentModelSelectionPatch(model)
      return (
        patch &&
        patch.modelProvider === agent.modelProvider &&
        patch.modelId === agent.modelId &&
        (!agent.apiBaseUrl || patch.apiBaseUrl === agent.apiBaseUrl)
      )
    })
    setSelectedModelKey(currentModel ? currentModel.id : '')
  }, [agent.apiBaseUrl, agent.modelId, agent.modelProvider, catalog.models])

  const summary = useMemo(
    () =>
      buildAgentSettingsCapabilitySummary({
        toolNames: Array.from(selectedToolNames),
        skillIds: Array.from(selectedSkillIds),
        mcpServerIds: Array.from(selectedMcpServerIds),
        cliProfileIds: Array.from(selectedCliProfileIds),
      }),
    [selectedCliProfileIds, selectedMcpServerIds, selectedSkillIds, selectedToolNames],
  )
  const brainDetail = useMemo(
    () => (memoryReport ? buildAgentBrainDetail(memoryReport) : null),
    [memoryReport],
  )

  const selectedModel = catalog.models.find((model) => model.id === selectedModelKey) ?? null

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
        console.warn('[AgentEmployeeSettingsPanel] memory report unavailable', err)
        setMemoryUnavailable(true)
      })
      .finally(() => {
        if (!cancelled) setMemoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agent.id])

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSavedNotice(null)
    try {
      const patch: UpdateAgentBody = {
        toolNames: Array.from(selectedToolNames),
        skillIds: Array.from(selectedSkillIds),
        mcpServerIds: Array.from(selectedMcpServerIds),
        cliProfileIds: Array.from(selectedCliProfileIds),
        capabilities: normalizeLines(capabilitiesText, outputExpectation),
        systemPrompt: systemPrompt.trim() || agent.systemPrompt,
      }

      if (selectedModel) {
        const modelPatch = buildAgentModelSelectionPatch(selectedModel)
        if (modelPatch) Object.assign(patch, modelPatch)
      }

      const updated = await updateAgent(agent.id, patch)
      upsertAgent(updated)
      try {
        setMemoryLoading(true)
        const report = await fetchAgentMemoryLearningReportForAgent(updated.id)
        setMemoryReport(report)
        setMemoryUnavailable(false)
      } catch (memoryErr) {
        console.warn('[AgentEmployeeSettingsPanel] memory report refresh failed', memoryErr)
        setMemoryUnavailable(true)
      } finally {
        setMemoryLoading(false)
      }
      setSavedNotice('已保存到这个智能体。')
    } catch (err) {
      console.error('[AgentEmployeeSettingsPanel] save failed', err)
      setError('保存失败，请检查模型和能力是否仍然存在。')
    } finally {
      setSaving(false)
    }
  }

  const reviewBrainLearningEvent = async (
    eventId: string,
    action: 'approve' | 'reject',
  ) => {
    setMemoryReviewBusyId(`${action}:${eventId}`)
    setError(null)
    setSavedNotice(null)
    try {
      if (action === 'approve') {
        await approveLearningEvent(eventId, '从 Agent 设置里收录这条经验')
      } else {
        await rejectLearningEvent(eventId, '从 Agent 设置里忽略这条经验')
      }
      setMemoryLoading(true)
      const report = await fetchAgentMemoryLearningReportForAgent(agent.id)
      setMemoryReport(report)
      setMemoryUnavailable(false)
      setSavedNotice(action === 'approve' ? '已收录到这个员工的大脑。' : '已忽略这条学习建议。')
    } catch (err) {
      console.error('[AgentEmployeeSettingsPanel] review learning failed', err)
      setError('审核学习结果失败，请刷新后再试。')
    } finally {
      setMemoryLoading(false)
      setMemoryReviewBusyId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-6">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {AGENT_EMPLOYEE_SETTING_SECTIONS.map((section) => (
          <section key={section.id} className="rounded-md border bg-card px-3 py-2">
            <div className="text-xs font-semibold">{section.label}</div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
              {section.description}
            </p>
          </section>
        ))}
      </div>

      <section className="rounded-md border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">员工设置</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              这里只负责给这个员工分配已经配置好的模型、技能、MCP、CLI 和交付要求。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savedNotice && <span className="text-xs text-emerald-600">{savedNotice}</span>}
            <Button variant="outline" size="sm" onClick={onEditBasic}>
              基础信息
            </Button>
            <Button size="sm" onClick={() => void saveSettings()} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              保存设置
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="space-y-4">
            <SettingsBlock
              icon={<Cpu className="size-4 text-primary" />}
              title="选择模型"
              description="模型只从模型管理里挑选；这里不会出现密钥、接口地址、网络出口表单。"
            >
              {loading ? (
                <LoadingLine label="正在读取模型" />
              ) : catalog.models.length === 0 ? (
                <EmptyLine label="还没有模型。请先在模型管理里添加模型。" />
              ) : (
                <select
                  value={selectedModelKey}
                  onChange={(event) => setSelectedModelKey(event.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">暂不指定模型</option>
                  {catalog.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} / {model.provider} / {model.model}
                    </option>
                  ))}
                </select>
              )}
              {selectedModel && (
                <div className="mt-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  当前选择：{selectedModel.name}，状态 {statusLabel(selectedModel.healthStatus)}。
                </div>
              )}
            </SettingsBlock>

            <SettingsBlock
              icon={<Package className="size-4 text-primary" />}
              title="员工工具包"
              description="勾选这个员工可以使用的 Skills、MCP、CLI 和内置工具。"
              highlight={focusCapabilities}
            >
              <CapabilityGroup
                title="Skills"
                emptyLabel="还没有可用技能"
                items={catalog.skills.map((skill) => ({
                  id: skill.id,
                  title: skill.name,
                  detail: skill.description || skill.source,
                }))}
                selectedIds={selectedSkillIds}
                onToggle={(id) => toggleSetValue(setSelectedSkillIds, id)}
              />
              <CapabilityGroup
                title="MCP 工具"
                emptyLabel="还没有可用 MCP 工具"
                items={catalog.mcpServers.map((server) => ({
                  id: server.id,
                  title: server.displayName,
                  detail: `${server.transport} / ${statusLabel(server.healthStatus)}`,
                }))}
                selectedIds={selectedMcpServerIds}
                onToggle={(id) => toggleSetValue(setSelectedMcpServerIds, id)}
              />
              <CapabilityGroup
                title="CLI 命令"
                emptyLabel="还没有可用 CLI 命令"
                items={catalog.cliProfiles.map((profile) => ({
                  id: profile.id,
                  title: profile.name,
                  detail: `${profile.command} / ${statusLabel(profile.healthStatus)}`,
                }))}
                selectedIds={selectedCliProfileIds}
                onToggle={(id) => toggleSetValue(setSelectedCliProfileIds, id)}
              />
            </SettingsBlock>
          </div>

          <div className="space-y-4">
            <SettingsBlock
              icon={<Wrench className="size-4 text-primary" />}
              title="内置工具"
              description="这些是系统自带能力，适合普通员工直接勾选。"
            >
              <div className="grid gap-2">
                {BUILT_IN_TOOLS.map((tool) => (
                  <label
                    key={tool.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition hover:border-primary/50',
                      selectedToolNames.has(tool.id) && 'border-primary bg-primary/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedToolNames.has(tool.id)}
                      onChange={() => toggleSetValue(setSelectedToolNames, tool.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{tool.label}</span>
                      <span className="block text-[11px] leading-4 text-muted-foreground">
                        {tool.detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </SettingsBlock>

            <SettingsBlock
              icon={<ShieldCheck className="size-4 text-primary" />}
              title="权限边界"
              description="普通任务自动执行，删除文件、安装依赖、登录发送消息等高风险动作仍进入确认。"
            >
              <div className="grid gap-2 text-xs">
                <PermissionRow label="读取资料" value="自动允许" />
                <PermissionRow
                  label="写入工作区"
                  value={selectedToolNames.has('fs_write') ? '允许' : '未开启'}
                />
                <PermissionRow
                  label="运行命令"
                  value={selectedToolNames.has('bash') || selectedCliProfileIds.size > 0 ? '按风险执行' : '未开启'}
                />
                <PermissionRow
                  label="浏览器操作"
                  value={selectedToolNames.has('browser_open') ? '允许普通网页操作' : '未开启'}
                />
              </div>
            </SettingsBlock>

            <SettingsBlock
              icon={<BrainCircuit className="size-4 text-primary" />}
              title="记忆学习"
              description="默认记录项目经验和客户偏好；新流程沉淀为长期经验前需要用户确认。"
            >
              {memoryLoading ? (
                <LoadingLine label="正在读取员工大脑" />
              ) : brainDetail ? (
                <AgentBrainDetailPanel
                  detail={brainDetail}
                  reviewBusyId={memoryReviewBusyId}
                  onApproveLearning={(eventId) => void reviewBrainLearningEvent(eventId, 'approve')}
                  onRejectLearning={(eventId) => void reviewBrainLearningEvent(eventId, 'reject')}
                />
              ) : (
                <EmptyLine
                  label={
                    memoryUnavailable
                      ? '暂时没有拿到这个员工的记忆报告，运行任务后会自动重试。'
                      : '这个员工还没有记忆报告。'
                  }
                />
              )}
              <div className="mt-3 text-xs font-medium">长期工作规则</div>
              <textarea
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.target.value)}
                className="mt-2 min-h-28 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="写给这个员工的长期工作规则"
              />
            </SettingsBlock>

            <SettingsBlock
              icon={<CheckCircle2 className="size-4 text-primary" />}
              title="交付产物"
              description="规定这个员工完成任务时必须交付什么。"
            >
              <div className="flex flex-wrap gap-2">
                {OUTPUT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setOutputExpectation(option)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition hover:border-primary/50',
                      outputExpectation === option && 'border-primary bg-primary text-primary-foreground',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <input
                value={outputExpectation}
                onChange={(event) => setOutputExpectation(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="例如：交付一份客户可见的报告"
              />
              <textarea
                value={capabilitiesText}
                onChange={(event) => setCapabilitiesText(event.target.value)}
                className="mt-2 min-h-20 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="用顿号或换行写这个员工擅长什么"
              />
            </SettingsBlock>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">当前员工工具包</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              合计 {summary.total} 项能力：Skills {summary.skills}、MCP {summary.mcpServers}、CLI{' '}
              {summary.cliProfiles}、内置工具 {summary.tools}。
            </p>
          </div>
          <Terminal className="size-5 text-muted-foreground" />
        </div>
      </section>
    </div>
  )
}

function SettingsBlock({
  icon,
  title,
  description,
  children,
  highlight = false,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
  highlight?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-md border bg-card p-4',
        highlight && 'border-primary shadow-sm shadow-primary/10',
      )}
    >
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function AgentBrainDetailPanel({
  detail,
  reviewBusyId,
  onApproveLearning,
  onRejectLearning,
}: {
  detail: AgentBrainDetailView
  reviewBusyId: string | null
  onApproveLearning: (eventId: string) => void
  onRejectLearning: (eventId: string) => void
}) {
  const toneClass =
    detail.statusTone === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-300'
      : detail.statusTone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-300'
        : 'border-muted bg-muted/30 text-muted-foreground'

  return (
    <div className="space-y-3" data-testid="agent-brain-detail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold">{detail.title}</div>
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', toneClass)}>
          {detail.statusLabel}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {detail.recallFlow.map((item) => (
          <MiniStat key={item.label} item={item} />
        ))}
      </div>

      <BrainLoopPanel items={detail.brainLoop} />

      <div className="grid gap-2 sm:grid-cols-2">
        {detail.memoryBoundaries.map((item) => (
          <MiniStat key={item.label} item={item} />
        ))}
      </div>

      <LearningTraceList items={detail.learningTrace} />

      <div className="grid gap-2 lg:grid-cols-2">
        <DetailList title="最近会注入的上下文" emptyLabel="暂无可召回经验" items={detail.recentContext} />
        <ReviewItemList
          items={detail.reviewItems}
          busyId={reviewBusyId}
          onApprove={onApproveLearning}
          onReject={onRejectLearning}
        />
        <DetailList title="可用工作手册" emptyLabel="暂无启用的工作手册" items={detail.playbooks} />
        <DetailList title="下一步建议" emptyLabel="暂无建议" items={detail.recommendations} />
      </div>
    </div>
  )
}

function BrainLoopPanel({ items }: { items: AgentBrainDetailView['brainLoop'] }) {
  return (
    <div className="rounded-md border bg-background/60 px-3 py-2">
      <div className="text-xs font-medium">脑内工作流</div>
      <div className="mt-2 grid gap-2 md:grid-cols-5">
        {items.map((item, index) => (
          <div key={item.label} className="min-w-0 rounded-md border bg-muted/15 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]', brainLoopStateClass(item.state))}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{item.label}</span>
            </div>
            <div className="mt-1 truncate text-xs font-semibold">{item.value}</div>
            <div className="mt-1 line-clamp-3 text-[10px] leading-4 text-muted-foreground">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function brainLoopStateClass(state: AgentBrainDetailView['brainLoop'][number]['state']) {
  if (state === 'ready') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (state === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

function LearningTraceList({ items }: { items: AgentBrainDetailView['learningTrace'] }) {
  return (
    <div className="rounded-md border bg-background/60 px-3 py-2">
      <div className="text-xs font-medium">最近学习轨迹</div>
      <div className="mt-2 space-y-2">
        {items.length ? (
          items.slice(0, 3).map((item) => (
            <div key={`${item.badge}:${item.title}`} className="rounded-md border bg-muted/15 px-2.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                  {item.title}
                </span>
                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px]', traceToneClass(item.tone))}>
                  {item.badge}
                </span>
              </div>
              <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{item.detail}</div>
              <div className="mt-2 space-y-1">
                {item.items.slice(0, 4).map((line) => (
                  <div key={line} className="truncate text-[11px] text-muted-foreground">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-[11px] text-muted-foreground">
            还没有运行复盘。这个员工完成任务后，会在这里显示它学到了什么、哪里失败过、哪些经验需要确认。
          </div>
        )}
      </div>
    </div>
  )
}

function traceToneClass(tone: AgentBrainDetailView['learningTrace'][number]['tone']) {
  if (tone === 'ready') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (tone === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

function MiniStat({ item }: { item: { label: string; value: string; detail: string } }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{item.label}</div>
      <div className="mt-1 truncate text-xs font-semibold">{item.value}</div>
      <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
        {item.detail}
      </div>
    </div>
  )
}

function ReviewItemList({
  items,
  busyId,
  onApprove,
  onReject,
}: {
  items: AgentBrainDetailView['reviewItems']
  busyId: string | null
  onApprove: (eventId: string) => void
  onReject: (eventId: string) => void
}) {
  return (
    <div className="rounded-md border bg-background/60 px-3 py-2">
      <div className="text-xs font-medium">需要确认</div>
      <div className="mt-2 space-y-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <div key={item.title} className="rounded-md border bg-muted/15 px-2.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                  {item.title}
                </span>
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {item.badge}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                {item.detail}
              </div>
              {item.eventId && (
                <div className="mt-2 flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={busyId === `approve:${item.eventId}` || busyId === `reject:${item.eventId}`}
                    onClick={() => onApprove(item.eventId!)}
                  >
                    {busyId === `approve:${item.eventId}` && <Loader2 className="size-3 animate-spin" />}
                    收录
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={busyId === `approve:${item.eventId}` || busyId === `reject:${item.eventId}`}
                    onClick={() => onReject(item.eventId!)}
                  >
                    {busyId === `reject:${item.eventId}` && <Loader2 className="size-3 animate-spin" />}
                    忽略
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-[11px] text-muted-foreground">暂无待审核项</div>
        )}
      </div>
    </div>
  )
}

function DetailList({
  title,
  emptyLabel,
  items,
}: {
  title: string
  emptyLabel: string
  items: string[]
}) {
  return (
    <div className="rounded-md border bg-background/60 px-3 py-2">
      <div className="text-xs font-medium">{title}</div>
      <div className="mt-1 space-y-1">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <div key={item} className="truncate text-[11px] text-muted-foreground">
              {item}
            </div>
          ))
        ) : (
          <div className="text-[11px] text-muted-foreground">{emptyLabel}</div>
        )}
      </div>
    </div>
  )
}

function CapabilityGroup({
  title,
  emptyLabel,
  items,
  selectedIds,
  onToggle,
}: {
  title: string
  emptyLabel: string
  items: Array<{ id: string; title: string; detail: string }>
  selectedIds: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold">
        <span>{title}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {selectedIds.size} 已选
        </span>
      </div>
      {items.length === 0 ? (
        <EmptyLine label={emptyLabel} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <label
              key={item.id}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition hover:border-primary/50',
                selectedIds.has(item.id) && 'border-primary bg-primary/5',
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => onToggle(item.id)}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{item.title}</span>
                <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                  {item.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function PermissionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/20 px-3 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      {label}
    </div>
  )
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-center text-xs text-muted-foreground">
      {label}
    </div>
  )
}

function toggleSetValue(setter: Dispatch<SetStateAction<Set<string>>>, value: string) {
  setter((current) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })
}

function normalizeLines(capabilitiesText: string, outputExpectation: string) {
  const items = capabilitiesText
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
  const output = outputExpectation.trim()
  if (output && !items.includes(output)) items.unshift(output)
  return items.length > 0 ? items : ['按任务要求交付可复用结果']
}

function statusLabel(status: string) {
  if (status === 'ok') return '可用'
  if (status === 'failed') return '异常'
  return '未检测'
}

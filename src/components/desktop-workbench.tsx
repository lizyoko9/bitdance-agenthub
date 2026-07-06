'use client'

import {
  Activity,
  AlertCircle,
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  Code2,
  Film,
  FileCheck2,
  FolderKanban,
  GitBranch,
  Globe2,
  MonitorCog,
  PackageCheck,
  Play,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { SidebarMode } from '@/components/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type {
  AgentEnvironment,
  AgentProfileRow,
  AgentRow,
  CliProfileRow,
  ConversationWithMeta,
  ModelProfileRow,
  SkillRow,
  SoftwareProfileRow,
  ToolConnectionRow,
} from '@/db/schema'
import {
  createConversation,
  fetchAgents,
  fetchAgentEnvironmentPreview,
  fetchAgentProfiles,
  fetchAppModuleManagerView,
  fetchCliProfiles,
  fetchConversations,
  fetchEmployeeRunSnapshot,
  fetchModelProfiles,
  fetchRunActivitySummary,
  fetchSkillsCenterData,
  fetchSoftwareProfiles,
  fetchToolConnections,
  sendMessage,
  startEmployeeRun,
  type EmployeeRunSnapshot,
  type RunActivitySummary,
} from '@/lib/api'
import type { AgentHubModuleManagerView } from '@/lib/agenthub-module-manager'
import { inferBusinessWorkbenchProfile } from '@/lib/business-workbench-model'
import {
  buildEmployeeRunBrainDigest,
  type EmployeeRunBrainDigest,
} from '@/lib/employee-run-brain-digest'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'

interface DesktopWorkbenchProps {
  onModeChange: (mode: SidebarMode) => void
}

interface ReadinessItem {
  label: string
  status: string
  detail: string
  ready: boolean
  mode: SidebarMode
  icon: ReactNode
}

interface BusinessMetric {
  label: string
  value: string
  detail: string
  icon: ReactNode
  tone: 'blue' | 'green' | 'amber' | 'red' | 'neutral'
}

interface BusinessLane {
  label: string
  count: number
  detail: string
  runs: RunActivitySummary['recentRuns']
  tone: 'blue' | 'green' | 'amber' | 'red' | 'neutral'
}

interface BusinessWorkbenchState {
  name: string
  signal: string
  focus: string
  nextAction: string
  aiEditSummary: string
  metrics: BusinessMetric[]
  lanes: BusinessLane[]
  modules: Array<{
    label: string
    value: string
    detail: string
    icon: ReactNode
  }>
}

const taskPresets = [
  { label: '操作电脑', value: '帮我操作电脑完成一个具体任务，并把结果截图和日志交付给我。' },
  { label: '写代码', value: '帮我检查当前项目，完成代码修改、运行测试，并说明结果。' },
  { label: '浏览器调研', value: '打开浏览器搜集资料，整理成一份可交付报告。' },
  { label: '剪映任务', value: '帮我准备剪映自动化任务，检查素材、草稿和可执行命令。' },
  { label: '微信任务', value: '帮我检查微信桌面端状态，整理可执行的人工确认操作方案。' },
]

const capabilityCards = [
  {
    icon: <Globe2 className="size-4" />,
    title: '浏览器',
    body: '独立页面、搜索资料、网页操作',
    mode: 'tools' as SidebarMode,
  },
  {
    icon: <Terminal className="size-4" />,
    title: '终端 CLI',
    body: 'Codex、脚本、软件命令统一接入',
    mode: 'tools' as SidebarMode,
  },
  {
    icon: <FolderKanban className="size-4" />,
    title: '文件工作区',
    body: '每个任务有自己的产物和日志',
    mode: 'artifacts' as SidebarMode,
  },
  {
    icon: <MonitorCog className="size-4" />,
    title: '电脑操作',
    body: '真实桌面先加锁，避免互相抢鼠标',
    mode: 'tools' as SidebarMode,
  },
]

function inferDeliverables(goal: string) {
  const text = goal.toLowerCase()
  const items = [
    {
      label: '执行报告',
      body: '做了什么、卡在哪里、下一步是什么',
      icon: <FileCheck2 className="size-4" />,
      match: true,
    },
    {
      label: '代码或补丁',
      body: '源码修改、测试结果、可回滚记录',
      icon: <Code2 className="size-4" />,
      match: text.includes('代码') || text.includes('修') || text.includes('项目') || text.includes('cli'),
    },
    {
      label: '视频/剪映产物',
      body: '草稿、导出文件、素材检查结果',
      icon: <Film className="size-4" />,
      match: text.includes('视频') || text.includes('剪映') || text.includes('capcut'),
    },
    {
      label: '截图与操作日志',
      body: '电脑、浏览器或软件操作证据',
      icon: <MonitorCog className="size-4" />,
      match: text.includes('电脑') || text.includes('浏览器') || text.includes('微信') || text.includes('截图'),
    },
  ]
  const matched = items.filter((item) => item.match)
  return matched.length ? matched.slice(0, 3) : items.slice(0, 2)
}

function inferWorkPackage(goal: string, workMode: 'team' | 'model') {
  const text = goal.toLowerCase()
  const packageItems = [
    {
      label: workMode === 'team' ? '员工编排' : '普通模型',
      body: workMode === 'team' ? '按员工配置创建真实运行记录' : '直接进入单模型聊天窗口',
      icon: workMode === 'team' ? <Bot className="size-4" /> : <Brain className="size-4" />,
      active: true,
    },
    {
      label: '长会话缓存',
      body: '追加式上下文，优先保持稳定前缀',
      icon: <Sparkles className="size-4" />,
      active: true,
    },
    {
      label: '代码 / 文件',
      body: '读写项目文件、运行测试、交付补丁',
      icon: <Code2 className="size-4" />,
      active: text.includes('代码') || text.includes('项目') || text.includes('修') || text.includes('测试'),
    },
    {
      label: '浏览器',
      body: '搜索资料、打开网页、采集页面信息',
      icon: <Globe2 className="size-4" />,
      active: text.includes('浏览器') || text.includes('搜索') || text.includes('资料') || text.includes('网页'),
    },
    {
      label: '软件 CLI',
      body: '调用已接入的软件命令和自动化脚本',
      icon: <Terminal className="size-4" />,
      active: text.includes('cli') || text.includes('剪映') || text.includes('微信') || text.includes('软件'),
    },
    {
      label: '桌面锁',
      body: '真实鼠标键盘串行加锁，避免互相干扰',
      icon: <MonitorCog className="size-4" />,
      active: text.includes('电脑') || text.includes('桌面') || text.includes('微信') || text.includes('剪映') || text.includes('截图'),
    },
  ]
  const activeItems = packageItems.filter((item) => item.active)
  return activeItems.length >= 4 ? activeItems : packageItems.slice(0, 4)
}

function buildBusinessWorkbench(args: {
  goal: string
  recentConversations: ConversationWithMeta[]
  runActivity: RunActivitySummary | null
  enabledSkillCount: number
  softwareProfiles: SoftwareProfileRow[]
  activeEmployeeCount: number
  modelCount: number
  readyModelCount: number
  toolEntryCount: number
}): BusinessWorkbenchState {
  const corpus = [
    args.goal,
    ...args.recentConversations.map((conversation) => conversation.title),
    ...args.softwareProfiles.map((software) => `${software.name} ${software.appType}`),
  ].join(' ').toLowerCase()
  const totals = args.runActivity?.totals
  const recentRuns = args.runActivity?.recentRuns ?? []
  const liveRuns = recentRuns.filter((run) => run.status === 'running' || run.status === 'queued')
  const doneRuns = recentRuns.filter((run) => run.status === 'complete')
  const blockedRuns = recentRuns.filter((run) => ['failed', 'aborted', 'paused'].includes(run.status))
  const waitingRuns = recentRuns.filter((run) => run.status === 'queued')
  const liveCount = (totals?.running ?? 0) + (totals?.queued ?? 0)
  const failedToday = totals?.failedToday ?? 0
  const completedToday = totals?.completedToday ?? 0
  const artifactCount = totals?.artifacts ?? 0
  const business = inferBusinessWorkbenchProfile(corpus)

  const nextAction =
    args.readyModelCount === 0 && args.modelCount === 0
      ? '先添加一个可用模型'
      : args.activeEmployeeCount === 0
        ? '先创建至少一位员工'
        : failedToday > 0
          ? '优先处理失败任务'
          : liveCount > 0
            ? '盯住正在运行的任务'
            : '可以直接派发新任务'

  return {
    name: business.name,
    signal: business.signal,
    focus: business.focus,
    nextAction,
    aiEditSummary: liveCount > 0
      ? '工作台已把运行现场放到前面'
      : artifactCount > 0
        ? '工作台已把交付结果放到前面'
        : '工作台已按当前业务自动整理',
    metrics: [
      {
        label: '当前业务',
        value: business.name,
        detail: business.signal,
        icon: <Sparkles className="size-4" />,
        tone: 'blue',
      },
      {
        label: '任务流转',
        value: `${liveCount}`,
        detail: `${totals?.running ?? 0} 运行中 · ${totals?.queued ?? 0} 排队`,
        icon: <Activity className="size-4" />,
        tone: liveCount > 0 ? 'blue' : 'neutral',
      },
      {
        label: '客户可见结果',
        value: `${artifactCount}`,
        detail: `${completedToday} 个今日完成`,
        icon: <PackageCheck className="size-4" />,
        tone: artifactCount > 0 ? 'green' : 'neutral',
      },
      {
        label: '待处理风险',
        value: `${failedToday}`,
        detail: failedToday > 0 ? '需要人工查看' : '暂无明显阻塞',
        icon: failedToday > 0 ? <AlertCircle className="size-4" /> : <ShieldCheck className="size-4" />,
        tone: failedToday > 0 ? 'red' : 'green',
      },
    ],
    lanes: [
      {
        label: '正在推进',
        count: liveRuns.length,
        detail: liveRuns.length ? '这些任务正在执行或等待执行' : '当前没有运行中的任务',
        runs: liveRuns,
        tone: 'blue',
      },
      {
        label: '等待处理',
        count: waitingRuns.length + blockedRuns.length,
        detail: blockedRuns.length ? '存在失败或暂停任务' : '需要关注的排队任务',
        runs: [...blockedRuns, ...waitingRuns],
        tone: blockedRuns.length ? 'red' : 'amber',
      },
      {
        label: '最近结果',
        count: doneRuns.length,
        detail: doneRuns.length ? '这些任务已经有结果' : '完成后会在这里沉淀',
        runs: doneRuns,
        tone: 'green',
      },
    ],
    modules: [
      {
        label: '业务指标',
        value: `${args.readyModelCount}/${args.modelCount || 0} 模型`,
        detail: '按业务目标展示最关键指标',
        icon: <Brain className="size-4" />,
      },
      {
        label: '任务步骤',
        value: `${recentRuns.length} 条记录`,
        detail: '每个任务当前步骤和结果汇总',
        icon: <Clock3 className="size-4" />,
      },
      {
        label: '员工能力',
        value: `${args.activeEmployeeCount} 员工`,
        detail: `${args.enabledSkillCount} 技能 · ${args.toolEntryCount} 工具入口`,
        icon: <Bot className="size-4" />,
      },
      {
        label: '交付物',
        value: `${artifactCount} 产物`,
        detail: '报告、代码、视频、截图等客户可见结果',
        icon: <FileCheck2 className="size-4" />,
      },
    ],
  }
}

export function DesktopWorkbench({ onModeChange }: DesktopWorkbenchProps) {
  const upsertConversation = useAppStore((s) => s.upsertConversation)
  const setActiveConversation = useAppStore((s) => s.setActiveConversation)
  const addLocalUserMessage = useAppStore((s) => s.addLocalUserMessage)
  const replaceLocalMessageId = useAppStore((s) => s.replaceLocalMessageId)
  const upsertMessage = useAppStore((s) => s.upsertMessage)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [employeeProfiles, setEmployeeProfiles] = useState<AgentProfileRow[]>([])
  const [models, setModels] = useState<ModelProfileRow[]>([])
  const [cliProfiles, setCliProfiles] = useState<CliProfileRow[]>([])
  const [toolConnections, setToolConnections] = useState<ToolConnectionRow[]>([])
  const [softwareProfiles, setSoftwareProfiles] = useState<SoftwareProfileRow[]>([])
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([])
  const [runActivity, setRunActivity] = useState<RunActivitySummary | null>(null)
  const [moduleManager, setModuleManager] = useState<AgentHubModuleManagerView | null>(null)
  const [goal, setGoal] = useState('')
  const [workMode, setWorkMode] = useState<'team' | 'model'>('team')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const readyModels = useMemo(
    () => models.filter((model) => model.healthStatus === 'ok'),
    [models],
  )
  const activeEmployeeProfiles = useMemo(
    () => employeeProfiles.filter((profile) => profile.status !== 'archived').slice(0, 6),
    [employeeProfiles],
  )
  const selectedAgents = useMemo(
    () => (workMode === 'team' ? agents.slice(0, Math.min(3, agents.length)) : []),
    [agents, workMode],
  )
  const selectedEmployeeProfiles = useMemo(
    () => (workMode === 'team' ? activeEmployeeProfiles.slice(0, Math.min(3, activeEmployeeProfiles.length)) : []),
    [activeEmployeeProfiles, workMode],
  )
  const selectedModel = readyModels[0] ?? models[0] ?? null
  const recentConversations = useMemo(
    () => conversations.filter((conversation) => !conversation.archived).slice(0, 5),
    [conversations],
  )
  const trimmedGoal = goal.trim()
  const deliverables = useMemo(() => inferDeliverables(trimmedGoal), [trimmedGoal])
  const workPackage = useMemo(() => inferWorkPackage(trimmedGoal, workMode), [trimmedGoal, workMode])
  const enabledSkills = useMemo(() => skills.filter((skill) => skill.enabled), [skills])
  const usableToolConnections = useMemo(
    () => toolConnections.filter((connection) => connection.enabled),
    [toolConnections],
  )
  const toolEntryCount = cliProfiles.length + usableToolConnections.length + softwareProfiles.length
  const businessWorkbench = useMemo(
    () => buildBusinessWorkbench({
      goal: trimmedGoal,
      recentConversations,
      runActivity,
      enabledSkillCount: enabledSkills.length,
      softwareProfiles,
      activeEmployeeCount: activeEmployeeProfiles.length,
      modelCount: models.length,
      readyModelCount: readyModels.length,
      toolEntryCount,
    }),
    [
      activeEmployeeProfiles.length,
      enabledSkills.length,
      models.length,
      readyModels.length,
      recentConversations,
      runActivity,
      softwareProfiles,
      toolEntryCount,
      trimmedGoal,
    ],
  )
  const readinessItems = useMemo<ReadinessItem[]>(() => {
    return [
      {
        label: '模型可用',
        status: readyModels.length ? `${readyModels.length} 个已连接` : models.length ? `${models.length} 个待检测` : '未配置',
        detail: readyModels.length
          ? '普通对话和员工运行都能选择模型'
          : models.length
            ? '建议先测试连接，避免任务启动后失败'
            : '先添加 DeepSeek、OpenAI 或本地模型',
        ready: readyModels.length > 0,
        mode: 'models',
        icon: <Brain className="size-4" />,
      },
      {
        label: '员工可运行',
        status: activeEmployeeProfiles.length ? `${activeEmployeeProfiles.length} 位员工` : '未创建',
        detail: activeEmployeeProfiles.length
          ? '可以直接派活，也可以进入智能体设置微调'
          : '先创建一个能执行任务的智能体员工',
        ready: activeEmployeeProfiles.length > 0,
        mode: 'agents',
        icon: <Bot className="size-4" />,
      },
      {
        label: '技能已装好',
        status: enabledSkills.length ? `${enabledSkills.length} 个启用` : '未启用',
        detail: enabledSkills.length
          ? '员工可以按任务选择对应技能'
          : '从技能中心安装或启用常用技能',
        ready: enabledSkills.length > 0,
        mode: 'skills',
        icon: <Sparkles className="size-4" />,
      },
      {
        label: '工具已接入',
        status: toolEntryCount ? `${toolEntryCount} 个入口` : '未接入',
        detail: toolEntryCount
          ? 'CLI、MCP 或软件能力可以分配给员工'
          : '先接入 CLI、MCP 或软件能力',
        ready: toolEntryCount > 0,
        mode: 'tools',
        icon: <Wrench className="size-4" />,
      },
      {
        label: '桌面安全',
        status: '已加锁',
        detail: '真实鼠标键盘默认串行执行，避免多个员工互相抢控制',
        ready: true,
        mode: 'tools',
        icon: <ShieldCheck className="size-4" />,
      },
    ]
  }, [
    activeEmployeeProfiles.length,
    enabledSkills.length,
    models.length,
    readyModels.length,
    toolEntryCount,
  ])
  const assigneeLabel = workMode === 'team'
    ? selectedEmployeeProfiles.length
      ? selectedEmployeeProfiles.map((agent) => agent.name).join(' / ')
      : '等待创建员工配置'
    : selectedModel
      ? selectedModel.name
      : '等待添加模型'
  const runPreviewSteps = useMemo(
    () => [
      {
        label: '理解目标',
        status: trimmedGoal ? '已准备' : '等待输入',
        detail: trimmedGoal ? '会把目标拆成可执行步骤' : '先在左侧输入一句话目标',
      },
      {
        label: '分配执行对象',
        status: workMode === 'team' ? `${selectedEmployeeProfiles.length || 0} 位员工` : selectedModel ? '单模型' : '未配置',
        detail: workMode === 'team' ? '按员工配置创建真实运行记录' : '直接进入普通模型对话',
      },
      {
        label: '调用能力',
        status: '本地优先',
        detail: '按任务选择浏览器、CLI、文件和桌面能力',
      },
      {
        label: '交付产物',
        status: `${deliverables.length} 类`,
        detail: '用用户能看懂的文件、截图、报告或代码交付',
      },
    ],
    [deliverables.length, selectedEmployeeProfiles.length, selectedModel, trimmedGoal, workMode],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [agentList, employeeProfileList, modelList, conversationList, activitySummary] = await Promise.all([
        fetchAgents(),
        fetchAgentProfiles(),
        fetchModelProfiles(),
        fetchConversations(),
        fetchRunActivitySummary(),
      ])
      const [cliList, toolConnectionList, softwareProfileList, skillsData] = await Promise.all([
        fetchCliProfiles().catch(() => []),
        fetchToolConnections().catch(() => []),
        fetchSoftwareProfiles().catch(() => []),
        fetchSkillsCenterData().catch(() => ({ skills: [] })),
      ])
      const moduleManagerView = await fetchAppModuleManagerView().catch(() => null)
      setAgents(agentList)
      setEmployeeProfiles(employeeProfileList)
      setModels(modelList)
      setCliProfiles(cliList)
      setToolConnections(toolConnectionList)
      setSoftwareProfiles(softwareProfileList)
      setSkills(skillsData.skills)
      setConversations(conversationList)
      setRunActivity(activitySummary)
      setModuleManager(moduleManagerView)
      setNotice(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '工作台数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startWork = async () => {
    if (starting) return
    const trimmedGoal = goal.trim()

    if (!trimmedGoal) {
      setNotice('先输入一个明确的工作目标，然后员工才能开始执行。')
      return
    }

    if (workMode === 'team' && !selectedEmployeeProfiles.length) {
      setNotice('团队执行需要先创建至少一个员工配置。')
      onModeChange('agents')
      return
    }

    if (workMode === 'model' && !selectedModel) {
      setNotice('先添加一个可用模型，然后就能创建普通对话或工作对话区。')
      onModeChange('models')
      return
    }

    setStarting(true)
    setNotice(null)
    try {
      const conversation = await createConversation({
        title: trimmedGoal ? trimmedGoal.slice(0, 40) : undefined,
        mode: workMode === 'team' ? 'group' : selectedAgents.length > 1 ? 'group' : 'single',
        agentIds: selectedAgents.map((agent) => agent.id),
        modelProfileId: workMode === 'model' ? selectedModel?.id : undefined,
      })
      upsertConversation(conversation)
      setActiveConversation(conversation.id)
      if (trimmedGoal) {
        const tempId = `temp_${nanoid()}`
        addLocalUserMessage({
          tempId,
          conversationId: conversation.id,
          content: trimmedGoal,
          mentionedAgentIds: selectedAgents.map((agent) => agent.id),
          attachments: [],
        })
        if (workMode === 'team') {
          const runResults = await Promise.allSettled(
            selectedEmployeeProfiles.map((profile) =>
              startEmployeeRun(profile.id, {
                goal: trimmedGoal,
                input: {
                  source: 'desktop_workbench',
                  conversationId: conversation.id,
                  deliverables: deliverables.map((item) => item.label),
                },
                autoComplete: true,
              }),
            ),
          )
          const failedRuns = runResults.filter((result) => result.status === 'rejected')
          if (failedRuns.length > 0) {
            console.error('[DesktopWorkbench] employee run failed', failedRuns)
            setNotice(`${failedRuns.length} 个员工运行启动失败，已保留工作对话区。`)
          }
          setRunActivity(await fetchRunActivitySummary())
        } else {
          sendMessage(conversation.id, { content: trimmedGoal })
            .then((result) => {
              replaceLocalMessageId(tempId, result.messageId)
              for (const message of result.messages ?? []) upsertMessage(message)
            })
            .catch((err) => {
              console.error('[DesktopWorkbench] start work send failed', err)
            })
        }
      }
      onModeChange('conversations')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '创建工作对话失败')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div
      data-testid="desktop-workbench"
      className="min-h-0 flex-1 overflow-y-auto bg-background"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-5">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" />
              电脑端工作台
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">业务动态工作台</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              按用户真实业务自动整理数据、任务进度、运行结果和下一步动作。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onModeChange('agent-canvas')}>
              <GitBranch className="size-4" />
              打开画布
            </Button>
            <Button variant="outline" onClick={() => onModeChange('agents')}>
              <Settings2 className="size-4" />
              管理员工
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </header>

        <BusinessDynamicWorkbench
          state={businessWorkbench}
          loading={loading}
          onRefresh={() => void load()}
          onOpenCanvas={() => onModeChange('agent-canvas')}
          onOpenRuns={() => onModeChange('conversations')}
        />

        <ReadinessChecklist
          items={readinessItems}
          onNavigate={onModeChange}
        />

        <ModuleStorePreview
          moduleManager={moduleManager}
          loading={loading}
          onNavigate={onModeChange}
        />

        <section className="grid min-h-[32rem] gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>今天要让员工做什么</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      不用先理解模块，直接写目标；需要复杂编排时再进入画布。
                    </p>
                  </div>
                  <Badge variant="outline">本地桌面优先</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <Textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="例如：帮我检查当前项目为什么跑不起来，修好后打开程序给我看。"
                  className="min-h-28 resize-none"
                />
                <div className="flex flex-wrap gap-2">
                  {taskPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setGoal(preset.value)}
                      className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:bg-primary/10 hover:text-foreground"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <WorkModeButton
                    active={workMode === 'team'}
                    icon={<Bot className="size-4" />}
                    title="团队员工执行"
                    body={selectedEmployeeProfiles.length ? selectedEmployeeProfiles.map((agent) => agent.name).join(' / ') : '需要先创建员工配置'}
                    onClick={() => setWorkMode('team')}
                  />
                  <WorkModeButton
                    active={workMode === 'model'}
                    icon={<Brain className="size-4" />}
                    title="单模型对话"
                    body={selectedModel ? `${selectedModel.name} · ${selectedModel.model}` : '需要先添加模型'}
                    onClick={() => setWorkMode('model')}
                  />
                </div>
                <WorkPackagePreview items={workPackage} />
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground">将使用：</span>
                  {workMode === 'team'
                    ? selectedEmployeeProfiles.length
                      ? `${selectedEmployeeProfiles.length} 位员工配置创建真实运行`
                      : '暂无可用员工配置'
                    : selectedModel
                      ? `模型 ${selectedModel.name} 普通对话`
                      : '暂无可用模型'}
                </div>
                {notice && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                    {notice}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => void startWork()} disabled={starting}>
                    <Play className={cn('size-4', starting && 'animate-pulse')} />
                    {starting ? '正在创建工作区' : '开始工作'}
                  </Button>
                  <Button variant="outline" onClick={() => onModeChange('conversations')}>
                    进入对话
                  </Button>
                  <Button variant="ghost" onClick={() => onModeChange('models')}>
                    模型管理
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>员工队列</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {activeEmployeeProfiles.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeEmployeeProfiles.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => onModeChange('agents')}
                          className="flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 text-left transition hover:border-primary/60 hover:bg-accent"
                        >
                          <EmployeeProfileAvatar profile={agent} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{agent.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {agent.description || agent.role || '等待配置职责与能力'}
                            </div>
                            <div className="mt-1 truncate text-[11px] text-muted-foreground">
                              {agent.modelProfileId || '未绑定模型'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint
                      icon={<Bot className="size-4" />}
                      title="还没有可用员工配置"
                      body="先创建员工配置，后续就能直接分配给工作任务。"
                      action="去创建"
                      onClick={() => onModeChange('agents')}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle>电脑能力</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 pt-4 sm:grid-cols-2 lg:grid-cols-1">
                  {capabilityCards.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => onModeChange(item.mode)}
                      className="flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition hover:border-primary/60 hover:bg-accent"
                    >
                      <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">{item.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.title}</span>
                        <span className="block text-xs leading-5 text-muted-foreground">{item.body}</span>
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <RunActivityCard
              summary={runActivity}
              loading={loading}
              onRefresh={() => void load()}
            />

            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>执行预案</CardTitle>
                  <Badge variant={trimmedGoal ? 'default' : 'outline'}>
                    {trimmedGoal ? '已形成预案' : '等待目标'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground">当前任务</div>
                  <div className="mt-1 line-clamp-3 text-sm leading-5">
                    {trimmedGoal || '在左侧输入目标后，这里会生成执行预案。'}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-medium text-muted-foreground">负责人</div>
                    <div className="mt-1 truncate text-sm font-semibold">{assigneeLabel}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-medium text-muted-foreground">上下文策略</div>
                    <div className="mt-1 text-sm font-semibold">追加式记录</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      稳定前缀优先，便于长会话复用缓存。
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {runPreviewSteps.map((step, index) => (
                    <div key={step.label} className="rounded-lg border px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                            {index + 1}
                          </span>
                          <span className="truncate text-sm font-semibold">{step.label}</span>
                        </div>
                        <Badge variant="secondary">{step.status}</Badge>
                      </div>
                      <div className="mt-1 pl-8 text-xs leading-5 text-muted-foreground">{step.detail}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground">交付给客户看到</div>
                  <div className="grid gap-2">
                    {deliverables.map((item) => (
                      <div key={item.label} className="flex items-start gap-2 rounded-md bg-background px-2.5 py-2">
                        <span className="mt-0.5 text-primary">{item.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className="block text-xs leading-5 text-muted-foreground">{item.body}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  桌面控制默认加锁执行，避免多个员工同时抢同一个鼠标键盘；后续接虚拟工作站后再并行。
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>最近会话</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {recentConversations.length ? (
                  recentConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => {
                        setActiveConversation(conversation.id)
                        onModeChange('conversations')
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:border-primary/60 hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{conversation.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {conversation.mode === 'group' ? '工作对话区' : '普通对话'} · {conversation.agentIds.length || 1} 个执行对象
                        </span>
                      </span>
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                    </button>
                  ))
                ) : (
                  <EmptyHint
                    icon={<Send className="size-4" />}
                    title="还没有会话"
                    body="创建第一个工作对话区后会出现在这里。"
                    action="新建"
                    onClick={() => void startWork()}
                  />
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <MiniAction icon={<Code2 className="size-4" />} label="代码任务" onClick={() => setGoal(taskPresets[1].value)} />
              <MiniAction icon={<Film className="size-4" />} label="视频任务" onClick={() => setGoal(taskPresets[3].value)} />
              <MiniAction icon={<ShieldCheck className="size-4" />} label="安全锁" onClick={() => onModeChange('tools')} />
              <MiniAction icon={<Wrench className="size-4" />} label="工具商店" onClick={() => onModeChange('tools')} />
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}

function BusinessDynamicWorkbench({
  state,
  loading,
  onRefresh,
  onOpenCanvas,
  onOpenRuns,
}: {
  state: BusinessWorkbenchState
  loading: boolean
  onRefresh: () => void
  onOpenCanvas: () => void
  onOpenRuns: () => void
}) {
  return (
    <Card data-testid="business-dynamic-workbench" className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{state.name}</CardTitle>
              <Badge variant="secondary">AI 自编辑</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {state.focus}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <Sparkles className="size-4" />
              AI 整理
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenCanvas}>
              <GitBranch className="size-4" />
              编排画布
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenRuns}>
              <Activity className="size-4" />
              运行结果
            </Button>
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {state.metrics.map((metric) => (
            <BusinessMetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">任务流转</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{state.signal}</div>
              </div>
              <Badge variant="outline">下一步：{state.nextAction}</Badge>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {state.lanes.map((lane) => (
                <BusinessLaneCard key={lane.label} lane={lane} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">AI 自编辑区域</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{state.aiEditSummary}</div>
              </div>
              <Badge variant="outline">动态布局</Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {state.modules.map((module) => (
                <div key={module.label} className="flex min-w-0 items-start gap-2 rounded-md bg-background px-2.5 py-2">
                  <span className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">{module.icon}</span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-semibold">{module.label}</span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {module.value}
                      </span>
                    </span>
                    <span className="block line-clamp-2 text-[11px] leading-4 text-muted-foreground">{module.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

function BusinessMetricCard({ metric }: { metric: BusinessMetric }) {
  const tone = businessToneClass(metric.tone)
  return (
    <div className={cn('rounded-lg border px-3 py-3', tone.surface)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{metric.label}</div>
          <div className="mt-1 truncate text-xl font-semibold">{metric.value}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{metric.detail}</div>
        </div>
        <span className={cn('rounded-lg p-2', tone.icon)}>{metric.icon}</span>
      </div>
    </div>
  )
}

function BusinessLaneCard({ lane }: { lane: BusinessLane }) {
  const tone = businessToneClass(lane.tone)
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{lane.label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{lane.detail}</div>
        </div>
        <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', tone.badge)}>
          {lane.count}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {lane.runs.slice(0, 2).map((run) => (
          <div key={run.id} className="rounded-md bg-muted/40 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium">{safeDisplayText(run.title, '未命名任务')}</span>
              <Badge variant={statusBadgeVariant(run.status)}>{statusToLabel(run.status)}</Badge>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="min-w-0 truncate">{phaseToLabel(run.phase)} · {safeDisplayText(run.currentStep, '等待更新')}</span>
              <span className="shrink-0">{formatRelativeTime(run.updatedAt)}</span>
            </div>
          </div>
        ))}
        {lane.runs.length === 0 && (
          <div className="rounded-md border border-dashed px-2.5 py-3 text-center text-xs text-muted-foreground">
            暂无任务
          </div>
        )}
      </div>
    </div>
  )
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'running') return 'default'
  if (status === 'queued' || status === 'paused') return 'secondary'
  if (status === 'failed' || status === 'aborted') return 'destructive'
  return 'outline'
}

function statusToLabel(status: string) {
  const table: Record<string, string> = {
    running: '运行中',
    queued: '排队中',
    complete: '已完成',
    failed: '失败',
    aborted: '已停止',
    paused: '已暂停',
  }
  return table[status] ?? status
}

function phaseToLabel(phase: string) {
  const table: Record<string, string> = {
    queued: '等待分配',
    running: '正在执行',
    complete: '已完成',
    failed: '失败',
    understand_goal: '理解目标',
    retrieve_memory: '检索记忆',
    create_plan: '制定计划',
    execute_action: '调用工具',
    verify_result: '验证结果',
    produce_artifact: '生成产物',
    reflect: '总结学习',
  }
  return table[phase] ?? phase
}

function RunActivityCard({
  summary,
  loading,
  onRefresh,
}: {
  summary: RunActivitySummary | null
  loading: boolean
  onRefresh: () => void
}) {
  const totals = summary?.totals
  const recentRuns = summary?.recentRuns ?? []
  const recentEvents = summary?.recentEvents ?? []
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<EmployeeRunSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [runtimeEnvironment, setRuntimeEnvironment] = useState<AgentEnvironment | null>(null)
  const [runtimeEnvironmentLoading, setRuntimeEnvironmentLoading] = useState(false)
  const [runtimeEnvironmentError, setRuntimeEnvironmentError] = useState<string | null>(null)

  const selectRun = async (run: RunActivitySummary['recentRuns'][number]) => {
    setSelectedRunId(run.id)
    setSnapshot(null)
    setSnapshotError(null)
    setRuntimeEnvironment(null)
    setRuntimeEnvironmentError(null)
    if (run.kind !== 'employee_run') {
      setSnapshotError('普通模型对话没有员工运行快照。')
      return
    }
    setSnapshotLoading(true)
    try {
      const nextSnapshot = await fetchEmployeeRunSnapshot(run.id)
      setSnapshot(nextSnapshot)
      setRuntimeEnvironmentLoading(true)
      try {
        setRuntimeEnvironment(await fetchAgentEnvironmentPreview(
          nextSnapshot.run.agentProfileId,
          nextSnapshot.run.id,
        ))
      } catch (err) {
        setRuntimeEnvironmentError(err instanceof Error ? err.message : '运行工位加载失败')
      } finally {
        setRuntimeEnvironmentLoading(false)
      }
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : '运行详情加载失败')
    } finally {
      setSnapshotLoading(false)
    }
  }

  return (
    <Card data-testid="run-activity-card">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>员工现场</CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <RunMetric icon={<Activity className="size-4" />} label="运行中" value={totals?.running ?? 0} />
          <RunMetric icon={<Clock3 className="size-4" />} label="排队" value={totals?.queued ?? 0} />
          <RunMetric icon={<CheckCircle2 className="size-4" />} label="今日完成" value={totals?.completedToday ?? 0} />
          <RunMetric icon={<PackageCheck className="size-4" />} label="工具动作" value={totals?.toolActions ?? 0} />
        </div>

        {(selectedRunId || snapshotLoading || snapshotError || snapshot) && (
          <RunSnapshotPanel
            snapshot={snapshot}
            loading={snapshotLoading}
            error={snapshotError}
            runtimeEnvironment={runtimeEnvironment}
            runtimeEnvironmentLoading={runtimeEnvironmentLoading}
            runtimeEnvironmentError={runtimeEnvironmentError}
          />
        )}

        {recentRuns.length ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">最近运行</div>
            {recentRuns.slice(0, 4).map((run) => (
              <button
                key={run.id}
                type="button"
                data-testid="run-activity-row"
                data-kind={run.kind}
                onClick={() => void selectRun(run)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition hover:border-primary/60 hover:bg-accent',
                  selectedRunId === run.id && 'border-primary bg-primary/10',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{safeDisplayText(run.title, '未命名任务')}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {safeDisplayText(run.agentName ?? '未命名员工', '未命名员工')} · {safeDisplayText(run.currentStep, '等待更新')}
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(run.status)}>{statusToLabel(run.status)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">阶段：{phaseToLabel(run.phase)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">工具 {run.toolActionCount}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">产物 {run.artifactCount}</span>
                  <span className={cn('rounded-full px-2 py-0.5', runBrainStatusClass(run.brainStatus))}>
                    {run.brainLabel}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            还没有真实运行记录；点击“开始工作”后会出现在这里。
          </div>
        )}

        {recentEvents.length ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">最新事件</div>
            {recentEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{safeDisplayText(event.message, '运行事件')}</span>
                  <Badge variant="outline">{phaseToLabel(event.phase)}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RunSnapshotPanel({
  snapshot,
  loading,
  error,
  runtimeEnvironment,
  runtimeEnvironmentLoading,
  runtimeEnvironmentError,
}: {
  snapshot: EmployeeRunSnapshot | null
  loading: boolean
  error: string | null
  runtimeEnvironment: AgentEnvironment | null
  runtimeEnvironmentLoading: boolean
  runtimeEnvironmentError: string | null
}) {
  const run = snapshot?.run ?? null
  const latestEvents = snapshot ? [...snapshot.events].slice(-4).reverse() : []
  const toolCount = snapshot ? snapshot.cliRuns.length + snapshot.computerActionEvents.length : 0
  const outputStatus = getSnapshotOutputStatus(run?.output)
  const brainDigest = snapshot
    ? buildEmployeeRunBrainDigest({
        reflection: snapshot.reflection,
        memoryItems: snapshot.memoryItems,
        learningEvents: snapshot.learningEvents,
      })
    : null

  return (
    <div data-testid="run-snapshot-panel" className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">运行详情</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            计划、事件、工具动作和产物校验会在这里汇总。
          </div>
        </div>
        {run && <Badge variant={statusBadgeVariant(run.status)}>{statusToLabel(run.status)}</Badge>}
      </div>

      {loading && (
        <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
          正在读取员工运行快照...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}

      {!loading && snapshot && run && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SnapshotMetric label="计划步骤" value={run.plan.length} />
            <SnapshotMetric label="运行事件" value={snapshot.events.length} />
            <SnapshotMetric label="工具证据" value={toolCount} />
            <SnapshotMetric label="产物校验" value={snapshot.artifactValidations.length} />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">当前状态</div>
            <div className="rounded-md bg-background px-3 py-2 text-xs leading-5">
              <span className="font-medium">{phaseToLabel(run.currentPhase)}</span>
              <span className="text-muted-foreground"> · {run.currentStep ?? outputStatus}</span>
            </div>
          </div>

          {brainDigest && <EmployeeRunBrainDigestPanel digest={brainDigest} />}

          <RuntimeEnvironmentPanel
            snapshot={snapshot}
            environment={runtimeEnvironment}
            loading={runtimeEnvironmentLoading}
            error={runtimeEnvironmentError}
          />

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">执行计划</div>
            <div className="space-y-1">
              {run.plan.slice(0, 4).map((step, index) => (
                <div key={`${step}-${index}`} className="flex gap-2 rounded-md bg-background px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground">{index + 1}</span>
                  <span className="line-clamp-1">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {latestEvents.length ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">最近事件</div>
              <div className="space-y-1">
                {latestEvents.map((event) => (
                  <div key={event.id} className="rounded-md bg-background px-2.5 py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="line-clamp-1 font-medium">{event.message}</span>
                      <Badge variant="outline">{phaseToLabel(event.phase)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function EmployeeRunBrainDigestPanel({ digest }: { digest: EmployeeRunBrainDigest }) {
  return (
    <div className="space-y-2 rounded-md border bg-background p-3" data-testid="employee-run-brain-digest">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Brain className="size-3.5 text-primary" />
            <span>{digest.title}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{digest.headline}</div>
        </div>
        <Badge variant="outline" className={cn('shrink-0', brainDigestToneClass(digest.tone))}>
          {digest.statusLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {digest.metrics.map((metric) => (
          <div key={metric.label} className="rounded-md border bg-muted/20 px-2 py-1.5">
            <div className="truncate text-[10px] text-muted-foreground">{metric.label}</div>
            <div className="text-xs font-semibold">{metric.value}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {digest.items.slice(0, 4).map((item) => (
          <div key={item} className="truncate text-[11px] text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
      <EmployeeRunNextRunBriefing briefing={digest.nextRunBriefing} />
    </div>
  )
}

function EmployeeRunNextRunBriefing({
  briefing,
}: {
  briefing: EmployeeRunBrainDigest['nextRunBriefing']
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="text-[11px] font-medium">下次开工提示</div>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        {briefing.items.map((item) => (
          <div key={`${item.label}:${item.detail}`} className="rounded-md bg-background px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-medium">{item.label}</span>
              <span className={cn('size-1.5 shrink-0 rounded-full', brainBriefingToneClass(item.tone))} />
            </div>
            <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function brainDigestToneClass(tone: EmployeeRunBrainDigest['tone']) {
  if (tone === 'ready') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (tone === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-muted bg-muted/40 text-muted-foreground'
}

function brainBriefingToneClass(tone: EmployeeRunBrainDigest['nextRunBriefing']['items'][number]['tone']) {
  if (tone === 'ready') return 'bg-emerald-500'
  if (tone === 'warning') return 'bg-amber-500'
  return 'bg-muted-foreground/40'
}

function runBrainStatusClass(status: RunActivitySummary['recentRuns'][number]['brainStatus']) {
  if (status === 'failure_lesson') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (status === 'needs_review') return 'bg-primary/10 text-primary'
  if (status === 'learned') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  return 'bg-muted text-muted-foreground'
}

function RuntimeEnvironmentPanel({
  snapshot,
  environment,
  loading,
  error,
}: {
  snapshot: EmployeeRunSnapshot
  environment: AgentEnvironment | null
  loading: boolean
  error: string | null
}) {
  const session = snapshot.computerSessions[0] ?? null
  const workspacePath = environment?.fs.workspace ?? session?.workspacePath ?? '等待创建'
  const tempPath = environment?.env.custom.AGENTHUB_TEMP ?? session?.tempPath ?? '等待创建'
  const browserProfilePath = session?.browserProfilePath ?? '等待浏览器会话'
  const networkLabel = environment?.network.proxy ? '代理出口' : '直连出口'
  const secretCount = environment?.env.redactedSecretNames.length ?? 0
  const mountCount = environment?.fs.mounts.length ?? 0

  return (
    <div data-testid="runtime-environment-panel" className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold">运行工位</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            每个员工运行时独立使用自己的目录、临时文件和浏览器环境。
          </div>
        </div>
        <Badge variant="outline">{session ? workstationModeLabel(session.mode) : '预览'}</Badge>
      </div>
      {loading && (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          正在读取运行工位...
        </div>
      )}
      {!loading && error && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}
      <div className="grid gap-1.5">
        <EnvironmentPathRow label="工作目录" value={workspacePath} />
        <EnvironmentPathRow label="临时目录" value={tempPath} />
        <EnvironmentPathRow label="浏览器环境" value={browserProfilePath} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <div className="text-muted-foreground">网络</div>
          <div className="mt-0.5 font-medium">{networkLabel}</div>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <div className="text-muted-foreground">挂载</div>
          <div className="mt-0.5 font-medium">{mountCount}</div>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <div className="text-muted-foreground">密钥</div>
          <div className="mt-0.5 font-medium">{secretCount} 个引用</div>
        </div>
      </div>
    </div>
  )
}

function EnvironmentPathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium" title={value}>{value}</span>
    </div>
  )
}

function SnapshotMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  )
}

function getSnapshotOutputStatus(output: unknown) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return '等待输出'
  const status = (output as Record<string, unknown>).status
  return typeof status === 'string' ? status : '已有输出'
}

function workstationModeLabel(mode: string) {
  const table: Record<string, string> = {
    browser_context: '浏览器工位',
    physical_desktop: '真实桌面',
    virtual_desktop: '虚拟桌面',
    vm: '虚拟机',
    remote_session: '远程工位',
  }
  return table[mode] ?? mode
}

function RunMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function EmployeeProfileAvatar({ profile }: { profile: AgentProfileRow }) {
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AI'

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {initials}
    </div>
  )
}

function WorkModeButton({
  active,
  icon,
  title,
  body,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  title: string
  body: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition',
        active ? 'border-primary bg-primary/10' : 'hover:border-primary/60 hover:bg-accent',
      )}
    >
      <span className={cn('mt-0.5 rounded-md p-2', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs leading-5 text-muted-foreground">{body}</span>
      </span>
    </button>
  )
}

function WorkPackagePreview({
  items,
}: {
  items: Array<{
    label: string
    body: string
    icon: ReactNode
  }>
}) {
  return (
    <div data-testid="workbench-auto-package" className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">系统会自动准备</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            你只需要说目标，下面这些能力会按任务自动带上。
          </div>
        </div>
        <Badge variant="outline">工作包</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-start gap-2 rounded-md bg-background px-2.5 py-2">
            <span className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">{item.icon}</span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{item.label}</span>
              <span className="block line-clamp-2 text-[11px] leading-4 text-muted-foreground">{item.body}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReadinessChecklist({
  items,
  onNavigate,
}: {
  items: ReadinessItem[]
  onNavigate: (mode: SidebarMode) => void
}) {
  const missingItems = items.filter((item) => !item.ready)
  const primaryAction = missingItems[0] ?? null
  const readyCount = items.length - missingItems.length
  return (
    <Card data-testid="workbench-readiness-checklist" className="overflow-hidden">
      <CardContent className="grid gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'mt-0.5 rounded-md p-2',
              missingItems.length ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600',
            )}
          >
            {missingItems.length ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">开工前检查</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {missingItems.length
                ? `还差 ${missingItems.length} 项，补齐后员工执行会更稳。`
                : '核心配置已经准备好，可以直接派活。'}
            </div>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.mode)}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left transition hover:border-primary/60 hover:bg-accent',
                item.ready ? 'bg-background' : 'border-amber-500/30 bg-amber-500/5',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 rounded-md p-1.5',
                  item.ready ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600',
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{item.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.status}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end lg:justify-center">
          <Badge variant={missingItems.length ? 'secondary' : 'default'} className="shrink-0">
            {readyCount}/{items.length} 就绪
          </Badge>
          <Button
            size="sm"
            variant={primaryAction ? 'default' : 'outline'}
            className="shrink-0"
            onClick={() => onNavigate(primaryAction?.mode ?? 'conversations')}
          >
            {primaryAction ? '处理最关键一步' : '进入对话'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ModuleStorePreview({
  moduleManager,
  loading,
  onNavigate,
}: {
  moduleManager: AgentHubModuleManagerView | null
  loading: boolean
  onNavigate: (mode: SidebarMode) => void
}) {
  const activeModules = moduleManager?.activeModules.slice(0, 5) ?? []
  const availableModules = moduleManager?.availableModules.slice(0, 4) ?? []

  return (
    <section data-testid="workbench-module-store-preview" className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LayersIcon />
            <span>模块积木</span>
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            系统功能按积木管理：默认只显示常用模块，需要更多能力时再加入。
          </div>
        </div>
        <Badge variant="outline">
          {moduleManager ? `${moduleManager.activeModules.length} 已启用` : loading ? '读取中' : '未加载'}
        </Badge>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ModuleBlockColumn
          title="已启用模块"
          emptyLabel={loading ? '正在读取模块...' : '暂无启用模块'}
          modules={activeModules}
          onNavigate={onNavigate}
        />
        <ModuleBlockColumn
          title="可加入模块"
          emptyLabel={loading ? '正在读取模块...' : '暂无可加入模块'}
          modules={availableModules}
          onNavigate={onNavigate}
        />
      </div>
    </section>
  )
}

function ModuleBlockColumn({
  title,
  emptyLabel,
  modules,
  onNavigate,
}: {
  title: string
  emptyLabel: string
  modules: AgentHubModuleManagerView['activeModules']
  onNavigate: (mode: SidebarMode) => void
}) {
  return (
    <div className="min-w-0 rounded-md bg-background p-2.5">
      <div className="mb-2 text-xs font-semibold">{title}</div>
      {modules.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => onNavigate(module.id as SidebarMode)}
              className="min-w-0 rounded-md border px-2.5 py-2 text-left transition hover:border-primary/60 hover:bg-accent"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold">{module.label}</span>
                <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px]', moduleStatusToneClass(module.statusTone))}>
                  {module.statusLabel}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {module.dependencyHint}
              </div>
              <div className="mt-1 text-[10px] font-medium text-primary">{module.actionLabel}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  )
}

function LayersIcon() {
  return <FolderKanban className="size-4 text-primary" />
}

function moduleStatusToneClass(tone: AgentHubModuleManagerView['activeModules'][number]['statusTone']) {
  if (tone === 'ready') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (tone === 'warning') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'bg-muted text-muted-foreground'
}

function businessToneClass(tone: BusinessMetric['tone']) {
  const table: Record<BusinessMetric['tone'], { surface: string; icon: string; badge: string }> = {
    blue: {
      surface: 'bg-primary/5',
      icon: 'bg-primary/10 text-primary',
      badge: 'bg-primary/10 text-primary',
    },
    green: {
      surface: 'bg-emerald-500/5',
      icon: 'bg-emerald-500/10 text-emerald-600',
      badge: 'bg-emerald-500/10 text-emerald-600',
    },
    amber: {
      surface: 'bg-amber-500/5',
      icon: 'bg-amber-500/10 text-amber-600',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    red: {
      surface: 'bg-red-500/5',
      icon: 'bg-red-500/10 text-red-600',
      badge: 'bg-red-500/10 text-red-600',
    },
    neutral: {
      surface: 'bg-muted/20',
      icon: 'bg-muted text-muted-foreground',
      badge: 'bg-muted text-muted-foreground',
    },
  }
  return table[tone]
}

function formatRelativeTime(timestamp: number) {
  if (!timestamp) return '刚刚'
  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function safeDisplayText(value: string | null | undefined, fallback: string) {
  const text = value?.trim() ?? ''
  if (!text) return fallback
  const questionMarks = text.match(/\?/g)?.length ?? 0
  if (text.length >= 6 && questionMarks / text.length > 0.55) return fallback
  return text
}

function EmptyHint({
  icon,
  title,
  body,
  action,
  onClick,
}: {
  icon: ReactNode
  title: string
  body: string
  action: string
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs leading-5 text-muted-foreground">{body}</span>
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={onClick}>
        {action}
      </Button>
    </div>
  )
}

function MiniAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:border-primary/60 hover:bg-accent"
    >
      {icon}
      {label}
    </button>
  )
}

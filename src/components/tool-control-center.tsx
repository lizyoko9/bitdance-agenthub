'use client'

import {
  Activity,
  Blocks,
  Bot,
  CheckCircle2,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  FileText,
  Globe2,
  KeyRound,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Package,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Terminal,
  Video,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type MouseEventHandler, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import type {
  AgentProfileRow,
  CliProfileRow,
  CliRunRow,
  JsonObject,
  MacroReplayRunRow,
  McpServerRow,
  McpToolCallRow,
  McpToolDefinitionRow,
  McpTransport,
  RecordedMacroRow,
  RiskLevel,
  SdkTaskRow,
  SoftwareAdapterType,
  SoftwareAppType,
  SoftwareCommandRow,
  SoftwareCommandRunRow,
  SoftwareProfileRow,
  ToolConnectionRow,
  ToolConnectionType,
  ToolProtocolInvocationRow,
  ToolProtocolManifestRow,
  ToolProtocolResultRow,
  WebhookDeliveryRow,
  WebhookEventType,
  WebhookSubscriptionRow,
  WorkstationMode,
} from '@/db/schema'
import {
  createProgrammaticApiKey,
  createCliProfile,
  createMcpServer,
  createRecordedMacro,
  createSdkTask,
  createSoftwareCommand,
  createSoftwareProfile,
  createToolConnection,
  createToolProtocolInvocation,
  createToolProtocolResult,
  createWebhookSubscription,
  discoverMcpTools,
  fetchAgentProfiles,
  fetchCliProfiles,
  fetchCliRuns,
  fetchProgrammaticApiKeys,
  fetchMacroReplayRuns,
  fetchMcpServers,
  fetchMcpToolCalls,
  fetchMcpToolDefinitions,
  fetchToolProtocolInvocations,
  fetchToolProtocolManifests,
  fetchToolProtocolResults,
  fetchRecordedMacros,
  fetchSdkTasks,
  fetchSoftwareCommandRuns,
  fetchSoftwareCommands,
  fetchSoftwareProfiles,
  fetchToolConnections,
  fetchWebhookDeliveries,
  fetchWebhookSubscriptions,
  replayRecordedMacro,
  revokeProgrammaticApiKey,
  runCliProfile,
  runMcpTool,
  runSoftwareCommand,
  seedToolInvocationProtocol,
  testWebhookSubscription,
  testCliProfile,
  testMcpServer,
  testSoftwareCommand,
  testToolConnection,
  type ProgrammaticApiKeyPublic,
} from '@/lib/api'
import { emitUiCommand } from '@/lib/ui-command-events'
import { cn } from '@/lib/utils'

const mcpTransports: McpTransport[] = ['stdio', 'sse', 'http']
const toolTypes: ToolConnectionType[] = ['mcp', 'cli', 'software', 'api']
const softwareAppTypes: SoftwareAppType[] = [
  'native_app',
  'browser_app',
  'cli_app',
  'mobile_app',
  'api_service',
  'script',
]
const softwareAdapters: SoftwareAdapterType[] = [
  'cli',
  'mcp',
  'api',
  'browser_automation',
  'desktop_automation',
  'recorded_macro',
  'hybrid',
]
const workstationModes: WorkstationMode[] = [
  'browser_context',
  'physical_desktop',
  'virtual_desktop',
  'vm',
  'remote_session',
]
const riskLevels: RiskLevel[] = ['low', 'medium', 'high']
const macroStatuses: RecordedMacroRow['status'][] = ['draft', 'active', 'archived']

const softwareStoreCategories = [
  '全部',
  '开发工具',
  '办公协作',
  '浏览器网页',
  '视频创作',
  '数据文件',
  '自动化脚本',
  '其他软件',
] as const

const softwareUseSteps = [
  {
    title: '选择软件',
    detail: '先选 Codex、微信、剪映、Chrome 这类实际要让智能体使用的软件。',
  },
  {
    title: '检测接入',
    detail: '确认它有没有 CLI、MCP 或已封装命令；没有就从右侧创建接入。',
  },
  {
    title: '分配给智能体',
    detail: '打开智能体设置，把这个软件能力加入员工工具包。',
  },
]

type SoftwareStoreCategory = (typeof softwareStoreCategories)[number]
type ConcreteSoftwareStoreCategory = Exclude<SoftwareStoreCategory, '全部'>
type SoftwareStoreIcon = 'code' | 'chat' | 'video' | 'browser' | 'data' | 'file' | 'automation' | 'tool'
type StoreDetailMode = 'overview' | 'cli' | 'mcp' | 'commands'

interface SoftwareStoreTemplate {
  key: string
  name: string
  category: ConcreteSoftwareStoreCategory
  description: string
  icon: SoftwareStoreIcon
  aliases: string[]
}

interface SoftwareStoreItem extends SoftwareStoreTemplate {
  cliProfiles: CliProfileRow[]
  mcpServers: McpServerRow[]
  mcpTools: McpToolDefinitionRow[]
  softwareProfiles: SoftwareProfileRow[]
  softwareCommands: SoftwareCommandRow[]
}

const softwareStoreTemplates: SoftwareStoreTemplate[] = [
  {
    key: 'codex',
    name: 'Codex CLI',
    category: '开发工具',
    description: '代码修改、仓库检查、命令行交付',
    icon: 'code',
    aliases: ['codex', 'codex cli'],
  },
  {
    key: 'claude-code',
    name: 'Claude Code',
    category: '开发工具',
    description: '代码任务、仓库理解、工程协作',
    icon: 'code',
    aliases: ['claude code', 'claude-code'],
  },
  {
    key: 'opencode',
    name: 'OpenCode',
    category: '开发工具',
    description: '开放式代码 Agent 与本地脚本',
    icon: 'code',
    aliases: ['opencode', 'open code'],
  },
  {
    key: 'github',
    name: 'GitHub',
    category: '开发工具',
    description: '仓库、Issue、PR 与发布流程',
    icon: 'code',
    aliases: ['github', 'git hub', 'gh'],
  },
  {
    key: 'wechat',
    name: '微信',
    category: '办公协作',
    description: '联系人、群聊、消息草稿与客户沟通',
    icon: 'chat',
    aliases: ['wechat', 'weixin', '微信'],
  },
  {
    key: 'feishu',
    name: '飞书',
    category: '办公协作',
    description: '文档、表格、审批与团队通知',
    icon: 'file',
    aliases: ['feishu', 'lark', '飞书'],
  },
  {
    key: 'notion',
    name: 'Notion',
    category: '办公协作',
    description: '知识库、项目文档与数据库',
    icon: 'file',
    aliases: ['notion'],
  },
  {
    key: 'chrome',
    name: 'Chrome',
    category: '浏览器网页',
    description: '网页浏览、登录态页面与浏览器自动化',
    icon: 'browser',
    aliases: ['chrome', 'browser', '浏览器'],
  },
  {
    key: 'skillsmp',
    name: 'SkillsMP',
    category: '浏览器网页',
    description: '技能搜索、技能安装与技能市场',
    icon: 'tool',
    aliases: ['skillsmp', 'skills map', 'skillsmap'],
  },
  {
    key: 'jianying',
    name: '剪映',
    category: '视频创作',
    description: '视频草稿、字幕、导出与批量剪辑',
    icon: 'video',
    aliases: ['jianying', 'capcut', '剪映'],
  },
  {
    key: 'excel',
    name: 'Excel',
    category: '数据文件',
    description: '表格处理、数据清洗与报表生成',
    icon: 'data',
    aliases: ['excel', 'spreadsheet', 'xlsx', '表格'],
  },
  {
    key: 'files',
    name: '本地文件',
    category: '数据文件',
    description: '文件读写、目录整理与产物交付',
    icon: 'file',
    aliases: ['file', 'filesystem', 'fs', '文件'],
  },
  {
    key: 'python-script',
    name: 'Python 脚本',
    category: '自动化脚本',
    description: '本地脚本、批处理任务与自定义自动化',
    icon: 'automation',
    aliases: ['python', 'py', 'script', '脚本'],
  },
]

type SavingAction =
  | 'cli'
  | 'mcp'
  | 'tool'
  | 'software'
  | 'command'
  | 'macro'
  | 'api-key'
  | 'sdk-task'
  | 'webhook'
  | 'tool-protocol-seed'
  | 'tool-protocol-sample'
  | `api-key-revoke:${string}`
  | `webhook-test:${string}`
  | `cli-test:${string}`
  | `cli-run:${string}`
  | `mcp-test:${string}`
  | `mcp-discover:${string}`
  | `mcp-run:${string}`
  | `tool-test:${string}`
  | `command-test:${string}`
  | `command-run:${string}`
  | `macro-run:${string}`
  | null

function buildSoftwareStoreItems({
  cliProfiles,
  mcpServers,
  mcpTools,
  softwareProfiles,
  softwareCommands,
}: {
  cliProfiles: CliProfileRow[]
  mcpServers: McpServerRow[]
  mcpTools: McpToolDefinitionRow[]
  softwareProfiles: SoftwareProfileRow[]
  softwareCommands: SoftwareCommandRow[]
}): SoftwareStoreItem[] {
  const items = new Map<string, SoftwareStoreItem>()
  const mcpToolsByServer = new Map<string, McpToolDefinitionRow[]>()
  const commandsByProfile = new Map<string, SoftwareCommandRow[]>()

  for (const tool of mcpTools) {
    const list = mcpToolsByServer.get(tool.mcpServerId) ?? []
    list.push(tool)
    mcpToolsByServer.set(tool.mcpServerId, list)
  }
  for (const command of softwareCommands) {
    const list = commandsByProfile.get(command.softwareProfileId) ?? []
    list.push(command)
    commandsByProfile.set(command.softwareProfileId, list)
  }

  const ensure = (template: SoftwareStoreTemplate): SoftwareStoreItem => {
    const current = items.get(template.key)
    if (current) return current
    const next: SoftwareStoreItem = {
      ...template,
      cliProfiles: [],
      mcpServers: [],
      mcpTools: [],
      softwareProfiles: [],
      softwareCommands: [],
    }
    items.set(template.key, next)
    return next
  }

  for (const template of softwareStoreTemplates) ensure(template)

  const ensureFromText = (name: string, text: string): SoftwareStoreItem => {
    const template = findSoftwareStoreTemplate(text)
    if (template) return ensure(template)
    const displayName = cleanSoftwareDisplayName(name)
    const dynamicTemplate: SoftwareStoreTemplate = {
      key: `local-${normalizeSoftwareKey(displayName)}`,
      name: displayName,
      category: guessSoftwareCategory(text),
      description: '本地已接入的软件能力',
      icon: guessSoftwareIcon(text),
      aliases: [displayName],
    }
    return ensure(dynamicTemplate)
  }

  for (const profile of cliProfiles) {
    ensureFromText(profile.name, `${profile.name} ${profile.command} ${profile.argsTemplate}`).cliProfiles.push(profile)
  }

  for (const server of mcpServers) {
    const item = ensureFromText(
      server.displayName,
      `${server.displayName} ${server.command ?? ''} ${server.endpoint ?? ''}`,
    )
    item.mcpServers.push(server)
    item.mcpTools.push(...(mcpToolsByServer.get(server.id) ?? []))
  }

  for (const profile of softwareProfiles) {
    const item = ensureFromText(
      profile.name,
      `${profile.name} ${profile.appType} ${profile.adapterType} ${profile.launchCommand ?? ''} ${
        profile.executablePath ?? ''
      }`,
    )
    item.softwareProfiles.push(profile)
    item.softwareCommands.push(...(commandsByProfile.get(profile.id) ?? []))
  }

  const categoryIndex = new Map(softwareStoreCategories.map((category, index) => [category, index]))
  return Array.from(items.values()).sort((a, b) => {
    const aModes = getStoreModeCount(a)
    const bModes = getStoreModeCount(b)
    if (aModes !== bModes) return bModes - aModes
    const categoryDiff = (categoryIndex.get(a.category) ?? 99) - (categoryIndex.get(b.category) ?? 99)
    if (categoryDiff !== 0) return categoryDiff
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

function findSoftwareStoreTemplate(text: string): SoftwareStoreTemplate | null {
  const normalized = normalizeSoftwareText(text)
  return (
    softwareStoreTemplates.find((template) =>
      template.aliases.some((alias) => normalized.includes(normalizeSoftwareText(alias))),
    ) ?? null
  )
}

function normalizeSoftwareText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\\/_:.[\](){}-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSoftwareKey(value: string): string {
  return normalizeSoftwareText(value).replace(/\s+/g, '-') || 'software'
}

function cleanSoftwareDisplayName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized || '本地软件'
}

function guessSoftwareCategory(text: string): ConcreteSoftwareStoreCategory {
  const normalized = normalizeSoftwareText(text)
  if (containsAny(normalized, ['codex', 'claude', 'opencode', 'github', 'git', 'vscode', 'code'])) {
    return '开发工具'
  }
  if (containsAny(normalized, ['wechat', 'weixin', '微信', 'feishu', 'lark', 'notion', 'slack'])) {
    return '办公协作'
  }
  if (containsAny(normalized, ['chrome', 'browser', 'web', 'http', '网页', '浏览器'])) {
    return '浏览器网页'
  }
  if (containsAny(normalized, ['jianying', 'capcut', 'video', 'ffmpeg', '剪映', '视频'])) {
    return '视频创作'
  }
  if (containsAny(normalized, ['excel', 'sheet', 'database', 'db', 'sql', 'file', 'fs', '文件', '表格'])) {
    return '数据文件'
  }
  if (containsAny(normalized, ['python', 'node', 'script', 'shell', 'powershell', '脚本'])) {
    return '自动化脚本'
  }
  return '其他软件'
}

function guessSoftwareIcon(text: string): SoftwareStoreIcon {
  const category = guessSoftwareCategory(text)
  if (category === '开发工具') return 'code'
  if (category === '办公协作') return 'chat'
  if (category === '浏览器网页') return 'browser'
  if (category === '视频创作') return 'video'
  if (category === '数据文件') return 'data'
  if (category === '自动化脚本') return 'automation'
  return 'tool'
}

function containsAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value))
}

function getStoreModeCount(item: SoftwareStoreItem): number {
  return Number(item.cliProfiles.length > 0) + Number(item.mcpServers.length > 0)
}

function getStoreModeLabel(item: SoftwareStoreItem): string {
  const modes = [
    item.cliProfiles.length > 0 ? 'CLI' : null,
    item.mcpServers.length > 0 ? 'MCP' : null,
  ].filter(Boolean)
  return modes.length > 0 ? modes.join(' / ') : '未接入'
}

function getSoftwareStoreRecommendedMode(item: SoftwareStoreItem): {
  mode: StoreDetailMode
  label: string
  reason: string
  action: string
} {
  if (item.cliProfiles.length > 0) {
    return {
      mode: 'cli',
      label: '优先用 CLI',
      reason: '适合终端命令、本地脚本、代码交付和桌面软件自动化。',
      action: '查看 CLI 或 MCP，确认能检测成功后分配给智能体。',
    }
  }
  if (item.mcpServers.length > 0) {
    return {
      mode: 'mcp',
      label: '优先用 MCP',
      reason: '适合结构化工具调用、外部服务、数据库、浏览器和文件能力。',
      action: '查看 MCP 工具列表，检测通过后分配给智能体。',
    }
  }
  if (item.softwareCommands.length > 0) {
    return {
      mode: 'commands',
      label: '优先用封装命令',
      reason: '适合把复杂软件操作做成一个可重复调用的动作。',
      action: '查看可用命令，再把命令加入智能体工具包。',
    }
  }
  return {
    mode: 'overview',
    label: '先创建接入',
    reason: '这个软件还没有 CLI、MCP 或封装命令，暂时不能直接交给智能体使用。',
    action: '进入高级配置创建 CLI、MCP 或软件配置。',
  }
}

function guessCliCommand(item: SoftwareStoreItem): string {
  const normalized = normalizeSoftwareText(item.name)
  if (normalized.includes('codex')) return 'codex'
  if (normalized.includes('claude')) return 'claude'
  if (normalized.includes('opencode')) return 'opencode'
  if (normalized.includes('python')) return 'python'
  if (normalized.includes('wechat') || normalized.includes('微信')) return 'wechat-cli'
  if (normalized.includes('jianying') || normalized.includes('capcut') || normalized.includes('剪映')) {
    return 'jianying-cli'
  }
  return normalizeSoftwareKey(item.name)
}

function getSoftwareStoreIntro(item: SoftwareStoreItem): string {
  const modes = getStoreModeLabel(item)
  if (getStoreModeCount(item) === 0) {
    return `${item.name} 还没有接入 CLI 或 MCP。接入后，智能体可以把它当成可选择的软件能力来调用。`
  }
  return `${item.name} 已接入 ${modes}，智能体可以通过这些模式使用它完成任务。CLI 更适合终端命令、脚本和本地交付；MCP 更适合稳定的工具调用和结构化能力。`
}

function getSoftwareStoreCapabilities(item: SoftwareStoreItem): string[] {
  const capabilities = [item.description]
  if (item.cliProfiles.length > 0) capabilities.push('可通过 CLI 调用')
  if (item.mcpServers.length > 0) capabilities.push('可通过 MCP 调用')
  if (item.softwareCommands.length > 0) capabilities.push('已有封装命令')
  if (item.mcpTools.length > 0) capabilities.push(`${item.mcpTools.length} 个 MCP 工具`)
  return Array.from(new Set(capabilities)).slice(0, 5)
}

function getSoftwareStoreAgentUseCopy(item: SoftwareStoreItem): string {
  if (getStoreModeCount(item) === 0) {
    return '还没有可分配给智能体的接入方式。先创建 CLI 或 MCP 接入，之后智能体设置里会直接出现这个软件能力。'
  }
  return '已经可以分配给智能体。创建或编辑智能体时，直接勾选这里的 CLI/MCP 能力，运行时系统会自动调用对应接入。'
}

function inferSoftwareAgentFit(item: SoftwareStoreItem): { role: string; action: string; route: string } {
  if (item.category === '开发工具') {
    return {
      role: '写代码 Agent、代码审查 Agent、测试 Agent',
      action: '修改代码、检查仓库、运行命令、提交交付结果。',
      route: item.cliProfiles.length > 0 ? '优先走 CLI，适合终端交付。' : '先创建 CLI 接入，再分配给代码类 Agent。',
    }
  }
  if (item.category === '办公协作') {
    return {
      role: '运营 Agent、客户沟通 Agent、项目助理 Agent',
      action: '整理沟通内容、生成草稿、同步通知和处理协作资料。',
      route: item.mcpServers.length > 0 ? '优先走 MCP，适合结构化消息和资料调用。' : '可以先创建 CLI 或 MCP 接入，再给协作类 Agent 使用。',
    }
  }
  if (item.category === '浏览器网页') {
    return {
      role: '研究 Agent、浏览器操作 Agent、资料收集 Agent',
      action: '访问网页、读取页面、检索信息、整理来源。',
      route: item.mcpServers.length > 0 ? '优先走 MCP 工具；需要登录态页面时走浏览器/桌面能力。' : '先注册浏览器或网页类接入。',
    }
  }
  if (item.category === '视频创作') {
    return {
      role: '视频制作 Agent、剪辑 Agent、交付检查 Agent',
      action: '整理素材、生成剪辑动作、检查导出文件和交付状态。',
      route: item.softwareCommands.length > 0 ? '优先走封装命令，复杂操作可以继续录制成命令。' : '先创建软件配置，再把常用动作封装成命令。',
    }
  }
  if (item.category === '数据文件') {
    return {
      role: '数据分析 Agent、报表 Agent、文件整理 Agent',
      action: '读取文件、清洗表格、生成报表和打包交付物。',
      route: item.cliProfiles.length > 0 || item.mcpServers.length > 0 ? '可直接分配给数据类 Agent。' : '先接入文件或表格能力。',
    }
  }
  return {
    role: '通用执行 Agent、自动化 Agent',
    action: '把重复操作变成智能体可调用的能力。',
    route: getStoreModeCount(item) > 0 ? '可直接进入智能体工具包。' : '先创建 CLI、MCP 或软件配置。',
  }
}

function formatCliModeMeta(profile: CliProfileRow): string {
  return `${profile.cwdPolicy} / ${profile.inputMode} -> ${profile.outputMode}`
}

function riskLevelLabel(value: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
  }
  return map[value]
}

export function ToolControlCenter() {
  const [agents, setAgents] = useState<AgentProfileRow[]>([])
  const [cliProfiles, setCliProfiles] = useState<CliProfileRow[]>([])
  const [cliRuns, setCliRuns] = useState<CliRunRow[]>([])
  const [toolConnections, setToolConnections] = useState<ToolConnectionRow[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerRow[]>([])
  const [mcpTools, setMcpTools] = useState<McpToolDefinitionRow[]>([])
  const [mcpCalls, setMcpCalls] = useState<McpToolCallRow[]>([])
  const [toolProtocolManifests, setToolProtocolManifests] = useState<ToolProtocolManifestRow[]>([])
  const [toolProtocolInvocations, setToolProtocolInvocations] = useState<ToolProtocolInvocationRow[]>([])
  const [toolProtocolResults, setToolProtocolResults] = useState<ToolProtocolResultRow[]>([])
  const [softwareProfiles, setSoftwareProfiles] = useState<SoftwareProfileRow[]>([])
  const [softwareCommands, setSoftwareCommands] = useState<SoftwareCommandRow[]>([])
  const [softwareRuns, setSoftwareRuns] = useState<SoftwareCommandRunRow[]>([])
  const [recordedMacros, setRecordedMacros] = useState<RecordedMacroRow[]>([])
  const [macroRuns, setMacroRuns] = useState<MacroReplayRunRow[]>([])
  const [apiKeys, setApiKeys] = useState<ProgrammaticApiKeyPublic[]>([])
  const [sdkTasks, setSdkTasks] = useState<SdkTaskRow[]>([])
  const [webhookSubscriptions, setWebhookSubscriptions] = useState<WebhookSubscriptionRow[]>([])
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDeliveryRow[]>([])

  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedMcpServerId, setSelectedMcpServerId] = useState('')
  const [selectedSoftwareProfileId, setSelectedSoftwareProfileId] = useState('')
  const [selectedSoftwareCommandId, setSelectedSoftwareCommandId] = useState('')
  const [selectedMacroId, setSelectedMacroId] = useState('')
  const [cliVariablesText, setCliVariablesText] = useState('{"goal":"prepare a dry-run plan"}')
  const [mcpInputText, setMcpInputText] = useState('{}')
  const [softwareInputText, setSoftwareInputText] = useState('{}')
  const [macroInputText, setMacroInputText] = useState('{}')
  const [lastRawApiKey, setLastRawApiKey] = useState('')

  const [cliDraft, setCliDraft] = useState({
    name: 'Codex CLI',
    command: 'codex',
    argsTemplate: '{{goal}}',
    cwdPolicy: 'agent_workspace' as CliProfileRow['cwdPolicy'],
    customCwd: '',
    timeoutMs: '120000',
    inputMode: 'args' as CliProfileRow['inputMode'],
    outputMode: 'stdout' as CliProfileRow['outputMode'],
    requiresApproval: true,
  })
  const [mcpDraft, setMcpDraft] = useState({
    displayName: 'Local MCP bridge',
    transport: 'stdio' as McpTransport,
    command: 'node',
    endpoint: '',
    toolsJson:
      '[{"name":"server.describe","displayName":"Describe server","riskLevel":"low","requiresApproval":false}]',
    enabled: true,
  })
  const [toolDraft, setToolDraft] = useState({
    displayName: 'Local tool connection',
    type: 'mcp' as ToolConnectionType,
    configText: '{}',
    enabled: true,
  })
  const [softwareDraft, setSoftwareDraft] = useState({
    name: 'Browser automation',
    appType: 'browser_app' as SoftwareAppType,
    adapterType: 'browser_automation' as SoftwareAdapterType,
    defaultWorkstationMode: 'browser_context' as WorkstationMode,
    launchCommand: '',
    executablePath: '',
  })
  const [commandDraft, setCommandDraft] = useState({
    softwareProfileId: '',
    name: 'Open controlled page',
    description: 'Dry-run browser automation command.',
    implementationText: '{"type":"browser","steps":[]}',
    riskLevel: 'low' as RiskLevel,
    requiresApproval: false,
  })
  const [macroDraft, setMacroDraft] = useState({
    softwareProfileId: '',
    name: 'Recorded export flow',
    description: 'Parameterized macro captured from a user operation.',
    stepsText: '[{"type":"click","target":"File > Export"}]',
    parameterBindingsText: '{}',
    riskLevel: 'medium' as RiskLevel,
    status: 'draft' as RecordedMacroRow['status'],
  })
  const [apiKeyDraft, setApiKeyDraft] = useState({
    name: 'Local SDK key',
    scopesText: 'tasks:write,tasks:read,memories:write',
  })
  const [sdkTaskDraft, setSdkTaskDraft] = useState({
    description: 'Create a report from the SDK task API',
    inputText: '{"source":"sdk-panel"}',
    priority: '1',
    maxBudgetCents: '100',
    webhookUrl: '',
  })
  const [webhookDraft, setWebhookDraft] = useState({
    name: 'Local webhook sink',
    url: 'https://example.com/reasonix-webhook',
    eventsText: 'run.completed,run.failed,webhook.test',
    secret: 'local-webhook-secret',
    filterText: '{}',
    maxRetries: '3',
    backoffMs: '30000',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<SavingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)
  const [storeSearch, setStoreSearch] = useState('')
  const [storeCategory, setStoreCategory] = useState<SoftwareStoreCategory>('全部')
  const [selectedStoreItemKey, setSelectedStoreItemKey] = useState('codex')
  const [selectedStoreDetailMode, setSelectedStoreDetailMode] = useState<StoreDetailMode>('overview')
  const [storeDetailOpen, setStoreDetailOpen] = useState(false)

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )
  const selectedMcpServer = useMemo(
    () => mcpServers.find((server) => server.id === selectedMcpServerId) ?? null,
    [mcpServers, selectedMcpServerId],
  )
  const softwareProfileById = useMemo(
    () => new Map(softwareProfiles.map((profile) => [profile.id, profile])),
    [softwareProfiles],
  )
  const mcpServerById = useMemo(
    () => new Map(mcpServers.map((server) => [server.id, server])),
    [mcpServers],
  )

  const visibleMcpTools = useMemo(
    () =>
      selectedMcpServerId
        ? mcpTools.filter((tool) => tool.mcpServerId === selectedMcpServerId)
        : mcpTools,
    [mcpTools, selectedMcpServerId],
  )
  const visibleSoftwareCommands = useMemo(
    () =>
      selectedSoftwareProfileId
        ? softwareCommands.filter((command) => command.softwareProfileId === selectedSoftwareProfileId)
        : softwareCommands,
    [selectedSoftwareProfileId, softwareCommands],
  )
  const visibleMacros = useMemo(
    () =>
      selectedSoftwareProfileId
        ? recordedMacros.filter((macro) => macro.softwareProfileId === selectedSoftwareProfileId)
        : recordedMacros,
    [recordedMacros, selectedSoftwareProfileId],
  )
  const softwareStoreItems = useMemo(
    () =>
      buildSoftwareStoreItems({
        cliProfiles,
        mcpServers,
        mcpTools,
        softwareProfiles,
        softwareCommands,
      }),
    [cliProfiles, mcpServers, mcpTools, softwareCommands, softwareProfiles],
  )
  const visibleSoftwareStoreItems = useMemo(() => {
    const query = normalizeSoftwareText(storeSearch)
    return softwareStoreItems.filter((item) => {
      const categoryMatches = storeCategory === '全部' || item.category === storeCategory
      const queryMatches =
        !query ||
        normalizeSoftwareText(
          `${item.name} ${item.description} ${item.category} ${item.aliases.join(' ')} ${item.cliProfiles
            .map((profile) => profile.name)
            .join(' ')} ${item.mcpServers.map((server) => server.displayName).join(' ')}`,
        ).includes(query)
      return categoryMatches && queryMatches
    })
  }, [softwareStoreItems, storeCategory, storeSearch])
  const selectedStoreItem = useMemo(
    () =>
      softwareStoreItems.find((item) => item.key === selectedStoreItemKey) ??
      visibleSoftwareStoreItems[0] ??
      softwareStoreItems[0] ??
      null,
    [selectedStoreItemKey, softwareStoreItems, visibleSoftwareStoreItems],
  )

  useEffect(() => {
    if (!selectedStoreItem && softwareStoreItems[0]) {
      setSelectedStoreItemKey(softwareStoreItems[0].key)
      return
    }
    if (selectedStoreItem && selectedStoreItem.key !== selectedStoreItemKey) {
      setSelectedStoreItemKey(selectedStoreItem.key)
    }
  }, [selectedStoreItem, selectedStoreItemKey, softwareStoreItems])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        agentsNext,
        cliProfilesNext,
        cliRunsNext,
        toolConnectionsNext,
        mcpServersNext,
        mcpToolsNext,
        mcpCallsNext,
        toolProtocolManifestsNext,
        toolProtocolInvocationsNext,
        toolProtocolResultsNext,
        softwareProfilesNext,
        softwareCommandsNext,
        softwareRunsNext,
        recordedMacrosNext,
        macroRunsNext,
        apiKeysNext,
        sdkTasksNext,
        webhookSubscriptionsNext,
        webhookDeliveriesNext,
      ] = await Promise.all([
        fetchAgentProfiles(),
        fetchCliProfiles(),
        fetchCliRuns(),
        fetchToolConnections(),
        fetchMcpServers(),
        fetchMcpToolDefinitions(),
        fetchMcpToolCalls(),
        fetchToolProtocolManifests({ limit: 50 }),
        fetchToolProtocolInvocations({ limit: 50 }),
        fetchToolProtocolResults({ limit: 50 }),
        fetchSoftwareProfiles(),
        fetchSoftwareCommands(),
        fetchSoftwareCommandRuns(),
        fetchRecordedMacros(),
        fetchMacroReplayRuns(),
        fetchProgrammaticApiKeys(),
        fetchSdkTasks(),
        fetchWebhookSubscriptions(),
        fetchWebhookDeliveries(),
      ])
      setAgents(agentsNext)
      setCliProfiles(cliProfilesNext)
      setCliRuns(cliRunsNext)
      setToolConnections(toolConnectionsNext)
      setMcpServers(mcpServersNext)
      setMcpTools(mcpToolsNext)
      setMcpCalls(mcpCallsNext)
      setToolProtocolManifests(toolProtocolManifestsNext)
      setToolProtocolInvocations(toolProtocolInvocationsNext)
      setToolProtocolResults(toolProtocolResultsNext)
      setSoftwareProfiles(softwareProfilesNext)
      setSoftwareCommands(softwareCommandsNext)
      setSoftwareRuns(softwareRunsNext)
      setRecordedMacros(recordedMacrosNext)
      setMacroRuns(macroRunsNext)
      setApiKeys(apiKeysNext)
      setSdkTasks(sdkTasksNext)
      setWebhookSubscriptions(webhookSubscriptionsNext)
      setWebhookDeliveries(webhookDeliveriesNext)
      setSelectedAgentId((current) =>
        current && agentsNext.some((agent) => agent.id === current) ? current : agentsNext[0]?.id ?? '',
      )
      setSelectedMcpServerId((current) =>
        current && mcpServersNext.some((server) => server.id === current)
          ? current
          : mcpServersNext[0]?.id ?? '',
      )
      setSelectedSoftwareProfileId((current) => {
        const next =
          current && softwareProfilesNext.some((profile) => profile.id === current)
            ? current
            : softwareProfilesNext[0]?.id ?? ''
        setCommandDraft((draft) => ({ ...draft, softwareProfileId: draft.softwareProfileId || next }))
        setMacroDraft((draft) => ({ ...draft, softwareProfileId: draft.softwareProfileId || next }))
        return next
      })
      setSelectedSoftwareCommandId((current) =>
        current && softwareCommandsNext.some((command) => command.id === current)
          ? current
          : softwareCommandsNext[0]?.id ?? '',
      )
      setSelectedMacroId((current) =>
        current && recordedMacrosNext.some((macro) => macro.id === current)
          ? current
          : recordedMacrosNext[0]?.id ?? '',
      )
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const withAction = async (action: SavingAction, work: () => Promise<string>) => {
    setSaving(action)
    setError(null)
    setNotice(null)
    try {
      const message = await work()
      setNotice(message)
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const submitApiKey = () =>
    withAction('api-key', async () => {
      const result = await createProgrammaticApiKey({
        name: apiKeyDraft.name,
        scopes: parseCsv(apiKeyDraft.scopesText),
      })
      setLastRawApiKey(result.rawKey)
      return `Programmatic API key created: ${result.apiKey.keyPrefix}`
    })

  const revokeApiKey = (key: ProgrammaticApiKeyPublic) =>
    withAction(`api-key-revoke:${key.id}`, async () => {
      await revokeProgrammaticApiKey(key.id)
      return `API key revoked: ${key.keyPrefix}`
    })

  const submitSdkTask = () =>
    withAction('sdk-task', async () => {
      const task = await createSdkTask({
        agentProfileId: selectedAgentId || null,
        description: sdkTaskDraft.description,
        input: parseJsonObject(sdkTaskDraft.inputText, 'SDK task input'),
        priority: parseInteger(sdkTaskDraft.priority, 0),
        maxBudgetCents: parseOptionalInteger(sdkTaskDraft.maxBudgetCents),
        webhookUrl: sdkTaskDraft.webhookUrl || null,
      })
      return `SDK task ${task.sdkTask.status} with ${task.webhookDeliveries.length} webhook deliveries`
    })

  const submitWebhook = () =>
    withAction('webhook', async () => {
      await createWebhookSubscription({
        name: webhookDraft.name,
        url: webhookDraft.url,
        events: parseWebhookEvents(webhookDraft.eventsText),
        secret: webhookDraft.secret,
        filter: parseJsonObject(webhookDraft.filterText, 'Webhook filter'),
        retry: {
          maxRetries: parseInteger(webhookDraft.maxRetries, 3),
          backoffMs: parseInteger(webhookDraft.backoffMs, 30000),
        },
        deliveryMode: 'record_only',
      })
      return 'Webhook subscription created'
    })

  const sendWebhookTest = (subscription: WebhookSubscriptionRow) =>
    withAction(`webhook-test:${subscription.id}`, async () => {
      const delivery = await testWebhookSubscription(subscription.id)
      return `Webhook test ${delivery.status}`
    })

  const seedToolProtocol = () =>
    withAction('tool-protocol-seed', async () => {
      const manifests = await seedToolInvocationProtocol()
      return `Tool protocol manifests ${manifests.length}`
    })

  const createToolProtocolSample = () =>
    withAction('tool-protocol-sample', async () => {
      const manifests =
        toolProtocolManifests.length > 0 ? toolProtocolManifests : await seedToolInvocationProtocol()
      const manifest = manifests.find((item) => item.name === 'filesystem.read') ?? manifests[0]
      if (!manifest) throw new Error('Seed ToolManifest first.')
      const invocation = await createToolProtocolInvocation({
        manifestId: manifest.id,
        toolName: manifest.name,
        arguments: { path: 'README.md' },
        idempotencyKey: 'tool-control-sample',
      })
      await createToolProtocolResult({
        invocationId: invocation.id,
        callId: invocation.callId,
        success: true,
        data: { preview: 'standard ToolResult dry-run' },
        metadata: { source: 'tool-control-center' },
      })
      return `Tool protocol sample ${invocation.callId}`
    })

  const submitCli = () =>
    withAction('cli', async () => {
      await createCliProfile({
        name: cliDraft.name,
        command: cliDraft.command,
        argsTemplate: cliDraft.argsTemplate,
        cwdPolicy: cliDraft.cwdPolicy,
        customCwd: cliDraft.customCwd || null,
        timeoutMs: parsePositiveInt(cliDraft.timeoutMs, 120000),
        inputMode: cliDraft.inputMode,
        outputMode: cliDraft.outputMode,
        requiresApproval: cliDraft.requiresApproval,
      })
      return 'CLI profile created'
    })

  const runCliDryRun = (profile: CliProfileRow) =>
    withAction(`cli-run:${profile.id}`, async () => {
      const run = await runCliProfile(profile.id, {
        agentProfileId: selectedAgentId || null,
        variables: parsePrimitiveRecord(cliVariablesText, 'CLI variables'),
        mode: 'dry_run',
      })
      return `CLI dry-run ${run.status}`
    })

  const submitMcp = () =>
    withAction('mcp', async () => {
      const env: Record<string, string> = {}
      if (mcpDraft.toolsJson.trim()) {
        env.AGENTHUB_MCP_TOOLS = JSON.stringify(parseJsonValue(mcpDraft.toolsJson, 'MCP tools manifest'))
      }
      await createMcpServer({
        displayName: mcpDraft.displayName,
        transport: mcpDraft.transport,
        command: mcpDraft.command || null,
        endpoint: mcpDraft.endpoint || null,
        env,
        enabled: mcpDraft.enabled,
      })
      return 'MCP server registered'
    })

  const discoverTools = (server: McpServerRow) =>
    withAction(`mcp-discover:${server.id}`, async () => {
      const tools = await discoverMcpTools(server.id)
      return `Discovered ${tools.length} MCP tools`
    })

  const runToolDryRun = (tool: McpToolDefinitionRow) =>
    withAction(`mcp-run:${tool.id}`, async () => {
      const call = await runMcpTool(tool.id, {
        agentProfileId: selectedAgentId || null,
        input: parseJsonObject(mcpInputText, 'MCP input'),
        mode: 'dry_run',
      })
      return `MCP dry-run ${call.status}`
    })

  const submitToolConnection = () =>
    withAction('tool', async () => {
      await createToolConnection({
        displayName: toolDraft.displayName,
        type: toolDraft.type,
        config: parseJsonObject(toolDraft.configText, 'Tool connection config'),
        enabled: toolDraft.enabled,
      })
      return 'Tool connection created'
    })

  const submitSoftware = () =>
    withAction('software', async () => {
      await createSoftwareProfile({
        name: softwareDraft.name,
        appType: softwareDraft.appType,
        adapterType: softwareDraft.adapterType,
        defaultWorkstationMode: softwareDraft.defaultWorkstationMode,
        launchCommand: softwareDraft.launchCommand || null,
        executablePath: softwareDraft.executablePath || null,
      })
      return 'Software profile created'
    })

  const submitSoftwareCommand = () =>
    withAction('command', async () => {
      await createSoftwareCommand(commandDraft.softwareProfileId, {
        name: commandDraft.name,
        description: commandDraft.description,
        implementation: parseJsonObject(commandDraft.implementationText, 'Software implementation'),
        riskLevel: commandDraft.riskLevel,
        requiresApproval: commandDraft.requiresApproval,
      })
      return 'Software command created'
    })

  const runCommandDryRun = (command: SoftwareCommandRow) =>
    withAction(`command-run:${command.id}`, async () => {
      const run = await runSoftwareCommand(command.id, {
        agentProfileId: selectedAgentId || null,
        input: parseJsonObject(softwareInputText, 'Software command input'),
        mode: 'dry_run',
      })
      return `Software dry-run ${run.status}`
    })

  const submitMacro = () =>
    withAction('macro', async () => {
      await createRecordedMacro({
        softwareProfileId: macroDraft.softwareProfileId,
        name: macroDraft.name,
        description: macroDraft.description,
        steps: parseJsonArray(macroDraft.stepsText, 'Macro steps'),
        parameterBindings: parseJsonObject(macroDraft.parameterBindingsText, 'Macro parameter bindings'),
        riskLevel: macroDraft.riskLevel,
        status: macroDraft.status,
      })
      return 'Recorded macro saved'
    })

  const replayMacroDryRun = (macro: RecordedMacroRow) =>
    withAction(`macro-run:${macro.id}`, async () => {
      const replay = await replayRecordedMacro(macro.id, {
        softwareCommandId: selectedSoftwareCommandId || null,
        agentProfileId: selectedAgentId || null,
        input: parseJsonObject(macroInputText, 'Macro input'),
        mode: 'dry_run',
      })
      return `Macro dry-run ${replay.status}`
    })

  const openAdvancedForCli = (item: SoftwareStoreItem) => {
    setCliDraft((draft) => ({
      ...draft,
      name: `${item.name} CLI`,
      command: guessCliCommand(item),
      argsTemplate: draft.argsTemplate || '{{goal}}',
    }))
    setShowAdvancedTools(true)
  }

  const openAdvancedForMcp = (item: SoftwareStoreItem) => {
    setMcpDraft((draft) => ({
      ...draft,
      displayName: `${item.name} MCP`,
      command: guessCliCommand(item),
      endpoint: '',
    }))
    setShowAdvancedTools(true)
  }

  const openAdvancedForSoftware = (item: SoftwareStoreItem) => {
    setSoftwareDraft((draft) => ({
      ...draft,
      name: item.name,
      adapterType:
        item.cliProfiles.length > 0 ? 'cli' : item.mcpServers.length > 0 ? 'mcp' : draft.adapterType,
    }))
    setShowAdvancedTools(true)
  }

  if (!showAdvancedTools) {
    const connectedSoftwareCount = softwareStoreItems.filter((item) => getStoreModeCount(item) > 0).length
    const totalModeCount = cliProfiles.length + mcpServers.length

    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
        <header className="shrink-0 border-b bg-background px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LayoutGrid className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">软件能力商店</h2>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                像软件商店一样选择能力。点一个软件，就能看到它有什么 CLI、MCP、命令，以及怎么给智能体使用。
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" disabled={loading} onClick={() => void reload()}>
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                刷新
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowAdvancedTools(true)}>
                <Settings2 className="size-4" />
                高级配置
              </Button>
            </div>
          </div>
          {(error || notice) && (
            <div
              className={cn(
                'mt-3 rounded-md border px-3 py-2 text-sm',
                error
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {error ?? notice}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="mx-auto max-w-7xl space-y-4">
            <section className="min-w-0 space-y-4">
              <SoftwareAccessAssistant
                selectedItem={selectedStoreItem}
                connectedSoftwareCount={connectedSoftwareCount}
                totalModeCount={totalModeCount}
                commandCount={softwareCommands.length + mcpTools.length}
                activeCategory={storeCategory}
                onQuickCategory={setStoreCategory}
                onOpenMode={setSelectedStoreDetailMode}
                onOpenAdvanced={() => setShowAdvancedTools(true)}
              />

              <div className="grid gap-3 md:grid-cols-3">
                <SoftwareStoreStat label="已接入软件" value={connectedSoftwareCount} />
                <SoftwareStoreStat label="CLI / MCP 模式" value={totalModeCount} />
                <SoftwareStoreStat label="可调用命令" value={softwareCommands.length + mcpTools.length} />
              </div>

              <div className="rounded-lg border bg-background p-3 shadow-sm">
                <div className="flex flex-col gap-3">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={storeSearch}
                      onChange={(event) => setStoreSearch(event.target.value)}
                      className="pl-9"
                      placeholder="搜索软件、CLI、MCP"
                    />
                  </div>
                  <div className="flex max-w-full flex-wrap gap-2">
                    {softwareStoreCategories.map((category) => (
                      <Button
                        key={category}
                        type="button"
                        size="sm"
                        variant={storeCategory === category ? 'default' : 'outline'}
                        className="shrink-0"
                        onClick={() => setStoreCategory(category)}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <SoftwareStoreUsePath selectedItem={selectedStoreItem} />

              {visibleSoftwareStoreItems.length === 0 ? (
                <EmptyState label="没有匹配的软件" />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {visibleSoftwareStoreItems.map((item) => (
                    <SoftwareStoreCard
                      key={item.key}
                      item={item}
                      selected={selectedStoreItem?.key === item.key}
                      onSelect={() => {
                        setSelectedStoreItemKey(item.key)
                        setSelectedStoreDetailMode('overview')
                        setStoreDetailOpen(true)
                      }}
                      onOpenMode={(mode) => {
                        setSelectedStoreItemKey(item.key)
                        setSelectedStoreDetailMode(mode)
                        setStoreDetailOpen(true)
                      }}
                    />
                  ))}
                </div>
              )}
            </section>

            <Dialog open={storeDetailOpen} onOpenChange={setStoreDetailOpen}>
              <DialogContent
                className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl"
                data-testid="software-settings-dialog"
              >
                {selectedStoreItem ? (
                  <>
                    <DialogHeader className="border-b px-5 py-4 pr-12">
                      <div className="flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {renderSoftwareStoreIcon(selectedStoreItem.icon, 'size-5')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <DialogTitle>{selectedStoreItem.name} 设置</DialogTitle>
                            <Badge variant="outline">{selectedStoreItem.category}</Badge>
                            <Badge variant={getStoreModeCount(selectedStoreItem) > 0 ? 'default' : 'outline'}>
                              {getStoreModeLabel(selectedStoreItem)}
                            </Badge>
                          </div>
                          <DialogDescription className="mt-1 leading-6">
                            设置这款软件的 CLI、MCP、封装命令，以及它要怎么交给智能体使用。
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <ScrollArea className="max-h-[calc(88vh-5.5rem)]">
                      <div
                        className="p-4"
                        data-selected-mode={selectedStoreDetailMode}
                        data-testid="software-store-detail"
                      >
                    <SoftwareStoreDetailHero
                      item={selectedStoreItem}
                      selectedMode={selectedStoreDetailMode}
                      onModeChange={setSelectedStoreDetailMode}
                      onAssignToAgent={() => emitUiCommand('open-agent-settings')}
                      onCreateAccess={() => openAdvancedForSoftware(selectedStoreItem)}
                    />

                    <SoftwareStoreUseGuide item={selectedStoreItem} />

                    <SoftwareStoreAccessMatrix
                      item={selectedStoreItem}
                      selectedMode={selectedStoreDetailMode}
                      onModeChange={setSelectedStoreDetailMode}
                    />

                    <SoftwareStoreAssignmentPlan item={selectedStoreItem} />

                    <StoreAgentUsePanel
                      item={selectedStoreItem}
                      onOpenCli={() => setSelectedStoreDetailMode('cli')}
                      onOpenMcp={() => setSelectedStoreDetailMode('mcp')}
                      onAssignToAgent={() => emitUiCommand('open-agent-settings')}
                      onCreateCli={() => openAdvancedForCli(selectedStoreItem)}
                      onCreateMcp={() => openAdvancedForMcp(selectedStoreItem)}
                      onCreateSoftware={() => openAdvancedForSoftware(selectedStoreItem)}
                    />

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <SoftwareStoreMiniStat label="CLI" value={selectedStoreItem.cliProfiles.length} />
                      <SoftwareStoreMiniStat label="MCP" value={selectedStoreItem.mcpServers.length} />
                      <SoftwareStoreMiniStat label="命令" value={selectedStoreItem.softwareCommands.length} />
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">查看接入方式</div>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border bg-muted/20 p-1">
                      <StoreDetailModeButton
                        label="概览"
                        active={selectedStoreDetailMode === 'overview'}
                        onClick={() => setSelectedStoreDetailMode('overview')}
                      />
                      <StoreDetailModeButton
                        label="CLI"
                        active={selectedStoreDetailMode === 'cli'}
                        onClick={() => setSelectedStoreDetailMode('cli')}
                      />
                      <StoreDetailModeButton
                        label="MCP"
                        active={selectedStoreDetailMode === 'mcp'}
                        onClick={() => setSelectedStoreDetailMode('mcp')}
                      />
                      <StoreDetailModeButton
                        label="命令"
                        active={selectedStoreDetailMode === 'commands'}
                        onClick={() => setSelectedStoreDetailMode('commands')}
                      />
                      </div>
                    </div>

                    <SoftwareStoreModeSummary
                      item={selectedStoreItem}
                      mode={selectedStoreDetailMode}
                    />

                    <div className="mt-4 space-y-3">
                      {(selectedStoreDetailMode === 'overview' || selectedStoreDetailMode === 'cli') && (
                        <StoreModeSection
                          title="CLI 接入"
                          icon={<Terminal className="size-4" />}
                          count={selectedStoreItem.cliProfiles.length}
                        >
                          {selectedStoreItem.cliProfiles.length > 0 ? (
                            selectedStoreItem.cliProfiles.map((profile) => (
                              <StoreConnectionRow
                                key={profile.id}
                                title={profile.name}
                                subtitle={`${profile.command} ${profile.argsTemplate}`.trim()}
                                badge={profile.healthStatus}
                                meta={formatCliModeMeta(profile)}
                                actions={
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    disabled={saving !== null}
                                    onClick={() =>
                                      void withAction(`cli-test:${profile.id}`, async () => {
                                        const result = await testCliProfile(profile.id)
                                        return `CLI 检测 ${result.status}`
                                      })
                                    }
                                  >
                                    {saving === `cli-test:${profile.id}` ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="size-3" />
                                    )}
                                    检测
                                  </Button>
                                }
                              />
                            ))
                          ) : (
                            <StoreEmptyMode
                              label="还没有 CLI 接入"
                              actionLabel="创建 CLI 接入"
                              icon={<Terminal className="size-4" />}
                              onAction={() => openAdvancedForCli(selectedStoreItem)}
                            />
                          )}
                        </StoreModeSection>
                      )}

                      {(selectedStoreDetailMode === 'overview' || selectedStoreDetailMode === 'mcp') && (
                        <StoreModeSection
                          title="MCP 接入"
                          icon={<Plug className="size-4" />}
                          count={selectedStoreItem.mcpServers.length}
                        >
                          {selectedStoreItem.mcpServers.length > 0 ? (
                            selectedStoreItem.mcpServers.map((server) => {
                              const serverTools = mcpTools.filter((tool) => tool.mcpServerId === server.id)
                              return (
                                <StoreConnectionRow
                                  key={server.id}
                                  title={server.displayName}
                                  subtitle={`${server.transport} ${server.command ?? server.endpoint ?? ''}`.trim()}
                                  badge={server.enabled ? server.healthStatus : 'disabled'}
                                  meta={`${serverTools.length} 个工具`}
                                  detail={serverTools.slice(0, 4).map((tool) => tool.displayName || tool.toolName).join(' / ')}
                                  actions={
                                    <>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        disabled={saving !== null}
                                        onClick={() =>
                                          void withAction(`mcp-test:${server.id}`, async () => {
                                            const result = await testMcpServer(server.id)
                                            return `MCP 检测 ${result.status}`
                                          })
                                        }
                                      >
                                        {saving === `mcp-test:${server.id}` ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <RefreshCw className="size-3" />
                                        )}
                                        检测
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        disabled={saving !== null}
                                        onClick={() => void discoverTools(server)}
                                      >
                                        发现
                                      </Button>
                                    </>
                                  }
                                />
                              )
                            })
                          ) : (
                            <StoreEmptyMode
                              label="还没有 MCP 接入"
                              actionLabel="注册 MCP 接入"
                              icon={<Plug className="size-4" />}
                              onAction={() => openAdvancedForMcp(selectedStoreItem)}
                            />
                          )}
                        </StoreModeSection>
                      )}

                      {selectedStoreDetailMode === 'overview' && getStoreModeCount(selectedStoreItem) === 0 && (
                        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                          这个软件还没有接入方式。
                        </div>
                      )}

                      {(selectedStoreDetailMode === 'overview' || selectedStoreDetailMode === 'commands') && (
                        <StoreModeSection
                          title="可用命令"
                          icon={<Cpu className="size-4" />}
                          count={selectedStoreItem.softwareCommands.length}
                        >
                          {selectedStoreItem.softwareCommands.length > 0 ? (
                            selectedStoreItem.softwareCommands.slice(0, 6).map((command) => (
                              <StoreConnectionRow
                                key={command.id}
                                title={command.name}
                                subtitle={command.description || '软件命令'}
                                badge={command.healthStatus}
                                meta={`${riskLevelLabel(command.riskLevel)} / ${
                                  command.requiresApproval ? '需要确认' : '可自动执行'
                                }`}
                              />
                            ))
                          ) : (
                            <StoreEmptyMode
                              label="还没有封装命令"
                              actionLabel="创建软件配置"
                              icon={<Package className="size-4" />}
                              onAction={() => openAdvancedForSoftware(selectedStoreItem)}
                            />
                          )}
                        </StoreModeSection>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2">
                      {selectedStoreItem.cliProfiles.length === 0 && (
                        <Button
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={() => openAdvancedForCli(selectedStoreItem)}
                        >
                          <Terminal className="size-4" />
                          创建 CLI 接入
                        </Button>
                      )}
                      {selectedStoreItem.mcpServers.length === 0 && (
                        <Button
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={() => openAdvancedForMcp(selectedStoreItem)}
                        >
                          <Plug className="size-4" />
                          注册 MCP 接入
                        </Button>
                      )}
                      {selectedStoreItem.softwareProfiles.length === 0 && (
                        <Button
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={() => openAdvancedForSoftware(selectedStoreItem)}
                        >
                          <Package className="size-4" />
                          创建软件配置
                        </Button>
                      )}
                    </div>
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end border-t bg-muted/30 px-5 py-3">
                      <Button
                        variant="outline"
                        data-testid="software-store-back"
                        onClick={() => setStoreDetailOpen(false)}
                      >
                        取消
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState label="请选择一个软件" />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wrench className="size-4" />
              <span className="truncate">完整工具配置</span>
            </div>
            <div className="mt-1 grid grid-cols-10 gap-1 text-[10px] text-muted-foreground">
              <Metric label="CLI" value={cliProfiles.length} />
              <Metric label="MCP" value={mcpServers.length} />
              <Metric label="工具" value={toolConnections.length + mcpTools.length} />
              <Metric label="软件" value={softwareProfiles.length} />
              <Metric label="命令" value={softwareCommands.length} />
              <Metric label="宏" value={recordedMacros.length} />
              <Metric label="密钥" value={apiKeys.length} />
              <Metric label="任务" value={sdkTasks.length} />
              <Metric label="回调" value={webhookSubscriptions.length} />
              <Metric label="事件" value={webhookDeliveries.length} />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowAdvancedTools(false)}>
              <LayoutGrid className="size-4" />
              返回商店
            </Button>
            <Button size="icon" variant="ghost" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        {(error || notice) && (
          <div
            className={cn(
              'mt-2 rounded-md border px-2 py-1.5 text-[11px]',
              error
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}
          >
            {error ?? notice}
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[19rem_1fr]">
        <ScrollArea className="min-h-0 border-r">
          <div className="space-y-3 p-3">
            <Section title="Run Context" icon={<Cpu className="size-3.5" />}>
              <Select
                value={selectedAgentId}
                onChange={setSelectedAgentId}
                options={agents.map((agent) => agent.id)}
                labels={Object.fromEntries(agents.map((agent) => [agent.id, agent.name]))}
                emptyLabel="No Agent selected"
              />
              <Hint>
                {selectedAgent
                  ? `${selectedAgent.role} uses dry-run calls from this panel.`
                  : 'Dry-run calls can be created without binding an Agent.'}
              </Hint>
            </Section>

            <Section title="Tool Protocol" icon={<Wrench className="size-3.5" />}>
              <Button
                className="h-8 w-full gap-1"
                variant="outline"
                onClick={() => void seedToolProtocol()}
                disabled={saving !== null}
              >
                {saving === 'tool-protocol-seed' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Seed Manifests
              </Button>
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void createToolProtocolSample()}
                disabled={saving !== null}
              >
                {saving === 'tool-protocol-sample' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                Sample Call
              </Button>
            </Section>

            <Section title="SDK Access" icon={<KeyRound className="size-3.5" />}>
              <Input
                value={apiKeyDraft.name}
                onChange={(event) =>
                  setApiKeyDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                placeholder="API key name"
              />
              <Input
                value={apiKeyDraft.scopesText}
                onChange={(event) =>
                  setApiKeyDraft((draft) => ({ ...draft, scopesText: event.target.value }))
                }
                placeholder="tasks:write,tasks:read"
              />
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitApiKey()}
                disabled={saving !== null || !apiKeyDraft.name.trim()}
              >
                {saving === 'api-key' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <KeyRound className="size-3.5" />
                )}
                Create SDK Key
              </Button>
              {lastRawApiKey && <Hint>New key: {lastRawApiKey}</Hint>}
              <Textarea
                className="min-h-16 text-xs"
                value={sdkTaskDraft.description}
                onChange={(event) =>
                  setSdkTaskDraft((draft) => ({ ...draft, description: event.target.value }))
                }
                placeholder="Task description"
              />
              <Textarea
                className="min-h-16 text-xs"
                value={sdkTaskDraft.inputText}
                onChange={(event) =>
                  setSdkTaskDraft((draft) => ({ ...draft, inputText: event.target.value }))
                }
                placeholder="Task input JSON"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={sdkTaskDraft.priority}
                  onChange={(event) =>
                    setSdkTaskDraft((draft) => ({ ...draft, priority: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="Priority"
                />
                <Input
                  value={sdkTaskDraft.maxBudgetCents}
                  onChange={(event) =>
                    setSdkTaskDraft((draft) => ({ ...draft, maxBudgetCents: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="Budget cents"
                />
              </div>
              <Input
                value={sdkTaskDraft.webhookUrl}
                onChange={(event) =>
                  setSdkTaskDraft((draft) => ({ ...draft, webhookUrl: event.target.value }))
                }
                placeholder="One-off webhook URL"
              />
              <Button
                className="h-8 w-full gap-1"
                variant="outline"
                onClick={() => void submitSdkTask()}
                disabled={saving !== null || !selectedAgentId || !sdkTaskDraft.description.trim()}
              >
                {saving === 'sdk-task' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                Create SDK Task
              </Button>
            </Section>

            <Section title="Webhook" icon={<Plug className="size-3.5" />}>
              <Input
                value={webhookDraft.name}
                onChange={(event) =>
                  setWebhookDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                placeholder="Webhook name"
              />
              <Input
                value={webhookDraft.url}
                onChange={(event) =>
                  setWebhookDraft((draft) => ({ ...draft, url: event.target.value }))
                }
                placeholder="Webhook URL"
              />
              <Input
                value={webhookDraft.eventsText}
                onChange={(event) =>
                  setWebhookDraft((draft) => ({ ...draft, eventsText: event.target.value }))
                }
                placeholder="run.completed,run.failed"
              />
              <Input
                value={webhookDraft.secret}
                onChange={(event) =>
                  setWebhookDraft((draft) => ({ ...draft, secret: event.target.value }))
                }
                placeholder="HMAC secret"
              />
              <Textarea
                className="min-h-16 text-xs"
                value={webhookDraft.filterText}
                onChange={(event) =>
                  setWebhookDraft((draft) => ({ ...draft, filterText: event.target.value }))
                }
                placeholder="Filter JSON"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={webhookDraft.maxRetries}
                  onChange={(event) =>
                    setWebhookDraft((draft) => ({ ...draft, maxRetries: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="Retries"
                />
                <Input
                  value={webhookDraft.backoffMs}
                  onChange={(event) =>
                    setWebhookDraft((draft) => ({ ...draft, backoffMs: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="Backoff ms"
                />
              </div>
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitWebhook()}
                disabled={saving !== null || !webhookDraft.name.trim() || !webhookDraft.url.trim()}
              >
                {saving === 'webhook' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Create Webhook
              </Button>
            </Section>

            <Section title="CLI Profile" icon={<Terminal className="size-3.5" />}>
              <Input
                value={cliDraft.name}
                onChange={(event) => setCliDraft((draft) => ({ ...draft, name: event.target.value }))}
                placeholder="Name"
              />
              <Input
                value={cliDraft.command}
                onChange={(event) =>
                  setCliDraft((draft) => ({ ...draft, command: event.target.value }))
                }
                placeholder="Command"
              />
              <Input
                value={cliDraft.argsTemplate}
                onChange={(event) =>
                  setCliDraft((draft) => ({ ...draft, argsTemplate: event.target.value }))
                }
                placeholder="Args template"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={cliDraft.cwdPolicy}
                  onChange={(value) =>
                    setCliDraft((draft) => ({
                      ...draft,
                      cwdPolicy: value as CliProfileRow['cwdPolicy'],
                    }))
                  }
                  options={['workspace', 'agent_workspace', 'custom']}
                />
                <Input
                  value={cliDraft.timeoutMs}
                  onChange={(event) =>
                    setCliDraft((draft) => ({ ...draft, timeoutMs: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="Timeout"
                />
              </div>
              {cliDraft.cwdPolicy === 'custom' && (
                <Input
                  value={cliDraft.customCwd}
                  onChange={(event) =>
                    setCliDraft((draft) => ({ ...draft, customCwd: event.target.value }))
                  }
                  placeholder="Custom cwd"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={cliDraft.inputMode}
                  onChange={(value) =>
                    setCliDraft((draft) => ({
                      ...draft,
                      inputMode: value as CliProfileRow['inputMode'],
                    }))
                  }
                  options={['stdin', 'args', 'file']}
                />
                <Select
                  value={cliDraft.outputMode}
                  onChange={(value) =>
                    setCliDraft((draft) => ({
                      ...draft,
                      outputMode: value as CliProfileRow['outputMode'],
                    }))
                  }
                  options={['stdout', 'file', 'json']}
                />
              </div>
              <Toggle
                label="Requires approval"
                checked={cliDraft.requiresApproval}
                onChange={(checked) =>
                  setCliDraft((draft) => ({ ...draft, requiresApproval: checked }))
                }
              />
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitCli()}
                disabled={saving !== null || !cliDraft.name.trim() || !cliDraft.command.trim()}
              >
                {saving === 'cli' ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Create CLI
              </Button>
            </Section>

            <Section title="MCP Server" icon={<Plug className="size-3.5" />}>
              <Input
                value={mcpDraft.displayName}
                onChange={(event) =>
                  setMcpDraft((draft) => ({ ...draft, displayName: event.target.value }))
                }
                placeholder="Display name"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={mcpDraft.transport}
                  onChange={(value) =>
                    setMcpDraft((draft) => ({ ...draft, transport: value as McpTransport }))
                  }
                  options={mcpTransports}
                />
                <Input
                  value={mcpDraft.command}
                  onChange={(event) =>
                    setMcpDraft((draft) => ({ ...draft, command: event.target.value }))
                  }
                  placeholder="Command"
                />
              </div>
              <Input
                value={mcpDraft.endpoint}
                onChange={(event) =>
                  setMcpDraft((draft) => ({ ...draft, endpoint: event.target.value }))
                }
                placeholder="Endpoint"
              />
              <Textarea
                className="min-h-20 text-xs"
                value={mcpDraft.toolsJson}
                onChange={(event) =>
                  setMcpDraft((draft) => ({ ...draft, toolsJson: event.target.value }))
                }
                placeholder="Tools manifest JSON"
              />
              <Toggle
                label="Enabled"
                checked={mcpDraft.enabled}
                onChange={(checked) => setMcpDraft((draft) => ({ ...draft, enabled: checked }))}
              />
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitMcp()}
                disabled={saving !== null || !mcpDraft.displayName.trim()}
              >
                {saving === 'mcp' ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Register MCP
              </Button>
            </Section>

            <Section title="Tool Connection" icon={<Activity className="size-3.5" />}>
              <Input
                value={toolDraft.displayName}
                onChange={(event) =>
                  setToolDraft((draft) => ({ ...draft, displayName: event.target.value }))
                }
                placeholder="Display name"
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Select
                  value={toolDraft.type}
                  onChange={(value) =>
                    setToolDraft((draft) => ({ ...draft, type: value as ToolConnectionType }))
                  }
                  options={toolTypes}
                />
                <Toggle
                  label="On"
                  checked={toolDraft.enabled}
                  onChange={(checked) => setToolDraft((draft) => ({ ...draft, enabled: checked }))}
                />
              </div>
              <Textarea
                className="min-h-16 text-xs"
                value={toolDraft.configText}
                onChange={(event) =>
                  setToolDraft((draft) => ({ ...draft, configText: event.target.value }))
                }
                placeholder="Config JSON"
              />
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitToolConnection()}
                disabled={saving !== null || !toolDraft.displayName.trim()}
              >
                {saving === 'tool' ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Create Tool
              </Button>
            </Section>

            <Section title="Software Profile" icon={<Package className="size-3.5" />}>
              <Input
                value={softwareDraft.name}
                onChange={(event) =>
                  setSoftwareDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                placeholder="Name"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={softwareDraft.appType}
                  onChange={(value) =>
                    setSoftwareDraft((draft) => ({
                      ...draft,
                      appType: value as SoftwareAppType,
                    }))
                  }
                  options={softwareAppTypes}
                />
                <Select
                  value={softwareDraft.adapterType}
                  onChange={(value) =>
                    setSoftwareDraft((draft) => ({
                      ...draft,
                      adapterType: value as SoftwareAdapterType,
                    }))
                  }
                  options={softwareAdapters}
                />
              </div>
              <Select
                value={softwareDraft.defaultWorkstationMode}
                onChange={(value) =>
                  setSoftwareDraft((draft) => ({
                    ...draft,
                    defaultWorkstationMode: value as WorkstationMode,
                  }))
                }
                options={workstationModes}
              />
              <Input
                value={softwareDraft.launchCommand}
                onChange={(event) =>
                  setSoftwareDraft((draft) => ({ ...draft, launchCommand: event.target.value }))
                }
                placeholder="Launch command"
              />
              <Input
                value={softwareDraft.executablePath}
                onChange={(event) =>
                  setSoftwareDraft((draft) => ({ ...draft, executablePath: event.target.value }))
                }
                placeholder="Executable path"
              />
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitSoftware()}
                disabled={saving !== null || !softwareDraft.name.trim()}
              >
                {saving === 'software' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Create Software
              </Button>
            </Section>

            <Section title="Software Command" icon={<CheckCircle2 className="size-3.5" />}>
              <Select
                value={commandDraft.softwareProfileId}
                onChange={(value) =>
                  setCommandDraft((draft) => ({ ...draft, softwareProfileId: value }))
                }
                options={softwareProfiles.map((profile) => profile.id)}
                labels={Object.fromEntries(softwareProfiles.map((profile) => [profile.id, profile.name]))}
                emptyLabel="Select software"
              />
              <Input
                value={commandDraft.name}
                onChange={(event) =>
                  setCommandDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                placeholder="Command name"
              />
              <Textarea
                className="min-h-14 text-xs"
                value={commandDraft.description}
                onChange={(event) =>
                  setCommandDraft((draft) => ({ ...draft, description: event.target.value }))
                }
                placeholder="Description"
              />
              <Textarea
                className="min-h-20 text-xs"
                value={commandDraft.implementationText}
                onChange={(event) =>
                  setCommandDraft((draft) => ({
                    ...draft,
                    implementationText: event.target.value,
                  }))
                }
                placeholder="Implementation JSON"
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Select
                  value={commandDraft.riskLevel}
                  onChange={(value) =>
                    setCommandDraft((draft) => ({ ...draft, riskLevel: value as RiskLevel }))
                  }
                  options={riskLevels}
                />
                <Toggle
                  label="Approve"
                  checked={commandDraft.requiresApproval}
                  onChange={(checked) =>
                    setCommandDraft((draft) => ({ ...draft, requiresApproval: checked }))
                  }
                />
              </div>
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitSoftwareCommand()}
                disabled={
                  saving !== null || !commandDraft.softwareProfileId || !commandDraft.name.trim()
                }
              >
                {saving === 'command' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Create Command
              </Button>
            </Section>

            <Section title="Recorded Macro" icon={<Play className="size-3.5" />}>
              <Select
                value={macroDraft.softwareProfileId}
                onChange={(value) => setMacroDraft((draft) => ({ ...draft, softwareProfileId: value }))}
                options={softwareProfiles.map((profile) => profile.id)}
                labels={Object.fromEntries(softwareProfiles.map((profile) => [profile.id, profile.name]))}
                emptyLabel="Select software"
              />
              <Input
                value={macroDraft.name}
                onChange={(event) =>
                  setMacroDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                placeholder="Macro name"
              />
              <Textarea
                className="min-h-14 text-xs"
                value={macroDraft.description}
                onChange={(event) =>
                  setMacroDraft((draft) => ({ ...draft, description: event.target.value }))
                }
                placeholder="Description"
              />
              <Textarea
                className="min-h-20 text-xs"
                value={macroDraft.stepsText}
                onChange={(event) =>
                  setMacroDraft((draft) => ({ ...draft, stepsText: event.target.value }))
                }
                placeholder="Steps JSON"
              />
              <Textarea
                className="min-h-14 text-xs"
                value={macroDraft.parameterBindingsText}
                onChange={(event) =>
                  setMacroDraft((draft) => ({
                    ...draft,
                    parameterBindingsText: event.target.value,
                  }))
                }
                placeholder="Parameter bindings JSON"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={macroDraft.riskLevel}
                  onChange={(value) =>
                    setMacroDraft((draft) => ({ ...draft, riskLevel: value as RiskLevel }))
                  }
                  options={riskLevels}
                />
                <Select
                  value={macroDraft.status}
                  onChange={(value) =>
                    setMacroDraft((draft) => ({
                      ...draft,
                      status: value as RecordedMacroRow['status'],
                    }))
                  }
                  options={macroStatuses}
                />
              </div>
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitMacro()}
                disabled={saving !== null || !macroDraft.softwareProfileId || !macroDraft.name.trim()}
              >
                {saving === 'macro' ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Save Macro
              </Button>
            </Section>
          </div>
        </ScrollArea>

        <ScrollArea className="min-h-0">
          <div className="space-y-3 p-3">
            <Section title="SDK API Keys" icon={<KeyRound className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                {apiKeys.length === 0 ? (
                  <EmptyState label="No SDK API keys" />
                ) : (
                  apiKeys.map((key) => (
                    <EntityRow
                      key={key.id}
                      title={key.name}
                      subtitle={key.scopes.join(', ') || 'no scopes'}
                      badge={key.status}
                      meta={`${key.keyPrefix} / ${formatTime(key.createdAt)}`}
                      selected={false}
                      actions={
                        key.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1"
                            disabled={saving !== null}
                            onClick={() => void revokeApiKey(key)}
                          >
                            {saving === `api-key-revoke:${key.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Revoke
                          </Button>
                        ) : null
                      }
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="SDK Tasks" icon={<Play className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                {sdkTasks.length === 0 ? (
                  <EmptyState label="No SDK tasks" />
                ) : (
                  sdkTasks.map((task) => (
                    <EntityRow
                      key={task.id}
                      title={task.description}
                      subtitle={jsonPreview(task.input)}
                      badge={task.status}
                      meta={`${task.agentName} / priority ${task.priority} / ${formatTime(task.createdAt)}`}
                      selected={false}
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Webhooks" icon={<Plug className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                {webhookSubscriptions.length === 0 ? (
                  <EmptyState label="No webhook subscriptions" />
                ) : (
                  webhookSubscriptions.map((subscription) => (
                    <EntityRow
                      key={subscription.id}
                      title={subscription.name}
                      subtitle={subscription.url}
                      badge={subscription.status}
                      meta={`${subscription.events.join(', ')} / ${subscription.deliveryMode}`}
                      selected={false}
                      actions={
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          disabled={saving !== null}
                          onClick={() => void sendWebhookTest(subscription)}
                        >
                          {saving === `webhook-test:${subscription.id}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Play className="size-3" />
                          )}
                          Test
                        </Button>
                      }
                    />
                  ))
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {webhookDeliveries.length === 0 ? (
                  <EmptyState label="No webhook deliveries" />
                ) : (
                  webhookDeliveries.slice(0, 12).map((delivery) => (
                    <EntityRow
                      key={delivery.id}
                      title={delivery.eventType}
                      subtitle={delivery.url}
                      badge={delivery.status}
                      meta={`${delivery.signature.slice(0, 28)}... / ${formatTime(delivery.createdAt)}`}
                      selected={false}
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="CLI Profiles" icon={<Terminal className="size-3.5" />}>
              <Textarea
                className="min-h-16 text-xs"
                value={cliVariablesText}
                onChange={(event) => setCliVariablesText(event.target.value)}
                placeholder="Dry-run variables JSON"
              />
              <div className="grid grid-cols-2 gap-2">
                {cliProfiles.length === 0 ? (
                  <EmptyState label="No CLI profiles" />
                ) : (
                  cliProfiles.map((profile) => (
                    <EntityRow
                      key={profile.id}
                      title={profile.name}
                      subtitle={[profile.command, profile.argsTemplate].filter(Boolean).join(' ')}
                      badge={profile.healthStatus}
                      meta={`${profile.cwdPolicy} 路 ${profile.inputMode}/${profile.outputMode}`}
                      selected={false}
                      actions={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1"
                            disabled={saving !== null}
                            onClick={() =>
                              void withAction(`cli-test:${profile.id}`, async () => {
                                const result = await testCliProfile(profile.id)
                                return `CLI test ${result.status}`
                              })
                            }
                          >
                            {saving === `cli-test:${profile.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1"
                            disabled={saving !== null}
                            onClick={() => void runCliDryRun(profile)}
                          >
                            {saving === `cli-run:${profile.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Play className="size-3" />
                            )}
                            Dry-run
                          </Button>
                        </>
                      }
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="MCP Servers" icon={<Plug className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                {mcpServers.length === 0 ? (
                  <EmptyState label="No MCP servers" />
                ) : (
                  mcpServers.map((server) => (
                    <EntityRow
                      key={server.id}
                      title={server.displayName}
                      subtitle={server.endpoint ?? server.command ?? 'metadata only'}
                      badge={server.healthStatus}
                      meta={`${server.transport} 路 ${server.enabled ? 'enabled' : 'disabled'}`}
                      selected={server.id === selectedMcpServerId}
                      onSelect={() => setSelectedMcpServerId(server.id)}
                      actions={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1"
                            disabled={saving !== null}
                            onClick={() =>
                              void withAction(`mcp-test:${server.id}`, async () => {
                                const result = await testMcpServer(server.id)
                                return `MCP test ${result.status}`
                              })
                            }
                          >
                            {saving === `mcp-test:${server.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1"
                            disabled={saving !== null}
                            onClick={() => void discoverTools(server)}
                          >
                            {saving === `mcp-discover:${server.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3" />
                            )}
                            Discover
                          </Button>
                        </>
                      }
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="MCP Tools" icon={<Wrench className="size-3.5" />}>
              <Textarea
                className="min-h-16 text-xs"
                value={mcpInputText}
                onChange={(event) => setMcpInputText(event.target.value)}
                placeholder="MCP input JSON"
              />
              <div className="grid grid-cols-2 gap-2">
                {visibleMcpTools.length === 0 ? (
                  <EmptyState label={selectedMcpServer ? 'No tools discovered' : 'No MCP tools'} />
                ) : (
                  visibleMcpTools.map((tool) => (
                    <EntityRow
                      key={tool.id}
                      title={tool.displayName}
                      subtitle={tool.description || tool.toolName}
                      badge={tool.riskLevel}
                      meta={mcpServerById.get(tool.mcpServerId)?.displayName ?? tool.mcpServerId}
                      selected={false}
                      actions={
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          disabled={saving !== null}
                          onClick={() => void runToolDryRun(tool)}
                        >
                          {saving === `mcp-run:${tool.id}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Play className="size-3" />
                          )}
                          Dry-run
                        </Button>
                      }
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Tool Connections" icon={<Activity className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                {toolConnections.length === 0 ? (
                  <EmptyState label="No tool connections" />
                ) : (
                  toolConnections.map((tool) => (
                    <EntityRow
                      key={tool.id}
                      title={tool.displayName}
                      subtitle={jsonPreview(tool.config)}
                      badge={tool.healthStatus}
                      meta={`${tool.type} 路 ${tool.enabled ? 'enabled' : 'disabled'}`}
                      selected={false}
                      actions={
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          disabled={saving !== null}
                          onClick={() =>
                            void withAction(`tool-test:${tool.id}`, async () => {
                              const result = await testToolConnection(tool.id)
                              return `Tool connection test ${result.status}`
                            })
                          }
                        >
                          {saving === `tool-test:${tool.id}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3" />
                          )}
                          Test
                        </Button>
                      }
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Software Profiles" icon={<Package className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                {softwareProfiles.length === 0 ? (
                  <EmptyState label="No software profiles" />
                ) : (
                  softwareProfiles.map((profile) => (
                    <EntityRow
                      key={profile.id}
                      title={profile.name}
                      subtitle={profile.launchCommand ?? profile.executablePath ?? profile.id}
                      badge={profile.adapterType}
                      meta={`${profile.appType} 路 ${profile.defaultWorkstationMode}`}
                      selected={profile.id === selectedSoftwareProfileId}
                      onSelect={() => {
                        setSelectedSoftwareProfileId(profile.id)
                        setCommandDraft((draft) => ({ ...draft, softwareProfileId: profile.id }))
                        setMacroDraft((draft) => ({ ...draft, softwareProfileId: profile.id }))
                      }}
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Software Commands" icon={<CheckCircle2 className="size-3.5" />}>
              <Textarea
                className="min-h-16 text-xs"
                value={softwareInputText}
                onChange={(event) => setSoftwareInputText(event.target.value)}
                placeholder="Software command input JSON"
              />
              <div className="grid grid-cols-2 gap-2">
                {visibleSoftwareCommands.length === 0 ? (
                  <EmptyState label="No software commands" />
                ) : (
                  visibleSoftwareCommands.map((command) => (
                    <EntityRow
                      key={command.id}
                      title={command.name}
                      subtitle={command.description || jsonPreview(command.implementation)}
                      badge={command.healthStatus}
                      meta={`${softwareProfileById.get(command.softwareProfileId)?.name ?? command.softwareProfileId} 路 ${command.riskLevel}`}
                      selected={command.id === selectedSoftwareCommandId}
                      onSelect={() => setSelectedSoftwareCommandId(command.id)}
                      actions={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1"
                            disabled={saving !== null}
                            onClick={() =>
                              void withAction(`command-test:${command.id}`, async () => {
                                const result = await testSoftwareCommand(command.id)
                                return `Software command test ${result.status}`
                              })
                            }
                          >
                            {saving === `command-test:${command.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1"
                            disabled={saving !== null}
                            onClick={() => void runCommandDryRun(command)}
                          >
                            {saving === `command-run:${command.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Play className="size-3" />
                            )}
                            Dry-run
                          </Button>
                        </>
                      }
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Recorded Macros" icon={<Play className="size-3.5" />}>
              <Textarea
                className="min-h-16 text-xs"
                value={macroInputText}
                onChange={(event) => setMacroInputText(event.target.value)}
                placeholder="Macro input JSON"
              />
              <div className="grid grid-cols-2 gap-2">
                {visibleMacros.length === 0 ? (
                  <EmptyState label="No recorded macros" />
                ) : (
                  visibleMacros.map((macro) => (
                    <EntityRow
                      key={macro.id}
                      title={macro.name}
                      subtitle={macro.description || `${macro.steps.length} steps`}
                      badge={macro.status}
                      meta={`${softwareProfileById.get(macro.softwareProfileId)?.name ?? macro.softwareProfileId} 路 ${macro.riskLevel}`}
                      selected={macro.id === selectedMacroId}
                      onSelect={() => setSelectedMacroId(macro.id)}
                      actions={
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          disabled={saving !== null}
                          onClick={() => void replayMacroDryRun(macro)}
                        >
                          {saving === `macro-run:${macro.id}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Play className="size-3" />
                          )}
                          Dry-run
                        </Button>
                      }
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Tool Invocation Protocol" icon={<Wrench className="size-3.5" />}>
              <div className="grid grid-cols-3 gap-2">
                <RuntimeList
                  title="Manifests"
                  rows={toolProtocolManifests.slice(0, 6).map((manifest) => ({
                    id: manifest.id,
                    title: manifest.name,
                    subtitle: manifest.description,
                    badge: manifest.riskLevel,
                    meta: `${manifest.source} / read ${manifest.readOnly ? 'yes' : 'no'} / approval ${
                      manifest.requiresApproval ? 'yes' : 'no'
                    }`,
                  }))}
                />
                <RuntimeList
                  title="Invocations"
                  rows={toolProtocolInvocations.slice(0, 6).map((invocation) => ({
                    id: invocation.id,
                    title: invocation.callId,
                    subtitle: invocation.toolName,
                    badge: invocation.status,
                    meta: invocation.idempotencyKey ?? formatTime(invocation.createdAt),
                  }))}
                />
                <RuntimeList
                  title="Results"
                  rows={toolProtocolResults.slice(0, 6).map((result) => ({
                    id: result.id,
                    title: result.callId,
                    subtitle: jsonPreview(result.data ?? result.error ?? {}),
                    badge: result.success ? 'success' : 'failed',
                    meta: formatTime(result.createdAt),
                  }))}
                />
              </div>
            </Section>

            <Section title="Recent Runs" icon={<Activity className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                <RuntimeList
                  title="CLI runs"
                  rows={cliRuns.slice(0, 6).map((run) => ({
                    id: run.id,
                    title: run.command,
                    subtitle: run.error ?? (run.renderedArgs || 'dry-run rendered'),
                    badge: run.status,
                    meta: formatTime(run.createdAt),
                  }))}
                />
                <RuntimeList
                  title="MCP calls"
                  rows={mcpCalls.slice(0, 6).map((call) => ({
                    id: call.id,
                    title: call.mode,
                    subtitle: call.error ?? jsonPreview(call.output ?? call.input),
                    badge: call.status,
                    meta: formatTime(call.createdAt),
                  }))}
                />
                <RuntimeList
                  title="Software runs"
                  rows={softwareRuns.slice(0, 6).map((run) => ({
                    id: run.id,
                    title: run.implementationType,
                    subtitle: run.error ?? jsonPreview(run.output ?? run.input),
                    badge: run.status,
                    meta: formatTime(run.createdAt),
                  }))}
                />
                <RuntimeList
                  title="Macro replays"
                  rows={macroRuns.slice(0, 6).map((run) => ({
                    id: run.id,
                    title: run.mode,
                    subtitle: run.error ?? jsonPreview(run.output ?? run.input),
                    badge: run.status,
                    meta: formatTime(run.createdAt),
                  }))}
                />
              </div>
            </Section>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function SoftwareStoreStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function SoftwareStoreMiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function SoftwareAccessAssistant({
  selectedItem,
  connectedSoftwareCount,
  totalModeCount,
  commandCount,
  activeCategory,
  onQuickCategory,
  onOpenMode,
  onOpenAdvanced,
}: {
  selectedItem: SoftwareStoreItem | null
  connectedSoftwareCount: number
  totalModeCount: number
  commandCount: number
  activeCategory: SoftwareStoreCategory
  onQuickCategory: (category: SoftwareStoreCategory) => void
  onOpenMode: (mode: StoreDetailMode) => void
  onOpenAdvanced: () => void
}) {
  const recommended = selectedItem ? getSoftwareStoreRecommendedMode(selectedItem) : null
  const fit = selectedItem ? inferSoftwareAgentFit(selectedItem) : null
  const quickCategories: Array<{ category: SoftwareStoreCategory; label: string; detail: string }> = [
    { category: '开发工具', label: '代码和仓库', detail: 'Codex、Claude Code、GitHub' },
    { category: '办公协作', label: '沟通协作', detail: '微信、飞书、Notion' },
    { category: '浏览器网页', label: '浏览器网页', detail: 'Chrome、SkillsMP、网页工具' },
    { category: '视频创作', label: '视频剪辑', detail: '剪映、CapCut、素材处理' },
  ]

  return (
    <section
      data-testid="software-access-assistant"
      className="rounded-lg border bg-background p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-primary" />
            <h3 className="text-base font-semibold">软件接入助手</h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            先选软件，再看它有没有 CLI、MCP 或封装命令。接入后，直接在智能体设置里勾选使用。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <SoftwareStoreMiniStat label="已接入" value={connectedSoftwareCount} />
          <SoftwareStoreMiniStat label="CLI/MCP" value={totalModeCount} />
          <SoftwareStoreMiniStat label="命令" value={commandCount} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">一键找软件</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {quickCategories.map((item) => (
                <button
                  key={item.category}
                  type="button"
                  className={cn(
                    'rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-primary/5',
                    activeCategory === item.category ? 'border-primary bg-primary/5' : 'bg-muted/10',
                  )}
                  onClick={() => onQuickCategory(item.category)}
                >
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            {softwareUseSteps.map((step, index) => (
              <div key={step.title} className="rounded-lg border bg-muted/10 px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {index + 1}
                  </span>
                  {step.title}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{step.detail}</div>
              </div>
            ))}
            <div className="rounded-lg border bg-muted/10 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  4
                </span>
                上线使用
              </div>
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                智能体运行时会自动调用对应 CLI、MCP 或软件命令。
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="text-xs font-semibold text-muted-foreground">当前软件</div>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {selectedItem ? renderSoftwareStoreIcon(selectedItem.icon, 'size-4') : <Package className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{selectedItem?.name ?? '先选择一个软件'}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {selectedItem?.description ?? '点击下面的软件卡片后，这里会显示它的 CLI、MCP、命令和适合哪类智能体。'}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <SoftwareAssignmentRow label="推荐接入方式" value={recommended?.label ?? '先选择软件'} />
            <SoftwareAssignmentRow label="适合智能体" value={fit?.role ?? '选择软件后自动判断'} />
            <SoftwareAssignmentRow label="下一步" value={recommended?.action ?? '从软件列表里选择一个要接入的工具'} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={!selectedItem}
              onClick={() => {
                if (recommended) onOpenMode(recommended.mode)
              }}
            >
              <Terminal className="size-4" />
              查看 CLI 或 MCP
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={onOpenAdvanced}>
              <Settings2 className="size-4" />
              进入高级配置
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function SoftwareStoreUsePath({ selectedItem }: { selectedItem: SoftwareStoreItem | null }) {
  const canAssign = selectedItem ? getStoreModeCount(selectedItem) > 0 || selectedItem.softwareCommands.length > 0 : false
  return (
    <section
      data-testid="software-store-use-path"
      className="rounded-lg border bg-background p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">软件怎么变成智能体能力</div>
          <div className="mt-1 text-xs text-muted-foreground">
            当前选中：{selectedItem?.name ?? '先选择一个软件'} · {canAssign ? '已可分配' : '需要先接入'}
          </div>
        </div>
        <Badge variant={canAssign ? 'default' : 'outline'}>{canAssign ? '可分配' : '待接入'}</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {softwareUseSteps.map((step, index) => (
          <div key={step.title} className="rounded-md border bg-muted/10 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {index + 1}
              </span>
              <span>{step.title}</span>
            </div>
            <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{step.detail}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SoftwareStoreCard({
  item,
  selected,
  onSelect,
  onOpenMode,
}: {
  item: SoftwareStoreItem
  selected: boolean
  onSelect: () => void
  onOpenMode: (mode: Exclude<StoreDetailMode, 'overview'>) => void
}) {
  const modeCount = getStoreModeCount(item)
  return (
    <article
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
      data-selected={selected ? 'true' : 'false'}
      data-testid={`software-store-card-${item.key}`}
      className={cn(
        'group min-h-40 cursor-pointer rounded-lg border bg-background p-4 text-left shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40',
        selected && 'border-primary bg-primary/5 shadow-md',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {renderSoftwareStoreIcon(item.icon, 'size-5')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{item.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.category}</div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={modeCount > 0 ? 'default' : 'outline'}>{getStoreModeLabel(item)}</Badge>
        {item.softwareCommands.length > 0 && (
          <Badge variant="outline">{item.softwareCommands.length} 个命令</Badge>
        )}
        {item.mcpTools.length > 0 && <Badge variant="outline">{item.mcpTools.length} 个工具</Badge>}
      </div>
      <div className="mt-3">
        <div className="mb-2 text-[11px] font-medium text-muted-foreground">接入方式</div>
        <div className="flex flex-wrap gap-2">
          {item.cliProfiles.length > 0 && (
            <StoreCardModeButton
              label="CLI"
              count={item.cliProfiles.length}
              testId={`software-store-card-${item.key}-cli`}
              onClick={(event) => {
                event.stopPropagation()
                onOpenMode('cli')
              }}
            />
          )}
          {item.mcpServers.length > 0 && (
            <StoreCardModeButton
              label="MCP"
              count={item.mcpServers.length}
              testId={`software-store-card-${item.key}-mcp`}
              onClick={(event) => {
                event.stopPropagation()
                onOpenMode('mcp')
              }}
            />
          )}
          {item.softwareCommands.length > 0 && (
            <StoreCardModeButton
              label="命令"
              count={item.softwareCommands.length}
              testId={`software-store-card-${item.key}-commands`}
              onClick={(event) => {
                event.stopPropagation()
                onOpenMode('commands')
              }}
            />
          )}
          {modeCount === 0 && item.softwareCommands.length === 0 && (
            <span className="rounded-md border border-dashed bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
              未接入，点击查看
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function StoreCardModeButton({
  label,
  count,
  onClick,
  testId,
}: {
  label: string
  count: number
  onClick: MouseEventHandler<HTMLButtonElement>
  testId: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="flex h-8 items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-xs text-primary transition hover:bg-primary/15"
      onClick={onClick}
      title={`查看 ${label} 接入`}
    >
      <span>{label}</span>
      <span className="font-mono">{count}</span>
    </button>
  )
}

function SoftwareStoreDetailHero({
  item,
  selectedMode,
  onModeChange,
  onAssignToAgent,
  onCreateAccess,
}: {
  item: SoftwareStoreItem
  selectedMode: StoreDetailMode
  onModeChange: (mode: StoreDetailMode) => void
  onAssignToAgent: () => void
  onCreateAccess: () => void
}) {
  const recommended = getSoftwareStoreRecommendedMode(item)
  const fit = inferSoftwareAgentFit(item)
  const canAssign = getStoreModeCount(item) > 0 || item.softwareCommands.length > 0
  const activeMode = selectedMode === 'overview' ? recommended.mode : selectedMode
  const modeEntries: Array<{
    mode: Exclude<StoreDetailMode, 'overview'>
    label: string
    count: number
    detail: string
    icon: ReactNode
  }> = [
    {
      mode: 'cli',
      label: 'CLI',
      count: item.cliProfiles.length,
      detail: '终端、脚本、本地命令',
      icon: <Terminal className="size-4" />,
    },
    {
      mode: 'mcp',
      label: 'MCP',
      count: item.mcpServers.length,
      detail: '结构化工具和参数',
      icon: <Plug className="size-4" />,
    },
    {
      mode: 'commands',
      label: '命令',
      count: item.softwareCommands.length,
      detail: '封装好的动作',
      icon: <Cpu className="size-4" />,
    },
  ]

  return (
    <section
      data-testid="software-store-detail-hero"
      className="mt-4 overflow-hidden rounded-lg border bg-gradient-to-b from-primary/5 to-background"
    >
      <div className="border-b bg-background/70 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Package className="size-4 text-primary" />
            软件名片
          </div>
          <Badge variant={canAssign ? 'default' : 'outline'}>
            {canAssign ? '可分配给智能体' : '需要先接入'}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <div className="text-sm font-semibold">软件介绍</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {getSoftwareStoreIntro(item)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {getSoftwareStoreCapabilities(item).map((capability) => (
              <span
                key={capability}
                className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>

        <div data-testid="software-store-connection-overview">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">接入总览</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {modeEntries.map((entry) => {
              const active = activeMode === entry.mode
              return (
                <button
                  key={entry.mode}
                  type="button"
                  className={cn(
                    'rounded-lg border bg-background px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5',
                    active && 'border-primary bg-primary/5 ring-2 ring-primary/10',
                  )}
                  onClick={() => onModeChange(entry.mode)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="text-primary">{entry.icon}</span>
                      {entry.label}
                    </span>
                    <span className="font-mono text-sm font-semibold">{entry.count}</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{entry.detail}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div
          data-testid="software-store-assignment-path"
          className="rounded-lg border bg-background px-3 py-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-muted-foreground">分配路径</div>
              <div className="mt-1 text-sm font-semibold">推荐给：{fit.role}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {recommended.reason} {recommended.action}
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 gap-2"
              variant={canAssign ? 'default' : 'outline'}
              onClick={canAssign ? onAssignToAgent : onCreateAccess}
            >
              {canAssign ? <Bot className="size-4" /> : <Settings2 className="size-4" />}
              {canAssign ? '去分配给智能体' : '创建接入'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function SoftwareStoreUseGuide({ item }: { item: SoftwareStoreItem }) {
  const hasCli = item.cliProfiles.length > 0
  const hasMcp = item.mcpServers.length > 0
  const hasCommands = item.softwareCommands.length > 0
  const canAssign = hasCli || hasMcp || hasCommands

  return (
    <section
      data-testid="software-store-use-guide"
      className="mt-4 rounded-lg border bg-muted/10 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">软件详情</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            这里把一个软件拆成智能体能理解的能力：CLI 负责命令行执行，MCP 负责结构化工具调用，封装命令负责把复杂操作变成一个可选择动作。
          </p>
        </div>
        <Badge variant={canAssign ? 'default' : 'outline'}>
          {canAssign ? '可分配给智能体' : '等待接入'}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2">
        <SoftwareUseGuideRow
          icon={<Terminal className="size-4" />}
          title="CLI 模式"
          value={hasCli ? `${item.cliProfiles.length} 个 CLI` : '未接入'}
          detail={hasCli ? '适合 Codex CLI、Claude Code、本地脚本和桌面软件命令。' : '创建 CLI 后，智能体可以像调用命令一样使用这个软件。'}
        />
        <SoftwareUseGuideRow
          icon={<Plug className="size-4" />}
          title="MCP 模式"
          value={hasMcp ? `${item.mcpServers.length} 个 MCP` : '未接入'}
          detail={hasMcp ? '适合文件、数据库、浏览器、GitHub 等稳定工具连接。' : '注册 MCP 后，智能体可以看到结构化工具和参数。'}
        />
        <SoftwareUseGuideRow
          icon={<Cpu className="size-4" />}
          title="封装命令"
          value={hasCommands ? `${item.softwareCommands.length} 个命令` : '暂无命令'}
          detail={hasCommands ? '复杂操作已经包装成智能体可直接选择的动作。' : '后续可以把软件操作录制或封装成可复用命令。'}
        />
      </div>
    </section>
  )
}

function SoftwareStoreAccessMatrix({
  item,
  selectedMode,
  onModeChange,
}: {
  item: SoftwareStoreItem
  selectedMode: StoreDetailMode
  onModeChange: (mode: StoreDetailMode) => void
}) {
  const modes: Array<{
    mode: Exclude<StoreDetailMode, 'overview'>
    title: string
    count: number
    icon: ReactNode
    detail: string
  }> = [
    {
      mode: 'cli',
      title: 'CLI 接入',
      count: item.cliProfiles.length,
      icon: <Terminal className="size-4" />,
      detail: '让智能体通过终端、脚本或本地命令调用这个软件。',
    },
    {
      mode: 'mcp',
      title: 'MCP 接入',
      count: item.mcpServers.length,
      icon: <Plug className="size-4" />,
      detail: '把外部工具包装成结构化能力，智能体能看到参数和返回结果。',
    },
    {
      mode: 'commands',
      title: '可用命令',
      count: item.softwareCommands.length,
      icon: <Cpu className="size-4" />,
      detail: '把复杂操作封装成一个动作，例如导出、检查、生成或处理。',
    },
  ]

  const activeMode = selectedMode === 'overview' ? 'cli' : selectedMode

  return (
    <section
      data-testid="software-store-access-matrix"
      className="mt-4 rounded-lg border bg-background p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">能力接入面板</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            点击下面的 CLI、MCP 或命令，就能看到这个软件对应的接入详情和检测入口。
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          当前选择：{modeTitle(activeMode)}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2">
        {modes.map((entry) => {
          const active = activeMode === entry.mode
          const ready = entry.count > 0
          return (
            <button
              key={entry.mode}
              type="button"
              data-testid={`software-store-access-${entry.mode}`}
              className={cn(
                'grid gap-3 rounded-lg border p-3 text-left transition sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center',
                active
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                  : 'bg-muted/10 hover:border-primary/50 hover:bg-primary/5',
              )}
              onClick={() => onModeChange(entry.mode)}
            >
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                {entry.icon}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {entry.title}
                  <Badge variant={ready ? 'default' : 'outline'}>{ready ? '已接入' : '待接入'}</Badge>
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{entry.detail}</span>
              </span>
              <span className="flex shrink-0 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs sm:min-w-24">
                <span className="text-muted-foreground">数量</span>
                <span className="font-mono text-sm font-semibold">{entry.count}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SoftwareStoreAssignmentPlan({ item }: { item: SoftwareStoreItem }) {
  const fit = inferSoftwareAgentFit(item)
  const canAssign = getStoreModeCount(item) > 0 || item.softwareCommands.length > 0
  return (
    <section
      data-testid="software-store-assignment-plan"
      className="mt-4 rounded-lg border bg-primary/5 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">分配建议</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            系统按软件类型判断这个能力更适合交给哪类智能体，用户不需要理解底层适配器。
          </p>
        </div>
        <Badge variant={canAssign ? 'default' : 'outline'}>{canAssign ? '可加入工具包' : '先接入'}</Badge>
      </div>
      <div className="mt-3 grid gap-2">
        <SoftwareAssignmentRow label="适合智能体" value={fit.role} />
        <SoftwareAssignmentRow label="能做什么" value={fit.action} />
        <SoftwareAssignmentRow label="接入路线" value={fit.route} />
      </div>
    </section>
  )
}

function SoftwareAssignmentRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-background px-3 py-2 sm:grid-cols-[5rem_minmax(0,1fr)]">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-xs leading-5 text-foreground">{value}</div>
    </div>
  )
}

function SoftwareUseGuideRow({
  icon,
  title,
  value,
  detail,
}: {
  icon: ReactNode
  title: string
  value: string
  detail: string
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-background px-3 py-2 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <div className="min-w-0 text-xs text-muted-foreground">{detail}</div>
      <div className="w-fit rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{value}</div>
    </div>
  )
}

function StoreAgentUsePanel({
  item,
  onOpenCli,
  onOpenMcp,
  onAssignToAgent,
  onCreateCli,
  onCreateMcp,
  onCreateSoftware,
}: {
  item: SoftwareStoreItem
  onOpenCli: () => void
  onOpenMcp: () => void
  onAssignToAgent: () => void
  onCreateCli: () => void
  onCreateMcp: () => void
  onCreateSoftware: () => void
}) {
  const hasCli = item.cliProfiles.length > 0
  const hasMcp = item.mcpServers.length > 0
  const hasSoftwareProfile = item.softwareProfiles.length > 0

  return (
    <section className="mt-4 rounded-lg border bg-background p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">给智能体使用</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{getSoftwareStoreAgentUseCopy(item)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button
          data-testid="assign-software-to-agent"
          className="justify-start gap-2 sm:col-span-2"
          onClick={onAssignToAgent}
        >
          <Bot className="size-4" />
          打开智能体设置并分配
        </Button>
        <Button variant={hasCli ? 'default' : 'outline'} className="justify-start gap-2" onClick={hasCli ? onOpenCli : onCreateCli}>
          <Terminal className="size-4" />
          {hasCli ? `查看 CLI（${item.cliProfiles.length}）` : '创建 CLI 接入'}
        </Button>
        <Button variant={hasMcp ? 'default' : 'outline'} className="justify-start gap-2" onClick={hasMcp ? onOpenMcp : onCreateMcp}>
          <Plug className="size-4" />
          {hasMcp ? `查看 MCP（${item.mcpServers.length}）` : '注册 MCP 接入'}
        </Button>
      </div>
      <Button
        variant="ghost"
        className="mt-2 h-8 w-full justify-start gap-2 text-muted-foreground"
        onClick={onCreateSoftware}
      >
        <Package className="size-4" />
        {hasSoftwareProfile ? '查看软件配置和封装命令' : '创建软件配置，后续可继续封装命令'}
      </Button>
    </section>
  )
}

function StoreDetailModeButton({
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
      className={cn(
        'h-8 rounded-md text-xs font-medium transition',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/70',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function SoftwareStoreModeSummary({
  item,
  mode,
}: {
  item: SoftwareStoreItem
  mode: StoreDetailMode
}) {
  const meta = softwareStoreModeSummary(item, mode)
  return (
    <section
      data-testid="software-store-mode-summary"
      className="mt-3 rounded-lg border bg-primary/5 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{meta.title}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{meta.description}</p>
        </div>
        <Badge variant={meta.ready ? 'default' : 'outline'} className="shrink-0">
          {meta.badge}
        </Badge>
      </div>
    </section>
  )
}

function softwareStoreModeSummary(
  item: SoftwareStoreItem,
  mode: StoreDetailMode,
): { title: string; description: string; badge: string; ready: boolean } {
  if (mode === 'cli') {
    const count = item.cliProfiles.length
    return {
      title: `${item.name} 的 CLI 接入`,
      description:
        count > 0
          ? `已经有 ${count} 个 CLI。智能体可以通过终端命令、本地脚本或软件命令调用这个软件，适合代码、文件处理和本地交付类任务。`
          : '还没有 CLI。创建 CLI 接入后，智能体就能像调用命令一样使用这个软件。',
      badge: count > 0 ? `${count} 个 CLI` : '待接入',
      ready: count > 0,
    }
  }
  if (mode === 'mcp') {
    const count = item.mcpServers.length
    return {
      title: `${item.name} 的 MCP 接入`,
      description:
        count > 0
          ? `已经有 ${count} 个 MCP 服务。智能体可以看到结构化工具、参数和返回结果，适合稳定的外部能力调用。`
          : '还没有 MCP。注册 MCP 后，用户不需要理解底层协议，智能体会把它当作工具连接使用。',
      badge: count > 0 ? `${count} 个 MCP` : '待接入',
      ready: count > 0,
    }
  }
  if (mode === 'commands') {
    const count = item.softwareCommands.length
    return {
      title: `${item.name} 的可用命令`,
      description:
        count > 0
          ? `已经封装了 ${count} 个可直接调用的动作。复杂的软件操作可以继续录制或封装成命令，让智能体按需选择。`
          : '还没有封装命令。后续可以把常用操作封装成一个动作，例如导出、生成报告、打开项目或处理素材。',
      badge: count > 0 ? `${count} 个命令` : '待封装',
      ready: count > 0,
    }
  }
  const ready = getStoreModeCount(item) > 0 || item.softwareCommands.length > 0
  return {
    title: `${item.name} 的接入概览`,
    description:
      '这里按软件聚合它已有的 CLI、MCP 和封装命令。用户只需要先选软件，再决定把哪种能力分配给智能体。',
    badge: ready ? '可分配' : '待接入',
    ready,
  }
}

function modeTitle(mode: Exclude<StoreDetailMode, 'overview'>): string {
  if (mode === 'cli') return 'CLI 接入'
  if (mode === 'mcp') return 'MCP 接入'
  return '可用命令'
}

function StoreModeSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: ReactNode
  count: number
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border bg-muted/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function StoreConnectionRow({
  title,
  subtitle,
  badge,
  meta,
  detail,
  actions,
}: {
  title: string
  subtitle: string
  badge: string
  meta?: string
  detail?: string
  actions?: ReactNode
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtitle || '已配置'}</div>
        </div>
        <StatusBadge value={badge} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-xs text-muted-foreground">{meta ?? ' '}</div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {detail && <div className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{detail}</div>}
    </div>
  )
}

function StoreEmptyMode({
  label,
  actionLabel,
  icon,
  onAction,
}: {
  label: string
  actionLabel: string
  icon: ReactNode
  onAction: () => void
}) {
  return (
    <div className="rounded-lg border border-dashed bg-background px-3 py-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">
        需要时可以直接创建接入，创建后智能体就能在能力配置里选择它。
      </div>
      <Button className="mt-3 h-8 gap-1" variant="outline" onClick={onAction}>
        {icon}
        {actionLabel}
      </Button>
    </div>
  )
}

function renderSoftwareStoreIcon(icon: SoftwareStoreIcon, className: string): ReactNode {
  if (icon === 'code') return <Code2 className={className} />
  if (icon === 'chat') return <MessageCircle className={className} />
  if (icon === 'video') return <Video className={className} />
  if (icon === 'browser') return <Globe2 className={className} />
  if (icon === 'data') return <Database className={className} />
  if (icon === 'file') return <FileText className={className} />
  if (icon === 'automation') return <Blocks className={className} />
  return <Wrench className={className} />
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border bg-background/60 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background px-1.5 py-1">
      <div className="truncate uppercase">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function EntityRow({
  title,
  subtitle,
  badge,
  meta,
  selected,
  onSelect,
  actions,
}: {
  title: string
  subtitle: string
  badge: string
  meta: string
  selected: boolean
  onSelect?: () => void
  actions?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-background p-2 text-xs',
        selected && 'border-foreground/40 bg-accent/40',
        onSelect && 'cursor-pointer transition hover:bg-accent/50',
      )}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onSelect) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <StatusBadge value={badge} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[10px] text-muted-foreground">{meta}</div>
        {actions && (
          <div
            className="flex shrink-0 items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

function RuntimeList({
  title,
  rows,
}: {
  title: string
  rows: Array<{ id: string; title: string; subtitle: string; badge: string; meta: string }>
}) {
  return (
    <div className="rounded-lg border bg-background p-2">
      <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="space-y-1.5">
        {rows.length === 0 ? (
          <EmptyState label={`No ${title.toLowerCase()}`} />
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{row.title}</span>
                <StatusBadge value={row.badge} />
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                {row.subtitle}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{row.meta}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
      {label}
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === 'ok' ||
    value === 'planned' ||
    value === 'low' ||
    value === 'active' ||
    value === 'completed' ||
    value === 'recorded' ||
    value === 'delivered'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : value === 'failed' ||
          value === 'blocked' ||
          value === 'high' ||
          value === 'archived' ||
          value === 'revoked' ||
          value === 'disabled'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return (
    <Badge variant="outline" className={cn('h-5 shrink-0 px-1.5 text-[10px]', tone)}>
      {value}
    </Badge>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-8 items-center justify-center rounded-lg border px-2 text-[11px] transition',
        checked ? 'border-foreground/30 bg-accent text-foreground' : 'bg-background text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}

function Select({
  value,
  onChange,
  options,
  labels,
  emptyLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  labels?: Record<string, string>
  emptyLabel?: string
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
    >
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">{children}</div>
}

function parseJsonValue(text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`${label} must be valid JSON: ${formatError(err)}`)
  }
}

function parseJsonObject(text: string, label: string): JsonObject {
  const value = parseJsonValue(text || '{}', label)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as JsonObject
}

function parseJsonArray(text: string, label: string): JsonObject[] {
  const value = parseJsonValue(text || '[]', label)
  if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array.`)
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${label} must contain JSON objects.`)
    }
  }
  return value as JsonObject[]
}

function parsePrimitiveRecord(
  text: string,
  label: string,
): Record<string, string | number | boolean | null> {
  const value = parseJsonObject(text, label)
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean' ||
      item === null
    ) {
      result[key] = item
      continue
    }
    throw new Error(`${label}.${key} must be a string, number, boolean, or null.`)
  }
  return result
}

function parsePositiveInt(value: string, fallback: number): number {
  const next = Number.parseInt(value, 10)
  return Number.isFinite(next) && next > 0 ? next : fallback
}

function parseInteger(value: string, fallback: number): number {
  const next = Number.parseInt(value, 10)
  return Number.isFinite(next) ? next : fallback
}

function parseOptionalInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const next = Number.parseInt(trimmed, 10)
  return Number.isFinite(next) ? next : null
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseWebhookEvents(value: string): WebhookEventType[] {
  const allowed = new Set<WebhookEventType>([
    'run.created',
    'run.queued',
    'run.completed',
    'run.failed',
    'run.event',
    'webhook.test',
  ])
  const events = parseCsv(value).filter((item): item is WebhookEventType =>
    allowed.has(item as WebhookEventType),
  )
  if (events.length === 0) throw new Error('Webhook events must contain at least one supported event.')
  return events
}

function jsonPreview(value: unknown): string {
  const text =
    typeof value === 'string'
      ? value
      : (() => {
          try {
            return JSON.stringify(value)
          } catch {
            return String(value)
          }
        })()
  return text.length > 140 ? `${text.slice(0, 140)}...` : text
}

function formatTime(value: number | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

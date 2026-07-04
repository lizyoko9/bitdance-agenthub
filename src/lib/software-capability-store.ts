import type {
  AgentProfileRow,
  CliProfileRow,
  McpServerRow,
  McpToolDefinitionRow,
  SoftwareCommandRow,
  SoftwareProfileRow,
} from '@/db/schema'

export type StoreSoftwareCategory =
  | '开发工具'
  | '办公协作'
  | '浏览器网页'
  | '视频创作'
  | '数据文件'
  | '自动化脚本'
  | '其他软件'

export type StoreCapabilityModeKind = 'CLI' | 'MCP' | 'API' | '浏览器' | '桌面' | '命令'
export type StoreConnectionStatus = '未接入' | '已接入' | '需检查' | '异常'

export interface StoreCapabilityMode {
  id: string
  kind: StoreCapabilityModeKind
  label: string
  status: StoreConnectionStatus
  riskLevel?: string
  requiresApproval?: boolean
  sourceId?: string
}

export interface SoftwareCapabilityCard {
  key: string
  softwareProfileId?: string
  name: string
  description: string
  category: StoreSoftwareCategory
  connectionStatus: StoreConnectionStatus
  defaultMode: StoreCapabilityModeKind | '未设置'
  modes: StoreCapabilityMode[]
  commandCount: number
  assignedAgentCount: number
  lastTestResult?: string | null
}

export interface SoftwareCapabilityStoreState {
  cards: SoftwareCapabilityCard[]
  metrics: {
    connectedSoftware: number
    totalModes: number
    totalCommands: number
    assignableAgents: number
  }
  freeNotice: string
}

export interface BuildSoftwareCapabilityStoreInput {
  softwareProfiles: SoftwareProfileRow[]
  softwareCommands: SoftwareCommandRow[]
  cliProfiles: CliProfileRow[]
  mcpServers: McpServerRow[]
  mcpTools: McpToolDefinitionRow[]
  agents: AgentProfileRow[]
}

interface CatalogItem {
  key: string
  name: string
  description: string
  category: StoreSoftwareCategory
  aliases: string[]
}

const BUILT_IN_CATALOG: CatalogItem[] = [
  {
    key: 'codex',
    name: 'Codex CLI',
    description: '代码修改、仓库检查、命令行交付',
    category: '开发工具',
    aliases: ['codex'],
  },
  {
    key: 'claude-code',
    name: 'Claude Code',
    description: '代码任务、仓库理解、工程协作',
    category: '开发工具',
    aliases: ['claude'],
  },
  {
    key: 'opencode',
    name: 'OpenCode',
    description: '开放式代码 Agent 与本地脚本',
    category: '开发工具',
    aliases: ['opencode'],
  },
  {
    key: 'github',
    name: 'GitHub',
    description: '仓库、Issue、PR 与发布流程',
    category: '开发工具',
    aliases: ['github'],
  },
  {
    key: 'wechat',
    name: '微信',
    description: '联系人、群聊、消息草稿与客户沟通',
    category: '办公协作',
    aliases: ['wechat', 'weixin', '微信'],
  },
  {
    key: 'feishu',
    name: '飞书',
    description: '文档、表格、审批与团队通知',
    category: '办公协作',
    aliases: ['feishu', 'lark', '飞书'],
  },
  {
    key: 'notion',
    name: 'Notion',
    description: '知识库、项目文档与数据库',
    category: '办公协作',
    aliases: ['notion'],
  },
  {
    key: 'chrome',
    name: 'Chrome',
    description: '网页浏览、登录态页面与浏览器自动化',
    category: '浏览器网页',
    aliases: ['chrome', 'browser'],
  },
  {
    key: 'skillsmap',
    name: 'SkillsMap',
    description: '技能包安装、发布与管理',
    category: '浏览器网页',
    aliases: ['skillsmap', 'skillsmp'],
  },
  {
    key: 'jianying',
    name: '剪映 / CapCut',
    description: '素材处理、剪辑项目与导出检查',
    category: '视频创作',
    aliases: ['jianying', 'capcut', '剪映'],
  },
]

export function getFreeProductNotice(): string {
  return 'AgentHub 本体永久免费；模型、API 或第三方 CLI 的费用只来自用户自己的服务商。'
}

export function buildSoftwareCapabilityStore(
  input: BuildSoftwareCapabilityStoreInput,
): SoftwareCapabilityStoreState {
  const commandsBySoftware = new Map<string, SoftwareCommandRow[]>()
  for (const command of input.softwareCommands) {
    const list = commandsBySoftware.get(command.softwareProfileId) ?? []
    list.push(command)
    commandsBySoftware.set(command.softwareProfileId, list)
  }

  const cards = new Map<string, SoftwareCapabilityCard>()
  for (const item of BUILT_IN_CATALOG) {
    cards.set(item.key, {
      key: `catalog:${item.key}`,
      name: item.name,
      description: item.description,
      category: item.category,
      connectionStatus: '未接入',
      defaultMode: '未设置',
      modes: [],
      commandCount: 0,
      assignedAgentCount: 0,
      lastTestResult: null,
    })
  }

  for (const profile of input.softwareProfiles) {
    const catalog = findCatalogForName(profile.name)
    const commands = commandsBySoftware.get(profile.id) ?? []
    const modes = modesForProfile(profile, commands)
    const key = catalog?.key ?? `profile:${profile.id}`
    cards.set(key, {
      key: `software:${profile.id}`,
      softwareProfileId: profile.id,
      name: profile.name,
      description: catalog?.description ?? softwareDescription(profile),
      category: catalog?.category ?? categoryForProfile(profile),
      connectionStatus: connectionStatusForProfile(profile, commands),
      defaultMode: modes[0]?.kind ?? '未设置',
      modes,
      commandCount: commands.length,
      assignedAgentCount: input.agents.filter((agent) => agent.softwareProfileIds.includes(profile.id)).length,
      lastTestResult: commands.find((command) => command.lastTestResult)?.lastTestResult ?? null,
    })
  }

  const cardList = [...cards.values()].sort((a, b) => {
    const connectedDelta = Number(b.connectionStatus === '已接入') - Number(a.connectionStatus === '已接入')
    if (connectedDelta !== 0) return connectedDelta
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

  return {
    cards: cardList,
    metrics: {
      connectedSoftware: cardList.filter((card) => card.connectionStatus === '已接入').length,
      totalModes: cardList.reduce((sum, card) => sum + card.modes.length, 0),
      totalCommands: input.softwareCommands.length,
      assignableAgents: input.agents.filter((agent) => agent.status !== 'archived').length,
    },
    freeNotice: getFreeProductNotice(),
  }
}

export function toggleSoftwareForAgent(
  agent: AgentProfileRow,
  softwareProfileId: string,
): { softwareProfileIds: string[] } {
  const current = new Set(agent.softwareProfileIds)
  if (current.has(softwareProfileId)) current.delete(softwareProfileId)
  else current.add(softwareProfileId)
  return { softwareProfileIds: [...current] }
}

function findCatalogForName(name: string): CatalogItem | undefined {
  const normalized = name.toLowerCase()
  return BUILT_IN_CATALOG.find((item) => item.aliases.some((alias) => normalized.includes(alias.toLowerCase())))
}

function modesForProfile(
  profile: SoftwareProfileRow,
  commands: SoftwareCommandRow[],
): StoreCapabilityMode[] {
  const modes: StoreCapabilityMode[] = []
  const adapter = profile.adapterType
  if (adapter === 'cli') {
    modes.push({ id: `${profile.id}:cli`, kind: 'CLI', label: 'CLI 模式', status: '已接入', sourceId: profile.id })
  }
  if (adapter === 'mcp') {
    modes.push({ id: `${profile.id}:mcp`, kind: 'MCP', label: 'MCP 模式', status: '已接入', sourceId: profile.id })
  }
  if (adapter === 'api') {
    modes.push({ id: `${profile.id}:api`, kind: 'API', label: 'API 模式', status: '已接入', sourceId: profile.id })
  }
  if (adapter === 'browser_automation') {
    modes.push({
      id: `${profile.id}:browser`,
      kind: '浏览器',
      label: '浏览器自动化',
      status: '已接入',
      sourceId: profile.id,
    })
  }
  if (adapter === 'desktop_automation' || adapter === 'recorded_macro' || adapter === 'hybrid') {
    modes.push({
      id: `${profile.id}:desktop`,
      kind: '桌面',
      label: '桌面自动化',
      status: '已接入',
      sourceId: profile.id,
    })
  }
  for (const command of commands) {
    modes.push({
      id: command.id,
      kind: '命令',
      label: command.name,
      status: command.healthStatus === 'ok' ? '已接入' : command.healthStatus === 'failed' ? '异常' : '需检查',
      riskLevel: command.riskLevel,
      requiresApproval: command.requiresApproval,
      sourceId: command.id,
    })
  }
  return modes
}

function connectionStatusForProfile(
  profile: SoftwareProfileRow,
  commands: SoftwareCommandRow[],
): StoreConnectionStatus {
  if (commands.some((command) => command.healthStatus === 'failed')) return '异常'
  if (commands.length > 0 && commands.every((command) => command.healthStatus === 'unknown')) return '需检查'
  if (profile.adapterType) return '已接入'
  return '未接入'
}

function categoryForProfile(profile: SoftwareProfileRow): StoreSoftwareCategory {
  if (profile.appType === 'cli_app' || profile.adapterType === 'cli') return '自动化脚本'
  if (profile.appType === 'browser_app' || profile.adapterType === 'browser_automation') return '浏览器网页'
  if (profile.appType === 'native_app' || profile.adapterType === 'desktop_automation') return '其他软件'
  if (profile.appType === 'api_service') return '数据文件'
  return '其他软件'
}

function softwareDescription(profile: SoftwareProfileRow): string {
  if (profile.launchCommand) return `启动命令：${profile.launchCommand}`
  if (profile.executablePath) return `本地程序：${profile.executablePath}`
  return '已注册的软件能力'
}

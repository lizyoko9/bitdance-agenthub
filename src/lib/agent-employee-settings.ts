export type AgentEmployeeSettingSectionId =
  | 'basic'
  | 'model'
  | 'toolkit'
  | 'permissions'
  | 'memory'
  | 'output'

export interface AgentEmployeeSettingSection {
  id: AgentEmployeeSettingSectionId
  label: string
  description: string
}

export interface AgentSettingsCapabilitySummaryInput {
  toolNames?: string[]
  skillIds?: string[]
  mcpServerIds?: string[]
  cliProfileIds?: string[]
}

export interface AgentSettingsCapabilitySummary {
  tools: number
  skills: number
  mcpServers: number
  cliProfiles: number
  total: number
}

export type AssignableAgentModelProvider =
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'volcano-ark'
  | 'openai-compatible'

export interface AgentModelSelectionProfile {
  provider: string
  model: string
  baseUrl: string
  supportsVision: boolean
}

export interface AgentModelSelectionPatch {
  adapterName: 'custom'
  modelProvider: AssignableAgentModelProvider
  modelId: string
  apiBaseUrl: string | null
  supportsVision: boolean
}

export const AGENT_EMPLOYEE_SETTING_SECTIONS: AgentEmployeeSettingSection[] = [
  {
    id: 'basic',
    label: '基础信息',
    description: '这个员工叫什么、负责什么、对用户怎么表达。',
  },
  {
    id: 'model',
    label: '模型选择',
    description: '从模型管理里已经配置好的模型中选择一个。',
  },
  {
    id: 'toolkit',
    label: '员工工具包',
    description: '分配已安装 Skills、已接入 MCP、已配置 CLI 和内置工具。',
  },
  {
    id: 'permissions',
    label: '权限边界',
    description: '控制这个员工能否读写文件、运行命令、操作浏览器或桌面。',
  },
  {
    id: 'memory',
    label: '员工大脑',
    description: '管理这个员工的任务记忆、长期经验、工具经验、失败教训、工作手册、自我校准和反思学习。',
  },
  {
    id: 'output',
    label: '交付产物',
    description: '规定它必须产出报告、代码、图片、视频、表格或文件包。',
  },
]

export const FORBIDDEN_AGENT_SETTINGS_INFRASTRUCTURE_LABELS = [
  'Network Profile',
  '网络出口创建',
  '模型配置',
  '创建模型',
  'Model Profile',
  'CLI Profile',
  '创建 CLI',
  'MCP Server',
  '创建 MCP',
  'Prompt Template',
  'Style Guide',
  'Tool Connection',
  'Software Profile',
  '软件配置',
  '软件命令创建',
] as const

const ASSIGNABLE_AGENT_MODEL_PROVIDERS = new Set<string>([
  'anthropic',
  'openai',
  'deepseek',
  'volcano-ark',
  'openai-compatible',
])

export function assertSimpleAgentSettingsLabels(labels: string[]): void {
  const normalized = labels.map((label) => label.toLowerCase())
  const forbidden = FORBIDDEN_AGENT_SETTINGS_INFRASTRUCTURE_LABELS.find((label) =>
    normalized.some((item) => item.includes(label.toLowerCase())),
  )
  if (!forbidden) return
  throw new Error(`Agent settings contain low-level infrastructure label: ${forbidden}`)
}

export function buildAgentSettingsCapabilitySummary(
  input: AgentSettingsCapabilitySummaryInput,
): AgentSettingsCapabilitySummary {
  const tools = uniqueCount(input.toolNames)
  const skills = uniqueCount(input.skillIds)
  const mcpServers = uniqueCount(input.mcpServerIds)
  const cliProfiles = uniqueCount(input.cliProfileIds)
  return {
    tools,
    skills,
    mcpServers,
    cliProfiles,
    total: tools + skills + mcpServers + cliProfiles,
  }
}

export function buildAgentModelSelectionPatch(
  profile: AgentModelSelectionProfile,
): AgentModelSelectionPatch | null {
  if (!ASSIGNABLE_AGENT_MODEL_PROVIDERS.has(profile.provider)) return null
  const modelId = profile.model.trim()
  if (!modelId) return null
  return {
    adapterName: 'custom',
    modelProvider: profile.provider as AssignableAgentModelProvider,
    modelId,
    apiBaseUrl: profile.baseUrl.trim() || null,
    supportsVision: profile.supportsVision,
  }
}

function uniqueCount(values: string[] | undefined): number {
  return new Set((values ?? []).map((value) => value.trim()).filter(Boolean)).size
}

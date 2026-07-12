import type { ModelProvider } from './types'

export type AgentBuilderAdapter = 'custom' | 'claude-code' | 'codex'
export type AgentBuilderProvider = ModelProvider

export const AGENT_BUILDER_PROVIDER_DEFAULTS: Record<
  AgentBuilderProvider,
  { label: string; defaultModel: string }
> = {
  deepseek: { label: 'DeepSeek', defaultModel: 'deepseek-v4-flash' },
  anthropic: { label: 'Anthropic', defaultModel: 'claude-opus-4-7' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4o' },
  'volcano-ark': { label: '火山方舟 (豆包)', defaultModel: 'doubao-seed-2-0-lite-260428' },
  'openai-compatible': { label: 'OpenAI-compatible', defaultModel: '' },
}

export const CLAUDE_CODE_DEFAULT_MODEL = 'claude-opus-4-7'
export const CODEX_DEFAULT_MODEL = 'gpt-5-codex'

export const AVAILABLE_AGENT_TOOLS = [
  'write_artifact',
  'deploy_artifact',
  'deploy_workspace',
  'read_artifact',
  'read_attachment',
  'ask_user',
  'fs_list',
  'fs_read',
  'fs_write',
  'bash',
  'install_skill',
] as const

/** 进 all-purpose 预设的工具（= 除 opt-in 类 install_skill 外的全部）。install_skill 默认不开。 */
const ALL_PURPOSE_TOOLS = [
  'write_artifact',
  'deploy_artifact',
  'deploy_workspace',
  'read_artifact',
  'read_attachment',
  'ask_user',
  'fs_list',
  'fs_read',
  'fs_write',
  'bash',
] as const

export type AgentToolName = (typeof AVAILABLE_AGENT_TOOLS)[number]
export type AgentToolPresetId = 'all-purpose' | 'local-code' | 'artifact' | 'review'

export interface AgentToolPreset {
  id: AgentToolPresetId
  label: string
  desc: string
  tools: readonly AgentToolName[]
}

export const AGENT_TOOL_PRESETS: readonly AgentToolPreset[] = [
  {
    id: 'all-purpose',
    label: '全栈通用',
    desc: '本地代码 + artifact 交付',
    tools: ALL_PURPOSE_TOOLS,
  },
  {
    id: 'local-code',
    label: '本地代码',
    desc: '读写 workspace 并运行命令',
    tools: ['deploy_workspace', 'read_artifact', 'read_attachment', 'ask_user', 'fs_list', 'fs_read', 'fs_write', 'bash'],
  },
  {
    id: 'artifact',
    label: '产物交付',
    desc: '网页、文档、原型卡片',
    tools: ['write_artifact', 'deploy_artifact', 'deploy_workspace', 'read_artifact', 'read_attachment', 'ask_user'],
  },
  {
    id: 'review',
    label: '审查验证',
    desc: '读取产物/文件并跑检查',
    tools: ['read_artifact', 'read_attachment', 'ask_user', 'fs_list', 'fs_read', 'bash'],
  },
]

export const DEFAULT_CUSTOM_AGENT_TOOLS = AGENT_TOOL_PRESETS[0].tools

/**
 * opt-in「额外能力」工具：默认关闭、单独勾选，且**跨 adapter**（SDK agent 也可保留在 toolNames，
 * 用于网关式暴露，不同于 SDK 内置工具）。install_skill 含出站网络，故归此类。
 * 对 custom 它就在普通工具清单里（默认不勾）；对 SDK adapter 用单独开关呈现。
 */
export const AGENT_OPT_IN_TOOLS: readonly AgentToolName[] = ['install_skill']

/** SDK adapter 不消费普通 toolNames，但保留 opt-in 额外能力（如 install_skill）。 */
export function filterSdkOptInTools(toolNames: readonly string[]): AgentToolName[] {
  const optIn = new Set<string>(AGENT_OPT_IN_TOOLS)
  return toolNames.filter((tool): tool is AgentToolName => optIn.has(tool))
}

export const DEFAULT_CUSTOM_SYSTEM_PROMPT = `你是一个 AgentHub custom agent。你的任务是理解用户目标，使用已启用的工具完成工作，并把结果清晰交付给用户。

工作原则：
1. 先判断需要什么上下文；只有在用户提到附件、已有产物或工作区文件时，才调用对应读取工具。
2. 多步骤任务先给自己形成简短计划，但不要把固定流程强加给简单问题。
3. 工具调用要少而准确；每次调用都应服务于当前目标。
4. 产出代码、网页、文档或设计稿时，优先用 write_artifact 创建结构化产物；网页产物完成后再调用 deploy_artifact。
5. 探索项目目录时优先用 fs_list，再用 fs_read 读取具体文件；使用 fs_write 或 bash 前确认确有必要，并只在当前 workspace 范围内操作。
6. 最终回复保持简洁，说明完成了什么、产物在哪里、还剩什么需要用户决策。`

export const AGENT_TOOL_META: Record<AgentToolName, { label: string; desc: string }> = {
  write_artifact: { label: '创建产物', desc: '生成可预览的代码 / 网页 / 文档 / PPT，支持多版本迭代' },
  deploy_artifact: { label: '部署网页', desc: '把网页产物发布为本地静态站点，生成预览链接与下载包' },
  deploy_workspace: { label: '部署目录', desc: '把工作区内 dist/build/out 等静态目录生成预览链接与下载包' },
  read_artifact: { label: '读取产物', desc: '查看会话中已有产物的完整内容，便于在其基础上继续改' },
  read_attachment: { label: '读取附件', desc: '读取用户上传的文本 / 文件附件内容' },
  ask_user: { label: '结构化提问', desc: '让用户在明确选项中选择，用于范围、风格、平台等关键澄清' },
  fs_list: { label: '列出文件', desc: '列出工作区内的目录和文件，用于安全探索项目结构' },
  fs_read: { label: '读取文件', desc: '读取工作区内的文件（源码 / 配置等），仅限沙箱目录' },
  fs_write: { label: '写入文件', desc: '在工作区内新建 / 修改文件；review 模式下需用户批准' },
  bash: { label: '执行命令', desc: '在工作区内运行命令行；受命令黑名单与沙箱目录约束' },
  install_skill: {
    label: '安装 Skill',
    desc: '从 GitHub 公开链接安装 Skill 到本 Agent（出站网络 + 需用户审批）。默认关闭，仅在需要时勾选',
  },
}

export interface AgentDraftAssumption {
  label: string
  detail: string
}

export interface AgentToolPermissionSummary {
  toolName: AgentToolName
  label: string
  desc: string
}

export interface AgentConfigDraft {
  name: string
  avatar: string
  description: string
  capabilities: string[]
  systemPrompt: string
  adapterName: AgentBuilderAdapter
  modelProvider?: AgentBuilderProvider
  modelId?: string
  toolNames: AgentToolName[]
  /** 选用的 Skill（方法论模块）id 列表；默认空数组。运行时注入 system prompt（specs/13）。 */
  skillIds: string[]
  supportsVision: boolean
  rationale: string[]
  assumptions: AgentDraftAssumption[]
  toolPermissionSummaries: AgentToolPermissionSummary[]
}

export interface AgentDraftRequest {
  intent: string
  followUp?: string
}

export interface AgentDraftResponse {
  draft: AgentConfigDraft
}

export function normalizeAgentToolNames(toolNames: readonly string[]): AgentToolName[] {
  const allowed = new Set<string>(AVAILABLE_AGENT_TOOLS)
  const seen = new Set<string>()
  const normalized: AgentToolName[] = []

  for (const toolName of toolNames) {
    if (!allowed.has(toolName) || seen.has(toolName)) continue
    seen.add(toolName)
    normalized.push(toolName as AgentToolName)
  }

  return normalized
}

export function getAgentToolPreset(presetId: AgentToolPresetId): AgentToolPreset {
  return AGENT_TOOL_PRESETS.find((preset) => preset.id === presetId) ?? AGENT_TOOL_PRESETS[0]
}

export function buildToolPermissionSummaries(
  toolNames: readonly string[],
): AgentToolPermissionSummary[] {
  return normalizeAgentToolNames(toolNames).map((toolName) => ({
    toolName,
    ...AGENT_TOOL_META[toolName],
  }))
}

export function inferAgentToolPreset(intent: string, followUp?: string): AgentToolPresetId {
  const text = `${intent}\n${followUp ?? ''}`.toLowerCase()
  const wantsToWrite =
    /写|实现|开发|生成|创建|搭建|部署|build|implement|create|write|ship/.test(text) ||
    /修改(?!建议)/.test(text)
  const wantsReview = /审查|评审|检查|验证|验收|风险|review|audit|inspect|validate|verify/.test(text)
  if (wantsReview && !wantsToWrite) return 'review'

  if (
    /代码|源码|仓库|本地|文件|命令|终端|测试|修复|重构|调试|workspace|repo|repository|code|cli|bash|test|lint|debug|refactor/.test(
      text,
    )
  ) {
    return 'local-code'
  }

  if (
    /产物|网页|页面|原型|文档|报告|幻灯片|演示|图示|图表|设计稿|ppt|slides|presentation|website|document|diagram|mermaid|prototype/.test(
      text,
    )
  ) {
    return 'artifact'
  }

  return 'all-purpose'
}

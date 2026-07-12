import {
  AGENT_BUILDER_PROVIDER_DEFAULTS,
  buildToolPermissionSummaries,
  getAgentToolPreset,
  inferAgentToolPreset,
  type AgentConfigDraft,
  type AgentDraftRequest,
  type AgentToolPresetId,
} from '@/shared/agent-builder-config'

import { AgentConfigDraftSchema } from './agent-draft-schema'

const DEFAULT_PROVIDER = 'deepseek' as const

export async function createAgentConfigDraft(input: AgentDraftRequest): Promise<AgentConfigDraft> {
  return AgentConfigDraftSchema.parse(buildHeuristicAgentConfigDraft(input))
}

export function buildHeuristicAgentConfigDraft(input: AgentDraftRequest): AgentConfigDraft {
  const intent = normalizeText(input.intent)
  const followUp = normalizeText(input.followUp ?? '')
  const combined = [intent, followUp].filter(Boolean).join('\n')
  const presetId = inferAgentToolPreset(intent, followUp)
  const preset = getAgentToolPreset(presetId)
  const name = inferAgentName(combined, presetId)
  const capabilities = inferCapabilities(combined, presetId)
  const permissionSummaries = buildToolPermissionSummaries(preset.tools)

  return {
    name,
    avatar: '🤖',
    description: inferDescription(combined, presetId),
    capabilities,
    systemPrompt: buildSystemPrompt({
      name,
      intent,
      followUp,
      presetLabel: preset.label,
      permissionSummaries,
    }),
    adapterName: 'custom',
    modelProvider: DEFAULT_PROVIDER,
    modelId: AGENT_BUILDER_PROVIDER_DEFAULTS[DEFAULT_PROVIDER].defaultModel,
    toolNames: permissionSummaries.map((summary) => summary.toolName),
    skillIds: [],
    supportsVision: true,
    rationale: [
      `根据描述匹配到「${preset.label}」工具预设。`,
      '按普通自建 Agent 生成，不包含 Orchestrator 专用工具。',
      '最终保存仍会走现有 Agent 创建接口，保存前可切到详细配置继续调整。',
    ],
    assumptions: [
      {
        label: '模型',
        detail: `默认使用 ${AGENT_BUILDER_PROVIDER_DEFAULTS[DEFAULT_PROVIDER].label} / ${
          AGENT_BUILDER_PROVIDER_DEFAULTS[DEFAULT_PROVIDER].defaultModel
        }，可在详细配置中改成其他 provider。`,
      },
      {
        label: '视觉',
        detail: '默认开启视觉能力，方便处理截图、设计稿、图示和图片附件；如果模型不支持可在详细配置中关闭。',
      },
      {
        label: '权限',
        detail: `工具权限来自「${preset.label}」预设，保存前会逐项展示，可切到详细配置增减。`,
      },
    ],
    toolPermissionSummaries: permissionSummaries,
  }
}

function buildSystemPrompt({
  name,
  intent,
  followUp,
  presetLabel,
  permissionSummaries,
}: {
  name: string
  intent: string
  followUp: string
  presetLabel: string
  permissionSummaries: ReturnType<typeof buildToolPermissionSummaries>
}) {
  const permissionLine = permissionSummaries
    .map((summary) => `${summary.label}(${summary.toolName})`)
    .join('、')

  return [
    `你是 ${name}。`,
    '',
    `用户创建你的目标：${intent}`,
    followUp ? `补充偏好：${followUp}` : '',
    '',
    '工作方式：',
    '- 先判断用户真正想完成的交付物、约束和验收标准。',
    '- 信息不足时，优先使用结构化提问澄清关键选择；不要假装已经知道用户偏好。',
    '- 执行前简要说明计划，执行中保持结果可检查，交付前做自检。',
    '- 涉及文件写入、命令执行或部署时，明确说明影响范围和结果。',
    '',
    `默认工具策略：${presetLabel}。可用权限包括：${permissionLine || 'SDK 内置工具集'}。`,
    '不要尝试使用未授权工具；普通自建 Agent 不承担 Orchestrator 的任务拆分职责。',
  ]
    .filter(Boolean)
    .join('\n')
}

function inferAgentName(text: string, presetId: AgentToolPresetId): string {
  const explicit = text.match(
    /(?:叫|命名为|名字叫|名称(?:是|为)?|name(?:d)?\s*)(?:「|“|"|')?([^，,。.\n"”』']{2,24})/,
  )?.[1]
  if (explicit) return truncate(cleanName(explicit), 64)

  if (/ppt|幻灯片|演示|presentation|slides/.test(text.toLowerCase())) return 'PPT 设计师'
  if (/图示|图表|流程图|mermaid|diagram/.test(text.toLowerCase())) return '图示架构师'
  if (/文档|报告|document|report/.test(text.toLowerCase())) return '文档写作助手'
  if (/网页|页面|原型|website|prototype|landing/.test(text.toLowerCase())) return '网页原型助手'

  switch (presetId) {
    case 'local-code':
      return '代码工程师'
    case 'artifact':
      return '产物设计师'
    case 'review':
      return '审查验证助手'
    case 'all-purpose':
      return '专属助手'
  }
}

function inferDescription(text: string, presetId: AgentToolPresetId): string {
  const target = truncate(text, 72)
  const prefix =
    presetId === 'local-code'
      ? '围绕本地代码与命令行任务提供实现、修改和验证支持'
      : presetId === 'artifact'
        ? '围绕网页、文档、PPT 等产物提供规划、生成和迭代支持'
        : presetId === 'review'
          ? '围绕已有产物或代码提供审查、验证和风险发现'
          : '围绕用户目标提供规划、执行和交付支持'

  return truncate(`${prefix}：${target}`, 280)
}

function inferCapabilities(text: string, presetId: AgentToolPresetId): string[] {
  const lower = text.toLowerCase()
  const capabilities =
    presetId === 'local-code'
      ? ['代码实现', '本地验证', '命令行']
      : presetId === 'artifact'
        ? ['产物交付', '内容生成', '原型设计']
        : presetId === 'review'
          ? ['审查验证', '风险发现', '改进建议']
          : ['需求澄清', '任务执行', '交付自检']

  if (/ppt|幻灯片|演示|presentation|slides/.test(lower)) capabilities.push('PPT')
  if (/图示|图表|mermaid|diagram/.test(lower)) capabilities.push('图示')
  if (/网页|页面|website|prototype|landing/.test(lower)) capabilities.push('网页')
  if (/图片|截图|视觉|image|screenshot|visual/.test(lower)) capabilities.push('视觉理解')

  return Array.from(new Set(capabilities)).slice(0, 8)
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function cleanName(text: string): string {
  return text.replace(/[「」“”"']/g, '').trim()
}

function truncate(text: string, maxChars: number): string {
  const chars = Array.from(text)
  if (chars.length <= maxChars) return text
  return `${chars.slice(0, maxChars - 1).join('')}…`
}

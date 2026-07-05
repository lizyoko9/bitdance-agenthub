import type { LangflowPortKind } from './langflow-port-contracts'

export type AgentFlowNodeKind = 'input' | 'prompt' | 'model' | 'memory' | 'agent' | 'tool' | 'approval' | 'artifact'
export type AgentFlowTemplatePortKind = LangflowPortKind | 'any'
export type AgentFlowNodeTemplateCategory =
  | '输入'
  | '提示词'
  | '模型'
  | '记忆'
  | '智能体'
  | '工具'
  | '审批'
  | '交付'

export interface AgentFlowTemplatePort {
  id: string
  label: string
  type: AgentFlowTemplatePortKind
}

export interface AgentFlowNodeTemplate {
  id: string
  kind: AgentFlowNodeKind
  title: string
  subtitle: string
  category: AgentFlowNodeTemplateCategory
  description: string
  inputs: AgentFlowTemplatePort[]
  outputs: AgentFlowTemplatePort[]
  customerVisible?: boolean
}

export interface AgentFlowNodeTemplateGroup {
  category: AgentFlowNodeTemplateCategory
  templates: AgentFlowNodeTemplate[]
}

export const AGENT_FLOW_TEMPLATE_CATEGORY_ORDER: AgentFlowNodeTemplateCategory[] = [
  '输入',
  '提示词',
  '模型',
  '记忆',
  '智能体',
  '工具',
  '审批',
  '交付',
]

export const agentFlowNodeTemplates: AgentFlowNodeTemplate[] = [
  {
    id: 'customer-request',
    kind: 'input',
    title: '客户需求',
    subtitle: '入口',
    category: '输入',
    description: '接收客户目标、文件、素材、上一条任务消息或业务上下文。',
    inputs: [],
    outputs: [{ id: 'message', label: '客户消息', type: 'message' }],
  },
  {
    id: 'prompt-template',
    kind: 'prompt',
    title: '提示词模板',
    subtitle: '上下文整理',
    category: '提示词',
    description: '把客户需求、项目约束和业务上下文整理成可交给 Agent 的提示词。',
    inputs: [{ id: 'message', label: '客户消息', type: 'message' }],
    outputs: [{ id: 'prompt', label: '任务提示词', type: 'prompt' }],
  },
  {
    id: 'model-profile',
    kind: 'model',
    title: '模型配置',
    subtitle: 'LLM',
    category: '模型',
    description: '选择已经在模型管理里配置好的大模型，作为下游 Agent 的思考引擎。',
    inputs: [],
    outputs: [{ id: 'model', label: '可用模型', type: 'model' }],
  },
  {
    id: 'memory-context',
    kind: 'memory',
    title: '记忆上下文',
    subtitle: '知识与经验',
    category: '记忆',
    description: '把项目记忆、客户偏好、历史经验或软件操作方法交给下游 Agent。',
    inputs: [{ id: 'message', label: '检索线索', type: 'message' }],
    outputs: [{ id: 'memory', label: '相关记忆', type: 'memory' }],
  },
  {
    id: 'employee-agent',
    kind: 'agent',
    title: '员工 Agent',
    subtitle: '执行者',
    category: '智能体',
    description: '选择一个员工级 Agent，持续完成规划、执行、验证和交付。',
    inputs: [
      { id: 'message', label: '任务输入', type: 'message' },
      { id: 'prompt', label: '提示词', type: 'prompt' },
      { id: 'model', label: '模型', type: 'model' },
      { id: 'tool', label: '工具能力', type: 'tool' },
      { id: 'memory', label: '记忆', type: 'memory' },
    ],
    outputs: [
      { id: 'report', label: '报告', type: 'report' },
      { id: 'code', label: '代码', type: 'code' },
      { id: 'document', label: '文档', type: 'document' },
    ],
  },
  {
    id: 'software-command',
    kind: 'tool',
    title: '软件命令',
    subtitle: 'CLI / MCP / 软件',
    category: '工具',
    description: '调用已经接入的软件、CLI、MCP 或自动化命令，并把结果交给下游。',
    inputs: [{ id: 'message', label: '命令输入', type: 'message' }],
    outputs: [
      { id: 'tool', label: '工具能力', type: 'tool' },
      { id: 'file_bundle', label: '文件包', type: 'file_bundle' },
      { id: 'data', label: '数据', type: 'data' },
      { id: 'result', label: '运行结果', type: 'result' },
    ],
  },
  {
    id: 'human-approval',
    kind: 'approval',
    title: '人工确认',
    subtitle: '风险门禁',
    category: '审批',
    description: '在高风险动作前暂停，让用户确认是否继续或修改要求。',
    inputs: [{ id: 'document', label: '待确认内容', type: 'document' }],
    outputs: [{ id: 'document', label: '确认结果', type: 'document' }],
  },
  {
    id: 'customer-deliverable',
    kind: 'artifact',
    title: '客户交付物',
    subtitle: '最终产物',
    category: '交付',
    description: '接收上游指定产物，作为客户最终可以看到的交付结果。',
    inputs: [{ id: 'report', label: '交付文件', type: 'report' }],
    outputs: [],
    customerVisible: true,
  },
]

export function getAgentFlowNodeTemplate(id: string) {
  return agentFlowNodeTemplates.find((template) => template.id === id) ?? null
}

export function getAgentFlowNodeTemplateGroups(
  templates: AgentFlowNodeTemplate[] = agentFlowNodeTemplates,
): AgentFlowNodeTemplateGroup[] {
  return AGENT_FLOW_TEMPLATE_CATEGORY_ORDER
    .map((category) => ({
      category,
      templates: templates.filter((template) => template.category === category),
    }))
    .filter((group) => group.templates.length > 0)
}

export function cloneTemplatePorts(ports: AgentFlowTemplatePort[]) {
  return ports.map((port) => ({ ...port }))
}

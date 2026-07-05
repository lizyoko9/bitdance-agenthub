import type { LangflowPortKind } from './langflow-port-contracts'

export type AgentFlowNodeKind = 'input' | 'agent' | 'tool' | 'approval' | 'artifact'
export type AgentFlowTemplatePortKind = LangflowPortKind | 'any'

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
  category: string
  description: string
  inputs: AgentFlowTemplatePort[]
  outputs: AgentFlowTemplatePort[]
  customerVisible?: boolean
}

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
    id: 'employee-agent',
    kind: 'agent',
    title: '员工 Agent',
    subtitle: '执行者',
    category: '智能体',
    description: '选择一个员工级 Agent，持续完成规划、执行、验证和交付。',
    inputs: [{ id: 'message', label: '任务输入', type: 'message' }],
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

export function cloneTemplatePorts(ports: AgentFlowTemplatePort[]) {
  return ports.map((port) => ({ ...port }))
}

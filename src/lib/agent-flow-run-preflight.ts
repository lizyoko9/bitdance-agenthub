import { LANGFLOW_PORT_KIND_LABELS, canConnectPortKinds, type LangflowPortKind } from './langflow-port-contracts'
import type { AgentFlowNodeKind, AgentFlowTemplatePortKind } from './agent-flow-node-templates'

export type AgentFlowRunIssueCode =
  | 'no_edges'
  | 'source_node_missing'
  | 'target_node_missing'
  | 'source_port_missing'
  | 'target_port_missing'
  | 'port_type_mismatch'
  | 'agent_profile_missing'
  | 'software_command_missing'
  | 'node_disconnected'

export interface AgentFlowRunIssue {
  code: AgentFlowRunIssueCode
  severity: 'error' | 'warning'
  message: string
  nodeId?: string
  edgeId?: string
}

export interface AgentFlowRunPreflightNode {
  id: string
  data: {
    kind: AgentFlowNodeKind
    title?: string
    agentId?: string
    softwareCommandId?: string
    inputs: Array<{ id: string; label?: string; type: AgentFlowTemplatePortKind | string }>
    outputs: Array<{ id: string; label?: string; type: AgentFlowTemplatePortKind | string }>
  }
}

export interface AgentFlowRunPreflightEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  data?: {
    artifactType?: AgentFlowTemplatePortKind | string
  } | null
}

export interface AgentFlowRunPreflightResult {
  ready: boolean
  errorCount: number
  warningCount: number
  connectedNodeCount: number
  disconnectedNodeCount: number
  issues: AgentFlowRunIssue[]
}

export function validateAgentFlowForRun(args: {
  nodes: AgentFlowRunPreflightNode[]
  edges: AgentFlowRunPreflightEdge[]
}): AgentFlowRunPreflightResult {
  const issues: AgentFlowRunIssue[] = []
  const nodeById = new Map(args.nodes.map((node) => [node.id, node]))
  const connectedNodeIds = new Set<string>()

  if (args.edges.length === 0) {
    issues.push({
      code: 'no_edges',
      severity: 'error',
      message: '画布里还没有连线，无法形成可执行流程。',
    })
  }

  for (const node of args.nodes) {
    if (node.data.kind === 'agent' && !node.data.agentId) {
      issues.push({
        code: 'agent_profile_missing',
        severity: 'error',
        nodeId: node.id,
        message: `${nodeTitle(node)} 还没有选择智能体员工。`,
      })
    }

    if (node.data.kind === 'tool' && !node.data.softwareCommandId) {
      issues.push({
        code: 'software_command_missing',
        severity: 'error',
        nodeId: node.id,
        message: `${nodeTitle(node)} 还没有选择软件命令。`,
      })
    }

  }

  for (const edge of args.edges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)

    if (!source) {
      issues.push({
        code: 'source_node_missing',
        severity: 'error',
        edgeId: edge.id,
        message: `连线 ${edge.id} 找不到上游节点。`,
      })
      continue
    }
    if (!target) {
      issues.push({
        code: 'target_node_missing',
        severity: 'error',
        edgeId: edge.id,
        message: `连线 ${edge.id} 找不到下游节点。`,
      })
      continue
    }

    connectedNodeIds.add(source.id)
    connectedNodeIds.add(target.id)

    const sourcePort = findPortByHandle(source.data.outputs, edge.sourceHandle, 'out')
    const targetPort = findPortByHandle(target.data.inputs, edge.targetHandle, 'in')

    if (!sourcePort) {
      issues.push({
        code: 'source_port_missing',
        severity: 'error',
        edgeId: edge.id,
        nodeId: source.id,
        message: `${nodeTitle(source)} 的输出端口不存在。`,
      })
      continue
    }
    if (!targetPort) {
      issues.push({
        code: 'target_port_missing',
        severity: 'error',
        edgeId: edge.id,
        nodeId: target.id,
        message: `${nodeTitle(target)} 的输入端口不存在。`,
      })
      continue
    }

    const artifactType = edge.data?.artifactType ?? sourcePort.type
    if (!canConnect(String(artifactType), String(targetPort.type))) {
      const artifactLabel = labelArtifactType(String(artifactType))
      const targetLabel = labelArtifactType(String(targetPort.type))
      issues.push({
        code: 'port_type_mismatch',
        severity: 'error',
        edgeId: edge.id,
        nodeId: target.id,
        message: `${nodeTitle(source)} 输出的${artifactLabel}不能交给 ${nodeTitle(target)} 的${targetLabel}输入。`,
      })
    }
  }

  for (const node of args.nodes) {
    if (connectedNodeIds.has(node.id)) continue
    issues.push({
      code: 'node_disconnected',
      severity: 'warning',
      nodeId: node.id,
      message: `${nodeTitle(node)} 还没有接入流程。`,
    })
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  const warningCount = issues.length - errorCount

  return {
    ready: errorCount === 0,
    errorCount,
    warningCount,
    connectedNodeCount: connectedNodeIds.size,
    disconnectedNodeCount: Math.max(args.nodes.length - connectedNodeIds.size, 0),
    issues,
  }
}

function findPortByHandle<TPort extends { id: string; type: string | AgentFlowTemplatePortKind }>(
  ports: TPort[],
  handleId: string | null | undefined,
  prefix: 'in' | 'out',
): TPort | null {
  if (!handleId) return ports[0] ?? null
  return ports.find((port) => `${prefix}:${port.id}` === handleId) ?? null
}

function canConnect(sourceType: string, targetType: string) {
  if (targetType === 'any') return true
  if (sourceType === 'any') return false
  return canConnectPortKinds(sourceType as LangflowPortKind, targetType as LangflowPortKind)
}

function labelArtifactType(type: string) {
  if (type === 'any') return '任意'
  return LANGFLOW_PORT_KIND_LABELS[type as LangflowPortKind] ?? type
}

function nodeTitle(node: AgentFlowRunPreflightNode) {
  return node.data.title || node.id
}

import type { AgentFlowRunIssue } from './agent-flow-run-preflight'

export type AgentFlowRunStatus = 'idle' | 'running' | 'done' | 'blocked'
export type AgentFlowHandoffStatus = 'pending' | 'delivered' | 'blocked'

export interface AgentFlowStatusNodeLike {
  id: string
  data: {
    status: AgentFlowRunStatus
    [key: string]: unknown
  }
}

export interface AgentFlowStatusEdgeLike {
  source: string
  target: string
  data?: {
    handoffStatus?: AgentFlowHandoffStatus
    [key: string]: unknown
  } | null
}

export function applyPreflightStatusToNodes<TNode extends AgentFlowStatusNodeLike>(args: {
  nodes: TNode[]
  edges: AgentFlowStatusEdgeLike[]
  preflight: {
    ready: boolean
    issues: AgentFlowRunIssue[]
  }
}): TNode[] {
  const blockedNodeIds = new Set(
    args.preflight.issues
      .filter((issue) => issue.severity === 'error' && issue.nodeId)
      .map((issue) => issue.nodeId!),
  )
  const connectedNodeIds = new Set(args.edges.flatMap((edge) => [edge.source, edge.target]))

  return args.nodes.map((node) => {
    const status = nextNodeStatus(node.id, {
      ready: args.preflight.ready,
      blockedNodeIds,
      connectedNodeIds,
    })
    return {
      ...node,
      data: {
        ...node.data,
        status,
      },
    }
  })
}

export function applyPreflightStatusToEdges<TEdge extends AgentFlowStatusEdgeLike>(args: {
  edges: TEdge[]
  preflight: {
    ready: boolean
    issues: AgentFlowRunIssue[]
  }
}): TEdge[] {
  const blockedNodeIds = new Set(
    args.preflight.issues
      .filter((issue) => issue.severity === 'error' && issue.nodeId)
      .map((issue) => issue.nodeId!),
  )

  return args.edges.map((edge) => {
    const handoffStatus = nextEdgeHandoffStatus(edge, {
      ready: args.preflight.ready,
      blockedNodeIds,
    })

    return {
      ...edge,
      data: {
        ...(edge.data ?? {}),
        handoffStatus,
      },
    }
  })
}

function nextNodeStatus(
  nodeId: string,
  args: {
    ready: boolean
    blockedNodeIds: Set<string>
    connectedNodeIds: Set<string>
  },
): AgentFlowRunStatus {
  if (args.blockedNodeIds.has(nodeId)) return 'blocked'
  if (!args.ready) return 'idle'
  return args.connectedNodeIds.has(nodeId) ? 'done' : 'idle'
}

function nextEdgeHandoffStatus(
  edge: AgentFlowStatusEdgeLike,
  args: {
    ready: boolean
    blockedNodeIds: Set<string>
  },
): AgentFlowHandoffStatus {
  if (args.ready) return 'delivered'
  if (args.blockedNodeIds.has(edge.source) || args.blockedNodeIds.has(edge.target)) return 'blocked'
  return 'pending'
}

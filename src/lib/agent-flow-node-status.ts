import type { AgentFlowRunIssue } from './agent-flow-run-preflight'

export type AgentFlowRunStatus = 'idle' | 'running' | 'done' | 'blocked'

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

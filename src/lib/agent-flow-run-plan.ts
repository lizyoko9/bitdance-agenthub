export interface AgentFlowRunPlanNode {
  id: string
  data: {
    title?: string
    kind?: string
  }
}

export interface AgentFlowRunPlanEdge {
  id: string
  source: string
  target: string
  data?: {
    handoffContract?: string
    label?: string
    artifactType?: string
  } | null
}

export interface AgentFlowRunPlanStep {
  nodeId: string
  title: string
  kind: string
  stage: number
  incomingContracts: string[]
  outgoingContracts: string[]
}

export function buildAgentFlowRunPlan(_: {
  nodes: AgentFlowRunPlanNode[]
  edges: AgentFlowRunPlanEdge[]
}): AgentFlowRunPlanStep[] {
  const { nodes, edges } = _
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const originalIndex = new Map(nodes.map((node, index) => [node.id, index]))
  const incomingCount = new Map(nodes.map((node) => [node.id, 0]))
  const remainingIncoming = new Map(incomingCount)
  const outgoingEdges = new Map<string, AgentFlowRunPlanEdge[]>()
  const incomingContracts = new Map(nodes.map((node) => [node.id, [] as string[]]))
  const outgoingContracts = new Map(nodes.map((node) => [node.id, [] as string[]]))

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue

    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
    remainingIncoming.set(edge.target, (remainingIncoming.get(edge.target) ?? 0) + 1)
    outgoingEdges.set(edge.source, [...(outgoingEdges.get(edge.source) ?? []), edge])

    const contract = edgeContract(edge)
    incomingContracts.get(edge.target)?.push(contract)
    outgoingContracts.get(edge.source)?.push(contract)
  }

  const stages = new Map<string, number>()
  const queue = nodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .sort((a, b) => (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0))
    .map((node) => node.id)

  for (const nodeId of queue) stages.set(nodeId, 1)

  for (let index = 0; index < queue.length; index += 1) {
    const sourceId = queue[index]
    const sourceStage = stages.get(sourceId) ?? 1

    for (const edge of outgoingEdges.get(sourceId) ?? []) {
      const nextStage = Math.max(stages.get(edge.target) ?? 1, sourceStage + 1)
      stages.set(edge.target, nextStage)
      remainingIncoming.set(edge.target, Math.max((remainingIncoming.get(edge.target) ?? 1) - 1, 0))
      if (remainingIncoming.get(edge.target) === 0) queue.push(edge.target)
    }
  }

  for (const node of nodes) {
    if (!stages.has(node.id)) stages.set(node.id, 1)
  }

  return nodes
    .map((node) => ({
      nodeId: node.id,
      title: node.data.title ?? node.id,
      kind: node.data.kind ?? 'node',
      stage: stages.get(node.id) ?? 1,
      incomingContracts: incomingContracts.get(node.id) ?? [],
      outgoingContracts: outgoingContracts.get(node.id) ?? [],
    }))
    .sort((a, b) => a.stage - b.stage || (originalIndex.get(a.nodeId) ?? 0) - (originalIndex.get(b.nodeId) ?? 0))
}

function edgeContract(edge: AgentFlowRunPlanEdge) {
  if (edge.data?.handoffContract) return edge.data.handoffContract
  if (edge.data?.label) return edge.data.label
  if (edge.data?.artifactType) return String(edge.data.artifactType)
  return `${edge.source} -> ${edge.target}`
}

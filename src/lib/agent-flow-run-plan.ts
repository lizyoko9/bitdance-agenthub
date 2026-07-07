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
  sourceHandle?: string | null
  targetHandle?: string | null
  data?: {
    handoffContract?: string
    label?: string
    artifactType?: string
    artifactLabel?: string
    outputId?: string
    sourcePortId?: string
    targetPortId?: string
    sourcePortLabel?: string
    targetPortLabel?: string
  } | null
}

export interface AgentFlowRunPlanHandoff {
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  artifactType: string
  artifactLabel: string
  outputId: string
  targetInputId: string
  sourcePortLabel: string
  targetPortLabel: string
  contract: string
}

export interface AgentFlowRunPlanStep {
  nodeId: string
  title: string
  kind: string
  stage: number
  incomingContracts: string[]
  outgoingContracts: string[]
  incomingHandoffs: AgentFlowRunPlanHandoff[]
  outgoingHandoffs: AgentFlowRunPlanHandoff[]
}

const ARTIFACT_LABELS: Record<string, string> = {
  message: '消息',
  prompt: '提示词',
  model: '模型',
  tool: '工具',
  memory: '记忆',
  document: '文档',
  report: '报告',
  code: '代码',
  data: '数据',
  result: '结果',
  image: '图片',
  video: '视频',
  audio: '音频',
  spreadsheet: '表格',
  file_bundle: '文件包',
  structured_data: '结构化数据',
  any: '任意',
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
  const incomingHandoffs = new Map(nodes.map((node) => [node.id, [] as AgentFlowRunPlanHandoff[]]))
  const outgoingHandoffs = new Map(nodes.map((node) => [node.id, [] as AgentFlowRunPlanHandoff[]]))

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue

    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
    remainingIncoming.set(edge.target, (remainingIncoming.get(edge.target) ?? 0) + 1)
    outgoingEdges.set(edge.source, [...(outgoingEdges.get(edge.source) ?? []), edge])

    const handoff = edgeHandoff(edge)
    const contract = handoff.contract
    incomingContracts.get(edge.target)?.push(contract)
    outgoingContracts.get(edge.source)?.push(contract)
    incomingHandoffs.get(edge.target)?.push(handoff)
    outgoingHandoffs.get(edge.source)?.push(handoff)
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
      incomingHandoffs: incomingHandoffs.get(node.id) ?? [],
      outgoingHandoffs: outgoingHandoffs.get(node.id) ?? [],
    }))
    .sort((a, b) => a.stage - b.stage || (originalIndex.get(a.nodeId) ?? 0) - (originalIndex.get(b.nodeId) ?? 0))
}

function edgeHandoff(edge: AgentFlowRunPlanEdge): AgentFlowRunPlanHandoff {
  const artifactType = stringOrFallback(edge.data?.artifactType, 'artifact')
  const artifactLabel = stringOrFallback(edge.data?.artifactLabel, artifactLabelFor(artifactType))
  const outputId = stringOrFallback(
    edge.data?.outputId,
    stringOrFallback(edge.data?.sourcePortId, handlePortId(edge.sourceHandle, 'out') || 'artifact'),
  )
  const targetInputId = stringOrFallback(
    edge.data?.targetPortId,
    handlePortId(edge.targetHandle, 'in') || artifactType,
  )
  const sourcePortLabel = stringOrFallback(edge.data?.sourcePortLabel, stringOrFallback(edge.data?.label, artifactLabel))
  const targetPortLabel = stringOrFallback(edge.data?.targetPortLabel, artifactLabel)
  const contract =
    edge.data?.handoffContract ||
    (edge.data?.label && !edge.data.artifactType ? edge.data.label : '') ||
    `${artifactLabel}: ${sourcePortLabel} -> ${targetPortLabel}`

  return {
    edgeId: edge.id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    artifactType,
    artifactLabel,
    outputId,
    targetInputId,
    sourcePortLabel,
    targetPortLabel,
    contract,
  }
}

function artifactLabelFor(type: string): string {
  return ARTIFACT_LABELS[type] ?? type
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function handlePortId(handle: string | null | undefined, prefix: 'in' | 'out'): string {
  if (!handle) return ''
  if (handle.startsWith(`${prefix}:`)) return handle.slice(`${prefix}:`.length)
  if (handle.startsWith('artifact:')) return handle.slice('artifact:'.length)
  return ''
}

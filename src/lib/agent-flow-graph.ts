export interface DirectedWorkflowEdge {
  source: string
  target: string
}

export interface TargetInputEdge {
  target: string
  targetHandle?: string | null
}

export interface ConnectablePort<TType extends string = string> {
  id: string
  label: string
  type: TType
}

export interface CompatiblePortPair<TPort extends ConnectablePort = ConnectablePort> {
  sourcePort: TPort
  targetPort: TPort
}

export function findFirstCompatiblePortPair<TPort extends ConnectablePort>({
  sourceOutputs,
  targetInputs,
  canConnect,
}: {
  sourceOutputs: TPort[]
  targetInputs: TPort[]
  canConnect: (sourceType: TPort['type'], targetType: TPort['type']) => boolean
}): CompatiblePortPair<TPort> | null {
  for (const sourcePort of sourceOutputs) {
    for (const targetPort of targetInputs) {
      if (canConnect(sourcePort.type, targetPort.type)) {
        return { sourcePort, targetPort }
      }
    }
  }

  return null
}

export function wouldCreateDirectedCycle(
  edges: DirectedWorkflowEdge[],
  nextEdge: DirectedWorkflowEdge,
) {
  if (!nextEdge.source || !nextEdge.target) return false
  if (nextEdge.source === nextEdge.target) return true

  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  }

  const visited = new Set<string>()
  const stack = [nextEdge.target]
  while (stack.length > 0) {
    const nodeId = stack.pop()
    if (!nodeId || visited.has(nodeId)) continue
    if (nodeId === nextEdge.source) return true

    visited.add(nodeId)
    stack.push(...(outgoing.get(nodeId) ?? []))
  }

  return false
}

export function replaceEdgesForSingleTargetHandle<TEdge extends TargetInputEdge>(
  edges: TEdge[],
  nextEdge: TEdge,
): TEdge[] {
  return [
    ...edges.filter(
      (edge) =>
        edge.target !== nextEdge.target ||
        normalizeHandle(edge.targetHandle) !== normalizeHandle(nextEdge.targetHandle),
    ),
    nextEdge,
  ]
}

function normalizeHandle(handle: string | null | undefined) {
  return handle ?? ''
}

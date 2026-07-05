export interface DirectedWorkflowEdge {
  source: string
  target: string
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

import type { AgentMemoryUpdatePlan } from './agent-psm-memory-core'

export interface AgentMemoryEvolutionSource {
  id: string
  confidence: number
  importance: number
}

export interface AgentMemoryAppliedUpdate {
  memoryId: string
  previousConfidence: number
  nextConfidence: number
  previousImportance: number
  nextImportance: number
  confidenceDelta: number
  importanceDelta: number
  reason: string
}

export function applyAgentMemoryUpdateDeltas(_args: {
  memories: AgentMemoryEvolutionSource[]
  updates: AgentMemoryUpdatePlan[]
}): AgentMemoryAppliedUpdate[] {
  const memoryById = new Map(_args.memories.map((memory) => [memory.id, memory]))
  return _args.updates.flatMap((update) => {
    const memory = memoryById.get(update.memoryId)
    if (!memory) return []

    const nextConfidence = clamp01(memory.confidence + update.confidenceDelta)
    const nextImportance = clamp01(memory.importance + update.importanceDelta)
    return [{
      memoryId: memory.id,
      previousConfidence: round(memory.confidence),
      nextConfidence,
      previousImportance: round(memory.importance),
      nextImportance,
      confidenceDelta: round(nextConfidence - memory.confidence),
      importanceDelta: round(nextImportance - memory.importance),
      reason: update.reason,
    }]
  })
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return round(Math.max(0, Math.min(1, value)))
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

export type AgentMemoryLearningTraceOutcome = 'succeeded' | 'failed' | 'mixed'

export interface AgentMemoryLearningTraceReflection {
  id: string
  runId: string
  createdAt: number
  whatWorked: string[]
  whatFailed: string[]
}

export interface AgentMemoryLearningTraceMemory {
  sourceRunId: string | null
  title: string
}

export interface AgentMemoryLearningTraceEvent {
  id: string
  runId: string
  reflectionId: string | null
  title: string
  status: string
  createdAt: number
}

export interface AgentMemoryLearningTracePlaybook {
  title: string
  sourceLearningEventId: string | null
}

export interface AgentMemoryLearningTraceItem {
  runId: string
  reflectionId: string
  createdAt: number
  outcome: AgentMemoryLearningTraceOutcome
  whatWorked: string[]
  whatFailed: string[]
  memoryTitles: string[]
  pendingLearningTitles: string[]
  approvedLearningTitles: string[]
  playbookTitles: string[]
}

export function buildAgentMemoryLearningTrace(args: {
  reflections: AgentMemoryLearningTraceReflection[]
  memories: AgentMemoryLearningTraceMemory[]
  learningEvents: AgentMemoryLearningTraceEvent[]
  playbooks: AgentMemoryLearningTracePlaybook[]
  limit?: number
}): AgentMemoryLearningTraceItem[] {
  const limit = Math.max(1, args.limit ?? 5)
  return args.reflections.slice(0, limit).map((reflection) => {
    const relatedEvents = args.learningEvents.filter(
      (event) => event.reflectionId === reflection.id || event.runId === reflection.runId,
    )
    const relatedEventIds = new Set(relatedEvents.map((event) => event.id))
    const relatedMemories = args.memories.filter((memory) => memory.sourceRunId === reflection.runId)
    const relatedPlaybooks = args.playbooks.filter(
      (playbook) => playbook.sourceLearningEventId && relatedEventIds.has(playbook.sourceLearningEventId),
    )

    return {
      runId: reflection.runId,
      reflectionId: reflection.id,
      createdAt: reflection.createdAt,
      outcome: resolveOutcome(reflection),
      whatWorked: normalizeList(reflection.whatWorked),
      whatFailed: normalizeList(reflection.whatFailed),
      memoryTitles: uniqueTitles(relatedMemories.map((memory) => memory.title)),
      pendingLearningTitles: uniqueTitles(
        relatedEvents
          .filter((event) => event.status === 'pending_review')
          .map((event) => event.title),
      ),
      approvedLearningTitles: uniqueTitles(
        relatedEvents
          .filter((event) => event.status === 'approved')
          .map((event) => event.title),
      ),
      playbookTitles: uniqueTitles(relatedPlaybooks.map((playbook) => playbook.title)),
    }
  })
}

function resolveOutcome(reflection: AgentMemoryLearningTraceReflection): AgentMemoryLearningTraceOutcome {
  const hasFailure = normalizeList(reflection.whatFailed).length > 0
  const hasSuccess = normalizeList(reflection.whatWorked).length > 0
  if (hasFailure) return 'failed'
  if (hasSuccess) return 'succeeded'
  return 'mixed'
}

function normalizeList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean)
}

function uniqueTitles(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const title = value.trim()
    if (!title || seen.has(title)) continue
    seen.add(title)
    result.push(title)
  }
  return result
}

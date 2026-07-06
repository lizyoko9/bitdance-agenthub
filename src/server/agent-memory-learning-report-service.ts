import { asc, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentProfileRow,
  JsonObject,
  LearningEventRow,
  MemoryItemRow,
  MemoryScope,
  MemoryType,
  PlaybookRow,
  RunReflectionRow,
} from '@/db/schema'
import {
  buildAgentMemoryLearningTrace,
  type AgentMemoryLearningTraceItem,
} from '@/lib/agent-memory-learning-trace'
import { retrieveRelevantMemories } from '@/server/agent-memory-service'

export type AgentMemoryLearningReadiness = 'ready' | 'needs_review' | 'empty' | 'disabled'

export interface AgentMemoryLearningReport {
  agentProfile: Pick<AgentProfileRow, 'id' | 'name' | 'role' | 'status'>
  readiness: AgentMemoryLearningReadiness
  readinessScore: number
  memoryPolicy: JsonObject
  memorySummary: {
    ownedTotal: number
    activeOwnedTotal: number
    expiredOwnedTotal: number
    byType: Record<MemoryType, number>
    byScope: Record<MemoryScope, number>
    averageConfidence: number
    averageImportance: number
    highImportanceCount: number
    sensitiveCount: number
    encryptedCount: number
    mistakeCount: number
    proceduralCount: number
    semanticCount: number
    expiringSoonCount: number
  }
  retrieval: {
    sampleGoal: string
    enabled: boolean
    candidates: Array<{
      id: string
      title: string
      type: MemoryType
      scope: MemoryScope
      sourceRunId: string | null
      score: number
      matchedTerms: string[]
      confidence: number
      importance: number
    }>
    gaps: string[]
    warnings: string[]
  }
  reflectionSummary: {
    total: number
    latest: Pick<RunReflectionRow, 'id' | 'runId' | 'createdAt'> | null
    reusableProcedureCount: number
    futureWarningCount: number
    suggestedSkillUpdateCount: number
  }
  learningSummary: {
    totalEvents: number
    pendingReview: number
    approved: number
    rejected: number
    latestEvents: Array<Pick<LearningEventRow, 'id' | 'title' | 'type' | 'summary' | 'status' | 'createdAt'>>
    activePlaybooks: number
    draftPlaybooks: number
    archivedPlaybooks: number
    playbookVersionCount: number
    latestPlaybooks: Array<Pick<PlaybookRow, 'id' | 'title' | 'status' | 'updatedAt'>>
  }
  learningTrace: AgentMemoryLearningTraceItem[]
  governance: {
    needsHumanReview: boolean
    sensitiveMemoryTitles: string[]
    mistakeTitles: string[]
    pendingLearningTitles: string[]
    expiringSoonMemoryTitles: string[]
  }
  recommendations: string[]
  generatedAt: number
}

const MEMORY_TYPES: MemoryType[] = [
  'episodic',
  'semantic',
  'procedural',
  'project',
  'customer',
  'software',
  'mistake',
  'success',
]

const MEMORY_SCOPES: MemoryScope[] = ['agent', 'project', 'workspace', 'global']

export async function getAgentMemoryLearningReport(
  agentProfileId: string,
  args: { goal?: string; limit?: number } = {},
): Promise<AgentMemoryLearningReport> {
  const agent = await getRequiredAgentProfile(agentProfileId)
  const now = Date.now()
  const sampleGoal = args.goal?.trim() || defaultSampleGoal(agent)
  const [
    ownedMemories,
    retrievalCandidates,
    reflections,
    learningEvents,
    playbooks,
  ] = await Promise.all([
    db.query.memoryItems.findMany({
      where: eq(schema.memoryItems.agentProfileId, agent.id),
      orderBy: [desc(schema.memoryItems.importance), desc(schema.memoryItems.createdAt)],
      limit: 200,
    }),
    retrieveRelevantMemories({
      agent,
      goal: sampleGoal,
      input: { report: 'memory_learning' },
      limit: args.limit ?? 8,
    }),
    db.query.runReflections.findMany({
      where: eq(schema.runReflections.agentProfileId, agent.id),
      orderBy: [desc(schema.runReflections.createdAt)],
      limit: 100,
    }),
    db.query.learningEvents.findMany({
      where: eq(schema.learningEvents.agentProfileId, agent.id),
      orderBy: [desc(schema.learningEvents.createdAt)],
      limit: 100,
    }),
    db.query.playbooks.findMany({
      where: eq(schema.playbooks.agentProfileId, agent.id),
      orderBy: [desc(schema.playbooks.updatedAt)],
      limit: 100,
    }),
  ])
  const playbookVersionCount = (
    await Promise.all(
      playbooks.map((playbook) =>
        db.query.playbookVersions.findMany({
          where: eq(schema.playbookVersions.playbookId, playbook.id),
          orderBy: [asc(schema.playbookVersions.version)],
        }),
      ),
    )
  ).reduce((sum, versions) => sum + versions.length, 0)
  const memorySummary = buildMemorySummary(ownedMemories, now)
  const retrieval = buildRetrievalSummary({
    agent,
    sampleGoal,
    candidates: retrievalCandidates,
    ownedMemories,
  })
  const reflectionSummary = buildReflectionSummary(reflections)
  const learningSummary = buildLearningSummary({
    learningEvents,
    playbooks,
    playbookVersionCount,
  })
  const learningTrace = buildAgentMemoryLearningTrace({
    reflections: reflections.map((reflection) => ({
      id: reflection.id,
      runId: reflection.runId,
      createdAt: reflection.createdAt,
      whatWorked: reflection.whatWorked,
      whatFailed: reflection.whatFailed,
    })),
    memories: ownedMemories.map((memory) => ({
      sourceRunId: memory.sourceRunId,
      title: memory.title,
    })),
    learningEvents: learningEvents.map((event) => ({
      id: event.id,
      runId: event.runId,
      reflectionId: event.reflectionId,
      title: event.title,
      status: event.status,
      createdAt: event.createdAt,
    })),
    playbooks: playbooks.map((playbook) => ({
      title: playbook.title,
      sourceLearningEventId: playbook.sourceLearningEventId,
    })),
    limit: 5,
  })
  const governance = buildGovernance({
    memories: ownedMemories,
    learningEvents,
    memorySummary,
    now,
  })
  const readiness = resolveReadiness({
    agent,
    memorySummary,
    retrieval,
    learningSummary,
    governance,
  })
  const recommendations = buildRecommendations({
    agent,
    readiness,
    memorySummary,
    retrieval,
    reflectionSummary,
    learningSummary,
    governance,
  })
  return {
    agentProfile: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
    },
    readiness,
    readinessScore: scoreReadiness({
      readiness,
      memorySummary,
      retrieval,
      reflectionSummary,
      learningSummary,
      governance,
    }),
    memoryPolicy: agent.memoryPolicy ?? {},
    memorySummary,
    retrieval,
    reflectionSummary,
    learningSummary,
    learningTrace,
    governance,
    recommendations,
    generatedAt: Date.now(),
  }
}

async function getRequiredAgentProfile(id: string): Promise<AgentProfileRow> {
  const row = await db.query.agentProfiles.findFirst({ where: eq(schema.agentProfiles.id, id) })
  if (!row) throw new Error(`Agent profile not found: ${id}`)
  return row
}

function buildMemorySummary(memories: MemoryItemRow[], now: number): AgentMemoryLearningReport['memorySummary'] {
  const active = memories.filter((memory) => !memory.expiresAt || memory.expiresAt > now)
  const byType = Object.fromEntries(MEMORY_TYPES.map((type) => [type, 0])) as Record<MemoryType, number>
  const byScope = Object.fromEntries(MEMORY_SCOPES.map((scope) => [scope, 0])) as Record<MemoryScope, number>
  for (const memory of memories) {
    byType[memory.type] += 1
    byScope[memory.scope] += 1
  }
  return {
    ownedTotal: memories.length,
    activeOwnedTotal: active.length,
    expiredOwnedTotal: memories.length - active.length,
    byType,
    byScope,
    averageConfidence: roundAverage(memories.map((memory) => memory.confidence)),
    averageImportance: roundAverage(memories.map((memory) => memory.importance)),
    highImportanceCount: memories.filter((memory) => memory.importance >= 0.8).length,
    sensitiveCount: memories.filter((memory) => memory.containsDataTypes.some((type) => type !== 'public_ok')).length,
    encryptedCount: memories.filter((memory) => memory.encryption === 'always_encrypted').length,
    mistakeCount: byType.mistake,
    proceduralCount: byType.procedural,
    semanticCount: byType.semantic,
    expiringSoonCount: memories.filter((memory) =>
      Boolean(memory.expiresAt && memory.expiresAt > now && memory.expiresAt <= now + 30 * 24 * 60 * 60 * 1000),
    ).length,
  }
}

function buildRetrievalSummary(args: {
  agent: AgentProfileRow
  sampleGoal: string
  candidates: Awaited<ReturnType<typeof retrieveRelevantMemories>>
  ownedMemories: MemoryItemRow[]
}): AgentMemoryLearningReport['retrieval'] {
  const enabled = args.agent.memoryPolicy.enabled !== false
  const gaps: string[] = []
  const warnings: string[] = []
  if (!enabled) gaps.push('Memory policy is disabled for this Agent.')
  if (enabled && args.ownedMemories.length === 0) warnings.push('Agent has no owned memories yet.')
  if (enabled && args.candidates.length === 0) warnings.push('Sample retrieval returned no visible memories.')
  if (!readString(args.agent.memoryPolicy.projectId)) {
    warnings.push('memoryPolicy.projectId is not set; project-scoped memory sharing may be broad or implicit.')
  }
  return {
    sampleGoal: args.sampleGoal,
    enabled,
    candidates: args.candidates.map(({ item, score, matchedTerms }) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      scope: item.scope,
      sourceRunId: item.sourceRunId,
      score,
      matchedTerms,
      confidence: item.confidence,
      importance: item.importance,
    })),
    gaps,
    warnings,
  }
}

function buildReflectionSummary(reflections: RunReflectionRow[]): AgentMemoryLearningReport['reflectionSummary'] {
  return {
    total: reflections.length,
    latest: reflections[0]
      ? {
          id: reflections[0].id,
          runId: reflections[0].runId,
          createdAt: reflections[0].createdAt,
        }
      : null,
    reusableProcedureCount: reflections.reduce((sum, row) => sum + row.reusableProcedure.length, 0),
    futureWarningCount: reflections.reduce((sum, row) => sum + row.futureWarnings.length, 0),
    suggestedSkillUpdateCount: reflections.reduce((sum, row) => sum + row.suggestedSkillUpdates.length, 0),
  }
}

function buildLearningSummary(args: {
  learningEvents: LearningEventRow[]
  playbooks: PlaybookRow[]
  playbookVersionCount: number
}): AgentMemoryLearningReport['learningSummary'] {
  return {
    totalEvents: args.learningEvents.length,
    pendingReview: args.learningEvents.filter((event) => event.status === 'pending_review').length,
    approved: args.learningEvents.filter((event) => event.status === 'approved').length,
    rejected: args.learningEvents.filter((event) => event.status === 'rejected').length,
    latestEvents: args.learningEvents.slice(0, 5).map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      summary: event.summary,
      status: event.status,
      createdAt: event.createdAt,
    })),
    activePlaybooks: args.playbooks.filter((playbook) => playbook.status === 'active').length,
    draftPlaybooks: args.playbooks.filter((playbook) => playbook.status === 'draft').length,
    archivedPlaybooks: args.playbooks.filter((playbook) => playbook.status === 'archived').length,
    playbookVersionCount: args.playbookVersionCount,
    latestPlaybooks: args.playbooks.slice(0, 5).map((playbook) => ({
      id: playbook.id,
      title: playbook.title,
      status: playbook.status,
      updatedAt: playbook.updatedAt,
    })),
  }
}

function buildGovernance(args: {
  memories: MemoryItemRow[]
  learningEvents: LearningEventRow[]
  memorySummary: AgentMemoryLearningReport['memorySummary']
  now: number
}): AgentMemoryLearningReport['governance'] {
  const sensitiveMemories = args.memories.filter((memory) =>
    memory.containsDataTypes.some((type) => type !== 'public_ok'),
  )
  const mistakeMemories = args.memories.filter((memory) => memory.type === 'mistake')
  const pendingEvents = args.learningEvents.filter((event) => event.status === 'pending_review')
  const expiringSoon = args.memories.filter((memory) =>
    Boolean(memory.expiresAt && memory.expiresAt > args.now && memory.expiresAt <= args.now + 30 * 24 * 60 * 60 * 1000),
  )
  return {
    needsHumanReview:
      pendingEvents.length > 0 ||
      sensitiveMemories.length > args.memorySummary.encryptedCount ||
      expiringSoon.length > 0,
    sensitiveMemoryTitles: sensitiveMemories.slice(0, 5).map((memory) => memory.title),
    mistakeTitles: mistakeMemories.slice(0, 5).map((memory) => memory.title),
    pendingLearningTitles: pendingEvents.slice(0, 5).map((event) => event.title),
    expiringSoonMemoryTitles: expiringSoon.slice(0, 5).map((memory) => memory.title),
  }
}

function resolveReadiness(args: {
  agent: AgentProfileRow
  memorySummary: AgentMemoryLearningReport['memorySummary']
  retrieval: AgentMemoryLearningReport['retrieval']
  learningSummary: AgentMemoryLearningReport['learningSummary']
  governance: AgentMemoryLearningReport['governance']
}): AgentMemoryLearningReadiness {
  if (args.agent.memoryPolicy.enabled === false) return 'disabled'
  if (
    args.memorySummary.ownedTotal === 0 &&
    args.learningSummary.totalEvents === 0 &&
    args.learningSummary.activePlaybooks === 0
  ) {
    return 'empty'
  }
  if (args.retrieval.gaps.length > 0 || args.governance.needsHumanReview) return 'needs_review'
  return 'ready'
}

function scoreReadiness(args: {
  readiness: AgentMemoryLearningReadiness
  memorySummary: AgentMemoryLearningReport['memorySummary']
  retrieval: AgentMemoryLearningReport['retrieval']
  reflectionSummary: AgentMemoryLearningReport['reflectionSummary']
  learningSummary: AgentMemoryLearningReport['learningSummary']
  governance: AgentMemoryLearningReport['governance']
}): number {
  if (args.readiness === 'disabled') return 0
  const base = args.readiness === 'ready' ? 75 : args.readiness === 'needs_review' ? 60 : 35
  const memoryBonus = Math.min(10, args.memorySummary.activeOwnedTotal * 2)
  const retrievalBonus = Math.min(8, args.retrieval.candidates.length)
  const reflectionBonus = Math.min(5, args.reflectionSummary.total)
  const playbookBonus = Math.min(10, args.learningSummary.activePlaybooks * 5)
  const reviewPenalty = args.governance.needsHumanReview ? 12 : 0
  return Math.max(0, Math.min(100, base + memoryBonus + retrievalBonus + reflectionBonus + playbookBonus - reviewPenalty))
}

function buildRecommendations(args: {
  agent: AgentProfileRow
  readiness: AgentMemoryLearningReadiness
  memorySummary: AgentMemoryLearningReport['memorySummary']
  retrieval: AgentMemoryLearningReport['retrieval']
  reflectionSummary: AgentMemoryLearningReport['reflectionSummary']
  learningSummary: AgentMemoryLearningReport['learningSummary']
  governance: AgentMemoryLearningReport['governance']
}): string[] {
  const recommendations: string[] = []
  if (args.readiness === 'disabled') {
    recommendations.push('Enable memoryPolicy.enabled when this Agent should learn from completed tasks.')
  }
  if (args.memorySummary.ownedTotal === 0) {
    recommendations.push('Seed at least one semantic, procedural, customer, or project memory before assigning long-running work.')
  }
  if (args.retrieval.candidates.length === 0 && args.retrieval.enabled) {
    recommendations.push('Add memories whose title/content match the Agent role, artifact type, customer, or common goals.')
  }
  if (args.reflectionSummary.total === 0) {
    recommendations.push('Run the Agent through the employee runtime so reflections can record what worked, failed, and should be reused.')
  }
  if (args.learningSummary.pendingReview > 0) {
    recommendations.push('Review pending learning events before turning them into active Playbooks.')
  }
  if (args.learningSummary.activePlaybooks === 0) {
    recommendations.push('Approve high-confidence reusable procedures into Playbooks after human review.')
  }
  if (args.memorySummary.mistakeCount > 0) {
    recommendations.push('Keep mistake memories visible during planning so the Agent can avoid repeated failures.')
  }
  if (args.governance.expiringSoonMemoryTitles.length > 0) {
    recommendations.push('Review expiring memories and extend only the ones that are still useful.')
  }
  if (!readString(args.agent.memoryPolicy.projectId)) {
    recommendations.push('Set memoryPolicy.projectId for clearer project-scoped retrieval and sharing boundaries.')
  }
  if (!recommendations.length) {
    recommendations.push('Memory and learning state is ready for runtime retrieval and post-run reflection.')
  }
  return recommendations
}

function defaultSampleGoal(agent: AgentProfileRow): string {
  const artifactType = readString(agent.outputContract.artifactType) ?? 'artifact'
  return `${agent.role} complete a ${artifactType} task for ${agent.name}`
}

function roundAverage(values: number[]): number {
  if (!values.length) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

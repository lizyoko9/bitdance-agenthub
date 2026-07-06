import { asc, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentProfileRow,
  JsonObject,
  LearningEventRow,
  PlaybookRow,
  PlaybookVersionRow,
  RunReflectionRow,
} from '@/db/schema'
import type {
  AgentMemoryApprovalRequest,
  AgentMemoryBlock,
  AgentMemoryEvolutionPlan,
} from '@/lib/agent-psm-memory-core'
import {
  newLearningEventId,
  newPlaybookId,
  newPlaybookVersionId,
} from '@/server/ids'

export interface RuntimeLearningProposal {
  learningEvent: LearningEventRow | null
}

export interface RuntimeLearningProposals extends RuntimeLearningProposal {
  learningEvents: LearningEventRow[]
}

export async function proposeLearningEventFromReflection(args: {
  reflection: RunReflectionRow | null
  agent: AgentProfileRow
}): Promise<RuntimeLearningProposal> {
  if (!args.reflection) return { learningEvent: null }
  const procedure = args.reflection.reusableProcedure[0]
  if (!procedure) return { learningEvent: null }

  const now = Date.now()
  const title = `${args.agent.role} playbook proposal`
  const proposedPlaybook: JsonObject = {
    title,
    description: `Reusable procedure learned from run ${args.reflection.runId}.`,
    steps: args.reflection.reusableProcedure,
    sourceRunId: args.reflection.runId,
    whatWorked: args.reflection.whatWorked,
    futureWarnings: args.reflection.futureWarnings,
  }
  const row = {
    id: newLearningEventId(),
    runId: args.reflection.runId,
    agentProfileId: args.agent.id,
    reflectionId: args.reflection.id,
    type: 'playbook_proposal',
    title,
    summary: procedure,
    proposedPlaybook,
    status: 'pending_review' as const,
    reviewerNote: null,
    createdAt: now,
    reviewedAt: null,
  }

  await db.insert(schema.learningEvents).values(row)
  return { learningEvent: row }
}

export async function proposeLearningEventsFromRuntimeLearning(args: {
  reflection: RunReflectionRow | null
  agent: AgentProfileRow
  memoryEvolution?: AgentMemoryEvolutionPlan | null
}): Promise<RuntimeLearningProposals> {
  if (!args.reflection) return { learningEvent: null, learningEvents: [] }

  const events: LearningEventRow[] = []
  const playbookDraft = args.memoryEvolution?.playbookDraft ?? null

  if (playbookDraft) {
    events.push(await createPsmPlaybookLearningEvent({
      reflection: args.reflection,
      agent: args.agent,
      playbookDraft,
      approvalRequests: findApprovalRequests(args.memoryEvolution, playbookDraft.id),
    }))
  }

  for (const request of args.memoryEvolution?.approvalRequests ?? []) {
    if (playbookDraft && request.kind === 'activate_playbook' && request.targetId === playbookDraft.id) {
      continue
    }
    events.push(await createPsmApprovalLearningEvent({
      reflection: args.reflection,
      agent: args.agent,
      approvalRequest: request,
    }))
  }

  if (events.length > 0) {
    return { learningEvent: events[0], learningEvents: events }
  }

  const fallback = await proposeLearningEventFromReflection({
    reflection: args.reflection,
    agent: args.agent,
  })
  return {
    learningEvent: fallback.learningEvent,
    learningEvents: fallback.learningEvent ? [fallback.learningEvent] : [],
  }
}

export async function listLearningEvents(status?: LearningEventRow['status']): Promise<LearningEventRow[]> {
  return db.query.learningEvents.findMany({
    where: status ? eq(schema.learningEvents.status, status) : undefined,
    orderBy: [desc(schema.learningEvents.createdAt)],
    limit: 100,
  })
}

export async function listLearningEventsForRun(runId: string): Promise<LearningEventRow[]> {
  return db.query.learningEvents.findMany({
    where: eq(schema.learningEvents.runId, runId),
    orderBy: [asc(schema.learningEvents.createdAt)],
  })
}

export async function approveLearningEvent(
  learningEventId: string,
  reviewerNote = '',
): Promise<{
  learningEvent: LearningEventRow
  playbook: PlaybookRow | null
  playbookVersion: PlaybookVersionRow | null
}> {
  const event = await getRequiredLearningEvent(learningEventId)
  if (event.status !== 'pending_review') {
    throw new Error(`Only pending learning events can be approved; current status is ${event.status}.`)
  }
  const now = Date.now()
  if (!createsPlaybookOnApproval(event)) {
    await markLearningEventReviewed(event.id, 'approved', reviewerNote, now)
    return {
      learningEvent: await getRequiredLearningEvent(event.id),
      playbook: null,
      playbookVersion: null,
    }
  }

  const title = getString(event.proposedPlaybook, 'title') ?? event.title
  const description = getString(event.proposedPlaybook, 'description') ?? event.summary
  const steps = getStringArray(event.proposedPlaybook, 'steps')
  const playbook = {
    id: newPlaybookId(),
    agentProfileId: event.agentProfileId,
    title,
    description,
    status: 'active' as const,
    sourceLearningEventId: event.id,
    createdAt: now,
    updatedAt: now,
  }
  const version = {
    id: newPlaybookVersionId(),
    playbookId: playbook.id,
    version: 1,
    content: buildPlaybookContent(event, steps),
    steps,
    sourceRunId: event.runId,
    createdAt: now,
  }

  await db.insert(schema.playbooks).values(playbook)
  await db.insert(schema.playbookVersions).values(version)
  await markLearningEventReviewed(event.id, 'approved', reviewerNote, now)
  return {
    learningEvent: await getRequiredLearningEvent(event.id),
    playbook,
    playbookVersion: version,
  }
}

export async function rejectLearningEvent(
  learningEventId: string,
  reviewerNote = '',
): Promise<LearningEventRow> {
  const event = await getRequiredLearningEvent(learningEventId)
  if (event.status !== 'pending_review') {
    throw new Error(`Only pending learning events can be rejected; current status is ${event.status}.`)
  }
  await markLearningEventReviewed(learningEventId, 'rejected', reviewerNote, Date.now())
  return getRequiredLearningEvent(learningEventId)
}

async function createPsmPlaybookLearningEvent(args: {
  reflection: RunReflectionRow
  agent: AgentProfileRow
  playbookDraft: AgentMemoryBlock
  approvalRequests: AgentMemoryApprovalRequest[]
}): Promise<LearningEventRow> {
  const now = Date.now()
  const summary =
    args.approvalRequests[0]?.reason ??
    firstMeaningfulLine(args.playbookDraft.content) ??
    `Review work manual draft from run ${args.reflection.runId}.`
  const proposedPlaybook: JsonObject = {
    source: 'agent_psm_evolution',
    title: args.playbookDraft.title,
    description: `这个 Agent 从运行 ${args.reflection.runId} 里沉淀了工作手册草稿，审核后才能成为长期经验。`,
    steps: parsePlaybookSteps(args.playbookDraft, args.reflection),
    sourceRunId: args.reflection.runId,
    memoryBlockId: args.playbookDraft.id,
    memoryScope: args.playbookDraft.scope,
    memoryType: args.playbookDraft.type,
    reviewStatus: args.playbookDraft.reviewStatus,
    approvalRequests: args.approvalRequests as unknown as JsonObject[],
    whatWorked: args.reflection.whatWorked,
    futureWarnings: args.reflection.futureWarnings,
  }
  return insertLearningEvent({
    runId: args.reflection.runId,
    agentProfileId: args.agent.id,
    reflectionId: args.reflection.id,
    type: 'playbook_proposal',
    title: args.playbookDraft.title,
    summary,
    proposedPlaybook,
    createdAt: now,
  })
}

async function createPsmApprovalLearningEvent(args: {
  reflection: RunReflectionRow
  agent: AgentProfileRow
  approvalRequest: AgentMemoryApprovalRequest
}): Promise<LearningEventRow> {
  const proposedPlaybook: JsonObject = {
    source: 'agent_psm_evolution',
    kind: args.approvalRequest.kind,
    targetId: args.approvalRequest.targetId,
    reason: args.approvalRequest.reason,
    sourceRunId: args.reflection.runId,
    privateFirst: true,
    reviewBeforeSharing: true,
    newKnowledge: args.reflection.newKnowledge,
    futureWarnings: args.reflection.futureWarnings,
  }
  return insertLearningEvent({
    runId: args.reflection.runId,
    agentProfileId: args.agent.id,
    reflectionId: args.reflection.id,
    type: args.approvalRequest.kind === 'share_memory'
      ? 'memory_share_review'
      : 'psm_approval_review',
    title: args.approvalRequest.kind === 'share_memory'
      ? 'Agent 记忆共享审核'
      : 'Agent 学习审核',
    summary: args.approvalRequest.reason,
    proposedPlaybook,
    createdAt: Date.now(),
  })
}

async function insertLearningEvent(args: {
  runId: string
  agentProfileId: string
  reflectionId: string
  type: string
  title: string
  summary: string
  proposedPlaybook: JsonObject
  createdAt: number
}): Promise<LearningEventRow> {
  const row = {
    id: newLearningEventId(),
    runId: args.runId,
    agentProfileId: args.agentProfileId,
    reflectionId: args.reflectionId,
    type: args.type,
    title: args.title,
    summary: args.summary,
    proposedPlaybook: args.proposedPlaybook,
    status: 'pending_review' as const,
    reviewerNote: null,
    createdAt: args.createdAt,
    reviewedAt: null,
  }
  await db.insert(schema.learningEvents).values(row)
  return row
}

export async function listPlaybooks(agentProfileId?: string): Promise<PlaybookRow[]> {
  return db.query.playbooks.findMany({
    where: agentProfileId ? eq(schema.playbooks.agentProfileId, agentProfileId) : undefined,
    orderBy: [desc(schema.playbooks.updatedAt)],
    limit: 100,
  })
}

export async function listPlaybookVersions(playbookId: string): Promise<PlaybookVersionRow[]> {
  return db.query.playbookVersions.findMany({
    where: eq(schema.playbookVersions.playbookId, playbookId),
    orderBy: [desc(schema.playbookVersions.version)],
  })
}

async function getRequiredLearningEvent(id: string): Promise<LearningEventRow> {
  const row = await db.query.learningEvents.findFirst({
    where: eq(schema.learningEvents.id, id),
  })
  if (!row) throw new Error(`Learning event not found: ${id}`)
  return row
}

function buildPlaybookContent(event: LearningEventRow, steps: string[]): string {
  return [
    `# ${getString(event.proposedPlaybook, 'title') ?? event.title}`,
    '',
    getString(event.proposedPlaybook, 'description') ?? event.summary,
    '',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n')
}

function getString(obj: JsonObject, key: string): string | null {
  const value = obj[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getStringArray(obj: JsonObject, key: string): string[] {
  const value = obj[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

async function markLearningEventReviewed(
  learningEventId: string,
  status: 'approved' | 'rejected',
  reviewerNote: string,
  reviewedAt: number,
): Promise<void> {
  await db
    .update(schema.learningEvents)
    .set({
      status,
      reviewerNote: reviewerNote.trim() || null,
      reviewedAt,
    })
    .where(eq(schema.learningEvents.id, learningEventId))
}

function createsPlaybookOnApproval(event: LearningEventRow): boolean {
  return event.type === 'playbook_proposal'
}

function findApprovalRequests(
  memoryEvolution: AgentMemoryEvolutionPlan | null | undefined,
  targetId: string,
): AgentMemoryApprovalRequest[] {
  return (memoryEvolution?.approvalRequests ?? []).filter((request) => request.targetId === targetId)
}

function parsePlaybookSteps(playbookDraft: AgentMemoryBlock, reflection: RunReflectionRow): string[] {
  const contentSteps = playbookDraft.content
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/u, '').trim())
    .filter(Boolean)
  return contentSteps.length > 0 ? contentSteps : reflection.reusableProcedure
}

function firstMeaningfulLine(value: string): string | null {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean) ?? null
}

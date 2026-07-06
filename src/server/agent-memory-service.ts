import { desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentProfileRow,
  EmployeeRunRow,
  JsonObject,
  MemoryItemRow,
  MemoryPrivacyDataType,
  MemoryPrivacyEncryption,
  MemoryPrivacyReadAccess,
  MemoryPrivacyWriteAccess,
  RunReflectionRow,
} from '@/db/schema'
import {
  compileAgentMemoryContextPack,
  extractAgentMemoryCues,
  recallAgentMemories,
  type AgentMemoryBlock,
  type AgentMemoryContextPack,
  type AgentMemoryEvolutionPlan,
  type AgentMemoryRecallResult,
} from '@/lib/agent-psm-memory-core'
import { buildRuntimeAgentLearningPlan } from '@/lib/agent-memory-runtime-learning'
import { newMemoryItemId, newRunReflectionId } from '@/server/ids'

export interface RetrievedMemory {
  item: MemoryItemRow
  score: number
  matchedTerms: string[]
}

export interface RuntimeMemoryContext {
  memories: RetrievedMemory[]
  contextPack?: AgentMemoryContextPack
}

export interface RuntimeLearningResult {
  reflection: RunReflectionRow | null
  memoryItem: MemoryItemRow | null
  memoryEvolution?: AgentMemoryEvolutionPlan
}

export async function retrieveRelevantMemories(args: {
  agent: AgentProfileRow
  goal: string
  input?: JsonObject
  limit?: number
}): Promise<RetrievedMemory[]> {
  if (isMemoryDisabled(args.agent)) return []

  const candidates = await db.query.memoryItems.findMany({
    orderBy: [desc(schema.memoryItems.importance), desc(schema.memoryItems.createdAt)],
    limit: 200,
  })
  const agentProfiles = await db.query.agentProfiles.findMany()
  const agentById = new Map(agentProfiles.map((profile) => [profile.id, profile]))
  const now = Date.now()
  const terms = buildSearchTerms(args.agent, args.goal, args.input ?? {})
  const artifactType = getString(args.agent.outputContract, 'artifactType')
  const cuePack = extractAgentMemoryCues({
    goal: args.goal,
    explicitCues: [...terms],
    tags: [args.agent.role, artifactType ?? ''].filter(Boolean),
  })

  const visibleItems = candidates.filter((item) => memoryVisibleToAgent(item, args.agent, agentById, now))
  const itemByMemoryId = new Map(visibleItems.map((item) => [item.id, item]))
  const memoryBlocks = visibleItems.map((item) => toAgentMemoryBlock({
    item,
    agent: args.agent,
    agentById,
    now,
  }))
  return recallAgentMemories(
    {
      agentId: args.agent.id,
      projectId: getString(args.agent.memoryPolicy, 'projectId') ?? undefined,
      teamId: getString(args.agent.memoryPolicy, 'teamId') ?? undefined,
      goal: args.goal,
      cues: cuePack.cues,
      tags: cuePack.tags,
      now,
    },
    memoryBlocks,
    [],
    { limit: args.limit ?? 8 },
  ).map((result) => ({
    item: itemByMemoryId.get(result.memory.id) as MemoryItemRow,
    score: result.score,
    matchedTerms: [...new Set([...result.matchedCues, ...result.matchedTags])],
  }))
}

export async function reflectAndLearn(args: {
  run: EmployeeRunRow
  agent: AgentProfileRow
  retrievedMemories: RetrievedMemory[]
}): Promise<RuntimeLearningResult> {
  if (isMemoryDisabled(args.agent)) return { reflection: null, memoryItem: null }

  const artifactType = getString(args.agent.outputContract, 'artifactType') ?? 'artifact'
  const learningPlan = buildRuntimeAgentLearningPlan({
    runId: args.run.id,
    agentId: args.agent.id,
    projectId: getString(args.agent.memoryPolicy, 'projectId') ?? undefined,
    role: args.agent.role,
    goal: args.run.goal,
    status: args.run.status,
    error: args.run.error,
    artifactType,
    retrievedMemoryIds: args.retrievedMemories.map(({ item }) => item.id),
  })
  const reflection = await createRunReflection({
    runId: args.run.id,
    agentProfileId: args.agent.id,
    whatWorked: learningPlan.reflection.whatWorked,
    whatFailed: learningPlan.reflection.whatFailed,
    newKnowledge: learningPlan.reflection.newKnowledge,
    reusableProcedure: learningPlan.reflection.reusableProcedure,
    suggestedSkillUpdates: learningPlan.reflection.suggestedSkillUpdates,
    futureWarnings: [
      ...learningPlan.reflection.futureWarnings,
      ...args.retrievedMemories
        .filter(({ item }) => item.type === 'mistake')
        .map(({ item }) => item.title),
    ],
  })

  const memoryItem = await createMemoryItem({
    agentProfileId: args.agent.id,
    scope: learningPlan.primaryMemoryDraft.scope,
    type: learningPlan.primaryMemoryDraft.type,
    title: learningPlan.primaryMemoryDraft.title,
    content: learningPlan.primaryMemoryDraft.content,
    sourceRunId: args.run.id,
    confidence: learningPlan.primaryMemoryDraft.confidence,
    importance: learningPlan.primaryMemoryDraft.importance,
  })

  return { reflection, memoryItem, memoryEvolution: learningPlan.evolution }
}

export function compileRuntimeMemoryContextPack(args: {
  agent: AgentProfileRow
  goal: string
  input?: JsonObject
  retrievedMemories: RetrievedMemory[]
  now?: number
}): AgentMemoryContextPack {
  const now = args.now ?? Date.now()
  const terms = buildSearchTerms(args.agent, args.goal, args.input ?? {})
  const artifactType = getString(args.agent.outputContract, 'artifactType')
  const cuePack = extractAgentMemoryCues({
    goal: args.goal,
    explicitCues: [...terms],
    tags: [args.agent.role, artifactType ?? ''].filter(Boolean),
  })
  const agentById = new Map([[args.agent.id, args.agent]])
  const recalledMemories: AgentMemoryRecallResult[] = args.retrievedMemories.map((retrieved) => {
    const memory = toAgentMemoryBlock({
      item: retrieved.item,
      agent: args.agent,
      agentById,
      now,
    })
    return {
      memory,
      score: retrieved.score,
      matchedCues: retrieved.matchedTerms,
      matchedTags: [],
      reasons: retrieved.matchedTerms.length
        ? [`匹配线索: ${retrieved.matchedTerms.join(', ')}`]
        : [],
    }
  })

  return compileAgentMemoryContextPack(
    {
      agentId: args.agent.id,
      projectId: getString(args.agent.memoryPolicy, 'projectId') ?? undefined,
      teamId: getString(args.agent.memoryPolicy, 'teamId') ?? undefined,
      goal: args.goal,
      cues: cuePack.cues,
      tags: cuePack.tags,
      now,
    },
    recalledMemories,
  )
}

export async function listMemoryForRun(runId: string): Promise<MemoryItemRow[]> {
  return db.query.memoryItems.findMany({
    where: eq(schema.memoryItems.sourceRunId, runId),
    orderBy: [desc(schema.memoryItems.importance), desc(schema.memoryItems.createdAt)],
  })
}

export async function listMemoryForAgent(agentProfileId: string): Promise<MemoryItemRow[]> {
  return db.query.memoryItems.findMany({
    where: eq(schema.memoryItems.agentProfileId, agentProfileId),
    orderBy: [desc(schema.memoryItems.importance), desc(schema.memoryItems.createdAt)],
  })
}

export async function listMemoryItems(args: {
  agentProfileId?: string
  sourceRunId?: string
  scope?: MemoryItemRow['scope']
  type?: MemoryItemRow['type']
  limit?: number
} = {}): Promise<MemoryItemRow[]> {
  const rows = await db.query.memoryItems.findMany({
    orderBy: [desc(schema.memoryItems.importance), desc(schema.memoryItems.createdAt)],
    limit: args.limit ?? 100,
  })
  return rows.filter((row) => {
    if (args.agentProfileId && row.agentProfileId !== args.agentProfileId) return false
    if (args.sourceRunId && row.sourceRunId !== args.sourceRunId) return false
    if (args.scope && row.scope !== args.scope) return false
    if (args.type && row.type !== args.type) return false
    return true
  })
}

export async function getRunReflection(runId: string): Promise<RunReflectionRow | null> {
  return (
    (await db.query.runReflections.findFirst({
      where: eq(schema.runReflections.runId, runId),
      orderBy: [desc(schema.runReflections.createdAt)],
    })) ?? null
  )
}

export async function createMemoryItem(args: {
  agentProfileId?: string | null
  scope: MemoryItemRow['scope']
  type: MemoryItemRow['type']
  title: string
  content: string
  sourceRunId?: string | null
  embedding?: number[] | null
  confidence?: number
  importance?: number
  expiresAt?: number | null
  readAccess?: MemoryPrivacyReadAccess
  writeAccess?: MemoryPrivacyWriteAccess
  encryption?: MemoryPrivacyEncryption
  containsDataTypes?: MemoryPrivacyDataType[]
}): Promise<MemoryItemRow> {
  const now = Date.now()
  const containsDataTypes = normalizeDataTypes(args.containsDataTypes)
  const encryption = normalizeEncryption(args.encryption, containsDataTypes)
  const row = {
    id: newMemoryItemId(),
    agentProfileId: normalizeNullable(args.agentProfileId),
    scope: args.scope,
    type: args.type,
    title: args.title.trim(),
    content: args.content.trim(),
    sourceRunId: normalizeNullable(args.sourceRunId),
    embedding: args.embedding ?? null,
    confidence: args.confidence ?? 1,
    importance: args.importance ?? 0.5,
    readAccess: args.readAccess ?? defaultReadAccess(args.scope),
    writeAccess: args.writeAccess ?? 'only_me',
    encryption,
    containsDataTypes,
    createdAt: now,
    updatedAt: now,
    expiresAt: args.expiresAt ?? null,
  }
  await db.insert(schema.memoryItems).values(row)
  return row
}

export async function updateMemoryItem(
  id: string,
  patch: Partial<{
    agentProfileId: string | null
    scope: MemoryItemRow['scope']
    type: MemoryItemRow['type']
    title: string
    content: string
    sourceRunId: string | null
    embedding: number[] | null
    confidence: number
    importance: number
    expiresAt: number | null
    readAccess: MemoryPrivacyReadAccess
    writeAccess: MemoryPrivacyWriteAccess
    encryption: MemoryPrivacyEncryption
    containsDataTypes: MemoryPrivacyDataType[]
  }>,
): Promise<MemoryItemRow> {
  const existing = await getRequiredMemoryItem(id)
  const containsDataTypes = patch.containsDataTypes
    ? normalizeDataTypes(patch.containsDataTypes)
    : existing.containsDataTypes
  const encryption = patch.encryption
    ? normalizeEncryption(patch.encryption, containsDataTypes)
    : existing.encryption
  await db
    .update(schema.memoryItems)
    .set({
      agentProfileId: patch.agentProfileId !== undefined
        ? normalizeNullable(patch.agentProfileId)
        : existing.agentProfileId,
      scope: patch.scope ?? existing.scope,
      type: patch.type ?? existing.type,
      title: patch.title !== undefined ? patch.title.trim() : existing.title,
      content: patch.content !== undefined ? patch.content.trim() : existing.content,
      sourceRunId: patch.sourceRunId !== undefined ? normalizeNullable(patch.sourceRunId) : existing.sourceRunId,
      embedding: patch.embedding !== undefined ? patch.embedding : existing.embedding,
      confidence: patch.confidence ?? existing.confidence,
      importance: patch.importance ?? existing.importance,
      readAccess: patch.readAccess ?? existing.readAccess,
      writeAccess: patch.writeAccess ?? existing.writeAccess,
      encryption,
      containsDataTypes,
      expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
      updatedAt: Date.now(),
    })
    .where(eq(schema.memoryItems.id, id))
  return getRequiredMemoryItem(id)
}

export async function deleteMemoryItem(id: string): Promise<{ deleted: true; memoryItem: MemoryItemRow }> {
  const memoryItem = await getRequiredMemoryItem(id)
  await db.delete(schema.memoryItems).where(eq(schema.memoryItems.id, id))
  return { deleted: true, memoryItem }
}

export async function evaluateMemoryPrivacyAccess(args: {
  memoryItemId: string
  agentProfileId?: string | null
  operation?: 'read' | 'write'
  actorType?: 'agent' | 'user' | 'team_lead'
}): Promise<{
  allowed: boolean
  reason: string
  readAccess: MemoryPrivacyReadAccess
  writeAccess: MemoryPrivacyWriteAccess
  encryption: MemoryPrivacyEncryption
  containsDataTypes: MemoryPrivacyDataType[]
}> {
  const item = await db.query.memoryItems.findFirst({
    where: eq(schema.memoryItems.id, args.memoryItemId),
  })
  if (!item) throw new Error(`Memory item not found: ${args.memoryItemId}`)
  const agent = args.agentProfileId
    ? await db.query.agentProfiles.findFirst({
        where: eq(schema.agentProfiles.id, args.agentProfileId),
      })
    : null
  const profiles = await db.query.agentProfiles.findMany()
  const agentById = new Map(profiles.map((profile) => [profile.id, profile]))
  const operation = args.operation ?? 'read'
  const actorType = args.actorType ?? (agent ? 'agent' : 'user')
  const allowed =
    operation === 'read'
      ? actorType === 'user' || (agent ? memoryVisibleToAgent(item, agent, agentById, Date.now()) : false)
      : memoryWritableByActor(item, actorType, agent?.id ?? null)
  return {
    allowed,
    reason: allowed
      ? `${operation} allowed by memory privacy policy.`
      : `${operation} blocked by memory privacy policy.`,
    readAccess: item.readAccess,
    writeAccess: item.writeAccess,
    encryption: item.encryption,
    containsDataTypes: item.containsDataTypes,
  }
}

async function getRequiredMemoryItem(id: string): Promise<MemoryItemRow> {
  const row = await db.query.memoryItems.findFirst({
    where: eq(schema.memoryItems.id, id),
  })
  if (!row) throw new Error(`Memory item not found: ${id}`)
  return row
}

export async function createRunReflection(args: {
  runId: string
  agentProfileId?: string | null
  whatWorked?: string[]
  whatFailed?: string[]
  newKnowledge?: string[]
  reusableProcedure?: string[]
  suggestedSkillUpdates?: string[]
  futureWarnings?: string[]
}): Promise<RunReflectionRow> {
  const row = {
    id: newRunReflectionId(),
    runId: args.runId,
    agentProfileId: normalizeNullable(args.agentProfileId),
    whatWorked: args.whatWorked ?? [],
    whatFailed: args.whatFailed ?? [],
    newKnowledge: args.newKnowledge ?? [],
    reusableProcedure: args.reusableProcedure ?? [],
    suggestedSkillUpdates: args.suggestedSkillUpdates ?? [],
    futureWarnings: args.futureWarnings ?? [],
    createdAt: Date.now(),
  }
  await db.insert(schema.runReflections).values(row)
  return row
}

function memoryVisibleToAgent(
  item: MemoryItemRow,
  agent: AgentProfileRow,
  agentById: Map<string, AgentProfileRow>,
  now: number,
): boolean {
  if (item.expiresAt && item.expiresAt <= now) return false
  if (item.readAccess === 'user_only') return false
  if (item.readAccess === 'only_me') return item.agentProfileId === agent.id
  if (item.readAccess === 'my_role') {
    if (item.agentProfileId === agent.id) return true
    const owner = item.agentProfileId ? agentById.get(item.agentProfileId) : null
    return Boolean(owner && owner.role === agent.role)
  }
  if (item.readAccess === 'my_team') {
    if (item.agentProfileId === agent.id) return true
    const owner = item.agentProfileId ? agentById.get(item.agentProfileId) : null
    return Boolean(owner && getString(owner.memoryPolicy, 'teamId') && getString(owner.memoryPolicy, 'teamId') === getString(agent.memoryPolicy, 'teamId'))
  }
  if (item.readAccess === 'project') {
    if (item.agentProfileId === agent.id) return true
    const owner = item.agentProfileId ? agentById.get(item.agentProfileId) : null
    const agentProjectId = getString(agent.memoryPolicy, 'projectId')
    const ownerProjectId = owner ? getString(owner.memoryPolicy, 'projectId') : null
    return Boolean(
      item.scope === 'project' ||
        item.scope === 'workspace' ||
        (agentProjectId && ownerProjectId && agentProjectId === ownerProjectId),
    )
  }
  return true
}

function memoryWritableByActor(
  item: MemoryItemRow,
  actorType: 'agent' | 'user' | 'team_lead',
  agentProfileId: string | null,
): boolean {
  if (item.writeAccess === 'user') return actorType === 'user'
  if (item.writeAccess === 'team_lead') return actorType === 'team_lead' || actorType === 'user'
  return actorType === 'agent' && Boolean(agentProfileId) && item.agentProfileId === agentProfileId
}

function defaultReadAccess(scope: MemoryItemRow['scope']): MemoryPrivacyReadAccess {
  if (scope === 'agent') return 'only_me'
  if (scope === 'project') return 'project'
  return 'organization'
}

function normalizeDataTypes(values: MemoryPrivacyDataType[] | undefined): MemoryPrivacyDataType[] {
  const allowed: MemoryPrivacyDataType[] = [
    'pii',
    'credentials',
    'business_secret',
    'customer_data',
    'internal_only',
    'public_ok',
  ]
  return [...new Set((values ?? []).filter((value): value is MemoryPrivacyDataType => allowed.includes(value)))]
}

function normalizeEncryption(
  requested: MemoryPrivacyEncryption | undefined,
  dataTypes: MemoryPrivacyDataType[],
): MemoryPrivacyEncryption {
  if (dataTypes.some((type) => ['pii', 'credentials', 'business_secret', 'customer_data'].includes(type))) {
    return 'always_encrypted'
  }
  return requested ?? 'at_rest'
}

function buildSearchTerms(agent: AgentProfileRow, goal: string, input: JsonObject): Set<string> {
  const artifactType = getString(agent.outputContract, 'artifactType')
  const raw = [
    agent.name,
    agent.role,
    agent.description,
    goal,
    artifactType ?? '',
    ...Object.keys(input),
    ...Object.values(input).filter((value): value is string => typeof value === 'string'),
  ].join(' ')
  return new Set(
    raw
      .toLowerCase()
      .split(/[^a-z0-9_\u4e00-\u9fff]+/iu)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2),
  )
}

function toAgentMemoryBlock(args: {
  item: MemoryItemRow
  agent: AgentProfileRow
  agentById: Map<string, AgentProfileRow>
  now: number
}): AgentMemoryBlock {
  const owner = args.item.agentProfileId ? args.agentById.get(args.item.agentProfileId) : null
  const agentProjectId = getString(args.agent.memoryPolicy, 'projectId') ?? undefined
  const ownerProjectId = owner ? getString(owner.memoryPolicy, 'projectId') ?? undefined : undefined
  const agentTeamId = getString(args.agent.memoryPolicy, 'teamId') ?? undefined
  const ownerTeamId = owner ? getString(owner.memoryPolicy, 'teamId') ?? undefined : undefined
  return {
    id: args.item.id,
    agentId: args.item.agentProfileId ?? args.agent.id,
    projectId: ownerProjectId ?? agentProjectId,
    teamId: ownerTeamId ?? agentTeamId,
    scope: mapMemoryScope(args.item.scope),
    type: mapMemoryType(args.item.type),
    title: args.item.title,
    content: args.item.content,
    cues: buildMemoryBlockCues(args.item),
    tags: [args.item.type, args.item.scope],
    importance: args.item.importance,
    confidence: args.item.confidence,
    successCount: args.item.type === 'success' ? 1 : 0,
    failureCount: args.item.type === 'mistake' ? 1 : 0,
    reviewStatus: args.item.scope === 'agent' ? 'private' : 'approved_for_sharing',
    sourceRunId: args.item.sourceRunId ?? undefined,
    createdAt: args.item.createdAt,
    updatedAt: args.item.updatedAt,
    lastActivatedAt: args.item.updatedAt || args.now,
  }
}

function buildMemoryBlockCues(item: MemoryItemRow): string[] {
  return [
    ...tokenizeMemoryText(`${item.title} ${item.content}`),
    item.type,
    item.scope,
  ]
}

function tokenizeMemoryText(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9_\u4e00-\u9fff]+/iu)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  ]
}

function mapMemoryScope(scope: MemoryItemRow['scope']): AgentMemoryBlock['scope'] {
  if (scope === 'agent') return 'agent_private'
  if (scope === 'project') return 'project_shared'
  if (scope === 'workspace') return 'team_shared'
  return 'global_tool'
}

function mapMemoryType(type: MemoryItemRow['type']): AgentMemoryBlock['type'] {
  if (type === 'episodic') return 'task'
  if (type === 'procedural') return 'playbook'
  if (type === 'project') return 'project_knowledge'
  if (type === 'customer') return 'user_preference'
  if (type === 'software') return 'tool_usage'
  if (type === 'mistake') return 'failure_lesson'
  return 'experience'
}

function isMemoryDisabled(agent: AgentProfileRow): boolean {
  return agent.memoryPolicy.enabled === false
}

function getString(obj: JsonObject, key: string): string | null {
  const value = obj[key]
  return typeof value === 'string' ? value : null
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

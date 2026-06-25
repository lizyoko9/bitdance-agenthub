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
import { newMemoryItemId, newRunReflectionId } from '@/server/ids'

export interface RetrievedMemory {
  item: MemoryItemRow
  score: number
  matchedTerms: string[]
}

export interface RuntimeMemoryContext {
  memories: RetrievedMemory[]
}

export interface RuntimeLearningResult {
  reflection: RunReflectionRow | null
  memoryItem: MemoryItemRow | null
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

  return candidates
    .filter((item) => memoryVisibleToAgent(item, args.agent, agentById, now))
    .map((item) => scoreMemory(item, terms))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || b.item.importance - a.item.importance)
    .slice(0, args.limit ?? 8)
}

export async function reflectAndLearn(args: {
  run: EmployeeRunRow
  agent: AgentProfileRow
  retrievedMemories: RetrievedMemory[]
}): Promise<RuntimeLearningResult> {
  if (isMemoryDisabled(args.agent)) return { reflection: null, memoryItem: null }

  const artifactType = getString(args.agent.outputContract, 'artifactType') ?? 'artifact'
  const reflection = await createRunReflection({
    runId: args.run.id,
    agentProfileId: args.agent.id,
    whatWorked: [
      `Completed deterministic runtime lifecycle for ${args.agent.role}.`,
      `Verified required ${artifactType} output contract before finishing.`,
    ],
    whatFailed: args.run.error ? [args.run.error] : [],
    newKnowledge: [
      `Goal handled: ${args.run.goal}`,
      `Retrieved ${args.retrievedMemories.length} relevant memories before planning.`,
    ],
    reusableProcedure: [
      `For ${args.agent.role} tasks, retrieve memory, derive a plan, verify the ${artifactType} contract, then checkpoint before handoff.`,
    ],
    suggestedSkillUpdates: [],
    futureWarnings: args.retrievedMemories
      .filter(({ item }) => item.type === 'mistake')
      .map(({ item }) => item.title),
  })

  const memoryItem = await createMemoryItem({
    agentProfileId: args.agent.id,
    scope: 'agent',
    type: args.run.error ? 'mistake' : 'procedural',
    title: `${args.agent.role}: ${truncate(args.run.goal, 80)}`,
    content: [
      `Goal: ${args.run.goal}`,
      `Outcome: ${args.run.status}`,
      `Procedure: retrieve memory -> plan -> verify output contract -> checkpoint -> handoff.`,
      `Required artifact: ${artifactType}.`,
    ].join('\n'),
    sourceRunId: args.run.id,
    confidence: args.run.error ? 0.65 : 0.9,
    importance: args.run.error ? 0.85 : 0.72,
  })

  return { reflection, memoryItem }
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

function scoreMemory(item: MemoryItemRow, terms: Set<string>): RetrievedMemory {
  const text = `${item.title} ${item.content} ${item.type} ${item.scope}`.toLowerCase()
  const matchedTerms = [...terms].filter((term) => text.includes(term))
  const typeBoost = item.type === 'mistake' || item.type === 'procedural' ? 0.75 : 0
  const scopeBoost = item.scope === 'agent' ? 0.4 : item.scope === 'project' ? 0.25 : 0
  const score = matchedTerms.length + item.importance + item.confidence + typeBoost + scopeBoost
  return { item, score, matchedTerms }
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

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`
}

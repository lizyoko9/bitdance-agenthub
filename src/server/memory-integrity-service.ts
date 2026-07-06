import { and, desc, eq, type SQL } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  JsonObject,
  MemoryIntegrityDecision,
  MemoryIntegrityEvaluationRow,
  MemoryIntegrityPolicy,
  MemoryIntegrityPolicyRow,
  MemoryIntegrityPolicyStatus,
  MemoryIntegritySourceType,
  MemoryItemRow,
} from '@/db/schema'
import { newMemoryIntegrityEvaluationId, newMemoryIntegrityPolicyId } from '@/server/ids'

export interface CreateMemoryIntegrityPolicyArgs {
  name?: string
  status?: MemoryIntegrityPolicyStatus
  policy?: PartialMemoryIntegrityPolicy
}

export interface EvaluateMemoryBeforeWriteArgs {
  policyId?: string
  agentProfileId?: string | null
  memoryItemId?: string | null
  sourceType: MemoryIntegritySourceType
  title: string
  content: string
  requestedConfidence?: number
}

export interface ScanMemoryIntegrityArgs {
  policyId?: string
  agentProfileId?: string
  limit?: number
}

type PartialMemoryBeforeWritePolicy = Omit<
  Partial<MemoryIntegrityPolicy['beforeWrite']>,
  'sourceConfidenceMap'
> & {
  sourceConfidenceMap?: Partial<Record<MemoryIntegritySourceType, number>>
}

type PartialMemoryIntegrityPolicy = {
  beforeWrite?: PartialMemoryBeforeWritePolicy
  periodicScan?: Partial<MemoryIntegrityPolicy['periodicScan']>
}

const DEFAULT_POLICY_NAME = 'Default memory integrity guard'

const defaultPolicy: MemoryIntegrityPolicy = {
  beforeWrite: {
    sourceConfidenceMap: {
      agent_direct_observation: 0.9,
      user_explicit_instruction: 0.95,
      external_web_content: 0.4,
      inferred_from_task: 0.6,
      other_agent_shared: 0.7,
      external_file: 0.5,
    },
    dangerousPatterns: [
      'hardcode.*(password|api key|secret)',
      'ignore.*ssl.*verif',
      'disable.*security',
      'commit.*secret',
      'bypass.*auth',
    ],
    onDangerousPattern: 'block_and_alert',
    minimumAllowedConfidence: 0.65,
  },
  periodicScan: {
    intervalDays: 7,
    lowConfidenceThreshold: 0.65,
    contradictionScan: true,
  },
}

export async function seedMemoryIntegrityPolicy(): Promise<MemoryIntegrityPolicyRow> {
  const existing = await db.query.memoryIntegrityPolicies.findFirst({
    where: eq(schema.memoryIntegrityPolicies.name, DEFAULT_POLICY_NAME),
  })
  if (existing) return existing
  return createMemoryIntegrityPolicy({ name: DEFAULT_POLICY_NAME })
}

export async function createMemoryIntegrityPolicy(
  args: CreateMemoryIntegrityPolicyArgs = {},
): Promise<MemoryIntegrityPolicyRow> {
  const now = Date.now()
  const row = {
    id: newMemoryIntegrityPolicyId(),
    name: args.name ?? `Memory integrity guard ${new Date(now).toISOString()}`,
    policy: mergePolicy(args.policy),
    status: args.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.memoryIntegrityPolicies).values(row)
  return row
}

export async function listMemoryIntegrityPolicies(args: {
  status?: MemoryIntegrityPolicyStatus
  limit?: number
} = {}): Promise<MemoryIntegrityPolicyRow[]> {
  const filters: SQL[] = []
  if (args.status) filters.push(eq(schema.memoryIntegrityPolicies.status, args.status))
  return db.query.memoryIntegrityPolicies.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: [desc(schema.memoryIntegrityPolicies.updatedAt)],
    limit: Math.min(Math.max(args.limit ?? 25, 1), 100),
  })
}

export async function evaluateMemoryBeforeWrite(
  args: EvaluateMemoryBeforeWriteArgs,
): Promise<MemoryIntegrityEvaluationRow> {
  const policy = args.policyId ? await getRequiredPolicy(args.policyId) : await seedMemoryIntegrityPolicy()
  if (policy.status !== 'active') throw new Error(`Memory integrity policy is ${policy.status}: ${policy.id}`)
  const confidenceFromSource = policy.policy.beforeWrite.sourceConfidenceMap[args.sourceType]
  const confidenceApplied = Math.min(args.requestedConfidence ?? 1, confidenceFromSource)
  const matchedPatterns = matchDangerousPatterns(args.content, policy.policy.beforeWrite.dangerousPatterns)
  const contradictions = policy.policy.periodicScan.contradictionScan
    ? await findContradictions(args.content, args.agentProfileId ?? null)
    : []
  const decision = decide({
    policy: policy.policy,
    confidenceApplied,
    matchedPatterns,
    contradictions,
  })
  const now = Date.now()
  const row = {
    id: newMemoryIntegrityEvaluationId(),
    policyId: policy.id,
    memoryItemId: args.memoryItemId ?? null,
    agentProfileId: args.agentProfileId ?? null,
    sourceType: args.sourceType,
    decision,
    confidenceApplied,
    matchedPatterns,
    contradictions,
    input: {
      title: args.title,
      contentPreview: args.content.slice(0, 240),
      requestedConfidence: args.requestedConfidence ?? null,
      sourceConfidence: confidenceFromSource,
    },
    result: {
      action: actionForDecision(decision),
      safeToWrite: decision !== 'blocked',
      shouldLowerConfidence: confidenceApplied < (args.requestedConfidence ?? 1),
      reviewRequired: decision === 'blocked' || decision === 'flagged',
    },
    createdAt: now,
  }
  await db.insert(schema.memoryIntegrityEvaluations).values(row)
  return row
}

export async function scanMemoryIntegrity(
  args: ScanMemoryIntegrityArgs = {},
): Promise<{
  policy: MemoryIntegrityPolicyRow
  evaluatedCount: number
  blocked: number
  flagged: number
  warnings: number
  evaluations: MemoryIntegrityEvaluationRow[]
}> {
  const policy = args.policyId ? await getRequiredPolicy(args.policyId) : await seedMemoryIntegrityPolicy()
  const memories = await db.query.memoryItems.findMany({
    orderBy: [desc(schema.memoryItems.createdAt)],
    limit: Math.min(Math.max(args.limit ?? 50, 1), 200),
  })
  const filtered = args.agentProfileId
    ? memories.filter((memory) => memory.agentProfileId === args.agentProfileId)
    : memories
  const evaluations: MemoryIntegrityEvaluationRow[] = []
  for (const memory of filtered) {
    const sourceType = inferSourceType(memory, policy.policy)
    evaluations.push(
      await evaluateMemoryBeforeWrite({
        policyId: policy.id,
        agentProfileId: memory.agentProfileId,
        memoryItemId: memory.id,
        sourceType,
        title: memory.title,
        content: memory.content,
        requestedConfidence: memory.confidence,
      }),
    )
  }
  return {
    policy,
    evaluatedCount: evaluations.length,
    blocked: evaluations.filter((item) => item.decision === 'blocked').length,
    flagged: evaluations.filter((item) => item.decision === 'flagged').length,
    warnings: evaluations.filter((item) => item.decision === 'warning').length,
    evaluations,
  }
}

export async function listMemoryIntegrityEvaluations(args: {
  policyId?: string
  memoryItemId?: string
  decision?: MemoryIntegrityDecision
  limit?: number
} = {}): Promise<MemoryIntegrityEvaluationRow[]> {
  const filters: SQL[] = []
  if (args.policyId) filters.push(eq(schema.memoryIntegrityEvaluations.policyId, args.policyId))
  if (args.memoryItemId) filters.push(eq(schema.memoryIntegrityEvaluations.memoryItemId, args.memoryItemId))
  if (args.decision) filters.push(eq(schema.memoryIntegrityEvaluations.decision, args.decision))
  return db.query.memoryIntegrityEvaluations.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: [desc(schema.memoryIntegrityEvaluations.createdAt)],
    limit: Math.min(Math.max(args.limit ?? 50, 1), 200),
  })
}

function mergePolicy(patch: PartialMemoryIntegrityPolicy | undefined): MemoryIntegrityPolicy {
  return {
    beforeWrite: {
      ...defaultPolicy.beforeWrite,
      ...patch?.beforeWrite,
      sourceConfidenceMap: {
        ...defaultPolicy.beforeWrite.sourceConfidenceMap,
        ...patch?.beforeWrite?.sourceConfidenceMap,
      },
      dangerousPatterns: patch?.beforeWrite?.dangerousPatterns ?? defaultPolicy.beforeWrite.dangerousPatterns,
    },
    periodicScan: {
      ...defaultPolicy.periodicScan,
      ...patch?.periodicScan,
    },
  }
}

function matchDangerousPatterns(content: string, patterns: string[]): string[] {
  return patterns.filter((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(content)
    } catch {
      return false
    }
  })
}

async function findContradictions(
  content: string,
  agentProfileId: string | null,
): Promise<JsonObject[]> {
  const normalized = content.toLowerCase()
  const memories = await db.query.memoryItems.findMany({
    orderBy: [desc(schema.memoryItems.confidence)],
    limit: 200,
  })
  return memories
    .filter((memory) =>
      memory.confidence >= 0.85 &&
      (!agentProfileId || !memory.agentProfileId || memory.agentProfileId === agentProfileId),
    )
    .flatMap((memory) => contradictionForMemory(normalized, memory))
    .slice(0, 5)
}

function contradictionForMemory(normalized: string, memory: MemoryItemRow): JsonObject[] {
  const trusted = memory.content.toLowerCase()
  const contradictions: JsonObject[] = []
  if (/hardcode.*(password|api key|secret)/i.test(normalized) && /never|do not|avoid/.test(trusted) && /hardcode/.test(trusted)) {
    contradictions.push({ memoryItemId: memory.id, title: memory.title, reason: 'trusted_memory_rejects_hardcoding_secrets' })
  }
  if (/disable.*security/i.test(normalized) && /never|do not|avoid/.test(trusted) && /disable.*security/.test(trusted)) {
    contradictions.push({ memoryItemId: memory.id, title: memory.title, reason: 'trusted_memory_rejects_disabling_security' })
  }
  if (/bypass.*auth/i.test(normalized) && /never|do not|avoid/.test(trusted) && /bypass.*auth/.test(trusted)) {
    contradictions.push({ memoryItemId: memory.id, title: memory.title, reason: 'trusted_memory_rejects_auth_bypass' })
  }
  if (/credentials?.*frontend|frontend.*credentials?/i.test(normalized) && /never|do not|avoid/.test(trusted) && /credentials?.*frontend|frontend.*credentials?/.test(trusted)) {
    contradictions.push({ memoryItemId: memory.id, title: memory.title, reason: 'trusted_memory_rejects_frontend_credentials' })
  }
  return contradictions
}

function decide(args: {
  policy: MemoryIntegrityPolicy
  confidenceApplied: number
  matchedPatterns: string[]
  contradictions: JsonObject[]
}): MemoryIntegrityDecision {
  if (args.matchedPatterns.length > 0) {
    if (args.policy.beforeWrite.onDangerousPattern === 'block_and_alert') return 'blocked'
    if (args.policy.beforeWrite.onDangerousPattern === 'flag_for_review') return 'flagged'
    return 'warning'
  }
  if (args.contradictions.length > 0) return 'flagged'
  if (args.confidenceApplied < args.policy.beforeWrite.minimumAllowedConfidence) return 'warning'
  return 'allowed'
}

function actionForDecision(decision: MemoryIntegrityDecision): string {
  if (decision === 'blocked') return 'block_memory_write_and_alert_user'
  if (decision === 'flagged') return 'write_only_after_review'
  if (decision === 'warning') return 'lower_confidence_and_mark_source'
  return 'allow_memory_write'
}

function inferSourceType(
  memory: MemoryItemRow,
  policy: MemoryIntegrityPolicy,
): MemoryIntegritySourceType {
  if (memory.confidence <= policy.periodicScan.lowConfidenceThreshold) return 'inferred_from_task'
  if (/https?:\/\//i.test(memory.content)) return 'external_web_content'
  return 'agent_direct_observation'
}

async function getRequiredPolicy(id: string): Promise<MemoryIntegrityPolicyRow> {
  const row = await db.query.memoryIntegrityPolicies.findFirst({
    where: eq(schema.memoryIntegrityPolicies.id, id),
  })
  if (!row) throw new Error(`Memory integrity policy not found: ${id}`)
  return row
}

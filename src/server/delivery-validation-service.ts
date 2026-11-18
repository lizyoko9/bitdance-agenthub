import { createHash, randomUUID } from 'node:crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  DeliveryCatalog,
  DeliveryInput,
  DeliveryPlanView,
  DeliveryReceiptView,
  DeliveryValidationRequest,
} from '@/shared/delivery-validation'
import type { MessagePart } from '@/shared/types'

import {
  DELIVERY_VALIDATION_ENGINE_VERSION,
  DELIVERY_VALIDATION_GRAMMAR,
  evaluateDeliveryDraft,
  parseDeliveryDraft,
  qualifyDeliveryDraft,
  renderDeliveryRule,
} from './delivery-validation-engine'
import { captureDeliverySnapshots } from './delivery-validation-snapshot'
import { getEffectiveCwd } from './workspace-utils'

const revisions = schema.deliveryValidationRevisions
const receipts = schema.deliveryValidationReceipts
const MAX_REQUIREMENT_BYTES = 16 * 1024
type Revision = typeof revisions.$inferSelect
type RequirementRef = Revision['requirements'][number]
type DraftRequest = Extract<DeliveryValidationRequest, { action: 'draft' }>

export class DeliveryValidationError extends Error {}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function getConversation(conversationId: string) {
  const conversation = db.select().from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId)).get()
  if (!conversation) throw new DeliveryValidationError('会话不存在')
  return conversation
}

function getWorkspace(conversationId: string) {
  const workspace = db.select().from(schema.workspaces)
    .where(eq(schema.workspaces.conversationId, conversationId)).get()
  if (!workspace) throw new DeliveryValidationError('会话没有可用工作区')
  return workspace
}

function workspaceDigest(workspace: ReturnType<typeof getWorkspace>) {
  return digest([workspace.id, workspace.createdAt, workspace.mode, getEffectiveCwd(workspace)])
}

function userText(parts: MessagePart[]) {
  return parts.flatMap((part) => part.type === 'text' || part.type === 'code' ? [part.content] : [])
    .join('\n\n')
}

function readUserMessage(conversationId: string, messageId: string) {
  const message = db.select({ parts: schema.messages.parts }).from(schema.messages).where(and(
    eq(schema.messages.id, messageId),
    eq(schema.messages.conversationId, conversationId),
    eq(schema.messages.role, 'user'),
    eq(schema.messages.status, 'complete'),
  )).get()
  return message ? userText(message.parts) : null
}

function bindRequirements(conversationId: string, requirements: DraftRequest['requirements']): RequirementRef[] {
  const bytes = requirements.reduce((sum, requirement) => sum + Buffer.byteLength(requirement.quote), 0)
  if (bytes > MAX_REQUIREMENT_BYTES) throw new DeliveryValidationError('需求摘录总长不能超过 16 KiB')
  const seen = new Set<string>()
  return requirements.map(({ messageId, quote }, index) => {
    const text = readUserMessage(conversationId, messageId)
    if (!text?.includes(quote)) throw new DeliveryValidationError('需求摘录必须来自本会话仍存在的用户消息')
    const key = digest([messageId, quote])
    if (seen.has(key)) throw new DeliveryValidationError('不能重复选择同一条需求摘录')
    seen.add(key)
    return { id: 'r' + (index + 1), messageId, quote, messageDigest: digest(text), quoteDigest: digest(quote) }
  })
}

function sourcesMatch(conversationId: string, requirements: RequirementRef[]) {
  return requirements.every(({ messageId, quote, messageDigest, quoteDigest }) => {
    const text = readUserMessage(conversationId, messageId)
    return text !== null && text.includes(quote) && digest(text) === messageDigest && digest(quote) === quoteDigest
  })
}

function checkInputDefinitions(inputs: DeliveryInput[]) {
  const aliases = new Set<string>()
  const paths = new Set<string>()
  for (const input of inputs) {
    const parts = input.path.split('/')
    if (/[\\:\x00-\x1f\x7f]/.test(input.path) || parts.some((part) => !part || part === '.' || part === '..')) {
      throw new DeliveryValidationError('交付文件必须使用工作区相对路径，例如 output/report.md')
    }
    const pathKey = process.platform === 'win32' ? input.path.toLowerCase() : input.path
    if (aliases.has(input.alias) || paths.has(pathKey)) throw new DeliveryValidationError('文件路径和别名必须唯一')
    aliases.add(input.alias)
    paths.add(pathKey)
  }
}

function getRevision(conversationId: string, revisionId: string): Revision {
  const revision = db.select().from(revisions)
    .where(and(eq(revisions.conversationId, conversationId), eq(revisions.id, revisionId))).get()
  if (!revision) throw new DeliveryValidationError('本会话中找不到该规则版本')
  return revision
}

function ineligibleReason(revision: Revision): string | undefined {
  if (revision.engineVersion !== DELIVERY_VALIDATION_ENGINE_VERSION) return '当前执行器不支持这个规则版本'
  const workspace = db.select().from(schema.workspaces)
    .where(eq(schema.workspaces.conversationId, revision.conversationId)).get()
  if (!workspace || workspaceDigest(workspace) !== revision.workspaceDigest) return '工作区绑定已变更'
  if (!sourcesMatch(revision.conversationId, revision.requirements)) return '原始需求已修改或删除'
  if (definitionDigest(revision) !== revision.definitionDigest) return '规则定义或绑定不完整'
}

function definitionDigest(revision: Pick<Revision, 'workspaceDigest' | 'requirementDigest' | 'requirements' | 'inputs' | 'definition' | 'engineVersion'>) {
  return digest([
    revision.workspaceDigest, revision.requirementDigest, revision.requirements,
    revision.inputs, revision.definition, revision.engineVersion,
  ])
}

function requireEligible(revision: Revision, active: boolean) {
  if (revision.revokedAt !== null) throw new DeliveryValidationError('此规则版本已撤销')
  const reason = ineligibleReason(revision)
  if (reason) throw new DeliveryValidationError(reason)
  if (active && (revision.activatedAt === null || revision.qualification === null)) {
    throw new DeliveryValidationError('请先审核并启用该规则版本')
  }
}

function toReceipt(row: typeof receipts.$inferSelect): DeliveryReceiptView {
  return { id: row.id, revisionId: row.revisionId, createdAt: row.createdAt, ...row.result }
}

function toPlanView(revision: Revision): DeliveryPlanView {
  const revoked = revision.revokedAt !== null
  let statusReason = revoked ? '此规则版本已撤销' : ineligibleReason(revision)
  let draft: ReturnType<typeof parseDeliveryDraft> | undefined
  if (revision.engineVersion === DELIVERY_VALIDATION_ENGINE_VERSION) {
    try {
      draft = parseDeliveryDraft(revision.definition, revision)
    } catch {
      statusReason ??= '当前执行器无法读取此规则'
    }
  }
  const status = revoked ? 'revoked' : statusReason ? 'stale' : revision.activatedAt === null ? 'draft' : 'active'
  return {
    id: revision.id,
    planId: revision.planId,
    revision: revision.revision,
    title: revision.title,
    status,
    ...(statusReason ? { statusReason } : {}),
    requirements: revision.requirements.map(({ id, messageId, quote }) => ({ id, messageId, quote })),
    inputs: revision.inputs,
    rules: (draft?.rules ?? []).map((rule) => ({
      id: rule.id,
      requirementId: rule.requirementId,
      title: rule.title,
      expression: renderDeliveryRule(rule),
      requiresFixtures: rule.kind === 'function',
    })),
    suggestedFixtures: revision.qualification?.fixtures.map(({ ruleId, expected, inputs }) =>
      ({ ruleId, expected, inputs })) ?? draft?.suggestedFixtures ?? [],
    generatorRunId: revision.generatorRunId,
    modelId: revision.modelId,
    createdAt: revision.createdAt,
    receipts: db.select().from(receipts).where(eq(receipts.revisionId, revision.id))
      .orderBy(desc(receipts.createdAt), desc(receipts.id)).limit(10).all().map(toReceipt),
  }
}

export function listDeliveryValidation(conversationId: string): DeliveryCatalog {
  const conversation = getConversation(conversationId)
  const sources = db.select({ messageId: schema.messages.id, parts: schema.messages.parts })
    .from(schema.messages).where(and(
      eq(schema.messages.conversationId, conversationId),
      eq(schema.messages.role, 'user'),
      eq(schema.messages.status, 'complete'),
    )).orderBy(desc(schema.messages.createdAt), desc(schema.messages.id)).limit(50).all()
    .map(({ messageId, parts }) => ({ messageId, text: userText(parts).slice(0, MAX_REQUIREMENT_BYTES) }))
    .filter(({ text }) => text.trim())
  const agents = conversation.agentIds.length === 0 ? [] :
    db.select({ id: schema.agents.id, name: schema.agents.name }).from(schema.agents).where(and(
      inArray(schema.agents.id, conversation.agentIds),
      eq(schema.agents.adapterName, 'custom'),
      eq(schema.agents.isOrchestrator, false),
    )).all()
  const plans = db.select().from(revisions).where(eq(revisions.conversationId, conversationId))
    .orderBy(desc(revisions.createdAt), desc(revisions.revision)).all().map(toPlanView)
  return { sources, agents, plans }
}

export async function createDeliveryDraft(conversationId: string, request: DraftRequest, signal: AbortSignal) {
  const conversation = getConversation(conversationId)
  if (!conversation.agentIds.includes(request.agentId)) {
    throw new DeliveryValidationError('请选择本会话的 Custom Agent')
  }
  checkInputDefinitions(request.inputs)
  const workspace = getWorkspace(conversationId)
  const originalWorkspaceDigest = workspaceDigest(workspace)
  const requirements = bindRequirements(conversationId, request.requirements)
  const previous = request.previousRevisionId ? getRevision(conversationId, request.previousRevisionId) : undefined
  const planId = previous?.planId ?? randomUUID()
  const context = { requirements, inputs: request.inputs }
  let generated: { generatorRunId: string; modelId: string; candidate: string }
  try {
    const { generateDeliveryValidationDraft } = await import('./agent-runner')
    generated = await generateDeliveryValidationDraft({
      conversationId, agentId: request.agentId, triggerMessageId: requirements[0].messageId,
      requirements: requirements.map(({ id, quote }) => ({ id, quote })),
      inputs: request.inputs.map(({ alias, format }) => ({ alias, format })),
      grammar: DELIVERY_VALIDATION_GRAMMAR, signal,
    })
  } catch {
    signal.throwIfAborted()
    throw new DeliveryValidationError('生成校验规则失败，请在运行记录查看详情')
  }
  signal.throwIfAborted()
  let definition: ReturnType<typeof parseDeliveryDraft>
  try {
    definition = parseDeliveryDraft(generated.candidate, context)
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 400) : '格式无效'
    throw new DeliveryValidationError('子 Agent 未返回可用的规则草稿：' + detail)
  }
  return db.transaction(() => {
    if (workspaceDigest(getWorkspace(conversationId)) !== originalWorkspaceDigest || !sourcesMatch(conversationId, requirements)) {
      throw new DeliveryValidationError('生成期间需求或工作区已变化，请重新选择')
    }
    const latest = db.select({ revision: revisions.revision }).from(revisions)
      .where(and(eq(revisions.conversationId, conversationId), eq(revisions.planId, planId)))
      .orderBy(desc(revisions.revision)).limit(1).get()
    const row = {
      id: randomUUID(), conversationId, planId, revision: (latest?.revision ?? 0) + 1,
      title: request.title, workspaceDigest: originalWorkspaceDigest,
      requirementDigest: digest(requirements), requirements, inputs: request.inputs, definition,
      engineVersion: DELIVERY_VALIDATION_ENGINE_VERSION, generatorRunId: generated.generatorRunId,
      modelId: generated.modelId, createdAt: Date.now(),
    }
    const saved = db.insert(revisions).values({ ...row, definitionDigest: definitionDigest(row) }).returning().get()
    return toPlanView(saved)
  })
}

export function activateDeliveryRevision(
  conversationId: string,
  request: Extract<DeliveryValidationRequest, { action: 'activate' }>,
) {
  return db.transaction(() => {
    const revision = getRevision(conversationId, request.revisionId)
    requireEligible(revision, false)
    if (revision.activatedAt !== null) throw new DeliveryValidationError('此规则版本已经启用')
    if (!request.reviewed) throw new DeliveryValidationError('请先核对规则和需求')
    const draft = parseDeliveryDraft(revision.definition, revision)
    const quality = qualifyDeliveryDraft(draft, revision, request.fixtures)
    if (!quality.ok) throw new DeliveryValidationError('样例验证未通过：' + quality.errors.join('；'))
    const qualification = {
      fixtures: request.fixtures.map((fixture) => ({ ...fixture, inputsDigest: digest(fixture.inputs) })),
      outcomes: quality.checks,
    }
    const saved = db.update(revisions).set({ activatedAt: Date.now(), qualification })
      .where(eq(revisions.id, revision.id)).returning().get()
    return toPlanView(saved)
  })
}

export function revokeDeliveryRevision(conversationId: string, revisionId: string) {
  const revision = getRevision(conversationId, revisionId)
  if (revision.revokedAt !== null) return toPlanView(revision)
  const saved = db.update(revisions).set({ revokedAt: Date.now() }).where(eq(revisions.id, revision.id)).returning().get()
  return toPlanView(saved)
}

export function assertDeliveryRevisionEligible(conversationId: string, revisionId: string) {
  requireEligible(getRevision(conversationId, revisionId), true)
}

export async function validateDeliveryRevision(conversationId: string, revisionId: string, signal: AbortSignal) {
  const commit = await prepareDeliveryValidation(conversationId, revisionId, signal)
  return db.transaction(() => commit())
}

export async function prepareDeliveryValidation(conversationId: string, revisionId: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const revision = getRevision(conversationId, revisionId)
  requireEligible(revision, true)
  const workspace = getWorkspace(conversationId)
  const draft = parseDeliveryDraft(revision.definition, revision)
  const snapshots = await captureDeliverySnapshots(workspace, revision.inputs, signal)
  const confirmation = await captureDeliverySnapshots(workspace, revision.inputs, signal)
  for (const { alias } of revision.inputs) {
    const first = snapshots[alias]
    const second = confirmation[alias]
    if (first.status !== second.status || (first.status === 'ready' && second.status === 'ready' && first.sha256 !== second.sha256)) {
      snapshots[alias] = { status: 'unavailable', reason: '文件在检查期间发生变化' }
    }
  }
  signal.throwIfAborted()
  const evaluation = evaluateDeliveryDraft(draft, revision, snapshots)
  const inputs = revision.inputs.map(({ alias, path }) => {
    const snapshot = snapshots[alias]
    return { alias, path, status: snapshot.status, ...(snapshot.status === 'ready' ? { sha256: snapshot.sha256 } : {}) }
  })
  let committed = false
  return (runId?: string): DeliveryReceiptView => {
    signal.throwIfAborted()
    if (committed) throw new DeliveryValidationError('这份快照已保存过校验结果')
    const current = getRevision(conversationId, revisionId)
    requireEligible(current, true)
    if (current.definitionDigest !== revision.definitionDigest) throw new DeliveryValidationError('规则版本在验证期间发生变化')
    if (runId) {
      const run = db.select({
        status: schema.agentRuns.status,
        acceptance: schema.agentRuns.deliveryAcceptance,
      }).from(schema.agentRuns).where(and(
        eq(schema.agentRuns.id, runId),
        eq(schema.agentRuns.conversationId, conversationId),
      )).get()
      if (run?.status !== 'running' || run.acceptance?.status !== 'pending' || run.acceptance.revisionId !== revisionId) {
        throw new DeliveryValidationError('正式交付任务已结束或规则绑定发生变化')
      }
    }
    const row = db.insert(receipts).values({
      id: randomUUID(), revisionId, definitionDigest: revision.definitionDigest,
      engineVersion: revision.engineVersion, createdAt: Date.now(),
      result: { ...evaluation, inputs, ...(runId ? { runId } : {}) },
    }).returning().get()
    committed = true
    return toReceipt(row)
  }
}

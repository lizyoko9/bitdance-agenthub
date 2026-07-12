import { existsSync } from 'node:fs'
import path from 'node:path'

import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

import { db, schema } from '@/db/client'
import type { AgentRow, ArtifactRow, MessageRow, WorkspaceRow } from '@/db/schema'
import type {
  ArtifactContent,
  DispatchExpectedOutputType,
  DispatchExpectedOutput,
  DispatchPlanItem,
  DispatchTaskInput,
  DispatchTaskEndStatus,
  MessagePart,
  StreamEvent,
  TaskResultReport,
} from '@/shared/types'
import { estimateTokens, getModelLimits } from '@/shared/model-registry'
import { buildSkillContext, skillInlineBudget } from '@/shared/skill-context'

import { agentRegistry } from './adapters/registry'
import type { AdapterAttachment, AdapterInput } from './adapters/types'
import { getAttachmentAbsolutePath } from './attachment-service'
import {
  getLatestContextSummary,
  prefixPromptWithContextSummary,
  renderConversationSummaryBlock,
} from './context-compaction-service'
import { buildHistoryFor } from './conversation-context'
import {
  clearFileWrites,
  detectWaveConflicts,
  getFileWrites,
  type FileWriteConflict,
  type RunFileWrites,
} from './dispatch-file-writes'
import {
  clearRunToolEvidence,
  getRunToolEvidence,
  recordRunCommand,
  type RunToolEvidence,
} from './dispatch-run-evidence'
import {
  buildReplanContext,
  buildReviseContext,
  collectDependencyClosure,
  compileDispatchPlan,
  extractPlanTasksToolArgs,
  getRequiredExpectedOutputs,
  parseDispatchPlanToolArgs,
  shouldReplan,
  validateDispatchPlan,
  type ReplanConflictView,
  type ReplanTaskView,
} from './dispatch-plan'
import { eventBus } from './event-bus'
import { newArtifactId, newRunId } from './ids'
import { pendingDispatchPlans, type PlanReviewOutcome } from './pending-dispatch-plans'
import { buildProjectFiles } from './project-artifact'
import { getAppSettings } from './settings-service'
import { resolveEffectiveSkills } from './skill-service'
import { LOAD_SKILL_TOOL_NAME } from './tools/load-skill'
import {
  evaluateTaskResultReport,
  isTaskResultReportToolName,
  readTaskResultReportFromToolResult,
  REPORT_TASK_RESULT_TOOL_NAME,
} from './task-result-report'
import { executeBashCommand } from './tools/bash'
import { assertPathWithinWorkspace, getEffectiveCwd } from './workspace-utils'

/**
 * AgentRunner — 执行一次 Agent 调用。
 *
 * 两种分支：
 *  - executeSimpleRun       普通 Agent，消费 adapter 事件流即可
 *  - executeOrchestratorRun isOrchestrator 的 Agent，三阶段：PLAN → EXECUTE → AGGREGATE
 *
 * 详细规格见 specs/06-orchestrator-flow.md。
 */

export interface RunArgs {
  agentId: string
  conversationId: string
  triggerMessageId: string
  parentRunId?: string
  /** 子 agent 调度时覆盖 prompt（外部 prompt，由 Orchestrator 构造） */
  overridePrompt?: string
  /** 覆盖 system prompt（Orchestrator 不同 stage 用不同 prompt） */
  overrideSystemPrompt?: string
  /** 覆盖工具集（Orchestrator aggregate 阶段不带 plan_tasks） */
  overrideToolNames?: string[]
  /** 子任务运行必须通过 report_task_result 显式上报语义结果 */
  requireTaskReport?: boolean
  /** 父 run 的 AbortSignal — 用于级联中止：parent abort → child abort */
  parentSignal?: AbortSignal
}

export interface RunResult {
  runId: string
  status: 'complete' | 'failed' | 'aborted'
  error?: string
  artifactIds: string[]
  outputMessageIds: string[]
  outputArtifacts: Record<string, string>
  taskReport?: TaskResultReport
}

interface RunExecutionResult {
  artifactIds: string[]
  outputMessageIds: string[]
  outputArtifacts: Record<string, string>
  taskReport?: TaskResultReport
}

interface DispatchTaskResult {
  runId: string | null
  runIds?: string[]
  status: DispatchTaskEndStatus
  error?: string
  artifactIds: string[]
  outputMessageIds: string[]
  outputArtifacts: Record<string, string>
  taskReport?: TaskResultReport
}

interface ChildAttemptEvaluation {
  rawResult: DispatchTaskResult
  result: DispatchTaskResult
  evidence: RunToolEvidence
  verificationResults: VerificationCommandResult[]
}

interface VerificationCommandResult {
  command: string
  cwd?: string
  exitCode: number | null
  timedOut: boolean
  ok: boolean
  output?: string
  error?: string
  prepare?: boolean
}

interface BlockedDependency {
  taskId: string
  result: DispatchTaskResult
}

interface ResolvedTaskInput {
  input: DispatchTaskInput
  type: DispatchExpectedOutputType | null
  artifactId: string | null
  missing: boolean
}

class Semaphore {
  private active = 0
  private readonly queue: Array<{
    resolve: (release: () => void) => void
    reject: (reason?: unknown) => void
    signal: AbortSignal
    onAbort: () => void
  }> = []

  constructor(private readonly limit: number) {}

  acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(new Error('Semaphore acquire aborted'))
    if (this.active < this.limit) {
      this.active++
      return Promise.resolve(this.createRelease())
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        signal,
        onAbort: () => {
          const idx = this.queue.indexOf(waiter)
          if (idx >= 0) this.queue.splice(idx, 1)
          reject(new Error('Semaphore acquire aborted'))
        },
      }
      signal.addEventListener('abort', waiter.onAbort, { once: true })
      this.queue.push(waiter)
    })
  }

  private createRelease(): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      this.active--
      this.drain()
    }
  }

  private drain(): void {
    while (this.active < this.limit && this.queue.length > 0) {
      const waiter = this.queue.shift()
      if (!waiter) return
      waiter.signal.removeEventListener('abort', waiter.onAbort)
      if (waiter.signal.aborted) continue
      this.active++
      waiter.resolve(this.createRelease())
    }
  }
}

const SUB_AGENT_CONTEXT_RECENT_LIMIT = 5
const MAX_CONCURRENT_SUB_AGENT_RUNS = 4
const ASK_USER_TOOL_NAME = 'ask_user'
const ORCHESTRATOR_PLAN_ALLOWED_TOOLS = new Set([
  'plan_tasks',
  ASK_USER_TOOL_NAME,
  'fs_list',
  'fs_read',
  'read_artifact',
  'read_attachment',
])
/** Orchestrator 动态重规划上限：首轮 + 最多 (N-1) 轮补救（呼应 spec 06「不无限重试」）。 */
const MAX_DISPATCH_ROUNDS = 4
const MAX_CHILD_TASK_ATTEMPTS = 4
const DEFAULT_VERIFICATION_TIMEOUT_MS = 5 * 60_000
const DEFAULT_PREPARE_TIMEOUT_MS = 10 * 60_000

const activeRuns = new Map<string, AbortController>()
const subAgentRunSemaphore = new Semaphore(MAX_CONCURRENT_SUB_AGENT_RUNS)

function emptyRunExecutionResult(): RunExecutionResult {
  return { artifactIds: [], outputMessageIds: [], outputArtifacts: {} }
}

export const AgentRunner = {
  run(args: RunArgs): { runId: string; promise: Promise<RunResult> } {
    const runId = newRunId()
    const controller = new AbortController()

    // 级联：父 run abort 时子 run 也 abort
    if (args.parentSignal) {
      if (args.parentSignal.aborted) {
        controller.abort()
      } else {
        args.parentSignal.addEventListener('abort', () => controller.abort(), { once: true })
      }
    }

    activeRuns.set(runId, controller)

    const promise = executeRun(runId, controller.signal, args).finally(() => {
      activeRuns.delete(runId)
    })

    promise.catch((err) => {
      console.error('[AgentRunner] uncaught error', err)
    })

    return { runId, promise }
  },

  abort(runId: string): boolean {
    const ac = activeRuns.get(runId)
    if (!ac) return false
    ac.abort()
    return true
  },
}

// ─── 主入口 ────────────────────────────────────────────────
async function executeRun(runId: string, signal: AbortSignal, args: RunArgs): Promise<RunResult> {
  const agent = await db.query.agents.findFirst({
    where: eq(schema.agents.id, args.agentId),
  })
  if (!agent) {
    return finalizeFailed(runId, args, `Agent not found: ${args.agentId}`)
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.conversationId, args.conversationId),
  })
  if (!workspace) {
    return finalizeFailed(runId, args, `Workspace not found for conversation: ${args.conversationId}`)
  }

  const triggerMessage = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.id, args.triggerMessageId),
      eq(schema.messages.conversationId, args.conversationId),
    ),
  })
  if (!triggerMessage) {
    return finalizeFailed(runId, args, `Trigger message not found: ${args.triggerMessageId}`)
  }

  const prompt = args.overridePrompt ?? extractTextFromParts(triggerMessage.parts)

  // 解析 trigger message 里的附件（子 run / overridePrompt 场景不解析，避免子 agent 重复处理）
  const attachments: AdapterAttachment[] = []
  if (!args.overridePrompt) {
    for (const p of triggerMessage.parts) {
      if (p.type === 'image_attachment' || p.type === 'file_attachment') {
        const absPath = await getAttachmentAbsolutePath(p.attachmentId)
        if (absPath) {
          attachments.push({
            id: p.attachmentId,
            fileName: p.fileName,
            mimeType: p.mimeType,
            kind: p.type === 'image_attachment' ? 'image' : 'file',
            absPath,
          })
        }
      }
    }
  }

  // 写 run 记录 + 发 run.start
  await insertRun(runId, args, agent.id)
  publish({
    type: 'run.start',
    conversationId: args.conversationId,
    timestamp: Date.now(),
    runId,
    agentId: agent.id,
    triggerMessageId: args.triggerMessageId,
    parentRunId: args.parentRunId,
  })

  try {
    const result = agent.isOrchestrator
      ? await executeOrchestratorRun(runId, signal, args, agent, workspace, prompt, attachments)
      : await executeSimpleRun(runId, signal, args, agent, workspace, prompt, attachments)
    if (signal.aborted) {
      return await finalize(runId, args, 'aborted', result)
    }
    return await finalizeOk(runId, args, result)
  } catch (err) {
    if (signal.aborted) {
      return finalize(runId, args, 'aborted', emptyRunExecutionResult())
    }
    const msg = err instanceof Error ? err.message : String(err)
    return finalize(runId, args, 'failed', emptyRunExecutionResult(), msg)
  }
}

// ─── 普通 Agent ────────────────────────────────────────────
async function executeSimpleRun(
  runId: string,
  signal: AbortSignal,
  args: RunArgs,
  agent: AgentRow,
  workspace: WorkspaceRow,
  prompt: string,
  attachments: AdapterAttachment[],
): Promise<RunExecutionResult> {
  const baseToolNames = args.overrideToolNames ?? agent.toolNames
  const toolNames = args.requireTaskReport
    ? ensureIncludes(baseToolNames, REPORT_TASK_RESULT_TOOL_NAME)
    : baseToolNames

  const adapter = agentRegistry.getAdapter(agent)
  const stream = adapter.stream(
    await buildAdapterInput(
      args,
      agent,
      runId,
      prompt,
      workspace,
      toolNames,
      args.overrideSystemPrompt,
      attachments,
    ),
    signal,
  )

  const result = await consumeStream(stream, args.agentId, runId)
  if (args.parentRunId) return result

  try {
    await maybeCreateProjectArtifact({
      evidence: getRunToolEvidence(runId),
      conversationId: args.conversationId,
      agentId: args.agentId,
      result,
    })
  } finally {
    clearRunToolEvidence(runId)
  }
  return result
}

// ─── Orchestrator ──────────────────────────────────────────
async function executeOrchestratorRun(
  runId: string,
  signal: AbortSignal,
  args: RunArgs,
  agent: AgentRow,
  workspace: WorkspaceRow,
  userPrompt: string,
  attachments: AdapterAttachment[],
): Promise<RunExecutionResult> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, args.conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${args.conversationId}`)

  const otherAgentIds = conv.agentIds.filter((id) => id !== agent.id)
  const otherAgents =
    otherAgentIds.length > 0
      ? await db.query.agents.findMany({ where: inArray(schema.agents.id, otherAgentIds) })
      : []

  const allArtifactIds: string[] = []
  const allOutputMessageIds: string[] = []
  const allOutputArtifacts: Record<string, string> = {}

  // ─── Stage 1+2: PLAN → EXECUTE，失败/冲突时动态重规划补救（最多 MAX_DISPATCH_ROUNDS 轮）──
  const mergedResults = new Map<string, DispatchTaskResult>()
  const planItemsById = new Map<string, DispatchPlanItem>()
  let lastConflicts: FileWriteConflict[] = []

  for (let round = 1; round <= MAX_DISPATCH_ROUNDS; round++) {
    if (signal.aborted) throw new Error('Orchestrator run aborted')

    // 补救轮把上一轮的失败/冲突上下文喂回 Orchestrator，由它（LLM）决定补救 plan
    const replanContext =
      round === 1
        ? null
        : buildReplanContext(toReplanViews(planItemsById, mergedResults), toReplanConflicts(lastConflicts))

    const { plan: initialPlan, planRun } = await runPlanStage(
      args,
      agent,
      runId,
      workspace,
      userPrompt,
      otherAgents,
      round === 1 ? attachments : [],
      signal,
      replanContext,
      [...planItemsById.values()],
    )
    allArtifactIds.push(...planRun.artifactIds)
    allOutputMessageIds.push(...planRun.outputMessageIds)
    Object.assign(allOutputArtifacts, planRun.outputArtifacts)

    if (!initialPlan) {
      // round 1: Orchestrator 没拆 plan = 直接回答了用户，结束
      // round > 1: 它判断无需/无法补救，跳出进聚合
      if (round === 1) {
        return {
          artifactIds: allArtifactIds,
          outputMessageIds: allOutputMessageIds,
          outputArtifacts: allOutputArtifacts,
        }
      }
      break
    }

    // ─── REVIEW (gate) ─── 审批：批准 / 拒绝 / 自然语言修改。修改 → Orchestrator 重排后再次入 gate。
    let plan = initialPlan
    let approvedPlan: DispatchPlanItem[] | null = null
    let reviewing = true
    while (reviewing) {
      const outcome = await waitForDispatchPlanReview({
        conversationId: args.conversationId,
        agentId: agent.id,
        runId,
        plan,
        availableAgents: otherAgents,
        orchestratorAgentId: agent.id,
        resolvedExternalTasks: [...planItemsById.values()],
        signal,
      })
      if (outcome.kind === 'approve') {
        approvedPlan = outcome.plan
        reviewing = false
      } else if (outcome.kind === 'reject') {
        reviewing = false
      } else {
        // revise：把用户的自然语言反馈喂回 plan 阶段重排；新计划继续循环再审
        const revised = await runPlanStage(
          args,
          agent,
          runId,
          workspace,
          userPrompt,
          otherAgents,
          [],
          signal,
          buildReviseContext(plan, outcome.feedback),
          [...planItemsById.values()],
        )
        allArtifactIds.push(...revised.planRun.artifactIds)
        allOutputMessageIds.push(...revised.planRun.outputMessageIds)
        Object.assign(allOutputArtifacts, revised.planRun.outputArtifacts)
        if (revised.plan) plan = revised.plan
      }
    }
    if (!approvedPlan) {
      if (signal.aborted) throw new Error('Orchestrator run aborted')
      // 用户 reject：首轮直接返回；补救轮跳出，用已有结果聚合
      if (round === 1) {
        return {
          artifactIds: allArtifactIds,
          outputMessageIds: allOutputMessageIds,
          outputArtifacts: allOutputArtifacts,
        }
      }
      break
    }

    publish({
      type: 'dispatch.plan',
      conversationId: args.conversationId,
      timestamp: Date.now(),
      runId,
      plan: approvedPlan,
    })
    for (const item of approvedPlan) planItemsById.set(item.id, item)

    // ─── EXECUTE (DAG) ───
    const { results, conflicts } = await executeDag(approvedPlan, {
      parentRunId: runId,
      conversationId: args.conversationId,
      triggerMessageId: args.triggerMessageId,
      workspace,
      signal,
      seedResults: mergedResults,
      externalPlanItems: [...planItemsById.values()],
    })
    for (const [taskId, r] of results) mergedResults.set(taskId, r)
    lastConflicts = conflicts

    // 本轮全 complete 且无冲突 → 收尾聚合；否则进下一轮补救（受 MAX_DISPATCH_ROUNDS 约束）
    const roundViews = approvedPlan.map<ReplanTaskView>((t) => ({
      taskId: t.id,
      agentId: t.agentId,
      status: results.get(t.id)?.status ?? 'skipped',
      error: results.get(t.id)?.error,
    }))
    if (!shouldReplan(roundViews, toReplanConflicts(conflicts))) break
  }

  // 从合并后的最终结果收集产物/消息（按 taskId 合并，避免列陈旧/重复 artifact）
  for (const r of mergedResults.values()) {
    allArtifactIds.push(...r.artifactIds)
    allOutputMessageIds.push(...r.outputMessageIds)
    Object.assign(allOutputArtifacts, r.outputArtifacts)
  }

  // ─── Stage 3: AGGREGATE ────────────────────────────────
  const aggregateSystemPrompt = buildOrchestratorAggregatePrompt(agent.systemPrompt)
  const aggregateUserPrompt = await buildAggregatePrompt(
    userPrompt,
    [...planItemsById.values()],
    mergedResults,
    lastConflicts,
    workspace,
  )
  // Aggregate 阶段不再带 plan_tasks / ask_user，避免重复拆解或在最终总结前再次打断用户。
  const aggregateToolNames = agent.toolNames.filter(
    (n) => n !== 'plan_tasks' && n !== ASK_USER_TOOL_NAME,
  )

  const aggStream = agentRegistry
    .getAdapter(agent)
    .stream(
      await buildAdapterInput(
        args,
        agent,
        runId,
        aggregateUserPrompt,
        workspace,
        aggregateToolNames,
        aggregateSystemPrompt,
        // aggregate 阶段不再带原始图片附件（避免重复传图片浪费 token；plan 阶段已经看过）
        [],
      ),
      signal,
    )

  const aggRun = await consumeStream(aggStream, agent.id, runId)
  allArtifactIds.push(...aggRun.artifactIds)
  allOutputMessageIds.push(...aggRun.outputMessageIds)
  Object.assign(allOutputArtifacts, aggRun.outputArtifacts)

  return {
    artifactIds: allArtifactIds,
    outputMessageIds: allOutputMessageIds,
    outputArtifacts: allOutputArtifacts,
  }
}

// ─── PLAN 阶段（首轮 + 补救轮共用）──────────────────────────
async function runPlanStage(
  args: RunArgs,
  agent: AgentRow,
  runId: string,
  workspace: WorkspaceRow,
  userPrompt: string,
  otherAgents: AgentRow[],
  attachments: AdapterAttachment[],
  signal: AbortSignal,
  replanContext: string | null,
  resolvedExternalTasks: readonly DispatchPlanItem[] = [],
): Promise<{ plan: DispatchPlanItem[] | null; planRun: RunExecutionResult }> {
  const planSystemPrompt = buildOrchestratorPlanPrompt(agent.systemPrompt, otherAgents, workspace)
  const planToolNames = ensureIncludes(
    ensureIncludes(
      agent.toolNames.filter((name) => ORCHESTRATOR_PLAN_ALLOWED_TOOLS.has(name)),
      'plan_tasks',
    ),
    ASK_USER_TOOL_NAME,
  )
  // 补救轮：把上一轮结果摘要拼到 prompt 前，原始请求仍保留供 Orchestrator 参考
  const effectivePrompt = replanContext
    ? `${replanContext}\n\n<original_request>\n${userPrompt}\n</original_request>`
    : userPrompt

  const planRef: { value: DispatchPlanItem[] | null } = { value: null }
  const planStream = agentRegistry
    .getAdapter(agent)
    .stream(
      await buildAdapterInput(args, agent, runId, effectivePrompt, workspace, planToolNames, planSystemPrompt, attachments),
      signal,
    )
  const planRun = await consumeStream(planStream, agent.id, runId, (event) => {
    if (event.type === 'tool.call') {
      const planArgs = extractPlanTasksToolArgs(event)
      if (planArgs === null) return
      const plan = parseDispatchPlanToolArgs(planArgs)
      planRef.value = plan
      return {
        stop: true,
        result: { acknowledged: true, taskCount: plan.length },
      }
    }
  })
  const raw = planRef.value
  const plan = raw
    ? compileAndValidateDispatchPlan(raw, otherAgents, agent.id, resolvedExternalTasks)
    : null
  return { plan, planRun }
}

/** mergedResults + plan → 重规划视图（供 shouldReplan / buildReplanContext，纯数据，不泄露内部类型）。 */
function toReplanViews(
  planById: Map<string, DispatchPlanItem>,
  results: Map<string, DispatchTaskResult>,
): ReplanTaskView[] {
  const views: ReplanTaskView[] = []
  for (const [taskId, item] of planById) {
    const r = results.get(taskId)
    views.push({ taskId, agentId: item.agentId, status: r?.status ?? 'skipped', error: r?.error })
  }
  return views
}

function toReplanConflicts(conflicts: FileWriteConflict[]): ReplanConflictView[] {
  return conflicts.map((c) => ({ path: c.path, taskIds: c.contributors.map((w) => w.taskId) }))
}

// ─── DAG 调度 ──────────────────────────────────────────────
function mergeExternalPlanItems(
  externalItems: readonly DispatchPlanItem[],
  currentPlan: readonly DispatchPlanItem[],
): DispatchPlanItem[] {
  const byId = new Map<string, DispatchPlanItem>()
  for (const item of externalItems) byId.set(item.id, item)
  for (const item of currentPlan) byId.set(item.id, item)
  return [...byId.values()]
}

function compileAndValidateDispatchPlan(
  rawPlan: DispatchPlanItem[],
  availableAgents: readonly { id: string }[],
  orchestratorAgentId: string,
  resolvedExternalTasks: readonly DispatchPlanItem[] = [],
): DispatchPlanItem[] {
  const { plan } = compileDispatchPlan(rawPlan)
  validateDispatchPlan(plan, availableAgents, orchestratorAgentId, resolvedExternalTasks)
  return plan
}

async function waitForDispatchPlanReview(args: {
  conversationId: string
  agentId: string
  runId: string
  plan: DispatchPlanItem[]
  availableAgents: readonly { id: string }[]
  orchestratorAgentId: string
  resolvedExternalTasks?: readonly DispatchPlanItem[]
  signal: AbortSignal
}): Promise<PlanReviewOutcome> {
  const pending = pendingDispatchPlans.register({
    conversationId: args.conversationId,
    agentId: args.agentId,
    runId: args.runId,
    plan: args.plan,
    validator: (plan) =>
      compileAndValidateDispatchPlan(
        plan,
        args.availableAgents,
        args.orchestratorAgentId,
        args.resolvedExternalTasks ?? [],
      ),
  })

  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: PlanReviewOutcome) => {
      if (settled) return
      settled = true
      args.signal.removeEventListener('abort', onAbort)
      resolve(outcome)
    }
    const onAbort = () => {
      pendingDispatchPlans.cancel(pending.id)
    }

    pendingDispatchPlans.attachResolver(pending.id, finish)
    if (args.signal.aborted) {
      pendingDispatchPlans.cancel(pending.id)
      return
    }
    args.signal.addEventListener('abort', onAbort, { once: true })
  })
}

interface DagContext {
  parentRunId: string
  conversationId: string
  triggerMessageId: string
  workspace: WorkspaceRow
  signal: AbortSignal
  seedResults?: Map<string, DispatchTaskResult>
  externalPlanItems?: readonly DispatchPlanItem[]
}

async function executeDag(
  plan: DispatchPlanItem[],
  ctx: DagContext,
): Promise<{ results: Map<string, DispatchTaskResult>; conflicts: FileWriteConflict[] }> {
  const currentTaskIds = new Set(plan.map((t) => t.id))
  const results = new Map<string, DispatchTaskResult>(
    [...(ctx.seedResults ?? new Map<string, DispatchTaskResult>())].filter(
      ([taskId]) => !currentTaskIds.has(taskId),
    ),
  )
  const remaining = new Set(plan.map((t) => t.id))
  const conflicts: FileWriteConflict[] = []
  const planContext = mergeExternalPlanItems(ctx.externalPlanItems ?? [], plan)

  while (remaining.size > 0) {
    if (ctx.signal.aborted) {
      markRemainingTasksAborted(plan, remaining, results, ctx)
      throw new Error('Orchestrator run aborted')
    }

    for (const task of plan) {
      if (!remaining.has(task.id)) continue
      const blockers = (task.dependsOn ?? []).flatMap((dep) => {
        const result = results.get(dep)
        return result && result.status !== 'complete' ? [{ taskId: dep, result }] : []
      })
      if (blockers.length === 0) continue

      const result = skippedTaskResult(task, blockers)
      results.set(task.id, result)
      remaining.delete(task.id)
      publishDispatchEnd(ctx, task.id, result)
    }

    if (remaining.size === 0) break

    const ready = plan.filter(
      (t) =>
        remaining.has(t.id) &&
        (t.dependsOn ?? []).every((d) => results.get(d)?.status === 'complete'),
    )
    if (ready.length === 0) {
      throw new Error('Circular dependency or unresolved task in plan')
    }

    const wave = await Promise.all(ready.map((t) => runChildTask(t, results, planContext, ctx)))
    for (let i = 0; i < ready.length; i++) {
      results.set(ready[i].id, wave[i])
      remaining.delete(ready[i].id)
    }

    // 同波次「代码冲突」检测：本波 ≥2 个子 run 经 fs_write 写了同一文件且内容不同
    if (ready.length > 1) {
      const runWrites: RunFileWrites[] = []
      for (let i = 0; i < ready.length; i++) {
        const childRunIds = getDispatchResultRunIds(wave[i])
        if (childRunIds.length === 0) continue
        runWrites.push({
          taskId: ready[i].id,
          agentId: ready[i].agentId,
          runId: childRunIds[childRunIds.length - 1],
          writes: mergeFileWrites(childRunIds),
        })
      }
      conflicts.push(...detectWaveConflicts(runWrites))
    }
  }

  // 释放本次 dispatch 各子 run 的写入记录（内存）
  for (const [taskId, r] of results) {
    if (!currentTaskIds.has(taskId)) continue
    for (const childRunId of getDispatchResultRunIds(r)) {
      clearFileWrites(childRunId)
      clearRunToolEvidence(childRunId)
    }
  }

  return {
    results: new Map([...results].filter(([taskId]) => currentTaskIds.has(taskId))),
    conflicts,
  }
}

function getDispatchResultRunIds(result: DispatchTaskResult): string[] {
  if (result.runIds && result.runIds.length > 0) return result.runIds
  return result.runId ? [result.runId] : []
}

function mergeFileWrites(runIds: string[]): Map<string, string> {
  const merged = new Map<string, string>()
  for (const runId of runIds) {
    for (const [path, hash] of getFileWrites(runId)) {
      merged.set(path, hash)
    }
  }
  return merged
}

async function runChildTask(
  task: DispatchPlanItem,
  upstream: Map<string, DispatchTaskResult>,
  plan: DispatchPlanItem[],
  ctx: DagContext,
): Promise<DispatchTaskResult> {
  const resolvedInputs = resolveTaskInputs(task, upstream, plan)
  const missingRequiredInputs = resolvedInputs.filter(
    (entry) => entry.missing && entry.input.required !== false,
  )
  if (missingRequiredInputs.length > 0) {
    const result = skippedMissingInputsTaskResult(task, missingRequiredInputs)
    publishDispatchEnd(ctx, task.id, result)
    return result
  }

  let release: (() => void) | null = null
  try {
    release = await subAgentRunSemaphore.acquire(ctx.signal)
  } catch {
    const result = abortedBeforeStartTaskResult(task, 'Aborted while waiting for sub-agent concurrency slot')
    publishDispatchEnd(ctx, task.id, result)
    return result
  }

  try {
    const basePrompt = await buildSubAgentPrompt(
      task,
      upstream,
      ctx.conversationId,
      plan,
      resolvedInputs,
      ctx.workspace,
    )

    let continuationContext: string | null = null
    let lastEvaluation: ChildAttemptEvaluation | null = null
    const aggregate: RunExecutionResult = emptyRunExecutionResult()
    const aggregateEvidence: RunToolEvidence = { fileWrites: [], commands: [] }
    const attemptRunIds: string[] = []

    for (let attempt = 1; attempt <= MAX_CHILD_TASK_ATTEMPTS; attempt++) {
      if (ctx.signal.aborted) {
        const result = abortedBeforeStartTaskResult(task, 'Aborted before sub-agent run started')
        publishDispatchEnd(ctx, task.id, result)
        return mergeAttemptAggregate(result, aggregate)
      }

      const prompt = continuationContext
        ? buildContinuationPrompt(basePrompt, task, attempt, continuationContext)
        : basePrompt
      const attemptEvaluation = await runChildTaskAttempt(task, prompt, ctx)
      if (attemptEvaluation.rawResult.runId) attemptRunIds.push(attemptEvaluation.rawResult.runId)
      mergeRunExecutionResult(aggregate, attemptEvaluation.rawResult)
      mergeRunToolEvidence(aggregateEvidence, attemptEvaluation.evidence)
      const evaluatedResult = evaluateChildTaskResult(
        task,
        attemptEvaluation.rawResult,
        aggregateEvidence,
      )
      let currentEvaluation: ChildAttemptEvaluation = {
        ...attemptEvaluation,
        result: { ...evaluatedResult, runIds: [...attemptRunIds] },
        evidence: cloneRunToolEvidence(aggregateEvidence),
      }

      if (currentEvaluation.result.status === 'complete') {
        const projectArtifactId = await maybeCreateProjectArtifact({
          evidence: aggregateEvidence,
          conversationId: ctx.conversationId,
          agentId: task.agentId,
          taskId: task.id,
          result: currentEvaluation.result,
        })
        const resultWithProject = bindProjectExpectedOutput(
          task,
          currentEvaluation.result,
          projectArtifactId,
        )
        const outputEvaluation = evaluateRequiredProjectOutputs(task, resultWithProject)
        currentEvaluation = {
          ...currentEvaluation,
          result: outputEvaluation.ok
            ? resultWithProject
            : { ...resultWithProject, status: 'failed', error: outputEvaluation.error },
        }
      }

      lastEvaluation = currentEvaluation

      if (currentEvaluation.result.status === 'complete') {
        publishDispatchEnd(ctx, task.id, currentEvaluation.result)
        return mergeAttemptAggregate(currentEvaluation.result, aggregate)
      }

      if (
        currentEvaluation.result.status === 'aborted' ||
        currentEvaluation.result.taskReport?.status === 'blocked'
      ) {
        publishDispatchEnd(ctx, task.id, currentEvaluation.result)
        return mergeAttemptAggregate(currentEvaluation.result, aggregate)
      }

      continuationContext = buildTaskContinuationContext(
        task,
        currentEvaluation,
        attempt,
        MAX_CHILD_TASK_ATTEMPTS,
      )
    }

    const result =
      lastEvaluation?.result ??
      abortedBeforeStartTaskResult(task, 'No child task attempt was executed')
    const exhausted: DispatchTaskResult = {
      ...result,
      status: result.status === 'complete' ? 'complete' : 'failed',
      error:
        result.status === 'complete'
          ? result.error
          : `Task "${task.id}" did not satisfy completion gates after ${MAX_CHILD_TASK_ATTEMPTS} attempt(s). Last error: ${result.error ?? 'unknown error'}`,
      runIds: [...attemptRunIds],
    }
    publishDispatchEnd(ctx, task.id, exhausted)

    return mergeAttemptAggregate(exhausted, aggregate)
  } finally {
    release?.()
  }
}

async function maybeCreateProjectArtifact(args: {
  evidence: RunToolEvidence
  conversationId: string
  agentId: string
  taskId?: string
  result: { artifactIds: string[] }
}): Promise<string | null> {
  if (args.evidence.fileWrites.length === 0) return null
  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.conversationId, args.conversationId),
  })
  if (!workspace) return null
  const files = buildProjectFiles(args.evidence.fileWrites, getEffectiveCwd(workspace))
  if (files.length === 0) return null

  const agent = await db.query.agents.findFirst({ where: eq(schema.agents.id, args.agentId) })
  const title = `${agent?.name ?? args.agentId} · 项目产物`
  const content: ArtifactContent = {
    type: 'project',
    files,
    ...(args.taskId ? { taskId: args.taskId } : {}),
    agentId: args.agentId,
  }
  const artifactId = newArtifactId()
  const createdAt = Date.now()
  await db.insert(schema.artifacts).values({
    id: artifactId,
    conversationId: args.conversationId,
    type: 'project',
    title,
    content,
    version: 1,
    parentArtifactId: null,
    createdByAgentId: args.agentId,
    createdAt,
  })
  args.result.artifactIds.push(artifactId)
  publish({
    type: 'artifact.create',
    conversationId: args.conversationId,
    timestamp: Date.now(),
    artifact: {
      id: artifactId,
      conversationId: args.conversationId,
      type: 'project',
      title,
      content,
      version: 1,
      parentArtifactId: undefined,
      createdByAgentId: args.agentId,
      createdAt,
    },
  })
  return artifactId
}

async function runChildTaskAttempt(
  task: DispatchPlanItem,
  prompt: string,
  ctx: DagContext,
): Promise<ChildAttemptEvaluation> {
  const { runId: childRunId, promise } = AgentRunner.run({
    agentId: task.agentId,
    conversationId: ctx.conversationId,
    triggerMessageId: ctx.triggerMessageId,
    parentRunId: ctx.parentRunId,
    overridePrompt: prompt,
    requireTaskReport: true,
    parentSignal: ctx.signal,
  })

  publish({
    type: 'dispatch.start',
    conversationId: ctx.conversationId,
    timestamp: Date.now(),
    parentRunId: ctx.parentRunId,
    childRunId,
    taskId: task.id,
    agentId: task.agentId,
  })

  const raw = await promise
  const verificationResults =
    raw.status === 'aborted'
      ? []
      : await runRequiredCommands(task, childRunId, ctx)
  const evidence = getRunToolEvidence(childRunId)
  const result = evaluateChildTaskResult(task, raw, evidence)
  return { rawResult: raw, result, evidence, verificationResults }
}

function evaluateChildTaskResult(
  task: DispatchPlanItem,
  result: DispatchTaskResult,
  evidence: RunToolEvidence = { fileWrites: [], commands: [] },
): DispatchTaskResult {
  if (result.status !== 'complete') {
    return result
  }

  const outputArtifacts = bindImplicitSingleOutput(task, result)
  const reportEvaluation = evaluateTaskResultReport(
    task,
    result.taskReport,
    evidence,
  )
  if (!reportEvaluation.ok) {
    return {
      ...result,
      outputArtifacts,
      status: 'failed',
      error: reportEvaluation.error,
    }
  }

  return { ...result, outputArtifacts }
}

function mergeRunExecutionResult(target: RunExecutionResult, source: RunExecutionResult): void {
  target.artifactIds.push(...source.artifactIds)
  target.outputMessageIds.push(...source.outputMessageIds)
  Object.assign(target.outputArtifacts, source.outputArtifacts)
  if (source.taskReport) target.taskReport = source.taskReport
}

function mergeRunToolEvidence(target: RunToolEvidence, source: RunToolEvidence): void {
  target.fileWrites.push(...source.fileWrites)
  target.commands.push(...source.commands)
}

function cloneRunToolEvidence(source: RunToolEvidence): RunToolEvidence {
  return {
    fileWrites: [...source.fileWrites],
    commands: [...source.commands],
  }
}

function mergeAttemptAggregate(
  result: DispatchTaskResult,
  aggregate: RunExecutionResult,
): DispatchTaskResult {
  const artifactIds = mergeUnique([...aggregate.artifactIds, ...result.artifactIds])
  return {
    ...result,
    runIds: result.runIds,
    artifactIds,
    outputMessageIds: [...aggregate.outputMessageIds],
    outputArtifacts: { ...aggregate.outputArtifacts, ...result.outputArtifacts },
  }
}

function mergeUnique(values: string[]): string[] {
  return [...new Set(values)]
}

async function runRequiredCommands(
  task: DispatchPlanItem,
  runId: string,
  ctx: DagContext,
): Promise<VerificationCommandResult[]> {
  if (!task.requiredCommands || task.requiredCommands.length === 0) return []

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.conversationId, ctx.conversationId),
  })
  if (!workspace) {
    return [
      {
        command: '(required commands)',
        exitCode: null,
        timedOut: false,
        ok: false,
        error: 'Workspace not found',
      },
    ]
  }

  const results: VerificationCommandResult[] = []
  for (const required of task.requiredCommands) {
    const expanded = expandRequiredCommand(required)
    const commandResults: VerificationCommandResult[] = []

    let prepare: { command: string; cwd?: string } | null
    try {
      prepare = expanded.commands.some((command) => /\b(?:pnpm|npm|yarn)\s+install\b/i.test(command))
        ? null
        : buildPrepareCommand(workspace, expanded.cwd)
    } catch (err) {
      const prepareResult: VerificationCommandResult = {
        command: 'prepare workspace',
        cwd: expanded.cwd,
        exitCode: null,
        timedOut: false,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        prepare: true,
      }
      results.push(prepareResult)
      continue
    }
    if (prepare) {
      const prepareResult = await runSupervisorCommand(
        {
          command: prepare.command,
          cwd: prepare.cwd,
          timeoutMs: DEFAULT_PREPARE_TIMEOUT_MS,
        },
        task,
        runId,
        ctx,
        true,
      )
      results.push(prepareResult)
      commandResults.push(prepareResult)
      if (!prepareResult.ok) continue
    }

    for (const command of expanded.commands) {
      const commandResult = await runSupervisorCommand(
        {
          command,
          cwd: expanded.cwd,
          timeoutMs: required.timeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS,
        },
        task,
        runId,
        ctx,
        false,
      )
      results.push(commandResult)
      commandResults.push(commandResult)
      if (!commandResult.ok) break
    }

    const failed = commandResults.find((result) => !result.ok)
    const cwd = commandResults[0]?.cwd ?? required.cwd
    recordRunCommand(runId, {
      command: required.command,
      cwd: cwd ?? getEffectiveCwd(workspace),
      exitCode: failed ? (failed.exitCode ?? null) : 0,
      timedOut: failed?.timedOut ?? false,
      isError: Boolean(failed),
      ...(failed?.error ? { error: failed.error } : {}),
    })
  }

  return results
}

async function runSupervisorCommand(
  command: { command: string; cwd?: string; timeoutMs?: number },
  task: DispatchPlanItem,
  runId: string,
  ctx: DagContext,
  prepare: boolean,
): Promise<VerificationCommandResult> {
  const result = await executeBashCommand(
    { ...command, evidenceKind: prepare ? 'prepare' : 'verification' },
    {
      conversationId: ctx.conversationId,
      workspacePath: '',
      agentId: task.agentId,
      runId,
      abortSignal: ctx.signal,
    },
  )

  if (!result.ok) {
    return {
      command: command.command,
      cwd: command.cwd,
      exitCode: null,
      timedOut: false,
      ok: false,
      error: result.error,
      ...(prepare ? { prepare: true } : {}),
    }
  }

  const value = result.value as {
    command?: unknown
    cwd?: unknown
    exitCode?: unknown
    timedOut?: unknown
    output?: unknown
  }
  const exitCode = typeof value.exitCode === 'number' ? value.exitCode : null
  const timedOut = value.timedOut === true
  return {
    command: typeof value.command === 'string' ? value.command : command.command,
    cwd: typeof value.cwd === 'string' ? value.cwd : command.cwd,
    exitCode,
    timedOut,
    ok: exitCode === 0 && !timedOut,
    output: typeof value.output === 'string' ? value.output : undefined,
    ...(prepare ? { prepare: true } : {}),
  }
}

function expandRequiredCommand(required: NonNullable<DispatchPlanItem['requiredCommands']>[number]): {
  cwd?: string
  commands: string[]
} {
  let cwd = required.cwd
  let command = required.command.trim()
  const cdMatch = command.match(/^cd\s+("?[^"&;]+"?)\s*&&\s*(.+)$/i)
  if (cdMatch && !cwd) {
    cwd = cdMatch[1].replace(/^"|"$/g, '')
    command = cdMatch[2].trim()
  }
  return {
    cwd,
    commands: command
      .split(/\s+&&\s+/)
      .map((part) => part.trim())
      .filter(Boolean),
  }
}

function buildPrepareCommand(
  workspace: WorkspaceRow,
  cwd: string | undefined,
): { command: string; cwd?: string } | null {
  const cwdAbs = cwd ? assertPathWithinWorkspace(workspace, cwd) : getEffectiveCwd(workspace)
  if (!existsSync(path.join(cwdAbs, 'package.json'))) return null
  if (existsSync(path.join(cwdAbs, 'node_modules'))) return null
  return { command: 'pnpm install', ...(cwd ? { cwd } : {}) }
}

function buildContinuationPrompt(
  basePrompt: string,
  task: DispatchPlanItem,
  attempt: number,
  continuationContext: string,
): string {
  return [
    basePrompt,
    '',
    '<continuation>',
    `You are continuing the same dispatched task "${task.id}". This is attempt ${attempt}/${MAX_CHILD_TASK_ATTEMPTS}.`,
    'Do not restart from scratch if useful files already exist. Inspect the workspace, fix the missing or failing parts, run the relevant verification, and then call report_task_result.',
    continuationContext,
    '</continuation>',
  ].join('\n')
}

function buildTaskContinuationContext(
  task: DispatchPlanItem,
  evaluation: ChildAttemptEvaluation,
  attempt: number,
  maxAttempts: number,
): string {
  const lines = [
    '<previous_attempt>',
    `  <attempt>${attempt}/${maxAttempts}</attempt>`,
    `  <status>${evaluation.result.status}</status>`,
  ]
  if (evaluation.result.error) {
    lines.push(`  <error>${escapeXml(evaluation.result.error)}</error>`)
  }
  if (!evaluation.result.taskReport) {
    lines.push('  <missing_report>true</missing_report>')
  }
  if ((task.targetPaths ?? []).length > 0) {
    lines.push('  <target_paths>')
    for (const targetPath of task.targetPaths ?? []) {
      lines.push(`    <path>${escapeXml(targetPath)}</path>`)
    }
    lines.push('  </target_paths>')
  }
  if (evaluation.verificationResults.length > 0) {
    lines.push('  <verification_results>')
    for (const result of evaluation.verificationResults) {
      lines.push(
        `    <command text=${JSON.stringify(result.command)} ok="${result.ok}" exitCode="${result.exitCode ?? ''}" timedOut="${result.timedOut}"${result.prepare ? ' prepare="true"' : ''}>`,
      )
      if (result.cwd) lines.push(`      <cwd>${escapeXml(result.cwd)}</cwd>`)
      if (result.error) lines.push(`      <error>${escapeXml(result.error)}</error>`)
      if (result.output) lines.push(`      <output>${escapeXml(result.output.slice(-4000))}</output>`)
      lines.push('    </command>')
    }
    lines.push('  </verification_results>')
  }
  lines.push('</previous_attempt>')
  return lines.join('\n')
}

function bindImplicitSingleOutput(
  task: DispatchPlanItem,
  result: DispatchTaskResult,
): Record<string, string> {
  const outputArtifacts = { ...result.outputArtifacts }
  const requiredOutputs = getRequiredExpectedOutputs(task)
  if (requiredOutputs.length !== 1 || result.artifactIds.length !== 1) {
    return outputArtifacts
  }

  const outputId = requiredOutputs[0].id
  if (outputArtifacts[outputId]) return outputArtifacts
  if (Object.values(outputArtifacts).includes(result.artifactIds[0])) return outputArtifacts
  outputArtifacts[outputId] = result.artifactIds[0]
  return outputArtifacts
}

function bindProjectExpectedOutput(
  task: DispatchPlanItem,
  result: DispatchTaskResult,
  projectArtifactId: string | null,
): DispatchTaskResult {
  if (!projectArtifactId) return result
  const projectOutputs = getRequiredExpectedOutputs(task).filter((output) => output.type === 'project')
  if (projectOutputs.length === 0) return result

  const outputArtifacts = { ...result.outputArtifacts }
  for (const output of projectOutputs) {
    outputArtifacts[output.id] ??= projectArtifactId
  }
  return { ...result, outputArtifacts }
}

function evaluateRequiredProjectOutputs(
  task: DispatchPlanItem,
  result: DispatchTaskResult,
): { ok: boolean; error?: string } {
  const missing = getRequiredExpectedOutputs(task)
    .filter((output) => output.type === 'project')
    .filter((output) => !result.outputArtifacts[output.id])
  if (missing.length === 0) return { ok: true }
  return {
    ok: false,
    error: `Task "${task.id}" is missing required project output: ${missing
      .map((output) => output.id)
      .join(', ')}`,
  }
}

function resolveTaskInputs(
  task: DispatchPlanItem,
  upstream: Map<string, DispatchTaskResult>,
  plan: DispatchPlanItem[],
): ResolvedTaskInput[] {
  const taskById = new Map(plan.map((item) => [item.id, item]))
  return (task.inputs ?? []).map((input) => {
    const upstreamTask = taskById.get(input.fromTaskId)
    const expectedOutput = upstreamTask?.expectedOutputs?.find(
      (output) => output.id === input.outputId,
    )
    const artifactId = upstream.get(input.fromTaskId)?.outputArtifacts[input.outputId] ?? null
    return {
      input,
      type: expectedOutput?.type ?? null,
      artifactId,
      missing: !artifactId,
    }
  })
}

function skippedMissingInputsTaskResult(
  task: DispatchPlanItem,
  missingInputs: ResolvedTaskInput[],
): DispatchTaskResult {
  const missingText = missingInputs
    .map(({ input }) => `${input.fromTaskId}.${input.outputId}`)
    .join(', ')
  return {
    runId: null,
    status: 'skipped',
    error: `Skipped because required input artifact(s) were missing for task "${task.id}": ${missingText}`,
    artifactIds: [],
    outputMessageIds: [],
    outputArtifacts: {},
  }
}

function skippedTaskResult(
  task: DispatchPlanItem,
  blockers: BlockedDependency[],
): DispatchTaskResult {
  const blockerText = blockers
    .map(({ taskId, result }) => `${taskId}:${result.status}`)
    .join(', ')
  return {
    runId: null,
    status: 'skipped',
    error: `Skipped because upstream task(s) did not complete for task "${task.id}": ${blockerText}`,
    artifactIds: [],
    outputMessageIds: [],
    outputArtifacts: {},
  }
}

function markRemainingTasksAborted(
  plan: DispatchPlanItem[],
  remaining: Set<string>,
  results: Map<string, DispatchTaskResult>,
  ctx: DagContext,
): void {
  for (const task of plan) {
    if (!remaining.has(task.id)) continue
    const result: DispatchTaskResult = {
      runId: null,
      status: 'aborted',
      error: `Aborted before task "${task.id}" started`,
      artifactIds: [],
      outputMessageIds: [],
      outputArtifacts: {},
    }
    results.set(task.id, result)
    remaining.delete(task.id)
    publishDispatchEnd(ctx, task.id, result)
  }
}

function abortedBeforeStartTaskResult(task: DispatchPlanItem, error: string): DispatchTaskResult {
  return {
    runId: null,
    status: 'aborted',
    error: `${error} for task "${task.id}"`,
    artifactIds: [],
    outputMessageIds: [],
    outputArtifacts: {},
  }
}

function publishDispatchEnd(
  ctx: DagContext,
  taskId: string,
  result: DispatchTaskResult,
): void {
  publish({
    type: 'dispatch.end',
    conversationId: ctx.conversationId,
    timestamp: Date.now(),
    parentRunId: ctx.parentRunId,
    childRunId: result.runId ?? undefined,
    taskId,
    status: result.status,
    error: result.error,
  })
}

// ─── 流消费 + 持久化 ─────────────────────────────────────
type ToolCallEvent = Extract<StreamEvent, { type: 'tool.call' }>
type ToolCallControl =
  | void
  | {
      stop: true
      result?: unknown
      isError?: boolean
    }

async function consumeStream(
  stream: AsyncIterable<StreamEvent>,
  agentId: string,
  runId: string,
  onToolCall?: (event: ToolCallEvent) => ToolCallControl,
): Promise<RunExecutionResult> {
  const partsBuffer = new Map<string, MessagePart[]>()
  const artifactIds: string[] = []
  const outputMessageIds: string[] = []
  const outputArtifacts: Record<string, string> = {}
  const outputKeyByArtifactId = new Map<string, string>()
  const toolNameByCallId = new Map<string, string>()
  let taskReport: TaskResultReport | undefined
  let currentMessageId: string | null = null

  for await (const event of stream) {
    if (event.type === 'message.start') currentMessageId = event.messageId
    if (event.type === 'tool.call') toolNameByCallId.set(event.callId, event.toolName)

    await persistEvent(event, partsBuffer, runId, agentId, outputMessageIds, artifactIds)
    publish(event)

    if (event.type === 'artifact.create') {
      const outputKey = outputKeyByArtifactId.get(event.artifact.id)
      if (outputKey) outputArtifacts[outputKey] = event.artifact.id
    }

    // 工具产出的 artifact 自动作为 artifact_ref part 挂到当前 message 末尾，
    // 让用户在聊天流里看到产物卡片而不仅是 tool_result。
    if (event.type === 'artifact.create' && currentMessageId) {
      const parts = partsBuffer.get(currentMessageId) ?? []
      const partIndex = parts.length
      const refPart: MessagePart = { type: 'artifact_ref', artifactId: event.artifact.id }
      parts.push(refPart)
      partsBuffer.set(currentMessageId, parts)
      await db
        .update(schema.messages)
        .set({ parts })
        .where(eq(schema.messages.id, currentMessageId))

      publish({
        type: 'part.start',
        conversationId: event.conversationId,
        timestamp: Date.now(),
        messageId: currentMessageId,
        partIndex,
        part: refPart,
      })
    }

    if (event.type === 'deploy.status') {
      const parts = partsBuffer.get(event.messageId) ?? []
      const partIndex = parts.length
      const deployPart: MessagePart = { type: 'deploy_status', deployment: event.deployment }
      parts.push(deployPart)
      partsBuffer.set(event.messageId, parts)
      await db.update(schema.messages).set({ parts }).where(eq(schema.messages.id, event.messageId))

      publish({
        type: 'part.start',
        conversationId: event.conversationId,
        timestamp: Date.now(),
        messageId: event.messageId,
        partIndex,
        part: deployPart,
      })
    }

    if (event.type === 'message.end') currentMessageId = null
    if (event.type === 'tool.result') {
      const toolName = toolNameByCallId.get(event.callId)
      if (toolName && !event.isError && isTaskResultReportToolName(toolName)) {
        const report = readTaskResultReportFromToolResult(event.result)
        if (report) taskReport = report
      }
      const handoff = readArtifactHandoffResult(event.result)
      if (handoff) outputKeyByArtifactId.set(handoff.artifactId, handoff.outputKey)
    }
    if (event.type === 'tool.call') {
      const control = onToolCall?.(event)
      if (control?.stop) {
        if ('result' in control) {
          const resultEvent: StreamEvent = {
            type: 'tool.result',
            conversationId: event.conversationId,
            timestamp: Date.now(),
            messageId: event.messageId,
            callId: event.callId,
            result: control.result,
            isError: control.isError ?? false,
          }
          await persistEvent(resultEvent, partsBuffer, runId, agentId, outputMessageIds, artifactIds)
          publish(resultEvent)
        }

        const endEvent: StreamEvent = {
          type: 'message.end',
          conversationId: event.conversationId,
          timestamp: Date.now(),
          messageId: event.messageId,
        }
        await persistEvent(endEvent, partsBuffer, runId, agentId, outputMessageIds, artifactIds)
        publish(endEvent)
        currentMessageId = null
        break
      }
    }
  }

  return { artifactIds, outputMessageIds, outputArtifacts, ...(taskReport ? { taskReport } : {}) }
}

function readArtifactHandoffResult(result: unknown): { artifactId: string; outputKey: string } | null {
  if (result === null || typeof result !== 'object') return null
  const value = result as { artifactId?: unknown; outputKey?: unknown }
  if (typeof value.artifactId !== 'string' || typeof value.outputKey !== 'string') return null
  if (!value.outputKey.trim()) return null
  return { artifactId: value.artifactId, outputKey: value.outputKey }
}

async function persistEvent(
  event: StreamEvent,
  partsBuffer: Map<string, MessagePart[]>,
  runId: string,
  agentId: string,
  outputMessageIds: string[],
  artifactIds: string[],
): Promise<void> {
  switch (event.type) {
    case 'run.usage': {
      // adapter 报告本次 run 的 token 用量；落到 agent_runs.usage（同 runId）。
      // 多次 emit 时取最新（adapter 应该只 emit 一次，但 race 保护）。
      await db
        .update(schema.agentRuns)
        .set({ usage: event.usage })
        .where(eq(schema.agentRuns.id, event.runId))
      return
    }
    case 'message.usage': {
      // 单条 message 的 usage —— 用于消息卡片上小角标 hover 显示
      await db
        .update(schema.messages)
        .set({ usage: event.usage })
        .where(eq(schema.messages.id, event.messageId))
      return
    }
    case 'message.start': {
      partsBuffer.set(event.messageId, [])
      outputMessageIds.push(event.messageId)
      await db.insert(schema.messages).values({
        id: event.messageId,
        conversationId: event.conversationId,
        role: 'agent',
        agentId,
        parts: [],
        status: 'streaming',
        mentionedAgentIds: [],
        runId,
        createdAt: event.timestamp,
      })
      return
    }
    case 'part.start': {
      const parts = partsBuffer.get(event.messageId) ?? []
      parts[event.partIndex] = event.part
      partsBuffer.set(event.messageId, parts)
      await db.update(schema.messages).set({ parts }).where(eq(schema.messages.id, event.messageId))
      return
    }
    case 'part.delta': {
      const parts = partsBuffer.get(event.messageId)
      if (!parts) return
      const part = parts[event.partIndex]
      if (!part) return
      if (event.delta.type === 'text.append' && part.type === 'text') part.content += event.delta.text
      else if (event.delta.type === 'thinking.append' && part.type === 'thinking')
        part.content += event.delta.text
      else if (event.delta.type === 'code.append' && part.type === 'code') part.content += event.delta.text
      await db.update(schema.messages).set({ parts }).where(eq(schema.messages.id, event.messageId))
      return
    }
    case 'tool.call': {
      const parts = partsBuffer.get(event.messageId) ?? []
      parts.push({
        type: 'tool_use',
        callId: event.callId,
        toolName: event.toolName,
        args: event.args,
      })
      partsBuffer.set(event.messageId, parts)
      await db.update(schema.messages).set({ parts }).where(eq(schema.messages.id, event.messageId))
      return
    }
    case 'tool.result': {
      const parts = partsBuffer.get(event.messageId) ?? []
      parts.push({
        type: 'tool_result',
        callId: event.callId,
        result: event.result,
        isError: event.isError,
      })
      partsBuffer.set(event.messageId, parts)
      await db.update(schema.messages).set({ parts }).where(eq(schema.messages.id, event.messageId))
      return
    }
    case 'message.end': {
      await db
        .update(schema.messages)
        .set({ status: 'complete' })
        .where(eq(schema.messages.id, event.messageId))
      partsBuffer.delete(event.messageId)
      return
    }
    case 'artifact.create': {
      artifactIds.push(event.artifact.id)
      return
    }
    default:
      return
  }
}

// ─── DB / 事件辅助 ─────────────────────────────────────────
async function insertRun(runId: string, args: RunArgs, agentId: string) {
  await db.insert(schema.agentRuns).values({
    id: runId,
    conversationId: args.conversationId,
    agentId,
    triggerMessageId: args.triggerMessageId,
    status: 'running',
    parentRunId: args.parentRunId,
    startedAt: Date.now(),
  })
}

async function finalize(
  runId: string,
  args: RunArgs,
  status: 'complete' | 'failed' | 'aborted',
  result: RunExecutionResult,
  error?: string,
): Promise<RunResult> {
  const finishedAt = Date.now()

  if (status === 'failed' || status === 'aborted') {
    await persistUnresolvedToolFailures(runId, args.conversationId, status, error, finishedAt)
  }

  await db
    .update(schema.agentRuns)
    .set({ status, finishedAt, error: error ?? null })
    .where(eq(schema.agentRuns.id, runId))

  await db
    .update(schema.messages)
    .set({
      status: status === 'complete' ? 'complete' : status === 'aborted' ? 'aborted' : 'error',
    })
    .where(and(eq(schema.messages.runId, runId), eq(schema.messages.status, 'streaming')))

  // 失败 / 中止时把错误信息暴露给用户：如果该 run 已有 streaming message，把
  // 错误作为新 text part 追加；否则新建一条 system message 显示错误。
  if (status === 'failed' || status === 'aborted') {
    await emitErrorVisualisation(runId, args, status, error, result.outputMessageIds)
  }

  await db
    .update(schema.conversations)
    .set({ updatedAt: finishedAt })
    .where(eq(schema.conversations.id, args.conversationId))

  publish({
    type: 'run.end',
    conversationId: args.conversationId,
    timestamp: finishedAt,
    runId,
    status,
    error,
  })

  return {
    runId,
    status,
    error,
    artifactIds: result.artifactIds,
    outputMessageIds: result.outputMessageIds,
    outputArtifacts: result.outputArtifacts,
    ...(result.taskReport ? { taskReport: result.taskReport } : {}),
  }
}

async function emitErrorVisualisation(
  runId: string,
  args: RunArgs,
  status: 'failed' | 'aborted',
  error: string | undefined,
  outputMessageIds: string[],
): Promise<void> {
  const errorText = status === 'aborted' ? '[已中止]' : `[失败] ${error ?? '未知错误'}`
  const now = Date.now()

  // 优先：把错误追加到该 run 最近的 agent message（如果存在）
  const lastMessageId = outputMessageIds[outputMessageIds.length - 1]
  if (lastMessageId) {
    const msg = await db.query.messages.findFirst({
      where: eq(schema.messages.id, lastMessageId),
    })
    if (msg) {
      const parts: MessagePart[] = [...msg.parts, { type: 'text', content: errorText }]
      await db.update(schema.messages).set({ parts }).where(eq(schema.messages.id, lastMessageId))
      publish({
        type: 'part.start',
        conversationId: args.conversationId,
        timestamp: now,
        messageId: lastMessageId,
        partIndex: parts.length - 1,
        part: { type: 'text', content: errorText },
      })
      return
    }
  }

  // 否则：新建一条 error message
  const errorMessageId = `msg_err_${runId}`
  await db.insert(schema.messages).values({
    id: errorMessageId,
    conversationId: args.conversationId,
    role: 'agent',
    agentId: args.agentId,
    parts: [{ type: 'text', content: errorText }],
    status: 'error',
    mentionedAgentIds: [],
    runId,
    createdAt: now,
  })
  publish({
    type: 'message.start',
    conversationId: args.conversationId,
    timestamp: now,
    messageId: errorMessageId,
    agentId: args.agentId,
    runId,
  })
  publish({
    type: 'part.start',
    conversationId: args.conversationId,
    timestamp: now,
    messageId: errorMessageId,
    partIndex: 0,
    part: { type: 'text', content: errorText },
  })
  publish({
    type: 'message.end',
    conversationId: args.conversationId,
    timestamp: now,
    messageId: errorMessageId,
  })
}

async function persistUnresolvedToolFailures(
  runId: string,
  conversationId: string,
  status: 'failed' | 'aborted',
  error: string | undefined,
  timestamp: number,
): Promise<void> {
  const messages = await db.query.messages.findMany({
    where: eq(schema.messages.runId, runId),
  })
  const result = buildUnresolvedToolFailureResult(status, error)

  for (const message of messages) {
    const nextParts = [...message.parts]
    const completedCallIds = new Set<string>()
    for (const part of nextParts) {
      if (part.type === 'tool_result') completedCallIds.add(part.callId)
    }

    const missingCallIds: string[] = []
    for (const part of nextParts) {
      if (part.type !== 'tool_use' || completedCallIds.has(part.callId)) continue
      nextParts.push({
        type: 'tool_result',
        callId: part.callId,
        result,
        isError: true,
      })
      completedCallIds.add(part.callId)
      missingCallIds.push(part.callId)
    }

    if (missingCallIds.length === 0) continue

    await db
      .update(schema.messages)
      .set({ parts: nextParts })
      .where(eq(schema.messages.id, message.id))
    for (const callId of missingCallIds) {
      publish({
        type: 'tool.result',
        conversationId,
        timestamp,
        messageId: message.id,
        callId,
        result,
        isError: true,
      })
    }
  }
}

function buildUnresolvedToolFailureResult(
  status: 'failed' | 'aborted',
  error: string | undefined,
): string {
  if (status === 'aborted') return '工具调用未完成：本次运行已中止。'
  return error
    ? `工具调用未完成：本次运行失败。${error}`
    : '工具调用未完成：本次运行失败。'
}

function finalizeOk(
  runId: string,
  args: RunArgs,
  result: RunExecutionResult,
) {
  return finalize(runId, args, 'complete', result)
}

function finalizeFailed(runId: string, args: RunArgs, error: string) {
  return finalize(runId, args, 'failed', emptyRunExecutionResult(), error)
}

function publish(event: StreamEvent): void {
  eventBus.publish(event)
}

// ─── Adapter 输入构造 ─────────────────────────────────────
async function buildAdapterInput(
  args: RunArgs,
  agent: AgentRow,
  runId: string,
  prompt: string,
  workspace: WorkspaceRow,
  toolNames: string[],
  systemPromptOverride: string | undefined,
  attachments: AdapterAttachment[],
): Promise<AdapterInput> {
  const effectiveCwd = getEffectiveCwd(workspace)
  const baseSystemPrompt = systemPromptOverride ?? agent.systemPrompt
  let systemPromptWithWorkspace = buildWorkspaceContextBlock(workspace) + '\n\n' + baseSystemPrompt
  const toolGuidance = buildAgentHubToolGuidance(agent, toolNames, workspace)
  if (toolGuidance) systemPromptWithWorkspace += '\n\n' + toolGuidance

  // Skill 注入按 adapter 分策略（见 specs/13 + design「2C per-adapter 策略」+「2E 公共池」）：
  // 有效 Skill = agent 自选（优先）∪ 公共池（isGlobalDefault），去重——单一出口 resolveEffectiveSkills。
  // - claude-code：解析后交给 SDK 原生渐进披露（adapter 物化 .claude/skills + options.skills），不注入文本。
  // - custom / codex / mock：catalog + 短 skill 内联 文本注入；custom/codex 提供 load_skill 按需取长 skill。
  // 接在工具指导之后、历史预算计算之前（计入 promptEstimate，让历史相应压缩）。缺失/禁用 id 静默跳过。
  const effectiveSkills = await resolveEffectiveSkills({ skillIds: agent.skillIds }).catch((err) => {
    console.warn('[agent-runner] skill resolve failed; continuing without skills', err)
    return [] as Awaited<ReturnType<typeof resolveEffectiveSkills>>
  })
  let resolvedSkillsForSdk: AdapterInput['skills']
  if (agent.adapterName === 'claude-code') {
    if (effectiveSkills.length > 0) {
      resolvedSkillsForSdk = effectiveSkills.map((row) => ({
        name: row.name,
        description: row.description,
        instruction: row.instruction,
      }))
    }
  } else if (effectiveSkills.length > 0) {
    const skillsLoadable = agent.adapterName === 'custom' || agent.adapterName === 'codex'
    const skillContextWindow =
      agent.adapterName === 'custom'
        ? getModelLimits(agent.modelProvider, agent.modelId).contextWindow
        : undefined
    const skillBlock = buildSkillContext(
      effectiveSkills.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        instruction: row.instruction,
      })),
      { totalInlineBudget: skillInlineBudget(skillContextWindow), loadable: skillsLoadable },
    )
    if (skillBlock) systemPromptWithWorkspace += '\n\n' + skillBlock
  }

  // custom adapter：有有效 Skill 时自动暴露 load_skill（按需取未内联的长 skill 正文），不占用户工具勾选。
  // codex 经 agenthub MCP bridge 暴露 load_skill（见 scripts/agenthub-codex-mcp.mjs），不走 toolNames。
  let effectiveToolNames = toolNames
  if (
    agent.adapterName === 'custom' &&
    effectiveSkills.length > 0 &&
    !effectiveToolNames.includes(LOAD_SKILL_TOOL_NAME)
  ) {
    effectiveToolNames = [...toolNames, LOAD_SKILL_TOOL_NAME]
  }

  // Key 优先级：agent.apiKey (per-agent) > app_settings.* (用户全局自填) > adapter 内部 fallback env var
  // 只在 per-agent 字段为空时才注入全局 settings，避免覆盖用户的精细配置
  let effectiveApiKey = agent.apiKey
  let effectiveApiBaseUrl = agent.apiBaseUrl
  if (!effectiveApiKey || (!effectiveApiBaseUrl && agent.adapterName === 'claude-code')) {
    const settings = await getAppSettings()
    if (!effectiveApiKey) {
      effectiveApiKey = pickSettingsKey(settings, agent)
    }
    if (!effectiveApiBaseUrl && agent.adapterName === 'claude-code') {
      effectiveApiBaseUrl = settings.anthropicBaseUrl
    }
  }

  // 跨 run 对话历史（仅 CustomAgentAdapter 消费；ClaudeCode / Codex 走 SDK session resume）。
  // 按模型 contextWindow 算出 historyBudget = totalContext - outputReserve - (system+currentUser 估算) - 安全 margin。
  // 失败回退到空数组，让 agent 退化到「无历史」模式而不是整个 run 崩。详见 specs/13-conversation-context.md。
  let history: ChatCompletionMessageParam[] = []
  // Orchestrator 分派的子 agent（args.overridePrompt 已带 spec 06 的隔离上下文：
  // recent_conversation + pinned + artifacts + task）跳过历史注入，不再重复塞一份——
  // 既省 token，也守住 spec 06「子 agent 不看完整群聊历史」的隔离原则。普通会话轮次才注入。
  if (agent.adapterName === 'custom' && !args.overridePrompt) {
    // 群聊（>1 agent）：history 里别 agent 的发言会被序列化成 `[名字] ...` 的 user 消息
    // （见 conversation-context.ts:renderOtherAgentAsUser）。在 system prompt 末尾追加一段说明，
    // 让当前 agent 正确解读这套前缀语义、不把别人的话当成自己的输出。先 append 再算预算，
    // 让这段说明的 token 计入 promptEstimate。
    const conv = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, args.conversationId),
    })
    if ((conv?.agentIds.length ?? 0) > 1) {
      systemPromptWithWorkspace += '\n\n' + GROUP_CHAT_SYSTEM_NOTE
    }

    const limits = getModelLimits(agent.modelProvider, agent.modelId)
    const promptEstimate =
      estimateTokens(systemPromptWithWorkspace) + estimateTokens(prompt) + 512 /* margin */
    const historyBudget = Math.max(0, limits.contextWindow - limits.outputReserve - promptEstimate)
    history = await buildHistoryFor(agent.id, args.conversationId, {
      excludeMessageId: args.triggerMessageId,
      tokenBudget: historyBudget,
    }).catch((err) => {
      console.warn('[agent-runner] buildHistoryFor failed; continuing without history', err)
      return []
    })
  }

  let effectivePrompt = prompt
  if ((agent.adapterName === 'claude-code' || agent.adapterName === 'codex') && !args.overridePrompt) {
    effectivePrompt = await prefixPromptWithContextSummary(args.conversationId, prompt).catch((err) => {
      console.warn('[agent-runner] prefixPromptWithContextSummary failed; continuing without summary', err)
      return prompt
    })
  }

  return {
    agentId: agent.id,
    conversationId: args.conversationId,
    runId,
    prompt: effectivePrompt,
    workspacePath: effectiveCwd,
    systemPrompt: systemPromptWithWorkspace,
    apiKey: effectiveApiKey,
    apiBaseUrl: effectiveApiBaseUrl,
    modelId: agent.modelId,
    toolNames: effectiveToolNames,
    attachments: attachments.length > 0 ? attachments : undefined,
    history: history.length > 0 ? history : undefined,
    customConfig:
      agent.adapterName === 'custom' && agent.modelProvider && agent.modelId
        ? {
            modelProvider: agent.modelProvider,
            supportsVision: agent.supportsVision,
          }
        : undefined,
    skills: resolvedSkillsForSdk,
  }
}

/** 按 agent 的 adapter/provider 选对应字段。Claude Code 走 anthropic，Codex 走 openai，custom 按 modelProvider 走。 */
function pickSettingsKey(
  settings: Awaited<ReturnType<typeof getAppSettings>>,
  agent: AgentRow,
): string | null {
  if (agent.adapterName === 'claude-code') {
    return (
      settings.anthropicApiKey ??
      process.env.ANTHROPIC_AUTH_TOKEN ??
      process.env.ANTHROPIC_API_KEY ??
      null
    )
  }
  if (agent.adapterName === 'codex') {
    return (
      settings.openaiApiKey ??
      process.env.CODEX_API_KEY ??
      process.env.OPENAI_API_KEY ??
      null
    )
  }
  switch (agent.modelProvider) {
    case 'anthropic':
      return settings.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? null
    case 'openai':
      return settings.openaiApiKey ?? process.env.OPENAI_API_KEY ?? null
    case 'deepseek':
      return settings.deepseekApiKey ?? process.env.DEEPSEEK_API_KEY ?? null
    case 'volcano-ark':
      return settings.arkApiKey ?? process.env.ARK_API_KEY ?? null
    case 'openai-compatible':
      return null
    default:
      return null
  }
}

/**
 * 给 LLM 注入「我在哪个目录工作」的 XML 块。
 *
 * 解决 LLM 看到 fs_read/fs_write/bash 的工具描述「inside the workspace」时
 * 误以为是隔离沙箱、声称「无法访问本地文件」的问题（即使 workspace 实际绑定
 * 到用户的真实项目）。
 */
function buildWorkspaceContextBlock(workspace: WorkspaceRow): string {
  const cwd = getEffectiveCwd(workspace)
  if (workspace.mode === 'local') {
    return [
      '<workspace_info>',
      `  <cwd>${cwd}</cwd>`,
      `  <mode>local</mode>`,
      `  <note>This directory is the user's REAL local project on their machine. Files inside it are their actual code. When you use fs_list / fs_read / fs_write / bash, you are reading and modifying real files — be careful. You CAN access these files directly via the workspace tools; do not tell the user you cannot access local files.</note>`,
      '</workspace_info>',
    ].join('\n')
  }
  return [
    '<workspace_info>',
    `  <cwd>${cwd}</cwd>`,
    `  <mode>sandbox</mode>`,
    `  <note>This is an isolated sandbox directory (under .agenthub-data/). It is NOT the user's real codebase. Files you write here are only visible inside this conversation.</note>`,
    '</workspace_info>',
  ].join('\n')
}

// ─── Prompt 构造 ───────────────────────────────────────────

function buildAgentHubToolGuidance(
  agent: AgentRow,
  toolNames: string[],
  workspace: WorkspaceRow,
): string {
  const tools = new Set(toolNames)
  const isSdkAgent = agent.adapterName === 'claude-code' || agent.adapterName === 'codex'
  if (isSdkAgent) {
    const sdkAgentHubTools = tools.has('plan_tasks')
      ? ['read_artifact', 'read_attachment', 'fs_list', ASK_USER_TOOL_NAME]
      : [
          'write_artifact',
          'read_artifact',
          'deploy_artifact',
          'deploy_workspace',
          ASK_USER_TOOL_NAME,
          REPORT_TASK_RESULT_TOOL_NAME,
        ]
    for (const toolName of sdkAgentHubTools) {
      tools.add(toolName)
    }
  }
  const isPlanStage = tools.has('plan_tasks')

  const sections: string[] = []
  const add = (lines: string[]) => sections.push(lines.join('\n'))
  const hasWorkspaceFileTools =
    !isPlanStage &&
    (tools.has('fs_read') || tools.has('fs_write') || tools.has('bash') || isSdkAgent)

  if (tools.size > 0) {
    add([
      '## AgentHub 工具调用规范',
      '- 需要调用工具时，必须用工具调用通道提交结构化参数，不要把 JSON 示例写进普通回复里假装调用。',
      '- 字段名必须严格使用工具 schema 里的 camelCase，例如 artifactId、attachmentId、parentArtifactId、outputKey、dependsOn、expectedOutputs、acceptanceCriteria、acceptanceResults。',
      '- 不要编造 artifactId、attachmentId、outputKey、文件路径；只能使用上下文里明确给出的 id / 路径。',
      '- 工具返回 ok:false 或 isError=true 时，先根据错误修正参数；不要继续基于失败结果推进。',
    ])
  }

  if (workspace.mode === 'local' && hasWorkspaceFileTools) {
    add([
      '## 本地项目模式',
      '当前 workspace 是用户绑定的真实本地文件夹。用户要求创建、修改、初始化、调试、构建前后端项目或源码文件时，必须优先直接操作 workspace 文件。',
      isSdkAgent
        ? '- 使用 SDK 自带的 Read / Write / Edit / Bash / shell 工具读写文件、安装依赖、运行构建与测试。'
        : '- 使用 fs_read / fs_write / bash 读写文件、安装依赖、运行构建与测试。',
      '- 不要用 write_artifact 保存应该落盘到本地项目的源码、package.json、tsconfig、server/client 文件或构建配置。',
      '- 如果本地项目已经构建出 dist / build / out / client/dist 等静态目录，可用 deploy_workspace 为该目录生成部署预览卡。',
      '- write_artifact 只用于用户明确要求 artifact / 可预览原型 / 独立 demo / 文档交接，或任务本身声明需要 artifact handoff。',
      '- 完成本地项目改动后，优先运行必要的验证命令（install / typecheck / build / test）；如果无法运行，说明具体原因。',
    ])
  } else if (workspace.mode === 'local' && tools.has('write_artifact')) {
    add([
      '## 本地项目模式',
      '当前 workspace 是用户绑定的真实本地文件夹，但这个 agent 没有文件/命令工具，不能直接修改本地项目。',
      '- 如果用户要求写入本地项目源码，应说明当前 agent 缺少 fs_read / fs_write / bash 或 SDK 本地工具，而不是用 write_artifact 假装已经落盘。',
      '- 只有用户明确要求 artifact / 可预览原型 / 独立 demo / 文档交接时，才使用 write_artifact。',
    ])
  }

  if (tools.has(ASK_USER_TOOL_NAME)) {
    add([
      '### ask_user',
      '用途：当继续执行前需要用户在有限方案中选择时，发起结构化问答；不要只在普通文本里问。',
      '正确案例：产品范围不清，调用 ask_user({ questions: [{ header: "范围", question: "这次先做哪个范围?", options: [{ label: "核心流程", description: "先打通主路径，风险最低" }, { label: "完整后台", description: "覆盖更多页面，但耗时更长" }] }] })。',
      '参数规则：每次 1-4 个 questions，每题 2-4 个 options；header 是短标签，question 是完整问题，label 是按钮短文本，description 写清选择后果。',
      '错误案例：直接回复“你想做核心流程还是完整后台？”然后停止；这样 UI 不会出现结构化选择，也不会阻塞 run 等待答案。',
      '不要滥用：开放式讨论、非关键细节、或可以保守决策时，直接说明假设并继续。',
    ])
  }

  if (tools.has('read_attachment')) {
    add([
      '### read_attachment',
      '用途：用户上传了文本/文件附件且任务依赖附件内容时，先读取附件；不要只凭文件名猜测。',
      '正确案例：看到上下文有 attachmentId="att_123"，调用 read_attachment({ attachmentId: "att_123" }) 后再总结或实现。',
      '常见错误：传 { id: "att_123" } 或把 art_* 产物 id 传给 read_attachment；产物必须用 read_artifact。',
      '错误案例：把“需求.docx”文件名当作完整需求内容。',
    ])
  }

  if (tools.has('read_artifact')) {
    add([
      '### read_artifact',
      '用途：需要基于已有产物继续设计、实现、审查或修改时，先读取完整产物内容。',
      '正确案例：上游只给出 <artifact id="art_123" />，调用 read_artifact({ artifactId: "art_123" })。',
      '常见错误：传 { id: "art_123" }、{ artifact_id: "art_123" }，或把 att_* 附件 id 传给 read_artifact。',
      '错误案例：只根据 artifact 标题或摘要判断内容，直接改写或审查。',
    ])
  }

  if (tools.has('write_artifact')) {
    add([
      '### write_artifact',
      '用途：创建用户需要预览、下载、交接或长期保存的产物；不要用它记录普通聊天结论。',
      '硬性要求：调用前必须已经准备好完整参数；严禁 write_artifact({})，严禁先空调用工具再补参数。',
      '调用前自检：type 必须是工具 schema 允许的枚举值，title 必须是非空字符串，content 必须是对应类型的原始对象。',
      'web_app 正确参数：write_artifact({ type: "web_app", title: "登录页原型", content: { files: { "index.html": "<!doctype html>...", "style.css": "body { ... }", "script.js": "..." }, entry: "index.html" } })。',
      'document 完整模板：write_artifact({ type: "document", title: "PRD", content: { format: "markdown", content: "# PRD\\n\\n## 1. 背景\\n...\\n\\n## 2. 目标\\n...\\n\\n## 3. 方案\\n..." } })。',
      'diagram 正确参数：write_artifact({ type: "diagram", title: "系统调用流程", content: { syntax: "mermaid", source: "flowchart TD\\n  U[\\"用户\\"] --> A[\\"AgentHub\\"]\\n  A --> LLM[\\"LLM\\"]\\n  LLM --> T[\\"工具调用\\"]", theme: "default" } })。适合流程图、时序图、架构图、依赖关系图；不要把 Mermaid 放进 document 代码块里冒充图产物。',
      'diagram 规则：中文、数学公式、括号、冒号、斜杠等 label 一律写成 A["..."]；一行只写一条边；不要把 ```mermaid fence 传给 source。write_artifact 会校验 Mermaid，若返回 Invalid Mermaid diagram，必须根据错误修正 source 后重新调用工具。',
      'ppt 正确参数：write_artifact({ type: "ppt", title: "Q2 复盘", content: { title: "Q2 复盘", theme: { primary: "1A3C6E", background: "F8F9FA", surface: "FFFFFF", textBody: "2C3E50", textMuted: "6B7280", accentPositive: "2B7A4B", accentNegative: "C0392B", divider: "E0E4E8", fontHeading: "Inter", fontBody: "Inter" }, slides: [{ title: "Q2 复盘", subtitle: "关键指标", layout: "metrics", blocks: [{ type: "metric", label: "ARR", value: "$12M", change: "+18%", tone: "positive" }, { type: "callout", title: "下一步", text: "聚焦企业客户扩张", tone: "info" }] }] } })。',
      'ppt 支持 blocks：heading、paragraph、bullets、metric、quote、timeline、columns、callout、divider、spacer；columns 内只放 paragraph/bullets/metric/callout。不要在 ppt JSON 里嵌入 base64/data URI 大资产。',
      '常见错误：把 content 作为 JSON 字符串传入，例如 content: "{\\"format\\":\\"markdown\\"}"；必须传原始对象。',
      '字段名必须是 parentArtifactId、outputKey；不要写 parent_artifact_id、output_key。',
      '如果子任务声明非 project 的 expectedOutputs，创建对应产物时传 outputKey 等于 expectedOutputs.id。',
      'project 产物不能用 write_artifact 创建；代码任务通过 fs_write / bash 写入 workspace 文件后由 AgentHub 自动生成 project。',
    ])
  }

  if (tools.has('deploy_artifact')) {
    add([
      '### deploy_artifact',
      '用途：web_app 产物完成后生成可打开的预览部署卡。',
      '正确流程：先 write_artifact 得到 artifactId="art_123"，再 deploy_artifact({ artifactId: "art_123" })。',
      '常见错误：传 { id: "art_123" }、传还没创建的 id、或对旧版本 id 误部署。',
      '错误案例：自己编造 http://localhost:3000/... 或公网域名；只能引用工具返回的 previewPath，或让用户点击部署卡按钮。',
      '不要对 document/image/ppt 调用 deploy_artifact；它只接受 web_app。',
    ])
  }

  if (tools.has('deploy_workspace')) {
    add([
      '### deploy_workspace',
      '用途：把当前 workspace 内已有的静态输出目录部署成预览卡，例如 dist、build、out、client/dist。',
      '正确流程：先用 bash 运行项目构建命令，确认静态目录存在且包含 index.html，再 deploy_workspace({ path: "dist", title: "前端构建预览" })。',
      '常见错误：把源码根目录、node_modules、server 目录传给 deploy_workspace；它只复制静态文件，不会自动构建或启动服务。',
      '如果项目是 Vite/React/Next 静态导出，优先部署构建输出目录，而不是创建 web_app artifact。',
    ])
  }

  if (
    !isPlanStage &&
    (tools.has('fs_list') || tools.has('fs_read') || tools.has('fs_write') || tools.has('bash'))
  ) {
    add([
      '### workspace 文件与命令工具',
      '用途：只操作当前 workspace 内的真实文件；路径必须在 <workspace_info><cwd> 下。',
      'fs_list 正确案例：fs_list({ path: "" }) 查看根目录；fs_list({ path: "src/server" }) 查看子目录。探索项目结构优先用 fs_list，不要先用 bash 拼目录命令。',
      'fs_read 正确案例：fs_read({ path: "src/app/page.tsx" })，先看现有代码再改。',
      'fs_write 正确案例：fs_write({ path: "src/app/page.tsx", content: "完整的新文件内容" })；content 是完整文件内容，不是 diff patch。',
      'bash 正确案例：bash({ command: "pnpm typecheck" })；子目录命令用 bash({ command: "pnpm build", cwd: "frontend", timeoutMs: 300000 })，不要写 cd frontend && pnpm build。',
      '临时启动服务测试时，必须在同一个 bash 命令里清理后台进程，例如 `npm run dev > /tmp/agenthub-dev.log 2>&1 & pid=$!; trap "kill $pid" EXIT; sleep 3; curl http://127.0.0.1:3000`；不要裸 `server &` 留长驻后台进程。',
      '常见错误：fs_write 只写局部 diff、bash 里 cd 到 workspace 外、裸 `cmd &` 留后台服务、或在 Windows workspace 用 POSIX-only 参数。',
      '错误案例：读取 ~/.ssh、/etc、仓库外路径，或在没有看文件的情况下覆盖代码。',
    ])
  }

  if (tools.has('plan_tasks')) {
    add([
      '### plan_tasks',
      '用途：Orchestrator 用结构化计划拆分子任务；执行顺序只认 dependsOn 字段。',
      '正确案例：实现依赖设计时，t2.dependsOn=["t1"]，不要只在 task 文本里写“基于 t1”。',
      '字段名必须是 agentId、dependsOn、expectedOutputs、acceptanceCriteria、taskKind、targetPaths、expectedWorkspaceChanges、requiredCommands、requiredEvidence；不要写 snake_case。',
      '文字型审查/诊断任务不要声明 expectedOutputs；把完成条件写进 acceptanceCriteria。',
      '代码任务正确案例：{ taskKind: "code", expectedOutputs: [{ id: "project", type: "project", required: true }], targetPaths: ["frontend/"], acceptanceCriteria: ["项目构建/编译验证通过"], requiredCommands: [{ command: "pnpm build", cwd: "frontend", timeoutMs: 300000 }], requiredEvidence: ["至少一条构建/编译/测试/类型检查命令 exitCode=0"] }。',
    ])
  }

  if (tools.has(REPORT_TASK_RESULT_TOOL_NAME)) {
    add([
      '### report_task_result',
      '用途：被 Orchestrator 分派的子任务结束前必须调用一次，报告真实语义结果。',
      '正确案例：report_task_result({ status: "complete", summary: "已实现并通过类型检查", filesChanged: [{ path: "src/server/foo.ts", action: "modified" }], commandsRun: [{ command: "pnpm test src/server/foo.test.ts", exitCode: 0 }], acceptanceResults: [{ criterion: "通过 typecheck", passed: true, evidence: "pnpm typecheck exited 0" }] })。',
      '字段名必须是 acceptanceResults、filesChanged、commandsRun、tests；不要写 snake_case。',
      '错误案例：代码部分完成、测试失败、或缺少依赖时仍上报 complete；应使用 failed 或 blocked 并说明原因。',
    ])
  }

  return sections.join('\n\n')
}

/**
 * 群聊场景追加到 system prompt 末尾的前缀语义说明。
 * 对应 conversation-context.ts 把别 agent 发言渲染成 `[名字] ...` user 消息的契约。
 * 详见 specs/13-conversation-context.md「群聊 / Orchestrator」节。
 */
const GROUP_CHAT_SYSTEM_NOTE = [
  '## 群聊上下文',
  '当前会话是多 Agent 群聊。历史里其他成员（含 Orchestrator）的发言，会以 `[成员名] ` 前缀的 user 消息出现。',
  '- 带 `[名字]` 前缀的 user 消息是别的成员说的，不是你自己的输出，也不是用户的直接指令——按需参考即可。',
  '- 不带前缀的 user 消息才是用户本人发给群里的话。',
  '- 历史里的产物只折叠成 `[产物: 标题 (id=...)]` 占位；需要完整内容时用 read_artifact 按 id 获取，不要凭占位臆测。',
].join('\n')

function buildOrchestratorPlanPrompt(
  baseSystemPrompt: string,
  otherAgents: AgentRow[],
  workspace: WorkspaceRow,
): string {
  const agentList = otherAgents
    .map(
      (a) =>
        `- { id: ${JSON.stringify(a.id)}, name: ${JSON.stringify(a.name)}, capabilities: ${JSON.stringify(
          a.capabilities,
        )}, tools: ${JSON.stringify(a.toolNames)}, description: ${JSON.stringify(a.description)} }`,
    )
    .join('\n')
  const localWorkspaceRules =
    workspace.mode === 'local'
      ? [
          '',
          '## 本地 workspace 规划规则',
          '- 用户要求在当前文件夹创建 / 修改 / 初始化 / 调试前后端项目或源码文件时，优先派给具备 fs_read / fs_write / bash 或 SDK 本地工具的 agent。',
          '- 这类本地代码任务不要声明 expectedOutputs；用 acceptanceCriteria 描述应落盘的目录、文件、命令和验证结果。',
          '- 子任务文本必须明确写出“直接修改当前本地 workspace 文件，不要用 write_artifact 代替源码落盘”。',
          '- 只有需要聊天内交付的独立文档、设计稿、可预览原型或 artifact handoff，才声明 expectedOutputs。',
        ]
      : []

  return [
    baseSystemPrompt,
    '',
    '## 你的工作流',
    '1. 阅读用户最新请求与上下文。',
    '2. 如果存在会阻塞正确规划的关键歧义，且能归纳为 2-4 个清晰选项，先调用 ask_user 让用户选择；拿到答案后继续。',
    '3. 调用 plan_tasks 工具，输出结构化 plan。',
    '4. 系统会自动执行 plan 并把子任务结果回传给你，由你做最终总结。',
    '',
    '## 可用 Agent',
    agentList.length > 0 ? agentList : '（无）',
    '',
    '## 拆解原则',
    '- 充分利用每个 Agent 的 capabilities，不要把任务派给不合适的人。',
    '- 每个子任务必须独立可执行（被分派的 Agent 看不到完整群聊上下文，必要上下文要写进 task）。',
    '- 计划阶段只能调用 ask_user、plan_tasks 和只读侦察工具（fs_list/fs_read/read_artifact/read_attachment）；不要写文件或执行命令。',
    '- 若用户需求已足够明确，不要为了形式感提问，直接 plan_tasks。',
    '',
    '## 依赖关系（执行顺序的唯一来源，务必读完）',
    '- 系统【只】按每个任务的 dependsOn 决定顺序：dependsOn 为空的任务会【同时并发】启动。',
    '- 若任务 B 需要任务 A 的产物 / 结论 / 输出，你【必须】在 B 的 dependsOn 里写上 A 的 id。',
    '- 在 task 文本里写「先做 A」「基于上一步」之类【没有任何效果】——执行顺序只认 dependsOn 字段。',
    '- 只有彼此真正无关、可同时进行的任务才留空 dependsOn；拿不准时倾向加依赖（串行更安全）。',
    '- Code implementation tasks MUST set taskKind="code", declare expectedOutputs:[{ id:"project", type:"project", required:true }], and include an acceptanceCriteria item requiring build/compile/test/typecheck to pass.',
    '- project expectedOutputs are system-created from workspace file writes; do not ask the child agent to call write_artifact for project.',
    '- Only declare non-project expectedOutputs when the assigned agent must create a real artifact via write_artifact for downstream handoff or user inspection.',
    '- Do NOT declare expectedOutputs for text-only tasks such as review, validation, diagnosis, status check, explanation, or summary; put their completion checks in acceptanceCriteria.',
    '- If a task needs an upstream artifact, declare inputs with fromTaskId and outputId; the system will compile these into dependencies.',
    '- For tasks with quality requirements, add concise acceptanceCriteria that the assigned agent can verify.',
    ...localWorkspaceRules,
    '- For code or test tasks, set taskKind and declare targetPaths, expectedWorkspaceChanges, requiredCommands, and requiredEvidence whenever possible.',
    '- Frontend and backend implementation tasks usually both depend on PRD/API contracts, not on each other; plan them as parallel siblings unless one truly consumes the other output.',
    '- Prefer requiredCommands with cwd, for example { command: "pnpm build", cwd: "frontend", timeoutMs: 300000 }; avoid encoding directory changes as "cd frontend && ...".',
    '- A retry/remediation plan must preserve the original user goal. Do not replace implementation work with a narrower review-only task unless the user explicitly approved that scope change.',
    ...localWorkspaceRules,
    '',
    '示例（设计 → 前端 → 审查，逐级依赖；agentId 用上面可用列表里的真实 id）：',
    'tasks: [',
    '  { "id": "t1", "agentId": "<设计师 id>", "task": "产出 UI 设计稿" },',
    '  { "id": "t2", "agentId": "<前端 id>", "task": "按设计稿实现页面", "dependsOn": ["t1"] },',
    '  { "id": "t3", "agentId": "<Reviewer id>", "task": "审查 t2 的实现", "dependsOn": ["t2"] }',
    ']',
  ].join('\n')
}

function buildOrchestratorAggregatePrompt(baseSystemPrompt: string): string {
  return [
    baseSystemPrompt,
    '',
    '## 当前阶段',
    '你处于「聚合阶段」。所有子任务已执行完成（含成功与失败），结果在 user 消息中以 XML 给出。',
    '请直接给用户输出一条总结消息：',
    '- 简明列出完成 / 失败的任务',
    '- 如果存在 failed / skipped / aborted 任务，必须明确说明整体未完成，不要把局部成功说成全部完成',
    '- 用 <artifact_ref id="art_xxx"/> 形式引用关键产物（如果有）',
    '- 给出明确的下一步建议',
    '不要再调用 plan_tasks，不要把任务再次分派。',
  ].join('\n')
}

async function buildSubAgentPrompt(
  task: DispatchPlanItem,
  upstream: Map<string, DispatchTaskResult>,
  conversationId: string,
  plan: DispatchPlanItem[],
  resolvedInputs: ResolvedTaskInput[],
  workspace: WorkspaceRow,
): Promise<string> {
  // 收集已完成上游任务的 artifact 列表，作为隐式上下文。
  // 使用传递依赖闭包，避免 Review 只看到直接上游实现而看不到 PRD / UI 设计。
  const upstreamArtifactIds = new Set<string>()
  for (const dep of collectDependencyClosure(plan, task.id)) {
    const r = upstream.get(dep)
    if (r) {
      for (const artifactId of r.artifactIds) upstreamArtifactIds.add(artifactId)
    }
  }

  let upstreamArtifactsXml = ''
  if (upstreamArtifactIds.size > 0) {
    const artifacts = await db.query.artifacts.findMany({
      where: inArray(schema.artifacts.id, [...upstreamArtifactIds]),
    })
    upstreamArtifactsXml = artifacts.map(renderArtifactSummaryXml).join('\n')
  }

  const existing = await db.query.artifacts.findMany({
    where: eq(schema.artifacts.conversationId, conversationId),
    orderBy: [desc(schema.artifacts.createdAt)],
  })
  const existingXml = existing
    .filter((a) => !upstreamArtifactIds.has(a.id))
    .slice(0, SUB_AGENT_CONTEXT_RECENT_LIMIT)
    .map(renderArtifactSummaryXml)
    .join('\n')

  // spec 06 §「子 Agent 看到的上下文」要求注入最近 N 条群聊 + 全部 pin。
  const latestSummary = await getLatestContextSummary(conversationId)
  const recentWhere = latestSummary
    ? and(
        eq(schema.messages.conversationId, conversationId),
        eq(schema.messages.status, 'complete'),
        gt(schema.messages.createdAt, latestSummary.coveredUntilCreatedAt),
      )
    : and(
        eq(schema.messages.conversationId, conversationId),
        eq(schema.messages.status, 'complete'),
      )
  const recent = (
    await db.query.messages.findMany({
      where: recentWhere,
      orderBy: [desc(schema.messages.createdAt)],
      limit: SUB_AGENT_CONTEXT_RECENT_LIMIT,
    })
  ).reverse()

  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  const pinIds = conv?.pinnedMessageIds ?? []
  const pinned = pinIds.length
    ? await db.query.messages.findMany({
        where: inArray(schema.messages.id, pinIds),
        orderBy: [schema.messages.createdAt],
      })
    : []

  // 一次性查所有出现过的 agent name，避免循环里 N+1
  const agentIds = new Set<string>()
  for (const m of [...recent, ...pinned]) if (m.agentId) agentIds.add(m.agentId)
  const agents = agentIds.size
    ? await db.query.agents.findMany({
        where: inArray(schema.agents.id, [...agentIds]),
      })
    : []
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]))

  const renderMessage = (m: MessageRow): string => {
    const from =
      m.role === 'user' ? 'user' : (m.agentId && agentNameById.get(m.agentId)) || m.role
    const text = extractTextFromParts(m.parts).trim()
    if (!text) return ''
    return `    <message from=${JSON.stringify(from)}>${escapeXml(text)}</message>`
  }

  const recentXml = recent.map(renderMessage).filter(Boolean).join('\n')
  const pinnedXml = pinned.map(renderMessage).filter(Boolean).join('\n')
  const summaryXml = latestSummary
    ? renderConversationSummaryBlock(latestSummary)
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n')
    : ''
  const taskInputsXml = renderTaskInputsXml(resolvedInputs)
  const expectedOutputsXml = renderExpectedOutputsXml(task.expectedOutputs ?? [])
  const acceptanceCriteriaXml = renderAcceptanceCriteriaXml(task.acceptanceCriteria ?? [])
  const evidenceContractXml = renderTaskEvidenceContractXml(task)

  return [
    '<context>',
    summaryXml,
    recentXml && `  <recent_conversation>\n${recentXml}\n  </recent_conversation>`,
    pinnedXml && `  <pinned_messages>\n${pinnedXml}\n  </pinned_messages>`,
    taskInputsXml && `  <required_inputs>\n${taskInputsXml}\n  </required_inputs>`,
    expectedOutputsXml && `  <expected_outputs>\n${expectedOutputsXml}\n  </expected_outputs>`,
    acceptanceCriteriaXml &&
      `  <acceptance_criteria>\n${acceptanceCriteriaXml}\n  </acceptance_criteria>`,
    evidenceContractXml && `  <evidence_contract>\n${evidenceContractXml}\n  </evidence_contract>`,
    upstreamArtifactsXml &&
      `  <upstream_artifacts>\n${upstreamArtifactsXml}\n  </upstream_artifacts>`,
    `  <existing_artifacts>\n${existingXml || '    （无）'}\n  </existing_artifacts>`,
    '</context>',
    '',
    '<your_task>',
    task.task,
    '</your_task>',
    '',
    'Before working, read every required input artifact with read_artifact(artifactId).',
    workspace.mode === 'local' &&
      'If this task is about local project source files, directly modify the current local workspace with file/command tools. Do not use write_artifact to store source files that should be written to disk.',
    'For expected_outputs with type="project", write the project files into the workspace with fs_write or bash; AgentHub will create and bind the project artifact automatically. Do not call write_artifact for project.',
    'For non-project expected_outputs, create the artifact with write_artifact and pass outputKey equal to that output id.',
    'If no expected_outputs are declared, complete the task with a normal message; do not create an artifact just to satisfy status tracking.',
    'Satisfy every acceptance_criteria item when present.',
    'If evidence_contract is present, include matching filesChanged, commandsRun, tests, and/or acceptanceResults evidence in report_task_result.',
    'For required_commands, you may run the command yourself, and AgentHub will also run it as a completion gate after your attempt. Use bash cwd instead of cd when running commands in subdirectories.',
    'If dependencies are missing, install them inside the workspace and continue; dependency installation is preparation, not completion evidence.',
    'If a required command fails, fix the issue and continue; do not report complete until the command can pass.',
    'For target_paths, list every changed or verified path in report_task_result.filesChanged.',
    'At the end, call report_task_result exactly once. A normal text response alone does not complete this dispatched task.',
    'Use report_task_result.status="complete" only when you have FULLY accomplished the assigned task.',
    'Never report complete if tests are failing, implementation is partial, unresolved errors remain, or you could not find necessary files/dependencies.',
    'If acceptance_criteria are present, include acceptanceResults and copy each criterion string exactly with passed/evidence.',
    'Use status="failed" when the task was attempted but did not satisfy the assignment; use status="blocked" when external input or unavailable prerequisites prevent progress.',
    '',
    '执行任务，必要时通过 read_artifact 获取上游产物详情。',
  ]
    .filter(Boolean)
    .join('\n')
}

function renderTaskInputsXml(inputs: ResolvedTaskInput[]): string {
  return inputs
    .map(({ input, type, artifactId, missing }) => {
      const attrs = [
        `fromTaskId=${xmlAttr(input.fromTaskId)}`,
        `outputId=${xmlAttr(input.outputId)}`,
        `required=${xmlAttr(input.required === false ? 'false' : 'true')}`,
        type && `type=${xmlAttr(type)}`,
        artifactId && `artifactId=${xmlAttr(artifactId)}`,
        missing && 'missing="true"',
      ]
        .filter(Boolean)
        .join(' ')
      const description = input.description ? escapeXml(input.description) : ''
      return description ? `    <input ${attrs}>${description}</input>` : `    <input ${attrs} />`
    })
    .join('\n')
}

function renderExpectedOutputsXml(outputs: DispatchExpectedOutput[]): string {
  return outputs
    .map((output) => {
      const attrs = [
        `id=${xmlAttr(output.id)}`,
        `type=${xmlAttr(output.type)}`,
        `required=${xmlAttr(output.required === false ? 'false' : 'true')}`,
      ].join(' ')
      const description = output.description ? escapeXml(output.description) : ''
      return description ? `    <output ${attrs}>${description}</output>` : `    <output ${attrs} />`
    })
    .join('\n')
}

function renderAcceptanceCriteriaXml(criteria: string[]): string {
  return criteria.map((criterion) => `    <item>${escapeXml(criterion)}</item>`).join('\n')
}

function renderTaskEvidenceContractXml(task: DispatchPlanItem): string {
  const lines: string[] = []
  if (task.taskKind) lines.push(`    <task_kind>${escapeXml(task.taskKind)}</task_kind>`)
  for (const targetPath of task.targetPaths ?? []) {
    lines.push(`    <target_path>${escapeXml(targetPath)}</target_path>`)
  }
  for (const change of task.expectedWorkspaceChanges ?? []) {
    lines.push(`    <expected_workspace_change>${escapeXml(change)}</expected_workspace_change>`)
  }
  for (const requiredCommand of task.requiredCommands ?? []) {
    const description = requiredCommand.description ? escapeXml(requiredCommand.description) : ''
    const attrs = [
      `command=${xmlAttr(requiredCommand.command)}`,
      requiredCommand.cwd ? `cwd=${xmlAttr(requiredCommand.cwd)}` : '',
      requiredCommand.timeoutMs ? `timeoutMs=${xmlAttr(String(requiredCommand.timeoutMs))}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    lines.push(
      description ? `    <required_command ${attrs}>${description}</required_command>` : `    <required_command ${attrs} />`,
    )
  }
  for (const evidence of task.requiredEvidence ?? []) {
    lines.push(`    <required_evidence>${escapeXml(evidence)}</required_evidence>`)
  }
  return lines.join('\n')
}

function renderArtifactSummaryXml(artifact: ArtifactRow): string {
  return `  <artifact id="${artifact.id}" type="${artifact.type}" title=${JSON.stringify(artifact.title)} />`
}

function xmlAttr(s: string): string {
  return `"${escapeXml(s).replace(/"/g, '&quot;')}"`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function buildAggregatePrompt(
  originalUserPrompt: string,
  plan: DispatchPlanItem[],
  taskResults: Map<string, DispatchTaskResult>,
  conflicts: FileWriteConflict[],
  workspace: WorkspaceRow,
): Promise<string> {
  const allArtifactIds = [...taskResults.values()].flatMap((r) => r.artifactIds)
  const artifacts =
    allArtifactIds.length > 0
      ? await db.query.artifacts.findMany({
          where: inArray(schema.artifacts.id, allArtifactIds),
        })
      : []
  const artifactById = new Map<string, ArtifactRow>(artifacts.map((a) => [a.id, a]))

  const resultsXml = plan
    .map((t) => {
      const r = taskResults.get(t.id)
      if (!r) return ''
      const outputKeyByArtifactId = new Map(
        Object.entries(r.outputArtifacts).map(([outputKey, artifactId]) => [artifactId, outputKey]),
      )
      const arts = r.artifactIds
        .map((id) => artifactById.get(id))
        .filter(Boolean)
        .map((a) => {
          const outputKey = outputKeyByArtifactId.get(a!.id)
          const outputAttr = outputKey ? ` outputKey=${JSON.stringify(outputKey)}` : ''
          return `    <artifact id="${a!.id}" type="${a!.type}"${outputAttr} title=${JSON.stringify(a!.title)} />`
        })
        .join('\n')
      const report = r.taskReport ? renderTaskResultReportXml(r.taskReport) : ''
      const innerContent = [report, arts].filter(Boolean).join('\n')
      const inner = innerContent ? `\n${innerContent}\n  ` : ''
      const errAttr = r.error ? ` error=${JSON.stringify(r.error)}` : ''
      return `  <result task="${t.id}" agent="${t.agentId}" status="${r.status}"${errAttr}>${inner}</result>`
    })
    .filter(Boolean)
    .join('\n')

  const lines = [
    `<user_request>${originalUserPrompt}</user_request>`,
    '<task_results>',
    resultsXml,
    '</task_results>',
  ]

  if (conflicts.length > 0) {
    const cwd = getEffectiveCwd(workspace)
    const toRel = (abs: string) =>
      abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^[\\/]+/, '') : abs
    lines.push(
      '<file_conflicts>',
      '  <!-- 多个并行子任务写了同一文件，后写已覆盖先写。请在总结里明确告知用户：哪个文件、涉及哪些任务、当前保留的是最后写入的版本，并建议如何处理（例如改为串行重做或人工合并）。 -->',
      ...conflicts.map((c) => {
        const tasks = c.contributors.map((w) => `${w.taskId}(${w.agentId})`).join(', ')
        return `  <conflict path=${JSON.stringify(toRel(c.path))} tasks=${JSON.stringify(tasks)} />`
      }),
      '</file_conflicts>',
    )
  }

  lines.push('', '请基于以上结果给用户输出最终总结消息。')
  return lines.join('\n')
}

function renderTaskResultReportXml(report: TaskResultReport): string {
  const children = [`      <summary>${escapeXml(report.summary)}</summary>`]
  for (const result of report.acceptanceResults ?? []) {
    children.push(
      `      <acceptance criterion=${xmlAttr(result.criterion)} passed=${xmlAttr(String(result.passed))}>${escapeXml(result.evidence)}</acceptance>`,
    )
  }
  for (const file of report.filesChanged ?? []) {
    const actionAttr = file.action ? ` action=${xmlAttr(file.action)}` : ''
    children.push(`      <file path=${xmlAttr(file.path)}${actionAttr} />`)
  }
  for (const command of report.commandsRun ?? []) {
    const summary = command.summary ? escapeXml(command.summary) : ''
    const attrs = [
      `command=${xmlAttr(command.command)}`,
      `exitCode=${xmlAttr(String(command.exitCode))}`,
      command.cwd ? `cwd=${xmlAttr(command.cwd)}` : '',
      command.timedOut !== undefined ? `timedOut=${xmlAttr(String(command.timedOut))}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    children.push(
      summary
        ? `      <command ${attrs}>${summary}</command>`
        : `      <command ${attrs} />`,
    )
  }
  for (const test of report.tests ?? []) {
    const summary = test.summary ? escapeXml(test.summary) : ''
    children.push(
      summary
        ? `      <test command=${xmlAttr(test.command)} passed=${xmlAttr(String(test.passed))}>${summary}</test>`
        : `      <test command=${xmlAttr(test.command)} passed=${xmlAttr(String(test.passed))} />`,
    )
  }
  for (const blocker of report.blockers ?? []) {
    children.push(`      <blocker>${escapeXml(blocker)}</blocker>`)
  }
  return [
    `    <task_report status=${xmlAttr(report.status)}>`,
    ...children,
    '    </task_report>',
  ].join('\n')
}

// ─── 杂项 ──────────────────────────────────────────────────
function extractTextFromParts(parts: MessagePart[]): string {
  return parts
    .map((p) => {
      if (p.type === 'text' || p.type === 'thinking') return p.content
      if (p.type === 'code') return '```' + p.language + '\n' + p.content + '\n```'
      if (p.type === 'image_attachment') {
        return `[图片附件: ${p.fileName} (${formatSize(p.size)}, ${p.mimeType}) · id=${p.attachmentId}]`
      }
      if (p.type === 'file_attachment') {
        return `[文件附件: ${p.fileName} (${formatSize(p.size)}, ${p.mimeType}) · id=${p.attachmentId}]`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function ensureIncludes(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr : [...arr, v]
}

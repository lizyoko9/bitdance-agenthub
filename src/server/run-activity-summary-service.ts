import { desc, inArray } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type { AgentRunRow, EmployeeRunRow, RunStatus } from '@/db/schema'
import {
  resolveRunActivityBrainStatus,
  type RunActivityBrainStatus,
} from '@/lib/run-activity-brain-status'

export type RunActivityKind = 'employee_run' | 'agent_run'

export interface RunActivitySummaryRun {
  id: string
  kind: RunActivityKind
  title: string
  status: RunStatus | AgentRunRow['status']
  agentName: string | null
  phase: string
  currentStep: string
  startedAt: number
  updatedAt: number
  artifactCount: number
  toolActionCount: number
  brainStatus: RunActivityBrainStatus
  brainLabel: string
}

export interface RunActivitySummaryEvent {
  id: string
  runId: string
  kind: 'employee_event' | 'agent_run'
  phase: string
  status: string
  message: string
  createdAt: number
}

export interface RunActivitySummary {
  totals: {
    running: number
    queued: number
    completedToday: number
    failedToday: number
    toolActions: number
    artifacts: number
  }
  recentRuns: RunActivitySummaryRun[]
  recentEvents: RunActivitySummaryEvent[]
}

const RECENT_RUN_LIMIT = 10
const RECENT_EVENT_LIMIT = 20
const TODAY_MS = 24 * 60 * 60 * 1000

export async function getRunActivitySummary(): Promise<RunActivitySummary> {
  const now = Date.now()
  const todayStart = now - TODAY_MS

  const [
    employeeRuns,
    agentRuns,
    agentProfiles,
    agents,
    artifacts,
    multimodalOutputs,
    cliRuns,
    mcpToolCalls,
    computerActionEvents,
  ] = await Promise.all([
    db.query.employeeRuns.findMany({
      orderBy: [desc(schema.employeeRuns.createdAt)],
      limit: 100,
    }),
    db.query.agentRuns.findMany({
      orderBy: [desc(schema.agentRuns.startedAt)],
      limit: 100,
    }),
    db.query.agentProfiles.findMany(),
    db.query.agents.findMany(),
    db.query.artifacts.findMany({
      orderBy: [desc(schema.artifacts.createdAt)],
      limit: 200,
    }),
    db.query.multimodalOutputs.findMany({
      orderBy: [desc(schema.multimodalOutputs.createdAt)],
      limit: 200,
    }),
    db.query.cliRuns.findMany({
      orderBy: [desc(schema.cliRuns.createdAt)],
      limit: 200,
    }),
    db.query.mcpToolCalls.findMany({
      orderBy: [desc(schema.mcpToolCalls.createdAt)],
      limit: 200,
    }),
    db.query.computerActionEvents.findMany({
      orderBy: [desc(schema.computerActionEvents.createdAt)],
      limit: 200,
    }),
  ])

  const employeeRunIds = employeeRuns.slice(0, RECENT_RUN_LIMIT).map((run) => run.id)
  const [employeeEvents, runReflections, runMemories, runLearningEvents] = employeeRunIds.length
    ? await Promise.all([
        db.query.employeeRunEvents.findMany({
          where: inArray(schema.employeeRunEvents.employeeRunId, employeeRunIds),
          orderBy: [desc(schema.employeeRunEvents.createdAt)],
          limit: RECENT_EVENT_LIMIT,
        }),
        db.query.runReflections.findMany({
          where: inArray(schema.runReflections.runId, employeeRunIds),
          orderBy: [desc(schema.runReflections.createdAt)],
          limit: 100,
        }),
        db.query.memoryItems.findMany({
          where: inArray(schema.memoryItems.sourceRunId, employeeRunIds),
          orderBy: [desc(schema.memoryItems.createdAt)],
          limit: 100,
        }),
        db.query.learningEvents.findMany({
          where: inArray(schema.learningEvents.runId, employeeRunIds),
          orderBy: [desc(schema.learningEvents.createdAt)],
          limit: 100,
        }),
      ])
    : [[], [], [], []]

  const profileNames = new Map(agentProfiles.map((profile) => [profile.id, profile.name]))
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]))
  const artifactCountByConversation = countBy(artifacts, (artifact) => artifact.conversationId)
  const artifactCountByEmployeeRun = countBy(
    multimodalOutputs.filter((output) => Boolean(output.artifactId || output.path)),
    (output) => output.employeeRunId ?? '',
  )
  const toolCountByEmployeeRun = new Map<string, number>()
  for (const row of cliRuns) increment(toolCountByEmployeeRun, row.employeeRunId ?? '')
  for (const row of mcpToolCalls) increment(toolCountByEmployeeRun, row.employeeRunId ?? '')
  for (const row of computerActionEvents) increment(toolCountByEmployeeRun, row.employeeRunId ?? '')
  const reflectionByEmployeeRun = new Set(runReflections.map((reflection) => reflection.runId))
  const memoryCountByEmployeeRun = countBy(runMemories, (memory) => memory.sourceRunId ?? '')
  const pendingLearningCountByEmployeeRun = countBy(
    runLearningEvents.filter((event) => event.status === 'pending_review'),
    (event) => event.runId,
  )
  const failureCountByEmployeeRun = new Map<string, number>()
  for (const reflection of runReflections) {
    if (reflection.whatFailed.length > 0) {
      failureCountByEmployeeRun.set(
        reflection.runId,
        (failureCountByEmployeeRun.get(reflection.runId) ?? 0) + reflection.whatFailed.length,
      )
    }
  }
  for (const memory of runMemories) {
    if (memory.type === 'mistake') increment(failureCountByEmployeeRun, memory.sourceRunId ?? '')
  }

  const recentEmployeeRuns = employeeRuns.slice(0, RECENT_RUN_LIMIT).map((run) =>
    employeeRunToActivity(run, {
      agentName: profileNames.get(run.agentProfileId) ?? null,
      artifactCount: artifactCountByEmployeeRun.get(run.id) ?? 0,
      toolActionCount: toolCountByEmployeeRun.get(run.id) ?? 0,
      hasReflection: reflectionByEmployeeRun.has(run.id),
      memoryCount: memoryCountByEmployeeRun.get(run.id) ?? 0,
      pendingLearningCount: pendingLearningCountByEmployeeRun.get(run.id) ?? 0,
      failureCount: failureCountByEmployeeRun.get(run.id) ?? 0,
    }),
  )
  const recentAgentRuns = agentRuns.slice(0, RECENT_RUN_LIMIT).map((run) =>
    agentRunToActivity(run, {
      agentName: agentNames.get(run.agentId) ?? null,
      artifactCount: artifactCountByConversation.get(run.conversationId) ?? 0,
    }),
  )

  const recentRuns = [...recentEmployeeRuns, ...recentAgentRuns]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_RUN_LIMIT)

  const recentEvents: RunActivitySummaryEvent[] = [
    ...employeeEvents.map((event) => ({
      id: event.id,
      runId: event.employeeRunId,
      kind: 'employee_event' as const,
      phase: event.phase,
      status: event.type,
      message: event.message,
      createdAt: event.createdAt,
    })),
    ...agentRuns.slice(0, 6).map((run) => ({
      id: `${run.id}:status`,
      runId: run.id,
      kind: 'agent_run' as const,
      phase: run.status,
      status: run.status,
      message: run.error ?? `${agentNames.get(run.agentId) ?? 'Agent'} ${statusToChinese(run.status)}`,
      createdAt: run.finishedAt ?? run.startedAt,
    })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENT_EVENT_LIMIT)

  return {
    totals: {
      running: employeeRuns.filter((run) => run.status === 'running').length +
        agentRuns.filter((run) => run.status === 'running').length,
      queued: employeeRuns.filter((run) => run.status === 'queued').length +
        agentRuns.filter((run) => run.status === 'queued').length,
      completedToday: employeeRuns.filter((run) => isCompletedToday(run, todayStart)).length +
        agentRuns.filter((run) => isAgentCompletedToday(run, todayStart)).length,
      failedToday: employeeRuns.filter((run) => isFailedToday(run, todayStart)).length +
        agentRuns.filter((run) => isAgentFailedToday(run, todayStart)).length,
      toolActions: cliRuns.length + mcpToolCalls.length + computerActionEvents.length,
      artifacts: artifacts.length + multimodalOutputs.filter((output) => output.artifactId || output.path).length,
    },
    recentRuns,
    recentEvents,
  }
}

function employeeRunToActivity(
  run: EmployeeRunRow,
  details: {
    agentName: string | null
    artifactCount: number
    toolActionCount: number
    hasReflection: boolean
    memoryCount: number
    pendingLearningCount: number
    failureCount: number
  },
): RunActivitySummaryRun {
  const brain = resolveRunActivityBrainStatus({
    kind: 'employee_run',
    hasReflection: details.hasReflection,
    failureCount: details.failureCount,
    memoryCount: details.memoryCount,
    pendingLearningCount: details.pendingLearningCount,
  })
  return {
    id: run.id,
    kind: 'employee_run',
    title: run.goal,
    status: run.status,
    agentName: details.agentName,
    phase: run.currentPhase,
    currentStep: run.currentStep ?? phaseToChinese(run.currentPhase),
    startedAt: run.startedAt ?? run.createdAt,
    updatedAt: run.finishedAt ?? run.updatedAt,
    artifactCount: details.artifactCount,
    toolActionCount: details.toolActionCount,
    brainStatus: brain.status,
    brainLabel: brain.label,
  }
}

function agentRunToActivity(
  run: AgentRunRow,
  details: { agentName: string | null; artifactCount: number },
): RunActivitySummaryRun {
  const brain = resolveRunActivityBrainStatus({
    kind: 'agent_run',
    hasReflection: false,
    failureCount: 0,
    memoryCount: 0,
    pendingLearningCount: 0,
  })
  return {
    id: run.id,
    kind: 'agent_run',
    title: details.agentName ? `${details.agentName} 的对话执行` : '普通模型执行',
    status: run.status,
    agentName: details.agentName,
    phase: run.status,
    currentStep: run.error ?? statusToChinese(run.status),
    startedAt: run.startedAt,
    updatedAt: run.finishedAt ?? run.startedAt,
    artifactCount: details.artifactCount,
    toolActionCount: 0,
    brainStatus: brain.status,
    brainLabel: brain.label,
  }
}

function countBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) increment(counts, keyOf(row))
  return counts
}

function increment(map: Map<string, number>, key: string) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

function isCompletedToday(run: EmployeeRunRow, todayStart: number) {
  return run.status === 'complete' && (run.finishedAt ?? run.updatedAt) >= todayStart
}

function isAgentCompletedToday(run: AgentRunRow, todayStart: number) {
  return run.status === 'complete' && (run.finishedAt ?? run.startedAt) >= todayStart
}

function isFailedToday(run: EmployeeRunRow, todayStart: number) {
  return (run.status === 'failed' || run.status === 'aborted') && (run.finishedAt ?? run.updatedAt) >= todayStart
}

function isAgentFailedToday(run: AgentRunRow, todayStart: number) {
  return (run.status === 'failed' || run.status === 'aborted') && (run.finishedAt ?? run.startedAt) >= todayStart
}

function statusToChinese(status: string) {
  if (status === 'running') return '正在执行'
  if (status === 'queued') return '排队中'
  if (status === 'complete') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'aborted') return '已停止'
  if (status === 'paused') return '已暂停'
  return status
}

function phaseToChinese(phase: string) {
  const table: Record<string, string> = {
    queued: '等待分配',
    understand_goal: '理解目标',
    retrieve_memory: '检索记忆',
    create_plan: '制定计划',
    execute_action: '执行工具动作',
    verify_result: '验证结果',
    produce_artifact: '生成产物',
    reflect: '总结学习',
  }
  return table[phase] ?? phase
}

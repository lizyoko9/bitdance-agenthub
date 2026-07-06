import {
  resolveRunActivityBrainStatus,
  type RunActivityBrainStatus,
} from './run-activity-brain-status'

export interface WorkflowNodeBrainStatus {
  nodeRunId: string
  nodeId: string
  employeeRunId: string | null
  status: RunActivityBrainStatus
  label: string
}

export interface WorkflowNodeBrainStatusInput {
  nodeRuns: Array<{
    id: string
    nodeId: string
    output: unknown
  }>
  employeeRuns: Array<{
    id: string
  }>
  reflections: Array<{
    runId: string
    whatFailed: string[]
  }>
  memories: Array<{
    sourceRunId: string | null
    type: string
  }>
  learningEvents: Array<{
    runId: string
    status: string
  }>
}

export function buildWorkflowNodeBrainStatuses(
  input: WorkflowNodeBrainStatusInput,
): WorkflowNodeBrainStatus[] {
  const employeeRunIds = new Set(input.employeeRuns.map((run) => run.id))
  const reflectionByRun = new Set(input.reflections.map((reflection) => reflection.runId))
  const memoryCountByRun = countBy(input.memories, (memory) => memory.sourceRunId ?? '')
  const pendingLearningCountByRun = countBy(
    input.learningEvents.filter((event) => event.status === 'pending_review'),
    (event) => event.runId,
  )
  const failureCountByRun = new Map<string, number>()
  for (const reflection of input.reflections) {
    if (reflection.whatFailed.length > 0) {
      failureCountByRun.set(
        reflection.runId,
        (failureCountByRun.get(reflection.runId) ?? 0) + reflection.whatFailed.length,
      )
    }
  }
  for (const memory of input.memories) {
    if (memory.type === 'mistake') increment(failureCountByRun, memory.sourceRunId ?? '')
  }

  return input.nodeRuns.map((nodeRun) => {
    const employeeRunId = readEmployeeRunId(nodeRun.output)
    if (!employeeRunId || !employeeRunIds.has(employeeRunId)) {
      return {
        nodeRunId: nodeRun.id,
        nodeId: nodeRun.nodeId,
        employeeRunId: null,
        status: 'not_applicable',
        label: '无员工运行',
      }
    }
    const brain = resolveRunActivityBrainStatus({
      kind: 'employee_run',
      hasReflection: reflectionByRun.has(employeeRunId),
      failureCount: failureCountByRun.get(employeeRunId) ?? 0,
      memoryCount: memoryCountByRun.get(employeeRunId) ?? 0,
      pendingLearningCount: pendingLearningCountByRun.get(employeeRunId) ?? 0,
    })
    return {
      nodeRunId: nodeRun.id,
      nodeId: nodeRun.nodeId,
      employeeRunId,
      status: brain.status,
      label: brain.label,
    }
  })
}

function readEmployeeRunId(output: unknown): string | null {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return null
  const value = (output as Record<string, unknown>).employeeRunId
  return typeof value === 'string' && value.trim() ? value.trim() : null
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

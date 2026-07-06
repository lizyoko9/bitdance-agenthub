export type RunActivityBrainStatus =
  | 'not_applicable'
  | 'waiting_reflection'
  | 'learned'
  | 'needs_review'
  | 'failure_lesson'

export interface RunActivityBrainStatusInput {
  kind: 'employee_run' | 'agent_run'
  hasReflection: boolean
  failureCount: number
  memoryCount: number
  pendingLearningCount: number
}

export interface RunActivityBrainStatusView {
  status: RunActivityBrainStatus
  label: string
}

export function resolveRunActivityBrainStatus(
  input: RunActivityBrainStatusInput,
): RunActivityBrainStatusView {
  if (input.kind !== 'employee_run') {
    return { status: 'not_applicable', label: '普通对话' }
  }
  if (input.failureCount > 0) {
    return { status: 'failure_lesson', label: '有失败教训' }
  }
  if (input.pendingLearningCount > 0) {
    return { status: 'needs_review', label: '经验待确认' }
  }
  if (input.hasReflection || input.memoryCount > 0) {
    return { status: 'learned', label: '已沉淀经验' }
  }
  return { status: 'waiting_reflection', label: '等待复盘' }
}

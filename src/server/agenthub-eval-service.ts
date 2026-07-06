import type { AgentHubEvalCase, AgentHubEvalMetricKind } from '@/lib/agenthub-lifecycle-types'

export type AgentHubObservedEvalRun = {
  completed: boolean
  artifactTypes: string[]
  safetyBlocked: boolean
  toolCalls: number
  handoffCount: number
}

export type AgentHubEvalResult = {
  evalCaseId: string
  passed: boolean
  score: number
  metricScores: Partial<Record<AgentHubEvalMetricKind, number>>
  notes: string[]
}

export function gradeLifecycleEvalCase(
  evalCase: AgentHubEvalCase,
  observed: AgentHubObservedEvalRun,
): AgentHubEvalResult {
  const metricScores: Partial<Record<AgentHubEvalMetricKind, number>> = {}
  const notes: string[] = []
  let weightedScore = 0
  let totalWeight = 0

  for (const metric of evalCase.metrics) {
    const score = scoreMetric(metric.kind, evalCase, observed)
    metricScores[metric.kind] = score
    weightedScore += score * metric.weight
    totalWeight += metric.weight

    if (score < metric.passingScore) {
      notes.push(`${metric.kind} scored ${score}, expected at least ${metric.passingScore}`)
    }
  }

  const score = totalWeight === 0 ? 0 : Number((weightedScore / totalWeight).toFixed(4))

  return {
    evalCaseId: evalCase.id,
    passed: notes.length === 0,
    score,
    metricScores,
    notes,
  }
}

function scoreMetric(
  kind: AgentHubEvalMetricKind,
  evalCase: AgentHubEvalCase,
  observed: AgentHubObservedEvalRun,
): number {
  if (kind === 'artifact_contract') {
    return evalCase.expectedArtifacts.every((artifactType) => observed.artifactTypes.includes(artifactType)) ? 1 : 0
  }

  if (kind === 'task_success') {
    return observed.completed ? 1 : 0
  }

  if (kind === 'safety') {
    return observed.safetyBlocked ? 0 : 1
  }

  if (kind === 'tool_use') {
    return observed.toolCalls > 0 ? 1 : 0
  }

  if (kind === 'handoff_quality') {
    return observed.handoffCount >= 0 ? 1 : 0
  }

  if (kind === 'instruction_following') {
    return observed.completed && !observed.safetyBlocked ? 1 : 0
  }

  return 0
}

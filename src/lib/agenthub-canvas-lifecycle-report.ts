import type { AgentFlowRunPreflightResult } from './agent-flow-run-preflight'
import type { CanvasLifecycleReportLike } from './agenthub-canvas-lifecycle-status'

export type CanvasLifecycleRunLike = {
  status: 'complete' | string
  handoffCount: number
  nodeCount: number
  edgeCount: number
}

export type CanvasLifecycleReport = CanvasLifecycleReportLike & {
  workflowDraftId: string
  workflowTitle: string
  summary: string
}

export function deriveCanvasLifecycleReport({
  workflowDraftId,
  workflowTitle,
  preflight,
  lastRun,
}: {
  workflowDraftId: string
  workflowTitle: string
  preflight: AgentFlowRunPreflightResult
  lastRun: CanvasLifecycleRunLike | null
}): CanvasLifecycleReport {
  const title = workflowTitle.trim() || '未命名流程'
  const warnings = preflight.issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.message)

  if (!preflight.ready) {
    const blockers = preflight.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message)

    return {
      workflowDraftId,
      workflowTitle: title,
      status: 'blocked',
      summary: `${title} 还有 ${blockers.length} 个能力缺口。`,
      blockers,
      warnings,
      evalPassed: 0,
      evalTotal: 1,
    }
  }

  if (!lastRun || lastRun.status !== 'complete') {
    return {
      workflowDraftId,
      workflowTitle: title,
      status: 'needs_eval',
      summary: `${title}等待本地试运行验证。`,
      blockers: [],
      warnings,
      evalPassed: 0,
      evalTotal: 1,
    }
  }

  return {
    workflowDraftId,
    workflowTitle: title,
    status: 'ready',
    summary: `${title}已通过本地试运行，${lastRun.handoffCount} 条交付链路可查看。`,
    blockers: [],
    warnings,
    evalPassed: 1,
    evalTotal: 1,
  }
}

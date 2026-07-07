import type { AgentFlowRunPreflightResult } from './agent-flow-run-preflight'

export type CanvasLifecycleState = 'needs_capability' | 'ready_to_run' | 'observed'

export type CanvasLifecycleReportStatus = 'blocked' | 'needs_eval' | 'ready'

export type CanvasLifecycleReportLike = {
  status: CanvasLifecycleReportStatus
  blockers: string[]
  warnings: string[]
  evalPassed: number
  evalTotal: number
}

export type CanvasLifecycleStatus = {
  state: CanvasLifecycleState
  phaseLabel: '运行前检查'
  statusLabel: string
  detail: string
}

export function deriveCanvasLifecycleStatus({
  preflight,
  hasRun,
  lifecycleReport,
}: {
  preflight: AgentFlowRunPreflightResult
  hasRun: boolean
  lifecycleReport?: CanvasLifecycleReportLike | null
}): CanvasLifecycleStatus {
  if (lifecycleReport?.status === 'blocked') {
    return {
      state: 'needs_capability',
      phaseLabel: '运行前检查',
      statusLabel: '需补能力',
      detail: formatCapabilityGapDetail(lifecycleReport.blockers.length, lifecycleReport.warnings.length),
    }
  }

  if (!preflight.ready) {
    return {
      state: 'needs_capability',
      phaseLabel: '运行前检查',
      statusLabel: '需补能力',
      detail: formatIssueDetail(preflight.errorCount, preflight.warningCount),
    }
  }

  if (lifecycleReport?.status === 'needs_eval') {
    return {
      state: 'ready_to_run',
      phaseLabel: '运行前检查',
      statusLabel: '待评测',
      detail: formatEvalDetail(lifecycleReport.evalPassed, lifecycleReport.evalTotal),
    }
  }

  if (hasRun || lifecycleReport?.status === 'ready') {
    const readyEvalDetail = lifecycleReport
      ? formatEvalDetail(lifecycleReport.evalPassed, lifecycleReport.evalTotal)
      : '可查看运行结果'
    return {
      state: 'observed',
      phaseLabel: '运行前检查',
      statusLabel: hasRun ? '已试运行' : '已通过评测',
      detail: hasRun ? '可查看运行结果' : readyEvalDetail,
    }
  }

  return {
    state: 'ready_to_run',
    phaseLabel: '运行前检查',
    statusLabel: '可试运行',
    detail: preflight.warningCount > 0 ? `0 个阻塞 · ${preflight.warningCount} 个提醒` : '能力已补齐',
  }
}

function formatCapabilityGapDetail(blockerCount: number, warningCount: number) {
  if (blockerCount > 0) return `${blockerCount} 个能力缺口`
  if (warningCount > 0) return `${warningCount} 个可选提醒`
  return '能力已补齐'
}

function formatEvalDetail(evalPassed: number, evalTotal: number) {
  if (evalTotal <= 0) return '等待本地评测'
  return `评测 ${evalPassed}/${evalTotal} 通过`
}

function formatIssueDetail(errorCount: number, warningCount: number) {
  if (warningCount > 0) return `${errorCount} 个阻塞 · ${warningCount} 个提醒`
  return `${errorCount} 个阻塞`
}

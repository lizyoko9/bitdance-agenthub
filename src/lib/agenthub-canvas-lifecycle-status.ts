import type { AgentFlowRunPreflightResult } from './agent-flow-run-preflight'

export type CanvasLifecycleState = 'needs_capability' | 'ready_to_run' | 'observed'

export type CanvasLifecycleStatus = {
  state: CanvasLifecycleState
  phaseLabel: '运行前检查'
  statusLabel: string
  detail: string
}

export function deriveCanvasLifecycleStatus({
  preflight,
  hasRun,
}: {
  preflight: AgentFlowRunPreflightResult
  hasRun: boolean
}): CanvasLifecycleStatus {
  if (!preflight.ready) {
    return {
      state: 'needs_capability',
      phaseLabel: '运行前检查',
      statusLabel: '需补能力',
      detail: formatIssueDetail(preflight.errorCount, preflight.warningCount),
    }
  }

  if (hasRun) {
    return {
      state: 'observed',
      phaseLabel: '运行前检查',
      statusLabel: '已试运行',
      detail: '可查看运行结果',
    }
  }

  return {
    state: 'ready_to_run',
    phaseLabel: '运行前检查',
    statusLabel: '可试运行',
    detail: preflight.warningCount > 0 ? `0 个阻塞 · ${preflight.warningCount} 个提醒` : '能力已补齐',
  }
}

function formatIssueDetail(errorCount: number, warningCount: number) {
  if (warningCount > 0) return `${errorCount} 个阻塞 · ${warningCount} 个提醒`
  return `${errorCount} 个阻塞`
}

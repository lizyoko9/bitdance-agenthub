import { describe, expect, it } from 'vitest'

import { deriveCanvasLifecycleReport } from './agenthub-canvas-lifecycle-report'
import type { AgentFlowRunPreflightResult } from './agent-flow-run-preflight'

const cleanPreflight: AgentFlowRunPreflightResult = {
  ready: true,
  errorCount: 0,
  warningCount: 0,
  connectedNodeCount: 3,
  disconnectedNodeCount: 0,
  issues: [],
}

describe('agenthub canvas lifecycle report', () => {
  it('turns blocking preflight errors into lifecycle capability blockers', () => {
    const report = deriveCanvasLifecycleReport({
      workflowDraftId: 'wf_local',
      workflowTitle: '客户交付流',
      preflight: {
        ...cleanPreflight,
        ready: false,
        errorCount: 1,
        issues: [
          {
            code: 'agent_profile_missing',
            severity: 'error',
            message: '员工 Agent 还没有选择智能体员工。',
            nodeId: 'agent-1',
          },
        ],
      },
      lastRun: null,
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers).toEqual(['员工 Agent 还没有选择智能体员工。'])
    expect(report.evalPassed).toBe(0)
    expect(report.evalTotal).toBe(1)
  })

  it('asks for a local eval run after capabilities are configured', () => {
    const report = deriveCanvasLifecycleReport({
      workflowDraftId: 'wf_local',
      workflowTitle: '客户交付流',
      preflight: cleanPreflight,
      lastRun: null,
    })

    expect(report.status).toBe('needs_eval')
    expect(report.summary).toBe('客户交付流等待本地试运行验证。')
    expect(report.evalPassed).toBe(0)
    expect(report.evalTotal).toBe(1)
  })

  it('marks the canvas lifecycle ready after a completed local run', () => {
    const report = deriveCanvasLifecycleReport({
      workflowDraftId: 'wf_local',
      workflowTitle: '客户交付流',
      preflight: cleanPreflight,
      lastRun: {
        status: 'complete',
        handoffCount: 2,
        nodeCount: 3,
        edgeCount: 2,
      },
    })

    expect(report.status).toBe('ready')
    expect(report.summary).toBe('客户交付流已通过本地试运行，2 条交付链路可查看。')
    expect(report.evalPassed).toBe(1)
    expect(report.evalTotal).toBe(1)
  })
})

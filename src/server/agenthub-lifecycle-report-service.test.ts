import { describe, expect, it } from 'vitest'

import { buildLifecycleReport } from './agenthub-lifecycle-report-service'

describe('agenthub lifecycle report service', () => {
  it('summarizes readiness and eval results for UI display', () => {
    const report = buildLifecycleReport({
      manifest: {
        id: 'life_1',
        name: 'Delivery Flow',
        version: 1,
        source: 'agenthub',
        currentPhase: 'evaluate',
        workflowId: 'wf_1',
        agentIds: ['agent_1'],
        capabilityRefs: [],
        evalCases: [],
        createdAt: '2026-07-06T00:00:00.000Z',
        updatedAt: '2026-07-06T00:00:00.000Z',
      },
      readiness: { ready: true, blockers: [], warnings: [] },
      evalResults: [{ evalCaseId: 'case_1', passed: true, score: 1, metricScores: {}, notes: [] }],
    })

    expect(report.status).toBe('ready')
    expect(report.summary).toBe('Delivery Flow is ready. 1/1 eval cases passed.')
  })
})

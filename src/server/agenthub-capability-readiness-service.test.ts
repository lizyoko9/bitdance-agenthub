import { describe, expect, it } from 'vitest'

import { evaluateLifecycleCapabilityReadiness } from './agenthub-capability-readiness-service'

describe('agenthub capability readiness service', () => {
  it('marks missing required capabilities as blocking', () => {
    const report = evaluateLifecycleCapabilityReadiness(
      {
        id: 'life_1',
        name: 'Flow',
        version: 1,
        source: 'agenthub',
        currentPhase: 'spec',
        workflowId: 'wf_1',
        agentIds: [],
        capabilityRefs: [{ kind: 'cli', id: 'cli_missing', name: 'Missing CLI', required: true }],
        evalCases: [],
        createdAt: '2026-07-06T00:00:00.000Z',
        updatedAt: '2026-07-06T00:00:00.000Z',
      },
      { agentIds: [], modelIds: [], cliIds: [], mcpIds: [], softwareIds: [], skillIds: [] },
    )

    expect(report.ready).toBe(false)
    expect(report.blockers).toEqual(['Missing required cli: Missing CLI'])
  })
})

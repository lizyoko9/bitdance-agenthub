import { describe, expect, it } from 'vitest'

import { gradeLifecycleEvalCase } from './agenthub-eval-service'

describe('agenthub eval service', () => {
  it('grades artifact contract and task success from observed outputs', () => {
    const result = gradeLifecycleEvalCase(
      {
        id: 'case_1',
        name: 'Generate delivery report',
        input: { goal: 'make report' },
        expectedArtifacts: ['report'],
        metrics: [
          { kind: 'artifact_contract', weight: 0.6, passingScore: 1 },
          { kind: 'task_success', weight: 0.4, passingScore: 1 },
        ],
      },
      {
        completed: true,
        artifactTypes: ['report'],
        safetyBlocked: false,
        toolCalls: 2,
        handoffCount: 1,
      },
    )

    expect(result.passed).toBe(true)
    expect(result.score).toBe(1)
  })
})

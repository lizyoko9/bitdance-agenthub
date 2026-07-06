import { describe, expect, it } from 'vitest'

import { applyAgentMemoryUpdateDeltas } from './agent-memory-evolution-application'

describe('agent memory evolution application', () => {
  it('applies confidence and importance deltas to recalled memories with clamped values', () => {
    const result = applyAgentMemoryUpdateDeltas({
      memories: [
        {
          id: 'memory_success',
          confidence: 0.97,
          importance: 0.99,
        },
        {
          id: 'memory_failure',
          confidence: 0.03,
          importance: 0.98,
        },
      ],
      updates: [
        {
          memoryId: 'memory_success',
          successDelta: 1,
          failureDelta: 0,
          confidenceDelta: 0.08,
          importanceDelta: 0.05,
          reason: 'Used successfully.',
        },
        {
          memoryId: 'memory_failure',
          successDelta: 0,
          failureDelta: 1,
          confidenceDelta: -0.08,
          importanceDelta: 0.05,
          reason: 'Failed and should become a warning.',
        },
        {
          memoryId: 'missing_memory',
          successDelta: 1,
          failureDelta: 0,
          confidenceDelta: 0.5,
          importanceDelta: 0.5,
          reason: 'Should be ignored.',
        },
      ],
    })

    expect(result).toEqual([
      {
        memoryId: 'memory_success',
        previousConfidence: 0.97,
        nextConfidence: 1,
        previousImportance: 0.99,
        nextImportance: 1,
        confidenceDelta: 0.03,
        importanceDelta: 0.01,
        reason: 'Used successfully.',
      },
      {
        memoryId: 'memory_failure',
        previousConfidence: 0.03,
        nextConfidence: 0,
        previousImportance: 0.98,
        nextImportance: 1,
        confidenceDelta: -0.03,
        importanceDelta: 0.02,
        reason: 'Failed and should become a warning.',
      },
    ])
  })
})

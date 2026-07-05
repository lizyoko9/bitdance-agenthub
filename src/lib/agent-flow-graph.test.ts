import { describe, expect, it } from 'vitest'

import { replaceEdgesForSingleTargetHandle, wouldCreateDirectedCycle } from './agent-flow-graph'

describe('wouldCreateDirectedCycle', () => {
  it('allows a forward handoff that keeps the workflow acyclic', () => {
    expect(
      wouldCreateDirectedCycle(
        [
          { source: 'input', target: 'agent' },
          { source: 'agent', target: 'artifact' },
        ],
        { source: 'artifact', target: 'delivery' },
      ),
    ).toBe(false)
  })

  it('blocks a handoff that points back to an upstream node', () => {
    expect(
      wouldCreateDirectedCycle(
        [
          { source: 'input', target: 'agent' },
          { source: 'agent', target: 'artifact' },
        ],
        { source: 'artifact', target: 'input' },
      ),
    ).toBe(true)
  })

  it('blocks a node from connecting back into itself', () => {
    expect(wouldCreateDirectedCycle([], { source: 'agent', target: 'agent' })).toBe(true)
  })
})

describe('replaceEdgesForSingleTargetHandle', () => {
  it('replaces the old upstream edge for the same target input port', () => {
    const result = replaceEdgesForSingleTargetHandle(
      [
        { id: 'a-to-input', source: 'a', target: 'agent', targetHandle: 'in:document' },
        { id: 'b-to-video', source: 'b', target: 'agent', targetHandle: 'in:video' },
        { id: 'c-to-other', source: 'c', target: 'other', targetHandle: 'in:document' },
      ],
      { id: 'new-to-input', source: 'new', target: 'agent', targetHandle: 'in:document' },
    )

    expect(result.map((edge) => edge.id)).toEqual(['b-to-video', 'c-to-other', 'new-to-input'])
  })
})

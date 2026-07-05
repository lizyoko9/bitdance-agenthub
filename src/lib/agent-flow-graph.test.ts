import { describe, expect, it } from 'vitest'

import { wouldCreateDirectedCycle } from './agent-flow-graph'

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

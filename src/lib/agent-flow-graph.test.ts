import { describe, expect, it } from 'vitest'

import {
  findFirstCompatiblePortPair,
  listCompatiblePortPairs,
  replaceEdgesForSingleTargetHandle,
  wouldCreateDirectedCycle,
} from './agent-flow-graph'

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

describe('findFirstCompatiblePortPair', () => {
  it('finds the first output and input pair that can be connected', () => {
    const result = findFirstCompatiblePortPair({
      sourceOutputs: [
        { id: 'report', label: '报告', type: 'report' },
        { id: 'video', label: '视频', type: 'video' },
      ],
      targetInputs: [
        { id: 'code', label: '代码', type: 'code' },
        { id: 'clip', label: '视频素材', type: 'video' },
      ],
      canConnect: (sourceType, targetType) => sourceType === targetType,
    })

    expect(result).toEqual({
      sourcePort: { id: 'video', label: '视频', type: 'video' },
      targetPort: { id: 'clip', label: '视频素材', type: 'video' },
    })
  })

  it('prefers the currently selected output type when auto-linking a new downstream node', () => {
    const result = findFirstCompatiblePortPair({
      sourceOutputs: [
        { id: 'report', label: 'report', type: 'report' },
        { id: 'video', label: 'video', type: 'video' },
        { id: 'code', label: 'code', type: 'code' },
      ],
      targetInputs: [
        { id: 'incoming', label: 'incoming', type: 'any' },
      ],
      preferredSourceType: 'video',
      canConnect: (_sourceType, targetType) => targetType === 'any',
    })

    expect(result).toEqual({
      sourcePort: { id: 'video', label: 'video', type: 'video' },
      targetPort: { id: 'incoming', label: 'incoming', type: 'any' },
    })
  })

  it('prefers the exact selected output port before other outputs of the same type', () => {
    const result = findFirstCompatiblePortPair({
      sourceOutputs: [
        { id: 'video-draft', label: 'draft video', type: 'video' },
        { id: 'video-final', label: 'final video', type: 'video' },
        { id: 'report', label: 'report', type: 'report' },
      ],
      targetInputs: [
        { id: 'incoming', label: 'incoming', type: 'any' },
      ],
      preferredSourceType: 'video',
      preferredSourceId: 'video-final',
      canConnect: (_sourceType, targetType) => targetType === 'any',
    })

    expect(result).toEqual({
      sourcePort: { id: 'video-final', label: 'final video', type: 'video' },
      targetPort: { id: 'incoming', label: 'incoming', type: 'any' },
    })
  })
})

describe('listCompatiblePortPairs', () => {
  it('lists every compatible source output and target input pair for an edge route picker', () => {
    const result = listCompatiblePortPairs({
      sourceOutputs: [
        { id: 'report', label: 'report', type: 'report' },
        { id: 'video', label: 'video', type: 'video' },
        { id: 'code', label: 'code', type: 'code' },
      ],
      targetInputs: [
        { id: 'video-in', label: 'video input', type: 'video' },
        { id: 'any-in', label: 'any input', type: 'any' },
      ],
      canConnect: (sourceType, targetType) => targetType === 'any' || sourceType === targetType,
    })

    expect(result).toEqual([
      {
        sourcePort: { id: 'report', label: 'report', type: 'report' },
        targetPort: { id: 'any-in', label: 'any input', type: 'any' },
      },
      {
        sourcePort: { id: 'video', label: 'video', type: 'video' },
        targetPort: { id: 'video-in', label: 'video input', type: 'video' },
      },
      {
        sourcePort: { id: 'video', label: 'video', type: 'video' },
        targetPort: { id: 'any-in', label: 'any input', type: 'any' },
      },
      {
        sourcePort: { id: 'code', label: 'code', type: 'code' },
        targetPort: { id: 'any-in', label: 'any input', type: 'any' },
      },
    ])
  })
})

import { describe, expect, it } from 'vitest'

import {
  canConnectArtifactOutputToTarget,
  createArtifactEdgeMapping,
  deleteNodeAndConnectedEdges,
  doesEdgeMatchTargetInput,
  getEdgeArtifactType,
  getIncomingArtifactTypes,
  getNodeOutputPorts,
  type AgentCanvasEdgeLike,
  type AgentCanvasNodeLike,
} from './agent-canvas-artifacts'

function node(overrides: Partial<AgentCanvasNodeLike>): AgentCanvasNodeLike {
  return {
    id: 'node',
    type: 'agent_employee',
    label: 'Node',
    inputMapping: {},
    outputContract: { artifactType: 'document' },
    ...overrides,
  }
}

function edge(overrides: Partial<AgentCanvasEdgeLike>): AgentCanvasEdgeLike {
  return {
    id: 'edge',
    sourceNodeId: 'source',
    targetNodeId: 'target',
    mapping: {},
    ...overrides,
  }
}

describe('agent canvas artifact model', () => {
  it('carries exactly one selected artifact type to the downstream node', () => {
    const writer = node({
      id: 'writer',
      outputContract: {
        outputs: [
          { key: 'video_cut', type: 'video', label: 'Video cut' },
          { key: 'source_code', type: 'code', label: 'Source code' },
        ],
      },
    })
    const reviewer = node({ id: 'reviewer', inputMapping: {} })
    const videoOutput = getNodeOutputPorts(writer)[0]
    const videoEdge = edge({
      sourceNodeId: 'writer',
      targetNodeId: 'reviewer',
      sourceHandle: 'artifact:video_cut',
      targetHandle: 'input',
      mapping: createArtifactEdgeMapping(videoOutput),
    })

    expect(getEdgeArtifactType(videoEdge, writer)).toBe('video')
    expect(getIncomingArtifactTypes(reviewer, [videoEdge], [writer, reviewer])).toEqual(['video'])
  })

  it('rejects an edge when the target only accepts a different artifact type', () => {
    const writer = node({
      id: 'writer',
      outputContract: {
        outputs: [{ key: 'final_video', type: 'video', label: 'Final video' }],
      },
    })
    const codeReviewer = node({
      id: 'code_reviewer',
      inputMapping: { acceptedArtifactTypes: ['code'] },
    })
    const videoEdge = edge({
      sourceNodeId: 'writer',
      targetNodeId: 'code_reviewer',
      mapping: createArtifactEdgeMapping(getNodeOutputPorts(writer)[0]),
    })

    expect(doesEdgeMatchTargetInput(videoEdge, codeReviewer, writer)).toBe(false)
  })

  it('allows an edge when the target explicitly accepts that artifact type', () => {
    const writer = node({
      id: 'writer',
      outputContract: {
        outputs: [{ key: 'bundle', type: 'file_bundle', label: 'File bundle' }],
      },
    })
    const packager = node({
      id: 'packager',
      inputMapping: { acceptedArtifactTypes: ['file_bundle', 'document'] },
    })
    const bundleEdge = edge({
      sourceNodeId: 'writer',
      targetNodeId: 'packager',
      mapping: createArtifactEdgeMapping(getNodeOutputPorts(writer)[0]),
    })

    expect(doesEdgeMatchTargetInput(bundleEdge, packager, writer)).toBe(true)
  })

  it('blocks connecting a selected output to a target that only accepts another artifact type', () => {
    const editor = node({
      id: 'editor',
      outputContract: {
        outputs: [{ key: 'final_video', type: 'video', label: 'Final video' }],
      },
    })
    const codeReviewer = node({
      id: 'code_reviewer',
      inputMapping: { acceptedArtifactTypes: ['code'] },
    })

    expect(canConnectArtifactOutputToTarget(getNodeOutputPorts(editor)[0], codeReviewer)).toBe(false)
  })

  it('deletes the selected node and all connected edges', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })]
    const edges = [
      edge({ id: 'a_to_b', sourceNodeId: 'a', targetNodeId: 'b' }),
      edge({ id: 'b_to_c', sourceNodeId: 'b', targetNodeId: 'c' }),
      edge({ id: 'a_to_c', sourceNodeId: 'a', targetNodeId: 'c' }),
    ]

    const result = deleteNodeAndConnectedEdges('b', nodes, edges)

    expect(result.nodes.map((item) => item.id)).toEqual(['a', 'c'])
    expect(result.edges.map((item) => item.id)).toEqual(['a_to_c'])
  })
})

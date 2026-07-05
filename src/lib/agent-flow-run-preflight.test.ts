import { describe, expect, it } from 'vitest'

import { validateAgentFlowForRun } from './agent-flow-run-preflight'

const node = (
  id: string,
  kind: 'input' | 'agent' | 'tool' | 'approval' | 'artifact',
  options: Partial<{
    title: string
    agentId: string
    softwareCommandId: string
    inputs: Array<{ id: string; type: string }>
    outputs: Array<{ id: string; type: string }>
  }> = {},
) => ({
  id,
  data: {
    kind,
    title: options.title ?? id,
    agentId: options.agentId,
    softwareCommandId: options.softwareCommandId,
    inputs: options.inputs ?? [],
    outputs: options.outputs ?? [],
  },
})

describe('validateAgentFlowForRun', () => {
  it('blocks software command nodes that have not selected a command', () => {
    const result = validateAgentFlowForRun({
      nodes: [
        node('input-1', 'input', { outputs: [{ id: 'message', type: 'message' }] }),
        node('tool-1', 'tool', { inputs: [{ id: 'message', type: 'message' }], outputs: [{ id: 'result', type: 'result' }] }),
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'input-1',
          target: 'tool-1',
          sourceHandle: 'out:message',
          targetHandle: 'in:message',
          data: { artifactType: 'message' },
        },
      ],
    })

    expect(result.ready).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('software_command_missing')
  })

  it('blocks agent nodes that have not selected an employee profile', () => {
    const result = validateAgentFlowForRun({
      nodes: [
        node('input-1', 'input', { outputs: [{ id: 'message', type: 'message' }] }),
        node('agent-1', 'agent', { inputs: [{ id: 'message', type: 'message' }], outputs: [{ id: 'report', type: 'report' }] }),
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'input-1',
          target: 'agent-1',
          sourceHandle: 'out:message',
          targetHandle: 'in:message',
          data: { artifactType: 'message' },
        },
      ],
    })

    expect(result.ready).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('agent_profile_missing')
  })

  it('blocks edges that point at missing ports or incompatible artifact types', () => {
    const result = validateAgentFlowForRun({
      nodes: [
        node('agent-1', 'agent', { outputs: [{ id: 'video', type: 'video' }] }),
        node('artifact-1', 'artifact', { inputs: [{ id: 'document', type: 'document' }] }),
      ],
      edges: [
        {
          id: 'edge-missing',
          source: 'agent-1',
          target: 'artifact-1',
          sourceHandle: 'out:video',
          targetHandle: 'in:missing',
          data: { artifactType: 'video' },
        },
        {
          id: 'edge-mismatch',
          source: 'agent-1',
          target: 'artifact-1',
          sourceHandle: 'out:video',
          targetHandle: 'in:document',
          data: { artifactType: 'video' },
        },
      ],
    })

    expect(result.ready).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['target_port_missing', 'port_type_mismatch']),
    )
  })

  it('accepts a typed handoff and reports disconnected nodes as warnings only', () => {
    const result = validateAgentFlowForRun({
      nodes: [
        node('agent-1', 'agent', { agentId: 'agent-profile-1', outputs: [{ id: 'video', type: 'video' }] }),
        node('artifact-1', 'artifact', { inputs: [{ id: 'video', type: 'video' }] }),
        node('agent-2', 'agent', {
          agentId: 'agent-profile-2',
          inputs: [{ id: 'message', type: 'message' }],
          outputs: [{ id: 'report', type: 'report' }],
        }),
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'agent-1',
          target: 'artifact-1',
          sourceHandle: 'out:video',
          targetHandle: 'in:video',
          data: { artifactType: 'video' },
        },
      ],
    })

    expect(result.ready).toBe(true)
    expect(result.issues.map((issue) => issue.code)).toContain('node_disconnected')
    expect(result.errorCount).toBe(0)
    expect(result.warningCount).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'

import { buildSoftwareCommandFlowPorts } from './agent-flow-software-command-contracts'

describe('buildSoftwareCommandFlowPorts', () => {
  it('turns a software command schema into typed canvas ports', () => {
    const ports = buildSoftwareCommandFlowPorts({
      name: 'Render Clip',
      inputSchema: {
        acceptedArtifactTypes: ['video', 'image'],
      },
      outputSchema: {
        outputs: [
          { key: 'rendered_video', type: 'video', label: 'Rendered video' },
          { key: 'project_files', type: 'file_bundle', label: 'Project files' },
          { key: 'metadata', type: 'json', label: 'Metadata' },
        ],
      },
    })

    expect(ports.inputs).toEqual([
      { id: 'video', label: '视频', type: 'video' },
      { id: 'image', label: '图片', type: 'image' },
    ])
    expect(ports.outputs).toEqual([
      { id: 'rendered_video', label: 'Rendered video', type: 'video' },
      { id: 'project_files', label: 'Project files', type: 'file_bundle' },
      { id: 'metadata', label: 'Metadata', type: 'structured_data' },
    ])
  })

  it('infers useful port types from JSON schema property names', () => {
    const ports = buildSoftwareCommandFlowPorts({
      name: 'Analyze Media',
      inputSchema: {
        type: 'object',
        properties: {
          sourceVideo: { type: 'string' },
          referenceAudio: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          reportFile: { type: 'string' },
          structuredJson: { type: 'object' },
        },
      },
    })

    expect(ports.inputs.map((port) => [port.id, port.type])).toEqual([
      ['sourceVideo', 'video'],
      ['referenceAudio', 'audio'],
    ])
    expect(ports.outputs.map((port) => [port.id, port.type])).toEqual([
      ['reportFile', 'document'],
      ['structuredJson', 'structured_data'],
    ])
  })

  it('falls back to a message input and result output for sparse command schemas', () => {
    const ports = buildSoftwareCommandFlowPorts({
      name: 'Open App',
      inputSchema: {},
      outputSchema: {},
    })

    expect(ports.inputs).toEqual([{ id: 'message', label: '命令输入', type: 'message' }])
    expect(ports.outputs).toEqual([{ id: 'result', label: 'Open App', type: 'result' }])
  })
})

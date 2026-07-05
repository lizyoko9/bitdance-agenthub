import { describe, expect, it } from 'vitest'

import { buildAgentFlowPortsFromContracts } from './agent-flow-agent-contracts'

describe('buildAgentFlowPortsFromContracts', () => {
  it('turns an Agent output contract into typed Langflow canvas output ports', () => {
    const ports = buildAgentFlowPortsFromContracts({
      name: 'Video Producer',
      inputContract: { acceptedArtifactTypes: ['document'] },
      outputContract: {
        outputs: [
          { key: 'final_video', type: 'video', label: '成片视频' },
          { key: 'source_code', type: 'code', label: '项目源码' },
          { key: 'metadata', type: 'json', label: '结构化清单' },
        ],
      },
    })

    expect(ports.inputs).toEqual([{ id: 'document', label: '文档', type: 'document' }])
    expect(ports.outputs).toEqual([
      { id: 'final_video', label: '成片视频', type: 'video' },
      { id: 'source_code', label: '项目源码', type: 'code' },
      { id: 'metadata', label: '结构化清单', type: 'structured_data' },
    ])
  })

  it('falls back to a message input and report output when the Agent contract is sparse', () => {
    const ports = buildAgentFlowPortsFromContracts({
      name: 'Reporter',
      inputContract: {},
      outputContract: { artifactType: 'report' },
    })

    expect(ports.inputs).toEqual([{ id: 'message', label: '任务输入', type: 'message' }])
    expect(ports.outputs).toEqual([{ id: 'artifact', label: 'Reporter', type: 'report' }])
  })
})

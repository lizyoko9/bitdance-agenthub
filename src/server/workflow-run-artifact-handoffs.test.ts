import { describe, expect, it } from 'vitest'

import { buildWorkflowRunArtifactHandoffs } from './workflow-run-artifact-handoffs'

describe('workflow run artifact handoffs', () => {
  it('summarizes the single selected artifact routed across an edge', () => {
    const handoffs = buildWorkflowRunArtifactHandoffs({
      nodes: [
        {
          id: 'producer',
          type: 'agent_employee',
          config: { label: '剪辑智能体' },
          outputContract: {
            outputs: [
              { key: 'final_video', type: 'video', label: '成片视频' },
              { key: 'source_code', type: 'code', label: '工程源码' },
            ],
          },
        },
        {
          id: 'video_delivery',
          type: 'agent_employee',
          config: { label: '交付智能体' },
          inputMapping: { acceptedArtifactTypes: ['video'] },
          outputContract: {},
        },
      ],
      edges: [
        {
          id: 'video-only',
          sourceNodeId: 'producer',
          targetNodeId: 'video_delivery',
          sourceHandle: 'artifact:final_video',
          targetHandle: 'input',
          mapping: {
            outputKey: 'final_video',
            targetInputKey: 'video',
            artifactType: 'video',
            targetPortLabel: '视频文件',
            artifactOnly: true,
          },
        },
      ],
      nodeRuns: [
        {
          id: 'producer-run',
          nodeId: 'producer',
          status: 'complete',
          output: {
            outputArtifacts: {
              final_video: 'artifact_video',
              source_code: 'artifact_code',
            },
            final_video: { fileName: 'final.mp4' },
            source_code: { fileName: 'project.zip' },
          },
        },
        {
          id: 'delivery-run',
          nodeId: 'video_delivery',
          status: 'queued',
          output: null,
        },
      ],
    })

    expect(handoffs).toEqual([
      expect.objectContaining({
        edgeId: 'video-only',
        sourceNodeId: 'producer',
        targetNodeId: 'video_delivery',
        sourceNodeRunId: 'producer-run',
        targetNodeRunId: 'delivery-run',
        outputKey: 'final_video',
        targetInputKey: 'video',
        artifactType: 'video',
        artifactLabel: '视频',
        sourcePortLabel: '成片视频',
        targetPortLabel: '视频文件',
        contract: '视频: 成片视频 -> 视频文件',
        artifactId: 'artifact_video',
      }),
    ])
    expect(handoffs[0].selectedArtifact).toEqual({
      outputKey: 'final_video',
      artifactType: 'video',
      artifactId: 'artifact_video',
      value: { fileName: 'final.mp4' },
    })
    expect(JSON.stringify(handoffs)).not.toContain('source_code')
    expect(JSON.stringify(handoffs)).not.toContain('artifact_code')
  })

  it('reads selected artifact values from nested employee and software outputs', () => {
    const handoffs = buildWorkflowRunArtifactHandoffs({
      nodes: [
        {
          id: 'producer',
          type: 'agent_employee',
          config: { label: '视频员工' },
          outputContract: {
            outputs: [
              { key: 'final_video', type: 'video', label: '成片视频' },
              { key: 'source_code', type: 'code', label: '工程源码' },
            ],
          },
        },
        {
          id: 'delivery',
          type: 'agent_employee',
          config: { label: '交付员工' },
          inputMapping: {
            inputs: [{ key: 'video', type: 'video', label: '视频文件' }],
          },
        },
      ],
      edges: [
        {
          id: 'video-only',
          sourceNodeId: 'producer',
          targetNodeId: 'delivery',
          mapping: {
            outputKey: 'final_video',
            targetInputKey: 'video',
            artifactType: 'video',
            artifactOnly: true,
          },
        },
      ],
      nodeRuns: [
        {
          id: 'producer-run',
          nodeId: 'producer',
          status: 'complete',
          output: {
            employeeRunOutput: {
              outputArtifacts: {
                final_video: 'artifact_video_nested',
              },
              final_video: { fileName: 'employee-final.mp4' },
            },
            softwareCommandOutput: {
              outputArtifacts: {
                source_code: 'artifact_code_nested',
              },
              source_code: { fileName: 'source.zip' },
            },
          },
        },
      ],
    })

    expect(handoffs[0].selectedArtifact).toEqual({
      outputKey: 'final_video',
      artifactType: 'video',
      artifactId: 'artifact_video_nested',
      value: { fileName: 'employee-final.mp4' },
    })
    expect(JSON.stringify(handoffs)).not.toContain('source.zip')
    expect(JSON.stringify(handoffs)).not.toContain('artifact_code_nested')
  })
})

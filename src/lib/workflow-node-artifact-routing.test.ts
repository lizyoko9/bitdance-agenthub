import { describe, expect, it } from 'vitest'

import { resolveWorkflowNodeArtifactInputs } from './workflow-node-artifact-routing'

describe('workflow node artifact routing', () => {
  it('routes only the selected source output into the target input port', () => {
    const routed = resolveWorkflowNodeArtifactInputs({
      targetNodeId: 'delivery',
      edges: [
        {
          id: 'edge_video',
          sourceNodeId: 'producer',
          targetNodeId: 'delivery',
          sourceHandle: 'artifact:final_video',
          targetHandle: 'in:video',
          mapping: {
            outputKey: 'final_video',
            targetInputKey: 'video',
            artifactType: 'video',
            artifactOnly: true,
          },
        },
      ],
      outputsByNodeId: {
        producer: {
          outputArtifacts: {
            final_video: 'artifact_video',
            source_code: 'artifact_code',
          },
          final_video: { fileName: 'final.mp4', path: 'D:/deliverables/final.mp4' },
          source_code: { fileName: 'project.zip', path: 'D:/deliverables/project.zip' },
        },
      },
    })

    expect(routed.video).toMatchObject({
      sourceNodeId: 'producer',
      edgeId: 'edge_video',
      outputKey: 'final_video',
      targetInputKey: 'video',
      artifactType: 'video',
      artifactOnly: true,
      selectedArtifact: {
        outputKey: 'final_video',
        artifactType: 'video',
        artifactId: 'artifact_video',
        value: { fileName: 'final.mp4', path: 'D:/deliverables/final.mp4' },
      },
    })
    expect(routed.producer).toEqual(routed.video)
    expect(JSON.stringify(routed)).not.toContain('source_code')
    expect(JSON.stringify(routed)).not.toContain('artifact_code')
    expect(JSON.stringify(routed)).not.toContain('project.zip')
  })

  it('keeps two selected ports from the same source node instead of overwriting one', () => {
    const routed = resolveWorkflowNodeArtifactInputs({
      targetNodeId: 'delivery',
      edges: [
        {
          id: 'edge_video',
          sourceNodeId: 'producer',
          targetNodeId: 'delivery',
          mapping: {
            outputKey: 'final_video',
            targetInputKey: 'video',
            artifactType: 'video',
            artifactOnly: true,
          },
        },
        {
          id: 'edge_code',
          sourceNodeId: 'producer',
          targetNodeId: 'delivery',
          mapping: {
            outputKey: 'source_code',
            targetInputKey: 'source',
            artifactType: 'code',
            artifactOnly: true,
          },
        },
      ],
      outputsByNodeId: {
        producer: {
          outputArtifacts: {
            final_video: 'artifact_video',
            source_code: 'artifact_code',
          },
          final_video: { fileName: 'final.mp4' },
          source_code: { fileName: 'project.zip' },
        },
      },
    })

    expect(routed.video).toMatchObject({
      outputKey: 'final_video',
      targetInputKey: 'video',
      selectedArtifact: { artifactId: 'artifact_video', value: { fileName: 'final.mp4' } },
    })
    expect(routed.source).toMatchObject({
      outputKey: 'source_code',
      targetInputKey: 'source',
      selectedArtifact: { artifactId: 'artifact_code', value: { fileName: 'project.zip' } },
    })
    expect(routed.producer).toMatchObject({
      sourceNodeId: 'producer',
      multipleHandoffs: true,
      handoffs: {
        video: { outputKey: 'final_video' },
        source: { outputKey: 'source_code' },
      },
    })
  })

  it('can read selected artifacts from nested employee and software outputs', () => {
    const routed = resolveWorkflowNodeArtifactInputs({
      targetNodeId: 'delivery',
      edges: [
        {
          id: 'edge_video',
          sourceNodeId: 'producer',
          targetNodeId: 'delivery',
          mapping: {
            outputKey: 'final_video',
            targetInputKey: 'video',
            artifactType: 'video',
          },
        },
      ],
      outputsByNodeId: {
        producer: {
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
    })

    expect(routed.video).toMatchObject({
      selectedArtifact: {
        outputKey: 'final_video',
        artifactType: 'video',
        artifactId: 'artifact_video_nested',
        value: { fileName: 'employee-final.mp4' },
      },
    })
    expect(JSON.stringify(routed)).not.toContain('source.zip')
  })

  it('uses null artifact id when the selected port only has an inline value', () => {
    const routed = resolveWorkflowNodeArtifactInputs({
      targetNodeId: 'delivery',
      edges: [
        {
          id: 'edge_report',
          sourceNodeId: 'producer',
          targetNodeId: 'delivery',
          mapping: {
            outputKey: 'report',
            targetInputKey: 'document',
            artifactType: 'document',
          },
        },
      ],
      outputsByNodeId: {
        producer: {
          report: { title: 'Inline report' },
        },
      },
    })

    expect(routed.document).toMatchObject({
      selectedArtifact: {
        outputKey: 'report',
        artifactType: 'document',
        artifactId: null,
        value: { title: 'Inline report' },
      },
    })
  })
})

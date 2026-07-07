import { describe, expect, it } from 'vitest'

import { buildWorkflowRunDeliveryPackage } from './workflow-run-delivery-package'

describe('workflow run delivery package', () => {
  it('summarizes only customer-visible node artifacts for client review', () => {
    const pkg = buildWorkflowRunDeliveryPackage({
      nodes: [
        {
          id: 'video_node',
          type: 'agent_employee',
          config: { label: '剪辑员工' },
          outputContract: {
            customerVisible: true,
            deliverableTitle: '客户成片',
            deliveryDescription: '可以直接给客户看的最终视频',
            outputs: [
              { key: 'final_video', type: 'video', label: '成片视频', customerVisible: true },
              { key: 'project_source', type: 'code', label: '工程源文件', customerVisible: false },
            ],
          },
        },
        {
          id: 'internal_node',
          type: 'agent_employee',
          config: { label: '内部校对' },
          outputContract: {
            customerVisible: false,
            artifactType: 'report',
            deliverableTitle: '内部检查报告',
          },
        },
      ],
      nodeRuns: [
        {
          id: 'video_run',
          nodeId: 'video_node',
          status: 'complete',
          output: {
            outputArtifacts: {
              final_video: 'artifact_video',
              project_source: 'artifact_source',
            },
            final_video: { fileName: 'final.mp4', path: 'D:/deliver/final.mp4' },
            project_source: { fileName: 'project.zip' },
          },
        },
        {
          id: 'internal_run',
          nodeId: 'internal_node',
          status: 'complete',
          output: {
            artifactId: 'artifact_internal_report',
            artifact: { fileName: 'internal.md' },
          },
        },
      ],
    })

    expect(pkg.title).toBe('客户可见交付包')
    expect(pkg.totalArtifacts).toBe(1)
    expect(pkg.readyArtifacts).toBe(1)
    expect(pkg.summary).toBe('已整理 1 个客户可见产物，其中 1 个已完成。')
    expect(pkg.artifacts).toEqual([
      expect.objectContaining({
        id: 'video_node:final_video',
        nodeId: 'video_node',
        nodeRunId: 'video_run',
        sourceNodeLabel: '剪辑员工',
        title: '成片视频',
        description: '可以直接给客户看的最终视频',
        artifactType: 'video',
        artifactLabel: '视频',
        outputKey: 'final_video',
        artifactId: 'artifact_video',
        status: 'ready',
        fileName: 'final.mp4',
        path: 'D:/deliver/final.mp4',
      }),
    ])
    expect(JSON.stringify(pkg)).not.toContain('project_source')
    expect(JSON.stringify(pkg)).not.toContain('内部检查报告')
  })

  it('marks visible artifacts as missing until the producing node completes with a value or artifact id', () => {
    const pkg = buildWorkflowRunDeliveryPackage({
      nodes: [
        {
          id: 'doc_node',
          type: 'agent_employee',
          config: { label: '文档员工' },
          outputContract: {
            customerVisible: true,
            artifactType: 'document',
            deliverableTitle: '交付文档',
          },
        },
      ],
      nodeRuns: [
        {
          id: 'doc_run',
          nodeId: 'doc_node',
          status: 'running',
          output: null,
        },
      ],
    })

    expect(pkg.totalArtifacts).toBe(1)
    expect(pkg.readyArtifacts).toBe(0)
    expect(pkg.missingArtifacts).toEqual(['交付文档'])
    expect(pkg.artifacts[0]).toMatchObject({
      id: 'doc_node:artifact',
      status: 'waiting',
      artifactId: null,
    })
  })
})

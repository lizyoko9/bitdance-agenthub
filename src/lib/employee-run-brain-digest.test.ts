import { describe, expect, it } from 'vitest'

import { buildEmployeeRunBrainDigest } from './employee-run-brain-digest'

describe('employee run brain digest', () => {
  it('summarizes a failed employee run into a user-facing brain digest', () => {
    const digest = buildEmployeeRunBrainDigest({
      reflection: {
        whatWorked: ['复用了剪映导出流程'],
        whatFailed: ['项目路径不存在，导出失败'],
        reusableProcedure: ['检查素材', '导出视频'],
        futureWarnings: ['下次先检查项目路径'],
      },
      memoryItems: [
        { title: '失败教训：项目路径不存在', type: 'mistake' },
        { title: '剪映导出流程', type: 'procedural' },
      ],
      learningEvents: [
        { title: '剪映失败教训共享审核', status: 'pending_review' },
        { title: '剪映导出 SOP 审核', status: 'approved' },
      ],
    })

    expect(digest).toEqual({
      title: '员工大脑',
      statusLabel: '有失败教训',
      tone: 'warning',
      headline: '失败归因：项目路径不存在，导出失败',
      metrics: [
        { label: '写入记忆', value: '2' },
        { label: '失败教训', value: '1' },
        { label: '待审核', value: '1' },
      ],
      items: [
        '做对了：复用了剪映导出流程',
        '失败原因：项目路径不存在，导出失败',
        '下次提醒：下次先检查项目路径',
        '待确认：剪映失败教训共享审核',
      ],
      nextRunBriefing: {
        title: '下次开工提示',
        items: [
          {
            label: '优先复用',
            detail: '检查素材、导出视频',
            tone: 'ready',
          },
          {
            label: '先避开',
            detail: '项目路径不存在，导出失败',
            tone: 'warning',
          },
          {
            label: '开工前检查',
            detail: '下次先检查项目路径',
            tone: 'warning',
          },
          {
            label: '需要确认',
            detail: '剪映失败教训共享审核',
            tone: 'warning',
          },
        ],
      },
    })
  })

  it('uses a calm empty state before the run has produced reflection evidence', () => {
    const digest = buildEmployeeRunBrainDigest({
      reflection: null,
      memoryItems: [],
      learningEvents: [],
    })

    expect(digest.statusLabel).toBe('等待复盘')
    expect(digest.tone).toBe('muted')
    expect(digest.headline).toBe('这个员工完成任务后，会在这里显示它学到了什么。')
    expect(digest.items).toEqual(['暂无复盘记录'])
    expect(digest.nextRunBriefing).toEqual({
      title: '下次开工提示',
      items: [
        {
          label: '开工状态',
          detail: '等待这个员工完成一次任务后生成。',
          tone: 'muted',
        },
      ],
    })
  })
})

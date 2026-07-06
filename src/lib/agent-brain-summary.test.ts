import { describe, expect, it } from 'vitest'

import { buildAgentBrainSummary, type AgentBrainSummaryReport } from './agent-brain-summary'

function report(overrides: Partial<AgentBrainSummaryReport> = {}): AgentBrainSummaryReport {
  return {
    readiness: 'ready',
    readinessScore: 86,
    memorySummary: {
      activeOwnedTotal: 12,
      mistakeCount: 2,
      proceduralCount: 5,
      semanticCount: 4,
      averageConfidence: 0.82,
      averageImportance: 0.76,
    },
    retrieval: {
      candidates: [
        { id: 'm1', title: '剪映导出流程', type: 'software', scope: 'agent', score: 8.2 },
        { id: 'm2', title: '客户偏好 1080p MP4', type: 'customer', scope: 'project', score: 6.7 },
      ],
      gaps: [],
      warnings: [],
    },
    learningSummary: {
      pendingReview: 1,
      activePlaybooks: 2,
      draftPlaybooks: 1,
    },
    governance: {
      needsHumanReview: true,
      mistakeTitles: ['字幕错位失败教训'],
      pendingLearningTitles: ['视频导出工作手册草稿'],
      expiringSoonMemoryTitles: [],
    },
    recommendations: ['审核高置信流程后再变成工作手册。'],
    ...overrides,
  }
}

describe('agent brain summary', () => {
  it('builds a compact employee-facing memory summary from a memory learning report', () => {
    const summary = buildAgentBrainSummary(report())

    expect(summary.title).toBe('员工大脑')
    expect(summary.statusLabel).toBe('需要审核')
    expect(summary.scoreText).toBe('86%')
    expect(summary.metrics).toEqual([
      { label: '记忆', value: '12', detail: '已沉淀' },
      { label: '失败教训', value: '2', detail: '避免重复踩坑' },
      { label: '待审核', value: '1', detail: '确认后生效' },
      { label: '工作手册', value: '2', detail: '可复用流程' },
    ])
    expect(summary.sections).toContainEqual(
      expect.objectContaining({
        title: '最近会参考的经验',
        items: ['剪映导出流程', '客户偏好 1080p MP4'],
      }),
    )
    expect(summary.sections).toContainEqual(
      expect.objectContaining({
        title: '需要你确认',
        items: ['视频导出工作手册草稿', '字幕错位失败教训'],
      }),
    )
  })

  it('uses a simple empty state when an agent has not learned anything yet', () => {
    const summary = buildAgentBrainSummary(
      report({
        readiness: 'empty',
        readinessScore: 35,
        memorySummary: {
          activeOwnedTotal: 0,
          mistakeCount: 0,
          proceduralCount: 0,
          semanticCount: 0,
          averageConfidence: 0,
          averageImportance: 0,
        },
        retrieval: { candidates: [], gaps: ['No matching memory'], warnings: [] },
        learningSummary: { pendingReview: 0, activePlaybooks: 0, draftPlaybooks: 0 },
        governance: {
          needsHumanReview: false,
          mistakeTitles: [],
          pendingLearningTitles: [],
          expiringSoonMemoryTitles: [],
        },
      }),
    )

    expect(summary.statusLabel).toBe('暂无经验')
    expect(summary.emptyState).toBe('这个员工还没有沉淀经验。跑完任务后，会自动记录成功流程和失败教训。')
    expect(summary.sections).toEqual([
      {
        title: '下一步建议',
        items: ['审核高置信流程后再变成工作手册。'],
      },
    ])
  })
})

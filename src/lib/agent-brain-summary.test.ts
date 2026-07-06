import { describe, expect, it } from 'vitest'

import {
  buildAgentBrainDetail,
  buildAgentBrainSummary,
  type AgentBrainSummaryReport,
} from './agent-brain-summary'

function report(overrides: Partial<AgentBrainSummaryReport> = {}): AgentBrainSummaryReport {
  return {
    readiness: 'ready',
    readinessScore: 86,
    memorySummary: {
      ownedTotal: 14,
      activeOwnedTotal: 12,
      byScope: {
        agent: 7,
        project: 3,
        workspace: 2,
        global: 2,
      },
      mistakeCount: 2,
      proceduralCount: 5,
      semanticCount: 4,
      averageConfidence: 0.82,
      averageImportance: 0.76,
    },
    retrieval: {
      sampleGoal: '剪映导出视频',
      candidates: [
        {
          id: 'm1',
          title: '剪映导出流程',
          type: 'software',
          scope: 'agent',
          score: 8.2,
          matchedTerms: ['剪映', '导出'],
        },
        {
          id: 'm2',
          title: '客户偏好 1080p MP4',
          type: 'customer',
          scope: 'project',
          score: 6.7,
          matchedTerms: ['客户', 'MP4'],
        },
      ],
      gaps: [],
      warnings: [],
    },
    reflectionSummary: {
      total: 3,
      reusableProcedureCount: 2,
      futureWarningCount: 1,
      suggestedSkillUpdateCount: 1,
    },
    learningSummary: {
      pendingReview: 1,
      activePlaybooks: 2,
      draftPlaybooks: 1,
      latestEvents: [
        {
          id: 'evt1',
          title: '视频导出工作手册草稿',
          type: 'playbook_proposal',
          status: 'pending_review',
          summary: '审核后才能成为这个 Agent 的长期工作手册。',
          createdAt: 1,
        },
        {
          id: 'evt2',
          title: '剪映导出失败教训共享',
          type: 'memory_share_review',
          status: 'pending_review',
          summary: '先保存在这个 Agent 私有记忆里，确认后再共享给项目。',
          createdAt: 1,
        },
      ],
      latestPlaybooks: [
        {
          id: 'pb1',
          title: '短视频导出 SOP',
          status: 'active',
          updatedAt: 2,
        },
      ],
    },
    governance: {
      needsHumanReview: true,
      sensitiveMemoryTitles: ['客户账号偏好'],
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

  it('builds an agent-local brain detail view for recall, review, and playbooks', () => {
    const detail = buildAgentBrainDetail(report())

    expect(detail.title).toBe('员工大脑详情')
    expect(detail.statusLabel).toBe('需要审核')
    expect(detail.memoryBoundaries).toEqual([
      { label: '私有记忆', value: '7', detail: '优先只给这个员工使用' },
      { label: '项目共享', value: '3', detail: '同项目员工可复用' },
      { label: '工作区共享', value: '2', detail: '团队内可见经验' },
      { label: '全局工具经验', value: '2', detail: '审核后才扩散' },
    ])
    expect(detail.recallFlow).toEqual([
      {
        label: '任务线索',
        value: '剪映导出视频',
        detail: '运行前提取目标、客户、工具和交付物线索',
      },
      {
        label: '召回经验',
        value: '2 条',
        detail: '按线索、标签、重要性、置信度和成功率排序',
      },
      {
        label: '上下文包',
        value: '4 类',
        detail: '只把相关记忆放进这个员工的工作上下文',
      },
    ])
    expect(detail.reviewQueue).toEqual([
      '视频导出工作手册草稿',
      '客户账号偏好',
      '字幕错位失败教训',
    ])
    expect(detail.reviewItems).toEqual([
      {
        title: '视频导出工作手册草稿',
        badge: '工作手册草稿',
        detail: '审核后才能成为这个 Agent 的长期工作手册。',
      },
      {
        title: '剪映导出失败教训共享',
        badge: '记忆共享审核',
        detail: '先保存在这个 Agent 私有记忆里，确认后再共享给项目。',
      },
      {
        title: '客户账号偏好',
        badge: '隐私记忆',
        detail: '确认是否只允许这个 Agent 或项目内使用。',
      },
      {
        title: '字幕错位失败教训',
        badge: '失败教训',
        detail: '下次计划时优先提醒这个 Agent 避免重复失败。',
      },
    ])
    expect(detail.playbooks).toEqual(['短视频导出 SOP'])
    expect(detail.recentContext).toEqual([
      '剪映导出流程 · software · 命中：剪映、导出',
      '客户偏好 1080p MP4 · customer · 命中：客户、MP4',
    ])
  })

  it('shows a disabled brain detail without pretending the agent can learn', () => {
    const detail = buildAgentBrainDetail(
      report({
        readiness: 'disabled',
        readinessScore: 0,
        retrieval: {
          sampleGoal: '生成报告',
          candidates: [],
          gaps: ['Memory policy is disabled for this Agent.'],
          warnings: [],
        },
        governance: {
          needsHumanReview: false,
          sensitiveMemoryTitles: [],
          mistakeTitles: [],
          pendingLearningTitles: [],
          expiringSoonMemoryTitles: [],
        },
        recommendations: ['打开记忆后，这个员工才能从任务里沉淀经验。'],
      }),
    )

    expect(detail.statusLabel).toBe('已关闭')
    expect(detail.recallFlow[1]).toEqual({
      label: '召回经验',
      value: '0 条',
      detail: '记忆已关闭，运行时不会注入长期经验',
    })
    expect(detail.reviewQueue).toEqual(['Memory policy is disabled for this Agent.'])
  })
})

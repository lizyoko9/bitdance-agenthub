import { describe, expect, it } from 'vitest'

import { buildEmployeeRuntimeBrainOutput } from './employee-runtime-brain-output'

describe('employee runtime brain output', () => {
  it('turns recalled context and learning results into a Chinese employee brain summary', () => {
    const output = buildEmployeeRuntimeBrainOutput({
      owner: {
        agentId: 'agent_video',
        agentName: '剪辑员工',
        role: '视频剪辑',
      },
      contextPack: {
        title: 'Agent 记忆上下文包',
        agentId: 'agent_video',
        goal: '用剪映导出视频并交付成片',
        summary: '已为这个员工编译 2 条记忆，供本轮计划、执行和验证使用。',
        sections: [
          {
            id: 'tool_usage',
            title: '工具使用经验',
            memoryType: 'tool_usage',
            items: [
              {
                memoryId: 'mem_jianying_export',
                title: '剪映导出流程',
                content: '先检查素材路径，再导出 MP4。',
                score: 4.2,
                reasons: ['匹配线索: 剪映, 导出视频'],
              },
            ],
          },
          {
            id: 'failure_lesson',
            title: '失败教训',
            memoryType: 'failure_lesson',
            items: [
              {
                memoryId: 'mem_bad_path',
                title: '失败教训：项目路径不存在',
                content: '导出前必须检查草稿路径。',
                score: 3.8,
                reasons: ['包含失败教训'],
              },
            ],
          },
        ],
      },
      reflection: {
        whatWorked: ['复用了剪映导出流程'],
        whatFailed: [],
        reusableProcedure: ['检查素材路径', '导出视频', '验证文件可播放'],
        futureWarnings: ['下次先检查草稿路径'],
      },
      memoryEvolution: {
        memoryUpdates: [
          {
            memoryId: 'mem_jianying_export',
            successDelta: 1,
            failureDelta: 0,
            confidenceDelta: 0.04,
            importanceDelta: 0.02,
            reason: '本次任务成功，相关记忆可信度小幅上升。',
          },
        ],
        newMemories: [],
        playbookDraft: {
          id: 'run_1:playbook_draft',
          agentId: 'agent_video',
          scope: 'agent_private',
          type: 'playbook',
          title: '工作手册草稿：剪映导出视频',
          content: '1. 检查素材路径\n2. 导出视频\n3. 验证文件可播放',
          cues: ['剪映', '导出视频'],
          tags: ['工作手册'],
          importance: 0.86,
          confidence: 0.78,
          successCount: 3,
          failureCount: 0,
          reviewStatus: 'pending_review',
          createdAt: 1,
          updatedAt: 1,
        },
        approvalRequests: [
          {
            kind: 'activate_playbook',
            targetId: 'run_1:playbook_draft',
            reason: '多次成功后生成工作手册草稿，需要审核后再成为长期可用经验。',
          },
        ],
      },
      memoryUpdateCount: 1,
      learningEventCount: 1,
    })

    expect(output).toMatchObject({
      title: '员工大脑',
      owner: {
        agentId: 'agent_video',
        agentName: '剪辑员工',
        role: '视频剪辑',
        label: '剪辑员工自己的大脑',
      },
      statusLabel: '已生成开工简报',
      headline: '本轮召回 2 条经验，已沉淀 1 条记忆更新。',
      contextSummary: '已为这个员工编译 2 条记忆，供本轮计划、执行和验证使用。',
      metrics: [
        { label: '召回记忆', value: '2' },
        { label: '记忆更新', value: '1' },
        { label: '待审核', value: '1' },
      ],
      recalledSections: [
        { title: '工具使用经验', itemTitles: ['剪映导出流程'] },
        { title: '失败教训', itemTitles: ['失败教训：项目路径不存在'] },
      ],
      nextRunBriefing: {
        title: '下次开工提示',
        items: [
          { label: '优先复用', detail: '检查素材路径、导出视频、验证文件可播放', tone: 'ready' },
          { label: '开工前检查', detail: '下次先检查草稿路径', tone: 'warning' },
          { label: '待审核工作手册', detail: '工作手册草稿：剪映导出视频', tone: 'warning' },
        ],
      },
      learningSummary: {
        memoryUpdateCount: 1,
        learningEventCount: 1,
        approvalRequestCount: 1,
        playbookDraftTitle: '工作手册草稿：剪映导出视频',
      },
      contextCache: {
        mode: 'append_only_stable_prefix',
        cacheHint: '逐字节复用 stablePrefix，只把本轮新增内容追加到后面。',
        truncated: false,
      },
      memoryBoundary: {
        privateFirst: true,
        reviewBeforeSharing: true,
        privateScopeLabel: '默认先保存在这个员工自己的大脑里',
        sharingScopeLabel: '确认后再共享给项目、团队或全局工具经验',
        visibleScopeLabels: ['员工私有记忆', '项目共享记忆', '团队共享记忆', '全局工具经验'],
        pendingReviewItems: [
          {
            kind: 'activate_playbook',
            targetId: 'run_1:playbook_draft',
            label: '工作手册待审核',
          },
        ],
      },
    })
    expect(output.contextCache?.promptPreview).toContain('AgentHub 员工大脑上下文 v1')
    expect(output.contextCache?.promptPreview.startsWith(output.contextCache.stablePrefix)).toBe(true)
    expect(output.contextCache?.byteLength).toBeGreaterThan(0)
    expect(JSON.stringify(output)).not.toContain('PSM')
    expect(JSON.stringify(output)).not.toMatch(/[�]|鍛樺伐|澶ц剳|寰呭|銆/)
  })
})

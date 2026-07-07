import { describe, expect, it } from 'vitest'

import {
  buildAgentMemoryContextCacheFrame,
  compileAgentMemoryContextPack,
  extractAgentMemoryCues,
  planAgentMemoryEvolution,
  recallAgentMemories,
  type AgentMemoryBlock,
  type AgentMemorySynapse,
} from './agent-psm-memory-core'

const baseNow = Date.UTC(2026, 6, 6)

function memory(overrides: Partial<AgentMemoryBlock>): AgentMemoryBlock {
  return {
    id: overrides.id ?? 'memory-1',
    agentId: overrides.agentId ?? 'agent-code',
    projectId: overrides.projectId,
    scope: overrides.scope ?? 'agent_private',
    type: overrides.type ?? 'experience',
    title: overrides.title ?? '默认经验',
    content: overrides.content ?? '默认内容',
    cues: overrides.cues ?? [],
    tags: overrides.tags ?? [],
    importance: overrides.importance ?? 0.5,
    confidence: overrides.confidence ?? 0.5,
    successCount: overrides.successCount ?? 0,
    failureCount: overrides.failureCount ?? 0,
    reviewStatus: overrides.reviewStatus ?? 'private',
    sourceRunId: overrides.sourceRunId,
    lastActivatedAt: overrides.lastActivatedAt,
    createdAt: overrides.createdAt ?? baseNow - 7 * 24 * 60 * 60 * 1000,
    updatedAt: overrides.updatedAt ?? baseNow - 7 * 24 * 60 * 60 * 1000,
  }
}

describe('agent PSM memory core', () => {
  it('extracts stable task cues without exposing PSM wording', () => {
    const signals = extractAgentMemoryCues({
      goal: '帮我用剪映导出 1080p 视频，并检查字幕是否错位',
      explicitCues: ['剪映', '导出视频', '剪映'],
      tags: ['视频剪辑', '视频剪辑'],
    })

    expect(signals.cues).toContain('剪映')
    expect(signals.cues).toContain('导出视频')
    expect(signals.cues).toContain('1080p')
    expect(signals.tags).toEqual(['视频剪辑'])
    expect(JSON.stringify(signals)).not.toContain('PSM')
  })

  it('recalls only memories visible to the running agent and ranks by cue, confidence, success, recency, and synapses', () => {
    const memories = [
      memory({
        id: 'private-owner',
        title: '剪映导出成功经验',
        content: '导出 1080p 前先检查字幕轨道和封面。',
        cues: ['剪映', '导出视频', '字幕'],
        tags: ['视频剪辑'],
        importance: 0.75,
        confidence: 0.85,
        successCount: 5,
        lastActivatedAt: baseNow - 60 * 60 * 1000,
      }),
      memory({
        id: 'private-other-agent',
        agentId: 'agent-ops',
        title: '别的员工私有经验',
        content: '不应该被当前 Agent 直接看到。',
        cues: ['剪映'],
        tags: ['视频剪辑'],
        importance: 1,
        confidence: 1,
      }),
      memory({
        id: 'project-shared',
        agentId: 'agent-ops',
        projectId: 'project-a',
        scope: 'project_shared',
        title: '项目交付偏好',
        content: '客户偏好 1080p MP4 和独立字幕检查截图。',
        cues: ['1080p', '字幕'],
        tags: ['客户偏好'],
        importance: 0.7,
        confidence: 0.7,
        successCount: 2,
      }),
      memory({
        id: 'other-project-shared',
        agentId: 'agent-ops',
        projectId: 'project-b',
        scope: 'project_shared',
        title: '其他项目知识',
        content: '不能跨项目进入上下文。',
        cues: ['剪映'],
        tags: ['视频剪辑'],
        importance: 1,
        confidence: 1,
      }),
      memory({
        id: 'global-tool-tip',
        agentId: 'agent-editor',
        scope: 'global_tool',
        type: 'tool_usage',
        title: '剪映 CLI 工具经验',
        content: '导出命令失败时先检查项目路径是否存在。',
        cues: ['剪映', 'CLI'],
        tags: ['工具经验'],
        importance: 0.6,
        confidence: 0.7,
        successCount: 3,
      }),
      memory({
        id: 'supported-checklist',
        title: '字幕检查清单',
        content: '导出后抽查开头、中段、结尾字幕。',
        cues: ['字幕'],
        tags: ['检查'],
        importance: 0.4,
        confidence: 0.7,
        successCount: 1,
      }),
    ]
    const synapses: AgentMemorySynapse[] = [
      {
        sourceMemoryId: 'private-owner',
        targetMemoryId: 'supported-checklist',
        relation: 'supports',
        weight: 0.7,
      },
    ]

    const recalled = recallAgentMemories(
      {
        agentId: 'agent-code',
        projectId: 'project-a',
        goal: '用剪映导出 1080p 视频并检查字幕',
        cues: ['剪映', '1080p', '字幕'],
        tags: ['视频剪辑'],
        now: baseNow,
      },
      memories,
      synapses,
      { limit: 5 },
    )

    expect(recalled.map((item) => item.memory.id)).toEqual([
      'private-owner',
      'project-shared',
      'global-tool-tip',
      'supported-checklist',
    ])
    expect(recalled.find((item) => item.memory.id === 'private-other-agent')).toBeUndefined()
    expect(recalled.find((item) => item.memory.id === 'other-project-shared')).toBeUndefined()
    expect(recalled.find((item) => item.memory.id === 'supported-checklist')?.reasons).toContain(
      '由相关记忆激活',
    )
  })

  it('compiles recalled memories into employee-facing Chinese context sections', () => {
    const recalled = recallAgentMemories(
      {
        agentId: 'agent-editor',
        goal: '剪映导出视频',
        cues: ['剪映', '失败'],
        tags: ['视频剪辑'],
        now: baseNow,
      },
      [
        memory({
          id: 'tool',
          agentId: 'agent-editor',
          type: 'tool_usage',
          title: '剪映 CLI 导出',
          content: '先检查项目路径，再执行导出命令。',
          cues: ['剪映'],
          tags: ['工具经验'],
        }),
        memory({
          id: 'failure',
          agentId: 'agent-editor',
          type: 'failure_lesson',
          title: '字幕错位失败教训',
          content: '字幕错位时不要直接交付，需要回到时间线检查。',
          cues: ['失败', '字幕'],
          tags: ['失败教训'],
          failureCount: 2,
        }),
        memory({
          id: 'playbook',
          agentId: 'agent-editor',
          type: 'playbook',
          title: '视频导出工作手册',
          content: '检查素材、导出、验证、截图归档。',
          cues: ['剪映'],
          tags: ['SOP'],
          successCount: 4,
        }),
      ],
      [],
      { limit: 3 },
    )

    const pack = compileAgentMemoryContextPack(
      {
        agentId: 'agent-editor',
        goal: '剪映导出视频',
        cues: ['剪映'],
        tags: ['视频剪辑'],
        now: baseNow,
      },
      recalled,
      { maxItemsPerSection: 2 },
    )

    expect(pack.title).toBe('Agent 记忆上下文包')
    expect(pack.sections.map((section) => section.title)).toEqual([
      '工具使用经验',
      '失败教训',
      'Agent 工作手册',
    ])
    expect(pack.sections[0]?.items[0]?.title).toBe('剪映 CLI 导出')
    expect(pack.summary).toContain('3 条记忆')
    expect(JSON.stringify(pack)).not.toContain('PSM')
  })

  it('serializes context as an append-only stable prefix frame for model prefix cache', () => {
    const pack = compileAgentMemoryContextPack(
      {
        agentId: 'agent-editor',
        goal: '剪映导出视频',
        cues: ['剪映', '字幕'],
        tags: ['视频剪辑'],
        now: baseNow,
      },
      [
        {
          memory: memory({
            id: 'tool',
            agentId: 'agent-editor',
            type: 'tool_usage',
            title: '剪映 CLI 导出',
            content: '先检查项目路径，再执行导出命令。',
            cues: ['剪映'],
            tags: ['工具经验'],
          }),
          score: 5.2,
          matchedCues: ['剪映'],
          matchedTags: [],
          reasons: ['匹配线索: 剪映'],
        },
        {
          memory: memory({
            id: 'failure',
            agentId: 'agent-editor',
            type: 'failure_lesson',
            title: '字幕错位失败教训',
            content: '字幕错位时不要直接交付，需要回到时间线检查。',
            cues: ['字幕'],
            tags: ['失败教训'],
          }),
          score: 4.9,
          matchedCues: ['字幕'],
          matchedTags: [],
          reasons: ['包含失败教训'],
        },
      ],
    )

    const frame = buildAgentMemoryContextCacheFrame(pack, { maxPromptCharacters: 420 })
    const repeated = buildAgentMemoryContextCacheFrame(pack, { maxPromptCharacters: 420 })

    expect(frame.mode).toBe('append_only_stable_prefix')
    expect(frame.prompt).toBe(repeated.prompt)
    expect(frame.prompt.startsWith(frame.stablePrefix)).toBe(true)
    expect(frame.stablePrefix).toContain('AgentHub 员工大脑上下文 v1')
    expect(frame.stablePrefix).toContain('缓存策略: append-only stable-prefix')
    expect(frame.prompt).toContain('剪映 CLI 导出')
    expect(frame.prompt).toContain('字幕错位失败教训')
    expect(frame.byteLength).toBe(Buffer.byteLength(frame.prompt, 'utf8'))
    expect(JSON.stringify(frame)).not.toContain('PSM')
  })

  it('keeps new lessons private first and requests review before sharing or activating playbooks', () => {
    const plan = planAgentMemoryEvolution({
      runId: 'run-1',
      agentId: 'agent-editor',
      projectId: 'project-a',
      goal: '剪映导出视频',
      outcome: 'failed',
      failureReason: '导出失败，因为项目路径不存在。',
      usedMemoryIds: ['tool-memory'],
      now: baseNow,
      reusableProcedure: ['检查项目路径', '导出视频', '验证字幕'],
    })

    expect(plan.memoryUpdates).toEqual([
      expect.objectContaining({
        memoryId: 'tool-memory',
        failureDelta: 1,
        confidenceDelta: expect.any(Number),
      }),
    ])
    expect(plan.newMemories).toEqual([
      expect.objectContaining({
        scope: 'agent_private',
        type: 'failure_lesson',
        reviewStatus: 'private',
        title: expect.stringContaining('失败教训'),
      }),
    ])
    expect(plan.approvalRequests).toEqual([
      expect.objectContaining({
        kind: 'share_memory',
        reason: expect.stringContaining('先私有'),
      }),
    ])
  })

  it('drafts a playbook only after successful reusable procedures and keeps it pending review', () => {
    const plan = planAgentMemoryEvolution({
      runId: 'run-2',
      agentId: 'agent-code',
      projectId: 'project-a',
      goal: '修复登录页面 bug',
      outcome: 'succeeded',
      usedMemoryIds: ['login-debug-memory'],
      now: baseNow,
      reusableProcedure: ['复现问题', '定位文件', '增加测试', '修复并回归'],
      repeatedSuccessCount: 3,
    })

    expect(plan.memoryUpdates).toContainEqual(
      expect.objectContaining({
        memoryId: 'login-debug-memory',
        successDelta: 1,
      }),
    )
    expect(plan.playbookDraft).toEqual(
      expect.objectContaining({
        type: 'playbook',
        scope: 'agent_private',
        reviewStatus: 'pending_review',
        title: expect.stringContaining('工作手册草稿'),
      }),
    )
    expect(plan.approvalRequests).toContainEqual(
      expect.objectContaining({
        kind: 'activate_playbook',
      }),
    )
  })
})

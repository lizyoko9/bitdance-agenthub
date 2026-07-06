import { describe, expect, it } from 'vitest'

import { buildRuntimeAgentLearningPlan } from './agent-memory-runtime-learning'

const now = Date.UTC(2026, 6, 6)

describe('runtime agent memory learning plan', () => {
  it('turns failed runs into private failure lessons and review requests', () => {
    const plan = buildRuntimeAgentLearningPlan({
      runId: 'run-failed',
      agentId: 'agent-editor',
      projectId: 'project-video',
      role: '剪辑员工',
      goal: '用剪映导出客户视频',
      status: 'failed',
      error: '项目路径不存在，导出命令失败。',
      artifactType: 'video',
      retrievedMemoryIds: ['memory-jianying-cli'],
      now,
    })

    expect(plan.outcome).toBe('failed')
    expect(plan.primaryMemoryDraft).toEqual(
      expect.objectContaining({
        scope: 'agent',
        type: 'mistake',
        title: expect.stringContaining('失败教训'),
        content: expect.stringContaining('项目路径不存在'),
        confidence: expect.any(Number),
        importance: expect.any(Number),
      }),
    )
    expect(plan.reflection.whatFailed).toEqual(['项目路径不存在，导出命令失败。'])
    expect(plan.evolution.approvalRequests).toContainEqual(
      expect.objectContaining({
        kind: 'share_memory',
        reason: expect.stringContaining('先私有'),
      }),
    )
  })

  it('keeps successful reusable procedures as memory while drafting playbooks for review', () => {
    const plan = buildRuntimeAgentLearningPlan({
      runId: 'run-success',
      agentId: 'agent-code',
      projectId: 'project-app',
      role: '代码员工',
      goal: '修复登录页面 bug',
      status: 'complete',
      artifactType: 'code',
      retrievedMemoryIds: ['memory-login-debug'],
      repeatedSuccessCount: 3,
      reusableProcedure: ['复现问题', '定位文件', '增加测试', '修复并回归'],
      now,
    })

    expect(plan.outcome).toBe('succeeded')
    expect(plan.primaryMemoryDraft).toEqual(
      expect.objectContaining({
        scope: 'agent',
        type: 'procedural',
        title: expect.stringContaining('代码员工'),
        content: expect.stringContaining('Required artifact: code.'),
      }),
    )
    expect(plan.reflection.reusableProcedure).toEqual([
      '复现问题',
      '定位文件',
      '增加测试',
      '修复并回归',
    ])
    expect(plan.evolution.playbookDraft).toEqual(
      expect.objectContaining({
        reviewStatus: 'pending_review',
        title: expect.stringContaining('工作手册草稿'),
      }),
    )
    expect(plan.evolution.approvalRequests).toContainEqual(
      expect.objectContaining({
        kind: 'activate_playbook',
      }),
    )
  })
})

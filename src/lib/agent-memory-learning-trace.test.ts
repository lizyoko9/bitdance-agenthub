import { describe, expect, it } from 'vitest'

import { buildAgentMemoryLearningTrace } from './agent-memory-learning-trace'

describe('agent memory learning trace', () => {
  it('groups each agent run reflection with memories, review events, and playbooks', () => {
    const trace = buildAgentMemoryLearningTrace({
      reflections: [
        {
          id: 'reflection_1',
          runId: 'run_1',
          createdAt: 3,
          whatWorked: ['复用了剪映导出流程'],
          whatFailed: ['项目路径不存在，导出失败'],
        },
      ],
      memories: [
        {
          sourceRunId: 'run_1',
          title: '失败教训：项目路径不存在',
        },
      ],
      learningEvents: [
        {
          id: 'event_pending',
          runId: 'run_1',
          reflectionId: 'reflection_1',
          title: '剪映失败教训共享审核',
          status: 'pending_review',
          createdAt: 4,
        },
        {
          id: 'event_approved',
          runId: 'run_1',
          reflectionId: 'reflection_1',
          title: '剪映导出 SOP 审核',
          status: 'approved',
          createdAt: 5,
        },
      ],
      playbooks: [
        {
          title: '剪映导出工作手册',
          sourceLearningEventId: 'event_approved',
        },
      ],
    })

    expect(trace).toEqual([
      {
        runId: 'run_1',
        reflectionId: 'reflection_1',
        createdAt: 3,
        outcome: 'failed',
        whatWorked: ['复用了剪映导出流程'],
        whatFailed: ['项目路径不存在，导出失败'],
        memoryTitles: ['失败教训：项目路径不存在'],
        pendingLearningTitles: ['剪映失败教训共享审核'],
        approvedLearningTitles: ['剪映导出 SOP 审核'],
        playbookTitles: ['剪映导出工作手册'],
      },
    ])
  })
})

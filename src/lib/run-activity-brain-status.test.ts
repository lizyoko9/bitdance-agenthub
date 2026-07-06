import { describe, expect, it } from 'vitest'

import { resolveRunActivityBrainStatus } from './run-activity-brain-status'

describe('run activity brain status', () => {
  it('prioritizes failure lessons for employee runs', () => {
    expect(
      resolveRunActivityBrainStatus({
        kind: 'employee_run',
        hasReflection: true,
        failureCount: 1,
        memoryCount: 2,
        pendingLearningCount: 1,
      }),
    ).toEqual({
      status: 'failure_lesson',
      label: '有失败教训',
    })
  })

  it('shows pending learning before generic learned status', () => {
    expect(
      resolveRunActivityBrainStatus({
        kind: 'employee_run',
        hasReflection: true,
        failureCount: 0,
        memoryCount: 2,
        pendingLearningCount: 1,
      }),
    ).toEqual({
      status: 'needs_review',
      label: '经验待确认',
    })
  })

  it('keeps normal agent runs out of employee brain language', () => {
    expect(
      resolveRunActivityBrainStatus({
        kind: 'agent_run',
        hasReflection: false,
        failureCount: 0,
        memoryCount: 0,
        pendingLearningCount: 0,
      }),
    ).toEqual({
      status: 'not_applicable',
      label: '普通对话',
    })
  })
})

import { describe, expect, it } from 'vitest'

import type { StreamEvent } from '@/shared/types'

import { CaseTracker } from './metrics.ts'

const base = { conversationId: 'conv_1', timestamp: 0 }
const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheCreationTokens: 0 }

function apply(tracker: CaseTracker, events: StreamEvent[]): void {
  for (const event of events) tracker.apply(event)
}

describe('CaseTracker', () => {
  it('settles only after every started run has ended', () => {
    const tracker = new CaseTracker()
    expect(tracker.settled()).toBe(false)
    apply(tracker, [
      { ...base, type: 'run.start', runId: 'root', agentId: 'ag_o', triggerMessageId: 'm1' },
      { ...base, type: 'run.start', runId: 'child', agentId: 'ag_a', triggerMessageId: 'm1', parentRunId: 'root' },
      { ...base, type: 'run.end', runId: 'child', status: 'complete' },
    ])
    expect(tracker.settled()).toBe(false)
    expect(tracker.runningRunIds()).toEqual(['root'])
    apply(tracker, [{ ...base, type: 'run.end', runId: 'root', status: 'failed' }])
    expect(tracker.settled()).toBe(true)
    expect(tracker.rootRunStatus()).toBe('failed')
  })

  it('counts dispatches and keeps the latest usage per run', () => {
    const tracker = new CaseTracker()
    apply(tracker, [
      { ...base, type: 'dispatch.plan', runId: 'root', plan: [{ id: 't1', agentId: 'ag_a', task: 'x' }] },
      { ...base, type: 'dispatch.start', parentRunId: 'root', childRunId: 'c1', taskId: 't1', agentId: 'ag_a' },
      { ...base, type: 'dispatch.end', parentRunId: 'root', taskId: 't1', status: 'failed' },
      { ...base, type: 'dispatch.plan', runId: 'root', plan: [{ id: 't2', agentId: 'ag_a', task: 'y' }] },
      { ...base, type: 'run.usage', runId: 'c1', usage },
      { ...base, type: 'run.usage', runId: 'c1', usage: { ...usage, outputTokens: 7 } },
      { ...base, type: 'run.usage', runId: 'root', usage },
    ])
    expect(tracker.snapshot()).toMatchObject({
      plans: 2,
      planTasks: 2,
      dispatchCount: 1,
      failedDispatches: 1,
      tokens: { inputTokens: 20, outputTokens: 12, cacheReadTokens: 2, cacheCreationTokens: 0 },
    })
  })
})

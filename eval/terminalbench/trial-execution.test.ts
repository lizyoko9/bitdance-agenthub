import { describe, expect, it, vi } from 'vitest'

import type { StreamEvent } from '../../src/shared/types'
import type { TrialRuntime } from './profile'
import { executeTrial } from './trial-execution'

type EventBody<T = StreamEvent> = T extends StreamEvent ? Omit<T, 'conversationId' | 'timestamp'> : never

function fakeRuntime() {
  let listener: (event: StreamEvent) => void = () => {}
  const runtime: TrialRuntime = {
    dataDir: '/logs/state', workerIds: ['worker'], orchestratorId: 'orch', conversationId: 'conv',
    subscribe: (callback) => { listener = callback; return () => { listener = () => {} } },
    start: async () => ({ runIds: ['root'] }),
    approvePending: vi.fn(),
    abort: vi.fn(async () => true),
    close: vi.fn(),
  }
  const emit = (event: EventBody) => listener({ ...event, conversationId: 'conv', timestamp: Date.now() } as StreamEvent)
  const start = (runId: string, parentRunId?: string) => emit({ type: 'run.start', runId, agentId: 'worker', triggerMessageId: 'msg', parentRunId })
  const end = (runId: string, status: 'complete' | 'failed' | 'aborted' = 'complete', error?: string) => emit({ type: 'run.end', runId, status, error })
  return { runtime, emit, start, end }
}

describe('headless trial lifecycle', () => {
  it('defers approval until a synchronous pending publisher attaches its resolver', async () => {
    const fake = fakeRuntime()
    let resolverAttached = false
    fake.runtime.start = async () => {
      fake.start('root')
      fake.emit({ type: 'ask_user.pending', pendingQuestion: { id: 'q', conversationId: 'conv', agentId: 'worker', runId: 'root', questions: [], createdAt: Date.now() } })
      resolverAttached = true
      return { runIds: ['root'] }
    }
    fake.runtime.approvePending = vi.fn(() => {
      expect(resolverAttached).toBe(true)
      fake.end('root')
    })
    const events: unknown[] = []
    const result = await executeTrial(fake.runtime, 1000, (event) => events.push(event))
    expect(result.runStatus).toBe('complete')
    expect(fake.runtime.approvePending).toHaveBeenCalledOnce()
    expect(events).toContainEqual({ type: 'eval.interaction', action: 'fixed_answer', pendingType: 'ask_user.pending' })
  })

  it('waits for an observed child even after the root run ends', async () => {
    const fake = fakeRuntime()
    let childFinished = false
    fake.runtime.start = async () => {
      fake.start('root')
      fake.start('child', 'root')
      fake.end('root')
      setTimeout(() => { childFinished = true; fake.end('child') }, 15)
      return { runIds: ['root'] }
    }
    const result = await executeTrial(fake.runtime, 1000, () => {})
    expect(childFinished).toBe(true)
    expect(result.allRunsSettled).toBe(true)
    expect(result.runs).toHaveLength(2)
  })

  it('aborts both root and child on timeout and waits for their terminal events', async () => {
    const fake = fakeRuntime()
    fake.runtime.start = async () => { fake.start('root'); fake.start('child', 'root'); return { runIds: ['root'] } }
    fake.runtime.abort = vi.fn(async (runId) => { fake.end(runId, 'aborted'); return true })
    const result = await executeTrial(fake.runtime, 10, () => {}, undefined, 50)
    expect(fake.runtime.abort).toHaveBeenCalledWith('root')
    expect(fake.runtime.abort).toHaveBeenCalledWith('child')
    expect(result).toMatchObject({ timedOut: true, allRunsSettled: true, runStatus: 'aborted' })
  })

  it('stops the other runs when a child exhausts the shared request budget', async () => {
    const fake = fakeRuntime()
    fake.runtime.start = async () => {
      fake.start('root'); fake.start('child', 'root')
      fake.end('child', 'failed', 'budget_exhausted: maximum requests reached')
      return { runIds: ['root'] }
    }
    fake.runtime.abort = vi.fn(async (runId) => { fake.end(runId, 'aborted'); return true })
    const result = await executeTrial(fake.runtime, 1000, () => {})
    expect(result).toMatchObject({ budgetExhausted: true, runStatus: 'failed', allRunsSettled: true })
    expect(fake.runtime.abort).toHaveBeenCalledWith('root')
  })

  it('has finite cleanup even when sendMessage never returns or responds to cancellation', async () => {
    const fake = fakeRuntime()
    fake.runtime.start = () => new Promise(() => {})
    const started = Date.now()
    const result = await executeTrial(fake.runtime, 5, () => {}, undefined, 10)
    expect(Date.now() - started).toBeLessThan(1000)
    expect(result).toMatchObject({ timedOut: true, allRunsSettled: false })
  })
})

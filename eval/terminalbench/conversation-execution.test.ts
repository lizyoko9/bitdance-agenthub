import { createHash } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { StreamEvent } from '../../src/shared/types'
import type { TrialRuntime } from './profile'
import { executeConversationTrial } from './trial-execution'

type EventBody<T = StreamEvent> = T extends StreamEvent ? Omit<T, 'conversationId' | 'timestamp'> : never

function fixture() {
  let listener: (event: StreamEvent) => void = () => {}
  let nextIndex = 0
  const events: StreamEvent[] = []
  const receipts: Record<string, unknown>[] = []
  const emit = (event: EventBody) => listener({ ...event, conversationId: 'conv', timestamp: Date.now() } as StreamEvent)
  const begin = (instruction: string) => {
    const index = ++nextIndex
    const messageId = `user-${index}`
    const runId = `root-${index}`
    emit({ type: 'message.added', message: { id: messageId, conversationId: 'conv', role: 'user', agentId: null,
      parts: [{ type: 'text', content: instruction }], status: 'complete', parentMessageId: null,
      mentionedAgentIds: [], runId: null, usage: null, createdAt: Date.now() } })
    emit({ type: 'run.start', runId, agentId: 'worker', triggerMessageId: messageId })
    return { messageId, runId, index }
  }
  const end = (runId: string, status: 'complete' | 'failed' | 'aborted' = 'complete', error?: string) => {
    emit({ type: 'run.end', runId, status, error })
  }
  const runtime: TrialRuntime = {
    dataDir: '/state', conversationId: 'conv', workerIds: ['worker'], orchestratorId: 'orch',
    start: vi.fn(async () => ({ runIds: [] })),
    send: vi.fn(async (instruction) => {
      const { messageId, runId } = begin(instruction)
      end(runId)
      return { messageId, runIds: [runId] }
    }),
    subscribe(callback) { listener = callback; return () => { listener = () => {} } },
    approvePending: vi.fn(), close: vi.fn(),
    abort: vi.fn(async (runId) => { end(runId, 'aborted'); return true }),
  }
  const execute = (turns: string[], settings: { timeout?: number; signal?: AbortSignal; cleanupMs?: number } = {}) => executeConversationTrial(runtime, turns,
    (event) => events.push(event as StreamEvent), {
      deadline: performance.now() + (settings.timeout ?? 1000), signal: settings.signal,
      cleanupMs: settings.cleanupMs ?? 5, nativeEventLine: () => events.length,
      onReceipt: (receipt) => receipts.push(receipt),
    })
  return { runtime, events, receipts, begin, end, emit, execute }
}

afterEach(() => vi.useRealTimers())

describe('fixed conversation execution without model calls', () => {
  it('sends only the next original input and preserves one conversation and native line ranges', async () => {
    const f = fixture()
    const turns = ['original first\n', 'second', 'third']
    const result = await f.execute(turns)
    expect(result).toMatchObject({ runStatus: 'complete', terminationReason: 'completed', allRunsSettled: true,
      conversation: { plannedTurns: 3, completedTurns: 3, attemptedTurns: 3 } })
    expect(f.runtime.start).not.toHaveBeenCalled()
    expect(vi.mocked(f.runtime.send!).mock.calls.map(([input]) => input)).toEqual(turns)
    expect(f.events.filter((event) => event.type === 'message.added').map((event) => event.message.parts)).toEqual(turns.map((content) => [{ type: 'text', content }]))
    expect(f.receipts[0]).toMatchObject({ schemaVersion: 1, type: 'conversation.start', conversationId: 'conv', plannedTurns: 3,
      inputSha256: turns.map((turn) => createHash('sha256').update(turn).digest('hex')) })
    expect(f.receipts.filter((row) => row.type === 'turn.end').map((row) => [row.nativeEventStartLine, row.nativeEventEndLine, row.userMessageId])).toEqual([
      [1, 3, 'user-1'], [4, 6, 'user-2'], [7, 9, 'user-3'],
    ])
    expect(f.receipts.at(-1)).toMatchObject({ type: 'conversation.end', completedTurns: 3, attemptedTurns: 3 })
    expect(f.events.some((event) => event.type.startsWith('conversation.'))).toBe(false)
  })

  it.each(['failed', 'aborted'] as const)('stops after a %s run before sending another input', async (status) => {
    const f = fixture()
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId } = f.begin(instruction)
      f.end(runId, status, status === 'failed' ? 'output_limit: response stopped' : undefined)
      return { messageId, runIds: [runId] }
    })
    const result = await f.execute(['one', 'two'])
    expect(f.runtime.send).toHaveBeenCalledTimes(1)
    expect(result.conversation).toEqual({ plannedTurns: 2, completedTurns: 0, attemptedTurns: 1 })
    expect(result.runStatus).toBe(status)
  })

  it('does not submit a second input after a rejected send', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(async () => { throw new Error('send failed') })
    const result = await f.execute(['one', 'two'])
    expect(result).toMatchObject({ runStatus: 'failed', allRunsSettled: false, conversation: { attemptedTurns: 1, completedTurns: 0 } })
    expect(f.runtime.send).toHaveBeenCalledOnce()
    expect(f.receipts.find((row) => row.type === 'turn.end')).toMatchObject({ userMessageId: null, rootRunIds: [] })
  })

  it('rejects missing submission IDs even when observed roots end normally', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(async (instruction) => {
      const { runId } = f.begin(instruction)
      f.end(runId)
      return { messageId: '', runIds: [runId] }
    })
    const result = await f.execute(['one', 'two'])
    expect(result).toMatchObject({ runStatus: 'failed', allRunsSettled: false })
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('rejects unmatched tools, messages and zero roots instead of advancing', async () => {
    for (const invalid of ['tool', 'message', 'root'] as const) {
      const f = fixture()
      f.runtime.send = vi.fn(async (instruction) => {
        const { messageId, runId } = f.begin(instruction)
        if (invalid !== 'root') f.emit({ type: 'message.start', messageId: 'answer', runId, agentId: 'worker' })
        if (invalid === 'tool') f.emit({ type: 'tool.call', messageId: 'answer', callId: 'call', toolName: 'bash', args: { command: 'true' } })
        f.end(runId)
        return { messageId, runIds: invalid === 'root' ? [] : [runId] }
      })
      const result = await f.execute(['one', 'two'])
      expect(result.runStatus).toBe('failed')
      expect(result.allRunsSettled).toBe(false)
      expect(f.runtime.send).toHaveBeenCalledOnce()
    }
  })

  it('does not treat normal short final text as the end of the fixed protocol', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId, index } = f.begin(instruction)
      const answer = `answer-${index}`
      f.emit({ type: 'message.start', messageId: answer, runId, agentId: 'worker' })
      f.emit({ type: 'part.start', messageId: answer, partIndex: 0, part: { type: 'text', content: 'DONE' } })
      f.emit({ type: 'part.end', messageId: answer, partIndex: 0 })
      f.emit({ type: 'message.end', messageId: answer })
      f.end(runId)
      return { messageId, runIds: [runId] }
    })
    expect((await f.execute(['one', 'two'])).conversation.completedTurns).toBe(2)
  })

  it('honors cancellation between completed inputs', async () => {
    const f = fixture()
    const controller = new AbortController()
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId } = f.begin(instruction)
      f.end(runId)
      setImmediate(() => controller.abort())
      return { messageId, runIds: [runId] }
    })
    const result = await f.execute(['one', 'two'], { signal: controller.signal })
    expect(result).toMatchObject({ runStatus: 'aborted', terminationReason: 'aborted', conversation: { attemptedTurns: 1, completedTurns: 1 } })
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('aborts a root returned by a late send within the single drain window', async () => {
    const f = fixture()
    const controller = new AbortController()
    f.runtime.send = vi.fn(async (instruction) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      const { messageId, runId } = f.begin(instruction)
      return { messageId, runIds: [runId] }
    })
    setTimeout(() => controller.abort(), 1)
    const result = await f.execute(['one', 'two'], { signal: controller.signal, cleanupMs: 50 })
    expect(f.runtime.abort).toHaveBeenCalledWith('root-1')
    expect(result).toMatchObject({ runStatus: 'aborted', allRunsSettled: true, conversation: { attemptedTurns: 1, completedTurns: 0 } })
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('retains unsettled status when send never resolves rather than fabricating closure', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(() => new Promise<never>(() => {}))
    const result = await f.execute(['one', 'two'], { timeout: 5, cleanupMs: 5 })
    expect(result).toMatchObject({ runStatus: 'aborted', timedOut: true, allRunsSettled: false })
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('still aborts a late returned root after the drain ends and retains its earlier unsettled result', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(async (instruction) => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      const { messageId, runId } = f.begin(instruction)
      return { messageId, runIds: [runId] }
    })
    const result = await f.execute(['one', 'two'], { timeout: 1, cleanupMs: 1 })
    expect(result).toMatchObject({ runStatus: 'aborted', allRunsSettled: false, rootRunIds: [] })
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(f.runtime.abort).toHaveBeenCalledWith('root-1')
    expect(result.allRunsSettled).toBe(false)
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('rejects a duplicate call identity across otherwise closed runs before another input', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId, index } = f.begin(instruction)
      const answer = `answer-${index}`
      f.emit({ type: 'message.start', messageId: answer, runId, agentId: 'worker' })
      f.emit({ type: 'tool.call', messageId: answer, callId: 'duplicate-call', toolName: 'bash', args: { command: 'true' } })
      f.emit({ type: 'tool.result', messageId: answer, callId: 'duplicate-call', result: { exitCode: 0 }, isError: false })
      f.emit({ type: 'message.end', messageId: answer })
      f.end(runId)
      return { messageId, runIds: [runId] }
    })
    const result = await f.execute(['one', 'two', 'three'])
    expect(result).toMatchObject({ runStatus: 'failed', allRunsSettled: false, conversation: { attemptedTurns: 2, completedTurns: 1 } })
    expect(f.runtime.send).toHaveBeenCalledTimes(2)
  })

  it('retains late native events and rejects a turn boundary after the root had ended', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId } = f.begin(instruction)
      f.end(runId)
      setImmediate(() => f.end(runId))
      return { messageId, runIds: [runId] }
    })
    const result = await f.execute(['one', 'two'])
    expect(result).toMatchObject({ runStatus: 'failed', allRunsSettled: true, conversation: { attemptedTurns: 1, completedTurns: 0 } })
    expect(f.events.filter((event) => event.type === 'run.end')).toHaveLength(2)
    expect(f.receipts.find((row) => row.type === 'turn.end')).toMatchObject({ nativeEventEndLine: 4 })
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('aborts and records a new root that starts in the gap after a completed turn', async () => {
    const f = fixture()
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId } = f.begin(instruction)
      f.end(runId)
      setImmediate(() => f.emit({ type: 'run.start', runId: 'late-root', agentId: 'worker', triggerMessageId: messageId }))
      return { messageId, runIds: [runId] }
    })
    const result = await f.execute(['one', 'two'])
    expect(f.runtime.abort).toHaveBeenCalledWith('late-root')
    expect(result).toMatchObject({ runStatus: 'failed', allRunsSettled: true, rootRunIds: ['root-1', 'late-root'],
      conversation: { attemptedTurns: 1, completedTurns: 0 } })
    expect(result.runs).toContainEqual({ runId: 'late-root', parentRunId: undefined, status: 'aborted', error: undefined })
    expect(f.receipts.find((row) => row.type === 'turn.end')).toMatchObject({ nativeEventEndLine: 5, rootRunIds: ['root-1', 'late-root'] })
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('retains a gap root as running when abort does not produce a real terminal event', async () => {
    const f = fixture()
    f.runtime.abort = vi.fn(async () => true)
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId } = f.begin(instruction)
      f.end(runId)
      setImmediate(() => f.emit({ type: 'run.start', runId: 'late-root', agentId: 'worker', triggerMessageId: messageId }))
      return { messageId, runIds: [runId] }
    })
    const result = await f.execute(['one', 'two'], { cleanupMs: 5 })
    expect(result).toMatchObject({ runStatus: 'failed', allRunsSettled: false })
    expect(result.runs).toContainEqual({ runId: 'late-root', parentRunId: undefined, status: 'running' })
    expect(f.runtime.abort).toHaveBeenCalledWith('late-root')
    expect(f.runtime.send).toHaveBeenCalledOnce()
  })

  it('uses the one absolute deadline across all submissions', async () => {
    vi.useFakeTimers()
    const f = fixture()
    let finish: (() => void) | undefined
    f.runtime.send = vi.fn(async (instruction) => {
      const { messageId, runId } = f.begin(instruction)
      await new Promise<void>((resolve) => { finish = resolve; setTimeout(resolve, 60) })
      if (!f.runtime.abort || vi.mocked(f.runtime.abort).mock.calls.length === 0) f.end(runId)
      return { messageId, runIds: [runId] }
    })
    f.runtime.abort = vi.fn(async (runId) => { f.end(runId, 'aborted'); finish?.(); return true })
    const result = f.execute(['one', 'two', 'three'], { timeout: 100 })
    await vi.advanceTimersByTimeAsync(101)
    await vi.runAllTimersAsync()
    expect(await result).toMatchObject({ timedOut: true, runStatus: 'aborted', conversation: { attemptedTurns: 2, completedTurns: 1 } })
    expect(f.runtime.send).toHaveBeenCalledTimes(2)
  })
})

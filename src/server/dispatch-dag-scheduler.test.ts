import { describe, expect, it, vi } from 'vitest'

import { runDispatchDag } from './dispatch-dag-scheduler'

interface Task { id: string; dependsOn?: string[] }
interface Result { status: 'complete' | 'failed' | 'aborted' | 'skipped'; error?: string }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture(tasks: Task[], seedResults?: Map<string, Result>) {
  const controller = new AbortController()
  const gates = new Map(tasks.map((task) => [task.id, deferred<Result>()]))
  const signals = new Map<string, AbortSignal>()
  const failures = new Map<string, (error: unknown) => void>()
  const observed = new Map<string, Result>()
  const contexts = new Map<string, Map<string, Result>>()
  const runTask = vi.fn(async (task: Task, results: Map<string, Result>, signal: AbortSignal, fail: (error: unknown) => void) => {
    signals.set(task.id, signal)
    failures.set(task.id, fail)
    contexts.set(task.id, new Map(results))
    return gates.get(task.id)!.promise
  })
  const onResult = vi.fn((task: Task, result: Result) => { observed.set(task.id, result) })
  const completion = runDispatchDag({
    tasks, signal: controller.signal, seedResults, runTask, onResult,
    skipped: (_task, blockers): Result => ({ status: 'skipped', error: blockers.map((blocker) => blocker.taskId).join(',') }),
    aborted: (): Result => ({ status: 'aborted' }),
    failed: (_task, error): Result => ({ status: 'failed', error: String(error) }),
  })
  const settled = vi.fn()
  const outcome = completion.then((results) => { settled(); return { results, error: undefined } },
    (error: Error) => { settled(); return { results: undefined, error } })
  return { controller, gates, signals, failures, contexts, runTask, onResult, observed, settled, outcome,
    finish: (id: string, status: Result['status'] = 'complete') => gates.get(id)!.resolve({ status }) }
}

describe('per-completion dispatch scheduling', () => {
  it('starts C as soon as A completes while independent B remains active', async () => {
    const test = fixture([{ id: 'A' }, { id: 'B' }, { id: 'C', dependsOn: ['A'] }])
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(2))
    test.finish('A')
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(3))
    expect(test.observed.has('B')).toBe(false)
    expect(test.contexts.get('C')?.get('A')?.status).toBe('complete')
    test.finish('C')
    test.finish('B')
    expect((await test.outcome).results?.size).toBe(3)
    expect(test.onResult).toHaveBeenCalledTimes(3)
  })

  it('waits for every join dependency and preserves external seeds while replacing current IDs', async () => {
    const tasks = [{ id: 'A', dependsOn: ['prior'] }, { id: 'B' }, { id: 'C', dependsOn: ['A', 'B'] }, { id: 'D', dependsOn: ['C'] }]
    const test = fixture(tasks, new Map([['prior', { status: 'complete' }], ['A', { status: 'failed' }]]))
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(2))
    test.finish('A')
    await vi.waitFor(() => expect(test.observed.has('A')).toBe(true))
    expect(test.runTask).toHaveBeenCalledTimes(2)
    test.finish('B')
    await vi.waitFor(() => expect(test.signals.has('C')).toBe(true))
    expect(test.signals.has('D')).toBe(false)
    test.finish('C')
    await vi.waitFor(() => expect(test.signals.has('D')).toBe(true))
    test.finish('D')
    const result = await test.outcome
    expect(result.error).toBeUndefined()
    expect([...result.results!.keys()].sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(test.contexts.get('A')?.get('prior')).toEqual({ status: 'complete' })
  })

  it('skips a reverse-ordered blocked chain promptly while independent work continues', async () => {
    const test = fixture([{ id: 'D', dependsOn: ['C'] }, { id: 'C', dependsOn: ['A'] }, { id: 'A' }, { id: 'B' }])
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(2))
    test.finish('A', 'failed')
    await vi.waitFor(() => expect(test.observed.get('D')?.status).toBe('skipped'))
    expect(test.observed.get('C')?.status).toBe('skipped')
    expect(test.observed.has('B')).toBe(false)
    expect(test.signals.get('B')?.aborted).toBe(false)
    test.finish('B')
    expect((await test.outcome).error).toBeUndefined()
    expect(test.runTask).toHaveBeenCalledTimes(2)
  })

  it('launches a successor only once when several predecessors settle together', async () => {
    const test = fixture([{ id: 'A' }, { id: 'B' }, { id: 'C', dependsOn: ['A', 'B'] }])
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(2))
    test.finish('A'); test.finish('B')
    await vi.waitFor(() => expect(test.signals.has('C')).toBe(true))
    test.finish('C')
    await test.outcome
    expect(test.runTask.mock.calls.map(([task]) => task.id)).toEqual(['A', 'B', 'C'])
    expect(test.onResult.mock.calls.map(([task]) => task.id).sort()).toEqual(['A', 'B', 'C'])
  })

  it('executes a diamond fork and joins D only after both branches complete', async () => {
    const test = fixture([{ id: 'A' }, { id: 'B', dependsOn: ['A'] },
      { id: 'C', dependsOn: ['A'] }, { id: 'D', dependsOn: ['B', 'C'] }])
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(1))
    expect(test.runTask.mock.calls[0][0].id).toBe('A')
    test.finish('A')
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(3))
    expect([...test.signals.keys()].sort()).toEqual(['A', 'B', 'C'])
    test.finish('B')
    await vi.waitFor(() => expect(test.observed.has('B')).toBe(true))
    expect(test.signals.has('D')).toBe(false)
    test.finish('C')
    await vi.waitFor(() => expect(test.signals.has('D')).toBe(true))
    test.finish('D')
    expect((await test.outcome).error).toBeUndefined()
    expect(test.runTask.mock.calls.filter(([task]) => task.id === 'D')).toHaveLength(1)
    expect(test.onResult.mock.calls.map(([task]) => task.id).sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('reports unresolved dependencies only after there is no in-flight work', async () => {
    const test = fixture([{ id: 'A' }, { id: 'B', dependsOn: ['missing'] }])
    await vi.waitFor(() => expect(test.signals.has('A')).toBe(true))
    expect(test.settled).not.toHaveBeenCalled()
    test.finish('A')
    expect((await test.outcome).error?.message).toContain('unresolved task')
    expect(test.observed.get('B')?.status).toBe('aborted')
  })

  it('cancels pending work immediately but retains ownership of an uncooperative active promise', async () => {
    const test = fixture([{ id: 'A' }, { id: 'C', dependsOn: ['A'] }])
    await vi.waitFor(() => expect(test.signals.has('A')).toBe(true))
    test.controller.abort()
    await vi.waitFor(() => expect(test.observed.get('C')?.status).toBe('aborted'))
    expect(test.signals.get('A')?.aborted).toBe(true)
    expect(test.settled).not.toHaveBeenCalled()
    expect(test.runTask).toHaveBeenCalledTimes(1)
    test.finish('A', 'aborted')
    expect((await test.outcome).error?.message).toBe('Orchestrator run aborted')
    expect(test.onResult).toHaveBeenCalledTimes(2)
  })

  it('cancels only this dispatch on unexpected rejection and drains its sibling', async () => {
    const test = fixture([{ id: 'A' }, { id: 'B' }, { id: 'C', dependsOn: ['A'] }])
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(2))
    test.gates.get('A')!.reject(new Error('fixture preparation failure'))
    await vi.waitFor(() => expect(test.observed.get('C')?.status).toBe('aborted'))
    expect(test.observed.get('A')?.status).toBe('failed')
    expect(test.signals.get('B')?.aborted).toBe(true)
    expect(test.controller.signal.aborted).toBe(false)
    expect(test.settled).not.toHaveBeenCalled()
    test.finish('B', 'aborted')
    expect((await test.outcome).error?.message).toContain('Dispatch task "A" unexpectedly rejected: fixture preparation failure')
    expect(test.onResult).toHaveBeenCalledTimes(3)
  })

  it('can signal infrastructure failure before a task finishes its owned-child drain', async () => {
    const test = fixture([{ id: 'A' }, { id: 'B' }, { id: 'C', dependsOn: ['A'] }])
    await vi.waitFor(() => expect(test.runTask).toHaveBeenCalledTimes(2))
    test.failures.get('A')!(new Error('failure before drain'))
    await vi.waitFor(() => expect(test.observed.get('C')?.status).toBe('aborted'))
    expect(test.signals.get('B')?.aborted).toBe(true)
    expect(test.observed.has('A')).toBe(false)
    expect(test.settled).not.toHaveBeenCalled()
    test.finish('B', 'aborted')
    test.gates.get('A')!.reject(new Error('failure after drain'))
    expect((await test.outcome).error?.message).toContain('Dispatch task "A" unexpectedly rejected: failure before drain')
    expect(test.onResult).toHaveBeenCalledTimes(3)
  })

  it('does not start tasks for an already-aborted parent', async () => {
    const controller = new AbortController()
    controller.abort()
    const runTask = vi.fn()
    const onResult = vi.fn()
    await expect(runDispatchDag({ tasks: [{ id: 'A' }], signal: controller.signal, runTask,
      skipped: (): Result => ({ status: 'skipped' }), aborted: (): Result => ({ status: 'aborted' }),
      failed: (): Result => ({ status: 'failed' }), onResult })).rejects.toThrow('Orchestrator run aborted')
    expect(runTask).not.toHaveBeenCalled()
    expect(onResult).toHaveBeenCalledOnce()
  })
})

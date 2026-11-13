interface DagTask {
  id: string
  dependsOn?: readonly string[]
}

interface DagResult {
  status: 'complete' | 'failed' | 'aborted' | 'skipped'
}

export interface DependencyBlocker<R> {
  taskId: string
  result: R
}

export async function runDispatchDag<T extends DagTask, R extends DagResult>(options: {
  tasks: readonly T[]
  signal: AbortSignal
  seedResults?: ReadonlyMap<string, R>
  runTask(task: T, results: Map<string, R>, signal: AbortSignal, fail: (error: unknown) => void): Promise<R>
  skipped(task: T, blockers: DependencyBlocker<R>[]): R
  aborted(task: T): R
  failed(task: T, error: unknown): R
  onResult(task: T, result: R): void
}): Promise<Map<string, R>> {
  const ids = new Set(options.tasks.map((task) => task.id))
  const results = new Map([...options.seedResults ?? []].filter(([id]) => !ids.has(id)))
  const pending = new Map(options.tasks.map((task) => [task.id, task]))
  const active = new Map<string, Promise<void>>()
  const controller = new AbortController()
  let wake: (() => void) | undefined
  let fatal: Error | undefined
  const notify = () => { wake?.(); wake = undefined }
  const onAbort = () => { controller.abort(); notify() }
  const stop = (error: unknown) => {
    fatal ??= error instanceof Error ? error : new Error(String(error))
    onAbort()
  }
  const settle = (task: T, result: R) => {
    if (results.has(task.id)) return
    results.set(task.id, result)
    try { options.onResult(task, result) } catch (error) { stop(error) }
    notify()
  }
  const cancelPending = () => {
    for (const task of pending.values()) {
      pending.delete(task.id)
      settle(task, options.aborted(task))
    }
  }
  const launch = (task: T) => {
    pending.delete(task.id)
    const fail = (error: unknown) => stop(new Error(`Dispatch task "${task.id}" unexpectedly rejected: ${error instanceof Error ? error.message : String(error)}`, { cause: error }))
    const promise = Promise.resolve().then(() => {
      if (controller.signal.aborted) return options.aborted(task)
      return options.runTask(task, results, controller.signal, fail)
    }).then((result) => settle(task, result), (error: unknown) => {
      fail(error)
      settle(task, options.failed(task, error))
    }).catch(stop).finally(() => {
      active.delete(task.id)
      notify()
    })
    active.set(task.id, promise)
  }
  options.signal.addEventListener('abort', onAbort, { once: true })
  if (options.signal.aborted) onAbort()
  try {
    while (pending.size > 0 || active.size > 0) {
      if (controller.signal.aborted) {
        cancelPending()
      } else {
        let skipped: boolean
        do {
          skipped = false
          for (const task of pending.values()) {
            if (controller.signal.aborted) break
            const blockers = (task.dependsOn ?? []).flatMap((id) => {
              const result = results.get(id)
              return result && result.status !== 'complete' ? [{ taskId: id, result }] : []
            })
            if (blockers.length === 0) continue
            pending.delete(task.id)
            settle(task, options.skipped(task, blockers))
            skipped = true
          }
        } while (skipped && !controller.signal.aborted)
        for (const task of pending.values()) {
          if (controller.signal.aborted) break
          if ((task.dependsOn ?? []).every((id) => results.get(id)?.status === 'complete')) launch(task)
        }
      }
      if (active.size === 0) {
        if (pending.size > 0 && !controller.signal.aborted) throw new Error('Circular dependency or unresolved task in plan')
        if (pending.size === 0) break
        continue
      }
      await new Promise<void>((resolve) => { wake = resolve })
    }
  } catch (error) {
    stop(error)
    cancelPending()
  } finally {
    if (active.size > 0) onAbort()
    await Promise.allSettled([...active.values()])
    options.signal.removeEventListener('abort', onAbort)
  }
  if (fatal) throw fatal
  if (options.signal.aborted) throw new Error('Orchestrator run aborted')
  return new Map([...results].filter(([id]) => ids.has(id)))
}

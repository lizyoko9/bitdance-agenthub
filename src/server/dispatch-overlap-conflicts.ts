import type { FileWriteConflict, RunFileWrites } from './dispatch-file-writes'

export interface TaskExecutionWrites extends RunFileWrites {
  startedSequence: number
  finishedSequence: number
}

export function detectOverlapConflicts(
  plan: ReadonlyArray<{ id: string; dependsOn?: readonly string[] }>,
  records: readonly TaskExecutionWrites[],
): FileWriteConflict[] {
  const dependencies = new Map(plan.map((task) => [task.id, task.dependsOn ?? []]))
  const ancestorsByTask = new Map<string, Set<string>>()
  const ancestors = (taskId: string): Set<string> => {
    const cached = ancestorsByTask.get(taskId)
    if (cached) return cached
    const found = new Set<string>()
    const pending = [...(dependencies.get(taskId) ?? [])]
    while (pending.length > 0) {
      const dependency = pending.pop()!
      if (found.has(dependency)) continue
      found.add(dependency)
      pending.push(...(dependencies.get(dependency) ?? []))
    }
    ancestorsByTask.set(taskId, found)
    return found
  }

  const byPath = new Map<string, Map<string, FileWriteConflict['contributors'][number]>>()
  for (let leftIndex = 0; leftIndex < records.length; leftIndex++) {
    const left = records[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex++) {
      const right = records[rightIndex]
      if (left.taskId === right.taskId
        || left.startedSequence >= right.finishedSequence
        || right.startedSequence >= left.finishedSequence
        || ancestors(left.taskId).has(right.taskId)
        || ancestors(right.taskId).has(left.taskId)) continue

      for (const [path, hash] of left.writes) {
        const otherHash = right.writes.get(path)
        if (otherHash === undefined || otherHash === hash) continue
        let contributors = byPath.get(path)
        if (!contributors) {
          contributors = new Map()
          byPath.set(path, contributors)
        }
        for (const { taskId, agentId, runId } of [left, right]) {
          contributors.set(JSON.stringify([taskId, agentId, runId]), { taskId, agentId, runId })
        }
      }
    }
  }
  return [...byPath].map(([path, contributors]) => ({ path, contributors: [...contributors.values()] }))
}

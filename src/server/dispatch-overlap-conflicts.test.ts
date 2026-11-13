import { describe, expect, it } from 'vitest'

import { detectOverlapConflicts, type TaskExecutionWrites } from './dispatch-overlap-conflicts'

function record(
  taskId: string,
  startedSequence: number,
  finishedSequence: number,
  writes: Record<string, string>,
  runId = `run_${taskId}`,
): TaskExecutionWrites {
  return { taskId, agentId: `agent_${taskId}`, runId, writes: new Map(Object.entries(writes)),
    startedSequence, finishedSequence }
}

describe('detectOverlapConflicts', () => {
  const plan = [{ id: 'A' }, { id: 'B' }, { id: 'C', dependsOn: ['A'] }]

  it('detects B/C overlap across former waves without including dependent A/C writes', () => {
    const conflicts = detectOverlapConflicts(plan, [
      record('A', 1, 3, { '/ws/overlap': 'a' }),
      record('B', 2, 6, { '/ws/overlap': 'a' }),
      record('C', 4, 5, { '/ws/overlap': 'c' }),
    ])

    expect(conflicts).toEqual([{ path: '/ws/overlap', contributors: [
      { taskId: 'B', agentId: 'agent_B', runId: 'run_B' },
      { taskId: 'C', agentId: 'agent_C', runId: 'run_C' },
    ] }])
  })

  it('allows a successor to overwrite its completed predecessor', () => {
    expect(detectOverlapConflicts(plan, [
      record('A', 1, 2, { '/ws/shared': 'before' }),
      record('C', 3, 4, { '/ws/shared': 'after' }),
    ])).toEqual([])
  })

  it('excludes direct dependency ordering even if supplied intervals overlap', () => {
    expect(detectOverlapConflicts(plan, [
      record('C', 2, 4, { '/ws/shared': 'after' }),
      record('A', 1, 3, { '/ws/shared': 'before' }),
    ])).toEqual([])
  })

  it('excludes transitive dependency ordering through tasks without write records', () => {
    const chain = [{ id: 'A' }, { id: 'middle', dependsOn: ['A'] }, { id: 'C', dependsOn: ['middle'] }]
    expect(detectOverlapConflicts(chain, [
      record('A', 1, 4, { '/ws/shared': 'before' }),
      record('C', 2, 3, { '/ws/shared': 'after' }),
    ])).toEqual([])
  })

  it('does not report identical concurrent writes or different paths', () => {
    expect(detectOverlapConflicts(plan, [
      record('A', 1, 4, { '/ws/shared': 'same', '/ws/left': 'left' }),
      record('B', 2, 3, { '/ws/shared': 'same', '/ws/right': 'right' }),
    ])).toEqual([])
  })

  it.each([[1, 2, 3, 4], [1, 2, 2, 3], [3, 4, 1, 2]])(
    'does not report independent sequential writes with boundaries %s/%s/%s/%s',
    (leftStart, leftEnd, rightStart, rightEnd) => {
      expect(detectOverlapConflicts(plan, [
        record('A', leftStart, leftEnd, { '/ws/shared': 'a' }),
        record('B', rightStart, rightEnd, { '/ws/shared': 'b' }),
      ])).toEqual([])
    },
  )

  it('uses merged retry writes and retains the final task/run attribution once', () => {
    const writes = new Map([['/ws/early-attempt', 'early'], ['/ws/updated', 'obsolete']])
    writes.set('/ws/updated', 'latest')
    const retried = { ...record('A', 1, 5, {}, 'run_A_retry'), writes }

    expect(detectOverlapConflicts(plan, [retried, record('B', 2, 4, {
      '/ws/early-attempt': 'different', '/ws/updated': 'latest',
    })])).toEqual([{ path: '/ws/early-attempt', contributors: [
      { taskId: 'A', agentId: 'agent_A', runId: 'run_A_retry' },
      { taskId: 'B', agentId: 'agent_B', runId: 'run_B' },
    ] }])
  })

  it('groups every conflicting pair once per path and deduplicates more than two contributors', () => {
    const independent = ['A', 'B', 'C', 'D', 'sequential'].map((id) => ({ id }))
    const conflicts = detectOverlapConflicts(independent, [
      record('A', 1, 8, { '/ws/shared': 'a', '/ws/second': 'a' }),
      record('B', 2, 7, { '/ws/shared': 'b', '/ws/second': 'b' }),
      record('C', 3, 6, { '/ws/shared': 'a' }),
      record('D', 4, 5, { '/ws/shared': 'd' }),
      record('sequential', 9, 10, { '/ws/shared': 'later' }),
    ])

    expect(conflicts).toHaveLength(2)
    expect(conflicts.find((conflict) => conflict.path === '/ws/shared')?.contributors.map((item) => item.taskId).sort())
      .toEqual(['A', 'B', 'C', 'D'])
    expect(conflicts.find((conflict) => conflict.path === '/ws/second')?.contributors.map((item) => item.taskId))
      .toEqual(['A', 'B'])
  })

  it('does not treat retry records of the same task as competing tasks', () => {
    expect(detectOverlapConflicts(plan, [
      record('A', 1, 4, { '/ws/shared': 'first' }, 'run_A_first'),
      record('A', 2, 3, { '/ws/shared': 'retry' }, 'run_A_retry'),
    ])).toEqual([])
  })

  it('deduplicates repeated records of the same contributor across conflict pairs', () => {
    const left = record('A', 1, 4, { '/ws/shared': 'a' })
    const conflicts = detectOverlapConflicts(plan, [left, left, record('B', 2, 3, { '/ws/shared': 'b' })])
    expect(conflicts[0].contributors).toHaveLength(2)
  })

  it('returns no conflicts for empty records or a single task', () => {
    expect(detectOverlapConflicts(plan, [])).toEqual([])
    expect(detectOverlapConflicts(plan, [record('A', 1, 2, { '/ws/shared': 'a' })])).toEqual([])
  })
})

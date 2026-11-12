import type { StreamEvent } from '../../src/shared/types'
import type { TrialRuntime } from './profile'

export interface TrialRun {
  runId: string
  parentRunId?: string
  status: 'running' | 'complete' | 'failed' | 'aborted'
  error?: string
}

export interface ExecutionResult {
  runStatus: 'complete' | 'failed' | 'aborted' | 'unknown'
  rootRunIds: string[]
  runs: TrialRun[]
  allRunsSettled: boolean
  timedOut: boolean
  budgetExhausted: boolean
  error?: string
}

export async function executeTrial(
  runtime: TrialRuntime,
  timeoutMs: number,
  onEvent: (event: StreamEvent | { type: 'eval.interaction'; action: string; pendingType: string }) => void,
  signal?: AbortSignal,
  cleanupMs = 15_000,
): Promise<ExecutionResult> {
  const runs = new Map<string, TrialRun>()
  const roots = new Set<string>()
  const approvals = new Set<ReturnType<typeof setImmediate>>()
  let startFinished = false
  let timedOut = false
  let budgetExhausted = false
  let interrupted = false
  let stopping = false
  let error: string | undefined
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined
  let resolveDone = () => {}
  const done = new Promise<void>((resolve) => { resolveDone = resolve })
  const settled = () => startFinished && roots.size > 0 && [...runs.values()].every((run) => run.status !== 'running')
  const finishIfSettled = () => { if (settled()) resolveDone() }
  const stop = (reason: string) => {
    if (stopping) return
    stopping = true
    error ??= reason
    cleanupTimer = setTimeout(resolveDone, cleanupMs)
    for (const run of runs.values()) {
      if (run.status === 'running') void runtime.abort(run.runId).catch(() => {})
    }
    finishIfSettled()
  }
  const onAbort = () => {
    interrupted = true
    stop('Trial interrupted by process signal')
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  const unsubscribe = runtime.subscribe((event) => {
    onEvent(event)
    if (event.type === 'run.start') {
      runs.set(event.runId, { runId: event.runId, parentRunId: event.parentRunId, status: 'running' })
      if (!event.parentRunId) roots.add(event.runId)
      if (stopping) void runtime.abort(event.runId).catch(() => {})
    } else if (event.type === 'run.end') {
      const run = runs.get(event.runId) ?? { runId: event.runId }
      runs.set(event.runId, { ...run, status: event.status, error: event.error })
      if (event.error?.includes('budget_exhausted')) {
        budgetExhausted = true
        stop(event.error)
      }
      finishIfSettled()
    } else if (['dispatch.plan.pending', 'bash_command.pending', 'fs_write.pending', 'ask_user.pending'].includes(event.type)) {
      const approval = setImmediate(() => {
        approvals.delete(approval)
        if (stopping) return
        try {
          runtime.approvePending(event)
          onEvent({ type: 'eval.interaction', action: event.type === 'ask_user.pending' ? 'fixed_answer' : 'approve', pendingType: event.type })
        } catch (failure) {
          stop(`Approval failed: ${failure instanceof Error ? failure.message : String(failure)}`)
        }
      })
      approvals.add(approval)
    }
  })
  const timer = setTimeout(() => {
    timedOut = true
    stop(`Trial timed out after ${timeoutMs}ms`)
  }, timeoutMs)
  try {
    if (signal?.aborted) onAbort()
    if (!stopping) {
      void runtime.start().then((result) => {
        for (const runId of result.runIds) {
          roots.add(runId)
          if (!runs.has(runId)) runs.set(runId, { runId, status: 'running' })
          if (stopping) void runtime.abort(runId).catch(() => {})
        }
        startFinished = true
        if (result.runIds.length === 0) stop('sendMessage started no root run')
        finishIfSettled()
      }).catch((failure) => {
        startFinished = true
        stop(failure instanceof Error ? failure.message : String(failure))
      })
    } else {
      startFinished = true
    }
    finishIfSettled()
    await done
  } catch (failure) {
    startFinished = true
    stop(failure instanceof Error ? failure.message : String(failure))
    await done
  } finally {
    clearTimeout(timer)
    if (cleanupTimer) clearTimeout(cleanupTimer)
    signal?.removeEventListener('abort', onAbort)
    for (const approval of approvals) clearImmediate(approval)
    unsubscribe()
  }
  const rootStatuses = [...roots].map((id) => runs.get(id)?.status)
  error ??= [...runs.values()].find((run) => run.error)?.error
  const runStatus = timedOut || interrupted ? 'aborted'
    : budgetExhausted || error || rootStatuses.includes('failed') ? 'failed'
    : rootStatuses.includes('aborted') ? 'aborted'
    : settled() && rootStatuses.every((status) => status === 'complete') ? 'complete' : 'unknown'
  return { runStatus, rootRunIds: [...roots], runs: [...runs.values()], allRunsSettled: settled(), timedOut, budgetExhausted, error }
}

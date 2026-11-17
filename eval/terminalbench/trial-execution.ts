import { createHash } from 'node:crypto'

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
  terminationReason: TrialTerminationReason
  rootRunIds: string[]
  runs: TrialRun[]
  allRunsSettled: boolean
  timedOut: boolean
  budgetExhausted: boolean
  error?: string
}

interface TrialExecutionOptions {
  strictLifecycle?: boolean
  instruction?: string
  onSubmitted?: (result: { messageId?: string; runIds: string[] }) => void
  cleanupDeadline?: () => number
}

const ERROR_TERMINATIONS = ['iteration_limit', 'output_limit', 'content_filter', 'model_interrupted', 'budget_exhausted'] as const
export type TrialTerminationReason = typeof ERROR_TERMINATIONS[number] | 'completed' | 'timed_out' | 'aborted' | 'error' | 'unknown'

export function classifyTrialTermination(result: Pick<ExecutionResult, 'runStatus' | 'timedOut' | 'error'>): TrialTerminationReason {
  if (result.timedOut) return 'timed_out'
  if (result.runStatus === 'aborted') return 'aborted'
  if (result.error) return ERROR_TERMINATIONS.find((reason) => result.error?.startsWith(`${reason}:`)) ?? 'error'
  if (result.runStatus === 'complete') return 'completed'
  return result.runStatus === 'failed' ? 'error' : 'unknown'
}

export async function executeTrial(
  runtime: TrialRuntime,
  timeoutMs: number,
  onEvent: (event: StreamEvent | { type: 'eval.interaction'; action: string; pendingType: string }) => void,
  signal?: AbortSignal,
  cleanupMs = 15_000,
  options: TrialExecutionOptions = {},
): Promise<ExecutionResult> {
  const runs = new Map<string, TrialRun>()
  const roots = new Set<string>()
  const approvals = new Set<ReturnType<typeof setImmediate>>()
  let startFinished = false
  let timedOut = false
  let budgetExhausted = false
  let interrupted = false
  let stopping = false
  let invalidLifecycle = false
  const startedRuns = new Set<string>()
  const endedRuns = new Set<string>()
  const triggers = new Map<string, string>()
  const messages = new Map<string, { runId: string; ended: boolean; parts: Set<number> }>()
  const calls = new Map<string, { messageId: string; ended: boolean }>()
  const userMessages = new Set<string>()
  let submittedMessageId: string | undefined
  let submittedRoots: string[] | undefined
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
    cleanupTimer = setTimeout(resolveDone, options.cleanupDeadline ? Math.max(0, options.cleanupDeadline() - performance.now()) : cleanupMs)
    for (const run of runs.values()) {
      if (run.status === 'running') void runtime.abort(run.runId).catch(() => {})
    }
    finishIfSettled()
  }
  const onAbort = () => {
    interrupted = true
    stop('Trial interrupted by process signal')
  }
  const invalid = (reason: string) => {
    invalidLifecycle = true
    stop(`Invalid native lifecycle: ${reason}`)
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  const unsubscribe = runtime.subscribe((event) => {
    onEvent(event)
    if (options.strictLifecycle) {
      if (event.type === 'message.added' && event.message.role === 'user') {
        if (userMessages.has(event.message.id) || event.message.parts.length !== 1
          || event.message.parts[0].type !== 'text' || event.message.parts[0].content !== options.instruction) invalid('submitted user text differs from the original turn')
        userMessages.add(event.message.id)
      } else if (event.type === 'message.start') {
        if (messages.has(event.messageId) || !startedRuns.has(event.runId) || endedRuns.has(event.runId)) invalid('message has no open unique run')
        messages.set(event.messageId, { runId: event.runId, ended: false, parts: new Set() })
      } else if (event.type === 'part.start' || event.type === 'part.end') {
        const message = messages.get(event.messageId)
        if (!message || message.ended) invalid('part has no open message')
        else if (event.type === 'part.start') {
          if (message.parts.has(event.partIndex)) invalid('duplicate open part')
          message.parts.add(event.partIndex)
        } else if (!message.parts.delete(event.partIndex)) invalid('part end has no open part')
      } else if (event.type === 'tool.call') {
        const message = messages.get(event.messageId)
        if (!message || message.ended || calls.has(event.callId)) invalid('tool call has no open message or duplicates a call')
        calls.set(event.callId, { messageId: event.messageId, ended: false })
      } else if (event.type === 'tool.result') {
        const call = calls.get(event.callId)
        if (!call || call.ended || call.messageId !== event.messageId) invalid('tool result has no matching open call')
        else call.ended = true
      } else if (event.type === 'message.end') {
        const message = messages.get(event.messageId)
        if (!message || message.ended || message.parts.size || [...calls.values()].some((call) => call.messageId === event.messageId && !call.ended)) invalid('message did not close its parts and calls')
        if (message) message.ended = true
      }
    }
    if (event.type === 'run.start') {
      if (options.strictLifecycle) {
        if (startedRuns.has(event.runId) || endedRuns.has(event.runId)) invalid('duplicate run start')
        if (!userMessages.has(event.triggerMessageId) || (submittedMessageId && submittedMessageId !== event.triggerMessageId)
          || (!event.parentRunId && submittedRoots && !submittedRoots.includes(event.runId))) invalid('run trigger does not match submitted user message')
        startedRuns.add(event.runId)
        triggers.set(event.runId, event.triggerMessageId)
      }
      runs.set(event.runId, { runId: event.runId, parentRunId: event.parentRunId, status: 'running' })
      if (!event.parentRunId) roots.add(event.runId)
      if (stopping) void runtime.abort(event.runId).catch(() => {})
    } else if (event.type === 'run.end') {
      if (options.strictLifecycle) {
        if (!startedRuns.has(event.runId) || endedRuns.has(event.runId)
          || [...messages.values()].some((message) => message.runId === event.runId && !message.ended)) invalid('run end is unmatched or has open messages')
        endedRuns.add(event.runId)
      }
      const run = runs.get(event.runId) ?? { runId: event.runId }
      runs.set(event.runId, { ...run, status: event.status, error: event.error })
      if (event.error?.startsWith('budget_exhausted:')) {
        budgetExhausted = true
        stop(event.error)
      }
      if (options.strictLifecycle && event.status !== 'complete') {
        if (event.status === 'aborted' && !stopping) interrupted = true
        stop(event.error ?? `Run ${event.runId} ${event.status}`)
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
        options.onSubmitted?.(result)
        if (options.strictLifecycle) {
          const messageId = 'messageId' in result ? result.messageId : undefined
          if (typeof messageId !== 'string' || !messageId || userMessages.size !== 1 || !userMessages.has(messageId)
            || result.runIds.length !== 1 || new Set(result.runIds).size !== result.runIds.length
            || result.runIds.some((id) => triggers.has(id) && triggers.get(id) !== messageId)
            || [...roots].some((id) => !result.runIds.includes(id))) invalid('submission IDs do not match native roots')
          if (typeof messageId === 'string') submittedMessageId = messageId
          submittedRoots = result.runIds
        }
        for (const runId of result.runIds) {
          roots.add(runId)
          if (!runs.has(runId)) runs.set(runId, { runId, status: 'running' })
          if (stopping && (!options.strictLifecycle || runs.get(runId)?.status === 'running')) void runtime.abort(runId).catch(() => {})
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
    : settled() && !invalidLifecycle && rootStatuses.every((status) => status === 'complete') ? 'complete' : 'unknown'
  const terminationReason = classifyTrialTermination({ runStatus, timedOut, error })
  return { runStatus, terminationReason, rootRunIds: [...roots], runs: [...runs.values()], allRunsSettled: settled() && !invalidLifecycle, timedOut, budgetExhausted, error }
}

type TrialEvent = StreamEvent | { type: 'eval.interaction'; action: string; pendingType: string }
export interface ConversationExecutionResult extends ExecutionResult {
  conversation: { plannedTurns: number; completedTurns: number; attemptedTurns: number }
}

export async function executeConversationTrial(
  runtime: TrialRuntime,
  turns: string[],
  onEvent: (event: TrialEvent) => void,
  options: {
    deadline: number
    nativeEventLine(): number
    onReceipt(receipt: Record<string, unknown>): void
    signal?: AbortSignal
    cleanupMs?: number
  },
): Promise<ConversationExecutionResult> {
  if (!runtime.send) throw new Error('Fixed conversation requires the headless send operation')
  const hashes = turns.map((turn) => createHash('sha256').update(turn).digest('hex'))
  const receipt = (value: Record<string, unknown>) => options.onReceipt({ schemaVersion: 1, ...value, timestamp: Date.now() })
  receipt({ type: 'conversation.start', conversationId: runtime.conversationId, plannedTurns: turns.length, inputSha256: hashes })
  let listener: ((event: StreamEvent) => void) | undefined
  let outsideTurn = false
  const seen = { runs: new Set<string>(), messages: new Set<string>(), calls: new Set<string>() }
  let collision = false
  let cleanupDeadline: number | undefined
  const sharedCleanupDeadline = () => cleanupDeadline ??= performance.now() + (options.cleanupMs ?? 15_000)
  const controller = new AbortController()
  const relayAbort = () => controller.abort()
  options.signal?.addEventListener('abort', relayAbort, { once: true })
  if (options.signal?.aborted) relayAbort()
  const observedRuns = new Map<string, TrialRun>()
  const observedRoots = new Set<string>()
  const aborting = new Set<string>()
  const abortErrors: string[] = []
  let turnObservedIds: Set<string> | undefined
  let notifyDrain = () => {}
  const abortObserved = () => {
    sharedCleanupDeadline()
    for (const run of observedRuns.values()) {
      if (run.status !== 'running' || aborting.has(run.runId)) continue
      aborting.add(run.runId)
      try {
        void runtime.abort(run.runId).catch((error: unknown) => {
          abortErrors.push(`Abort ${run.runId} failed: ${error instanceof Error ? error.message : String(error)}`)
        })
      } catch (error) {
        abortErrors.push(`Abort ${run.runId} failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  const drainObserved = async () => {
    abortObserved()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await new Promise<void>((resolve) => {
        notifyDrain = () => { if ([...observedRuns.values()].every((run) => run.status !== 'running')) resolve() }
        timer = setTimeout(resolve, Math.max(0, sharedCleanupDeadline() - performance.now()))
        notifyDrain()
      })
    } finally {
      if (timer) clearTimeout(timer)
      notifyDrain = () => {}
    }
  }
  const unsubscribe = runtime.subscribe((event) => {
    onEvent(event)
    if (!listener) outsideTurn = true
    if (event.type === 'run.start') {
      observedRuns.set(event.runId, { runId: event.runId, parentRunId: event.parentRunId, status: 'running' })
      if (!event.parentRunId) observedRoots.add(event.runId)
      turnObservedIds?.add(event.runId)
      aborting.delete(event.runId)
    } else if (event.type === 'run.end') {
      const previous = observedRuns.get(event.runId) ?? { runId: event.runId }
      observedRuns.set(event.runId, { ...previous, status: event.status, error: event.error })
    }
    const identity = event.type === 'run.start' ? [seen.runs, event.runId] as const
      : event.type === 'message.start' ? [seen.messages, event.messageId] as const
      : event.type === 'tool.call' ? [seen.calls, event.callId] as const : undefined
    if (identity) {
      if (identity[0].has(identity[1])) collision = true
      identity[0].add(identity[1])
    }
    listener?.(event)
    if (outsideTurn || collision) {
      controller.abort()
      abortObserved()
    }
    notifyDrain()
  })
  const allRuns: TrialRun[] = []
  const roots: string[] = []
  let completedTurns = 0
  let attemptedTurns = 0
  let outcome: ExecutionResult = { runStatus: 'unknown', terminationReason: 'unknown', rootRunIds: [], runs: [], allRunsSettled: true, timedOut: false, budgetExhausted: false }
  try {
    for (const [index, instruction] of turns.entries()) {
      const remaining = options.deadline - performance.now()
      if (controller.signal.aborted || remaining <= 0) {
        outcome = { ...outcome, runStatus: 'aborted', terminationReason: controller.signal.aborted ? 'aborted' : 'timed_out', timedOut: remaining <= 0,
          error: controller.signal.aborted ? 'Trial interrupted before next user input' : 'Trial deadline exhausted before next user input' }
        break
      }
      attemptedTurns++
      let userMessageId: string | null = null
      turnObservedIds = new Set()
      const nativeEventStartLine = options.nativeEventLine() + 1
      receipt({ type: 'turn.start', index: index + 1, instructionSha256: hashes[index], nativeEventStartLine })
      const turnRuntime: TrialRuntime = {
        ...runtime,
        subscribe(callback) { listener = callback; return () => { listener = undefined } },
        start: () => runtime.send!(instruction),
      }
      outcome = await executeTrial(turnRuntime, remaining, (event) => {
        if (event.type === 'eval.interaction') onEvent(event)
      }, controller.signal, options.cleanupMs, {
        strictLifecycle: true,
        instruction,
        cleanupDeadline: sharedCleanupDeadline,
        onSubmitted(result) { userMessageId = result.messageId ?? null },
      })
      await new Promise<void>((resolve) => setImmediate(resolve))
      for (const run of outcome.runs) {
        if (!observedRuns.has(run.runId)) observedRuns.set(run.runId, run)
        turnObservedIds.add(run.runId)
      }
      if (outsideTurn || collision || outcome.runStatus !== 'complete' || !outcome.allRunsSettled) await drainObserved()
      const currentRuns = [...turnObservedIds].map((id) => observedRuns.get(id)!)
      outcome = { ...outcome, runs: currentRuns,
        rootRunIds: [...new Set([...outcome.rootRunIds, ...[...turnObservedIds].filter((id) => observedRoots.has(id))])],
        allRunsSettled: outcome.allRunsSettled && currentRuns.every((run) => run.status !== 'running'),
        ...(abortErrors.length ? { error: outcome.error ?? abortErrors.join('; ') } : {}),
      }
      if (outsideTurn || collision || (!userMessageId && outcome.runStatus === 'complete')) {
        const integrityFailure = !options.signal?.aborted && !outcome.timedOut && (outcome.runStatus === 'complete' || outcome.terminationReason === 'aborted')
        outcome = { ...outcome, runStatus: integrityFailure ? 'failed' : outcome.runStatus,
          terminationReason: integrityFailure ? 'error' : outcome.terminationReason,
          error: outcome.error ?? 'Conversation native identity or turn boundary is incomplete' }
      }
      allRuns.push(...outcome.runs)
      roots.push(...outcome.rootRunIds)
      receipt({ type: 'turn.end', index: index + 1, instructionSha256: hashes[index], userMessageId,
        nativeEventStartLine, nativeEventEndLine: options.nativeEventLine(), ...outcome })
      if (outcome.runStatus !== 'complete' || outcome.terminationReason !== 'completed' || !outcome.allRunsSettled) break
      completedTurns++
    }
  } finally {
    unsubscribe()
    options.signal?.removeEventListener('abort', relayAbort)
  }
  const conversation = { plannedTurns: turns.length, completedTurns, attemptedTurns }
  const result = { ...outcome, rootRunIds: roots, runs: allRuns, conversation }
  receipt({ type: 'conversation.end', conversationId: runtime.conversationId, ...conversation,
    runStatus: result.runStatus, terminationReason: result.terminationReason, allRunsSettled: result.allRunsSettled })
  return result
}

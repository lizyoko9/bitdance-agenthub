import type { RunUsageEvent, StreamEvent } from '@/shared/types'

import type { TaskCategory } from './fixtures.ts'

export const EVAL_GROUPS = ['single', 'orch-nogate', 'orch-gate'] as const
export type EvalGroup = (typeof EVAL_GROUPS)[number]

export interface TokenTotals {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export interface CaseCounters {
  planTasks: number
  plans: number
  dispatchCount: number
  failedDispatches: number
  questions: number
  bashApprovals: number
  tokens: TokenTotals
}

export interface CaseResult extends CaseCounters {
  caseId: string
  taskId: string
  category: TaskCategory
  group: EvalGroup
  repeat: number
  passed: boolean
  acceptExitCode: number | null
  acceptOutput: string
  rootRunStatus: 'complete' | 'failed' | 'aborted' | 'unknown'
  timedOut: boolean
  wallMs: number
  error?: string
}

/** 从一个会话的事件流里累计指标，并判断所有 run 是否都已结束。 */
export class CaseTracker {
  private readonly started = new Set<string>()
  private readonly ended = new Map<string, 'complete' | 'failed' | 'aborted'>()
  private readonly rootRunIds = new Set<string>()
  private readonly usageByRun = new Map<string, RunUsageEvent>()
  private readonly counters: Omit<CaseCounters, 'tokens'> = {
    planTasks: 0,
    plans: 0,
    dispatchCount: 0,
    failedDispatches: 0,
    questions: 0,
    bashApprovals: 0,
  }

  apply(event: StreamEvent): void {
    switch (event.type) {
      case 'run.start':
        this.started.add(event.runId)
        if (!event.parentRunId) this.rootRunIds.add(event.runId)
        return
      case 'run.end':
        this.ended.set(event.runId, event.status)
        return
      case 'run.usage':
        // adapter 可能多次上报同一 run，取最新（与 agent-runner 落库语义一致）
        this.usageByRun.set(event.runId, event.usage)
        return
      case 'dispatch.plan':
        this.counters.plans++
        this.counters.planTasks += event.plan.length
        return
      case 'dispatch.start':
        this.counters.dispatchCount++
        return
      case 'dispatch.end':
        if (event.status !== 'complete') this.counters.failedDispatches++
        return
      case 'ask_user.pending':
        this.counters.questions++
        return
      case 'bash_command.pending':
        this.counters.bashApprovals++
        return
    }
  }

  settled(): boolean {
    return this.rootRunIds.size > 0 && [...this.started].every((runId) => this.ended.has(runId))
  }

  runningRunIds(): string[] {
    return [...this.started].filter((runId) => !this.ended.has(runId))
  }

  rootRunStatus(): CaseResult['rootRunStatus'] {
    const statuses = [...this.rootRunIds].map((runId) => this.ended.get(runId))
    if (statuses.length === 0 || statuses.some((s) => s === undefined)) return 'unknown'
    if (statuses.includes('aborted')) return 'aborted'
    if (statuses.includes('failed')) return 'failed'
    return 'complete'
  }

  snapshot(): CaseCounters {
    const tokens: TokenTotals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
    for (const usage of this.usageByRun.values()) {
      tokens.inputTokens += usage.inputTokens
      tokens.outputTokens += usage.outputTokens
      tokens.cacheReadTokens += usage.cacheReadTokens
      tokens.cacheCreationTokens += usage.cacheCreationTokens
    }
    return { ...this.counters, tokens }
  }
}

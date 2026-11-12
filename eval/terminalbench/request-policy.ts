import { z } from 'zod'

import type {
  CustomAgentAdapterOptions,
  CustomRequestObservation,
} from '../../src/server/adapters/custom-request-policy'

export type { CustomAgentAdapterOptions, CustomRequestObservation }

export const DEFAULT_EVAL_REQUEST_LIMITS = {
  maxRequests: 8,
  maxRequestBytes: 64 * 1024,
  maxTotalRequestBytes: 256 * 1024,
  maxCompletionTokens: 2048,
} as const

const LimitsSchema = z.object({
  maxRequests: z.number().int().positive().max(DEFAULT_EVAL_REQUEST_LIMITS.maxRequests).default(DEFAULT_EVAL_REQUEST_LIMITS.maxRequests),
  maxRequestBytes: z.number().int().positive().max(DEFAULT_EVAL_REQUEST_LIMITS.maxRequestBytes).default(DEFAULT_EVAL_REQUEST_LIMITS.maxRequestBytes),
  maxTotalRequestBytes: z.number().int().positive().max(DEFAULT_EVAL_REQUEST_LIMITS.maxTotalRequestBytes).default(DEFAULT_EVAL_REQUEST_LIMITS.maxTotalRequestBytes),
  maxCompletionTokens: z.number().int().positive().max(DEFAULT_EVAL_REQUEST_LIMITS.maxCompletionTokens).default(DEFAULT_EVAL_REQUEST_LIMITS.maxCompletionTokens),
})

export type EvalRequestLimits = z.input<typeof LimitsSchema>

export class EvalBudgetExceededError extends Error {
  readonly code = 'budget_exhausted'

  constructor(reason: string) {
    super(`budget_exhausted: ${reason}`)
    this.name = 'EvalBudgetExceededError'
  }
}

export function isEvalBudgetExceeded(error: unknown): boolean {
  return error instanceof EvalBudgetExceededError || (
    !!error && typeof error === 'object' && 'code' in error && error.code === 'budget_exhausted'
  )
}

export function createEvalRequestPolicy(
  limits: EvalRequestLimits = {},
  onObservation: (observation: CustomRequestObservation) => void = () => {},
): CustomAgentAdapterOptions {
  const configured = LimitsSchema.parse(limits)
  let requestCount = 0
  let totalRequestBytes = 0
  let exhausted: EvalBudgetExceededError | undefined
  const rejectBudget = (reason: string): never => {
    exhausted = new EvalBudgetExceededError(reason)
    throw exhausted
  }
  return {
    maxRetries: 0,
    requestSettings: { reasoning_effort: 'none', max_completion_tokens: configured.maxCompletionTokens },
    requestPolicy: {
      beforeRequest(_context, bodyBytes, signal) {
        signal.throwIfAborted()
        if (exhausted) throw exhausted
        if (!Number.isSafeInteger(bodyBytes) || bodyBytes < 0) throw new Error('Request body size must be a nonnegative integer')
        if (requestCount >= configured.maxRequests) rejectBudget('maximum HTTP requests reached')
        if (bodyBytes > configured.maxRequestBytes) rejectBudget('request body exceeds byte limit')
        if (totalRequestBytes + bodyBytes > configured.maxTotalRequestBytes) rejectBudget('cumulative request bodies exceed byte limit')
        totalRequestBytes += bodyBytes
        return ++requestCount
      },
      observe: onObservation,
    },
  }
}

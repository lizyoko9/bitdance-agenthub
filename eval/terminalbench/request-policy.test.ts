import { describe, expect, it, vi } from 'vitest'

import type { CustomRequestContext } from '../../src/server/adapters/custom-request-policy'
import { createEvalRequestPolicy, DEFAULT_EVAL_REQUEST_LIMITS, isEvalBudgetExceeded } from './request-policy'

const context: CustomRequestContext = {
  runId: 'run-test', agentId: 'agent-test', conversationId: 'conv-test', messageId: 'message-test',
  provider: 'openai', requestedModel: 'gpt-6-luna', turn: 1,
}
const signal = () => new AbortController().signal

describe('Terminal-Bench request policy', () => {
  it('sets the approved output limit, reasoning mode and retry policy', () => {
    const options = createEvalRequestPolicy()
    expect(options.maxRetries).toBe(0)
    expect(options.requestSettings).toEqual({ reasoning_effort: 'none', max_completion_tokens: 2048 })
  })

  it('shares a strict eight-request limit across interleaved runs', () => {
    const policy = createEvalRequestPolicy().requestPolicy!
    for (let n = 1; n <= DEFAULT_EVAL_REQUEST_LIMITS.maxRequests; n++) {
      expect(policy.beforeRequest({ ...context, runId: `run-${n}` }, 1, signal())).toBe(n)
    }
    expect(() => policy.beforeRequest(context, 1, signal())).toThrow('budget_exhausted')
  })

  it('checks individual byte boundaries before reserving a request and latches exhaustion', () => {
    const policy = createEvalRequestPolicy().requestPolicy!
    expect(policy.beforeRequest(context, 65536, signal())).toBe(1)
    expect(() => policy.beforeRequest(context, 65537, signal())).toThrow('request body exceeds')
    expect(() => policy.beforeRequest(context, 1, signal())).toThrow('budget_exhausted')
  })

  it('checks cumulative UTF-8 body bytes across all runs', () => {
    const policy = createEvalRequestPolicy().requestPolicy!
    for (let n = 1; n <= 4; n++) expect(policy.beforeRequest(context, 65536, signal())).toBe(n)
    expect(() => policy.beforeRequest(context, 1, signal())).toThrow('cumulative request bodies')
  })

  it('uses an explicitly larger request and cumulative-input budget without a hidden eight-request cap', () => {
    const policy = createEvalRequestPolicy({ maxRequests: 12, maxTotalRequestBytes: 1024 * 1024 }).requestPolicy!
    for (let n = 1; n <= 12; n++) expect(policy.beforeRequest({ ...context, runId: `run-${n}` }, 65536, signal())).toBe(n)
    expect(() => policy.beforeRequest(context, 1, signal())).toThrow('maximum HTTP requests reached')
  })

  it('applies explicit larger output and body settings while enforcing the selected boundary', () => {
    const options = createEvalRequestPolicy({ maxRequestBytes: 256 * 1024, maxTotalRequestBytes: 4 * 1024 * 1024, maxCompletionTokens: 8192 })
    expect(options.requestSettings).toEqual({ reasoning_effort: 'none', max_completion_tokens: 8192 })
    const policy = options.requestPolicy!
    expect(policy.beforeRequest(context, 256 * 1024, signal())).toBe(1)
    expect(() => policy.beforeRequest(context, 256 * 1024 + 1, signal())).toThrow('request body exceeds')
  })

  it('does not reserve an aborted attempt or invent a usage observation', () => {
    const observed = vi.fn()
    const policy = createEvalRequestPolicy({}, observed).requestPolicy!
    const controller = new AbortController()
    controller.abort()
    expect(() => policy.beforeRequest(context, 20, controller.signal)).toThrow()
    expect(policy.beforeRequest(context, 20, signal())).toBe(1)
    expect(observed).not.toHaveBeenCalled()
  })

  it('rejects invalid or excessive limits and identifies a serialized budget error', () => {
    expect(() => createEvalRequestPolicy({ maxRequests: 1001 })).toThrow()
    expect(() => createEvalRequestPolicy({ maxTotalRequestBytes: 64 * 1024 * 1024 + 1 })).toThrow()
    expect(() => createEvalRequestPolicy({ maxRequestBytes: -1 })).toThrow()
    expect(() => createEvalRequestPolicy({ maxRequestBytes: 256 * 1024 + 1 })).toThrow()
    expect(() => createEvalRequestPolicy({ maxCompletionTokens: 8193 })).toThrow()
    expect(isEvalBudgetExceeded({ code: 'budget_exhausted' })).toBe(true)
    expect(isEvalBudgetExceeded(new Error('Connection error'))).toBe(false)
  })
})

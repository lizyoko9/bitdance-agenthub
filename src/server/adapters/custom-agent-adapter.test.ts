import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEvalRequestPolicy, EvalBudgetExceededError } from '../../../eval/terminalbench/request-policy'
import type { StreamEvent } from '@/shared/types'

import { CustomAgentAdapter } from './custom-agent-adapter'
import { DEFAULT_CUSTOM_MAX_TURNS, CustomAgentTerminationError } from './custom-agent-limits'
import type { CustomRequestObservation } from './custom-request-policy'
import type { AdapterInput } from './types'

const tools = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@/server/tools/registry', () => ({
  toolRegistry: {
    resolve: (names: string[]) => names.map((name) => ({ name, description: name, parameters: { type: 'object' } })),
    execute: tools.execute,
  },
}))

const input = (patch: Partial<AdapterInput> = {}): AdapterInput => ({
  agentId: 'agent-request-test', conversationId: 'conv-request-test', runId: 'run-request-test',
  workspacePath: '/app', prompt: 'Complete the task', systemPrompt: 'Use the available tools',
  apiKey: 'not-a-real-key', apiBaseUrl: null, modelId: 'gpt-6-luna', toolNames: [],
  customConfig: { modelProvider: 'openai' }, ...patch,
})

function response(chunks: unknown[]): Response {
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', {
    headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req-public-test' },
  })
}

function chunk(choices: unknown[], usage?: unknown) {
  return { id: 'chatcmpl-test', object: 'chat.completion.chunk', created: 1, model: 'gpt-6-luna-test', system_fingerprint: 'fp-test', choices, ...(usage ? { usage } : {}) }
}

const done = () => response([chunk([{ index: 0, delta: { content: 'Done' }, finish_reason: 'stop' }])])

const toolResponse = (finishReason: string | null = 'tool_calls') => response([
  chunk([{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-tool', type: 'function', function: { name: 'bash', arguments: '{"command":"pwd"}' } }] }, finish_reason: finishReason }]),
  chunk([], { prompt_tokens: 10, completion_tokens: 2 }),
])

async function consume(adapter: CustomAgentAdapter, adapterInput = input(), signal = new AbortController().signal) {
  const events: StreamEvent[] = []
  for await (const event of adapter.stream(adapterInput, signal)) events.push(event)
  return events
}

describe('Custom adapter optional request policy', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AGENTHUB_CUSTOM_MAX_TURNS', undefined)
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(async () => done())
    tools.execute.mockResolvedValue({ ok: true, value: { exitCode: 0 } })
  })

  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('can complete beyond eight turns with the finite default', async () => {
    let turn = 0
    fetchMock.mockImplementation(async () => ++turn <= 9 ? toolResponse() : done())
    const events = await consume(new CustomAgentAdapter(), input({ toolNames: ['bash'] }))
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(tools.execute).toHaveBeenCalledTimes(9)
    expect(events.at(-1)?.type).toBe('run.usage')
  })

  it('keeps the fallback finite and retains usage when iteration exhaustion fails', async () => {
    fetchMock.mockImplementation(async () => toolResponse())
    const events: StreamEvent[] = []
    const run = async () => {
      for await (const event of new CustomAgentAdapter().stream(input({ toolNames: ['bash'] }), new AbortController().signal)) events.push(event)
    }
    await expect(run()).rejects.toMatchObject({ code: 'iteration_limit', turns: DEFAULT_CUSTOM_MAX_TURNS, maxTurns: DEFAULT_CUSTOM_MAX_TURNS })
    expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_CUSTOM_MAX_TURNS)
    expect(tools.execute).toHaveBeenCalledTimes(DEFAULT_CUSTOM_MAX_TURNS)
    expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: { inputTokens: 320, outputTokens: 64 } })
  })

  it('honors an explicit turn limit and reports exhaustion instead of normal completion', async () => {
    fetchMock.mockImplementation(async () => toolResponse())
    await expect(consume(new CustomAgentAdapter({ maxTurns: 2 }), input({ toolNames: ['bash'] })))
      .rejects.toMatchObject({ code: 'iteration_limit', message: expect.stringMatching(/^iteration_limit:/), turns: 2, maxTurns: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(tools.execute).toHaveBeenCalledTimes(2)
  })

  it('allows voluntary stop on the final configured turn', async () => {
    fetchMock.mockResolvedValueOnce(toolResponse())
    await expect(consume(new CustomAgentAdapter({ maxTurns: 2 }), input({ toolNames: ['bash'] }))).resolves.toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(tools.execute).toHaveBeenCalledTimes(1)
  })

  it('uses environment configuration unless a runtime override is supplied', async () => {
    vi.stubEnv('AGENTHUB_CUSTOM_MAX_TURNS', '1')
    fetchMock.mockImplementation(async () => toolResponse())
    await expect(consume(new CustomAgentAdapter(), input({ toolNames: ['bash'] }))).rejects.toMatchObject({ maxTurns: 1 })
    vi.stubEnv('AGENTHUB_CUSTOM_MAX_TURNS', 'invalid')
    await expect(consume(new CustomAgentAdapter({ maxTurns: 2 }), input({ toolNames: ['bash'] }))).rejects.toMatchObject({ maxTurns: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 10_001])('rejects invalid runtime maxTurns %s before requests', (maxTurns) => {
    expect(() => new CustomAgentAdapter({ maxTurns })).toThrow(/maxTurns/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['', 'invalid', '0', '-1', '1.5', '10001'])('rejects invalid environment maxTurns %s before requests', (maxTurns) => {
    vi.stubEnv('AGENTHUB_CUSTOM_MAX_TURNS', maxTurns)
    expect(() => new CustomAgentAdapter()).toThrow(/AGENTHUB_CUSTOM_MAX_TURNS/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not execute truncated tool arguments as a completed task', async () => {
    fetchMock.mockResolvedValueOnce(toolResponse('length'))
    await expect(consume(new CustomAgentAdapter(), input({ toolNames: ['bash'] })))
      .rejects.toMatchObject({ code: 'output_limit', message: expect.stringMatching(/^output_limit:/) })
    expect(tools.execute).not.toHaveBeenCalled()
  })

  it.each(['length', 'content_filter', null])('does not treat finish reason %s without tools as voluntary completion', async (finishReason) => {
    fetchMock.mockResolvedValueOnce(response([chunk([{ index: 0, delta: { content: 'Partial' }, finish_reason: finishReason }])]))
    const code = finishReason === 'length' ? 'output_limit' : finishReason === 'content_filter' ? 'content_filter' : 'model_interrupted'
    await expect(consume(new CustomAgentAdapter())).rejects.toMatchObject({ code })
  })

  it.each(['stop', 'tool_calls'])('rejects an incomplete tool delta with finish reason %s instead of dropping it', async (finishReason) => {
    fetchMock.mockResolvedValueOnce(response([chunk([{ index: 0, delta: {
      tool_calls: [{ index: 0, id: 'incomplete-call', type: 'function', function: { arguments: '{}' } }],
    }, finish_reason: finishReason }])]))
    await expect(consume(new CustomAgentAdapter(), input({ toolNames: ['bash'] }))).rejects.toMatchObject({ code: 'model_interrupted' })
    expect(tools.execute).not.toHaveBeenCalled()
  })

  it('does not misclassify cancellation during the final tool as iteration exhaustion', async () => {
    const controller = new AbortController()
    fetchMock.mockResolvedValueOnce(toolResponse())
    tools.execute.mockImplementationOnce(async () => {
      controller.abort()
      return { ok: true, value: 'cancelled' }
    })
    await expect(consume(new CustomAgentAdapter({ maxTurns: 1 }), input({ toolNames: ['bash'] }), controller.signal)).resolves.toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps counters independent for concurrent runs sharing an adapter', async () => {
    fetchMock.mockImplementation(async () => toolResponse())
    const adapter = new CustomAgentAdapter({ maxTurns: 2 })
    const outcomes = await Promise.allSettled([consume(adapter, input({ runId: 'a', toolNames: ['bash'] })), consume(adapter, input({ runId: 'b', toolNames: ['bash'] }))])
    expect(outcomes.every((outcome) => outcome.status === 'rejected' && outcome.reason instanceof CustomAgentTerminationError && outcome.reason.turns === 2)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('preserves normal request parameters and default SDK retries when no policy is supplied', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":{"message":"busy","type":"rate_limit_error"}}', {
      status: 429, headers: { 'content-type': 'application/json', 'retry-after-ms': '1' },
    }))
    await consume(new CustomAgentAdapter())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ model: 'gpt-6-luna', stream: true, stream_options: { include_usage: true } })
    expect(body).not.toHaveProperty('reasoning_effort')
    expect(body).not.toHaveProperty('max_completion_tokens')
    expect(fetchMock.mock.calls[0][1]?.redirect).not.toBe('error')
  })

  it('applies completion settings and enforces eight actual requests across concurrent runs', async () => {
    const observations: CustomRequestObservation[] = []
    const adapter = new CustomAgentAdapter(createEvalRequestPolicy({}, (observation) => observations.push(observation)))
    const attempts = await Promise.allSettled(Array.from({ length: 9 }, (_, n) => consume(adapter, input({ runId: `run-${n}` }))))
    expect(fetchMock).toHaveBeenCalledTimes(8)
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(8)
    const rejected = attempts.find((attempt) => attempt.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(EvalBudgetExceededError)
    expect(observations.map((observation) => observation.sequence).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ reasoning_effort: 'none', max_completion_tokens: 2048 })
    expect(fetchMock.mock.calls.every(([, options]) => options?.redirect === 'error')).toBe(true)
  })

  it('rejects an oversized serialized body before transport and preserves the budget error', async () => {
    const observations = vi.fn()
    await expect(consume(new CustomAgentAdapter(createEvalRequestPolicy({}, observations)), input({ prompt: '中'.repeat(24000) })))
      .rejects.toMatchObject({ code: 'budget_exhausted' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(observations).not.toHaveBeenCalled()
  })

  it('disables SDK retries for failed evaluation HTTP requests and records unknown usage', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"message":"busy","type":"rate_limit_error"}}', {
      status: 429, headers: { 'content-type': 'application/json' },
    }))
    const observations: CustomRequestObservation[] = []
    await expect(consume(new CustomAgentAdapter(createEvalRequestPolicy({}, (value) => observations.push(value))))).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ status: 'failed', httpStatus: 429, usageComplete: false })
    expect(Object.values(observations[0].usage)).toEqual([null, null, null, null, null])
    expect(JSON.stringify(observations)).not.toContain('not-a-real-key')
  })

  it('retains planning usage before a consumer stops at plan_tasks, without overwriting later requests', async () => {
    fetchMock.mockResolvedValueOnce(response([
      chunk([{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-plan', type: 'function', function: { name: 'plan_tasks', arguments: '{}' } }] }, finish_reason: 'tool_calls' }]),
      chunk([], { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, prompt_tokens_details: { cached_tokens: 40 }, completion_tokens_details: { reasoning_tokens: 0 } }),
    ]))
    const observations: CustomRequestObservation[] = []
    const adapter = new CustomAgentAdapter({ ...createEvalRequestPolicy({}, (value) => observations.push(value)), maxTurns: 1 })
    for await (const event of adapter.stream(input({ toolNames: ['plan_tasks'] }), new AbortController().signal)) {
      if (event.type === 'tool.call') {
        expect(observations).toHaveLength(1)
        break
      }
    }
    expect(tools.execute).not.toHaveBeenCalled()
    await consume(adapter)
    expect(observations).toHaveLength(2)
    expect(observations[0]).toMatchObject({
      sequence: 1, status: 'completed', requestId: 'req-public-test', responseId: 'chatcmpl-test',
      responseModel: 'gpt-6-luna-test', systemFingerprint: 'fp-test', usageComplete: true,
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 40, cacheCreationTokens: null, reasoningTokens: 0 },
    })
    expect(observations[1]).toMatchObject({ sequence: 2, usageComplete: false })
  })

  it('records interrupted partial streams as usage-unknown when the consumer returns early', async () => {
    fetchMock.mockResolvedValueOnce(response([
      chunk([{ index: 0, delta: { content: 'Partial' }, finish_reason: null }]),
      chunk([], { prompt_tokens: 9, completion_tokens: 1 }),
    ]))
    const observations: CustomRequestObservation[] = []
    const adapter = new CustomAgentAdapter(createEvalRequestPolicy({}, (value) => observations.push(value)))
    for await (const event of adapter.stream(input(), new AbortController().signal)) {
      if (event.type === 'part.delta') break
    }
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ status: 'interrupted', usageComplete: false, usage: { inputTokens: null, outputTokens: null } })
  })

  it('passes AbortSignal to transport and records an aborted request without retrying', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(async (_url, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      controller.abort()
      expect(init?.signal?.aborted).toBe(true)
      throw new DOMException('Aborted', 'AbortError')
    })
    const observations: CustomRequestObservation[] = []
    await expect(consume(new CustomAgentAdapter(createEvalRequestPolicy({}, (value) => observations.push(value))), input(), controller.signal)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ status: 'aborted', usageComplete: false })
  })
})

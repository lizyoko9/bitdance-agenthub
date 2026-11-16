import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEvalRequestPolicy, createEvalToolPolicy, EvalBudgetExceededError } from '../../../eval/terminalbench/request-policy'
import type { StreamEvent } from '@/shared/types'

import { CustomAgentAdapter } from './custom-agent-adapter'
import { DEFAULT_CUSTOM_MAX_TURNS, CustomAgentTerminationError, MAX_CUSTOM_REQUEST_TIMEOUT_MS } from './custom-agent-limits'
import type { CustomRequestObservation } from './custom-request-policy'
import type { AdapterInput } from './types'

const tools = vi.hoisted(() => ({ execute: vi.fn() }))
const sdk = vi.hoisted(() => ({ clients: [] as { provided: boolean; timeout?: number; effectiveTimeout: number }[] }))
vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>()
  return {
    ...actual,
    default: class extends actual.default {
      constructor(options: ConstructorParameters<typeof actual.default>[0]) {
        super(options)
        sdk.clients.push({ provided: Object.hasOwn(options ?? {}, 'timeout'), timeout: options?.timeout, effectiveTimeout: this.timeout })
      }
    },
  }
})
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
    sdk.clients.length = 0
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

  it('rejects the seventh tool before publishing or executing it and retains usage', async () => {
    fetchMock.mockImplementation(async () => toolResponse())
    const events: StreamEvent[] = []
    const adapter = new CustomAgentAdapter({ ...createEvalRequestPolicy(), toolPolicy: createEvalToolPolicy(6) })
    const run = async () => {
      for await (const event of adapter.stream(input({ toolNames: ['bash'] }), new AbortController().signal)) events.push(event)
    }
    await expect(run()).rejects.toMatchObject({ code: 'budget_exhausted', message: 'budget_exhausted: maximum tool calls reached' })
    expect(tools.execute).toHaveBeenCalledTimes(6)
    expect(events.filter((event) => event.type === 'tool.call')).toHaveLength(6)
    expect(fetchMock).toHaveBeenCalledTimes(7)
    expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: { inputTokens: 70, outputTokens: 14 } })
    expect(events.at(-2)?.type).toBe('message.end')
  })

  it('shares the opt-in tool allowance across runs on the same adapter', async () => {
    fetchMock.mockImplementation(async () => toolResponse())
    const adapter = new CustomAgentAdapter({ maxTurns: 1, toolPolicy: createEvalToolPolicy(6) })
    const outcomes = await Promise.allSettled(Array.from({ length: 7 }, (_, n) =>
      consume(adapter, input({ runId: `shared-${n}`, toolNames: ['bash'] }))))
    expect(tools.execute).toHaveBeenCalledTimes(6)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected' && outcome.reason.code === 'iteration_limit')).toHaveLength(6)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected' && outcome.reason.code === 'budget_exhausted')).toHaveLength(1)
  })

  it('retains native nonzero exit values and false error flags with the tool policy enabled', async () => {
    fetchMock.mockResolvedValueOnce(toolResponse())
    tools.execute.mockResolvedValueOnce({ ok: true, value: { exitCode: 23, output: 'STATUS: OK\nRESULT: complete\n' } })
    const events = await consume(new CustomAgentAdapter({ toolPolicy: createEvalToolPolicy(6) }), input({ toolNames: ['bash'] }))
    expect(events.find((event) => event.type === 'tool.result')).toMatchObject({
      result: { exitCode: 23, output: 'STATUS: OK\nRESULT: complete\n' }, isError: false,
    })
  })

  it.each([true, false, undefined])('translates obtained-result error metadata %s without discarding value or stopping the tool loop', async (isError) => {
    const value = { exitCode: 23, output: 'STATUS: OK\nRESULT: complete\n', status: 'failed', isError: true,
      failure: { kind: 'nonzero_exit', message: 'Command exited with nonzero exit code 23.' } }
    tools.execute.mockResolvedValueOnce({ ok: true, value, ...(isError === undefined ? {} : { isError }) })
    fetchMock.mockResolvedValueOnce(toolResponse())

    const events = await consume(new CustomAgentAdapter(), input({ toolNames: ['bash'] }))

    expect(events.find((event) => event.type === 'tool.result')).toMatchObject({ result: value, isError: isError === true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const request = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(request.messages.find((message: { role: string }) => message.role === 'tool')).toMatchObject({
      tool_call_id: 'call-tool', content: JSON.stringify(value),
    })
  })

  it('keeps transport failures classified as errors', async () => {
    tools.execute.mockResolvedValueOnce({ ok: false, error: 'Fixture unavailable' })
    fetchMock.mockResolvedValueOnce(toolResponse())

    const events = await consume(new CustomAgentAdapter(), input({ toolNames: ['bash'] }))

    expect(events.find((event) => event.type === 'tool.result')).toMatchObject({
      result: { error: 'Fixture unavailable' }, isError: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
    expect(sdk.clients).toEqual([{ provided: false, timeout: undefined, effectiveTimeout: 600_000 }])
  })

  it('passes an explicit request timeout to the SDK while retaining the caller abort signal', async () => {
    const controller = new AbortController()
    await consume(new CustomAgentAdapter({ requestTimeoutMs: 1_200_000 }), input(), controller.signal)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(sdk.clients).toEqual([{ provided: true, timeout: 1_200_000, effectiveTimeout: 1_200_000 }])
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_CUSTOM_REQUEST_TIMEOUT_MS+1])(
    'rejects invalid programmatic requestTimeoutMs %s before requests', (requestTimeoutMs) => {
      expect(() => new CustomAgentAdapter({ requestTimeoutMs })).toThrow(/requestTimeoutMs/)
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('accepts the timer-domain boundaries without changing the default for omitted options', () => {
    expect(() => new CustomAgentAdapter({ requestTimeoutMs: 1 })).not.toThrow()
    expect(() => new CustomAgentAdapter({ requestTimeoutMs: MAX_CUSTOM_REQUEST_TIMEOUT_MS })).not.toThrow()
    expect(() => new CustomAgentAdapter()).not.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
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

  it('forwards an explicitly larger output budget and allows serialized requests above the original 64KiB limit', async () => {
    const adapter = new CustomAgentAdapter(createEvalRequestPolicy({ maxCompletionTokens: 8192, maxRequestBytes: 256 * 1024, maxTotalRequestBytes: 4 * 1024 * 1024 }))
    await consume(adapter, input({ prompt: 'a'.repeat(80_000) }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = fetchMock.mock.calls[0][1]!.body as string
    expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(64 * 1024)
    expect(JSON.parse(body)).toMatchObject({ max_completion_tokens: 8192, reasoning_effort: 'none' })
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

  it.each([false, true])('counts split/repeated usage once per response with observer=%s', async (observed) => {
    const observations: CustomRequestObservation[] = []
    fetchMock.mockResolvedValueOnce(response([
      chunk([{ index: 0, delta: { tool_calls: [{ index: 0, id: 'cache-tool', type: 'function',
        function: { name: 'bash', arguments: '{"command":"pwd"}' } }] }, finish_reason: 'tool_calls' }]),
      chunk([], { prompt_tokens: 100, input_tokens_details: { cache_creation_tokens: 30 } }),
      chunk([], { completion_tokens: 20, prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 30 },
        completion_tokens_details: { reasoning_tokens: 0 } }),
      chunk([], { prompt_tokens: 100, completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 30 } }),
      chunk([], { prompt_tokens: null, cache_write_input_tokens: -1 }),
    ])).mockResolvedValueOnce(response([
      chunk([{ index: 0, delta: { content: 'Done' }, finish_reason: 'stop' }]),
      chunk([], { prompt_tokens: 60, completion_tokens: 10, prompt_cache_hit_tokens: 9,
        cache_write_input_tokens: 5, completion_tokens_details: { reasoning_tokens: 0 } }),
      chunk([], { prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } }),
      chunk([], { prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } }),
    ]))
    const adapter = new CustomAgentAdapter(observed
      ? createEvalRequestPolicy({}, (value) => observations.push(value)) : {})
    const events = await consume(adapter, input({ toolNames: ['bash'] }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(tools.execute).toHaveBeenCalledOnce()
    expect(events.filter((event) => event.type === 'message.usage').map((event) => event.usage)).toEqual([
      { inputTokens: 100, outputTokens: 20, cacheReadTokens: 40, inputTokensIncludeCache: true },
      { inputTokens: 60, outputTokens: 10, cacheReadTokens: 0, inputTokensIncludeCache: true },
    ])
    expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: {
      inputTokens: 160, outputTokens: 30, cacheReadTokens: 40, cacheCreationTokens: 30,
      lastInputTokens: 60, inputTokensIncludeCache: true,
    } })
    if (observed) {
      expect(observations).toHaveLength(2)
      expect(observations.map((observation) => observation.usage)).toEqual([
        { inputTokens: 100, outputTokens: 20, cacheReadTokens: 40, cacheCreationTokens: 30, reasoningTokens: 0 },
        { inputTokens: 60, outputTokens: 10, cacheReadTokens: 0, cacheCreationTokens: 0, reasoningTokens: 0 },
      ])
      expect(observations.every((observation) => observation.usageComplete)).toBe(true)
    } else expect(observations).toHaveLength(0)
  })

  it('retains a previous known prompt length when the later response has no input observation', async () => {
    const observations: CustomRequestObservation[] = []
    fetchMock.mockResolvedValueOnce(response([
      chunk([{ index: 0, delta: { tool_calls: [{ index: 0, id: 'unknown-input-tool', type: 'function',
        function: { name: 'bash', arguments: '{}' } }] }, finish_reason: 'tool_calls' }]),
      chunk([], { prompt_tokens: 11, completion_tokens: 3 }),
    ])).mockResolvedValueOnce(response([
      chunk([{ index: 0, delta: { content: 'Done' }, finish_reason: 'stop' }]),
      chunk([], { completion_tokens: 4, cache_write_input_tokens: 20 }),
    ]))
    const events = await consume(new CustomAgentAdapter(createEvalRequestPolicy({}, (value) => observations.push(value))),
      input({ toolNames: ['bash'] }))
    expect(observations[1]).toMatchObject({ usageComplete: false, usage: {
      inputTokens: null, outputTokens: 4, cacheReadTokens: null, cacheCreationTokens: 20,
    } })
    expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: {
      inputTokens: 11, outputTokens: 7, cacheReadTokens: 0, cacheCreationTokens: 20,
      lastInputTokens: 11, inputTokensIncludeCache: true,
    } })
  })

  it('keeps request unknowns null while preserving numeric production compatibility when usage is absent', async () => {
    const observations: CustomRequestObservation[] = []
    const events = await consume(new CustomAgentAdapter(createEvalRequestPolicy({}, (value) => observations.push(value))))
    expect(observations[0]).toMatchObject({ usageComplete: false,
      usage: { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null, reasoningTokens: null } })
    expect(events.filter((event) => event.type === 'message.usage')).toHaveLength(0)
    expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
      lastInputTokens: 0, inputTokensIncludeCache: true,
    } })
  })

  it('preserves available cache counters before reporting an output-limit failure', async () => {
    fetchMock.mockResolvedValue(response([
      chunk([{ index: 0, delta: { content: 'Truncated' }, finish_reason: 'length' }]),
      chunk([], { prompt_tokens: 40, completion_tokens: 7,
        prompt_tokens_details: { cached_tokens: 10, cache_creation_tokens: 5 } }),
    ]))
    const events: StreamEvent[] = []
    const run = async () => {
      for await (const event of new CustomAgentAdapter().stream(input(), new AbortController().signal)) events.push(event)
    }
    await expect(run()).rejects.toMatchObject({ code: 'output_limit' })
    expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: {
      inputTokens: 40, outputTokens: 7, cacheReadTokens: 10, cacheCreationTokens: 5, inputTokensIncludeCache: true,
    } })
  })

  it('retains an already observed cache snapshot if a consumer aborts a partial stream', async () => {
    const controller = new AbortController()
    const observations: CustomRequestObservation[] = []
    fetchMock.mockResolvedValue(response([
      chunk([], { prompt_tokens: 100, completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 30 } }),
      chunk([{ index: 0, delta: { content: 'Partial' }, finish_reason: null }]),
      chunk([{ index: 0, delta: { content: 'Not consumed' }, finish_reason: 'stop' }]),
    ]))
    const adapter = new CustomAgentAdapter(createEvalRequestPolicy({}, (value) => observations.push(value)))
    for await (const event of adapter.stream(input(), controller.signal)) {
      if (event.type === 'part.delta') {
        controller.abort()
        break
      }
    }
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ status: 'aborted', usageComplete: true,
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 40, cacheCreationTokens: 30 } })
  })
})

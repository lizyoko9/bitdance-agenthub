import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StreamEvent } from '@/shared/types'

let client: typeof import('@/db/client')
let generateDraft: typeof import('./agent-runner').generateDeliveryValidationDraft
let agentService: typeof import('./agent-service')
let conversationService: typeof import('./conversation-service')
let eventBus: typeof import('./event-bus').eventBus
let toolRegistry: typeof import('./tools/registry').toolRegistry
let directory: string

const fetchFixture = vi.fn<typeof fetch>()
const model = 'offline-delivery-model'
const quote = 'Each result value must be a string or null.'
const requirements = [{ id: 'shape', quote }]
const inputs = [{ alias: 'result', format: 'json' }]
const grammar = 'offline-rule-grammar'

beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'agenthub-delivery-generator-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', directory)
  ;[client, { generateDeliveryValidationDraft: generateDraft }, agentService, conversationService, { eventBus }, { toolRegistry }] =
    await Promise.all([
      import('@/db/client'),
      import('./agent-runner'),
      import('./agent-service'),
      import('./conversation-service'),
      import('./event-bus'),
      import('./tools/registry'),
    ])
})

beforeEach(() => {
  fetchFixture.mockReset().mockImplementation(async () => {
    throw new Error('Unexpected fake transport request')
  })
  vi.stubGlobal('fetch', fetchFixture)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

afterAll(() => {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
  vi.unstubAllEnvs()
  if (directory) rmSync(directory, { recursive: true, force: true })
})

function chunks(
  delta: Record<string, unknown>,
  finishReason: 'stop' | 'tool_calls' | 'function_call' | 'length' | null = 'stop',
) {
  const chunk = { id: 'offline-delivery-response', object: 'chat.completion.chunk',
    created: 1, model, choices: [{ index: 0, delta, finish_reason: finishReason }] }
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

async function arrange() {
  const now = Date.now()
  const skillId = `generator-skill-${crypto.randomUUID()}`
  await client.db.insert(client.schema.skills).values({
    id: skillId, name: 'Inherited Skill marker', description: 'private-legacy-skill-catalog',
    instruction: 'private-legacy-skill-instruction', category: 'test', isGlobalDefault: true,
    createdAt: now,
  })
  const agent = await agentService.createCustomAgent({
    name: 'Offline draft generator', avatar: '🤖', description: 'Fixture',
    capabilities: [], systemPrompt: 'private-author-system-prompt',
    modelProvider: 'openai', modelId: model, toolNames: ['fs_write'],
    skillIds: [skillId], supportsVision: true, apiKey: 'offline-placeholder',
  })
  const conversation = await conversationService.createConversation({ mode: 'single', agentIds: [agent.id] })
  const triggerMessageId = `generator-user-${crypto.randomUUID()}`
  await client.db.insert(client.schema.messages).values([
    {
      id: `prior-user-${crypto.randomUUID()}`, conversationId: conversation.id, role: 'user',
      parts: [{ type: 'text', content: 'private-chat-history' }], status: 'complete', createdAt: now - 1,
    },
    {
      id: triggerMessageId, conversationId: conversation.id, role: 'user',
      parts: [
        { type: 'text', content: quote + ' private-unselected-source-text' },
        { type: 'image_attachment', attachmentId: 'secret-attachment-reference', fileName: 'attachment.png', mimeType: 'image/png', size: 16 },
      ],
      status: 'complete', createdAt: now,
    },
  ])
  return { agentId: agent.id, conversationId: conversation.id, triggerMessageId, requirements, inputs, grammar }
}

function recordEvents(conversationId: string) {
  const events: StreamEvent[] = []
  const unsubscribe = eventBus.subscribe(({ event }) => {
    if (event.conversationId === conversationId) events.push(event)
  })
  return { events, unsubscribe }
}

describe('Delivery validation generation through the real AgentRunner and Custom adapter', () => {
  it('tracks the run and sends only selected excerpts, aliases and grammar in one request', async () => {
    const args = await arrange()
    const candidate = { rules: [{ kind: 'shape', requirementIds: ['shape'] }] }
    fetchFixture.mockResolvedValueOnce(chunks({
      content: JSON.stringify(candidate), reasoning_content: 'private-generator-reasoning',
    }))
    const { events, unsubscribe } = recordEvents(args.conversationId)
    try {
      const generated = await generateDraft({ ...args, signal: new AbortController().signal })
      expect(generated).toEqual({ generatorRunId: expect.any(String), modelId: model, candidate: JSON.stringify(candidate) })
      expect(fetchFixture).toHaveBeenCalledTimes(1)
      const init = fetchFixture.mock.calls[0]?.[1]
      expect(init?.redirect).toBe('error')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ model, max_completion_tokens: 4096 })
      expect(body.tools).toBeUndefined()
      expect(body.messages).toEqual([
        { role: 'system', content: expect.stringContaining('Propose a draft of delivery validation rules') },
        { role: 'user', content: JSON.stringify({ requirements, inputs, grammar }) },
      ])
      expect(String(init?.body)).not.toMatch(/private-|workspace_info|attachment\.png/)
      expect(events.map((event) => event.type)).toEqual(['run.start', 'run.usage', 'run.end'])
      const run = await client.db.query.agentRuns.findFirst({
        where: eq(client.schema.agentRuns.id, generated.generatorRunId),
      })
      expect(run).toMatchObject({
        conversationId: args.conversationId, agentId: args.agentId,
        triggerMessageId: args.triggerMessageId, status: 'complete', usage: { model },
      })
      const messages = await client.db.query.messages.findMany({
        where: eq(client.schema.messages.conversationId, args.conversationId),
      })
      expect(messages.map((message) => message.role)).toEqual(['user', 'user'])
    } finally {
      unsubscribe()
    }
  })

  it.each(['tool_calls', 'function_call', 'tool_finish_only'] as const)(
    'blocks unsolicited %s before tool publication and execution',
    async (shape) => {
      const args = await arrange()
      const tool = { name: 'fs_write', arguments: JSON.stringify({ path: 'unused.txt', content: 'unused' }) }
      if (shape === 'tool_calls') {
        fetchFixture.mockResolvedValueOnce(chunks({
          tool_calls: [{ index: 0, id: 'unsolicited', type: 'function', function: tool }],
        }, 'stop'))
      } else if (shape === 'function_call') {
        fetchFixture.mockResolvedValueOnce(chunks({ function_call: tool }, 'function_call'))
      } else {
        fetchFixture.mockResolvedValueOnce(chunks({}, 'tool_calls'))
      }
      const execute = vi.spyOn(toolRegistry, 'execute')
      const { events, unsubscribe } = recordEvents(args.conversationId)
      try {
        await expect(generateDraft({ ...args, signal: new AbortController().signal }))
          .rejects.toThrow('attempted a tool call')
        expect(fetchFixture).toHaveBeenCalledTimes(1)
        expect(execute).not.toHaveBeenCalled()
        expect(events).toEqual([
          expect.objectContaining({ type: 'run.start' }),
          expect.objectContaining({ type: 'run.end', status: 'failed' }),
        ])
      } finally {
        unsubscribe()
      }
    },
  )

  it.each([
    ['malformed JSON', '{wrong}', 'stop', 'single valid JSON'],
    ['trailing JSON', '{} {}', 'stop', 'single valid JSON'],
    ['valid array', '[]', 'stop', 'single valid JSON'],
    ['provider truncation', '{}', 'length', 'output_limit'],
    ['oversized response', '中'.repeat(22_000), 'stop', 'byte limit'],
  ] as const)('rejects %s without retry or publishing the candidate', async (_name, content, finish, error) => {
    const args = await arrange()
    fetchFixture.mockResolvedValueOnce(chunks({ content }, finish))
    const { events, unsubscribe } = recordEvents(args.conversationId)
    try {
      await expect(generateDraft({ ...args, signal: new AbortController().signal })).rejects.toThrow(error)
      expect(fetchFixture).toHaveBeenCalledTimes(1)
      expect(events.at(-1)).toMatchObject({ type: 'run.end', status: 'failed' })
      expect(events.every((event) => event.type.startsWith('run.'))).toBe(true)
    } finally {
      unsubscribe()
    }
  })

  it('does not retry an actual SDK fetch attempt on HTTP 429', async () => {
    const args = await arrange()
    fetchFixture.mockResolvedValueOnce(new Response('provider private diagnostic', { status: 429 }))
    await expect(generateDraft({ ...args, signal: new AbortController().signal }))
      .rejects.toThrow('could not complete delivery rule generation')
    expect(fetchFixture).toHaveBeenCalledTimes(1)
  })

  it.each(['user cancellation', '45-second deadline'] as const)('settles %s without a candidate', async (reason) => {
    const args = await arrange()
    const controller = new AbortController()
    const deadline = new AbortController()
    const deadlineSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    let called: () => void = () => {}
    const calledPromise = new Promise<void>((resolve) => { called = resolve })
    fetchFixture.mockImplementationOnce((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Fixture aborted', 'AbortError'))
      }, { once: true })
      called()
    }))
    const { events, unsubscribe } = recordEvents(args.conversationId)
    try {
      const request = generateDraft({ ...args, signal: controller.signal })
      const failure = expect(request).rejects.toThrow(reason === 'user cancellation' ? 'cancelled' : '45 seconds')
      await calledPromise
      if (reason === 'user cancellation') controller.abort()
      else deadline.abort()
      await failure
      expect(deadlineSpy).toHaveBeenCalledWith(45_000)
      expect(fetchFixture).toHaveBeenCalledTimes(1)
      expect(events.at(-1)).toMatchObject({ type: 'run.end', status: 'aborted' })
    } finally {
      unsubscribe()
    }
  })

  it('checks the UTF-8 source excerpt limit before contacting a provider', async () => {
    const args = await arrange()
    await expect(generateDraft({
      ...args,
      requirements: [{ id: 'large', quote: '中'.repeat(5462) }],
      signal: new AbortController().signal,
    })).rejects.toThrow('16 KiB')
    expect(fetchFixture).not.toHaveBeenCalled()
  })
})

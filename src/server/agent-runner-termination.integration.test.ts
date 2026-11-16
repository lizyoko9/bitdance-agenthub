import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StreamEvent } from '@/shared/types'

import type { AgentPlatformAdapter } from './adapters/types'

const registry = vi.hoisted(() => ({ adapter: undefined as AgentPlatformAdapter | undefined }))
vi.mock('./adapters/registry', () => ({
  agentRegistry: {
    getAdapter: () => {
      if (!registry.adapter) throw new Error('Termination test adapter has not been configured')
      return registry.adapter
    },
  },
}))

let client: typeof import('@/db/client')
let conversations: typeof import('./conversation-service')
let agents: typeof import('./agent-service')
let eventBus: typeof import('./event-bus').eventBus
let CustomAgentAdapter: typeof import('./adapters/custom-agent-adapter').CustomAgentAdapter
let dataDir: string
const fetchMock = vi.fn<typeof fetch>()

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agenthub-run-termination-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', dataDir)
  ;[client, conversations, agents, { eventBus }, { CustomAgentAdapter }] = await Promise.all([
    import('@/db/client'),
    import('./conversation-service'),
    import('./agent-service'),
    import('./event-bus'),
    import('./adapters/custom-agent-adapter'),
  ])
})

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

afterAll(() => {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
  vi.unstubAllEnvs()
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
})

function modelResponse(toolCall: boolean, usage: Record<string, unknown> = {
  prompt_tokens: 12, completion_tokens: 3, total_tokens: 15,
}): Response {
  const payload = { id: 'fixture-completion', object: 'chat.completion.chunk', created: 1, model: 'fixture-model' }
  const choice = toolCall
    ? { delta: { tool_calls: [{ index: 0, id: 'fixture-call', type: 'function', function: { name: 'fs_list', arguments: '{}' } }] }, finish_reason: 'tool_calls' }
    : { delta: { content: 'The task is finished.' }, finish_reason: 'stop' }
  const chunks = [
    { ...payload, choices: [{ index: 0, ...choice }] },
    { ...payload, choices: [], usage },
  ]
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', {
    headers: { 'content-type': 'text/event-stream' },
  })
}

async function runConversation(maxTurns: number) {
  registry.adapter = new CustomAgentAdapter({ maxTurns, maxRetries: 0 })
  const agent = await agents.createCustomAgent({
    name: 'Termination regression fixture', avatar: '🤖', description: 'Offline termination test',
    capabilities: [], systemPrompt: 'Use the workspace tools, then finish.',
    modelProvider: 'openai', modelId: 'fixture-model', toolNames: ['fs_list'], skillIds: [],
    apiKey: 'fixture-key-not-a-credential',
  })
  const conversation = await conversations.createConversation({ mode: 'single', agentIds: [agent.id] })
  const events: StreamEvent[] = []
  let finish: (event: Extract<StreamEvent, { type: 'run.end' }>) => void = () => {}
  const ended = new Promise<Extract<StreamEvent, { type: 'run.end' }>>((resolve) => { finish = resolve })
  const unsubscribe = eventBus.subscribe(({ event }) => {
    if (event.conversationId !== conversation.id) return
    events.push(event)
    if (event.type === 'run.end') finish(event)
  })
  try {
    const sent = await conversations.sendMessage({ conversationId: conversation.id, content: 'Inspect the workspace and finish.' })
    const end = await ended
    expect(sent.runIds).toEqual([end.runId])
    const run = await client.db.query.agentRuns.findFirst({ where: eq(client.schema.agentRuns.id, end.runId) })
    const messages = await client.db.query.messages.findMany({ where: eq(client.schema.messages.runId, end.runId) })
    return { end, events, run, messages }
  } finally {
    unsubscribe()
  }
}

describe('AgentRunner termination propagation through conversation services', () => {
  it('persists inclusive-input semantics and known cache counters through normal usage events', async () => {
    fetchMock.mockResolvedValueOnce(modelResponse(false, { prompt_tokens: 100, completion_tokens: 10,
      total_tokens: 110, prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 20 } }))
    const result = await runConversation(1)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result.end.status).toBe('complete')
    expect(result.run?.usage).toMatchObject({ inputTokens: 100, outputTokens: 10,
      cacheReadTokens: 60, cacheCreationTokens: 20, inputTokensIncludeCache: true })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].usage).toEqual({ inputTokens: 100, outputTokens: 10,
      cacheReadTokens: 60, inputTokensIncludeCache: true })
    expect(result.events.find((event) => event.type === 'run.usage')).toMatchObject({
      usage: result.run?.usage,
    })
    expect(result.events.find((event) => event.type === 'message.usage')).toMatchObject({
      usage: result.messages[0].usage,
    })
  })

  it('persists iteration exhaustion as failed, publishes the reason, and shows it in the conversation', async () => {
    fetchMock.mockImplementation(async () => modelResponse(true))
    const result = await runConversation(1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.end).toMatchObject({ status: 'failed', error: expect.stringMatching(/^iteration_limit:/) })
    expect(result.run).toMatchObject({ status: 'failed', error: result.end.error, usage: { inputTokens: 12, outputTokens: 3 } })
    expect(result.events.some((event) => event.type === 'tool.result' && !event.isError)).toBe(true)
    expect(result.messages.some((message) => message.parts.some((part) => part.type === 'text' && part.content.includes('[失败] iteration_limit:')))).toBe(true)
  })

  it('keeps an explicit model stop on the final allowed round complete after a successful tool round', async () => {
    fetchMock.mockResolvedValueOnce(modelResponse(true)).mockResolvedValueOnce(modelResponse(false))
    const result = await runConversation(2)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.end).toMatchObject({ status: 'complete' })
    expect(result.end.error).toBeUndefined()
    expect(result.run).toMatchObject({ status: 'complete', error: null, usage: { inputTokens: 24, outputTokens: 6 } })
    expect(result.messages.some((message) => message.parts.some((part) => part.type === 'text' && part.content === 'The task is finished.'))).toBe(true)
    expect(result.messages.every((message) => message.status === 'complete')).toBe(true)
  })
})

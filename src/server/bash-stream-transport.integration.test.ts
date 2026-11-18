import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StreamEvent } from '@/shared/types'
import { useAppStore } from '@/stores/app-store'

import type { AgentPlatformAdapter } from './adapters/types'

const adapters = vi.hoisted(() => ({ current: undefined as AgentPlatformAdapter | undefined }))
vi.mock('./adapters/registry', () => ({
  agentRegistry: { getAdapter: () => {
    if (!adapters.current) throw new Error('Bash stream test adapter is not configured')
    return adapters.current
  } },
}))

const diagnostic = 'FAILURE shard=02 kind=dropped_teardown_hooks verification_code=ABCDEF12'
const note = 'FAILURE shard=02 note=merged coverage report will contain empty segments for this shard'
const stdout = 'STATUS: completed 中文😀\n'
const stderr = `${diagnostic}\n${note}\n`
const command = `printf '%s\\n' 'STATUS: completed 中文😀'; printf '%s\\n' '${diagnostic}' '${note}' >&2`
const upstream = process.env.AGENTHUB_TRACETRIAL_TEST_SOURCE ?? '/private/tmp/agenthub-tracetrial-source'
const officialConsumer = path.join(upstream, 'Task/E2-shard-stderr-003/verifier/score.py')
let dataDir: string
let client: typeof import('@/db/client')
let conversations: typeof import('./conversation-service')
let agents: typeof import('./agent-service')
let eventBus: typeof import('./event-bus').eventBus
let CustomAgentAdapter: typeof import('./adapters/custom-agent-adapter').CustomAgentAdapter
let streamRoute: typeof import('@/app/api/stream/route')
const bodies: string[] = []
const receipts: Record<string, unknown> = {}
const fetchMock = vi.fn<typeof fetch>()

function response(tool: boolean): Response {
  const delta = tool
    ? { tool_calls: [{ index: 0, id: 'pipe-observation', type: 'function', function: {
        name: 'bash', arguments: JSON.stringify({ command }),
      } }] }
    : { content: 'Offline transport probe finished.' }
  const chunk = { id: 'offline-pipe-response', object: 'chat.completion.chunk', created: 1,
    model: 'offline-pipe-model', choices: [{ index: 0, delta, finish_reason: tool ? 'tool_calls' : 'stop' }] }
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agenthub-bash-stream-transport-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', dataDir)
  vi.stubEnv('SHELL', '/bin/sh')
  ;[client, conversations, agents, { eventBus }, { CustomAgentAdapter }, streamRoute] = await Promise.all([
    import('@/db/client'), import('./conversation-service'), import('./agent-service'),
    import('./event-bus'), import('./adapters/custom-agent-adapter'), import('@/app/api/stream/route'),
  ])
})

beforeEach(() => {
  bodies.length = 0
  fetchMock.mockReset().mockImplementation(async (_url, init) => {
    if (typeof init?.body !== 'string') throw new Error('Offline SDK transport requires a serialized body')
    bodies.push(init.body)
    if (bodies.length > 2) throw new Error('Offline probe exceeded its two fake responses')
    return response(bodies.length === 1)
  })
  vi.stubGlobal('fetch', fetchMock)
  useAppStore.setState({ messages: {}, messageIdsByConv: {}, runsByConv: {}, conversations: {}, agents: {} })
})

afterEach(() => vi.unstubAllGlobals())
afterAll(() => {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
  vi.unstubAllEnvs()
  const receiptPath = process.env.AGENTHUB_BASH_STREAM_PROBE_RECEIPT
  if (receiptPath) {
    mkdirSync(path.dirname(receiptPath), { recursive: true })
    writeFileSync(receiptPath, JSON.stringify({ scope: 'offline-native-Bash-consumer-regressions',
      modelRequests: 0, networkRequests: 0, receipts }, null, 2) + '\n', { flag: 'wx' })
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
})

async function observeNativeRun() {
  adapters.current = new CustomAgentAdapter({ maxTurns: 2, maxRetries: 0 })
  const agent = await agents.createCustomAgent({
    name: 'Offline Bash pipe probe', avatar: '🔬', description: 'No model or network requests',
    capabilities: [], systemPrompt: 'Run the supplied safe command and finish.',
    modelProvider: 'openai', modelId: 'offline-pipe-model', toolNames: ['bash'], skillIds: [],
    apiKey: 'offline-placeholder-not-a-credential', apiBaseUrl: 'https://offline.invalid/v1',
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
  const controller = new AbortController()
  const sse = await streamRoute.GET(new NextRequest('http://localhost/api/stream', { signal: controller.signal }))
  const wireText = sse.text()
  try {
    await conversations.sendMessage({ conversationId: conversation.id, content: 'Observe the two shell pipes once.' })
    const end = await ended
    controller.abort()
    const wire = await wireText
    expect(end.status).toBe('complete')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const toolEvent = events.find((event) => event.type === 'tool.result')
    if (!toolEvent || toolEvent.type !== 'tool.result') throw new Error('No real Bash tool result was published')
    const messages = await client.db.query.messages.findMany({ where: eq(client.schema.messages.runId, end.runId) })
    return { events, end, toolEvent, messages, wire }
  } finally {
    controller.abort()
    unsubscribe()
  }
}

describe.skipIf(process.platform === 'win32')('Native Bash streams through offline production consumers', () => {
  it('preserves real pipe observations in the next Custom request, SQLite, SSE and store', async () => {
    const { toolEvent, messages, wire } = await observeNativeRun()
    expect(toolEvent).toMatchObject({ isError: false, result: {
      stdout, stderr, stdoutTruncated: false, stderrTruncated: false,
      exitCode: 0, status: 'completed', truncated: false,
    } })
    const value = toolEvent.result as Record<string, unknown>
    expect(value.output).toContain(stdout)
    expect(value.output).toContain(stderr)
    const nextRequest = JSON.parse(bodies[1])
    const toolMessage = nextRequest.messages.find((message: { role: string }) => message.role === 'tool')
    expect(JSON.parse(toolMessage.content)).toEqual(value)
    expect(toolMessage.tool_call_id).toBe(toolEvent.callId)
    const persisted = messages.find((message) => message.id === toolEvent.messageId)
    expect(persisted?.parts.find((part) => part.type === 'tool_result')).toMatchObject({ result: value, isError: false })
    const wireEvents: StreamEvent[] = wire.split('\n').filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6))).filter((event) => event.conversationId === toolEvent.conversationId)
    expect(wireEvents.find((event) => event.type === 'tool.result')).toEqual(toolEvent)
    for (const event of wireEvents) useAppStore.getState().applyEvent(event)
    const stored = useAppStore.getState().messages[toolEvent.messageId]
    expect(stored.parts.find((part) => part.type === 'tool_result')).toMatchObject({ result: value, isError: false })

    const legacyValue = { ...value }
    for (const field of ['stdout', 'stderr', 'stdoutTruncated', 'stderrTruncated']) delete legacyValue[field]
    const legacyRequest = JSON.parse(bodies[1])
    legacyRequest.messages.find((message: { role: string }) => message.role === 'tool').content = JSON.stringify(legacyValue)
    const nativeBytes = Buffer.byteLength(bodies[1], 'utf8')
    const legacyBytes = Buffer.byteLength(JSON.stringify(legacyRequest), 'utf8')
    expect(nativeBytes - legacyBytes).toBe(Buffer.byteLength(JSON.stringify(toolMessage.content), 'utf8')
      - Buffer.byteLength(JSON.stringify(JSON.stringify(legacyValue)), 'utf8'))
    expect(nativeBytes).toBeGreaterThan(legacyBytes)
    receipts.transport = {
      scope: 'offline-real-Bash-request-delta', nativeBytes, legacyBytes,
      comparison: 'Same actual request with only the four new result fields removed; tool description unchanged',
      addedBytes: nativeBytes - legacyBytes, retainedRawUnits: stdout.length + stderr.length,
      modelRequests: 0, networkRequests: 0, fakeTransportResponses: bodies.length,
      verified: ['next-Custom-tool-JSON', 'SQLite-message-parts', 'SSE-route', 'store-reducer'],
      detailJson: JSON.parse(JSON.stringify(value, null, 2)),
      detailUiInteractiveTested: false,
    }
  })

  it.skipIf(!existsSync(officialConsumer))('projects a fresh result into the unchanged pinned E2 pure consumer without scoring', async () => {
    const { events, end } = await observeNativeRun()
    const source = path.join(dataDir, 'fresh-native-events.jsonl')
    const result = path.join(dataDir, 'fresh-native-result.json')
    writeFileSync(source, events.map((event) => JSON.stringify(event)).join('\n') + '\n')
    writeFileSync(result, JSON.stringify({ runStatus: end.status, terminationReason: 'completed',
      rootRunIds: [end.runId], runs: [{ runId: end.runId, status: end.status }], allRunsSettled: true,
      timedOut: false, budgetExhausted: false, modelId: 'offline-pipe-model' }))
    const report = JSON.parse(execFileSync(process.env.AGENTHUB_TRACETRIAL_TEST_PYTHON ?? 'python3', [
      '-B', 'eval/tracetrial/bash_stream_consumer_probe.py', '--source', upstream,
      '--events', source, '--result', result, '--output', path.join(dataDir, 'consumer-probe'),
    ], { encoding: 'utf8', timeout: 10_000 }))
    expect(report).toMatchObject({ scope: 'single-run-consumer-regression', modelRequests: 0,
      networkRequests: 0, benchmarkScored: false, nativeUnchanged: true,
      provenance: [true, 'typed-stderr'], aliasEqualsNativeOutput: true })
    expect(report.officialSourceRevision).toBe('98a381307184fa4212db3466b21b4c92a031940b')
    expect(report).not.toHaveProperty('score')
    receipts.canonicalConsumer = report
  })
})

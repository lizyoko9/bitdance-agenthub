import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, expect, it, vi } from 'vitest'

import { selectEventsAfterSnapshot } from '@/lib/stream-resync'
import type { MessagePart, StreamEvent } from '@/shared/types'

import type { AgentPlatformAdapter } from './adapters/types'

const fixture = vi.hoisted(() => ({
  stream: vi.fn<AgentPlatformAdapter['stream']>(),
  onDelta: vi.fn<(messageId: string) => void>(),
}))

vi.mock('./adapters/registry', () => ({
  agentRegistry: { getAdapter: () => ({ name: 'mock', stream: fixture.stream }) },
}))

vi.mock(import('./message-parts-flusher'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createMessagePartsFlusher(...args: Parameters<typeof actual.createMessagePartsFlusher>) {
      const flusher = actual.createMessagePartsFlusher(...args)
      return {
        ...flusher,
        markDirty(messageId: string) {
          flusher.markDirty(messageId)
          fixture.onDelta(messageId)
        },
      }
    },
  }
})

type Boundary = 'part.delta' | 'tool.result' | 'message.end'
type Snapshot = ReturnType<typeof import('./conversation-service').listMessagesSnapshot>

let directory: string
let client: typeof import('@/db/client')
let conversations: typeof import('./conversation-service')
let agents: typeof import('./agent-service')
let eventBus: typeof import('./event-bus').eventBus
let listMessageHistory: typeof import('./message-history').listMessageHistory
let agentRunner: typeof import('./agent-runner').AgentRunner
let observe: ((id: string, boundary: Boundary) => void) | undefined

beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'agenthub-snapshot-cursor-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', directory)
  ;[client, conversations, agents, { eventBus }, { listMessageHistory }, { AgentRunner: agentRunner }] = await Promise.all([
    import('@/db/client'), import('./conversation-service'), import('./agent-service'),
    import('./event-bus'), import('./message-history'), import('./agent-runner'),
  ])
  client.sqlite.function('observe_message_write', (messageId: string, rawParts: string, status: string) => {
    const parts = JSON.parse(rawParts) as MessagePart[]
    if (status === 'complete') observe?.(messageId, 'message.end')
    else if (parts.some(({ type }) => type === 'tool_result')) observe?.(messageId, 'tool.result')
  })
  client.sqlite.exec(`
    CREATE TEMP TRIGGER capture_snapshot_cursor AFTER UPDATE OF parts, status ON messages
    WHEN NEW.id GLOB 'snapshot-cursor-*'
    BEGIN
      SELECT observe_message_write(NEW.id, NEW.parts, NEW.status);
    END
  `)
})

afterAll(() => {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
  vi.unstubAllEnvs()
  if (directory) rmSync(directory, { recursive: true, force: true })
})

it.each(['complete', 'failed'] as const)('publishes the message snapshot cursor before recovery can reread a %s run', async (status) => {
  const agent = await agents.createCustomAgent({
    name: 'Snapshot fixture', avatar: '🤖', description: '', capabilities: [], systemPrompt: '',
    modelProvider: 'openai', modelId: 'fixture', toolNames: [],
  })
  const conversation = await conversations.createConversation({ mode: 'single', agentIds: [agent.id] })
  const conversationId = conversation.id
  const triggerMessageId = crypto.randomUUID()
  const messageId = `snapshot-cursor-${crypto.randomUUID()}`
  const callId = 'snapshot-cursor-call'
  const envelope = { conversationId, messageId, timestamp: Date.now() }
  client.db.insert(client.schema.messages).values({
    id: triggerMessageId, conversationId, role: 'user', status: 'complete',
    createdAt: envelope.timestamp, parts: [{ type: 'text', content: 'Run the fixture.' }],
  }).run()

  fixture.stream.mockImplementationOnce(async function* ({ runId }): AsyncIterable<StreamEvent> {
    yield { ...envelope, type: 'message.start', agentId: agent.id, runId }
    yield { ...envelope, type: 'part.start', partIndex: 0, part: { type: 'text', content: 'ABC' } }
    yield { ...envelope, type: 'part.delta', partIndex: 0, delta: { type: 'text.append', text: 'D' } }
    yield { ...envelope, type: 'tool.call', callId, toolName: 'fixture-tool', args: {} }
    if (status === 'failed') throw new Error('Synthetic fixture failure')
    yield { ...envelope, type: 'tool.result', callId, result: 'fixture result', isError: false }
    yield { ...envelope, type: 'message.end' }
  })

  const queued = new Map<Boundary, Promise<Snapshot[]>>()
  observe = (id, boundary) => {
    if (id !== messageId || queued.has(boundary)) return
    // Observe the next microtask after mutation, before any await-separated publish.
    queued.set(boundary, Promise.resolve().then(() => [
      conversations.listMessagesSnapshot(conversationId),
      listMessageHistory(conversationId, {})!,
    ]))
  }
  fixture.onDelta.mockImplementation((id) => observe?.(id, 'part.delta'))
  try {
    const result = await agentRunner.run({ agentId: agent.id, conversationId, triggerMessageId }).promise
    expect(result.status).toBe(status)

    const boundaries: Boundary[] = status === 'complete'
      ? ['part.delta', 'tool.result', 'message.end']
      : ['part.delta', 'tool.result']
    for (const boundary of boundaries) {
      const snapshots = await queued.get(boundary)
      expect(snapshots, boundary).toHaveLength(2)
      for (const [index, snapshot] of snapshots!.entries()) {
        const label = `${boundary} with ${index === 0 ? 'full' : 'paged'} snapshot`
        const row = snapshot.messages.find(({ id }) => id === messageId)
        expect(row?.parts[0], label).toEqual({ type: 'text', content: 'ABCD' })
        if (boundary === 'tool.result') {
          expect(row?.parts.filter((part) => part.type === 'tool_result' && part.callId === callId), label)
            .toEqual([expect.objectContaining({ isError: status === 'failed' })])
        }
        if (boundary === 'message.end') expect(row?.status, label).toBe('complete')

        const replay = eventBus.replaySince(snapshot.eventId)
        expect(replay.kind, label).toBe('replay')
        if (replay.kind !== 'replay') continue
        const events = selectEventsAfterSnapshot(replay.events, snapshot.eventId, conversationId)
        expect.soft(events.filter((event) => event.type === boundary), label).toEqual([])
        if (boundary === 'part.delta') expect(events.some((event) => event.type === 'tool.result'), label).toBe(true)
      }
    }
  } finally {
    observe = undefined
    fixture.onDelta.mockReset()
  }
})

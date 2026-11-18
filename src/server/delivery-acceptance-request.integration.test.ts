import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let dataDir: string
let client: typeof import('@/db/client')
let conversations: typeof import('./conversation-service')
let agents: typeof import('./agent-service')
let messagesRoute: typeof import('@/app/api/conversations/[id]/messages/route')
let regenerateRoute: typeof import('@/app/api/conversations/[id]/regenerate/route')
const fetchMock = vi.fn<typeof fetch>()

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agenthub-delivery-request-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', dataDir)
  ;[client, conversations, agents, messagesRoute, regenerateRoute] = await Promise.all([
    import('@/db/client'),
    import('./conversation-service'),
    import('./agent-service'),
    import('@/app/api/conversations/[id]/messages/route'),
    import('@/app/api/conversations/[id]/regenerate/route'),
  ])
})

beforeEach(() => {
  fetchMock.mockReset().mockRejectedValue(new Error('Invalid delivery should not call a model'))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

afterAll(() => {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
  vi.unstubAllEnvs()
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
})

async function createProducer() {
  return agents.createCustomAgent({
    name: 'Formal request fixture', avatar: '🤖', description: 'Offline delivery preflight fixture',
    capabilities: [], systemPrompt: 'Write the requested output.',
    modelProvider: 'openai', modelId: 'fixture-model', toolNames: [],
    apiKey: 'fixture-key-not-a-credential', apiBaseUrl: 'https://offline.invalid/v1',
  })
}

function request(conversationId: string, action: 'messages' | 'regenerate', body?: object) {
  return new NextRequest(`http://localhost/api/conversations/${conversationId}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('formal delivery request preflight', () => {
  it('rejects an unknown revision or bound deploy before inserting messages or runs', async () => {
    const producer = await createProducer()
    const { id } = await conversations.createConversation({ mode: 'single', agentIds: [producer.id] })

    for (const [content, expected] of [
      ['Please deliver the report.', '本会话中找不到该规则版本'],
      ['/deploy', '部署指令不能同时绑定交付验收规则'],
    ]) {
      const response = await messagesRoute.POST(request(id, 'messages', {
        content, deliveryValidationRevisionId: 'missing-revision',
      }), { params: Promise.resolve({ id }) })
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: expected })
    }

    const { db, schema } = client
    expect(db.select().from(schema.messages).where(eq(schema.messages.conversationId, id)).all()).toEqual([])
    expect(db.select().from(schema.agentRuns).where(eq(schema.agentRuns.conversationId, id)).all()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects cross-site and non-JSON formal delivery requests before execution', async () => {
    const producer = await createProducer()
    const { id } = await conversations.createConversation({ mode: 'single', agentIds: [producer.id] })
    for (const [headers, status] of [
      [{ origin: 'https://unrelated.invalid', 'content-type': 'application/json' }, 403],
      [{ 'content-type': 'text/plain' }, 415],
    ] as const) {
      const response = await messagesRoute.POST(new NextRequest('http://localhost', {
        method: 'POST', headers, body: JSON.stringify({ content: 'Deliver.', deliveryValidationRevisionId: 'example' }),
      }), { params: Promise.resolve({ id }) })
      expect(response.status).toBe(status)
    }
    expect(fetchMock).not.toHaveBeenCalled()
    expect(client.db.select().from(client.schema.messages).where(eq(client.schema.messages.conversationId, id)).all()).toEqual([])
  })

  it('retains the old response when the exact formal delivery revision was revoked', async () => {
    const producer = await createProducer()
    const { id } = await conversations.createConversation({ mode: 'single', agentIds: [producer.id] })
    const { db, schema } = client
    const revisionId = 'revoked-fixture'
    const messageId = 'formal-request-fixture'
    const runId = 'old-formal-run-fixture'
    const now = Date.now()
    db.insert(schema.deliveryValidationRevisions).values({
      id: revisionId, conversationId: id, planId: 'plan-fixture', revision: 1,
      title: 'Revoked fixture', workspaceDigest: 'fixture', requirementDigest: 'fixture',
      requirements: [], inputs: [], definition: { rules: [] }, definitionDigest: 'fixture',
      engineVersion: 1, generatorRunId: 'generator-fixture', modelId: 'fixture-model',
      createdAt: now - 100, activatedAt: now - 50, revokedAt: now,
    }).run()
    db.insert(schema.messages).values({
      id: messageId, conversationId: id, role: 'user', status: 'complete',
      parts: [{ type: 'text', content: 'Please deliver the report.' }],
      deliveryValidationRevisionId: revisionId, createdAt: now + 1,
    }).run()
    db.insert(schema.agentRuns).values({
      id: runId, conversationId: id, agentId: producer.id, triggerMessageId: messageId,
      status: 'complete', startedAt: now + 2, finishedAt: now + 3,
    }).run()
    db.insert(schema.messages).values({
      id: 'old-formal-answer-fixture', conversationId: id, agentId: producer.id,
      role: 'agent', status: 'complete', runId, createdAt: now + 3,
      parts: [{ type: 'text', content: 'Preserve this existing answer.' }],
    }).run()

    const response = await regenerateRoute.POST(request(id, 'regenerate'), { params: Promise.resolve({ id }) })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: '此规则版本已撤销' })
    expect(db.select().from(schema.agentRuns).where(eq(schema.agentRuns.conversationId, id)).all())
      .toMatchObject([{ id: runId, status: 'complete' }])
    expect(db.select().from(schema.messages).where(eq(schema.messages.conversationId, id)).all())
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'old-formal-answer-fixture' })]))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

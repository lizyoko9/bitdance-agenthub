import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeliveryCatalog, DeliveryPlanView, DeliveryReceiptView } from '@/shared/delivery-validation'

const captureHook = vi.hoisted(() => ({ after: undefined as (() => void) | undefined }))
vi.mock('./delivery-validation-snapshot', async (importOriginal) => {
  const original = await importOriginal<typeof import('./delivery-validation-snapshot')>()
  return {
    ...original,
    captureDeliverySnapshots: async (...args: Parameters<typeof original.captureDeliverySnapshots>) => {
      const snapshots = await original.captureDeliverySnapshots(...args)
      captureHook.after?.()
      return snapshots
    },
  }
})

const requirement = {
  file: 'Provide report.json.',
  shape: 'Each shard record must be a string or null.',
  notes: 'Notes must include the Summary heading.',
  tally: 'The row count must equal deleted plus kept.',
}
const candidate = {
  rules: [
    { id: 'report_file', requirementId: 'r1', title: 'Report exists', kind: 'presence', input: 'report' },
    { id: 'report_shape', requirementId: 'r2', title: 'Codes are scalar', kind: 'json_shape', input: 'report',
      shape: { types: ['object'], values: { types: ['string', 'null'] } } },
    { id: 'notes_heading', requirementId: 'r3', title: 'Summary heading', kind: 'markdown_heading',
      input: 'notes', heading: 'Summary' },
    { id: 'tally', requirementId: 'r4', title: 'Totals agree', kind: 'function', expression: {
      op: 'equals', left: { op: 'count', value: { op: 'input', alias: 'report' } },
      right: { op: 'add',
        left: { op: 'field', value: { op: 'input', alias: 'totals' }, key: 'deleted' },
        right: { op: 'field', value: { op: 'input', alias: 'totals' }, key: 'kept' },
      },
    } },
  ],
}
const fixtures = [
  { ruleId: 'tally', expected: 'pass', inputs: { report: '{"s1":"ABC","s2":null}', totals: '{"deleted":1,"kept":1}' } },
  { ruleId: 'tally', expected: 'fail', inputs: { report: '{"s1":"ABC"}', totals: '{"deleted":1,"kept":1}' } },
]

let dataDir: string
let client: typeof import('@/db/client')
let route: typeof import('@/app/api/conversations/[id]/delivery-validation/route')
const fetchMock = vi.fn<typeof fetch>()

function responseWithCandidate(content: string) {
  return new Response('data: ' + JSON.stringify({
    id: 'fixture-completion', object: 'chat.completion.chunk', created: 1, model: 'fixture-model',
    choices: [{ index: 0, delta: { content }, finish_reason: 'stop' }],
  }) + '\n\ndata: [DONE]\n\n', {
    headers: { 'content-type': 'text/event-stream' },
  })
}

async function openDatabase() {
  client = await import('@/db/client')
  route = await import('@/app/api/conversations/[id]/delivery-validation/route')
}

function closeDatabase() {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
}

beforeEach(async () => {
  vi.resetModules()
  dataDir = mkdtempSync(path.join(tmpdir(), 'agenthub-delivery-test-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', dataDir)
  await openDatabase()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => responseWithCandidate(JSON.stringify(candidate)))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  captureHook.after = undefined
  closeDatabase()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(dataDir, { force: true, recursive: true })
})

async function setup() {
  const { createCustomAgent } = await import('./agent-service')
  const conversations = await import('./conversation-service')
  const agent = await createCustomAgent({
    name: 'Offline validation generator', avatar: '🔬', description: 'Fake transport',
    capabilities: [],
    systemPrompt: 'Unrelated author prompt.',
    modelProvider: 'openai', modelId: 'fixture-model', toolNames: ['bash'], skillIds: [],
    apiKey: 'fixture-key-not-a-credential', apiBaseUrl: 'https://offline.invalid/v1',
  })
  const conversation = await conversations.createConversation({ mode: 'single', agentIds: [agent.id] })
  const workspace = client.db.select().from(client.schema.workspaces)
    .where(eq(client.schema.workspaces.conversationId, conversation.id)).get()!
  const messageId = 'original-user-requirements'
  client.db.insert(client.schema.messages).values({
    id: messageId, conversationId: conversation.id, role: 'user', status: 'complete',
    parts: [{ type: 'text', content: Object.values(requirement).join('\n') }], createdAt: Date.now(),
  }).run()
  return {
    conversationId: conversation.id, workspace, messageId,
    draft: {
      action: 'draft', title: 'Release report', agentId: agent.id,
      requirements: Object.values(requirement).map((quote) => ({ messageId, quote })),
      inputs: [
        { alias: 'report', path: 'report.json', format: 'json' },
        { alias: 'notes', path: 'notes.md', format: 'markdown' },
        { alias: 'totals', path: 'totals.json', format: 'json' },
      ],
    },
  }
}

async function post(id: string, body: unknown) {
  const response = await route.POST(new Request('http://localhost/api/conversations/' + id + '/delivery-validation', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) })
  return { status: response.status, body: await response.json() }
}

async function activate(id: string, draft: unknown) {
  const created = await post(id, draft)
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  const plan = created.body.plan as DeliveryPlanView
  const reviewed = { action: 'activate', revisionId: plan.id, reviewed: true, fixtures }
  const approved = await post(id, reviewed)
  expect(approved.status, JSON.stringify(approved.body)).toBe(200)
  return approved.body.plan as DeliveryPlanView
}

function writeFiles(directory: string, report: string) {
  writeFileSync(path.join(directory, 'report.json'), report)
  writeFileSync(path.join(directory, 'notes.md'), '## Summary\nReviewed output.\n')
  writeFileSync(path.join(directory, 'totals.json'), '{"deleted":1,"kept":1}')
}

describe('reusable delivery validation through the conversation API', () => {
  it('generates once, requires reviewed examples, and checks new snapshots after restart', async () => {
    const { conversationId, draft, workspace } = await setup()
    const created = await post(conversationId, draft)
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    const plan = created.body.plan as DeliveryPlanView
    expect(plan).toMatchObject({ status: 'draft', revision: 1, modelId: 'fixture-model' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const validate = { action: 'validate', revisionId: plan.id }
    expect((await post(conversationId, validate)).status).toBe(400)
    expect((await post(conversationId, {
      action: 'activate', revisionId: plan.id, fixtures: [], reviewed: true,
    })).status).toBe(400)
    expect((await post(conversationId, {
      action: 'activate', revisionId: plan.id, fixtures, reviewed: true,
    })).body.plan.status).toBe('active')

    writeFiles(workspace.rootPath, '{"s1":{"verification_code":"ABC"},"s2":null}')
    const failed = (await post(conversationId, validate)).body.receipt as DeliveryReceiptView
    expect(failed.status).toBe('fail')
    expect(failed.checks.find((check) => check.ruleId === 'report_shape')).toMatchObject({ status: 'fail' })

    closeDatabase()
    vi.resetModules()
    await openDatabase()
    writeFiles(workspace.rootPath, '{"s1":"ABC","s2":null}')
    const passed = (await post(conversationId, validate)).body.receipt as DeliveryReceiptView
    expect(passed.status).toBe('pass')
    expect(passed.inputs[0].sha256).not.toBe(failed.inputs[0].sha256)
    expect(fetchMock).toHaveBeenCalledOnce()

    const catalog = await route.GET(new Request('http://localhost'), { params: Promise.resolve({ id: conversationId }) })
    const output: DeliveryCatalog = await catalog.json()
    expect(output.plans[0].receipts.map((receipt) => receipt.id)).toEqual([passed.id, failed.id])
  })

  it('blocks forged source selection and invalidates a saved plan after its user requirement changes', async () => {
    const { conversationId, draft, messageId } = await setup()
    expect((await post(conversationId, {
      ...draft, requirements: [{ messageId, quote: 'Unwritten requirement' }],
    })).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    const active = await activate(conversationId, draft)
    client.db.update(client.schema.messages).set({ parts: [{ type: 'text', content: 'New requirements.' }] })
      .where(eq(client.schema.messages.id, messageId)).run()
    expect((await post(conversationId, { action: 'validate', revisionId: active.id })).status).toBe(400)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects cross-site or non-JSON mutations before starting a generator', async () => {
    const { conversationId, draft } = await setup()
    const context = { params: Promise.resolve({ id: conversationId }) }
    for (const [headers, status] of [
      [{ 'content-type': 'application/json', origin: 'https://unrelated.invalid' }, 403],
      [{ 'content-type': 'text/plain', origin: 'http://localhost' }, 415],
    ] as const) {
      const response = await route.POST(new Request('http://localhost', {
        method: 'POST', headers, body: JSON.stringify(draft),
      }), context)
      expect(response.status).toBe(status)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate draft properties without letting model JSON parsing collapse them', async () => {
    const { conversationId, draft } = await setup()
    fetchMock.mockResolvedValueOnce(responseWithCandidate('{"rules":[],"rules":' + JSON.stringify(candidate.rules) + '}'))
    const result = await post(conversationId, draft)
    expect(result.status).toBe(400)
    expect(result.body.error).toContain('unique keys')
    expect(client.db.select().from(client.schema.deliveryValidationRevisions).all()).toEqual([])
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('keeps receipts out when a rule is revoked between snapshot capture and commit', async () => {
    const { conversationId, draft, workspace } = await setup()
    const active = await activate(conversationId, draft)
    writeFiles(workspace.rootPath, '{"s1":"ABC","s2":null}')
    captureHook.after = () => {
      captureHook.after = undefined
      client.db.update(client.schema.deliveryValidationRevisions).set({ revokedAt: Date.now() })
        .where(eq(client.schema.deliveryValidationRevisions.id, active.id)).run()
    }
    expect((await post(conversationId, { action: 'validate', revisionId: active.id })).status).toBe(400)
    expect(client.db.select().from(client.schema.deliveryValidationReceipts).all()).toEqual([])
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('keeps revisions independently selectable, scopes them to the conversation, and clears derived history', async () => {
    const { conversationId, workspace, draft } = await setup()
    const original = await activate(conversationId, draft)
    const revision = (await post(conversationId, { ...draft, previousRevisionId: original.id })).body.plan
    expect(revision).toMatchObject({ planId: original.planId, revision: 2, status: 'draft' })
    const { createConversation, clearConversationHistory } = await import('./conversation-service')
    const another = await createConversation({ mode: 'single', agentIds: [draft.agentId] })
    expect((await post(another.id, { action: 'validate', revisionId: original.id })).status).toBe(400)

    writeFiles(workspace.rootPath, '{"s1":"ABC","s2":null}')
    const pass = await post(conversationId, { action: 'validate', revisionId: original.id })
    expect(pass.body.receipt).toMatchObject({ revisionId: original.id, status: 'pass' })
    expect((await post(conversationId, { action: 'validate', revisionId: revision.id })).status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await clearConversationHistory(conversationId)
    expect(client.db.select().from(client.schema.deliveryValidationRevisions).all()).toEqual([])
    expect(client.db.select().from(client.schema.deliveryValidationReceipts).all()).toEqual([])
  })
})

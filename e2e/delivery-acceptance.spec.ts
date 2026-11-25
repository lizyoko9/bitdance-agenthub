import { expect, test } from '@playwright/test'

import type { DeliveryCatalog, DeliveryPlanView } from '../src/shared/delivery-validation'
import type { MessageRecord, StreamEvent } from '../src/shared/types'

const title = '与 E2E Mock 的对话'
const draft = '请生成最终交付文件'
const receiptId = 'receipt-failed-shape'

test('对话发送时固定验收版本，系统结果在实时消息与刷新后都可见', async ({ page }) => {
  const active: DeliveryPlanView = {
    id: 'revision-v1',
    planId: 'report',
    revision: 1,
    title: '报告规则',
    status: 'active',
    inputs: [{ alias: 'report', path: 'output/failures.json', format: 'json' }],
    requirements: [],
    rules: [],
    suggestedFixtures: [],
    generatorRunId: 'mock-generator',
    modelId: 'mock',
    createdAt: 1_800_000_000_000,
    receipts: [],
  }
  const catalog: DeliveryCatalog = {
    sources: [],
    agents: [],
    plans: [
      { ...active, id: 'revision-v2', revision: 2 },
      { ...active, id: 'revision-v3-draft', revision: 3, status: 'draft' },
      active,
    ],
  }
  const posts: Record<string, unknown>[] = []
  let catalogReads = 0
  let hydratedVerdicts = 0
  let verdict: MessageRecord | null = null
  let emitVerdict!: (event: StreamEvent) => void
  const verdictEvent = new Promise<StreamEvent>((resolve) => { emitVerdict = resolve })
  let completedStream = false

  await page.route('**/api/conversations/*/delivery-validation', async (route) => {
    catalogReads++
    await route.fulfill({ json: catalog })
  })
  await page.route('**/api/stream**', async (route) => {
    if (completedStream) {
      await route.fulfill({ status: 204 })
      return
    }
    const event = await verdictEvent
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `id: 1\ndata: ${JSON.stringify(event)}\n\n`,
    })
    completedStream = true
  })
  await page.route('**/api/conversations/*/messages/history', async (route) => {
    if (verdict) hydratedVerdicts++
    await route.fulfill({ json: {
      messages: verdict ? [verdict] : [],
      eventId: '1',
      olderCursor: null,
      newerCursor: null,
      latestUserMessageId: null,
      latestAgentMessageId: null,
    } })
  })
  await page.route('**/api/conversations/*/messages', async (route) => {
    const req = route.request()
    if (req.method() === 'GET') {
      if (verdict) hydratedVerdicts++
      await route.fulfill({ json: { messages: verdict ? [verdict] : [], eventId: '1' } })
      return
    }
    if (req.method() !== 'POST') {
      await route.fallback()
      return
    }
    const body = req.postDataJSON() as Record<string, unknown>
    posts.push(body)
    if (posts.length === 1) {
      await route.fulfill({ status: 400, json: { error: '当前版本不可用，请重新选择' } })
      return
    }
    if (posts.length === 2) {
      const conversationId = new URL(req.url()).pathname.split('/')[3]
      verdict = {
        id: 'system-delivery-verdict',
        conversationId,
        role: 'system',
        agentId: null,
        parts: [{
          type: 'delivery_acceptance',
          acceptance: {
            revisionId: active.id,
            status: 'fail',
            receiptId,
            checks: [{
              requirementId: 'r-1',
              ruleId: 'value-types',
              status: 'fail',
              location: 'output/failures.json · $.shard_3',
              expected: 'string 或 null',
              observed: 'object',
            }],
          },
        }],
        status: 'complete',
        parentMessageId: null,
        mentionedAgentIds: [],
        runId: 'mock-bound-run',
        usage: null,
        createdAt: 1_800_000_000_100,
      }
      await route.fulfill({ status: 202, json: { messageId: 'bound-user-message', runIds: ['mock-bound-run'] } })
      emitVerdict({ type: 'message.added', conversationId, timestamp: verdict.createdAt, message: verdict })
      return
    }
    await route.fulfill({ status: 202, json: { messageId: 'unbound-user-message', runIds: [] } })
  })

  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/agents' && response.ok()),
    page.goto('/', { waitUntil: 'domcontentloaded' }),
  ])
  await page.getByRole('button', { name: '新建对话' }).click()
  const create = page.getByRole('dialog')
  await create.getByRole('button').filter({ hasText: 'E2E Mock' }).first().click()
  await create.getByRole('button', { name: '创建', exact: true }).click()
  await expect(create).toBeHidden()

  const picker = page.getByRole('button', { name: '完成时验收', exact: true })
  await expect(picker).toBeVisible()
  expect(catalogReads).toBe(0)
  await picker.click()
  await expect(page.getByRole('button', { name: '报告规则 · v2' })).toBeVisible()
  await expect(page.getByRole('button', { name: '报告规则 · v3' })).toHaveCount(0)
  await page.getByRole('button', { name: '报告规则 · v1' }).click()
  await expect(picker).toContainText('报告规则 · v1')

  const composer = page.getByTestId('composer-input')
  const send = page.getByTestId('composer-send')
  await composer.fill(draft)
  await send.click()
  await expect(page.getByRole('alert').filter({ hasText: '当前版本不可用' })).toBeVisible()
  await expect(composer).toHaveValue(draft)
  await expect(picker).toContainText('报告规则 · v1')
  await expect(page.locator('[data-role="user"]')).toHaveCount(0)

  await send.click()
  await expect(picker).not.toContainText('报告规则 · v1')
  const result = page.getByRole('region', { name: '交付未通过' })
  await expect(result).toContainText('output/failures.json · $.shard_3')
  await expect(result).toContainText('实际：object')
  await expect(result).toContainText(receiptId)
  expect(hydratedVerdicts).toBe(0)

  await composer.fill('继续讨论，不交付')
  await send.click()
  await expect.poll(() => posts.length).toBe(3)
  expect(posts.slice(0, 2).map((body) => body.deliveryValidationRevisionId)).toEqual([active.id, active.id])
  expect(posts[2]).not.toHaveProperty('deliveryValidationRevisionId')
  expect(catalogReads).toBe(1)

  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/conversations' && response.ok()),
    page.reload({ waitUntil: 'domcontentloaded' }),
  ])
  await page.locator('aside').getByText(title, { exact: true }).first().click()
  await expect(result).toContainText(receiptId)
  expect(hydratedVerdicts).toBeGreaterThan(0)
})

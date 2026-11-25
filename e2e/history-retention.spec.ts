import { expect, test, type Page } from '@playwright/test'

const conversationId = 'e2e-history'
const title = '长会话回放测试'
const agentId = 'e2e-history-agent'
const messageCount = 600
const pageSize = 50
const pinnedMessageId = 'history-12'

const messages = Array.from({ length: messageCount }, (_, index) => {
  const createdAt = index + 1
  return {
    id: `history-${createdAt}`, conversationId, role: index % 2 === 0 ? 'user' : 'agent',
    agentId: index % 2 === 0 ? null : agentId, status: 'complete', createdAt,
    parentMessageId: null, mentionedAgentIds: [], runId: null, usage: null,
    parts: [{ type: 'text', content: createdAt === 12
      ? '钉住的旧消息'
      : `历史消息 ${createdAt}\n\n${`第 ${createdAt} 条的历史文本。`.repeat(10 + (index % 7) * 7)}` }],
  }
})

async function useFixture(page: Page) {
  const pageRequests: string[] = []
  await page.route('**/api/agents', (route) => route.fulfill({ json: { agents: [{
    id: agentId, name: '历史测试 Agent', avatar: 'H', description: '', capabilities: [],
    systemPrompt: '', adapterName: 'mock', toolNames: [], skillIds: [], isBuiltin: false,
    isOrchestrator: false, createdAt: 1,
  }] } }))
  await page.route('**/api/conversations', (route) => route.fulfill({ json: { conversations: [{
    id: conversationId, title, mode: 'single', agentIds: [agentId], archived: false,
    pinnedMessageIds: [pinnedMessageId], bookmarkedMessageIds: [pinnedMessageId],
    pinnedAt: null, createdAt: 1, updatedAt: 2,
  }] } }))
  await page.route('**/api/stream**', (route) => route.fulfill({ status: 204 }))
  await page.route(`**/api/conversations/${conversationId}/messages`, (route) => route.fulfill({
    json: { messages, eventId: 'fixture-1000' },
  }))
  await page.route(new RegExp(`/api/conversations/${conversationId}/messages/history(?:\\?|$)`), (route) => {
    const query = new URL(route.request().url()).searchParams
    const around = query.get('around')
    const before = query.get('before')
    const after = query.get('after')
    pageRequests.push(around ? `around:${around}` : before ? 'older' : after ? 'newer' : 'latest')
    let start = messages.length - pageSize
    let end = messages.length
    if (around) {
      const index = messages.findIndex((message) => message.id === around)
      start = Math.max(0, index - Math.floor(pageSize / 2))
      end = Math.min(messages.length, start + pageSize)
    } else if (before) {
      end = Number(before) - 1
      start = Math.max(0, end - pageSize)
    } else if (after) {
      start = Number(after)
      end = Math.min(messages.length, start + pageSize)
    }
    return route.fulfill({ json: {
      messages: messages.slice(start, end), eventId: 'fixture-1000',
      olderCursor: start > 0 ? String(start + 1) : null,
      newerCursor: end < messages.length ? String(end) : null,
      latestUserMessageId: `history-${messageCount - 1}`, latestAgentMessageId: `history-${messageCount}`,
      references: [messages[11]],
    } })
  })
  await page.goto('/')
  await page.locator('aside').getByText(title, { exact: true }).click()
  await expect(page.locator(`#message-history-${messageCount}`)).toBeVisible()
  return pageRequests
}

async function measure(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.collectGarbage')
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  await cdp.detach()
  return { mountedMessages: await page.locator('[id^="message-history-"]').count(), heapUsedBytes: usedSize }
}

test('keeps loaded history virtual, preserves the older-page anchor and jumps to an unloaded pin', async ({ page }, testInfo) => {
  const requests = await useFixture(page)
  const initial = await measure(page)
  await testInfo.attach('history-initial-browser-sample', { body: JSON.stringify(initial), contentType: 'application/json' })
  if (process.env.AGENTHUB_HISTORY_BASELINE === '1') {
    expect(initial.mountedMessages).toBe(messageCount)
    return
  }

  expect(requests.length).toBeGreaterThanOrEqual(1)
  expect(requests.every((request) => request === 'latest')).toBe(true)
  expect(initial.mountedMessages).toBeLessThan(pageSize)
  const history = page.getByTestId('message-history-viewport')
  const viewport = history.locator('xpath=ancestor::*[@data-slot="scroll-area-viewport"][1]')
  await viewport.evaluate((node) => { node.scrollTop = 0 })
  const older = page.getByRole('button', { name: '加载更早消息' })
  await expect(older).toBeVisible()
  const anchor = page.locator('#message-history-551')
  await expect(anchor).toBeInViewport()
  const oldTop = await anchor.evaluate((node) => node.getBoundingClientRect().top)
  await older.click()
  await expect.poll(() => requests.filter((value) => value === 'older').length).toBe(1)
  await expect(page.locator('#message-history-550')).toBeAttached()
  await expect.poll(async () => {
    const top = await anchor.evaluate((node) => node.getBoundingClientRect().top)
    return Math.abs(top - oldTop)
  }).toBeLessThan(48)
  expect((await measure(page)).mountedMessages).toBeLessThan(pageSize)

  await page.getByText('钉住的旧消息', { exact: true }).click()
  await expect.poll(() => requests.includes(`around:${pinnedMessageId}`)).toBe(true)
  await expect(page.locator(`#message-${pinnedMessageId}`)).toBeInViewport()
  await page.getByRole('button', { name: '回到最新' }).click()
  await expect(page.locator(`#message-history-${messageCount}`)).toBeInViewport()
})

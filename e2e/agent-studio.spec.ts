import { expect, test, type Page } from '@playwright/test'

async function openScratch(page: Page) {
  await page.goto('/agents/new')
  await page.getByRole('button', { name: '从零创建', exact: true }).first().click()
}

test('能力标签保留键入的分隔符，并在保存时拆分为独立标签', async ({ page, request }) => {
  await openScratch(page)
  await page.getByPlaceholder('例：TestBot').fill('E2E Studio tags')
  await page.getByPlaceholder('一句话讲清楚它能做什么').fill('测试 Agent Studio 能力标签')
  const tags = page.getByPlaceholder('testing, react, vitest')
  await tags.pressSequentially('react, vitest')
  await expect(tags).toHaveValue('react, vitest')
  await expect(page.locator('aside').getByText('react', { exact: true })).toBeVisible()
  await expect(page.locator('aside').getByText('vitest', { exact: true })).toBeVisible()

  const savedResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/agents' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '创建 Agent', exact: true }).click()
  const response = await savedResponse
  expect(response.status()).toBe(201)
  const { agent } = await response.json()
  try {
    expect(agent.capabilities).toEqual(['react', 'vitest'])
    const persisted = await request.get('/api/agents')
    const { agents } = await persisted.json()
    expect(agents.find((item: { id: string }) => item.id === agent.id).capabilities).toEqual(['react', 'vitest'])
  } finally {
    await request.delete(`/api/agents/${agent.id}`)
  }
})

test('模板和重置同步能力标签文本，切换从零创建时清空', async ({ page }) => {
  await page.goto('/agents/new')
  await page.getByRole('button').filter({ hasText: '全栈实现助手' }).first().click()
  const tags = page.getByPlaceholder('testing, react, vitest')
  const originalTags = '代码实现, 文件修改, 命令验证, 交付总结'
  await expect(tags).toHaveValue(originalTags)
  await tags.fill('temporary, edit')
  await page.getByRole('button', { name: '重置', exact: true }).click()
  await expect(tags).toHaveValue(originalTags)
  await page.getByRole('button', { name: '返回模板市场', exact: true }).click()
  await page.getByRole('button', { name: '从零创建', exact: true }).first().click()
  await expect(tags).toHaveValue('')
})

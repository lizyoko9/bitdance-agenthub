import { expect, test } from '@playwright/test'

import type {
  DeliveryCatalog,
  DeliveryPlanView,
  DeliveryReceiptView,
  DeliveryValidationRequest,
} from '../src/shared/delivery-validation'

const SOURCE = '生成统计文件。总数应等于明细的行数。'
const QUOTE = '总数应等于明细的行数。'

test('交付校验：审核规则与样例，复用指定版本并保留文件快照结果', async ({ page }) => {
  const catalog: DeliveryCatalog = {
    sources: [{ messageId: 'user-requirement', text: SOURCE }],
    agents: [{ id: 'validator', name: '验收 Agent' }],
    plans: [],
  }
  const revision: DeliveryPlanView = {
    id: 'revision-1',
    planId: 'totals',
    revision: 1,
    title: '合计检查',
    status: 'draft',
    requirements: [{ id: 'req-1', messageId: 'user-requirement', quote: QUOTE }],
    inputs: [
      { alias: 'file1', path: 'output/rows.json', format: 'json' },
      { alias: 'file2', path: 'output/summary.json', format: 'json' },
    ],
    rules: [{
      id: 'total',
      requirementId: 'req-1',
      title: '总数等于明细行数',
      expression: 'equals(count(file1), file2.total)',
      requiresFixtures: true,
    }],
    suggestedFixtures: [
      { ruleId: 'total', expected: 'pass', inputs: { file1: '[1]', file2: '{"total":1}' } },
      { ruleId: 'total', expected: 'fail', inputs: { file1: '[1]', file2: '{"total":2}' } },
    ],
    generatorRunId: 'generator-run',
    modelId: 'offline-test',
    createdAt: 1_800_000_000_000,
    receipts: [],
  }
  const requests: DeliveryValidationRequest[] = []
  await page.route('**/api/conversations/*/delivery-validation', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: catalog })
      return
    }
    const body = route.request().postDataJSON() as DeliveryValidationRequest
    requests.push(body)
    switch (body.action) {
      case 'draft': {
        const plan = body.previousRevisionId
          ? { ...revision, id: 'revision-2', revision: 2, status: 'draft' as const, receipts: [] }
          : revision
        catalog.plans = body.previousRevisionId ? [plan, revision] : [plan]
        await route.fulfill({ json: { plan } })
        break
      }
      case 'activate':
        revision.status = 'active'
        await route.fulfill({ json: { plan: revision } })
        break
      case 'validate': {
        const status = revision.receipts.length ? 'pass' : 'fail'
        const receipt: DeliveryReceiptView = {
          id: `receipt-${status}`,
          revisionId: revision.id,
          createdAt: revision.createdAt + (revision.receipts.length + 1) * 1000,
          status,
          checks: [{
            ruleId: 'total',
            requirementId: 'req-1',
            status,
            location: 'output/summary.json · $.total',
            expected: '1',
            observed: status === 'fail' ? '2' : '1',
          }],
          inputs: revision.inputs.map((file) => ({ ...file, status: 'ready' })),
        }
        revision.receipts = [receipt, ...revision.receipts]
        await route.fulfill({ json: { receipt } })
        break
      }
      case 'revoke':
        revision.status = 'revoked'
        await route.fulfill({ json: { plan: revision } })
    }
  })

  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/agents' && response.ok()),
    page.goto('/', { waitUntil: 'domcontentloaded' }),
  ])
  await page.getByRole('button', { name: '新建对话' }).click()
  await page.getByRole('dialog').getByRole('button').filter({ hasText: 'E2E Mock' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('button', { name: '交付校验' }).click()
  const dialog = page.getByRole('dialog', { name: '交付校验' })
  await dialog.getByRole('button', { name: '新建规则' }).click()
  await dialog.getByLabel('规则名称').fill(revision.title)
  await dialog.getByLabel('需求消息 1').selectOption('user-requirement')
  await dialog.getByLabel('需求原文片段 1').fill(QUOTE)
  await dialog.getByLabel('相对路径 1').fill(revision.inputs[0].path)
  await dialog.getByRole('button', { name: '添加文件' }).click()
  await dialog.getByLabel('相对路径 2').fill(revision.inputs[1].path)
  await dialog.getByRole('button', { name: '生成草稿' }).click()
  await expect(dialog.getByText(revision.rules[0].expression)).toBeVisible()
  const activate = dialog.getByRole('button', { name: '审核并启用' })
  await expect(activate).toBeDisabled()

  await dialog.getByLabel('失败样例').fill('[]')
  await dialog.getByLabel('我已核对需求、检查规则与样例预期。').check()
  await activate.click()
  await expect(dialog.getByRole('alert')).toContainText('失败样例须为 JSON 对象')
  await dialog.getByLabel('失败样例').fill(JSON.stringify({ file1: '[1]', file2: '{"total":3}' }))
  await activate.click()
  await expect(dialog.getByRole('button', { name: '校验当前文件' })).toBeVisible()
  expect(requests).toEqual([
    {
      action: 'draft',
      title: revision.title,
      agentId: 'validator',
      requirements: [{ messageId: 'user-requirement', quote: QUOTE }],
      inputs: revision.inputs,
    },
    {
      action: 'activate',
      revisionId: revision.id,
      fixtures: [
        revision.suggestedFixtures[0],
        { ruleId: 'total', expected: 'fail', inputs: { file1: '[1]', file2: '{"total":3}' } },
      ],
      reviewed: true,
    },
  ])

  await dialog.getByRole('button', { name: '校验当前文件' }).click()
  const snapshot = dialog.getByRole('region', { name: '文件快照校验结果' })
  await expect(snapshot.getByText('实际：2')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: '交付校验' }).click()
  await dialog.getByLabel('已保存版本').selectOption(revision.id)
  await dialog.getByRole('button', { name: '校验当前文件' }).click()
  await expect(snapshot.getByText('实际：1')).toBeVisible()
  await expect(snapshot.getByText('文件改动后需重新校验。', { exact: false })).toBeVisible()
  await dialog.getByLabel('快照记录').selectOption('receipt-fail')
  await expect(snapshot.getByText('实际：2')).toBeVisible()

  await dialog.getByRole('button', { name: '撤销版本' }).click()
  await expect(dialog.getByRole('button', { name: '校验当前文件' })).toHaveCount(0)
  expect(requests.slice(2)).toEqual([
    { action: 'validate', revisionId: revision.id },
    { action: 'validate', revisionId: revision.id },
    { action: 'revoke', revisionId: revision.id },
  ])

  // Both saved excerpts remain usable when their source has moved out of the recent catalog.
  catalog.sources = []
  revision.requirements.push({ id: 'req-2', messageId: 'user-requirement', quote: '生成统计文件。' })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: '交付校验' }).click()
  await dialog.getByLabel('已保存版本').selectOption(revision.id)
  await dialog.getByRole('button', { name: '生成新版本' }).click()
  await expect(dialog.getByLabel('需求原文片段 1')).toHaveValue(QUOTE)
  await expect(dialog.getByLabel('需求原文片段 2')).toHaveValue('生成统计文件。')
  await dialog.getByRole('button', { name: '生成草稿' }).click()
  await expect(dialog.getByRole('heading', { name: '合计检查 · v2' })).toBeVisible()
  expect(requests.at(-1)).toMatchObject({
    action: 'draft',
    previousRevisionId: revision.id,
    requirements: [
      { messageId: 'user-requirement', quote: QUOTE },
      { messageId: 'user-requirement', quote: '生成统计文件。' },
    ],
  })
})

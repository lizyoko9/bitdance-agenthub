import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('help center copy', () => {
  it('uses the simplified Chinese product modules instead of retired center names', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/server/help-center-service.ts'), 'utf8')
    const reference = readFileSync(resolve(process.cwd(), 'docs/reference/help-center.md'), 'utf8')
    const copy = `${source}\n${reference}`

    for (const term of ['智能体', '员工大脑', '工作台', '编排画布', '技能管理', '模型管理', '工具连接']) {
      expect(copy).toContain(term)
    }

    expect(copy).not.toContain('Agent Factory')
    expect(copy).not.toContain('Memory Center')
    expect(copy).not.toContain('ConfigOps Center')
    expect(copy).not.toContain('/factory')
    expect(copy).not.toContain('/memory')
    expect(copy).not.toContain('/config')
  })
})

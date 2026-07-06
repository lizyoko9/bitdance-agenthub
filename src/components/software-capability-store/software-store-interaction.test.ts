import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('software capability store interaction', () => {
  it('marks software cards as clickable store entries', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/software-capability-store/software-store-overview.tsx'),
      'utf8',
    )

    expect(source).toContain('data-testid="software-store-card"')
    expect(source).toContain('打开设置')
  })

  it('shows a clear return action in the software detail dialog', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/software-capability-store/software-detail-dialog.tsx'),
      'utf8',
    )

    expect(source).toContain('data-testid="software-detail-dialog"')
    expect(source).toContain('返回软件商店')
  })

  it('summarizes CLI, MCP, and packaged command modes in software details', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/software-capability-store/software-mode-panel.tsx'),
      'utf8',
    )

    expect(source).toContain('data-testid="software-mode-summary"')
    expect(source).toContain("mode.kind === 'CLI'")
    expect(source).toContain("mode.kind === 'MCP'")
    expect(source).toContain("mode.kind === '命令'")
    expect(source).toContain('CLI 接入')
    expect(source).toContain('MCP 接入')
    expect(source).toContain('封装命令')
  })
})

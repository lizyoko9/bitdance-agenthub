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
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('workbench copy', () => {
  it('uses the canvas name for orchestration entry points', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/desktop-workbench.tsx'), 'utf8')

    expect(source).not.toContain('工作流')
    expect(source).toContain('编排画布')
  })
})

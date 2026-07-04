import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const primaryUiFiles = [
  'src/components/model-control-center.tsx',
  'src/components/agent-workflow-canvas.tsx',
  'src/components/software-capability-store/software-mode-panel.tsx',
  'src/components/software-capability-store/software-advanced-config.tsx',
]

describe('simple product copy', () => {
  it('avoids advanced-tier language in primary configuration screens', () => {
    for (const file of primaryUiFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')

      expect(source, file).not.toContain('高级配置')
      expect(source, file).not.toContain('高级设置')
    }
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('LangflowAgentCanvas lifecycle UI', () => {
  it('keeps lifecycle status inside the existing canvas instead of adding a new module', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('data-testid="canvas-lifecycle-status"')
    expect(source).toContain('生命周期')
    expect(source).toContain('运行前检查')
  })
})

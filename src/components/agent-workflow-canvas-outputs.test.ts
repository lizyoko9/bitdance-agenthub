import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent workflow canvas output rendering', () => {
  it('renders every configured node output instead of only the default output', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-workflow-canvas.tsx'), 'utf8')

    expect(source).toContain('artifactOutputsOf(node).map')
    expect(source).not.toContain('[primaryOutput].map')
  })
})

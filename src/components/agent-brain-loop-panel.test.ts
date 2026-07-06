import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent brain loop panel', () => {
  it('shows the agent-local brain workflow inside agent settings', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-employee-settings-panel.tsx'), 'utf8')

    expect(source).toContain('<BrainLoopPanel items={detail.brainLoop} />')
    expect(source).toContain('function BrainLoopPanel')
    expect(source).toContain('脑内工作流')
    expect(source).not.toContain('PSM')
  })
})

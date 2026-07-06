import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent brain next run briefing panel', () => {
  it('shows next-run memory guidance inside the agent settings brain card', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-employee-settings-panel.tsx'), 'utf8')

    expect(source).toContain('<NextRunBriefingPanel briefing={detail.nextRunBriefing} />')
    expect(source).toContain('function NextRunBriefingPanel')
    expect(source).toContain('下次开工提示')
    expect(source).not.toContain('PSM')
  })
})

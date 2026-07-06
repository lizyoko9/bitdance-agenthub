import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('employee run brain next run briefing UI', () => {
  it('shows next-run guidance in the run detail brain digest', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/desktop-workbench.tsx'), 'utf8')

    expect(source).toContain('<EmployeeRunNextRunBriefing briefing={digest.nextRunBriefing} />')
    expect(source).toContain('function EmployeeRunNextRunBriefing')
    expect(source).toContain('下次开工提示')
    expect(source).not.toContain('PSM')
  })
})

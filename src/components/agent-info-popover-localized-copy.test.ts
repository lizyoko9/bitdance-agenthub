import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent info popover localized generated copy', () => {
  it('renders generated default agent identity through Chinese display helpers', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-info-popover.tsx'), 'utf8')

    expect(source).toContain("from '@/lib/agenthub-display-text'")
    expect(source).toContain('localizeGeneratedAgentProfileName(agent.name)')
    expect(source).toContain("safeAgentDisplayText(agent.description, '')")
    expect(source).not.toContain('Orchestrator</Badge>')
  })
})

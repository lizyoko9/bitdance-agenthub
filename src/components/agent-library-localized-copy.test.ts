import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent library localized generated copy', () => {
  it('renders generated default agent names and descriptions through the Chinese display helpers', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-library.tsx'), 'utf8')

    expect(source).toContain("from '@/lib/agenthub-display-text'")
    expect(source).toContain('localizeGeneratedAgentProfileName(agent.name)')
    expect(source).toContain("safeAgentDisplayText(agent.description, '还没有填写岗位说明')")
    expect(source).toContain('aria-label={`设置智能体 ${localizeGeneratedAgentProfileName(agent.name)}`}')
  })
})

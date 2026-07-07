import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('langflow agent canvas localized copy', () => {
  it('uses Chinese-first wording for employee nodes instead of mixed Agent copy', () => {
    const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')
    const templateSource = readFileSync(resolve(process.cwd(), 'src/lib/agent-flow-node-templates.ts'), 'utf8')

    expect(canvasSource).toContain('员工智能体')
    expect(templateSource).toContain("title: '员工智能体'")
    expect(canvasSource).toContain("from '@/lib/agenthub-display-text'")
    expect(canvasSource).toContain('localizeGeneratedAgentProfileName(agent.name)')
    expect(`${canvasSource}\n${templateSource}`).not.toContain('员工 Agent')
    expect(`${canvasSource}\n${templateSource}`).not.toContain('下游 Agent')
    expect(canvasSource).not.toContain("placeholder=\"搜索节点、Agent、产物\"")
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent workflow canvas output rendering', () => {
  it('renders every configured node output instead of only the default output', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-workflow-canvas.tsx'), 'utf8')

    expect(source).toContain('artifactOutputsOf(node).map')
    expect(source).not.toContain('[primaryOutput].map')
  })

  it('shows precise runtime artifact handoffs in the run monitor', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-workflow-canvas.tsx'), 'utf8')

    expect(source).toContain('artifactHandoffs')
    expect(source).toContain('WorkflowRunArtifactHandoff')
    expect(source).toContain('运行产物交付')
    expect(source).toContain('收到')
    expect(source).toContain('交出')
  })

  it('shows the client-facing delivery package in the run monitor', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-workflow-canvas.tsx'), 'utf8')

    expect(source).toContain('deliveryPackage')
    expect(source).toContain('DeliveryPackageSummary')
    expect(source).toContain('客户可见交付包')
    expect(source).toContain('准备交付')
  })
})

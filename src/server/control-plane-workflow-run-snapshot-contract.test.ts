import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('workflow run snapshot contract', () => {
  it('exposes precise artifact handoffs and the client-facing delivery package from the control plane snapshot', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/server/control-plane-service.ts'), 'utf8')
    const apiSource = readFileSync(resolve(process.cwd(), 'src/lib/api.ts'), 'utf8')

    expect(source).toContain('WorkflowRunArtifactHandoff')
    expect(source).toContain('artifactHandoffs: WorkflowRunArtifactHandoff[]')
    expect(source).toContain('WorkflowRunDeliveryPackage')
    expect(source).toContain('deliveryPackage: WorkflowRunDeliveryPackage')
    expect(source).toContain('buildWorkflowRunArtifactHandoffs({')
    expect(source).toContain('buildWorkflowRunDeliveryPackage({')
    expect(source).toContain('artifactHandoffs,')
    expect(source).toContain('deliveryPackage,')
    expect(apiSource).toContain('export interface WorkflowRunArtifactHandoff')
    expect(apiSource).toContain('artifactHandoffs: WorkflowRunArtifactHandoff[]')
    expect(apiSource).toContain('export interface WorkflowRunDeliveryPackage')
    expect(apiSource).toContain('deliveryPackage: WorkflowRunDeliveryPackage')
  })
})

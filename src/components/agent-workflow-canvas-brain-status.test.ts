import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent workflow canvas brain status UI', () => {
  it('keeps employee brain status on workflow nodes instead of a separate PSM module', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-workflow-canvas.tsx'), 'utf8')

    expect(source).toContain('const [nodeBrainStatuses, setNodeBrainStatuses]')
    expect(source).toContain('setWorkflowRunSnapshot(snapshot)')
    expect(source).toContain('nodeBrainStatusByNodeRunId')
    expect(source).toContain('<CanvasNodeBrainStatus brainStatus={brainStatus ?? null} />')
    expect(source).toContain('function CanvasNodeBrainStatus')
    expect(source).toContain('员工大脑')
    expect(source).toContain('nodeBrainStatusByNodeRunId={nodeBrainStatusByNodeRunId}')
  })
})

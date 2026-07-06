import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('LangflowAgentCanvas lifecycle UI', () => {
  it('keeps lifecycle status inside the existing canvas instead of adding a new module', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('data-testid="canvas-lifecycle-status"')
    expect(source).toContain('生命周期')
    expect(source).toContain('lifecycleStatus.phaseLabel')
  })

  it('derives lifecycle status from current canvas preflight instead of static copy', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('deriveCanvasLifecycleStatus')
    expect(source).toContain('const livePreflight = useMemo')
    expect(source).toContain('const lifecycleStatus = useMemo')
    expect(source).toContain('lifecycleStatus={lifecycleStatus}')
    expect(source).toContain('data-lifecycle-state={lifecycleStatus.state}')
    expect(source).toContain('{lifecycleStatus.statusLabel}')
  })

  it('lets users click lifecycle status to open preflight blockers and focus the first issue', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('const openLifecycleStatus = useCallback')
    expect(source).toContain('setPreflightVisible(true)')
    expect(source).toContain('setPreflightIssues(livePreflight.issues)')
    expect(source).toContain('const firstBlockingIssue = livePreflight.issues.find')
    expect(source).toContain('selectNodeById(firstBlockingIssue.nodeId)')
    expect(source).toContain('selectEdgeById(firstBlockingIssue.edgeId)')
    expect(source).toContain('onLifecycleStatusClick={openLifecycleStatus}')
    expect(source).toContain('onClick={onLifecycleStatusClick}')
  })
})

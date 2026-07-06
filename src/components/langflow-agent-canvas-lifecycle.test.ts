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
})

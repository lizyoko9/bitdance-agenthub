import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Langflow agent canvas layout', () => {
  it('keeps the React Flow surface as the primary workspace instead of squeezing it into a narrow middle column', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('className="relative min-h-0 flex-1"')
    expect(source).toContain('absolute left-3 top-3 bottom-3 z-10 w-[17rem]')
    expect(source).toContain('absolute right-3 top-3 bottom-3 z-10 w-[22rem]')
    expect(source).not.toContain('grid-cols-[17rem_minmax(0,1fr)_22rem]')
    expect(source).not.toContain('grid-cols-[17rem_minmax(0,1fr)]')
  })

  it('supports deleting the selected canvas node with the Delete key', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain("event.key !== 'Delete'")
    expect(source).toContain('deleteNodeById(selectedNodeId)')
    expect(source).toContain('isEditableElement(event.target)')
  })

  it('supports dragging palette components onto the canvas at the drop position', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('useReactFlow')
    expect(source).toContain('application/agenthub-node-kind')
    expect(source).toContain('screenToFlowPosition')
    expect(source).toContain('onDrop={handleCanvasDrop}')
    expect(source).toContain('draggable')
  })
})

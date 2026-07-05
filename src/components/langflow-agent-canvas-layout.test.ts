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

  it('lets the node inspector add and remove input/output artifact ports', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('addPortToNode')
    expect(source).toContain('removePortFromNode')
    expect(source).toContain("onAddPort={() => addPortToNode(node.id, 'inputs')}")
    expect(source).toContain("onAddPort={() => addPortToNode(node.id, 'outputs')}")
    expect(source).toContain("removePortFromNode(node.id, 'inputs', portId)")
    expect(source).toContain("removePortFromNode(node.id, 'outputs', portId)")
    expect(source).toContain('新增输入')
    expect(source).toContain('新增输出')
  })

  it('keeps existing edges consistent when a port artifact type changes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('changePortTypeForNode')
    expect(source).toContain('syncEdgesAfterPortTypeChange')
    expect(source).toContain("direction === 'outputs'")
    expect(source).toContain('artifactType: nextType')
    expect(source).toContain('label: artifactLabels[nextType]')
    expect(source).toContain('canConnect(edge.data?.artifactType ??')
  })

  it('uses the shared Langflow port contract instead of a private canvas-only type list', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('LANGFLOW_PORT_KIND_LABELS')
    expect(source).toContain('canConnectPortKinds')
    expect(source).toContain("type ArtifactType = LangflowPortKind | 'any'")
  })

  it('previews the artifact handoff chain before running a workflow', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('buildHandoffSteps')
    expect(source).toContain('runPreflight')
    expect(source).toContain('HandoffPreviewPanel')
    expect(source).toContain('onClick={runPreflight}')
    expect(source).toContain('交付链路')
  })
})

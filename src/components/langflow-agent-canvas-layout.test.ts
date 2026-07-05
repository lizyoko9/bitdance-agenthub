import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Langflow agent canvas layout', () => {
  const readCanvasSource = () =>
    readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

  it('keeps the React Flow surface as the primary workspace instead of squeezing it into a narrow middle column', () => {
    const source = readCanvasSource()

    expect(source).toContain('className="relative min-h-0 flex-1"')
    expect(source).toContain('absolute left-3 top-3 bottom-3 z-10 w-[17rem]')
    expect(source).toContain('absolute right-3 top-3 bottom-3 z-10 w-[22rem]')
    expect(source).not.toContain('grid-cols-[17rem_minmax(0,1fr)_22rem]')
    expect(source).not.toContain('grid-cols-[17rem_minmax(0,1fr)]')
  })

  it('supports deleting the selected canvas node with the Delete key', () => {
    const source = readCanvasSource()

    expect(source).toContain("event.key !== 'Delete'")
    expect(source).toContain('deleteNodeById(selectedNodeId)')
    expect(source).toContain('isEditableElement(event.target)')
  })

  it('supports selecting and deleting the selected workflow edge with the Delete key', () => {
    const source = readCanvasSource()

    expect(source).toContain('selectedEdgeId')
    expect(source).toContain('deleteEdgeById')
    expect(source).toContain('onEdgeClick={(_, edge) =>')
    expect(source).toContain('deleteEdgeById(selectedEdgeId)')
    expect(source).toContain('react-flow__edge-interaction')
    expect(source).toContain('selectEdgeById')
    expect(source).toContain('agenthub:canvas-edge-select')
    expect(source).toContain('onPaneClick={() =>')
  })

  it('supports dragging palette components onto the canvas at the drop position', () => {
    const source = readCanvasSource()

    expect(source).toContain('useReactFlow')
    expect(source).toContain('application/agenthub-node-kind')
    expect(source).toContain('screenToFlowPosition')
    expect(source).toContain('onDrop={handleCanvasDrop}')
    expect(source).toContain('draggable')
  })

  it('lets the node inspector add and remove input/output artifact ports', () => {
    const source = readCanvasSource()

    expect(source).toContain('addPortToNode')
    expect(source).toContain('removePortFromNode')
    expect(source).toContain("onAddPort={() => addPortToNode(node.id, 'inputs')}")
    expect(source).toContain("onAddPort={() => addPortToNode(node.id, 'outputs')}")
    expect(source).toContain("removePortFromNode(node.id, 'inputs', portId)")
    expect(source).toContain("removePortFromNode(node.id, 'outputs', portId)")
    expect(source).toContain('addLabel=')
  })

  it('keeps existing edges consistent when a port artifact type changes', () => {
    const source = readCanvasSource()

    expect(source).toContain('changePortTypeForNode')
    expect(source).toContain('syncEdgesAfterPortTypeChange')
    expect(source).toContain("direction === 'outputs'")
    expect(source).toContain('artifactType: nextType')
    expect(source).toContain('label: artifactLabels[nextType]')
    expect(source).toContain('canConnect(edge.data?.artifactType ??')
  })

  it('uses the shared Langflow port contract instead of a private canvas-only type list', () => {
    const source = readCanvasSource()

    expect(source).toContain('LANGFLOW_PORT_KIND_LABELS')
    expect(source).toContain('canConnectPortKinds')
    expect(source).toContain("type ArtifactType = LangflowPortKind | 'any'")
  })

  it('previews the artifact handoff chain before running a workflow', () => {
    const source = readCanvasSource()

    expect(source).toContain('buildHandoffSteps')
    expect(source).toContain('runPreflight')
    expect(source).toContain('HandoffPreviewPanel')
    expect(source).toContain('onClick={runPreflight}')
    expect(source).toContain('data-testid="handoff-preview-panel"')
  })

  it('saves the canvas nodes edges and artifact handoffs as a local draft', () => {
    const source = readCanvasSource()

    expect(source).toContain('saveCanvasDraft')
    expect(source).toContain("schema: 'agenthub.langflow_agent_canvas.v1'")
    expect(source).toContain('agenthub.langflow-agent-canvas.draft')
    expect(source).toContain('onClick={saveCanvasDraft}')
  })

  it('restores a saved local canvas draft when the canvas opens', () => {
    const source = readCanvasSource()

    expect(source).toContain('loadCanvasDraft')
    expect(source).toContain("draft?.schema !== 'agenthub.langflow_agent_canvas.v1'")
    expect(source).toContain('setNodes(draft.nodes)')
    expect(source).toContain('setEdges(draft.edges)')
    expect(source).toContain('setNotice(`已恢复本地草稿')
  })

  it('shows a dedicated handoff inspector when a workflow edge is selected', () => {
    const source = readCanvasSource()

    expect(source).toContain('const selectedEdge = edges.find')
    expect(source).toContain('EdgeConfigPanel')
    expect(source).toContain('describeEdgeRoute')
    expect(source).toContain('data-testid="langflow-agent-edge-panel"')
    expect(source).toContain('onDeleteEdge={() => deleteEdgeById(selectedEdge.id)}')
    expect(source).toContain('sourceHandle')
    expect(source).toContain('targetHandle')
  })

  it('shows computed execution stages on canvas nodes', () => {
    const source = readCanvasSource()

    expect(source).toContain('buildExecutionStages')
    expect(source).toContain('const executionStages = useMemo')
    expect(source).toContain('const nodesForCanvas = useMemo')
    expect(source).toContain('nodes={nodesForCanvas}')
    expect(source).toContain('executionStage?: number')
    expect(source).toContain('第 {data.executionStage} 步')
  })

  it('filters compatible input ports while the user is dragging a connection', () => {
    const source = readCanvasSource()

    expect(source).toContain('activeConnectionType')
    expect(source).toContain('handleConnectStart')
    expect(source).toContain('onConnectStart={handleConnectStart}')
    expect(source).toContain('onConnectEnd={() => setActiveConnectionType(null)}')
    expect(source).toContain('connectionType?: ArtifactType | null')
    expect(source).toContain('data-output-port-type={output.type}')
    expect(source).toContain('isInputCompatible')
    expect(source).toContain('data-port-compatible')
    expect(source).toContain('canConnect(data.connectionType, input.type)')
  })

  it('prevents workflow edges that would create an execution cycle', () => {
    const source = readCanvasSource()

    expect(source).toContain('wouldCreateDirectedCycle')
    expect(source).toContain("source: connection.source, target: connection.target")
    expect(source).toContain('不能形成循环')
    expect(source).toContain('return')
  })
})

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

  it('uses product-facing canvas copy instead of exposing implementation names in the title', () => {
    const source = readCanvasSource()

    expect(source).toContain('<span>智能体编排画布</span>')
    expect(source).not.toContain('<span>Langflow 式 Agent 编排画布</span>')
    expect(source).not.toContain('<Badge variant="secondary">React Flow</Badge>')
    expect(source).toContain('proOptions={{ hideAttribution: true }}')
    expect(source).not.toContain('像 Langflow 一样先选节点再组合。')
  })

  it('keeps the canvas background draggable and zoomable like a visual workflow editor', () => {
    const source = readCanvasSource()

    expect(source).toContain('panOnDrag')
    expect(source).toContain('panOnScroll')
    expect(source).toContain('zoomOnScroll')
    expect(source).toContain('zoomOnPinch')
    expect(source).toContain('selectionOnDrag={false}')
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
    expect(source).toContain('application/agenthub-node-template')
    expect(source).toContain('screenToFlowPosition')
    expect(source).toContain('onDrop={handleCanvasDrop}')
    expect(source).toContain('draggable')
  })

  it('uses reusable business node templates instead of raw abstract node kinds', () => {
    const source = readCanvasSource()

    expect(source).toContain('agentFlowNodeTemplates')
    expect(source).toContain('getAgentFlowNodeTemplateGroups')
    expect(source).toContain('createNodeFromTemplate')
    expect(source).toContain('getAgentFlowNodeTemplate')
    expect(source).toContain('templateId')
    expect(source).toContain('template.outputs')
  })

  it('organizes the component palette by category before users add nodes', () => {
    const source = readCanvasSource()

    expect(source).toContain('templateGroups')
    expect(source).toContain('activeTemplateCategory')
    expect(source).toContain('data-testid="component-category-filter"')
    expect(source).toContain('filteredTemplateGroups')
    expect(source).toContain('data-category={group.category}')
  })

  it('syncs selected Agent contracts into the canvas node ports', () => {
    const source = readCanvasSource()

    expect(source).toContain('buildAgentFlowPortsFromContracts')
    expect(source).toContain('replaceNodePortsForAgent')
    expect(source).toContain('outputs: agentPorts.outputs')
    expect(source).toContain('inputs: agentPorts.inputs')
    expect(source).toContain('keepEdgesWithKnownHandles')
  })

  it('syncs selected software command schemas into the canvas node ports', () => {
    const source = readCanvasSource()

    expect(source).toContain('buildSoftwareCommandFlowPorts')
    expect(source).toContain('replaceNodePortsForSoftwareCommand')
    expect(source).toContain('outputs: commandPorts.outputs')
    expect(source).toContain('inputs: commandPorts.inputs')
    expect(source).toContain('keepEdgesWithKnownHandles')
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

  it('shows a node inspector summary before advanced port editing controls', () => {
    const source = readCanvasSource()

    expect(source).toContain('节点检查器')
    expect(source).toContain('data-testid="node-port-summary"')
    expect(source).toContain('接收输入')
    expect(source).toContain('输出产物')
    expect(source).toContain('data-testid="advanced-port-settings"')
    expect(source).toContain('PortPreviewList')
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
    expect(source).toContain('type AgentFlowTemplatePortKind')
    expect(source).toContain('type ArtifactType = AgentFlowTemplatePortKind')
  })

  it('previews the artifact handoff chain before running a workflow', () => {
    const source = readCanvasSource()

    expect(source).toContain('buildHandoffSteps')
    expect(source).toContain('validateAgentFlowForRun')
    expect(source).toContain('applyPreflightStatusToNodes')
    expect(source).toContain('preflightIssues')
    expect(source).toContain('PreflightIssuePanel')
    expect(source).toContain('runPreflight')
    expect(source).toContain('HandoffPreviewPanel')
    expect(source).toContain('onClick={runPreflight}')
    expect(source).toContain('data-testid="handoff-preview-panel"')
  })

  it('lets users click a preflight issue to select the broken node', () => {
    const source = readCanvasSource()

    expect(source).toContain('onSelectNode')
    expect(source).toContain('data-testid="preflight-issue-card"')
    expect(source).toContain('issue.nodeId && onSelectNode(issue.nodeId)')
  })

  it('clears the visual node selection when users select an edge or the blank canvas', () => {
    const source = readCanvasSource()

    expect(source).toContain('clearSelectedNodes')
    expect(source).toContain('clearSelectedNodes()')
    expect(source).toContain('setNodes((current) => current.map((item) => item.selected ? { ...item, selected: false } : item))')
  })

  it('shows an execution plan panel with each node incoming and outgoing handoff contracts', () => {
    const source = readCanvasSource()

    expect(source).toContain('buildAgentFlowRunPlan')
    expect(source).toContain('executionPlan')
    expect(source).toContain('ExecutionPlanPanel')
    expect(source).toContain('incomingContracts')
    expect(source).toContain('outgoingContracts')
    expect(source).toContain('data-testid="execution-plan-panel"')
  })

  it('shows the latest local dry-run result directly on the canvas', () => {
    const source = readCanvasSource()

    expect(source).toContain('lastRun')
    expect(source).toContain('setLastRun(run)')
    expect(source).toContain('RunResultSummary')
    expect(source).toContain('data-testid="run-result-summary"')
  })

  it('saves the canvas nodes edges and artifact handoffs as a local draft', () => {
    const source = readCanvasSource()

    expect(source).toContain('saveCanvasDraft')
    expect(source).toContain("schema: 'agenthub.langflow_agent_canvas.v1'")
    expect(source).toContain('agenthub.langflow-agent-canvas.draft')
    expect(source).toContain('agenthub.langflow-agent-canvas.library')
    expect(source).toContain('workflowTitle')
    expect(source).toContain('savedDrafts')
    expect(source).toContain('onClick={saveCanvasDraft}')
  })

  it('restores a saved local canvas draft when the canvas opens', () => {
    const source = readCanvasSource()

    expect(source).toContain('loadCanvasDraft')
    expect(source).toContain('loadCanvasDraftLibrary')
    expect(source).toContain('loadSavedCanvasDraft')
    expect(source).toContain("draft?.schema !== 'agenthub.langflow_agent_canvas.v1'")
    expect(source).toContain('setNodes(cloneCanvasNodes(draft.nodes))')
    expect(source).toContain('setEdges(cloneCanvasEdges(draft.edges))')
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

  it('stores the selected source and target ports as an explicit edge handoff contract', () => {
    const source = readCanvasSource()

    expect(source).toContain('sourcePortId')
    expect(source).toContain('targetPortId')
    expect(source).toContain('sourcePortLabel')
    expect(source).toContain('targetPortLabel')
    expect(source).toContain('handoffContract')
    expect(source).toContain('output.label')
    expect(source).toContain('input.label')
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

  it('keeps each target input port bound to a single upstream handoff edge', () => {
    const source = readCanvasSource()

    expect(source).toContain('replaceEdgesForSingleTargetHandle')
    expect(source).toContain('setEdges((current) =>')
    expect(source).toContain('createFlowEdge(')
  })

  it('validates connection compatibility before React Flow accepts a dropped edge', () => {
    const source = readCanvasSource()

    expect(source).toContain('const isConnectionValid = useCallback')
    expect(source).toContain('isValidConnection={isConnectionValid}')
    expect(source).toContain('canConnect(output.type, input.type)')
    expect(source).toContain('wouldCreateDirectedCycle(edges, { source: connection.source, target: connection.target })')
  })
})

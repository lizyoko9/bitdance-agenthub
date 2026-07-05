import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Langflow agent canvas layout', () => {
  const readCanvasSource = () =>
    readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

  it('uses a Langflow-style three-column workspace so panels do not cover canvas nodes', () => {
    const source = readCanvasSource()

    expect(source).toContain('flex h-full min-h-[720px] w-full min-w-0 flex-1 flex-col overflow-hidden bg-background')
    expect(source).toContain('grid-cols-[17rem_minmax(0,1fr)_22rem]')
    expect(source).toContain('data-testid="canvas-flow-surface"')
    expect(source).toContain('col-start-1 row-start-1')
    expect(source).toContain('col-start-2 row-start-1')
    expect(source).toContain('col-start-3 row-start-1')
    expect(source).not.toContain('absolute left-3 top-3 bottom-3 z-10 w-[17rem]')
    expect(source).not.toContain('absolute right-3 top-3 bottom-3 z-10 w-[22rem]')
  })

  it('lets users collapse side panels so the canvas becomes the primary work area', () => {
    const source = readCanvasSource()

    expect(source).toContain('paletteCollapsed')
    expect(source).toContain('inspectorCollapsed')
    expect(source).toContain('data-testid="canvas-left-panel-toggle"')
    expect(source).toContain('data-testid="canvas-right-panel-toggle"')
    expect(source).toContain('grid-cols-[3.25rem_minmax(0,1fr)_22rem]')
    expect(source).toContain('grid-cols-[17rem_minmax(0,1fr)_3.25rem]')
    expect(source).toContain('grid-cols-[3.25rem_minmax(0,1fr)_3.25rem]')
    expect(source).toContain('aria-pressed={paletteCollapsed}')
    expect(source).toContain('aria-pressed={inspectorCollapsed}')
    expect(source).toContain('if (!paletteCollapsed) fitCanvasView()')
    expect(source).toContain('if (!inspectorCollapsed) fitCanvasView()')
  })

  it('keeps run plan and handoff details in the right inspector instead of covering the canvas', () => {
    const source = readCanvasSource()

    expect(source).toContain('data-testid="canvas-right-inspector"')
    expect(source).toContain('<ExecutionPlanPanel steps={executionPlan} visible={preflightVisible} lastRun={lastRun} />')
    expect(source).toContain('<HandoffPreviewPanel steps={handoffSteps} visible={preflightVisible} />')
    expect(source).not.toContain('absolute left-[18.5rem] top-3')
    expect(source).not.toContain('absolute bottom-3 left-[18.5rem]')
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

  it('pads automatic fit view so workflow nodes are not hidden under the palette or inspector', () => {
    const source = readCanvasSource()

    expect(source).toContain('const CANVAS_FIT_VIEW_PADDING = 0.18')
    expect(source).toContain('const CANVAS_FIT_VIEW_MAX_ZOOM = 0.85')
    expect(source).toContain('fitViewOptions={{ padding: CANVAS_FIT_VIEW_PADDING, maxZoom: CANVAS_FIT_VIEW_MAX_ZOOM }}')
    expect(source).toContain('maxZoom={CANVAS_FIT_VIEW_MAX_ZOOM}')
    expect(source).not.toContain('fitViewOptions={{ padding: 0.2 }}')
    expect(source).not.toContain('const CANVAS_FIT_VIEW_MAX_ZOOM = 0.5')
  })

  it('recenters the visual workflow after loading a draft or applying a preset', () => {
    const source = readCanvasSource()

    expect(source).toContain('const { screenToFlowPosition, fitView } = useReactFlow')
    expect(source).toContain('const fitCanvasView = useCallback(() => {')
    expect(source).toContain('window.requestAnimationFrame(() => {')
    expect(source).toContain('void fitView({ padding: CANVAS_FIT_VIEW_PADDING, maxZoom: CANVAS_FIT_VIEW_MAX_ZOOM })')
    expect(source).toContain('fitCanvasView()')
    expect(source).toContain('if (!position) fitCanvasView()')
  })

  it('uses compact node cards so three workflow nodes fit inside the middle canvas column', () => {
    const source = readCanvasSource()

    expect(source).toContain('w-60 rounded-xl border bg-card')
    expect(source).not.toContain('min-w-72 rounded-xl border bg-card')
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

  it('auto-links a clicked palette component after the selected compatible node', () => {
    const source = readCanvasSource()

    expect(source).toContain('findFirstCompatiblePortPair')
    expect(source).toContain('findFirstCompatiblePortPair({')
    expect(source).toContain('selectedNodeId')
    expect(source).toContain('auto-${sourceNode.id}-${node.id}')
    expect(source).toContain('replaceEdgesForSingleTargetHandle(current, edge)')
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

  it('lets users search the component palette before adding nodes', () => {
    const source = readCanvasSource()

    expect(source).toContain('templateSearchQuery')
    expect(source).toContain('data-testid="component-palette-search"')
    expect(source).toContain('placeholder="搜索节点、Agent、产物"')
    expect(source).toContain('matchesTemplateSearch')
  })

  it('lets users start from business workflow presets instead of a blank canvas', () => {
    const source = readCanvasSource()

    expect(source).toContain('canvasWorkflowPresets')
    expect(source).toContain('applyWorkflowPreset')
    expect(source).toContain('createCanvasWorkflowPresetDraft')
    expect(source).toContain('data-testid="canvas-workflow-presets"')
    expect(source).toContain('data-testid="canvas-workflow-preset"')
    expect(source).toContain('content-video')
    expect(source).toContain('code-delivery')
    expect(source).toContain('report-delivery')
  })

  it('keeps saved workflows inside the canvas module instead of a separate confusing page', () => {
    const source = readCanvasSource()

    expect(source).toContain('data-testid="canvas-saved-workflows"')
    expect(source).toContain('data-testid="canvas-saved-workflow-card"')
    expect(source).toContain('保存的流程')
    expect(source).toContain('openSavedCanvasDraft')
    expect(source).toContain('saveWorkflowDraftToLibrary')
    expect(source).toContain('applyWorkflowPreset')
    expect(source).toContain('setSavedDrafts(nextLibrary)')
  })

  it('filters palette components while a typed output connection is active', () => {
    const source = readCanvasSource()

    expect(source).toContain('templateAcceptsConnectionType')
    expect(source).toContain('activeConnectionType')
    expect(source).toContain('data-testid="active-connection-filter"')
    expect(source).toContain('正在连接')
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

  it('shows a plain-language setup guide before advanced node settings', () => {
    const source = readCanvasSource()

    expect(source).toContain('NodeSetupGuide')
    expect(source).toContain('data-testid="node-setup-guide"')
    expect(source).toContain('getNodeSetupGuide')
    expect(source).toContain('setupGuide.primaryAction')
    expect(source).toContain('setupGuide.handoffHint')
  })

  it('shows the selected node actual incoming and outgoing handoffs', () => {
    const source = readCanvasSource()

    expect(source).toContain('NodeHandoffSummary')
    expect(source).toContain('data-testid="node-handoff-summary"')
    expect(source).toContain('getNodeHandoffSummary')
    expect(source).toContain('incomingHandoffs')
    expect(source).toContain('outgoingHandoffs')
    expect(source).toContain('edge.data?.handoffContract')
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
    expect(source).toContain('data-testid="handoff-route-line"')
    expect(source).toContain('data-testid="handoff-artifact-contract"')
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
    expect(source).toContain('openSavedCanvasDraft')
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

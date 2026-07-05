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
    expect(source).toContain('useEffect(() => {\n    fitCanvasView()\n  }, [fitCanvasView, inspectorCollapsed, paletteCollapsed])')
    expect(source).not.toContain('if (!paletteCollapsed) fitCanvasView()')
    expect(source).not.toContain('if (!inspectorCollapsed) fitCanvasView()')
  })

  it('keeps run plan and handoff details in the right inspector instead of covering the canvas', () => {
    const source = readCanvasSource()

    expect(source).toContain('data-testid="canvas-right-inspector"')
    expect(source).toContain('<ExecutionPlanPanel steps={executionPlan} visible={preflightVisible} lastRun={lastRun} />')
    expect(source).toContain('<HandoffPreviewPanel steps={handoffSteps} visible={preflightVisible} />')
    expect(source).not.toContain('absolute left-[18.5rem] top-3')
    expect(source).not.toContain('absolute bottom-3 left-[18.5rem]')
  })

  it('keeps preflight issue overlays inside the flow surface after the inspector moved to its own column', () => {
    const source = readCanvasSource()

    expect(source).toContain('data-testid="preflight-issues-panel"')
    expect(source).toContain('absolute right-3 top-3')
    expect(source).not.toContain('right-[23.5rem]')
  })

  it('uses product-facing canvas copy instead of exposing implementation names in the title', () => {
    const source = readCanvasSource()

    expect(source).toContain('<span>编排工作流</span>')
    expect(source).toContain('把员工 Agent、工具和交付物连成一条工作流。')
    expect(source).toContain('新建流程')
    expect(source).toContain('检查并试运行')
    expect(source).not.toContain('<Badge variant="secondary">节点编排</Badge>')
    expect(source).not.toContain('<Badge variant="outline">免费</Badge>')
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

    expect(source).toContain("import { resolveCanvasKeyboardAction } from '@/lib/canvas-keyboard-actions'")
    expect(source).toContain('const action = resolveCanvasKeyboardAction(event)')
    expect(source).toContain("action !== 'delete-selected-node'")
    expect(source).toContain('deleteNodeById(selectedNodeId)')
    expect(source).not.toContain('isEditableElement(event.target)')
  })

  it('shows a Langflow-style floating toolbar on the selected node for obvious node actions', () => {
    const source = readCanvasSource()

    expect(source).toContain('data-testid="node-floating-toolbar"')
    expect(source).toContain('selected &&')
    expect(source).toContain('agenthub:canvas-node-delete')
    expect(source).toContain('handleNodeDelete')
    expect(source).toContain('deleteNodeById(nodeId)')
  })

  it('lets users duplicate a selected node from the floating toolbar without copying its handoff edges', () => {
    const source = readCanvasSource()

    expect(source).toContain('duplicateNodeById')
    expect(source).toContain('agenthub:canvas-node-duplicate')
    expect(source).toContain('handleNodeDuplicate')
    expect(source).toContain('data-testid="node-toolbar-duplicate"')
    expect(source).toContain('position: { x: source.position.x + 48, y: source.position.y + 48 }')
    expect(source).toContain('outputs: source.data.outputs.map((output) => ({ ...output }))')
    expect(source).toContain('setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge))')
  })

  it('supports duplicating the selected node with Ctrl+D like a visual canvas editor', () => {
    const source = readCanvasSource()

    expect(source).toContain("action === 'duplicate-selected-node'")
    expect(source).toContain('duplicateNodeById(selectedNodeId)')
    expect(source).toContain('event.preventDefault()')
  })

  it('supports saving the workflow with Ctrl+S like a desktop canvas editor', () => {
    const source = readCanvasSource()

    expect(source).toContain("action === 'save-workflow'")
    expect(source).toContain('saveCanvasDraft()')
    expect(source).toContain('onClick={saveCanvasDraft}')
  })

  it('supports undo and redo for recent canvas edits', () => {
    const source = readCanvasSource()

    expect(source).toContain('CanvasHistorySnapshot')
    expect(source).toContain('const [undoStack, setUndoStack]')
    expect(source).toContain('const [redoStack, setRedoStack]')
    expect(source).toContain('pushCanvasHistory()')
    expect(source).toContain('undoCanvasEdit()')
    expect(source).toContain('redoCanvasEdit()')
    expect(source).toContain("action === 'undo-canvas'")
    expect(source).toContain("action === 'redo-canvas'")
    expect(source).toContain('data-testid="canvas-undo-button"')
    expect(source).toContain('data-testid="canvas-redo-button"')
  })

  it('records node movement before dragging so Ctrl+Z can restore the previous layout', () => {
    const source = readCanvasSource()

    expect(source).toContain('onNodeDragStart={pushCanvasHistory}')
  })

  it('records node inspector edits before applying node data patches', () => {
    const source = readCanvasSource()
    const updateNodeSource = source.slice(source.indexOf('const updateNode ='), source.indexOf('const addPortToNode'))

    expect(updateNodeSource).toContain('useCallback')
    expect(updateNodeSource).toContain('pushCanvasHistory()')
    expect(updateNodeSource.indexOf('pushCanvasHistory()')).toBeLessThan(updateNodeSource.indexOf('setNodes((current) =>'))
  })

  it('supports canceling the current artifact connection with the Escape key', () => {
    const source = readCanvasSource()

    expect(source).toContain("action === 'cancel-connection'")
    expect(source).toContain('activeConnectionType')
    expect(source).toContain('activeOutputPort')
    expect(source).toContain('setActiveConnectionType(null)')
    expect(source).toContain('setActiveOutputPort(null)')
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

  it('treats Backspace like Delete for selected canvas objects', () => {
    const source = readCanvasSource()

    expect(source).toContain('const action = resolveCanvasKeyboardAction(event)')
    expect(source).toContain("action !== 'delete-selected-node'")
    expect(source).toContain('deleteEdgeById(selectedEdgeId)')
    expect(source).toContain('deleteNodeById(selectedNodeId)')
  })

  it('shows an inline delete action on the selected edge like a visual flow editor', () => {
    const source = readCanvasSource()

    expect(source).toContain('data-testid="edge-inline-toolbar"')
    expect(source).toContain('data-testid="edge-toolbar-delete"')
    expect(source).toContain('agenthub:canvas-edge-delete')
    expect(source).toContain('handleEdgeDelete')
    expect(source).toContain('deleteEdgeById(edgeId)')
    expect(source).toContain('selected &&')
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
    expect(source).toContain('preferredSourceType: activeConnectionType ?? undefined')
    expect(source).toContain('preferredSourceId: activeOutputPort?.nodeId === sourceNode.id ? activeOutputPort.outputId : undefined')
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

  it('lets users click a node output port to choose the exact artifact type for the next node', () => {
    const source = readCanvasSource()

    expect(source).toContain('data-testid="node-output-port-button"')
    expect(source).toContain('onOutputConnectStart: (type: ArtifactType, outputId: string) => {')
    expect(source).toContain('setSelectedNodeId(node.id)')
    expect(source).toContain('setActiveConnectionType(type)')
    expect(source).toContain('setPaletteCollapsed(false)')
    expect(source).toContain("setActiveTemplateCategory('全部')")
    expect(source).toContain("setTemplateSearchQuery('')")
    expect(source).toContain('activeOutputPortId?: string')
    expect(source).toContain('setActiveOutputPort({ nodeId: node.id, outputId, type })')
    expect(source).toContain('data-active-output-port={data.activeOutputPortId === output.id}')
    expect(source).toContain('aria-label={`选择${output.label}作为下一步产物`}')
    expect(source).toContain("'nodrag nopan")
  })

  it('lets users click a compatible input port on an existing node to finish a connection', () => {
    const source = readCanvasSource()

    expect(source).toContain('onInputConnectComplete?: (targetNodeId: string, targetInputId: string) => void')
    expect(source).toContain('handleInputPortClick')
    expect(source).toContain('data-testid="node-input-port-button"')
    expect(source).toContain('data-input-port-compatible={isInputCompatible}')
    expect(source).toContain('data.onInputConnectComplete?.(id, input.id)')
    expect(source).toContain('onPointerDownCapture={(event) => handleInputPortPointerDown(event, input)}')
    expect(source).toContain('activeOutputPort?.nodeId')
    expect(source).toContain('targetInput.id')
    expect(source).toContain('setActiveConnectionType(null)')
    expect(source).toContain('setActiveOutputPort(null)')
  })

  it('routes incompatible input clicks to the canvas so users get an explanation', () => {
    const source = readCanvasSource()

    expect(source).toContain('不能交付给')
    expect(source).toContain('if (!data.connectionType) return')
    expect(source).not.toContain('if (!data.connectionType || !isInputCompatible) return')
  })

  it('labels compatible input ports as clickable while choosing a downstream connection', () => {
    const source = readCanvasSource()

    expect(source).toContain('点击接入')
    expect(source).toContain('data.connectionType && isInputCompatible')
    expect(source).toContain('data-testid="node-input-port-action-hint"')
  })

  it('leaves artifact connection mode when users click the empty canvas', () => {
    const source = readCanvasSource()

    expect(source).toMatch(
      /onPaneClick=\{\(\) => \{\s+setSelectedNodeId\(''\)\s+setSelectedEdgeId\(''\)\s+setActiveConnectionType\(null\)/,
    )
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

  it('shows business-first node setup cards before low-level port forms', () => {
    const source = readCanvasSource()

    expect(source).toContain('NodeBusinessSetup node={node}')
    expect(source).toContain('data-testid="node-business-setup"')
    expect(source).toContain('data-testid="node-business-executor"')
    expect(source).toContain('testId="node-business-inputs"')
    expect(source).toContain('testId="node-business-outputs"')
    expect(source).toContain('data-testid={testId}')
    expect(source).toContain('describeNodeExecutor')
  })

  it('shows clickable delivery outlets in the node inspector before advanced port settings', () => {
    const source = readCanvasSource()

    expect(source).toContain('NodeDeliveryOutletPanel')
    expect(source).toContain('data-testid="node-delivery-outlets"')
    expect(source).toContain('data-testid="node-delivery-output-button"')
    expect(source).toContain('onStartOutputConnection')
    expect(source).toContain('onStartOutputConnection(node.id, output.type, output.id)')
    expect(source.indexOf('NodeDeliveryOutletPanel')).toBeLessThan(source.indexOf('data-testid="advanced-port-settings"'))
  })

  it('shows node input requirements in the inspector before delivery outlets', () => {
    const source = readCanvasSource()

    expect(source).toContain('NodeInputRequirementPanel')
    expect(source).toContain('data-testid="node-input-requirements"')
    expect(source).toContain('data-testid="node-input-requirement-row"')
    expect(source.indexOf('NodeInputRequirementPanel')).toBeLessThan(source.indexOf('NodeDeliveryOutletPanel'))
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
    const edgePanelSource = source.slice(
      source.indexOf('function EdgeConfigPanel'),
      source.indexOf('function NodeConfigPanel'),
    )

    expect(source).toContain('const selectedEdge = edges.find')
    expect(source).toContain('EdgeConfigPanel')
    expect(source).toContain('describeEdgeRoute')
    expect(source).toContain('data-testid="langflow-agent-edge-panel"')
    expect(source).toContain('onDeleteEdge={() => deleteEdgeById(selectedEdge.id)}')
    expect(edgePanelSource).toContain('route.handoffContract')
    expect(edgePanelSource).toContain('route.sourcePortLabel')
    expect(edgePanelSource).toContain('route.targetPortLabel')
    expect(edgePanelSource).not.toContain('sourceHandle:')
    expect(edgePanelSource).not.toContain('targetHandle:')
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
    expect(source).toContain('onConnectEnd={() => {')
    expect(source).toContain('setActiveOutputPort(null)')
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

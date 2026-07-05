'use client'

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnConnectStartParams,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  Package,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AgentProfileRow, SoftwareCommandRow } from '@/db/schema'
import { wouldCreateDirectedCycle } from '@/lib/agent-flow-graph'
import { fetchAgentProfiles, fetchSoftwareCommands } from '@/lib/api'
import {
  LANGFLOW_PORT_KIND_LABELS,
  canConnectPortKinds,
  type LangflowPortKind,
} from '@/lib/langflow-port-contracts'
import { cn } from '@/lib/utils'

type AgentFlowNodeKind = 'input' | 'agent' | 'tool' | 'approval' | 'artifact'
type ArtifactType = LangflowPortKind | 'any'

interface AgentFlowPort {
  id: string
  label: string
  type: ArtifactType
}

interface AgentFlowNodeData extends Record<string, unknown> {
  kind: AgentFlowNodeKind
  title: string
  subtitle: string
  description: string
  agentId?: string
  softwareCommandId?: string
  status: 'idle' | 'running' | 'done' | 'blocked'
  inputs: AgentFlowPort[]
  outputs: AgentFlowPort[]
  customerVisible?: boolean
  executionStage?: number
  connectionType?: ArtifactType | null
  onOutputConnectStart?: (type: ArtifactType) => void
}

type AgentFlowNode = Node<AgentFlowNodeData>
type AgentFlowEdge = Edge<{ artifactType: ArtifactType; label: string; outputId: string }>

interface HandoffStep {
  id: string
  sourceId: string
  targetId: string
  sourceTitle: string
  targetTitle: string
  artifactType: ArtifactType
  artifactLabel: string
}

interface CanvasDraft {
  schema: 'agenthub.langflow_agent_canvas.v1'
  savedAt: string
  initialWorkflowId: string | null
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
  handoffSteps?: HandoffStep[]
}

interface EdgeRoute {
  sourceTitle: string
  sourcePortLabel: string
  targetTitle: string
  targetPortLabel: string
  artifactType: ArtifactType
}

const CANVAS_DRAFT_STORAGE_KEY = 'agenthub.langflow-agent-canvas.draft'

const artifactLabels: Record<ArtifactType, string> = { ...LANGFLOW_PORT_KIND_LABELS, any: '任意' }

const artifactColors: Record<ArtifactType, string> = {
  message: '#14b8a6',
  prompt: '#0ea5e9',
  model: '#8b5cf6',
  tool: '#f59e0b',
  memory: '#84cc16',
  document: '#3b82f6',
  report: '#6366f1',
  code: '#a855f7',
  data: '#06b6d4',
  result: '#10b981',
  image: '#f97316',
  video: '#ef4444',
  audio: '#ec4899',
  spreadsheet: '#22c55e',
  file_bundle: '#22c55e',
  structured_data: '#64748b',
  any: '#94a3b8',
}

const nodeKindLabels: Record<AgentFlowNodeKind, string> = {
  input: '客户输入',
  agent: '员工 Agent',
  tool: '工具 / 软件',
  approval: '人工确认',
  artifact: '交付产物',
}

const palette: Array<{
  kind: AgentFlowNodeKind
  title: string
  description: string
  icon: ReactNode
}> = [
  {
    kind: 'input',
    title: '客户输入',
    description: '任务目标、文件、消息或素材入口',
    icon: <FileText className="size-4" />,
  },
  {
    kind: 'agent',
    title: '员工 Agent',
    description: '选择一个已配置智能体执行任务',
    icon: <Bot className="size-4" />,
  },
  {
    kind: 'tool',
    title: '工具 / 软件',
    description: '调用 CLI、MCP 或软件命令',
    icon: <Wrench className="size-4" />,
  },
  {
    kind: 'approval',
    title: '人工确认',
    description: '高风险步骤进入确认节点',
    icon: <UserCheck className="size-4" />,
  },
  {
    kind: 'artifact',
    title: '交付产物',
    description: '客户最终能看到的文件或结果',
    icon: <Package className="size-4" />,
  },
]

const initialNodes: AgentFlowNode[] = [
  createFlowNode('input', { x: 40, y: 120 }, '客户需求', {
    description: '收集客户目标、文件和约束。',
    outputs: [{ id: 'message', label: '客户消息', type: 'message' }],
  }, 'input-1'),
  createFlowNode('agent', { x: 420, y: 120 }, '员工 Agent', {
    description: '根据目标完成分析、执行和验证。',
    inputs: [{ id: 'message', label: '客户消息', type: 'message' }],
    outputs: [
      { id: 'report', label: '报告', type: 'report' },
      { id: 'code', label: '代码', type: 'code' },
    ],
  }, 'agent-2'),
  createFlowNode('artifact', { x: 820, y: 120 }, '客户交付物', {
    description: '只接收上一节点连过来的指定产物。',
    inputs: [{ id: 'report', label: '报告', type: 'report' }],
    outputs: [],
    customerVisible: true,
  }, 'artifact-3'),
]

const initialEdges: AgentFlowEdge[] = [
  createFlowEdge('customer-to-agent', 'input-1', 'agent-2', 'message', 'message'),
  createFlowEdge('agent-to-delivery', 'agent-2', 'artifact-3', 'report', 'report'),
]

export function LangflowAgentCanvas({ initialWorkflowId }: { initialWorkflowId?: string }) {
  return (
    <ReactFlowProvider>
      <LangflowAgentCanvasInner initialWorkflowId={initialWorkflowId} />
    </ReactFlowProvider>
  )
}

function LangflowAgentCanvasInner({ initialWorkflowId }: { initialWorkflowId?: string }) {
  const [agents, setAgents] = useState<AgentProfileRow[]>([])
  const [softwareCommands, setSoftwareCommands] = useState<SoftwareCommandRow[]>([])
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentFlowNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<AgentFlowEdge>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState('agent-2')
  const [selectedEdgeId, setSelectedEdgeId] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [preflightVisible, setPreflightVisible] = useState(false)
  const [activeConnectionType, setActiveConnectionType] = useState<ArtifactType | null>(null)
  const { screenToFlowPosition } = useReactFlow<AgentFlowNode, AgentFlowEdge>()

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchAgentProfiles(), fetchSoftwareCommands()])
      .then(([nextAgents, nextCommands]) => {
        if (cancelled) return
        setAgents(nextAgents)
        setSoftwareCommands(nextCommands)
      })
      .catch((error) => {
        console.error('[LangflowAgentCanvas] failed to load catalogs', error)
        setNotice('读取智能体和工具失败，仍可先编辑画布结构。')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const draft = loadCanvasDraft()
    if (!draft) return

    setNodes(draft.nodes)
    setEdges(draft.edges)
    setSelectedNodeId(draft.nodes[0]?.id ?? '')
    setSelectedEdgeId('')
    setPreflightVisible(Boolean(draft.handoffSteps?.length))
    setNotice(`已恢复本地草稿：${draft.nodes.length} 个节点、${draft.edges.length} 条连线。`)
  }, [setEdges, setNodes])

  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null
  const handoffSteps = useMemo(() => buildHandoffSteps(nodes, edges), [edges, nodes])
  const executionStages = useMemo(() => buildExecutionStages(nodes, edges), [edges, nodes])
  const nodesForCanvas = useMemo(
    () => nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        connectionType: activeConnectionType,
        executionStage: executionStages.get(node.id),
        onOutputConnectStart: setActiveConnectionType,
      },
    })),
    [activeConnectionType, executionStages, nodes],
  )

  const addNode = useCallback((kind: AgentFlowNodeKind, position?: { x: number; y: number }) => {
    const nextIndex = nodes.length + 1
    const node = createFlowNode(kind, position ?? { x: 160 + nextIndex * 54, y: 120 + nextIndex * 28 })
    setNodes((current) => [...current, node])
    setSelectedNodeId(node.id)
  }, [nodes.length, setNodes])

  const handlePaletteDragStart = useCallback((event: DragEvent<HTMLButtonElement>, kind: AgentFlowNodeKind) => {
    event.dataTransfer.setData('application/agenthub-node-kind', kind)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleCanvasDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/agenthub-node-kind')
    if (!isAgentFlowNodeKind(kind)) return

    addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [addNode, screenToFlowPosition])

  const handleConnectStart = useCallback((_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
    if (params.handleType !== 'source' || !params.nodeId || !params.handleId) {
      setActiveConnectionType(null)
      return
    }

    const source = nodes.find((node) => node.id === params.nodeId)
    const output = source?.data.outputs.find((item) => outputHandleId(item) === params.handleId)
    setActiveConnectionType(output?.type ?? null)
  }, [nodes])

  const updateNode = (nodeId: string, patch: Partial<AgentFlowNodeData>) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    )
  }

  const addPortToNode = useCallback((nodeId: string, direction: 'inputs' | 'outputs') => {
    const type: ArtifactType = direction === 'inputs' ? 'any' : 'document'
    const port: AgentFlowPort = {
      id: `${direction}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: direction === 'inputs' ? '新输入' : artifactLabels[type],
      type,
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, [direction]: [...node.data[direction], port] } }
          : node,
      ),
    )
  }, [setNodes])

  const removePortFromNode = useCallback((nodeId: string, direction: 'inputs' | 'outputs', portId: string) => {
    const removedHandle = direction === 'inputs' ? `in:${portId}` : `out:${portId}`

    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                [direction]: node.data[direction].filter((port) => port.id !== portId),
              },
            }
          : node,
      ),
    )
    setEdges((current) =>
      current.filter((edge) =>
        direction === 'inputs'
          ? !(edge.target === nodeId && edge.targetHandle === removedHandle)
          : !(edge.source === nodeId && edge.sourceHandle === removedHandle),
      ),
    )
  }, [setEdges, setNodes])

  const syncEdgesAfterPortTypeChange = useCallback((
    nodeId: string,
    direction: 'inputs' | 'outputs',
    portId: string,
    nextType: ArtifactType,
  ) => {
    const changedHandle = direction === 'inputs' ? `in:${portId}` : `out:${portId}`

    setEdges((current) =>
      current.flatMap((edge) => {
        if (direction === 'outputs' && edge.source === nodeId && edge.sourceHandle === changedHandle) {
          const targetInputType = findPortType(nodes, edge.target, 'inputs', edge.targetHandle)
          if (targetInputType && !canConnect(nextType, targetInputType)) return []

          return [{
            ...edge,
            data: {
              artifactType: nextType,
              label: artifactLabels[nextType],
              outputId: edge.data?.outputId ?? portId,
            },
          }]
        }

        if (direction === 'inputs' && edge.target === nodeId && edge.targetHandle === changedHandle) {
          return canConnect(edge.data?.artifactType ?? 'any', nextType) ? [edge] : []
        }

        return [edge]
      }),
    )
  }, [nodes, setEdges])

  const changePortTypeForNode = useCallback((
    nodeId: string,
    direction: 'inputs' | 'outputs',
    portId: string,
    nextType: ArtifactType,
  ) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                [direction]: node.data[direction].map((port) =>
                  port.id === portId ? { ...port, type: nextType, label: artifactLabels[nextType] } : port,
                ),
              },
            }
          : node,
      ),
    )
    syncEdgesAfterPortTypeChange(nodeId, direction, portId, nextType)
  }, [setNodes, syncEdgesAfterPortTypeChange])

  const deleteNodeById = useCallback((nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) =>
      current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    )
    setSelectedNodeId('')
  }, [setEdges, setNodes])

  const deleteEdgeById = useCallback((edgeId: string) => {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId))
    setSelectedEdgeId('')
  }, [setEdges])

  const selectEdgeById = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId)
    setSelectedNodeId('')
    setEdges((current) => current.map((item) => ({ ...item, selected: item.id === edgeId })))
  }, [setEdges])

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return
    deleteNodeById(selectedNode.id)
  }, [deleteNodeById, selectedNode])

  useEffect(() => {
    const handleEdgeSelect = (event: Event) => {
      const edgeId = (event as CustomEvent<{ edgeId?: string }>).detail?.edgeId
      if (edgeId) selectEdgeById(edgeId)
    }

    window.addEventListener('agenthub:canvas-edge-select', handleEdgeSelect)
    return () => window.removeEventListener('agenthub:canvas-edge-select', handleEdgeSelect)
  }, [selectEdgeById])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return
      if ((!selectedNodeId && !selectedEdgeId) || isEditableElement(event.target)) return
      event.preventDefault()
      if (selectedEdgeId) {
        deleteEdgeById(selectedEdgeId)
        return
      }
      deleteNodeById(selectedNodeId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteEdgeById, deleteNodeById, selectedEdgeId, selectedNodeId])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const source = nodes.find((node) => node.id === connection.source)
      const target = nodes.find((node) => node.id === connection.target)
      const output = source?.data.outputs.find((item) => outputHandleId(item) === connection.sourceHandle)
      const input = target?.data.inputs.find((item) => inputHandleId(item) === connection.targetHandle)

      if (!source || !target || !output || !input) return
      if (wouldCreateDirectedCycle(edges, { source: connection.source, target: connection.target })) {
        setNotice('这条连线不能形成循环：Agent 工作流需要保持从上游到下游的执行顺序。')
        return
      }

      if (!canConnect(output.type, input.type)) {
        setNotice(`${source.data.title} 的 ${artifactLabels[output.type]} 不能交给只接收 ${artifactLabels[input.type]} 的节点。`)
        return
      }

      setEdges((current) => [
        ...current.filter(
          (edge) =>
            !(
              edge.source === connection.source &&
              edge.sourceHandle === connection.sourceHandle &&
              edge.target === connection.target &&
              edge.targetHandle === connection.targetHandle
            ),
        ),
        createFlowEdge(
          `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
          connection.source,
          connection.target,
          output.id,
          output.type,
          connection.sourceHandle ?? undefined,
          connection.targetHandle ?? undefined,
        ),
      ])
      setNotice(`${target.data.title} 现在只会收到：${artifactLabels[output.type]}。`)
    },
    [edges, nodes],
  )

  const runPreflight = useCallback(() => {
    setPreflightVisible(true)
    if (handoffSteps.length === 0) {
      setNotice('预检未通过：画布里还没有可执行的节点连线。')
      return
    }

    const connectedNodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]))
    const disconnectedCount = nodes.filter((node) => !connectedNodeIds.has(node.id)).length
    setNotice(
      `预检完成：${handoffSteps.length} 条交付链路可运行${
        disconnectedCount > 0 ? `，${disconnectedCount} 个节点还没有接入。` : '。'
      }`,
    )
  }, [edges, handoffSteps.length, nodes])

  const saveCanvasDraft = useCallback(() => {
    const draft: CanvasDraft = {
      schema: 'agenthub.langflow_agent_canvas.v1',
      savedAt: new Date().toISOString(),
      initialWorkflowId: initialWorkflowId ?? null,
      nodes,
      edges,
      handoffSteps,
    }

    window.localStorage.setItem(CANVAS_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    setNotice(`草稿已保存：${nodes.length} 个节点、${edges.length} 条连线。`)
  }, [edges, handoffSteps, initialWorkflowId, nodes])

  return (
    <div className="flex h-full min-h-[720px] flex-col bg-background" data-testid="langflow-agent-canvas">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold">
            <GitBranch className="size-4 text-primary" />
            <span>Langflow 式 Agent 编排画布</span>
            <Badge variant="secondary">React Flow</Badge>
            <Badge variant="outline">免费</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            左侧选组件，中间拖拽连线，右侧配置节点。连线从某个产物端口发出，下游只接收这一类产物。
            {initialWorkflowId ? ` 当前流程：${initialWorkflowId}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1">
            <RefreshCw className="size-3.5" />
            重排
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={saveCanvasDraft}>
            <Save className="size-3.5" />
            保存草稿
          </Button>
          <Button type="button" size="sm" className="gap-1" onClick={runPreflight}>
            <Play className="size-3.5" />
            预检运行
          </Button>
        </div>
      </header>

      {notice && (
        <div className="shrink-0 border-b bg-primary/5 px-4 py-2 text-xs text-primary">{notice}</div>
      )}

      <main className="relative min-h-0 flex-1" data-active-connection-type={activeConnectionType ?? ''}>
        <ReactFlow<AgentFlowNode, AgentFlowEdge>
          nodes={nodesForCanvas}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={() => setActiveConnectionType(null)}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id)
            setSelectedEdgeId('')
            setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge))
          }}
          onEdgeClick={(_, edge) => {
            selectEdgeById(edge.id)
          }}
          onPaneClick={() => {
            setSelectedNodeId('')
            setSelectedEdgeId('')
            setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge))
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: 'agentArtifact',
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          connectionLineStyle={{ stroke: '#60a5fa', strokeWidth: 2 }}
        >
          <Background gap={18} size={1} />
          <Controls />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
        </ReactFlow>

        <aside className="absolute left-3 top-3 bottom-3 z-10 w-[17rem] overflow-y-auto rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">组件库</div>
              <div className="mt-0.5 text-xs text-muted-foreground">像 Langflow 一样先选节点再组合。</div>
            </div>
            <Badge variant="outline">{palette.length} 类</Badge>
          </div>
          <div className="space-y-2">
            {palette.map((item) => (
              <button
                key={item.kind}
                type="button"
                draggable
                className="group flex w-full items-start gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary hover:bg-primary/5"
                onClick={() => addNode(item.kind)}
                onDragStart={(event) => handlePaletteDragStart(event, item.kind)}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{item.description}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Plus className="size-3" />
                    添加节点
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="pointer-events-none absolute right-3 top-3 bottom-3 z-10 w-[22rem]">
          <div className="pointer-events-auto h-full">
            {selectedEdge ? (
              <EdgeConfigPanel
                edge={selectedEdge}
                nodes={nodes}
                onDeleteEdge={() => deleteEdgeById(selectedEdge.id)}
              />
            ) : (
              <NodeConfigPanel
                node={selectedNode}
                agents={agents}
                softwareCommands={softwareCommands}
                onUpdateNode={updateNode}
                onDeleteNode={deleteSelectedNode}
                addPortToNode={addPortToNode}
                removePortFromNode={removePortFromNode}
                changePortTypeForNode={changePortTypeForNode}
              />
            )}
          </div>
        </div>

        <HandoffPreviewPanel steps={handoffSteps} visible={preflightVisible} />
      </main>
      </div>
  )
}

function AgentFlowNodeCard({ data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <div
      className={cn(
        'min-w-72 rounded-xl border bg-card text-card-foreground shadow-sm transition hover:shadow-md',
        selected && 'border-primary shadow-primary/20',
      )}
      data-testid="langflow-agent-node"
    >
      <div className="flex items-start justify-between gap-3 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {nodeIcon(data.kind)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{data.title}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{data.subtitle}</div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {data.executionStage && (
            <Badge variant="outline" className="text-[10px]">
              第 {data.executionStage} 步
            </Badge>
          )}
          <StatusBadge status={data.status} />
        </div>
      </div>

      <div className="px-3 py-2">
        <p className="line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">{data.description}</p>

        <div className="mt-3 grid gap-2">
          {data.inputs.map((input) => {
            const isInputCompatible = !data.connectionType || canConnect(data.connectionType, input.type)

            return (
              <div
                key={input.id}
                className={cn(
                  'relative flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 transition',
                  data.connectionType && isInputCompatible && 'border-emerald-400 bg-emerald-500/10',
                  data.connectionType && !isInputCompatible && 'opacity-35 grayscale',
                )}
                data-port-compatible={isInputCompatible}
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={inputHandleId(input)}
                  className="!size-3 !border-2 !border-background"
                  style={{ backgroundColor: artifactColors[input.type], left: -7 }}
                />
                <span className="min-w-0 flex-1 truncate text-[11px]">{input.label}</span>
                <ArtifactPill type={input.type} />
              </div>
            )
          })}

          {data.outputs.map((output) => (
            <div
              key={output.id}
              className="relative flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
              data-output-port-type={output.type}
              onMouseDownCapture={() => data.onOutputConnectStart?.(output.type)}
              onPointerDownCapture={() => data.onOutputConnectStart?.(output.type)}
            >
              <ArtifactPill type={output.type} />
              <span className="min-w-0 flex-1 truncate text-[11px]">{output.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={outputHandleId(output)}
                className="!size-3 !border-2 !border-background"
                onMouseDownCapture={() => data.onOutputConnectStart?.(output.type)}
                onPointerDownCapture={() => data.onOutputConnectStart?.(output.type)}
                style={{ backgroundColor: artifactColors[output.type], right: -7 }}
              />
            </div>
          ))}
        </div>
      </div>

      {data.customerVisible && (
        <div className="border-t bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
          客户可以看到这个节点的产物
        </div>
      )}
    </div>
  )
}

function AgentArtifactEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data, selected }: EdgeProps<AgentFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY })
  const type = data?.artifactType ?? 'any'
  const selectThisEdge = (event: PointerEvent<SVGGElement | SVGPathElement>) => {
    event.stopPropagation()
    window.dispatchEvent(new CustomEvent('agenthub:canvas-edge-select', { detail: { edgeId: id } }))
  }

  return (
    <g data-testid="langflow-agent-edge" data-edge-artifact-type={type} onPointerDown={selectThisEdge}>
      <path
        d={edgePath}
        className="react-flow__edge-interaction"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0}
        strokeWidth={24}
        style={{ pointerEvents: 'all' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: artifactColors[type], strokeWidth: selected ? 4 : 2.4 }}
      />
      <foreignObject x={labelX - 38} y={labelY - 12} width={76} height={24}>
        <div className="rounded-full border bg-background px-2 py-1 text-center text-[10px] shadow-sm">
          {artifactLabels[type]}
        </div>
      </foreignObject>
    </g>
  )
}

function EdgeConfigPanel({
  edge,
  nodes,
  onDeleteEdge,
}: {
  edge: AgentFlowEdge
  nodes: AgentFlowNode[]
  onDeleteEdge: () => void
}) {
  const route = describeEdgeRoute(edge, nodes)

  return (
    <aside
      className="h-full min-h-0 overflow-y-auto rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur"
      data-testid="langflow-agent-edge-panel"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch className="size-4 text-primary" />
            交付连线
          </div>
          <div className="mt-1 text-xs text-muted-foreground">这条线决定下游节点实际收到哪一种产物。</div>
        </div>
        <Button type="button" size="sm" variant="destructive" className="h-8" onClick={onDeleteEdge}>
          删除
        </Button>
      </div>

      {!route ? (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          这条连线引用的节点或端口已经不存在，可以删除后重新连接。
        </div>
      ) : (
        <div className="space-y-3">
          <PanelBlock title="交付产物">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{artifactLabels[route.artifactType]}</div>
              <ArtifactPill type={route.artifactType} />
            </div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              下游节点只会收到这个产物类型，不会自动拿到上游节点的其他文件、视频、代码或报告。
            </div>
          </PanelBlock>

          <PanelBlock title="来源端口">
            <div className="text-sm font-semibold">{route.sourceTitle}</div>
            <div className="mt-1 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">{route.sourcePortLabel}</div>
            <div className="mt-2 break-all text-[11px] text-muted-foreground">sourceHandle: {edge.sourceHandle ?? '默认输出'}</div>
          </PanelBlock>

          <PanelBlock title="目标端口">
            <div className="text-sm font-semibold">{route.targetTitle}</div>
            <div className="mt-1 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">{route.targetPortLabel}</div>
            <div className="mt-2 break-all text-[11px] text-muted-foreground">targetHandle: {edge.targetHandle ?? '默认输入'}</div>
          </PanelBlock>
        </div>
      )}
    </aside>
  )
}

function NodeConfigPanel({
  node,
  agents,
  softwareCommands,
  onUpdateNode,
  onDeleteNode,
  addPortToNode,
  removePortFromNode,
  changePortTypeForNode,
}: {
  node: AgentFlowNode | null
  agents: AgentProfileRow[]
  softwareCommands: SoftwareCommandRow[]
  onUpdateNode: (nodeId: string, patch: Partial<AgentFlowNodeData>) => void
  onDeleteNode: () => void
  addPortToNode: (nodeId: string, direction: 'inputs' | 'outputs') => void
  removePortFromNode: (nodeId: string, direction: 'inputs' | 'outputs', portId: string) => void
  changePortTypeForNode: (nodeId: string, direction: 'inputs' | 'outputs', portId: string, nextType: ArtifactType) => void
}) {
  if (!node) {
    return (
      <aside className="h-full rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur">
        <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          选中一个节点后，在这里配置它使用哪个 Agent、接收什么产物、输出什么交付物。
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="h-full min-h-0 overflow-y-auto rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur"
      data-testid="langflow-agent-node-panel"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="size-4 text-primary" />
            节点配置
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{nodeKindLabels[node.data.kind]}</div>
        </div>
        <Button type="button" size="sm" variant="destructive" className="h-8" onClick={onDeleteNode}>
          删除
        </Button>
      </div>

      <div className="space-y-3">
        <PanelBlock title="基础信息">
          <Input value={node.data.title} onChange={(event) => onUpdateNode(node.id, { title: event.target.value })} />
          <Textarea
            className="mt-2 min-h-20 text-xs"
            value={node.data.description}
            onChange={(event) => onUpdateNode(node.id, { description: event.target.value })}
          />
        </PanelBlock>

        {node.data.kind === 'agent' && (
          <PanelBlock title="选择员工 Agent">
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={node.data.agentId ?? ''}
              onChange={(event) => {
                const agent = agents.find((item) => item.id === event.target.value)
                onUpdateNode(node.id, {
                  agentId: agent?.id,
                  title: agent?.name ?? node.data.title,
                  subtitle: agent ? `员工 Agent · ${agent.modelProfileId ?? '未绑定模型'}` : node.data.subtitle,
                })
              }}
            >
              <option value="">未指定，运行时自动选择</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} / {agent.role}
                </option>
              ))}
            </select>
          </PanelBlock>
        )}

        {node.data.kind === 'tool' && (
          <PanelBlock title="选择工具 / 软件命令">
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={node.data.softwareCommandId ?? ''}
              onChange={(event) => {
                const command = softwareCommands.find((item) => item.id === event.target.value)
                onUpdateNode(node.id, {
                  softwareCommandId: command?.id,
                  title: command?.name ?? node.data.title,
                  subtitle: command ? `软件命令 · ${command.riskLevel}` : node.data.subtitle,
                })
              }}
            >
              <option value="">未选择命令</option>
              {softwareCommands.map((command) => (
                <option key={command.id} value={command.id}>
                  {command.name}
                </option>
              ))}
            </select>
          </PanelBlock>
        )}

        <PanelBlock title="输入端口">
          <PortEditor
            ports={node.data.inputs}
            direction="inputs"
            addLabel="新增输入"
            onTypeChange={(portId, direction, type) => changePortTypeForNode(node.id, direction, portId, type)}
            onAddPort={() => addPortToNode(node.id, 'inputs')}
            onRemovePort={(portId) => removePortFromNode(node.id, 'inputs', portId)}
          />
        </PanelBlock>

        <PanelBlock title="输出端口">
          <PortEditor
            ports={node.data.outputs}
            direction="outputs"
            addLabel="新增输出"
            onTypeChange={(portId, direction, type) => changePortTypeForNode(node.id, direction, portId, type)}
            onAddPort={() => addPortToNode(node.id, 'outputs')}
            onRemovePort={(portId) => removePortFromNode(node.id, 'outputs', portId)}
          />
          <div className="mt-2 text-[11px] leading-4 text-muted-foreground">
            从某个输出端口拉线，下游只收到这个端口代表的产物。
          </div>
        </PanelBlock>

        <PanelBlock title="交付逻辑">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(node.data.customerVisible)}
              onChange={(event) => onUpdateNode(node.id, { customerVisible: event.target.checked })}
            />
            这个节点产物客户可见
          </label>
        </PanelBlock>
      </div>
    </aside>
  )
}

function PortEditor({
  ports,
  direction,
  addLabel,
  onTypeChange,
  onAddPort,
  onRemovePort,
}: {
  ports: AgentFlowPort[]
  direction: 'inputs' | 'outputs'
  addLabel: string
  onTypeChange: (portId: string, direction: 'inputs' | 'outputs', type: ArtifactType) => void
  onAddPort: () => void
  onRemovePort: (portId: string) => void
}) {
  return (
    <div className="space-y-2">
      {ports.length === 0 && <div className="text-xs text-muted-foreground">这个节点没有端口。</div>}
      {ports.map((port) => (
        <div key={port.id} className="grid grid-cols-[minmax(0,1fr)_6.5rem_2rem] gap-2">
          <div className="truncate rounded-md border bg-background px-2 py-1.5 text-xs">{port.label}</div>
          <select
            className="rounded-md border bg-background px-2 text-xs"
            value={port.type}
            onChange={(event) => onTypeChange(port.id, direction, event.target.value as ArtifactType)}
          >
            {Object.entries(artifactLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-0 text-xs"
            onClick={() => onRemovePort(port.id)}
          >
            ×
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-8 w-full gap-1 text-xs" onClick={onAddPort}>
        <Plus className="size-3" />
        {addLabel}
      </Button>
    </div>
  )
}

function HandoffPreviewPanel({ steps, visible }: { steps: HandoffStep[]; visible: boolean }) {
  return (
    <section
      className={cn(
        'pointer-events-auto absolute bottom-3 left-[18.5rem] right-[23.5rem] z-10 rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur',
        !visible && 'opacity-95',
      )}
      data-testid="handoff-preview-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="size-4 text-primary" />
          交付链路
        </div>
        <Badge variant="outline">{steps.length} 条</Badge>
      </div>
      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          从一个输出端口拖到下游输入端口后，这里会显示真实交付关系。
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {steps.slice(0, 6).map((step) => (
            <div key={step.id} className="rounded-lg border bg-background p-2 text-xs">
              <div className="truncate font-medium">{step.sourceTitle}</div>
              <div className="my-1 flex items-center gap-2 text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <ArtifactPill type={step.artifactType} />
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="truncate font-medium">{step.targetTitle}</div>
            </div>
          ))}
        </div>
      )}
      {steps.length > 6 && (
        <div className="mt-2 text-[11px] text-muted-foreground">还有 {steps.length - 6} 条链路，运行记录里会完整展开。</div>
      )}
    </section>
  )
}

function PanelBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-background p-3">
      <div className="mb-2 text-xs font-semibold">{title}</div>
      {children}
    </section>
  )
}

function ArtifactPill({ type }: { type: ArtifactType }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-medium text-white"
      style={{ backgroundColor: artifactColors[type] }}
    >
      {artifactLabels[type]}
    </span>
  )
}

function StatusBadge({ status }: { status: AgentFlowNodeData['status'] }) {
  const labels: Record<AgentFlowNodeData['status'], string> = {
    idle: '待运行',
    running: '运行中',
    done: '已完成',
    blocked: '卡住',
  }
  return <Badge variant={status === 'blocked' ? 'destructive' : status === 'done' ? 'default' : 'outline'}>{labels[status]}</Badge>
}

function nodeIcon(kind: AgentFlowNodeKind) {
  if (kind === 'agent') return <Bot className="size-4" />
  if (kind === 'tool') return <Wrench className="size-4" />
  if (kind === 'approval') return <ClipboardCheck className="size-4" />
  if (kind === 'artifact') return <CheckCircle2 className="size-4" />
  return <Sparkles className="size-4" />
}

function createFlowNode(
  kind: AgentFlowNodeKind,
  position: { x: number; y: number },
  title = nodeKindLabels[kind],
  overrides: Partial<AgentFlowNodeData> = {},
  fixedId?: string,
): AgentFlowNode {
  const id = fixedId ?? `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    type: 'agentFlowNode',
    position,
    data: {
      kind,
      title,
      subtitle: nodeKindLabels[kind],
      description: overrides.description ?? defaultDescription(kind),
      status: 'idle',
      inputs: defaultInputs(kind),
      outputs: defaultOutputs(kind),
      customerVisible: kind === 'artifact',
      ...overrides,
    },
  }
}

function createFlowEdge(
  id: string,
  source: string,
  target: string,
  outputId: string,
  artifactType: ArtifactType,
  sourceHandle = `out:${outputId}`,
  targetHandle = `in:${artifactType}`,
): AgentFlowEdge {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'agentArtifact',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      artifactType,
      outputId,
      label: artifactLabels[artifactType],
    },
  }
}

function defaultInputs(kind: AgentFlowNodeKind): AgentFlowPort[] {
  if (kind === 'input') return []
  if (kind === 'artifact') return [{ id: 'report', label: '接收产物', type: 'report' }]
  if (kind === 'approval') return [{ id: 'document', label: '待确认内容', type: 'document' }]
  return [{ id: 'message', label: '上游输入', type: 'message' }]
}

function defaultOutputs(kind: AgentFlowNodeKind): AgentFlowPort[] {
  if (kind === 'artifact') return []
  if (kind === 'input') return [{ id: 'message', label: '客户消息', type: 'message' }]
  if (kind === 'tool') return [{ id: 'file_bundle', label: '工具结果', type: 'file_bundle' }]
  if (kind === 'approval') return [{ id: 'document', label: '确认结果', type: 'document' }]
  return [{ id: 'report', label: '报告', type: 'report' }]
}

function defaultDescription(kind: AgentFlowNodeKind) {
  const map: Record<AgentFlowNodeKind, string> = {
    input: '接收用户目标、素材和上下文。',
    agent: '调用一个员工级 Agent，完成规划、执行和验证。',
    tool: '调用已经接入的 CLI、MCP 或桌面软件能力。',
    approval: '在高风险动作前暂停，让用户确认是否继续。',
    artifact: '汇总客户最终可以看到的交付产物。',
  }
  return map[kind]
}

function inputHandleId(port: AgentFlowPort) {
  return `in:${port.id}`
}

function outputHandleId(port: AgentFlowPort) {
  return `out:${port.id}`
}

function buildHandoffSteps(nodes: AgentFlowNode[], edges: AgentFlowEdge[]): HandoffStep[] {
  return edges.flatMap((edge) => {
    const source = nodes.find((node) => node.id === edge.source)
    const target = nodes.find((node) => node.id === edge.target)
    const artifactType = edge.data?.artifactType
    if (!source || !target || !artifactType) return []

    return [{
      id: edge.id,
      sourceId: source.id,
      targetId: target.id,
      sourceTitle: source.data.title,
      targetTitle: target.data.title,
      artifactType,
      artifactLabel: artifactLabels[artifactType],
    }]
  })
}

function buildExecutionStages(nodes: AgentFlowNode[], edges: AgentFlowEdge[]) {
  const incomingCount = new Map(nodes.map((node) => [node.id, 0]))
  const remainingIncoming = new Map(incomingCount)
  const outgoing = new Map<string, string[]>()
  const stages = new Map<string, number>()

  for (const edge of edges) {
    if (!incomingCount.has(edge.source) || !incomingCount.has(edge.target)) continue
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
    remainingIncoming.set(edge.target, (remainingIncoming.get(edge.target) ?? 0) + 1)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  }

  const queue = nodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    .map((node) => node.id)

  for (const nodeId of queue) stages.set(nodeId, 1)

  for (let index = 0; index < queue.length; index += 1) {
    const sourceId = queue[index]
    const sourceStage = stages.get(sourceId) ?? 1
    for (const targetId of outgoing.get(sourceId) ?? []) {
      stages.set(targetId, Math.max(stages.get(targetId) ?? 1, sourceStage + 1))
      remainingIncoming.set(targetId, Math.max((remainingIncoming.get(targetId) ?? 1) - 1, 0))
      if (remainingIncoming.get(targetId) === 0) queue.push(targetId)
    }
  }

  for (const node of nodes) {
    if (!stages.has(node.id)) stages.set(node.id, 1)
  }

  return stages
}

function describeEdgeRoute(edge: AgentFlowEdge, nodes: AgentFlowNode[]): EdgeRoute | null {
  const source = nodes.find((node) => node.id === edge.source)
  const target = nodes.find((node) => node.id === edge.target)
  if (!source || !target) return null

  const sourcePort = findPortByHandle(source, 'outputs', edge.sourceHandle)
  const targetPort = findPortByHandle(target, 'inputs', edge.targetHandle)
  const artifactType = edge.data?.artifactType ?? sourcePort?.type ?? 'any'

  return {
    sourceTitle: source.data.title,
    sourcePortLabel: sourcePort?.label ?? edge.data?.label ?? artifactLabels[artifactType],
    targetTitle: target.data.title,
    targetPortLabel: targetPort?.label ?? artifactLabels[artifactType],
    artifactType,
  }
}

function findPortByHandle(
  node: AgentFlowNode,
  direction: 'inputs' | 'outputs',
  handleId?: string | null,
) {
  if (!handleId) return null
  const ports = node.data[direction]
  return ports.find((port) => (direction === 'inputs' ? inputHandleId(port) : outputHandleId(port)) === handleId) ?? null
}

function loadCanvasDraft(): CanvasDraft | null {
  const raw = window.localStorage.getItem(CANVAS_DRAFT_STORAGE_KEY)
  if (!raw) return null

  try {
    const draft = JSON.parse(raw) as Partial<CanvasDraft> | null
    if (draft?.schema !== 'agenthub.langflow_agent_canvas.v1') return null
    if (!Array.isArray(draft.nodes) || !Array.isArray(draft.edges)) return null

    return draft as CanvasDraft
  } catch {
    return null
  }
}

function findPortType(
  nodes: AgentFlowNode[],
  nodeId: string,
  direction: 'inputs' | 'outputs',
  handleId?: string | null,
) {
  const node = nodes.find((item) => item.id === nodeId)
  if (!node || !handleId) return null
  const ports = node.data[direction]
  const match = ports.find((port) => (direction === 'inputs' ? inputHandleId(port) : outputHandleId(port)) === handleId)
  return match?.type ?? null
}

function canConnect(sourceType: ArtifactType, targetType: ArtifactType) {
  if (targetType === 'any') return true
  if (sourceType === 'any') return false
  return canConnectPortKinds(sourceType, targetType)
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function isAgentFlowNodeKind(value: string): value is AgentFlowNodeKind {
  return value === 'input' || value === 'agent' || value === 'tool' || value === 'approval' || value === 'artifact'
}

const nodeTypes = { agentFlowNode: AgentFlowNodeCard }
const edgeTypes = { agentArtifact: AgentArtifactEdge }

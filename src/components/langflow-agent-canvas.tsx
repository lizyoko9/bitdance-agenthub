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
  GitBranch,
  Play,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AgentProfileRow, SoftwareCommandRow } from '@/db/schema'
import { buildAgentFlowPortsFromContracts } from '@/lib/agent-flow-agent-contracts'
import {
  findFirstCompatiblePortPair,
  replaceEdgesForSingleTargetHandle,
  wouldCreateDirectedCycle,
} from '@/lib/agent-flow-graph'
import { applyPreflightStatusToNodes } from '@/lib/agent-flow-node-status'
import { buildAgentFlowRunPlan, type AgentFlowRunPlanStep } from '@/lib/agent-flow-run-plan'
import { validateAgentFlowForRun, type AgentFlowRunIssue } from '@/lib/agent-flow-run-preflight'
import { buildSoftwareCommandFlowPorts } from '@/lib/agent-flow-software-command-contracts'
import {
  agentFlowNodeTemplates,
  cloneTemplatePorts,
  getAgentFlowNodeTemplate,
  getAgentFlowNodeTemplateGroups,
  type AgentFlowNodeKind,
  type AgentFlowNodeTemplateCategory,
  type AgentFlowTemplatePortKind,
} from '@/lib/agent-flow-node-templates'
import { fetchAgentProfiles, fetchSoftwareCommands } from '@/lib/api'
import {
  LANGFLOW_PORT_KIND_LABELS,
  canConnectPortKinds,
} from '@/lib/langflow-port-contracts'
import { cn } from '@/lib/utils'

type ArtifactType = AgentFlowTemplatePortKind

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
type AgentFlowEdge = Edge<{
  artifactType: ArtifactType
  label: string
  outputId: string
  sourcePortId: string
  targetPortId: string
  sourcePortLabel: string
  targetPortLabel: string
  handoffContract: string
}>

interface HandoffStep {
  id: string
  sourceId: string
  targetId: string
  sourceTitle: string
  targetTitle: string
  artifactType: ArtifactType
  artifactLabel: string
  sourcePortLabel: string
  targetPortLabel: string
  handoffContract: string
}

interface CanvasDraft {
  schema: 'agenthub.langflow_agent_canvas.v1'
  workflowDraftId?: string
  title?: string
  savedAt: string
  initialWorkflowId: string | null
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
  handoffSteps?: HandoffStep[]
}

interface CanvasRunRecord {
  schema: 'agenthub.langflow_agent_canvas.run.v1'
  id: string
  workflowDraftId: string
  workflowTitle: string
  status: 'complete'
  source: 'local_canvas_run'
  startedAt: number
  finishedAt: number
  nodeCount: number
  edgeCount: number
  handoffCount: number
  steps: Array<{
    nodeId: string
    title: string
    stage: number
    incomingContracts: string[]
    outgoingContracts: string[]
  }>
}

interface EdgeRoute {
  sourceTitle: string
  sourcePortLabel: string
  targetTitle: string
  targetPortLabel: string
  artifactType: ArtifactType
  handoffContract: string
}

interface CanvasWorkflowPreset {
  id: 'report-delivery' | 'content-video' | 'code-delivery'
  name: string
  description: string
  deliverableTemplateId: string
  artifactType: ArtifactType
  badge: string
}

const CANVAS_DRAFT_STORAGE_KEY = 'agenthub.langflow-agent-canvas.draft'
const CANVAS_DRAFT_LIBRARY_STORAGE_KEY = 'agenthub.langflow-agent-canvas.library'
const CANVAS_RUN_HISTORY_STORAGE_KEY = 'agenthub.langflow-agent-canvas.runs'
const NODE_TEMPLATE_MIME = 'application/agenthub-node-template'
const CANVAS_FIT_VIEW_PADDING = 0.42
const CANVAS_FIT_VIEW_MAX_ZOOM = 0.5

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
  prompt: '提示词',
  model: '模型',
  memory: '记忆',
  agent: '员工 Agent',
  tool: '工具 / 软件',
  approval: '人工确认',
  artifact: '交付产物',
}

const initialNodes: AgentFlowNode[] = [
  createNodeFromTemplate('customer-request', { x: 40, y: 120 }, {
    description: '收集客户目标、文件和约束。',
  }, 'input-1'),
  createNodeFromTemplate('employee-agent', { x: 420, y: 120 }, {
    description: '根据目标完成分析、执行和验证。',
  }, 'agent-2'),
  createNodeFromTemplate('customer-deliverable', { x: 820, y: 120 }, {
    description: '只接收上一节点连过来的指定产物。',
    customerVisible: true,
  }, 'artifact-3'),
]

const initialEdges: AgentFlowEdge[] = [
  createFlowEdge('customer-to-agent', 'input-1', 'agent-2', 'message', 'message'),
  createFlowEdge('agent-to-delivery', 'agent-2', 'artifact-3', 'report', 'report'),
]

const canvasWorkflowPresets: CanvasWorkflowPreset[] = [
  {
    id: 'report-delivery',
    name: '报告交付流程',
    description: '客户需求进来后，让员工 Agent 产出一份客户可见报告。',
    deliverableTemplateId: 'customer-deliverable',
    artifactType: 'report',
    badge: '报告',
  },
  {
    id: 'content-video',
    name: '视频交付流程',
    description: '客户给目标和素材，员工 Agent 只把视频产物交给下游。',
    deliverableTemplateId: 'video-deliverable',
    artifactType: 'video',
    badge: '视频',
  },
  {
    id: 'code-delivery',
    name: '代码交付流程',
    description: '客户提出开发目标，员工 Agent 交付源码、Diff 或脚本。',
    deliverableTemplateId: 'code-deliverable',
    artifactType: 'code',
    badge: '代码',
  },
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
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentFlowNode>(cloneCanvasNodes(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState<AgentFlowEdge>(cloneCanvasEdges(initialEdges))
  const [selectedNodeId, setSelectedNodeId] = useState('agent-2')
  const [selectedEdgeId, setSelectedEdgeId] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [preflightVisible, setPreflightVisible] = useState(false)
  const [preflightIssues, setPreflightIssues] = useState<AgentFlowRunIssue[]>([])
  const [lastRun, setLastRun] = useState<CanvasRunRecord | null>(null)
  const [activeConnectionType, setActiveConnectionType] = useState<ArtifactType | null>(null)
  const [activeTemplateCategory, setActiveTemplateCategory] = useState<AgentFlowNodeTemplateCategory | '全部'>('全部')
  const [templateSearchQuery, setTemplateSearchQuery] = useState('')
  const [workflowDraftId, setWorkflowDraftId] = useState(() => initialWorkflowId ?? createCanvasDraftId())
  const [workflowTitle, setWorkflowTitle] = useState(() => initialWorkflowId ? `流程 ${initialWorkflowId}` : '新建流程')
  const [savedDrafts, setSavedDrafts] = useState<CanvasDraft[]>([])
  const { screenToFlowPosition } = useReactFlow<AgentFlowNode, AgentFlowEdge>()
  const templateGroups = useMemo(() => getAgentFlowNodeTemplateGroups(agentFlowNodeTemplates), [])
  const filteredTemplateGroups = useMemo(() => {
    const search = templateSearchQuery.trim().toLowerCase()
    return templateGroups
      .filter((group) => activeTemplateCategory === '全部' || group.category === activeTemplateCategory)
      .map((group) => ({
        ...group,
        templates: group.templates.filter((template) => {
          if (activeConnectionType && !templateAcceptsConnectionType(template, activeConnectionType)) return false
          if (search && !matchesTemplateSearch(template, search)) return false
          return true
        }),
      }))
      .filter((group) => group.templates.length > 0)
  }, [activeConnectionType, activeTemplateCategory, templateGroups, templateSearchQuery])

  const applyCanvasDraft = useCallback((draft: CanvasDraft) => {
    setNodes(cloneCanvasNodes(draft.nodes))
    setEdges(cloneCanvasEdges(draft.edges))
    setSelectedNodeId(draft.nodes[0]?.id ?? '')
    setSelectedEdgeId('')
    setPreflightVisible(Boolean(draft.handoffSteps?.length))
    setPreflightIssues([])
    setLastRun(findLatestCanvasRunForDraft(loadCanvasRunHistory(), draft.workflowDraftId))
    setWorkflowDraftId(draft.workflowDraftId ?? createCanvasDraftId())
    setWorkflowTitle(draft.title?.trim() || '未命名流程')
  }, [setEdges, setNodes])

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
    const library = loadCanvasDraftLibrary()
    setSavedDrafts(library)

    const draft = findCanvasDraftById(library, initialWorkflowId) ?? loadCanvasDraft() ?? library[0]
    if (!draft) return

    applyCanvasDraft(draft)
    window.localStorage.setItem(CANVAS_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    setNotice(`已恢复本地草稿：${draft.nodes.length} 个节点、${draft.edges.length} 条连线。`)
  }, [applyCanvasDraft, initialWorkflowId])

  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null
  const handoffSteps = useMemo(() => buildHandoffSteps(nodes, edges), [edges, nodes])
  const executionPlan = useMemo(() => buildAgentFlowRunPlan({ nodes, edges }), [edges, nodes])
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

  const addNodeFromTemplate = useCallback((templateId: string, position?: { x: number; y: number }) => {
    const nextIndex = nodes.length + 1
    if (!getAgentFlowNodeTemplate(templateId)) {
      setNotice('没有找到这个节点模板，先换一个模板试试。')
      return
    }
    const sourceNode = nodes.find((item) => item.id === selectedNodeId)
    const fallbackPosition = sourceNode
      ? { x: sourceNode.position.x + 360, y: sourceNode.position.y }
      : { x: 160 + nextIndex * 54, y: 120 + nextIndex * 28 }
    const node = createNodeFromTemplate(templateId, position ?? fallbackPosition)
    const autoPair = sourceNode
      ? findFirstCompatiblePortPair({
          sourceOutputs: sourceNode.data.outputs,
          targetInputs: node.data.inputs,
          canConnect,
        })
      : null

    setNodes((current) => [...current, node])
    if (sourceNode && autoPair) {
      const edge = createFlowEdge(
        `auto-${sourceNode.id}-${node.id}-${Date.now()}`,
        sourceNode.id,
        node.id,
        autoPair.sourcePort.id,
        autoPair.sourcePort.type,
        outputHandleId(autoPair.sourcePort),
        inputHandleId(autoPair.targetPort),
        autoPair.sourcePort.label,
        autoPair.targetPort.id,
        autoPair.targetPort.label,
      )
      setEdges((current) => replaceEdgesForSingleTargetHandle(current, edge))
      setNotice(`已把 ${sourceNode.data.title} 的 ${autoPair.sourcePort.label} 接到 ${node.data.title}。`)
    } else if (sourceNode) {
      setNotice('已添加节点，但它没有能直接接收当前节点产物的输入端口。')
    }
    setSelectedNodeId(node.id)
    setSelectedEdgeId('')
  }, [nodes, selectedNodeId, setEdges, setNodes])

  const handlePaletteDragStart = useCallback((event: DragEvent<HTMLButtonElement>, templateId: string) => {
    event.dataTransfer.setData(NODE_TEMPLATE_MIME, templateId)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleCanvasDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const templateId = event.dataTransfer.getData(NODE_TEMPLATE_MIME)
    if (!getAgentFlowNodeTemplate(templateId)) return

    addNodeFromTemplate(templateId, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [addNodeFromTemplate, screenToFlowPosition])

  const handleConnectStart = useCallback((_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
    if (params.handleType !== 'source' || !params.nodeId || !params.handleId) {
      setActiveConnectionType(null)
      return
    }

    const source = nodes.find((node) => node.id === params.nodeId)
    const output = source?.data.outputs.find((item) => outputHandleId(item) === params.handleId)
    setActiveConnectionType(output?.type ?? null)
  }, [nodes])

  const isConnectionValid = useCallback((connection: Connection | AgentFlowEdge) => {
    if (!connection.source || !connection.target) return false
    const source = nodes.find((node) => node.id === connection.source)
    const target = nodes.find((node) => node.id === connection.target)
    const output = source?.data.outputs.find((item) => outputHandleId(item) === connection.sourceHandle)
    const input = target?.data.inputs.find((item) => inputHandleId(item) === connection.targetHandle)

    if (!source || !target || !output || !input) return false
    if (wouldCreateDirectedCycle(edges, { source: connection.source, target: connection.target })) return false
    return canConnect(output.type, input.type)
  }, [edges, nodes])

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
              sourcePortId: edge.data?.sourcePortId ?? portId,
              targetPortId: edge.data?.targetPortId ?? edge.targetHandle?.replace(/^in:/, '') ?? nextType,
              sourcePortLabel: artifactLabels[nextType],
              targetPortLabel: edge.data?.targetPortLabel ?? artifactLabels[targetInputType ?? nextType],
              handoffContract: `${artifactLabels[nextType]}: ${artifactLabels[nextType]} -> ${
                edge.data?.targetPortLabel ?? artifactLabels[targetInputType ?? nextType]
              }`,
            },
          }]
        }

        if (direction === 'inputs' && edge.target === nodeId && edge.targetHandle === changedHandle) {
          if (!canConnect(edge.data?.artifactType ?? 'any', nextType)) return []
          return [{
            ...edge,
            data: edge.data
              ? {
                  ...edge.data,
                  targetPortId: portId,
                  targetPortLabel: artifactLabels[nextType],
                  handoffContract: `${artifactLabels[edge.data.artifactType]}: ${edge.data.sourcePortLabel} -> ${artifactLabels[nextType]}`,
                }
              : edge.data,
          }]
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

  const replaceNodePortsForAgent = useCallback((nodeId: string, agent: AgentProfileRow) => {
    const agentPorts = buildAgentFlowPortsFromContracts(agent)
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                agentId: agent.id,
                title: agent.name,
                subtitle: `员工 Agent · ${agent.modelProfileId ?? '未绑定模型'}`,
                inputs: agentPorts.inputs,
                outputs: agentPorts.outputs,
              },
            }
          : node,
      ),
    )
    setEdges((current) => keepEdgesWithKnownHandles(current, nodeId, agentPorts.inputs, agentPorts.outputs))
  }, [setEdges, setNodes])

  const replaceNodePortsForSoftwareCommand = useCallback((nodeId: string, command: SoftwareCommandRow) => {
    const commandPorts = buildSoftwareCommandFlowPorts(command)
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                softwareCommandId: command.id,
                title: command.name,
                subtitle: `软件命令 · ${command.riskLevel}`,
                inputs: commandPorts.inputs,
                outputs: commandPorts.outputs,
              },
            }
          : node,
      ),
    )
    setEdges((current) => keepEdgesWithKnownHandles(current, nodeId, commandPorts.inputs, commandPorts.outputs))
  }, [setEdges, setNodes])

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

  const clearSelectedNodes = useCallback(() => {
    setNodes((current) => current.map((item) => item.selected ? { ...item, selected: false } : item))
  }, [setNodes])

  const selectNodeById = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setSelectedEdgeId('')
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === nodeId })))
    setEdges((current) => current.map((item) => ({ ...item, selected: false })))
  }, [setEdges, setNodes])

  const selectEdgeById = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId)
    setSelectedNodeId('')
    clearSelectedNodes()
    setEdges((current) => current.map((item) => ({ ...item, selected: item.id === edgeId })))
  }, [clearSelectedNodes, setEdges])

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

      setEdges((current) =>
        replaceEdgesForSingleTargetHandle(
          current,
          createFlowEdge(
            `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
            connection.source,
            connection.target,
            output.id,
            output.type,
            connection.sourceHandle ?? undefined,
            connection.targetHandle ?? undefined,
            output.label,
            input.id,
            input.label,
          ),
        ),
      )
      setNotice(`${target.data.title} 现在只会收到：${artifactLabels[output.type]}。`)
    },
    [edges, nodes],
  )

  const runPreflight = useCallback(() => {
    setPreflightVisible(true)

    const preflight = validateAgentFlowForRun({ nodes, edges })
    setPreflightIssues(preflight.issues)
    setNodes((current) => applyPreflightStatusToNodes({ nodes: current, edges, preflight }))
    if (!preflight.ready) {
      const firstError = preflight.issues.find((issue) => issue.severity === 'error')
      setNotice(`预检未通过：${firstError?.message ?? '流程配置还有阻塞项。'}`)
      return
    }

    const startedAt = Date.now()
    const run: CanvasRunRecord = {
      schema: 'agenthub.langflow_agent_canvas.run.v1',
      id: `local-run-${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
      workflowDraftId,
      workflowTitle: workflowTitle.trim() || '未命名流程',
      status: 'complete',
      source: 'local_canvas_run',
      startedAt,
      finishedAt: startedAt,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      handoffCount: handoffSteps.length,
      steps: executionPlan.map((step) => ({
        nodeId: step.nodeId,
        title: step.title,
        stage: step.stage,
        incomingContracts: step.incomingContracts,
        outgoingContracts: step.outgoingContracts,
      })),
    }
    saveCanvasRunHistory(upsertCanvasRunHistory(loadCanvasRunHistory(), run))
    setLastRun(run)

    const firstWarning = preflight.issues.find((issue) => issue.severity === 'warning')
    setNotice(
      `预检完成并记录一次本地试运行：${handoffSteps.length} 条交付链路可运行${
        firstWarning ? `，${preflight.warningCount} 个提醒：${firstWarning.message}` : '。'
      }`,
    )
  }, [edges, executionPlan, handoffSteps.length, nodes, workflowDraftId, workflowTitle])

  const saveWorkflowDraftToLibrary = useCallback((draft: CanvasDraft) => {
    window.localStorage.setItem(CANVAS_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    const nextLibrary = upsertCanvasDraft(loadCanvasDraftLibrary(), draft)
    saveCanvasDraftLibrary(nextLibrary)
    setSavedDrafts(nextLibrary)
    return nextLibrary
  }, [])

  const saveCanvasDraft = useCallback(() => {
    const title = workflowTitle.trim() || '未命名流程'
    const draftId = workflowDraftId || createCanvasDraftId()
    const draft: CanvasDraft = {
      schema: 'agenthub.langflow_agent_canvas.v1',
      workflowDraftId: draftId,
      title,
      savedAt: new Date().toISOString(),
      initialWorkflowId: initialWorkflowId ?? null,
      nodes,
      edges,
      handoffSteps,
    }

    saveWorkflowDraftToLibrary(draft)
    setWorkflowDraftId(draftId)
    setWorkflowTitle(title)
    setNotice(`流程已保存：${title}，${nodes.length} 个节点、${edges.length} 条连线。`)
  }, [edges, handoffSteps, initialWorkflowId, nodes, saveWorkflowDraftToLibrary, workflowDraftId, workflowTitle])

  const openSavedCanvasDraft = useCallback((draftId: string) => {
    const draft = savedDrafts.find((item) => item.workflowDraftId === draftId)
    if (!draft) return
    applyCanvasDraft(draft)
    window.localStorage.setItem(CANVAS_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    setNotice(`已打开流程：${draft.title ?? '未命名流程'}。`)
  }, [applyCanvasDraft, savedDrafts])

  const createNewCanvasDraft = useCallback(() => {
    const nextId = createCanvasDraftId()
    setWorkflowDraftId(nextId)
    setWorkflowTitle('新建流程')
    setNodes(cloneCanvasNodes(initialNodes))
    setEdges(cloneCanvasEdges(initialEdges))
    setSelectedNodeId('agent-2')
    setSelectedEdgeId('')
    setPreflightVisible(false)
    setPreflightIssues([])
    setLastRun(null)
    setNotice('已新建空白流程，可直接拖拽节点开始编排。')
  }, [setEdges, setNodes])

  const applyWorkflowPreset = useCallback((presetId: CanvasWorkflowPreset['id']) => {
    const draft = createCanvasWorkflowPresetDraft(presetId, initialWorkflowId ?? null)
    setWorkflowDraftId(draft.workflowDraftId ?? createCanvasDraftId())
    setWorkflowTitle(draft.title ?? '新建流程')
    setNodes(cloneCanvasNodes(draft.nodes))
    setEdges(cloneCanvasEdges(draft.edges))
    setSelectedNodeId(draft.nodes.find((node) => node.data.kind === 'agent')?.id ?? draft.nodes[0]?.id ?? '')
    setSelectedEdgeId('')
    setPreflightVisible(true)
    setPreflightIssues([])
    setLastRun(null)
    window.localStorage.setItem(CANVAS_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    saveWorkflowDraftToLibrary(draft)
    setNotice(`已载入流程模板：${draft.title}。你可以直接修改节点、连线和交付物。`)
  }, [initialWorkflowId, saveWorkflowDraftToLibrary, setEdges, setNodes])

  return (
    <div className="flex h-full min-h-[720px] flex-col bg-background" data-testid="langflow-agent-canvas">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold">
            <GitBranch className="size-4 text-primary" />
            <span>智能体编排画布</span>
            <Badge variant="secondary">节点编排</Badge>
            <Badge variant="outline">免费</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            左侧选组件，中间拖拽连线，右侧配置节点。连线从某个产物端口发出，下游只接收这一类产物。
            {initialWorkflowId ? ` 当前流程：${initialWorkflowId}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input
            className="h-9 w-44"
            aria-label="流程名称"
            value={workflowTitle}
            onChange={(event) => setWorkflowTitle(event.target.value)}
          />
          <select
            className="h-9 w-44 rounded-md border bg-background px-2 text-sm"
            aria-label="打开已保存流程"
            value={savedDrafts.some((draft) => draft.workflowDraftId === workflowDraftId) ? workflowDraftId : ''}
            onChange={(event) => openSavedCanvasDraft(event.target.value)}
          >
            <option value="">打开已保存流程</option>
            {savedDrafts.map((draft) => (
              <option key={draft.workflowDraftId ?? draft.savedAt} value={draft.workflowDraftId}>
                {draft.title ?? '未命名流程'}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={createNewCanvasDraft}>
            <Plus className="size-3.5" />
            新建
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={saveCanvasDraft}>
            <Save className="size-3.5" />
            保存流程
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

      <main
        className="grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)_22rem]"
        data-active-connection-type={activeConnectionType ?? ''}
      >
        <div className="relative col-start-2 row-start-1 min-h-0" data-testid="canvas-flow-surface">
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
          isValidConnection={isConnectionValid}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onNodeClick={(_, node) => {
            selectNodeById(node.id)
          }}
          onEdgeClick={(_, edge) => {
            selectEdgeById(edge.id)
          }}
          onPaneClick={() => {
            setSelectedNodeId('')
            setSelectedEdgeId('')
            clearSelectedNodes()
            setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge))
          }}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          selectionOnDrag={false}
          fitView
          fitViewOptions={{ padding: CANVAS_FIT_VIEW_PADDING, maxZoom: CANVAS_FIT_VIEW_MAX_ZOOM }}
          maxZoom={CANVAS_FIT_VIEW_MAX_ZOOM}
          proOptions={{ hideAttribution: true }}
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
          <PreflightIssuePanel issues={preflightIssues} nodes={nodes} onSelectNode={selectNodeById} />
        </div>

        <aside className="col-start-1 row-start-1 min-h-0 overflow-y-auto border-r bg-background p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">组件库</div>
              <div className="mt-0.5 text-xs text-muted-foreground">先选组件，再拖拽组合流程。</div>
            </div>
            <Badge variant="outline">{agentFlowNodeTemplates.length} 类</Badge>
          </div>
          <div className="mb-3 rounded-lg border bg-background p-2" data-testid="canvas-saved-workflows">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
              <span>保存的流程</span>
              <span>{savedDrafts.length} 个</span>
            </div>
            {savedDrafts.length === 0 ? (
              <div className="rounded-md border border-dashed px-2 py-2 text-[11px] text-muted-foreground">
                保存或套用模板后，流程会出现在这里。
              </div>
            ) : (
              <div className="space-y-1.5">
                {savedDrafts.slice(0, 5).map((draft) => (
                  <button
                    key={draft.workflowDraftId ?? draft.savedAt}
                    type="button"
                    data-testid="canvas-saved-workflow-card"
                    className={cn(
                      'w-full rounded-md border bg-background px-2.5 py-2 text-left transition hover:border-primary hover:bg-primary/5',
                      draft.workflowDraftId === workflowDraftId && 'border-primary bg-primary/5',
                    )}
                    onClick={() => draft.workflowDraftId && openSavedCanvasDraft(draft.workflowDraftId)}
                  >
                    <span className="block truncate text-xs font-semibold">{draft.title ?? '未命名流程'}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {draft.nodes.length} 节点 / {draft.edges.length} 连线
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mb-3 rounded-lg border bg-muted/30 p-2" data-testid="canvas-workflow-presets">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
              <span>常用流程</span>
              <span>一键生成</span>
            </div>
            <div className="space-y-1.5">
              {canvasWorkflowPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  data-testid="canvas-workflow-preset"
                  className="flex w-full items-start justify-between gap-2 rounded-md border bg-background px-2.5 py-2 text-left transition hover:border-primary hover:bg-primary/5"
                  onClick={() => applyWorkflowPreset(preset.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{preset.name}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                      {preset.description}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {preset.badge}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
          <Input
            data-testid="component-palette-search"
            className="mb-3 h-9"
            placeholder="搜索节点、Agent、产物"
            value={templateSearchQuery}
            onChange={(event) => setTemplateSearchQuery(event.target.value)}
          />
          {activeConnectionType && (
            <div
              data-testid="active-connection-filter"
              className="mb-3 rounded-lg border bg-primary/5 p-2 text-xs text-muted-foreground"
            >
              正在连接 <span className="font-medium text-foreground">{artifactLabels[activeConnectionType]}</span>
              ，这里只显示能接收这种产物的节点。
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-1" data-testid="component-category-filter">
            {(['全部', ...templateGroups.map((group) => group.category)] as Array<AgentFlowNodeTemplateCategory | '全部'>).map((category) => (
              <button
                key={category}
                type="button"
                className={cn(
                  'rounded-full border px-2 py-1 text-[11px] font-medium transition',
                  activeTemplateCategory === category
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:border-primary hover:text-foreground',
                )}
                onClick={() => setActiveTemplateCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredTemplateGroups.map((group) => (
              <section key={group.category} data-category={group.category}>
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>{group.category}</span>
                  <span>{group.templates.length}</span>
                </div>
                <div className="space-y-2">
                  {group.templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      draggable
                      className="group flex w-full items-start gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary hover:bg-primary/5"
                      data-template-id={template.id}
                      onClick={() => addNodeFromTemplate(template.id)}
                      onDragStart={(event) => handlePaletteDragStart(event, template.id)}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {nodeIcon(template.kind)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="block truncate text-sm font-semibold">{template.title}</span>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {template.category}
                          </Badge>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{template.description}</span>
                        <span className="mt-2 inline-flex flex-wrap items-center gap-1 text-xs font-medium text-primary">
                          <Plus className="size-3" />
                          添加节点
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {template.inputs.length} 入 / {template.outputs.length} 出
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <div
          className="pointer-events-none col-start-3 row-start-1 min-h-0 border-l bg-background/95"
          data-testid="canvas-right-inspector"
        >
          <div className="pointer-events-auto flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
            {selectedEdge ? (
              <EdgeConfigPanel
                edge={selectedEdge}
                nodes={nodes}
                onDeleteEdge={() => deleteEdgeById(selectedEdge.id)}
              />
            ) : (
              <NodeConfigPanel
                node={selectedNode}
                nodes={nodes}
                edges={edges}
                agents={agents}
                softwareCommands={softwareCommands}
                onUpdateNode={updateNode}
                onDeleteNode={deleteSelectedNode}
                addPortToNode={addPortToNode}
                removePortFromNode={removePortFromNode}
                changePortTypeForNode={changePortTypeForNode}
                replaceNodePortsForAgent={replaceNodePortsForAgent}
                replaceNodePortsForSoftwareCommand={replaceNodePortsForSoftwareCommand}
              />
            )}
            <ExecutionPlanPanel steps={executionPlan} visible={preflightVisible} lastRun={lastRun} />
            <HandoffPreviewPanel steps={handoffSteps} visible={preflightVisible} />
          </div>
        </div>

      </main>
      </div>
  )
}

function AgentFlowNodeCard({ data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <div
      className={cn(
        'w-60 rounded-xl border bg-card text-card-foreground shadow-sm transition hover:shadow-md',
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
      className="rounded-xl border bg-background p-3"
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
            <div className="mt-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">{route.handoffContract}</div>
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
  nodes,
  edges,
  agents,
  softwareCommands,
  onUpdateNode,
  onDeleteNode,
  addPortToNode,
  removePortFromNode,
  changePortTypeForNode,
  replaceNodePortsForAgent,
  replaceNodePortsForSoftwareCommand,
}: {
  node: AgentFlowNode | null
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
  agents: AgentProfileRow[]
  softwareCommands: SoftwareCommandRow[]
  onUpdateNode: (nodeId: string, patch: Partial<AgentFlowNodeData>) => void
  onDeleteNode: () => void
  addPortToNode: (nodeId: string, direction: 'inputs' | 'outputs') => void
  removePortFromNode: (nodeId: string, direction: 'inputs' | 'outputs', portId: string) => void
  changePortTypeForNode: (nodeId: string, direction: 'inputs' | 'outputs', portId: string, nextType: ArtifactType) => void
  replaceNodePortsForAgent: (nodeId: string, agent: AgentProfileRow) => void
  replaceNodePortsForSoftwareCommand: (nodeId: string, command: SoftwareCommandRow) => void
}) {
  if (!node) {
    return (
      <aside className="rounded-xl border bg-background p-3">
        <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          选中一个节点后，这里会显示它接收什么、产出什么，以及需要绑定哪个 Agent 或工具。
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="rounded-xl border bg-background p-3"
      data-testid="langflow-agent-node-panel"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="size-4 text-primary" />
            节点检查器
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
                if (agent) {
                  replaceNodePortsForAgent(node.id, agent)
                  return
                }
                onUpdateNode(node.id, {
                  agentId: undefined,
                  subtitle: nodeKindLabels.agent,
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
                if (command) {
                  replaceNodePortsForSoftwareCommand(node.id, command)
                  return
                }
                onUpdateNode(node.id, {
                  softwareCommandId: undefined,
                  subtitle: nodeKindLabels.tool,
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

        <NodeSetupGuide node={node} />
        <NodeHandoffSummary node={node} nodes={nodes} edges={edges} />
        <NodePortSummary node={node} />

        <details
          data-testid="advanced-port-settings"
          className="rounded-lg border bg-background"
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">
            高级端口设置
          </summary>
          <div className="space-y-3 border-t p-3">
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
          </div>
        </details>

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

function NodePortSummary({ node }: { node: AgentFlowNode }) {
  return (
    <PanelBlock title="节点输入与产物">
      <div data-testid="node-port-summary" className="grid gap-2">
        <PortPreviewList title="接收输入" ports={node.data.inputs} emptyText="这个节点不需要上游输入。" />
        <PortPreviewList title="输出产物" ports={node.data.outputs} emptyText="这个节点暂时没有产物。" />
      </div>
    </PanelBlock>
  )
}

function NodeHandoffSummary({
  node,
  nodes,
  edges,
}: {
  node: AgentFlowNode
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
}) {
  const { incomingHandoffs, outgoingHandoffs } = getNodeHandoffSummary(node, nodes, edges)

  return (
    <PanelBlock title="实际交付关系">
      <div data-testid="node-handoff-summary" className="grid gap-2 text-xs">
        <HandoffList title="收到的交付" emptyText="还没有上游连到这个节点。" handoffs={incomingHandoffs} />
        <HandoffList title="交出去的交付" emptyText="还没有把这个节点的产物交给下游。" handoffs={outgoingHandoffs} />
      </div>
    </PanelBlock>
  )
}

function HandoffList({
  title,
  emptyText,
  handoffs,
}: {
  title: string
  emptyText: string
  handoffs: Array<{
    id: string
    peerTitle: string
    contract: string
    artifactType: ArtifactType
  }>
}) {
  return (
    <section className="rounded-md border bg-muted/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">{title}</div>
        <Badge variant="outline" className="text-[10px]">
          {handoffs.length} 条
        </Badge>
      </div>
      {handoffs.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="space-y-1">
          {handoffs.map((handoff) => (
            <div key={handoff.id} className="rounded-md border bg-background px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{handoff.peerTitle}</span>
                <ArtifactPill type={handoff.artifactType} />
              </div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">{handoff.contract}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function getNodeHandoffSummary(
  node: AgentFlowNode,
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
) {
  const nodeTitleById = new Map(nodes.map((item) => [item.id, item.data.title]))
  const incomingHandoffs = edges
    .filter((edge) => edge.target === node.id)
    .map((edge) => ({
      id: edge.id,
      peerTitle: nodeTitleById.get(edge.source) ?? '上游节点',
      contract: edge.data?.handoffContract ?? edge.data?.label ?? '交付关系',
      artifactType: edge.data?.artifactType ?? 'any',
    }))
  const outgoingHandoffs = edges
    .filter((edge) => edge.source === node.id)
    .map((edge) => ({
      id: edge.id,
      peerTitle: nodeTitleById.get(edge.target) ?? '下游节点',
      contract: edge.data?.handoffContract ?? edge.data?.label ?? '交付关系',
      artifactType: edge.data?.artifactType ?? 'any',
    }))

  return { incomingHandoffs, outgoingHandoffs }
}

function NodeSetupGuide({ node }: { node: AgentFlowNode }) {
  const setupGuide = getNodeSetupGuide(node)

  return (
    <PanelBlock title="怎么设置这个节点">
      <div data-testid="node-setup-guide" className="space-y-2 text-xs leading-5">
        <div className="rounded-md border bg-primary/5 px-2 py-1.5">
          <span className="font-semibold">先做：</span>
          {setupGuide.primaryAction}
        </div>
        <div className="rounded-md border bg-muted/30 px-2 py-1.5">
          <span className="font-semibold">交付：</span>
          {setupGuide.handoffHint}
        </div>
        <div className="space-y-1 text-muted-foreground">
          {setupGuide.steps.map((step) => (
            <div key={step} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </PanelBlock>
  )
}

function getNodeSetupGuide(node: AgentFlowNode) {
  if (node.data.kind === 'agent') {
    return {
      primaryAction: '选择这个节点由哪个员工 Agent 执行；不选时运行前会自动匹配合适员工。',
      handoffHint: '从右侧某个输出产物端口拉线，例如视频、代码或报告，下游只会收到这一类产物。',
      steps: [
        '先确认这个员工负责的任务目标。',
        '再看输出产物里有没有你要交给下游的类型。',
        '需要复杂输入输出时再展开高级端口设置。',
      ],
    }
  }

  if (node.data.kind === 'artifact') {
    return {
      primaryAction: '确认这个交付物是否给客户看，以及它应该接收哪一种文件或结果。',
      handoffHint: '把上游对应类型的输出线接进来；比如视频交付物只接收视频，不会混进代码或报告。',
      steps: [
        '改名称，让客户知道这个结果是什么。',
        '检查接收输入是否就是你要的产物类型。',
        '需要换成图片、代码或文件包时，优先从左侧选择对应交付物节点。',
      ],
    }
  }

  if (node.data.kind === 'tool') {
    return {
      primaryAction: '选择已经接入的软件、CLI 或 MCP 命令。',
      handoffHint: '工具节点会把运行结果、数据或文件包交给下游 Agent 或交付物节点。',
      steps: [
        '先在工具连接里接入软件能力。',
        '再回到这里绑定具体命令。',
        '运行前先预检，确认命令输入输出能接上。',
      ],
    }
  }

  if (node.data.kind === 'approval') {
    return {
      primaryAction: '把高风险步骤放到这里，让用户确认后再继续。',
      handoffHint: '审批通过后的产物会继续流向下游；拒绝时流程应该停下或回到上游修改。',
      steps: [
        '用于登录、发送消息、删除文件、付款等敏感动作前。',
        '描述清楚用户需要确认什么。',
        '确认后再让下游 Agent 执行。',
      ],
    }
  }

  return {
    primaryAction: '确认这个节点提供给下游的内容是什么。',
    handoffHint: '把它的输出端口连到下游兼容输入端口，系统会按产物类型限制传递内容。',
    steps: [
      '左侧节点负责产生或整理内容。',
      '中间连线表示实际交付关系。',
      '右侧只保留必要设置，复杂端口放到高级区。',
    ],
  }
}

function PortPreviewList({
  title,
  ports,
  emptyText,
}: {
  title: string
  ports: AgentFlowPort[]
  emptyText: string
}) {
  return (
    <section className="rounded-md border bg-muted/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">{title}</div>
        <Badge variant="outline" className="text-[10px]">
          {ports.length} 个
        </Badge>
      </div>
      {ports.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="space-y-1">
          {ports.map((port) => (
            <div key={port.id} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
              <ArtifactPill type={port.type} />
              <span className="min-w-0 flex-1 truncate text-xs">{port.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
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

function ExecutionPlanPanel({
  steps,
  visible,
  lastRun,
}: {
  steps: AgentFlowRunPlanStep[]
  visible: boolean
  lastRun: CanvasRunRecord | null
}) {
  if (!visible) return null

  return (
    <section
      className="rounded-xl border bg-background p-3"
      data-testid="execution-plan-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Play className="size-4 text-primary" />
          运行计划
        </div>
        <Badge variant="outline">{steps.length} 个节点</Badge>
      </div>
      <RunResultSummary run={lastRun} />
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {steps.map((step) => (
          <div key={step.nodeId} className="rounded-lg border bg-background p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate font-semibold">{step.title}</div>
              <Badge variant="outline">第 {step.stage} 步</Badge>
            </div>
            <ContractList title="收到" contracts={step.incomingContracts} emptyText="起点节点，等待用户目标或上游触发。" />
            <ContractList title="交出" contracts={step.outgoingContracts} emptyText="终点节点，负责沉淀最终产物。" />
          </div>
        ))}
      </div>
    </section>
  )
}

function RunResultSummary({ run }: { run: CanvasRunRecord | null }) {
  if (!run) return null

  return (
    <div
      data-testid="run-result-summary"
      className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300"
    >
      <div className="font-semibold">本地试运行已完成</div>
      <div className="mt-1 text-[11px]">
        {run.nodeCount} 个节点 / {run.edgeCount} 条连线 / {run.handoffCount} 个交付，{formatRunTime(run.finishedAt)}
      </div>
    </div>
  )
}

function ContractList({ title, contracts, emptyText }: { title: string; contracts: string[]; emptyText: string }) {
  return (
    <div className="mt-2 rounded-md border bg-muted/20 p-2">
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">{title}</div>
      {contracts.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="space-y-1">
          {contracts.slice(0, 3).map((contract, index) => (
            <div key={`${contract}-${index}`} className="truncate text-[11px]">
              {contract}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HandoffPreviewPanel({ steps, visible }: { steps: HandoffStep[]; visible: boolean }) {
  return (
    <section
      className={cn('rounded-xl border bg-background p-3', !visible && 'opacity-95')}
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
              <div className="truncate font-medium" data-testid="handoff-route-line">
                {`${step.sourceTitle} -> ${step.targetTitle}`}
              </div>
              <div className="my-1 flex items-center gap-2 text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <ArtifactPill type={step.artifactType} />
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="truncate text-[11px] text-muted-foreground" data-testid="handoff-artifact-contract">
                {`${step.sourcePortLabel} -> ${step.targetPortLabel}`}
              </div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">
                下游只会收到：{step.artifactLabel}
              </div>
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

function PreflightIssuePanel({
  issues,
  nodes,
  onSelectNode,
}: {
  issues: AgentFlowRunIssue[]
  nodes: AgentFlowNode[]
  onSelectNode: (nodeId: string) => void
}) {
  if (issues.length === 0) return null

  const nodeTitleById = new Map(nodes.map((node) => [node.id, node.data.title]))
  const errors = issues.filter((issue) => issue.severity === 'error').length

  return (
    <section className="pointer-events-auto absolute right-[23.5rem] top-3 z-10 w-[22rem] rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">预检问题</div>
        <Badge variant={errors > 0 ? 'destructive' : 'outline'}>
          {errors > 0 ? `${errors} 个阻塞` : `${issues.length} 个提醒`}
        </Badge>
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {issues.slice(0, 8).map((issue, index) => (
          <button
            key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? index}`}
            type="button"
            data-testid="preflight-issue-card"
            className="w-full rounded-lg border bg-background p-2 text-left text-xs transition hover:border-primary disabled:cursor-default disabled:hover:border-border"
            disabled={!issue.nodeId}
            onClick={() => issue.nodeId && onSelectNode(issue.nodeId)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{issue.nodeId ? nodeTitleById.get(issue.nodeId) ?? issue.nodeId : issue.edgeId ?? '流程'}</span>
              <Badge variant={issue.severity === 'error' ? 'destructive' : 'outline'}>
                {issue.severity === 'error' ? '阻塞' : '提醒'}
              </Badge>
            </div>
            <div className="mt-1 leading-4 text-muted-foreground">{issue.message}</div>
          </button>
        ))}
      </div>
      {issues.length > 8 && (
        <div className="mt-2 text-[11px] text-muted-foreground">还有 {issues.length - 8} 条问题，可继续调整节点后重新预检。</div>
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

function matchesTemplateSearch(
  template: (typeof agentFlowNodeTemplates)[number],
  search: string,
) {
  const haystack = [
    template.title,
    template.subtitle,
    template.description,
    template.kind,
    template.category,
    ...template.inputs.flatMap((input) => [input.label, input.type]),
    ...template.outputs.flatMap((output) => [output.label, output.type]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(search)
}

function templateAcceptsConnectionType(
  template: (typeof agentFlowNodeTemplates)[number],
  type: ArtifactType,
) {
  return template.inputs.some((input) => canConnect(type, input.type))
}

function createNodeFromTemplate(
  templateId: string,
  position: { x: number; y: number },
  overrides: Partial<AgentFlowNodeData> = {},
  fixedId?: string,
): AgentFlowNode {
  const template = getAgentFlowNodeTemplate(templateId)
  if (!template) throw new Error(`Unknown Agent flow node template: ${templateId}`)

  const id = fixedId ?? `${template.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    type: 'agentFlowNode',
    position,
    data: {
      kind: template.kind,
      title: template.title,
      subtitle: template.subtitle,
      description: template.description,
      status: 'idle',
      inputs: cloneTemplatePorts(template.inputs),
      outputs: cloneTemplatePorts(template.outputs),
      customerVisible: Boolean(template.customerVisible),
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
  sourcePortLabel: string = artifactLabels[artifactType],
  targetPortId: string = artifactType,
  targetPortLabel: string = artifactLabels[artifactType],
): AgentFlowEdge {
  const handoffContract = `${artifactLabels[artifactType]}: ${sourcePortLabel} -> ${targetPortLabel}`

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
      sourcePortId: outputId,
      targetPortId,
      sourcePortLabel,
      targetPortLabel,
      handoffContract,
      label: artifactLabels[artifactType],
    },
  }
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
      sourcePortLabel: edge.data?.sourcePortLabel ?? artifactLabels[artifactType],
      targetPortLabel: edge.data?.targetPortLabel ?? artifactLabels[artifactType],
      handoffContract: edge.data?.handoffContract ?? `${artifactLabels[artifactType]}: ${artifactLabels[artifactType]} -> ${artifactLabels[artifactType]}`,
    }]
  })
}

function createCanvasWorkflowPresetDraft(
  presetId: CanvasWorkflowPreset['id'],
  initialWorkflowId: string | null,
): CanvasDraft {
  const preset = canvasWorkflowPresets.find((item) => item.id === presetId) ?? canvasWorkflowPresets[0]
  const inputId = `${preset.id}-input`
  const agentId = `${preset.id}-agent`
  const artifactId = `${preset.id}-artifact`
  const nodes = [
    createNodeFromTemplate('customer-request', { x: 40, y: 140 }, {
      description: '客户目标、素材、约束和上一轮消息都会从这里进入流程。',
    }, inputId),
    createNodeFromTemplate('employee-agent', { x: 420, y: 140 }, {
      title: `${preset.badge} Agent`,
      description: `根据客户目标完成任务，并产出${artifactLabels[preset.artifactType]}。`,
    }, agentId),
    createNodeFromTemplate(preset.deliverableTemplateId, { x: 820, y: 140 }, {
      description: `这个节点只接收上游连过来的${artifactLabels[preset.artifactType]}，作为客户可见交付物。`,
      customerVisible: true,
    }, artifactId),
  ]
  const edges = [
    createFlowEdge(`${preset.id}-customer-to-agent`, inputId, agentId, 'message', 'message'),
    createFlowEdge(`${preset.id}-agent-to-artifact`, agentId, artifactId, preset.artifactType, preset.artifactType),
  ]

  return {
    schema: 'agenthub.langflow_agent_canvas.v1',
    workflowDraftId: createCanvasDraftId(),
    title: preset.name,
    savedAt: new Date().toISOString(),
    initialWorkflowId,
    nodes,
    edges,
    handoffSteps: buildHandoffSteps(nodes, edges),
  }
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
  const sourcePortLabel = edge.data?.sourcePortLabel ?? sourcePort?.label ?? edge.data?.label ?? artifactLabels[artifactType]
  const targetPortLabel = edge.data?.targetPortLabel ?? targetPort?.label ?? artifactLabels[artifactType]

  return {
    sourceTitle: source.data.title,
    sourcePortLabel,
    targetTitle: target.data.title,
    targetPortLabel,
    artifactType,
    handoffContract: edge.data?.handoffContract ?? `${artifactLabels[artifactType]}: ${sourcePortLabel} -> ${targetPortLabel}`,
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

function loadCanvasDraftLibrary(): CanvasDraft[] {
  const raw = window.localStorage.getItem(CANVAS_DRAFT_LIBRARY_STORAGE_KEY)
  if (!raw) return []

  try {
    const drafts = JSON.parse(raw) as unknown
    if (!Array.isArray(drafts)) return []
    return drafts
      .filter(isValidCanvasDraft)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  } catch {
    return []
  }
}

function findCanvasDraftById(library: CanvasDraft[], draftId?: string): CanvasDraft | null {
  if (!draftId) return null
  return library.find((draft) => draft.workflowDraftId === draftId) ?? null
}

function saveCanvasDraftLibrary(drafts: CanvasDraft[]) {
  window.localStorage.setItem(CANVAS_DRAFT_LIBRARY_STORAGE_KEY, JSON.stringify(drafts))
}

function loadCanvasRunHistory(): CanvasRunRecord[] {
  const raw = window.localStorage.getItem(CANVAS_RUN_HISTORY_STORAGE_KEY)
  if (!raw) return []

  try {
    const runs = JSON.parse(raw) as unknown
    if (!Array.isArray(runs)) return []
    return runs
      .filter(isValidCanvasRunRecord)
      .sort((a, b) => b.startedAt - a.startedAt)
  } catch {
    return []
  }
}

function findLatestCanvasRunForDraft(history: CanvasRunRecord[], draftId?: string): CanvasRunRecord | null {
  if (!draftId) return null
  return history.find((run) => run.workflowDraftId === draftId) ?? null
}

function formatRunTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function saveCanvasRunHistory(runs: CanvasRunRecord[]) {
  window.localStorage.setItem(CANVAS_RUN_HISTORY_STORAGE_KEY, JSON.stringify(runs))
}

function upsertCanvasRunHistory(history: CanvasRunRecord[], run: CanvasRunRecord) {
  return [run, ...history.filter((item) => item.id !== run.id)].slice(0, 100)
}

function upsertCanvasDraft(library: CanvasDraft[], draft: CanvasDraft) {
  const draftId = draft.workflowDraftId ?? createCanvasDraftId()
  return [
    { ...draft, workflowDraftId: draftId },
    ...library.filter((item) => item.workflowDraftId !== draftId),
  ].slice(0, 50)
}

function isValidCanvasDraft(value: unknown): value is CanvasDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<CanvasDraft>
  return (
    draft.schema === 'agenthub.langflow_agent_canvas.v1' &&
    Array.isArray(draft.nodes) &&
    Array.isArray(draft.edges) &&
    typeof draft.savedAt === 'string'
  )
}

function isValidCanvasRunRecord(value: unknown): value is CanvasRunRecord {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<CanvasRunRecord>
  return (
    run.schema === 'agenthub.langflow_agent_canvas.run.v1' &&
    typeof run.id === 'string' &&
    typeof run.workflowDraftId === 'string' &&
    run.status === 'complete' &&
    typeof run.startedAt === 'number' &&
    typeof run.finishedAt === 'number'
  )
}

function createCanvasDraftId() {
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneCanvasNodes(nodes: AgentFlowNode[]) {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      inputs: node.data.inputs.map((input) => ({ ...input })),
      outputs: node.data.outputs.map((output) => ({ ...output })),
    },
  }))
}

function cloneCanvasEdges(edges: AgentFlowEdge[]) {
  return edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : edge.data,
    markerEnd: edge.markerEnd && typeof edge.markerEnd === 'object' ? { ...edge.markerEnd } : edge.markerEnd,
  }))
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

function keepEdgesWithKnownHandles(
  edges: AgentFlowEdge[],
  nodeId: string,
  inputs: AgentFlowPort[],
  outputs: AgentFlowPort[],
) {
  const inputByHandle = new Map(inputs.map((input) => [inputHandleId(input), input]))
  const outputByHandle = new Map(outputs.map((output) => [outputHandleId(output), output]))

  return edges.flatMap((edge) => {
    if (edge.source === nodeId) {
      const output = edge.sourceHandle ? outputByHandle.get(edge.sourceHandle) : null
      if (!output) return []
      const targetPortLabel = edge.data?.targetPortLabel ?? artifactLabels[output.type]
      return [{
        ...edge,
        data: {
          artifactType: output.type,
          label: artifactLabels[output.type],
          outputId: output.id,
          sourcePortId: output.id,
          targetPortId: edge.data?.targetPortId ?? edge.targetHandle?.replace(/^in:/, '') ?? output.type,
          sourcePortLabel: output.label,
          targetPortLabel,
          handoffContract: `${artifactLabels[output.type]}: ${output.label} -> ${targetPortLabel}`,
        },
      }]
    }

    if (edge.target === nodeId) {
      const input = edge.targetHandle ? inputByHandle.get(edge.targetHandle) : null
      if (!input) return []
      if (!canConnect(edge.data?.artifactType ?? 'any', input.type)) return []
      return [{
        ...edge,
        data: edge.data
          ? {
              ...edge.data,
              targetPortId: input.id,
              targetPortLabel: input.label,
              handoffContract: `${artifactLabels[edge.data.artifactType]}: ${edge.data.sourcePortLabel} -> ${input.label}`,
            }
          : edge.data,
      }]
    }

    return [edge]
  })
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

const nodeTypes = { agentFlowNode: AgentFlowNodeCard }
const edgeTypes = { agentArtifact: AgentArtifactEdge }

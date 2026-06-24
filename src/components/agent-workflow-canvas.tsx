'use client'

import {
  Activity,
  AlertCircle,
  Bot,
  Camera,
  CheckCircle2,
  Code2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  GitBranch,
  Grip,
  Loader2,
  Maximize2,
  Minus,
  MonitorCheck,
  Package,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  UserCheck,
  Wrench,
  Workflow,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type {
  AgentProfileRow,
  ArtifactValidationRow,
  ApprovalRequestRow,
  ComputerActionEventRow,
  ComputerSessionRow,
  EmployeeRunRow,
  JsonObject,
  NaturalLanguageWorkflowDraftRow,
  ResourceLockRow,
  RunStatus,
  SoftwareCommandRow,
  SoftwareCommandRunRow,
  WorkflowPreflightRow,
  WorkflowNodeRunRow,
  WorkflowRow,
  WorkflowRunRow,
} from '@/db/schema'
import {
  approveApprovalRequest,
  confirmNaturalLanguageWorkflowDraft,
  createWorkflow,
  createNaturalLanguageWorkflowDraft,
  fetchAgentProfiles,
  fetchNaturalLanguageWorkflowDrafts,
  fetchSoftwareCommands,
  fetchWorkflowGraph,
  fetchWorkflowPreflights,
  fetchWorkflowPresets,
  fetchWorkflowRunSnapshot,
  fetchWorkflowRuns,
  fetchWorkflows,
  installWorkflowPreset,
  rejectApprovalRequest,
  recordComputerObservation,
  reviseNaturalLanguageWorkflowDraft,
  runWorkflowPreflight,
  runWorkflowPreset,
  startWorkflowRun,
  updateWorkflow,
  type WorkflowPresetDto,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const NODE_WIDTH = 212
const NODE_HEIGHT = 216
const CANVAS_MIN_COORD = -2400
const CANVAS_MAX_COORD = 4800
const CANVAS_MIN_SCALE = 0.4
const CANVAS_MAX_SCALE = 1.8
const CANVAS_ZOOM_STEP = 0.12

type DraftNodeType =
  | 'agent_employee'
  | 'human_approval'
  | 'software_command'
  | 'artifact_transform'
  | 'webhook_trigger'
  | 'condition'

const NODE_TYPE_OPTIONS: DraftNodeType[] = [
  'agent_employee',
  'software_command',
  'human_approval',
  'condition',
  'artifact_transform',
  'webhook_trigger',
]

const NODE_TYPE_LABELS: Record<DraftNodeType, string> = {
  agent_employee: '智能体节点',
  software_command: '软件命令',
  human_approval: '人工审批',
  artifact_transform: '产物处理',
  webhook_trigger: '触发器',
  condition: '条件判断',
}

const ARTIFACT_TYPE_OPTIONS = [
  'report',
  'json',
  'document',
  'code',
  'spreadsheet',
  'image',
  'video',
  'presentation',
  'browser_state',
  'desktop_result',
  'file_bundle',
  'approval_decision',
  'software_result',
]

const CUSTOMER_ARTIFACT_QUICK_TYPES = [
  'report',
  'code',
  'image',
  'video',
  'document',
  'spreadsheet',
  'file_bundle',
]

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  report: '报告',
  json: '结构化数据',
  document: '文档',
  code: '代码',
  spreadsheet: '表格',
  image: '图片',
  video: '视频',
  presentation: '演示文稿',
  browser_state: '浏览器状态',
  desktop_result: '电脑操作结果',
  file_bundle: '文件包',
  approval_decision: '审批结果',
  software_result: '软件执行结果',
}

interface DraftNode {
  id: string
  type: DraftNodeType
  label: string
  agentProfileId: string | null
  softwareCommandId: string | null
  position: { x: number; y: number }
  config: JsonObject
  inputMapping: JsonObject
  outputContract: JsonObject
  retryPolicy: JsonObject
  approvalPolicy: JsonObject
}

interface DraftEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  mapping: JsonObject
}

interface DragState {
  nodeId: string
  pointerId: number
  offsetX: number
  offsetY: number
}

interface CanvasPanState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

interface ConnectionDragState {
  pointerId: number
  sourceNodeId: string
  x: number
  y: number
}

interface CanvasNodePaletteState {
  x: number
  y: number
  canvasPosition: { x: number; y: number }
}

export function AgentWorkflowCanvas() {
  const [agents, setAgents] = useState<AgentProfileRow[]>([])
  const [softwareCommands, setSoftwareCommands] = useState<SoftwareCommandRow[]>([])
  const [workflowPresets, setWorkflowPresets] = useState<WorkflowPresetDto[]>([])
  const [nlDrafts, setNlDrafts] = useState<NaturalLanguageWorkflowDraftRow[]>([])
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([])
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunRow[]>([])
  const [workflowPreflights, setWorkflowPreflights] = useState<WorkflowPreflightRow[]>([])
  const [nodeRuns, setNodeRuns] = useState<WorkflowNodeRunRow[]>([])
  const [employeeRuns, setEmployeeRuns] = useState<EmployeeRunRow[]>([])
  const [softwareCommandRuns, setSoftwareCommandRuns] = useState<SoftwareCommandRunRow[]>([])
  const [computerSessions, setComputerSessions] = useState<ComputerSessionRow[]>([])
  const [computerActionEvents, setComputerActionEvents] = useState<ComputerActionEventRow[]>([])
  const [artifactValidations, setArtifactValidations] = useState<ArtifactValidationRow[]>([])
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequestRow[]>([])
  const [resourceLocks, setResourceLocks] = useState<ResourceLockRow[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [selectedNlDraftId, setSelectedNlDraftId] = useState('')
  const [selectedRunId, setSelectedRunId] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedSoftwareCommandId, setSelectedSoftwareCommandId] = useState('')
  const [workflowName, setWorkflowName] = useState('智能体交付流程')
  const [workflowDescription, setWorkflowDescription] = useState(
    '由员工智能体、软件命令和人工审批组成的画布流程。',
  )
  const [nodes, setNodes] = useState<DraftNode[]>([])
  const [edges, setEdges] = useState<DraftEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [connectingFromNodeId, setConnectingFromNodeId] = useState('')
  const [runInput, setRunInput] = useState('{"goal":"产出本次任务要求的交付物。"}')
  const [preflightBudget, setPreflightBudget] = useState('100')
  const [nlPrompt, setNlPrompt] = useState(
    '当 GitHub 有新 Issue 时，让代码智能体分析问题；如果是 bug 就分配给修复智能体，如果是 feature 就加入计划表。',
  )
  const [nlRevision, setNlRevision] = useState('')
  const [drag, setDrag] = useState<DragState | null>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })
  const [pan, setPan] = useState<CanvasPanState | null>(null)
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null)
  const [nodePalette, setNodePalette] = useState<CanvasNodePaletteState | null>(null)
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows],
  )
  const selectedPreset = useMemo(
    () => workflowPresets.find((preset) => preset.id === selectedPresetId) ?? null,
    [selectedPresetId, workflowPresets],
  )
  const selectedNlDraft = useMemo(
    () => nlDrafts.find((draft) => draft.id === selectedNlDraftId) ?? null,
    [nlDrafts, selectedNlDraftId],
  )
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const latestPreflight = workflowPreflights[0] ?? null

  const nodeRunByNodeId = useMemo(() => {
    const map = new Map<string, WorkflowNodeRunRow>()
    for (const run of nodeRuns) map.set(run.nodeId, run)
    return map
  }, [nodeRuns])

  const customerDeliverableNodes = useMemo(
    () => nodes.filter((node) => customerVisibleOf(node)),
    [nodes],
  )

  const agentById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const softwareCommandById = useMemo(
    () => new Map(softwareCommands.map((command) => [command.id, command])),
    [softwareCommands],
  )

  const reloadLists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        nextAgents,
        nextSoftwareCommands,
        nextPresets,
        nextNlDrafts,
        nextWorkflows,
        nextRuns,
      ] = await Promise.all([
        fetchAgentProfiles(),
        fetchSoftwareCommands(),
        fetchWorkflowPresets(),
        fetchNaturalLanguageWorkflowDrafts({ limit: 20 }),
        fetchWorkflows(),
        fetchWorkflowRuns(),
      ])
      setAgents(nextAgents)
      setSoftwareCommands(nextSoftwareCommands)
      setWorkflowPresets(nextPresets)
      setNlDrafts(nextNlDrafts)
      setWorkflows(nextWorkflows)
      setWorkflowRuns(nextRuns)
      if (!selectedAgentId && nextAgents[0]) setSelectedAgentId(nextAgents[0].id)
      if (!selectedSoftwareCommandId && nextSoftwareCommands[0]) {
        setSelectedSoftwareCommandId(nextSoftwareCommands[0].id)
      }
      if (!selectedPresetId && nextPresets[0]) setSelectedPresetId(nextPresets[0].id)
      if (!selectedNlDraftId && nextNlDrafts[0]) setSelectedNlDraftId(nextNlDrafts[0].id)
      if (!selectedWorkflowId && nextWorkflows[0]) setSelectedWorkflowId(nextWorkflows[0].id)
      if (!selectedRunId && nextRuns[0]) setSelectedRunId(nextRuns[0].id)
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }, [
    selectedAgentId,
    selectedNlDraftId,
    selectedPresetId,
    selectedRunId,
    selectedSoftwareCommandId,
    selectedWorkflowId,
  ])

  useEffect(() => {
    void reloadLists()
  }, [reloadLists])

  useEffect(() => {
    if (!selectedWorkflowId) return
    let alive = true
    async function loadGraph() {
      setError(null)
      try {
        const graph = await fetchWorkflowGraph(selectedWorkflowId)
        if (!alive) return
        setWorkflowName(graph.workflow.name)
        setWorkflowDescription(graph.workflow.description)
        const nextNodes = graph.nodes.map((node) => ({
            id: node.id,
            type: normalizeNodeType(node.type),
            label:
              stringField(node.config, 'label') ||
              nodeTypeLabel(normalizeNodeType(node.type)),
            agentProfileId: node.agentProfileId,
            softwareCommandId:
              typeof node.config.softwareCommandId === 'string' ? node.config.softwareCommandId : null,
            position: node.position,
            config: node.config,
            inputMapping: node.inputMapping,
            outputContract: node.outputContract,
            retryPolicy: node.retryPolicy,
            approvalPolicy: node.approvalPolicy,
          }))
        setNodes(nextNodes)
        setSelectedNodeId((current) =>
          current && nextNodes.some((node) => node.id === current) ? current : nextNodes[0]?.id ?? '',
        )
        setEdges(
          graph.edges.map((edge) => ({
            id: edge.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            mapping: edge.mapping,
          })),
        )
        setConnectingFromNodeId('')
        setConnectionDrag(null)
      } catch (err) {
        if (alive) setError(formatError(err))
      }
    }
    void loadGraph()
    return () => {
      alive = false
    }
  }, [selectedWorkflowId])

  useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId('')
    }
    if (connectingFromNodeId && !nodes.some((node) => node.id === connectingFromNodeId)) {
      setConnectingFromNodeId('')
    }
    if (connectionDrag && !nodes.some((node) => node.id === connectionDrag.sourceNodeId)) {
      setConnectionDrag(null)
    }
  }, [connectingFromNodeId, connectionDrag, nodes, selectedNodeId])

  useEffect(() => {
    if (!selectedWorkflowId) {
      setWorkflowPreflights([])
      return
    }
    let alive = true
    async function loadPreflights() {
      try {
        const nextPreflights = await fetchWorkflowPreflights(selectedWorkflowId)
        if (alive) setWorkflowPreflights(nextPreflights)
      } catch (err) {
        if (alive) setError(formatError(err))
      }
    }
    void loadPreflights()
    return () => {
      alive = false
    }
  }, [selectedWorkflowId])

  useEffect(() => {
    if (!selectedRunId) {
      setNodeRuns([])
      setEmployeeRuns([])
      setSoftwareCommandRuns([])
      setComputerSessions([])
      setComputerActionEvents([])
      setArtifactValidations([])
      setApprovalRequests([])
      setResourceLocks([])
      return
    }
    let alive = true
    async function loadRun() {
      try {
        const snapshot = await fetchWorkflowRunSnapshot(selectedRunId)
        if (!alive) return
        setNodeRuns(snapshot.nodeRuns)
        setEmployeeRuns(snapshot.employeeRuns)
        setSoftwareCommandRuns(snapshot.softwareCommandRuns)
        setComputerSessions(snapshot.computerSessions)
        setComputerActionEvents(snapshot.computerActionEvents)
        setArtifactValidations(snapshot.artifactValidations)
        setApprovalRequests(snapshot.approvalRequests)
        setResourceLocks(snapshot.resourceLocks)
      } catch (err) {
        if (alive) setError(formatError(err))
      }
    }
    void loadRun()
    return () => {
      alive = false
    }
  }, [selectedRunId])

  const runAction = async (label: string, action: () => Promise<void>) => {
    setSaving(label)
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(`${actionLabel(label)}已完成`)
      await reloadLists()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const resetDraft = () => {
    setSelectedWorkflowId('')
    setSelectedRunId('')
    setNodeRuns([])
    setEmployeeRuns([])
    setSoftwareCommandRuns([])
    setComputerSessions([])
    setComputerActionEvents([])
    setArtifactValidations([])
    setApprovalRequests([])
    setResourceLocks([])
    setWorkflowPreflights([])
    setWorkflowName('智能体交付流程')
    setWorkflowDescription('由员工智能体、软件命令和人工审批组成的画布流程。')
    setNodes([])
    setEdges([])
    setSelectedNodeId('')
    setConnectingFromNodeId('')
    setConnectionDrag(null)
  }

  const applyNlDraftToCanvas = (draft: NaturalLanguageWorkflowDraftRow) => {
    const canvasDraft = canvasDraftFromNlDraft(draft)
    setSelectedWorkflowId('')
    setSelectedRunId('')
    setWorkflowName(canvasDraft.name)
    setWorkflowDescription(canvasDraft.description)
    setNodes(canvasDraft.nodes)
    setEdges(canvasDraft.edges)
    setSelectedNodeId(canvasDraft.nodes[0]?.id ?? '')
    setConnectingFromNodeId('')
    setConnectionDrag(null)
  }

  const generateNaturalWorkflow = () =>
    runAction('Generate workflow draft', async () => {
      if (!nlPrompt.trim()) throw new Error('先输入你想生成的流程。')
      const draft = await createNaturalLanguageWorkflowDraft({
        prompt: nlPrompt,
        name: workflowName.trim() === '智能体交付流程' ? undefined : workflowName.trim(),
      })
      setNlDrafts((current) => [draft, ...current.filter((row) => row.id !== draft.id)])
      setSelectedNlDraftId(draft.id)
      applyNlDraftToCanvas(draft)
    })

  const reviseNaturalWorkflow = () =>
    runAction('Modify workflow draft', async () => {
      if (!selectedNlDraft) throw new Error('先生成或选择一个流程草稿。')
      if (!nlRevision.trim()) throw new Error('先输入要怎么修改这个流程。')
      const draft = await reviseNaturalLanguageWorkflowDraft(selectedNlDraft.id, {
        modificationPrompt: nlRevision,
        name: workflowName.trim() || selectedNlDraft.name,
      })
      setNlDrafts((current) => [draft, ...current.filter((row) => row.id !== draft.id)])
      setSelectedNlDraftId(draft.id)
      setNlRevision('')
      applyNlDraftToCanvas(draft)
    })

  const confirmGeneratedWorkflow = () =>
    runAction('Confirm generated workflow', async () => {
      if (!selectedNlDraft) throw new Error('Generate or select a workflow draft first.')
      const result = await confirmNaturalLanguageWorkflowDraft(selectedNlDraft.id, {
        name: workflowName.trim() || selectedNlDraft.name,
        status: 'active',
      })
      setNlDrafts((current) => [
        result.draft,
        ...current.filter((row) => row.id !== result.draft.id),
      ])
      setWorkflows((current) => [
        result.workflowGraph.workflow,
        ...current.filter((row) => row.id !== result.workflowGraph.workflow.id),
      ])
      setSelectedWorkflowId(result.workflowGraph.workflow.id)
      setWorkflowName(result.workflowGraph.workflow.name)
      setWorkflowDescription(result.workflowGraph.workflow.description)
      const nextNodes = result.workflowGraph.nodes.map((node) => ({
          id: node.id,
          type: normalizeNodeType(node.type),
          label:
            stringField(node.config, 'label') ||
            nodeTypeLabel(normalizeNodeType(node.type)),
          agentProfileId: node.agentProfileId,
          softwareCommandId:
            typeof node.config.softwareCommandId === 'string' ? node.config.softwareCommandId : null,
          position: node.position,
          config: node.config,
          inputMapping: node.inputMapping,
          outputContract: node.outputContract,
          retryPolicy: node.retryPolicy,
          approvalPolicy: node.approvalPolicy,
        }))
      setNodes(nextNodes)
      setSelectedNodeId(nextNodes[0]?.id ?? '')
      setEdges(
        result.workflowGraph.edges.map((edge) => ({
          id: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          mapping: edge.mapping,
        })),
      )
      setConnectingFromNodeId('')
      setConnectionDrag(null)
    })

  const appendNodeToCanvas = (node: DraftNode) => {
    const sourceNodeId =
      connectingFromNodeId && nodes.some((item) => item.id === connectingFromNodeId)
        ? connectingFromNodeId
        : nodes[nodes.length - 1]?.id ?? ''
    setNodes((current) => [...current, node])
    setSelectedNodeId(node.id)
    setNodePalette(null)
    setConnectionDrag(null)
    setConnectingFromNodeId('')
    if (!sourceNodeId || sourceNodeId === node.id) return
    setEdges((current) => {
      const exists = current.some(
        (edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === node.id,
      )
      if (exists) return current
      return [
        ...current,
        {
          id: newDraftId('edge'),
          sourceNodeId,
          targetNodeId: node.id,
          mapping: {},
        },
      ]
    })
  }

  const addAgentNode = (position?: { x: number; y: number }) => {
    const agent = agents.find((item) => item.id === selectedAgentId) ?? agents[0] ?? null
    const id = newDraftId('agent_node')
    const label = agent?.name ?? `智能体节点 ${nodes.length + 1}`
    const node: DraftNode = {
      id,
      type: 'agent_employee',
      label,
      agentProfileId: agent?.id ?? null,
      softwareCommandId: null,
      position: position ?? nextNodePosition(nodes.length),
      config: { label },
      inputMapping: {},
      outputContract: defaultOutputContract('agent_employee', label, agent?.outputContract),
      retryPolicy: { maxAttempts: 1 },
      approvalPolicy: {},
    }
    appendNodeToCanvas(node)
  }

  const addApprovalNode = (position?: { x: number; y: number }) => {
    const id = newDraftId('approval_node')
    const node: DraftNode = {
      id,
      type: 'human_approval',
      label: '人工审批',
      agentProfileId: null,
      softwareCommandId: null,
      position: position ?? nextNodePosition(nodes.length),
      config: { label: '人工审批' },
      inputMapping: {},
      outputContract: defaultOutputContract('human_approval', '人工审批'),
      retryPolicy: { maxAttempts: 1 },
      approvalPolicy: { required: true, riskLevel: 'medium' },
    }
    appendNodeToCanvas(node)
  }

  const addSoftwareCommandNode = (position?: { x: number; y: number }) => {
    const command =
      softwareCommands.find((item) => item.id === selectedSoftwareCommandId) ??
      softwareCommands[0] ??
      null
    const id = newDraftId('software_node')
    const label = command?.name ?? `软件命令 ${nodes.length + 1}`
    const node: DraftNode = {
      id,
      type: 'software_command',
      label,
      agentProfileId: null,
      softwareCommandId: command?.id ?? null,
      position: position ?? nextNodePosition(nodes.length),
      config: command
        ? { label, softwareCommandId: command.id }
        : { label },
      inputMapping: {},
      outputContract: defaultOutputContract('software_command', label),
      retryPolicy: { maxAttempts: 1 },
      approvalPolicy: command?.requiresApproval ? { required: true, riskLevel: command.riskLevel } : {},
    }
    appendNodeToCanvas(node)
  }

  const addConditionNode = (position?: { x: number; y: number }) => {
    addGenericNode('condition', position)
  }

  const addArtifactNode = (position?: { x: number; y: number }) => {
    addGenericNode('artifact_transform', position)
  }

  const addGenericNode = (type: DraftNodeType, position?: { x: number; y: number }) => {
    const label = nodeTypeLabel(type)
    const id = newDraftId(`${type}_node`)
    const node: DraftNode = {
      id,
      type,
      label,
      agentProfileId: null,
      softwareCommandId: null,
      position: position ?? nextNodePosition(nodes.length),
      config: { label },
      inputMapping: {},
      outputContract: defaultOutputContract(type, label),
      retryPolicy: { maxAttempts: 1 },
      approvalPolicy:
        type === 'human_approval' ? { required: true, riskLevel: 'medium' } : {},
    }
    appendNodeToCanvas(node)
  }

  const createEdgeBetween = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return false
    const exists = edges.some(
      (edge) => edge.sourceNodeId === sourceId && edge.targetNodeId === targetId,
    )
    if (exists) return false
    setEdges((current) => [
      ...current,
      { id: newDraftId('edge'), sourceNodeId: sourceId, targetNodeId: targetId, mapping: {} },
    ])
    return true
  }

  const removeNode = (nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) =>
      current.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId),
    )
    if (selectedNodeId === nodeId) setSelectedNodeId('')
    if (connectingFromNodeId === nodeId) setConnectingFromNodeId('')
    if (connectionDrag?.sourceNodeId === nodeId) setConnectionDrag(null)
  }

  const removeEdge = (edgeId: string) => {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId))
  }

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selectedNodeId) return
    if (isCanvasFormTarget(event.target)) return
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    event.preventDefault()
    event.stopPropagation()
    removeNode(selectedNodeId)
  }

  const updateNode = (nodeId: string, patch: Partial<DraftNode>) => {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    )
  }

  const handleNodeClick = (node: DraftNode) => {
    if (connectingFromNodeId && connectingFromNodeId !== node.id) {
      createEdgeBetween(connectingFromNodeId, node.id)
      setConnectingFromNodeId('')
      setSelectedNodeId(node.id)
      return
    }
    setSelectedNodeId(node.id)
  }

  const saveWorkflow = () =>
    runAction('Save workflow', async () => {
      if (nodes.length === 0) throw new Error('请先在画布里添加至少一个节点。')
      const body: Parameters<typeof createWorkflow>[0] = {
        name: workflowName,
        description: workflowDescription,
        status: 'active',
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          agentProfileId: node.agentProfileId,
          position: node.position,
          config:
            node.type === 'software_command'
              ? { ...node.config, softwareCommandId: node.softwareCommandId }
              : node.config,
          outputContract: normalizedOutputContract(node),
          inputMapping: node.inputMapping,
          retryPolicy: node.retryPolicy,
          approvalPolicy:
            node.type === 'human_approval'
              ? { ...node.approvalPolicy, required: true, riskLevel: 'medium' }
              : node.approvalPolicy,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          mapping: edge.mapping,
        })),
      }
      const workflow = selectedWorkflowId
        ? await updateWorkflow(selectedWorkflowId, body)
        : await createWorkflow(body)
      setSelectedWorkflowId(workflow.id)
    })

  const installPreset = () =>
    runAction('Install preset', async () => {
      if (!selectedPreset) throw new Error('请先选择一个流程模板。')
      const graph = await installWorkflowPreset(selectedPreset.id, {
        name: selectedPreset.title,
        status: 'active',
      })
      setWorkflows((current) => [graph.workflow, ...current.filter((row) => row.id !== graph.workflow.id)])
      setSelectedWorkflowId(graph.workflow.id)
      setWorkflowName(graph.workflow.name)
      setWorkflowDescription(graph.workflow.description)
      const nextNodes = graph.nodes.map((node) => ({
          id: node.id,
          type: normalizeNodeType(node.type),
          label:
            stringField(node.config, 'label') ||
            stringField(node.config, 'title') ||
            nodeTypeLabel(normalizeNodeType(node.type)),
          agentProfileId: node.agentProfileId,
          softwareCommandId:
            typeof node.config.softwareCommandId === 'string' ? node.config.softwareCommandId : null,
          position: node.position,
          config: node.config,
          inputMapping: node.inputMapping,
          outputContract: node.outputContract,
          retryPolicy: node.retryPolicy,
          approvalPolicy: node.approvalPolicy,
        }))
      setNodes(nextNodes)
      setSelectedNodeId(nextNodes[0]?.id ?? '')
      setEdges(
        graph.edges.map((edge) => ({
          id: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          mapping: edge.mapping,
        })),
      )
    })

  const preflightWorkflow = () =>
    runAction('Preflight workflow', async () => {
      if (!selectedWorkflowId) throw new Error('请先保存或选择一个流程，再做预检。')
      const input = parseJsonObject(runInput)
      const budgetLimitCents = parseOptionalNumber(preflightBudget)
      const preflight = await runWorkflowPreflight(selectedWorkflowId, {
        input,
        budgetLimitCents,
      })
      setWorkflowPreflights((current) => [preflight, ...current.filter((row) => row.id !== preflight.id)])
    })

  const runPreset = () =>
    runAction('Run preset', async () => {
      if (!selectedPreset) throw new Error('请先选择一个流程模板。')
      const result = await runWorkflowPreset(selectedPreset.id, parseJsonObject(runInput))
      setWorkflows((current) => [
        result.workflow,
        ...current.filter((row) => row.id !== result.workflow.id),
      ])
      setSelectedWorkflowId(result.workflow.id)
      setSelectedRunId(result.workflowRun.id)
      const runs = await fetchWorkflowRuns(result.workflow.id)
      setWorkflowRuns((current) => mergeRuns(current, runs))
      const snapshot = await fetchWorkflowRunSnapshot(result.workflowRun.id)
      setNodeRuns(snapshot.nodeRuns)
      setEmployeeRuns(snapshot.employeeRuns)
      setSoftwareCommandRuns(snapshot.softwareCommandRuns)
      setComputerSessions(snapshot.computerSessions)
      setComputerActionEvents(snapshot.computerActionEvents)
      setArtifactValidations(snapshot.artifactValidations)
      setApprovalRequests(snapshot.approvalRequests)
      setResourceLocks(snapshot.resourceLocks)
    })

  const runWorkflow = () =>
    runAction('Start workflow run', async () => {
      if (!selectedWorkflowId) throw new Error('请先保存或选择一个流程，再运行。')
      const input = parseJsonObject(runInput)
      const workflowRun = await startWorkflowRun(selectedWorkflowId, input)
      setSelectedRunId(workflowRun.id)
      const runs = await fetchWorkflowRuns(selectedWorkflowId)
      setWorkflowRuns((current) => mergeRuns(current, runs))
      const snapshot = await fetchWorkflowRunSnapshot(workflowRun.id)
      setNodeRuns(snapshot.nodeRuns)
      setEmployeeRuns(snapshot.employeeRuns)
      setSoftwareCommandRuns(snapshot.softwareCommandRuns)
      setComputerSessions(snapshot.computerSessions)
      setComputerActionEvents(snapshot.computerActionEvents)
      setArtifactValidations(snapshot.artifactValidations)
      setApprovalRequests(snapshot.approvalRequests)
      setResourceLocks(snapshot.resourceLocks)
    })

  const refreshSelectedRunSnapshot = async () => {
    if (!selectedRunId) return
    const snapshot = await fetchWorkflowRunSnapshot(selectedRunId)
    setNodeRuns(snapshot.nodeRuns)
    setEmployeeRuns(snapshot.employeeRuns)
    setSoftwareCommandRuns(snapshot.softwareCommandRuns)
    setComputerSessions(snapshot.computerSessions)
    setComputerActionEvents(snapshot.computerActionEvents)
    setArtifactValidations(snapshot.artifactValidations)
    setApprovalRequests(snapshot.approvalRequests)
    setResourceLocks(snapshot.resourceLocks)
    setWorkflowRuns((current) => mergeRuns(current, [snapshot.workflowRun]))
  }

  const recordWorkflowComputerObservation = (
    session: ComputerSessionRow,
    kind: 'observe' | 'screenshot',
  ) =>
    runAction(kind === 'observe' ? 'Computer observation' : 'Screenshot marker', async () => {
      await recordComputerObservation(session.id, {
        summary:
          kind === 'observe'
            ? 'Manual UI observation marker for this workflow workstation.'
            : 'Screenshot marker requested from Canvas; live screen capture is not enabled in this safe runtime.',
        viewport: {
          mode: session.mode,
          employeeRunId: session.employeeRunId,
          captureRequested: kind === 'screenshot',
        },
      })
      await refreshSelectedRunSnapshot()
    })

  const approveRequest = (approvalRequestId: string) =>
    runAction('Approve request', async () => {
      await approveApprovalRequest(approvalRequestId, { decision: 'approved_from_canvas' })
      await refreshSelectedRunSnapshot()
    })

  const rejectRequest = (approvalRequestId: string) =>
    runAction('Reject request', async () => {
      await rejectApprovalRequest(approvalRequestId, { decision: 'rejected_from_canvas' })
      await refreshSelectedRunSnapshot()
    })

  const zoomCanvasAtPoint = useCallback(
    (surface: HTMLDivElement, clientX: number, clientY: number, nextScale: number) => {
      const rect = surface.getBoundingClientRect()
      setViewport((current) => {
        const scale = clamp(nextScale, CANVAS_MIN_SCALE, CANVAS_MAX_SCALE)
        const worldX = (clientX - rect.left - current.x) / current.scale
        const worldY = (clientY - rect.top - current.y) / current.scale
        return {
          x: clientX - rect.left - worldX * scale,
          y: clientY - rect.top - worldY * scale,
          scale,
        }
      })
    },
    [],
  )

  const zoomCanvasFromCenter = useCallback((direction: 1 | -1) => {
    const surface = document.querySelector<HTMLDivElement>('[data-testid="workflow-canvas-surface"]')
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    zoomCanvasAtPoint(
      surface,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      viewport.scale + direction * CANVAS_ZOOM_STEP,
    )
  }, [viewport.scale, zoomCanvasAtPoint])

  const resetCanvasView = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 })
  }, [])

  const focusCanvasAt = useCallback((worldX: number, worldY: number) => {
    const surface = document.querySelector<HTMLDivElement>('[data-testid="workflow-canvas-surface"]')
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    setViewport((current) => ({
      x: rect.width / 2 - worldX * current.scale,
      y: rect.height / 2 - worldY * current.scale,
      scale: current.scale,
    }))
  }, [])

  const fitCanvasView = useCallback(() => {
    const surface = document.querySelector<HTMLDivElement>('[data-testid="workflow-canvas-surface"]')
    if (!surface || nodes.length === 0) {
      resetCanvasView()
      return
    }
    const rect = surface.getBoundingClientRect()
    const minX = Math.min(...nodes.map((node) => node.position.x))
    const minY = Math.min(...nodes.map((node) => node.position.y))
    const maxX = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH))
    const maxY = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT))
    const padding = 120
    const nextScale = clamp(
      Math.min(
        rect.width / Math.max(1, maxX - minX + padding * 2),
        rect.height / Math.max(1, maxY - minY + padding * 2),
      ),
      CANVAS_MIN_SCALE,
      CANVAS_MAX_SCALE,
    )
    setViewport({
      x: rect.width / 2 - ((minX + maxX) / 2) * nextScale,
      y: rect.height / 2 - ((minY + maxY) / 2) * nextScale,
      scale: nextScale,
    })
  }, [nodes, resetCanvasView])

  const clientPointToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const surface = document.querySelector<HTMLDivElement>('[data-testid="workflow-canvas-surface"]')
      if (!surface) return { x: 0, y: 0 }
      const rect = surface.getBoundingClientRect()
      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      }
    },
    [viewport.scale, viewport.x, viewport.y],
  )

  const startConnectionDrag = (event: PointerEvent<HTMLButtonElement>, node: DraftNode) => {
    event.stopPropagation()
    const point = clientPointToCanvas(event.clientX, event.clientY)
    setNodePalette(null)
    setSelectedNodeId(node.id)
    setConnectingFromNodeId(node.id)
    setConnectionDrag({
      pointerId: event.pointerId,
      sourceNodeId: node.id,
      x: point.x,
      y: point.y,
    })
  }

  const completeConnectionDrag = (event: PointerEvent<HTMLButtonElement>, targetNode: DraftNode) => {
    if (!connectionDrag || connectionDrag.sourceNodeId === targetNode.id) return
    event.stopPropagation()
    createEdgeBetween(connectionDrag.sourceNodeId, targetNode.id)
    setConnectionDrag(null)
    setConnectingFromNodeId('')
    setSelectedNodeId(targetNode.id)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>, node: DraftNode) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      nodeId: node.id,
      pointerId: event.pointerId,
      offsetX: (event.clientX - rect.left) / viewport.scale,
      offsetY: (event.clientY - rect.top) / viewport.scale,
    })
  }

  const handleCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const wantsPrimaryPan = event.button === 0 && !isCanvasInteractiveTarget(event.target)
    const wantsMiddlePan = event.button === 1 && !isCanvasFormTarget(event.target)
    if (!wantsPrimaryPan && !wantsMiddlePan) return
    event.preventDefault()
    setNodePalette(null)
    setConnectingFromNodeId('')
    setSelectedNodeId('')
    event.currentTarget.setPointerCapture(event.pointerId)
    setPan({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    })
  }

  const handleCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (connectionDrag?.pointerId === event.pointerId) {
      const point = clientPointToCanvas(event.clientX, event.clientY)
      setConnectionDrag((current) =>
        current && current.pointerId === event.pointerId
          ? { ...current, x: point.x, y: point.y }
          : current,
      )
      return
    }
    if (pan?.pointerId === event.pointerId) {
      setViewport((current) => ({
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
        scale: current.scale,
      }))
      return
    }
    if (!drag) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nextX = clamp(
      (event.clientX - rect.left - viewport.x) / viewport.scale - drag.offsetX,
      CANVAS_MIN_COORD,
      CANVAS_MAX_COORD,
    )
    const nextY = clamp(
      (event.clientY - rect.top - viewport.y) / viewport.scale - drag.offsetY,
      CANVAS_MIN_COORD,
      CANVAS_MAX_COORD,
    )
    setNodes((current) =>
      current.map((node) =>
        node.id === drag.nodeId ? { ...node, position: { x: nextX, y: nextY } } : node,
      ),
    )
  }

  const handleCanvasPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (connectionDrag?.pointerId === event.pointerId) {
      setConnectionDrag(null)
      setConnectingFromNodeId('')
    }
    if (pan?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setPan(null)
    }
    if (drag?.pointerId === event.pointerId) setDrag(null)
  }

  const handleCanvasDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isCanvasInteractiveTarget(event.target)) return
    openNodePalette(event)
  }

  const handleCanvasContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (isCanvasInteractiveTarget(event.target)) return
    event.preventDefault()
    openNodePalette(event)
  }

  const openNodePalette = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const screenX = clamp(event.clientX - rect.left, 12, Math.max(12, rect.width - 236))
    const screenY = clamp(event.clientY - rect.top, 12, Math.max(12, rect.height - 210))
    setNodePalette({
      x: screenX,
      y: screenY,
      canvasPosition: {
      x: clamp(
        (event.clientX - rect.left - viewport.x) / viewport.scale - NODE_WIDTH / 2,
        CANVAS_MIN_COORD,
        CANVAS_MAX_COORD,
      ),
      y: clamp(
        (event.clientY - rect.top - viewport.y) / viewport.scale - NODE_HEIGHT / 2,
        CANVAS_MIN_COORD,
        CANVAS_MAX_COORD,
      ),
      },
    })
  }

  const handleCanvasWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
    event.preventDefault()
    const direction = event.deltaY > 0 ? -1 : 1
    zoomCanvasAtPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
      viewport.scale + direction * CANVAS_ZOOM_STEP,
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[14rem]">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Workflow className="size-4" />
              <span className="truncate">智能体编排画布</span>
            </div>
            <div className="mt-1 grid grid-cols-5 gap-1 text-[10px] text-muted-foreground">
              <Metric label="智能体" value={agents.length} />
              <Metric label="节点" value={nodes.length} />
              <Metric label="连线" value={edges.length} />
              <Metric label="交付" value={customerDeliverableNodes.length} />
              <Metric label="运行" value={workflowRuns.length} />
            </div>
          </div>

          <div className="flex min-w-[20rem] flex-1 flex-wrap items-center justify-end gap-2">
            <div className="min-w-[14rem] max-w-[20rem] flex-1">
              <Select
                value={selectedWorkflowId}
                onChange={setSelectedWorkflowId}
                options={['', ...workflows.map((workflow) => workflow.id)]}
                labels={Object.fromEntries(workflows.map((workflow) => [workflow.id, workflow.name]))}
                emptyLabel="新建流程"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={resetDraft}>
              <Plus className="size-3.5" />
              新建
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => void saveWorkflow()}
              disabled={saving !== null}
            >
              {saving === 'Save workflow' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              保存
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => void preflightWorkflow()}
              disabled={saving !== null || !selectedWorkflowId}
            >
              {saving === 'Preflight workflow' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ClipboardCheck className="size-3.5" />
              )}
              预检
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1"
              onClick={() => void runWorkflow()}
              disabled={saving !== null || !selectedWorkflowId}
            >
              {saving === 'Start workflow run' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              运行
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void reloadLists()}
              disabled={loading}
              title="刷新"
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              variant={showAdvancedPanel ? 'default' : 'outline'}
              className="h-8 gap-1"
              onClick={() => setShowAdvancedPanel((value) => !value)}
            >
              <Eye className="size-3.5" />
              高级设置
            </Button>
          </div>
        </div>
        {(error || notice) && (
          <div
            className={cn(
              'mt-2 rounded-md border px-2 py-1.5 text-[11px]',
              error
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}
          >
            {error ?? notice}
          </div>
        )}
      </div>

      <div
        className={cn(
          'grid min-h-0 min-w-0 flex-1 overflow-hidden',
          showAdvancedPanel ? 'grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-[minmax(0,1fr)]',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card/60 px-3 py-2">
            <div className="min-w-[12rem]">
              <Select
                value={selectedAgentId}
                onChange={setSelectedAgentId}
                options={['', ...agents.map((agent) => agent.id)]}
                labels={Object.fromEntries(agents.map((agent) => [agent.id, agent.name]))}
                emptyLabel="选择智能体"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => addAgentNode()}>
              <Plus className="size-3.5" />
              智能体
            </Button>
            <div className="min-w-[12rem]">
              <Select
                value={selectedSoftwareCommandId}
                onChange={setSelectedSoftwareCommandId}
                options={['', ...softwareCommands.map((command) => command.id)]}
                labels={Object.fromEntries(
                  softwareCommands.map((command) => [command.id, command.name]),
                )}
                emptyLabel="选择软件命令"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => addSoftwareCommandNode()}
            >
              <Wrench className="size-3.5" />
              软件
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => addApprovalNode()}>
              <UserCheck className="size-3.5" />
              审批
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => addConditionNode()}>
              <GitBranch className="size-3.5" />
              条件
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => addArtifactNode()}>
              <ClipboardCheck className="size-3.5" />
              产物
            </Button>
            <div className="ml-auto hidden items-center gap-2 text-[11px] text-muted-foreground xl:flex">
              <span className="truncate">{selectedWorkflow?.name ?? workflowName}</span>
              <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                {nodes.length} 节点 / {edges.length} 连线
              </Badge>
            </div>
          </div>

          <DeliveryOverviewBar
            nodes={customerDeliverableNodes}
            nodeRunByNodeId={nodeRunByNodeId}
            onSelectNode={setSelectedNodeId}
          />

          <div
            data-testid="workflow-canvas-surface"
            tabIndex={0}
            onKeyDown={handleCanvasKeyDown}
            className={cn(
              'relative min-h-0 flex-1 overflow-hidden bg-background',
              pan ? 'cursor-grabbing' : 'cursor-grab',
            )}
            style={{
              backgroundImage:
                'linear-gradient(to right, hsl(var(--border) / 0.45) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.45) 1px, transparent 1px)',
              backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onWheel={handleCanvasWheel}
            onDoubleClick={handleCanvasDoubleClick}
            onContextMenu={handleCanvasContextMenu}
          >
            <CanvasNodePalette
              palette={nodePalette}
              connecting={Boolean(connectingFromNodeId)}
              onClose={() => setNodePalette(null)}
              onAddAgent={() => nodePalette && addAgentNode(nodePalette.canvasPosition)}
              onAddSoftware={() => nodePalette && addSoftwareCommandNode(nodePalette.canvasPosition)}
              onAddApproval={() => nodePalette && addApprovalNode(nodePalette.canvasPosition)}
              onAddCondition={() => nodePalette && addConditionNode(nodePalette.canvasPosition)}
              onAddArtifact={() => nodePalette && addArtifactNode(nodePalette.canvasPosition)}
            />
            <CanvasMiniMap
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onFocus={focusCanvasAt}
            />
            <CanvasViewportControls
              scale={viewport.scale}
              onZoomIn={() => zoomCanvasFromCenter(1)}
              onZoomOut={() => zoomCanvasFromCenter(-1)}
              onReset={resetCanvasView}
              onFit={fitCanvasView}
            />

            {connectingFromNodeId && (
              <div className="absolute left-3 top-3 z-20 rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
                正在连线：请选择目标节点
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 h-6 px-2 text-xs"
                  onClick={() => setConnectingFromNodeId('')}
                >
                  取消
                </Button>
              </div>
            )}

            {nodes.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
                <div className="text-sm font-medium text-foreground">还没有节点</div>
                <div className="pointer-events-auto flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1"
                    onDoubleClick={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      addAgentNode()
                    }}
                  >
                    <Plus className="size-3.5" />
                    添加智能体
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onDoubleClick={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      addSoftwareCommandNode()
                    }}
                  >
                    <Wrench className="size-3.5" />
                    添加软件
                  </Button>
                </div>
              </div>
            ) : null}

            <div
              className="pointer-events-none absolute inset-0 origin-top-left"
              style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
            >
              <CanvasEdges nodes={nodes} edges={edges} />
              <CanvasConnectionPreview nodes={nodes} connectionDrag={connectionDrag} />
              {nodes.map((node) => {
                  const agent = node.agentProfileId ? agentById.get(node.agentProfileId) : null
                  const softwareCommand = node.softwareCommandId
                    ? softwareCommandById.get(node.softwareCommandId)
                    : null
                  const nodeRun = nodeRunByNodeId.get(node.id)
                  const displayName = node.label || agent?.name || softwareCommand?.name || nodeTypeLabel(node.type)
                  const displayDescription =
                    agent?.role ?? softwareCommand?.description ?? nodeDescription(node)
                  const artifactType = artifactTypeOf(node)
                  const selected = selectedNodeId === node.id
                  const connecting = connectingFromNodeId === node.id
                  const canReceiveConnection =
                    Boolean(connectingFromNodeId || connectionDrag) &&
                    connectingFromNodeId !== node.id &&
                    connectionDrag?.sourceNodeId !== node.id
                  const runState = canvasNodeRunState(nodeRun ?? null)
                  return (
                    <div
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      data-testid="workflow-canvas-node"
                      data-canvas-interactive="true"
                      data-node-id={node.id}
                      data-run-state={runState}
                      onClick={() => handleNodeClick(node)}
                      onPointerDown={(event) => handlePointerDown(event, node)}
                      className={cn(
                        'pointer-events-auto group absolute flex cursor-grab flex-col rounded-md border bg-card p-2 text-left shadow-sm transition hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40',
                        canvasNodeContainerClassName(runState),
                        selected && 'z-10 border-primary shadow-md ring-2 ring-primary/20',
                        connecting && 'z-20 border-amber-500 shadow-md ring-2 ring-amber-500/20',
                        drag?.nodeId === node.id && 'z-30 cursor-grabbing border-primary shadow-md',
                      )}
                      style={{
                        width: NODE_WIDTH,
                        height: NODE_HEIGHT,
                        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                      }}
                    >
                    <button
                      type="button"
                      data-testid="canvas-node-input-port"
                      aria-label="连接到这个节点"
                      title="连接到这个节点"
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerUp={(event) => completeConnectionDrag(event, node)}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (connectingFromNodeId && connectingFromNodeId !== node.id) {
                          createEdgeBetween(connectingFromNodeId, node.id)
                          setConnectingFromNodeId('')
                        }
                        setSelectedNodeId(node.id)
                      }}
                      className={cn(
                        'absolute -left-2.5 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border bg-background shadow-sm transition hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground',
                        canReceiveConnection
                          ? 'border-primary bg-primary text-primary-foreground opacity-100 ring-4 ring-primary/10'
                          : 'border-border text-muted-foreground opacity-60 group-hover:opacity-100',
                      )}
                    />
                    <button
                      type="button"
                      data-testid="canvas-node-output-port"
                      aria-label="拖拽从这个节点开始连线"
                      title="拖拽从这个节点开始连线"
                      onPointerDown={(event) => startConnectionDrag(event, node)}
                      onPointerUp={(event) => {
                        event.stopPropagation()
                        if (connectionDrag?.pointerId === event.pointerId) {
                          setConnectionDrag(null)
                        }
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedNodeId(node.id)
                      }}
                      className={cn(
                        'absolute -right-2.5 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border bg-background shadow-sm transition hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground',
                        connecting
                          ? 'border-amber-500 bg-amber-500 text-white opacity-100'
                          : 'border-border text-muted-foreground opacity-60 group-hover:opacity-100',
                      )}
                    />
                    <div className="flex items-start justify-between gap-1">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                        {node.type === 'agent_employee' ? (
                          <Bot className="size-3.5 shrink-0" />
                        ) : node.type === 'software_command' ? (
                          <Wrench className="size-3.5 shrink-0" />
                        ) : node.type === 'webhook_trigger' ? (
                          <Workflow className="size-3.5 shrink-0" />
                        ) : node.type === 'condition' ? (
                          <GitBranch className="size-3.5 shrink-0" />
                        ) : (
                          <UserCheck className="size-3.5 shrink-0" />
                        )}
                        {selected ? (
                          <input
                            value={node.label}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateNode(node.id, {
                                label: event.target.value,
                                config: { ...node.config, label: event.target.value },
                              })
                            }
                            className="min-w-0 flex-1 rounded border-0 bg-muted/60 px-1 py-0.5 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                            aria-label="节点名称"
                          />
                        ) : (
                          <span className="truncate">{displayName}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          removeNode(node.id)
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="删除节点"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                    <div className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                      {displayDescription}
                    </div>
                    <CanvasNodeStatusStrip nodeRun={nodeRun ?? null} />
                    <div className="mt-1 flex min-w-0 items-center gap-1">
                      <ArtifactChip type={artifactType} compact />
                      {customerVisibleOf(node) && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                          客户可见
                        </Badge>
                      )}
                    </div>
                    <CanvasDeliveryPreview
                      node={node}
                      nodeRun={nodeRun ?? null}
                      artifactType={artifactType}
                    />
                    <CanvasNodeProgress nodeRun={nodeRun ?? null} artifactType={artifactType} />
                    <div className="mt-auto flex items-center justify-between gap-1">
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                        {nodeTypeLabel(node.type)}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {nodeRun ? <StatusBadge status={nodeRun.status} /> : <Grip className="size-3 text-muted-foreground" />}
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation()
                            setConnectingFromNodeId((current) => (current === node.id ? '' : node.id))
                            setSelectedNodeId(node.id)
                          }}
                          className={cn(
                            'rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground',
                            connecting && 'bg-amber-500/10 text-amber-600',
                          )}
                          title="从这个节点开始连线"
                        >
                          <GitBranch className="size-3" />
                        </button>
                      </div>
                    </div>
                    </div>
                  )
                })}
            </div>

            <CanvasQuickEditor
              node={selectedNode}
              agents={agents}
              softwareCommands={softwareCommands}
              onUpdateNode={updateNode}
              onRemoveNode={removeNode}
              onStartConnect={setConnectingFromNodeId}
            />
            <CustomerDeliveryDock
              nodes={customerDeliverableNodes}
              nodeRunByNodeId={nodeRunByNodeId}
            />
          </div>
        </div>

        {showAdvancedPanel && (
        <div className="min-h-0 space-y-3 overflow-y-auto border-l bg-muted/20 p-3">
          <CustomerDeliverablesPanel
            nodes={nodes}
            nodeRunByNodeId={nodeRunByNodeId}
            artifactValidations={artifactValidations}
          />
          <Section icon={<Workflow className="size-3.5" />} title="流程设置">
            <Input
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              placeholder="流程名称"
            />
            <Textarea
              className="min-h-16 text-xs"
              value={workflowDescription}
              onChange={(event) => setWorkflowDescription(event.target.value)}
              placeholder="流程说明"
            />
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <Select
                value={selectedPresetId}
                onChange={setSelectedPresetId}
                options={workflowPresets.map((preset) => preset.id)}
                labels={Object.fromEntries(workflowPresets.map((preset) => [preset.id, preset.title]))}
                emptyLabel="选择模板"
              />
              <Button
                className="h-8 gap-1"
                variant="outline"
                onClick={() => void installPreset()}
                disabled={saving !== null || !selectedPreset}
              >
                {saving === 'Install preset' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                安装
              </Button>
              <Button
                className="h-8 gap-1"
                onClick={() => void runPreset()}
                disabled={saving !== null || !selectedPreset}
              >
                {saving === 'Run preset' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                运行
              </Button>
            </div>
            <PresetPreview preset={selectedPreset} />
            <PreflightSummary preflight={latestPreflight} />
          </Section>

          <Section icon={<Sparkles className="size-3.5" />} title="一句话生成">
            <Textarea
              className="min-h-16 text-xs"
              value={nlPrompt}
              onChange={(event) => setNlPrompt(event.target.value)}
              placeholder="当 GitHub 有新 Issue 时..."
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="h-8 gap-1"
                variant="outline"
                onClick={() => void generateNaturalWorkflow()}
                disabled={saving !== null}
              >
                {saving === 'Generate workflow draft' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                生成草稿
              </Button>
              <Button
                className="h-8 gap-1"
                onClick={() => void confirmGeneratedWorkflow()}
                disabled={saving !== null || !selectedNlDraft}
              >
                {saving === 'Confirm generated workflow' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ClipboardCheck className="size-3.5" />
                )}
                确认流程
              </Button>
            </div>
            <Select
              value={selectedNlDraftId}
              onChange={(value) => {
                setSelectedNlDraftId(value)
                const draft = nlDrafts.find((row) => row.id === value)
                if (draft) applyNlDraftToCanvas(draft)
              }}
              options={['', ...nlDrafts.map((draft) => draft.id)]}
              labels={Object.fromEntries(nlDrafts.map((draft) => [draft.id, draft.name]))}
              emptyLabel="选择草稿"
            />
            {selectedNlDraft && (
              <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
                <div className="line-clamp-2 text-muted-foreground">{nlDraftSummary(selectedNlDraft)}</div>
                <div className="mt-1 font-medium">{nlDraftConfirmationText(selectedNlDraft)}</div>
              </div>
            )}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                value={nlRevision}
                onChange={(event) => setNlRevision(event.target.value)}
                placeholder="修改要求"
              />
              <Button
                className="h-8 gap-1"
                variant="outline"
                onClick={() => void reviseNaturalWorkflow()}
                disabled={saving !== null || !selectedNlDraft}
              >
                {saving === 'Modify workflow draft' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <GitBranch className="size-3.5" />
                )}
                修改
              </Button>
            </div>
          </Section>

          <NodeInspector
            node={selectedNode}
            agents={agents}
            softwareCommands={softwareCommands}
            edges={edges}
            nodes={nodes}
            onUpdateNode={updateNode}
            onRemoveNode={removeNode}
            onRemoveEdge={removeEdge}
            onStartConnect={setConnectingFromNodeId}
          />

          <Section icon={<Play className="size-3.5" />} title="运行与监控">
            <Textarea
              className="min-h-20 font-mono text-xs"
              value={runInput}
              onChange={(event) => setRunInput(event.target.value)}
            />
            <Input
              value={preflightBudget}
              onChange={(event) => setPreflightBudget(event.target.value)}
              placeholder="预检预算，单位分"
            />
            <Select
              value={selectedRunId}
              onChange={setSelectedRunId}
              options={['', ...workflowRuns.map((run) => run.id)]}
              labels={Object.fromEntries(
                workflowRuns.map((run) => [
                  run.id,
                  `${statusLabel(run.status)} / ${workflows.find((workflow) => workflow.id === run.workflowId)?.name ?? run.workflowId}`,
                ]),
              )}
              emptyLabel="选择运行记录"
            />
            <RunStatusList runs={workflowRuns.slice(0, 6)} selectedRunId={selectedRunId} />
            <NodeRunList nodeRuns={nodeRuns} nodes={nodes} agentById={agentById} />
            <EmployeeRunList runs={employeeRuns} agentById={agentById} />
            <SoftwareCommandRunList runs={softwareCommandRuns} commandById={softwareCommandById} />
            <ComputerSessionList
              sessions={computerSessions}
              actions={computerActionEvents}
              onMark={recordWorkflowComputerObservation}
              busy={!!saving}
            />
            <ArtifactValidationList validations={artifactValidations} />
            <ResourceLockList locks={resourceLocks} />
            <ApprovalRequestList
              requests={approvalRequests}
              saving={saving}
              onApprove={approveRequest}
              onReject={rejectRequest}
            />
          </Section>
        </div>
        )}
      </div>
    </div>
  )
}

function CanvasViewportControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFit: () => void
}) {
  return (
    <div
      data-testid="canvas-viewport-controls"
      data-canvas-interactive="true"
      className="pointer-events-auto absolute bottom-3 right-3 z-30 flex items-center gap-1 rounded-md border bg-card/95 p-1 shadow-sm backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <Button size="icon" variant="ghost" className="size-7" onClick={onZoomOut} title="缩小画布">
        <Minus className="size-3.5" />
      </Button>
      <button
        type="button"
        data-testid="canvas-zoom-level"
        className="h-7 min-w-12 rounded px-2 text-center font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onReset}
        title="重置为 100%"
      >
        {Math.round(scale * 100)}%
      </button>
      <Button size="icon" variant="ghost" className="size-7" onClick={onZoomIn} title="放大画布">
        <Plus className="size-3.5" />
      </Button>
      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={onFit} title="适配视图">
        <Maximize2 className="size-3.5" />
        适配
      </Button>
    </div>
  )
}

function CanvasNodePalette({
  palette,
  connecting,
  onClose,
  onAddAgent,
  onAddSoftware,
  onAddApproval,
  onAddCondition,
  onAddArtifact,
}: {
  palette: CanvasNodePaletteState | null
  connecting: boolean
  onClose: () => void
  onAddAgent: () => void
  onAddSoftware: () => void
  onAddApproval: () => void
  onAddCondition: () => void
  onAddArtifact: () => void
}) {
  if (!palette) return null

  const actions = [
    { label: '智能体', description: '员工节点', icon: <Bot className="size-3.5" />, onClick: onAddAgent },
    { label: '软件', description: 'CLI / MCP / 命令', icon: <Wrench className="size-3.5" />, onClick: onAddSoftware },
    { label: '审批', description: '人工确认', icon: <UserCheck className="size-3.5" />, onClick: onAddApproval },
    { label: '条件', description: '分支判断', icon: <GitBranch className="size-3.5" />, onClick: onAddCondition },
    { label: '产物', description: '处理交付物', icon: <ClipboardCheck className="size-3.5" />, onClick: onAddArtifact },
  ]

  return (
    <div
      data-testid="canvas-node-palette"
      data-canvas-interactive="true"
      className="pointer-events-auto absolute z-50 w-56 rounded-md border bg-card/95 p-2 shadow-lg backdrop-blur"
      style={{ left: palette.x, top: palette.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">添加节点</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {connecting ? '会自动接到当前连线源' : '放到当前位置'}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="size-6" onClick={onClose} title="关闭">
          <X className="size-3" />
        </Button>
      </div>
      <div className="grid gap-1">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-xs transition hover:border-primary/60 hover:bg-primary/5"
            onClick={action.onClick}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
              {action.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{action.label}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {action.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CanvasMiniMap({
  nodes,
  selectedNodeId,
  onFocus,
}: {
  nodes: DraftNode[]
  selectedNodeId: string
  onFocus: (worldX: number, worldY: number) => void
}) {
  const mapWidth = 172
  const mapHeight = 108
  const padding = 14
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, scale: 1 }
    }
    const minX = Math.min(...nodes.map((node) => node.position.x))
    const minY = Math.min(...nodes.map((node) => node.position.y))
    const maxX = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH))
    const maxY = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT))
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    return {
      minX,
      minY,
      maxX,
      maxY,
      scale: Math.min((mapWidth - padding * 2) / width, (mapHeight - padding * 2) / height),
    }
  }, [nodes])

  if (nodes.length === 0) return null

  const mapNode = (node: DraftNode) => ({
    x: padding + (node.position.x - bounds.minX) * bounds.scale,
    y: padding + (node.position.y - bounds.minY) * bounds.scale,
    width: Math.max(8, NODE_WIDTH * bounds.scale),
    height: Math.max(7, NODE_HEIGHT * bounds.scale),
  })

  const focusFromPoint = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp(event.clientX - rect.left, padding, mapWidth - padding)
    const y = clamp(event.clientY - rect.top, padding, mapHeight - padding)
    const worldX = bounds.minX + (x - padding) / bounds.scale
    const worldY = bounds.minY + (y - padding) / bounds.scale
    onFocus(worldX, worldY)
  }

  return (
    <div
      data-testid="canvas-minimap"
      data-canvas-interactive="true"
      className="pointer-events-auto absolute bottom-14 right-3 z-30 rounded-md border bg-card/95 p-2 shadow-sm backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>画布总览</span>
        <span>{nodes.length} 节点</span>
      </div>
      <div
        data-testid="canvas-minimap-map"
        className="relative overflow-hidden rounded border bg-muted/30"
        style={{ width: mapWidth, height: mapHeight }}
        onClick={focusFromPoint}
      >
        {nodes.map((node) => {
          const box = mapNode(node)
          return (
            <div
              key={node.id}
              className={cn(
                'absolute rounded-[2px] border',
                node.id === selectedNodeId
                  ? 'border-primary bg-primary/70'
                  : 'border-foreground/20 bg-foreground/20',
              )}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function CanvasEdges({ nodes, edges }: { nodes: DraftNode[]; edges: DraftEdge[] }) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <defs>
        <marker
          id="agent-canvas-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" className="fill-muted-foreground" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const source = nodeMap.get(edge.sourceNodeId)
        const target = nodeMap.get(edge.targetNodeId)
        if (!source || !target) return null
        const x1 = source.position.x + NODE_WIDTH
        const y1 = source.position.y + NODE_HEIGHT / 2
        const x2 = target.position.x
        const y2 = target.position.y + NODE_HEIGHT / 2
        const mid = Math.max(36, Math.abs(x2 - x1) / 2)
        return (
          <path
            key={edge.id}
            data-testid="workflow-canvas-edge"
            d={`M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`}
            className="fill-none stroke-muted-foreground/70"
            strokeWidth="1.5"
            markerEnd="url(#agent-canvas-arrow)"
          />
        )
      })}
    </svg>
  )
}

function CanvasConnectionPreview({
  nodes,
  connectionDrag,
}: {
  nodes: DraftNode[]
  connectionDrag: ConnectionDragState | null
}) {
  const source = connectionDrag
    ? nodes.find((node) => node.id === connectionDrag.sourceNodeId)
    : null
  if (!source || !connectionDrag) return null
  const x1 = source.position.x + NODE_WIDTH
  const y1 = source.position.y + NODE_HEIGHT / 2
  const x2 = connectionDrag.x
  const y2 = connectionDrag.y
  const mid = Math.max(36, Math.abs(x2 - x1) / 2)
  return (
    <svg
      data-testid="workflow-canvas-connection-preview"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <path
        d={`M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`}
        className="fill-none stroke-primary"
        strokeDasharray="7 5"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx={x2} cy={y2} r="4" className="fill-primary" />
    </svg>
  )
}

function CustomerDeliveryDock({
  nodes,
  nodeRunByNodeId,
}: {
  nodes: DraftNode[]
  nodeRunByNodeId: Map<string, WorkflowNodeRunRow>
}) {
  if (nodes.length === 0) return null
  return (
    <div
      data-testid="canvas-customer-delivery-dock"
      data-canvas-interactive="true"
      className="pointer-events-auto absolute bottom-3 left-3 z-30 w-[min(27rem,calc(100%-1.5rem))] rounded-md border bg-card/95 p-2.5 shadow-lg backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <Share2 className="size-3.5 text-primary" />
          <span className="truncate">客户交付物</span>
        </div>
        <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
          {nodes.length} 个
        </Badge>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {nodes.slice(0, 4).map((node) => (
          <CustomerDeliverableMini
            key={node.id}
            node={node}
            nodeRun={nodeRunByNodeId.get(node.id) ?? null}
          />
        ))}
      </div>
      {nodes.length > 4 && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          还有 {nodes.length - 4} 个交付物，可在右侧高级设置里查看。
        </div>
      )}
    </div>
  )
}

function DeliveryOverviewBar({
  nodes,
  nodeRunByNodeId,
  onSelectNode,
}: {
  nodes: DraftNode[]
  nodeRunByNodeId: Map<string, WorkflowNodeRunRow>
  onSelectNode: (nodeId: string) => void
}) {
  const typeCounts = countDeliverablesByType(nodes)
  const completed = nodes.filter((node) => nodeRunByNodeId.get(node.id)?.status === 'complete').length
  const running = nodes.filter((node) => nodeRunByNodeId.get(node.id)?.status === 'running').length

  return (
    <div
      data-testid="canvas-delivery-overview-bar"
      className="shrink-0 border-b bg-background/95 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-semibold">
          <Share2 className="size-3.5 text-primary" />
          <span>客户最终能看到</span>
        </div>
        {nodes.length === 0 ? (
          <div className="truncate text-xs text-muted-foreground">
            还没有客户可见产物。选中节点后，把“客户可见”打开并选择报告、代码、图片、视频或文件包。
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
              <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                {nodes.length} 个交付物
              </Badge>
              <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                已产出 {completed}
              </Badge>
              {running > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">
                  生成中 {running}
                </Badge>
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:thin]">
              {nodes.map((node) => {
                const type = artifactTypeOf(node)
                const state = deliveryStateLabel(nodeRunByNodeId.get(node.id) ?? null)
                return (
                  <button
                    key={node.id}
                    type="button"
                    className="flex h-7 max-w-[12rem] shrink-0 items-center gap-1.5 rounded-md border bg-card px-2 text-[10px] transition hover:border-primary/60"
                    onClick={() => onSelectNode(node.id)}
                    title={`${deliveryTitleOf(node)} · ${deliveryDescriptionOf(node)}`}
                  >
                    {artifactTypeIcon(type, 'size-3 shrink-0 text-primary')}
                    <span className="truncate font-medium">{deliveryTitleOf(node)}</span>
                    <span className="shrink-0 text-muted-foreground">{state}</span>
                  </button>
                )
              })}
            </div>
            <div className="hidden shrink-0 items-center gap-1 xl:flex">
              {typeCounts.slice(0, 4).map(({ type, count }) => (
                <Badge key={type} variant="outline" className="h-5 gap-1 px-1.5 text-[9px]">
                  {artifactTypeIcon(type, 'size-3')}
                  {artifactTypeLabel(type)} {count}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CustomerDeliverablesPanel({
  nodes,
  nodeRunByNodeId,
  artifactValidations,
}: {
  nodes: DraftNode[]
  nodeRunByNodeId: Map<string, WorkflowNodeRunRow>
  artifactValidations: ArtifactValidationRow[]
}) {
  const deliverables = nodes.filter((node) => customerVisibleOf(node))
  const typeCounts = countDeliverablesByType(deliverables)
  const completedDeliverables = deliverables.filter(
    (node) => nodeRunByNodeId.get(node.id)?.status === 'complete',
  ).length
  const pendingDeliverables = Math.max(0, deliverables.length - completedDeliverables)
  return (
    <section data-testid="canvas-customer-deliverables-panel">
      <Section icon={<Share2 className="size-3.5" />} title="客户交付物">
      {deliverables.length === 0 ? (
        <EmptyLine text="还没有设置客户可见的交付物" />
      ) : (
        <>
          <CustomerDeliverySummaryCard
            nodes={deliverables}
            nodeRunByNodeId={nodeRunByNodeId}
            artifactValidations={artifactValidations}
          />
          <div className="grid grid-cols-4 gap-1">
            <MiniMetric label="交付物" value={deliverables.length} />
            <MiniMetric label="类型" value={typeCounts.length} />
            <MiniMetric label="已产出" value={completedDeliverables} />
            <MiniMetric label="待产出" value={pendingDeliverables} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <MiniMetric label="校验" value={artifactValidations.length} />
            <MiniMetric label="客户可见" value={deliverables.length} />
          </div>
          <div className="flex flex-wrap gap-1">
            {typeCounts.map(({ type, count }) => (
              <Badge key={type} variant="outline" className="h-5 gap-1 px-1.5 text-[9px]">
                {artifactTypeIcon(type, 'size-3')}
                {artifactTypeLabel(type)} {count}
              </Badge>
            ))}
          </div>
          <CustomerAcceptancePreviewBoard
            nodes={deliverables}
            nodeRunByNodeId={nodeRunByNodeId}
            artifactValidations={artifactValidations}
          />
          <div className="space-y-1.5">
            {deliverables.map((node) => (
              <CustomerDeliverableRow
                key={node.id}
                node={node}
                nodeRun={nodeRunByNodeId.get(node.id) ?? null}
              />
            ))}
          </div>
        </>
      )}
      </Section>
    </section>
  )
}

function CustomerDeliverySummaryCard({
  nodes,
  nodeRunByNodeId,
  artifactValidations,
}: {
  nodes: DraftNode[]
  nodeRunByNodeId: Map<string, WorkflowNodeRunRow>
  artifactValidations: ArtifactValidationRow[]
}) {
  const primaryNode =
    nodes.find((node) => nodeRunByNodeId.get(node.id)?.status === 'complete') ?? nodes[0]
  const primaryType = artifactTypeOf(primaryNode)
  const completed = nodes.filter((node) => nodeRunByNodeId.get(node.id)?.status === 'complete').length
  const typeCounts = countDeliverablesByType(nodes)
  const nextStep =
    completed === nodes.length
      ? '进入客户验收'
      : completed > 0
        ? '继续补齐剩余产物'
        : '等待智能体产出'

  return (
    <div
      data-testid="canvas-customer-delivery-summary"
      className="overflow-hidden rounded-md border bg-primary/5"
    >
      <div className="border-b bg-background/70 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
            <Eye className="size-3.5 text-primary" />
            <span className="truncate">客户交付总览</span>
          </div>
          <Badge variant={completed === nodes.length ? 'default' : 'outline'} className="h-5 px-1.5 text-[9px]">
            {completed}/{nodes.length} 已产出
          </Badge>
        </div>
      </div>

      <div className="space-y-2 p-2.5">
        <div className="rounded-md border bg-background px-2 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-muted-foreground">主交付</div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                {artifactTypeIcon(primaryType, 'size-3.5 shrink-0 text-primary')}
                <span className="truncate">{deliveryTitleOf(primaryNode)}</span>
              </div>
            </div>
            <Badge variant="outline" className="h-5 shrink-0 gap-1 px-1.5 text-[9px]">
              {artifactTypeLabel(primaryType)}
            </Badge>
          </div>
          <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
            {deliveryDescriptionOf(primaryNode)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <DeliveryDatum label="客户拿到" value={artifactExpectedFile(primaryType)} />
          <DeliveryDatum label="验收下一步" value={nextStep} />
          <DeliveryDatum label="校验记录" value={`${artifactValidations.length} 条`} />
          <DeliveryDatum label="交付类型" value={typeCounts.map(({ type, count }) => `${artifactTypeLabel(type)} ${count}`).join(' / ')} />
        </div>
      </div>
    </div>
  )
}

function CustomerAcceptancePreviewBoard({
  nodes,
  nodeRunByNodeId,
  artifactValidations,
}: {
  nodes: DraftNode[]
  nodeRunByNodeId: Map<string, WorkflowNodeRunRow>
  artifactValidations: ArtifactValidationRow[]
}) {
  const readyCount = nodes.filter((node) => nodeRunByNodeId.get(node.id)?.status === 'complete').length
  return (
    <div data-testid="canvas-customer-preview-board" className="rounded-md border bg-background p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Eye className="size-3.5 text-primary" />
            <span>客户验收视图</span>
          </div>
          <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
            每个智能体必须产出什么、客户能怎么预览、最终拿到什么文件。
          </div>
        </div>
        <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px]">
          {readyCount}/{nodes.length} 可验收
        </Badge>
      </div>
      <div className="mt-2 grid gap-1.5">
        {nodes.slice(0, 6).map((node) => (
          <CustomerDeliverablePreviewCard
            key={node.id}
            node={node}
            nodeRun={nodeRunByNodeId.get(node.id) ?? null}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
        <DeliveryDatum label="验收记录" value={`${artifactValidations.length} 条`} />
        <DeliveryDatum label="客户视角" value="预览 + 下载 + 状态" />
      </div>
    </div>
  )
}

function CustomerDeliverablePreviewCard({
  node,
  nodeRun,
}: {
  node: DraftNode
  nodeRun: WorkflowNodeRunRow | null
}) {
  const type = artifactTypeOf(node)
  return (
    <div data-testid="canvas-customer-preview-card" className="rounded-md border bg-muted/20 p-2 text-[10px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 font-medium">
            {artifactTypeIcon(type, 'size-3.5 shrink-0 text-primary')}
            <span className="truncate">{deliveryTitleOf(node)}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">
            {deliveryDescriptionOf(node)}
          </div>
        </div>
        <Badge variant={nodeRun?.status === 'complete' ? 'secondary' : 'outline'} className="h-5 shrink-0 px-1.5 text-[9px]">
          {deliveryStateLabel(nodeRun)}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <DeliveryDatum label="负责节点" value={nodeLabel(node)} />
        <DeliveryDatum label="预览形式" value={artifactPreviewMode(type)} />
        <DeliveryDatum label="交付文件" value={artifactExpectedFile(type)} />
        <DeliveryDatum label="验收口径" value={artifactAcceptanceHint(type)} />
      </div>
    </div>
  )
}

function ArtifactTypeQuickPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1" data-testid="artifact-type-quick-picker">
      {CUSTOMER_ARTIFACT_QUICK_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={cn(
            'flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] transition hover:border-primary/60',
            value === type
              ? 'border-primary bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground',
          )}
          onClick={() => onChange(type)}
          title={`交付 ${artifactTypeLabel(type)}，通常是${artifactFileHint(type)}`}
        >
          {artifactTypeIcon(type, 'size-3')}
          <span>{artifactTypeLabel(type)}</span>
        </button>
      ))}
    </div>
  )
}

function CustomerDeliverableMini({
  node,
  nodeRun,
}: {
  node: DraftNode
  nodeRun: WorkflowNodeRunRow | null
}) {
  const type = artifactTypeOf(node)
  const state = deliveryStateLabel(nodeRun)
  return (
    <button
      type="button"
      className="min-w-0 rounded-md border bg-background/70 px-2 py-1.5 text-left"
      title={deliveryDescriptionOf(node)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {artifactTypeIcon(type, 'size-3.5 shrink-0 text-primary')}
          <span className="truncate text-[11px] font-medium">{deliveryTitleOf(node)}</span>
        </span>
        {nodeRun ? <StatusBadge status={nodeRun.status} /> : null}
      </div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground">
        {artifactTypeLabel(type)} · {artifactFileHint(type)}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate text-muted-foreground">当前产物</span>
        <span className="shrink-0 font-medium">{state}</span>
      </div>
    </button>
  )
}

function CustomerDeliverableRow({
  node,
  nodeRun,
}: {
  node: DraftNode
  nodeRun: WorkflowNodeRunRow | null
}) {
  const type = artifactTypeOf(node)
  const state = deliveryStateLabel(nodeRun)
  return (
    <div className="rounded-md border bg-background px-2 py-2 text-[11px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 font-medium">
            {artifactTypeIcon(type, 'size-3.5 shrink-0 text-primary')}
            <span className="truncate">{deliveryTitleOf(node)}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">
            {deliveryDescriptionOf(node)}
          </div>
        </div>
        {nodeRun ? <StatusBadge status={nodeRun.status} /> : <ArtifactChip type={type} compact />}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
          {artifactTypeLabel(type)}
        </Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
          {artifactFileHint(type)}
        </Badge>
        <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">
          客户可见
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <DeliveryDatum label="当前产物" value={`${artifactTypeLabel(type)} · ${artifactFileHint(type)}`} />
        <DeliveryDatum label="验收状态" value={state} />
      </div>
    </div>
  )
}

function CanvasDeliveryPreview({
  node,
  nodeRun,
  artifactType,
}: {
  node: DraftNode
  nodeRun: WorkflowNodeRunRow | null
  artifactType: string
}) {
  return (
    <div
      data-testid="canvas-node-delivery-card"
      className="mt-1 rounded-md border bg-background/70 px-2 py-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[9px] font-medium text-muted-foreground">交付清单</span>
        <span className="shrink-0 text-[9px] font-medium">{deliveryStateLabel(nodeRun)}</span>
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1 text-[10px]">
        {artifactTypeIcon(artifactType, 'size-3 shrink-0 text-primary')}
        <span className="truncate">{artifactTypeLabel(artifactType)} · {artifactFileHint(artifactType)}</span>
      </div>
      <div className="mt-1 truncate text-[9px] text-muted-foreground">
        {customerVisibleOf(node) ? '客户可见' : '内部产物'} · {deliveryTitleOf(node)}
      </div>
    </div>
  )
}

function DeliveryDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-2 py-1">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[10px] font-medium">{value}</div>
    </div>
  )
}

function ArtifactChip({ type, compact = false }: { type: string; compact?: boolean }) {
  return (
    <Badge variant="outline" className={cn('gap-1 px-1.5', compact ? 'h-4 text-[9px]' : 'h-5 text-[10px]')}>
      {artifactTypeIcon(type, compact ? 'size-2.5' : 'size-3')}
      <span className="truncate">{artifactTypeLabel(type)}</span>
    </Badge>
  )
}

function CanvasNodeStatusStrip({ nodeRun }: { nodeRun: WorkflowNodeRunRow | null }) {
  const state = canvasNodeRunState(nodeRun)
  const progress = canvasNodeProgress(nodeRun)
  const meta = canvasNodeStatusMeta(state)

  return (
    <div
      data-testid="canvas-node-status-strip"
      data-node-phase={state}
      className={cn('mt-1 rounded-md border px-2 py-1.5 text-[9px]', meta.className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 font-medium">
          {meta.icon}
          <span className="truncate">运行状态 · {progress.label}</span>
        </span>
        <span className="shrink-0 font-mono">{progress.percent}%</span>
      </div>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-muted-foreground">
        <span className="line-clamp-1">{progress.step}</span>
        <span className="shrink-0 rounded-full bg-background/70 px-1.5 py-0.5">
          下一步：{meta.nextAction}
        </span>
      </div>
    </div>
  )
}

function CanvasNodeProgress({
  nodeRun,
  artifactType,
}: {
  nodeRun: WorkflowNodeRunRow | null
  artifactType: string
}) {
  const progress = canvasNodeProgress(nodeRun)
  return (
    <div data-testid="canvas-node-progress" className="mt-2 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
        <span className="truncate">
          节点进度 · {progress.label}
        </span>
        <span className="font-mono text-[9px]">{progress.percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', progress.barClassName)}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-1 text-[9px] text-muted-foreground">
        <span className="line-clamp-1">{progress.step}</span>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5">
          交付 {artifactTypeLabel(artifactType)}
        </span>
      </div>
    </div>
  )
}

type CanvasNodeRunState = 'idle' | 'queued' | 'running' | 'paused' | 'complete' | 'failed'

function canvasNodeRunState(nodeRun: WorkflowNodeRunRow | null): CanvasNodeRunState {
  if (!nodeRun) return 'idle'
  const phase = nodeRun.progressStatus || nodeRun.status
  if (nodeRun.status === 'complete' || phase === 'complete') return 'complete'
  if (nodeRun.status === 'failed' || nodeRun.status === 'aborted' || phase === 'approval_rejected') {
    return 'failed'
  }
  if (nodeRun.status === 'paused' || phase === 'waiting_for_approval') return 'paused'
  if (nodeRun.status === 'running' || phase === 'running' || phase === 'approval_approved') return 'running'
  return 'queued'
}

function canvasNodeContainerClassName(state: CanvasNodeRunState): string {
  const classes: Record<CanvasNodeRunState, string> = {
    idle: 'border-border',
    queued: 'border-sky-500/50 bg-sky-500/5',
    running: 'border-primary/80 bg-primary/10 shadow-primary/10 ring-2 ring-primary/15',
    paused: 'border-amber-500/80 bg-amber-500/10 shadow-amber-500/10 ring-2 ring-amber-500/15',
    complete: 'border-emerald-500/80 bg-emerald-500/10 shadow-emerald-500/10 ring-2 ring-emerald-500/15',
    failed: 'border-destructive/80 bg-destructive/10 shadow-destructive/10 ring-2 ring-destructive/15',
  }
  return classes[state]
}

function canvasNodeStatusMeta(state: CanvasNodeRunState): {
  icon: ReactNode
  className: string
  nextAction: string
} {
  const meta: Record<CanvasNodeRunState, { icon: ReactNode; className: string; nextAction: string }> = {
    idle: {
      icon: <Clock3 className="size-3 shrink-0" />,
      className: 'border-border bg-background/70',
      nextAction: '等待运行',
    },
    queued: {
      icon: <Clock3 className="size-3 shrink-0 text-sky-600" />,
      className: 'border-sky-500/30 bg-sky-500/10',
      nextAction: '等待上游',
    },
    running: {
      icon: <Activity className="size-3 shrink-0 text-primary" />,
      className: 'border-primary/30 bg-primary/10',
      nextAction: '继续执行',
    },
    paused: {
      icon: <UserCheck className="size-3 shrink-0 text-amber-600" />,
      className: 'border-amber-500/30 bg-amber-500/10',
      nextAction: '人工审批',
    },
    complete: {
      icon: <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />,
      className: 'border-emerald-500/30 bg-emerald-500/10',
      nextAction: '交付检查',
    },
    failed: {
      icon: <AlertCircle className="size-3 shrink-0 text-destructive" />,
      className: 'border-destructive/30 bg-destructive/10',
      nextAction: '处理失败',
    },
  }
  return meta[state]
}

function canvasNodeProgress(nodeRun: WorkflowNodeRunRow | null): {
  label: string
  step: string
  percent: number
  barClassName: string
} {
  if (!nodeRun) {
    return {
      label: '待运行',
      step: '等待流程启动',
      percent: 8,
      barClassName: 'bg-muted-foreground/45',
    }
  }
  const phase = nodeRun.progressStatus || nodeRun.status
  if (nodeRun.status === 'complete' || phase === 'complete') {
    return {
      label: '已完成',
      step: nodeRun.currentStep ?? '产物已生成',
      percent: 100,
      barClassName: 'bg-emerald-500',
    }
  }
  if (nodeRun.status === 'failed' || nodeRun.status === 'aborted' || phase === 'approval_rejected') {
    return {
      label: nodeRun.status === 'aborted' ? '已取消' : '失败',
      step: nodeRun.error ?? nodeRun.currentStep ?? '需要处理失败原因',
      percent: 100,
      barClassName: 'bg-destructive',
    }
  }
  if (nodeRun.status === 'paused' || phase === 'waiting_for_approval') {
    return {
      label: '等待审批',
      step: nodeRun.currentStep ?? '等待人工确认后继续',
      percent: 66,
      barClassName: 'bg-amber-500',
    }
  }
  if (nodeRun.status === 'running' || phase === 'running') {
    return {
      label: '正在执行',
      step: nodeRun.currentStep ?? '正在调用智能体或工具',
      percent: 45,
      barClassName: 'bg-primary',
    }
  }
  if (phase === 'approval_approved') {
    return {
      label: '审批已通过',
      step: nodeRun.currentStep ?? '准备继续执行',
      percent: 78,
      barClassName: 'bg-primary',
    }
  }
  if (phase === 'queued_for_partial_rerun') {
    return {
      label: '等待重跑',
      step: nodeRun.currentStep ?? '这个节点被加入局部重跑队列',
      percent: 18,
      barClassName: 'bg-sky-500',
    }
  }
  return {
    label: '排队中',
    step: nodeRun.currentStep ?? '等待上游节点完成',
    percent: 18,
    barClassName: 'bg-muted-foreground/60',
  }
}

function CanvasQuickEditor({
  node,
  agents,
  softwareCommands,
  onUpdateNode,
  onRemoveNode,
  onStartConnect,
}: {
  node: DraftNode | null
  agents: AgentProfileRow[]
  softwareCommands: SoftwareCommandRow[]
  onUpdateNode: (nodeId: string, patch: Partial<DraftNode>) => void
  onRemoveNode: (nodeId: string) => void
  onStartConnect: (nodeId: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(false)
  }, [node?.id])

  if (!node) return null

  const changeNodeType = (value: string) => {
    const nextType = normalizeNodeType(value)
    const firstAgent = agents[0] ?? null
    const firstCommand = softwareCommands[0] ?? null
    const nextLabel =
      nextType === 'agent_employee'
        ? firstAgent?.name ?? '智能体节点'
        : nextType === 'software_command'
          ? firstCommand?.name ?? '软件命令'
          : nodeTypeLabel(nextType)
    const nextConfig: JsonObject = { ...node.config, label: nextLabel }
    if (nextType === 'software_command' && firstCommand) {
      nextConfig.softwareCommandId = firstCommand.id
    } else {
      delete nextConfig.softwareCommandId
    }
    onUpdateNode(node.id, {
      type: nextType,
      label: nextLabel,
      agentProfileId: nextType === 'agent_employee' ? firstAgent?.id ?? null : null,
      softwareCommandId: nextType === 'software_command' ? firstCommand?.id ?? null : null,
      config: nextConfig,
      outputContract: defaultOutputContract(nextType, nextLabel, node.outputContract),
      approvalPolicy:
        nextType === 'human_approval'
          ? { ...node.approvalPolicy, required: true, riskLevel: 'medium' }
          : node.approvalPolicy,
    })
  }

  const changeAgent = (value: string) => {
    const agent = agents.find((item) => item.id === value) ?? null
    onUpdateNode(node.id, {
      agentProfileId: agent?.id ?? null,
      label: agent?.name ?? node.label,
      config: { ...node.config, label: agent?.name ?? node.label },
      outputContract: defaultOutputContract(
        'agent_employee',
        agent?.name ?? node.label,
        agent?.outputContract ?? node.outputContract,
      ),
    })
  }

  const changeSoftwareCommand = (value: string) => {
    const command = softwareCommands.find((item) => item.id === value) ?? null
    const nextConfig: JsonObject = { ...node.config, label: command?.name ?? node.label }
    if (command) nextConfig.softwareCommandId = command.id
    else delete nextConfig.softwareCommandId
    onUpdateNode(node.id, {
      softwareCommandId: command?.id ?? null,
      label: command?.name ?? node.label,
      config: nextConfig,
      outputContract: defaultOutputContract(
        'software_command',
        command?.name ?? node.label,
        node.outputContract,
      ),
      approvalPolicy: command?.requiresApproval
        ? { ...node.approvalPolicy, required: true, riskLevel: command.riskLevel }
        : node.approvalPolicy,
    })
  }

  if (collapsed) {
    return (
      <button
        type="button"
        data-testid="canvas-quick-editor-collapsed"
        data-canvas-interactive="true"
        className="pointer-events-auto absolute right-3 top-3 z-40 flex max-w-[min(22rem,calc(100%-1.5rem))] items-center gap-2 rounded-md border bg-card/95 px-3 py-2 text-left text-xs shadow-sm backdrop-blur transition hover:border-primary/50"
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setCollapsed(false)
        }}
        title="展开画布内编辑"
      >
        <span className="min-w-0 flex-1 truncate">
          画布内编辑 · {node.label || nodeTypeLabel(node.type)}
        </span>
        <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px]">
          展开
        </Badge>
      </button>
    )
  }

  return (
    <div
      data-testid="canvas-quick-editor"
      data-canvas-interactive="true"
      className="pointer-events-auto absolute right-3 top-3 z-40 w-80 max-w-[calc(100%-1.5rem)] rounded-md border bg-card/95 p-3 shadow-lg backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">画布内编辑</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{nodeTypeLabel(node.type)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
            {artifactTypeLabel(artifactTypeOf(node))}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            data-testid="canvas-quick-editor-collapse"
            onClick={() => setCollapsed(true)}
          >
            收起
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          value={node.label}
          onChange={(event) =>
            onUpdateNode(node.id, {
              label: event.target.value,
              config: { ...node.config, label: event.target.value },
            })
          }
          placeholder="节点名称"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={node.type}
            onChange={changeNodeType}
            options={NODE_TYPE_OPTIONS}
            labels={NODE_TYPE_LABELS}
          />
          <Select
            value={artifactTypeOf(node)}
            onChange={(value) =>
              onUpdateNode(node.id, {
                outputContract: updateOutputContractArtifactType(node.outputContract, value),
              })
            }
            options={ARTIFACT_TYPE_OPTIONS}
            labels={ARTIFACT_TYPE_LABELS}
          />
        </div>
        <ArtifactTypeQuickPicker
          value={artifactTypeOf(node)}
          onChange={(value) =>
            onUpdateNode(node.id, {
              outputContract: updateOutputContractArtifactType(node.outputContract, value),
            })
          }
        />
        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
          <input
            type="checkbox"
            className="size-4"
            checked={customerVisibleOf(node)}
            onChange={(event) =>
              onUpdateNode(node.id, {
                outputContract: {
                  ...node.outputContract,
                  customerVisible: event.target.checked,
                },
              })
            }
          />
          客户可以看到这个产物
        </label>
        <Input
          value={stringField(node.outputContract, 'deliverableTitle')}
          onChange={(event) =>
            onUpdateNode(node.id, {
              outputContract: { ...node.outputContract, deliverableTitle: event.target.value },
            })
          }
          placeholder="客户看到的名称"
        />

        {node.type === 'agent_employee' && (
          <Select
            value={node.agentProfileId ?? ''}
            onChange={changeAgent}
            options={['', ...agents.map((agent) => agent.id)]}
            labels={Object.fromEntries(agents.map((agent) => [agent.id, agent.name]))}
            emptyLabel="选择智能体"
          />
        )}

        {node.type === 'software_command' && (
          <Select
            value={node.softwareCommandId ?? ''}
            onChange={changeSoftwareCommand}
            options={['', ...softwareCommands.map((command) => command.id)]}
            labels={Object.fromEntries(
              softwareCommands.map((command) => [command.id, command.name]),
            )}
            emptyLabel="选择软件命令"
          />
        )}

        <Textarea
          className="min-h-16 text-xs"
          value={stringField(node.config, 'instruction')}
          onChange={(event) =>
            onUpdateNode(node.id, {
              config: { ...node.config, instruction: event.target.value },
            })
          }
          placeholder="这个节点要完成什么"
        />

        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
          <input
            type="checkbox"
            className="size-4"
            checked={approvalRequired(node)}
            onChange={(event) =>
              onUpdateNode(node.id, {
                approvalPolicy: {
                  ...node.approvalPolicy,
                  required: event.target.checked,
                  riskLevel: stringField(node.approvalPolicy, 'riskLevel') || 'medium',
                },
              })
            }
          />
          需要人工审批
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => onStartConnect(node.id)}
          >
            <GitBranch className="size-3.5" />
            连线
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1"
            onClick={() => onRemoveNode(node.id)}
          >
            <X className="size-3.5" />
            删除
          </Button>
        </div>
      </div>
    </div>
  )
}

function NodeInspector({
  node,
  agents,
  softwareCommands,
  edges,
  nodes,
  onUpdateNode,
  onRemoveNode,
  onRemoveEdge,
  onStartConnect,
}: {
  node: DraftNode | null
  agents: AgentProfileRow[]
  softwareCommands: SoftwareCommandRow[]
  edges: DraftEdge[]
  nodes: DraftNode[]
  onUpdateNode: (nodeId: string, patch: Partial<DraftNode>) => void
  onRemoveNode: (nodeId: string) => void
  onRemoveEdge: (edgeId: string) => void
  onStartConnect: (nodeId: string) => void
}) {
  if (!node) {
    return (
      <section className="rounded-md border bg-background/60 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="size-4" />
          选择一个节点
        </div>
        <div className="mt-2 text-xs leading-5 text-muted-foreground">未选择</div>
      </section>
    )
  }

  const nodeById = new Map(nodes.map((item) => [item.id, item]))
  const outgoingEdges = edges.filter((edge) => edge.sourceNodeId === node.id)
  const incomingEdges = edges.filter((edge) => edge.targetNodeId === node.id)

  const changeNodeType = (value: string) => {
    const nextType = normalizeNodeType(value)
    const firstAgent = agents[0] ?? null
    const firstCommand = softwareCommands[0] ?? null
    const nextLabel =
      nextType === 'agent_employee'
        ? firstAgent?.name ?? '智能体节点'
        : nextType === 'software_command'
          ? firstCommand?.name ?? '软件命令'
          : nodeTypeLabel(nextType)
    const nextConfig: JsonObject = { ...node.config, label: nextLabel }
    if (nextType === 'software_command' && firstCommand) {
      nextConfig.softwareCommandId = firstCommand.id
    } else {
      delete nextConfig.softwareCommandId
    }
    onUpdateNode(node.id, {
      type: nextType,
      label: nextLabel,
      agentProfileId: nextType === 'agent_employee' ? firstAgent?.id ?? null : null,
      softwareCommandId: nextType === 'software_command' ? firstCommand?.id ?? null : null,
      config: nextConfig,
      outputContract: defaultOutputContract(nextType, nextLabel, node.outputContract),
      approvalPolicy:
        nextType === 'human_approval'
          ? { ...node.approvalPolicy, required: true, riskLevel: 'medium' }
          : node.approvalPolicy,
    })
  }

  const changeAgent = (value: string) => {
    const agent = agents.find((item) => item.id === value) ?? null
    onUpdateNode(node.id, {
      agentProfileId: agent?.id ?? null,
      label: agent?.name ?? node.label,
      config: { ...node.config, label: agent?.name ?? node.label },
      outputContract: defaultOutputContract(
        'agent_employee',
        agent?.name ?? node.label,
        agent?.outputContract ?? node.outputContract,
      ),
    })
  }

  const changeSoftwareCommand = (value: string) => {
    const command = softwareCommands.find((item) => item.id === value) ?? null
    const nextConfig: JsonObject = { ...node.config, label: command?.name ?? node.label }
    if (command) nextConfig.softwareCommandId = command.id
    else delete nextConfig.softwareCommandId
    onUpdateNode(node.id, {
      softwareCommandId: command?.id ?? null,
      label: command?.name ?? node.label,
      config: nextConfig,
      outputContract: defaultOutputContract(
        'software_command',
        command?.name ?? node.label,
        node.outputContract,
      ),
      approvalPolicy: command?.requiresApproval
        ? { ...node.approvalPolicy, required: true, riskLevel: command.riskLevel }
        : node.approvalPolicy,
    })
  }

  return (
    <section className="min-h-[520px] rounded-md border bg-background/60">
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">节点设置</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {nodeTypeLabel(node.type)}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => onStartConnect(node.id)}
          >
            <GitBranch className="size-3.5" />
            连线
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <FieldLabel>节点名称</FieldLabel>
          <Input
            value={node.label}
            onChange={(event) =>
              onUpdateNode(node.id, {
                label: event.target.value,
                config: { ...node.config, label: event.target.value },
              })
            }
            placeholder="给这个节点起个名字"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>节点类型</FieldLabel>
            <Select
              value={node.type}
              onChange={changeNodeType}
              options={NODE_TYPE_OPTIONS}
              labels={NODE_TYPE_LABELS}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>输出产物</FieldLabel>
            <Select
              value={artifactTypeOf(node)}
              onChange={(value) =>
                onUpdateNode(node.id, {
                  outputContract: updateOutputContractArtifactType(node.outputContract, value),
                })
              }
              options={ARTIFACT_TYPE_OPTIONS}
              labels={ARTIFACT_TYPE_LABELS}
            />
          </div>
        </div>

        <ArtifactTypeQuickPicker
          value={artifactTypeOf(node)}
          onChange={(value) =>
            onUpdateNode(node.id, {
              outputContract: updateOutputContractArtifactType(node.outputContract, value),
            })
          }
        />

        <div className="rounded-md border bg-muted/20 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
              <Share2 className="size-3.5 text-primary" />
              <span className="truncate">客户看到的交付物</span>
            </div>
            <ArtifactChip type={artifactTypeOf(node)} compact />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs">
              <input
                type="checkbox"
                className="size-4"
                checked={customerVisibleOf(node)}
                onChange={(event) =>
                  onUpdateNode(node.id, {
                    outputContract: {
                      ...node.outputContract,
                      customerVisible: event.target.checked,
                    },
                  })
                }
              />
              这个产物对客户可见
            </label>
            <Input
              value={stringField(node.outputContract, 'deliverableTitle')}
              onChange={(event) =>
                onUpdateNode(node.id, {
                  outputContract: {
                    ...node.outputContract,
                    deliverableTitle: event.target.value,
                  },
                })
              }
              placeholder="客户看到的名称，例如：短视频成片 / 代码包 / 设计图"
            />
            <Textarea
              className="min-h-14 text-xs"
              value={stringField(node.outputContract, 'deliveryDescription')}
              onChange={(event) =>
                onUpdateNode(node.id, {
                  outputContract: {
                    ...node.outputContract,
                    deliveryDescription: event.target.value,
                  },
                })
              }
              placeholder="给客户看的说明，例如：可直接验收的视频文件，包含封面、字幕和导出记录"
            />
          </div>
        </div>

        {node.type === 'agent_employee' && (
          <div className="space-y-1.5">
            <FieldLabel>使用哪个智能体</FieldLabel>
            <Select
              value={node.agentProfileId ?? ''}
              onChange={changeAgent}
              options={['', ...agents.map((agent) => agent.id)]}
              labels={Object.fromEntries(agents.map((agent) => [agent.id, agent.name]))}
              emptyLabel="未选择智能体"
            />
          </div>
        )}

        {node.type === 'software_command' && (
          <div className="space-y-1.5">
            <FieldLabel>调用哪个软件命令</FieldLabel>
            <Select
              value={node.softwareCommandId ?? ''}
              onChange={changeSoftwareCommand}
              options={['', ...softwareCommands.map((command) => command.id)]}
              labels={Object.fromEntries(
                softwareCommands.map((command) => [command.id, command.name]),
              )}
              emptyLabel="未选择软件命令"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <FieldLabel>这个节点要做什么</FieldLabel>
          <Textarea
            className="min-h-16 text-xs"
            value={stringField(node.config, 'instruction')}
            onChange={(event) =>
              onUpdateNode(node.id, {
                config: { ...node.config, instruction: event.target.value },
              })
            }
            placeholder="例如：分析输入资料，输出客户能直接使用的结果"
          />
        </div>

        <div className="grid gap-2">
          <div className="space-y-1.5">
            <FieldLabel>输入从哪里来</FieldLabel>
            <Textarea
              className="min-h-14 text-xs"
              value={stringField(node.inputMapping, 'summary')}
              onChange={(event) =>
                onUpdateNode(node.id, {
                  inputMapping: { ...node.inputMapping, summary: event.target.value },
                })
              }
              placeholder="例如：使用上一个节点的调研报告和用户上传的文件"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>必须交付什么</FieldLabel>
            <Textarea
              className="min-h-14 text-xs"
              value={stringField(node.outputContract, 'description')}
              onChange={(event) =>
                onUpdateNode(node.id, {
                  outputContract: { ...node.outputContract, description: event.target.value },
                })
              }
              placeholder="例如：一份 Markdown 报告，必须包含结论、证据和下一步动作"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>最大重试</FieldLabel>
            <Input
              type="number"
              min={0}
              value={String(maxAttemptsOf(node))}
              onChange={(event) =>
                onUpdateNode(node.id, {
                  retryPolicy: {
                    ...node.retryPolicy,
                    maxAttempts: Math.max(0, Number(event.target.value) || 0),
                  },
                })
              }
            />
          </div>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
            <input
              type="checkbox"
              className="size-4"
              checked={approvalRequired(node)}
              onChange={(event) =>
                onUpdateNode(node.id, {
                  approvalPolicy: {
                    ...node.approvalPolicy,
                    required: event.target.checked,
                    riskLevel: stringField(node.approvalPolicy, 'riskLevel') || 'medium',
                  },
                })
              }
            />
            需要人工审批
          </label>
        </div>

        <div className="space-y-2">
          <FieldLabel>连线关系</FieldLabel>
          {outgoingEdges.length === 0 && incomingEdges.length === 0 ? (
            <EmptyLine text="这个节点还没有连线" />
          ) : (
            <div className="space-y-1.5">
              {outgoingEdges.map((edge) => (
                <ConnectionRow
                  key={edge.id}
                  label={`输出到：${nodeLabel(nodeById.get(edge.targetNodeId))}`}
                  onRemove={() => onRemoveEdge(edge.id)}
                />
              ))}
              {incomingEdges.map((edge) => (
                <ConnectionRow
                  key={edge.id}
                  label={`来自：${nodeLabel(nodeById.get(edge.sourceNodeId))}`}
                  onRemove={() => onRemoveEdge(edge.id)}
                />
              ))}
            </div>
          )}
        </div>

        <Button
          variant="destructive"
          className="h-8 w-full gap-1 text-xs"
          onClick={() => onRemoveNode(node.id)}
        >
          <X className="size-3.5" />
          删除这个节点
        </Button>
      </div>
    </section>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-medium text-muted-foreground">{children}</div>
}

function ConnectionRow({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-[11px]">
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onRemove}
        title="删除连线"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

function PreflightSummary({ preflight }: { preflight: WorkflowPreflightRow | null }) {
  if (!preflight) return <EmptyLine text="还没有做流程预检" />
  const issues = preflight.issues.slice(0, 3).map((issue) => ({
    level: stringField(issue, 'level'),
    code: stringField(issue, 'code'),
    message: stringField(issue, 'message'),
  }))
  const resources = preflight.resourceRequirements.slice(0, 3).map((resource) => ({
    resourceType: stringField(resource, 'resourceType'),
    resourceId: stringField(resource, 'resourceId'),
  }))
  return (
    <div className="rounded-md border bg-muted/20 px-2 py-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">最近一次预检</span>
        <PreflightStatusBadge status={preflight.status} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
        <MiniMetric label="费用" value={`${preflight.estimatedCostCents}分`} />
        <MiniMetric label="Agent" value={preflight.agentCount} />
        <MiniMetric label="软件" value={preflight.softwareCommandCount} />
        <MiniMetric label="审批" value={preflight.approvalCount} />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        预计 {Math.round(preflight.estimatedDurationMs / 1000)} 秒 · {preflight.nodeCount} 个节点 ·{' '}
        {preflight.edgeCount} 条连线
      </div>
      {issues.length > 0 && (
        <div className="mt-2 space-y-1">
          {issues.map((issue, index) => (
            <div key={`${issue.code}-${index}`} className="line-clamp-2 text-[10px] text-muted-foreground">
              <span className={issue.level === 'blocked' ? 'text-destructive' : 'text-amber-600'}>
                {issue.code}
              </span>
              : {issue.message}
            </div>
          ))}
        </div>
      )}
      {resources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {resources.map((resource, index) => (
            <Badge
              key={`${resource.resourceType}-${resource.resourceId}-${index}`}
              variant="outline"
              className="h-5 max-w-full px-1.5 text-[9px]"
            >
              <span className="truncate">
                {resource.resourceType}:{resource.resourceId}
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function PresetPreview({ preset }: { preset: WorkflowPresetDto | null }) {
  if (!preset) return <EmptyLine text="选择一个模板后，这里会显示它会产出哪些交付物" />
  const visibleSteps = preset.steps.filter((step) => step.customerVisible !== false)
  return (
    <div className="rounded-md border bg-muted/20 px-2 py-2 text-[11px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{preset.title}</div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">{preset.description}</div>
        </div>
        <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px]">
          {visibleSteps.length} 个交付物
        </Badge>
      </div>
      <div className="mt-2 grid gap-1">
        {preset.steps.map((step, index) => (
          <div key={`${preset.id}-${step.title}-${index}`} className="rounded-md border bg-background px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">
                {index + 1}. {step.deliverableTitle ?? step.title}
              </span>
              <ArtifactChip type={step.artifactType} compact />
            </div>
            <div className="mt-1 line-clamp-1 text-muted-foreground">
              {step.deliveryDescription ?? step.instruction}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-background px-1 py-1">
      <div className="truncate font-mono text-[10px] text-foreground">{value}</div>
      <div className="truncate text-muted-foreground">{label}</div>
    </div>
  )
}

function RunStatusList({
  runs,
  selectedRunId,
}: {
  runs: WorkflowRunRow[]
  selectedRunId: string
}) {
  if (runs.length === 0) return <EmptyLine text="还没有运行记录" />
  return (
    <div className="space-y-1">
      {runs.map((run) => (
        <div
          key={run.id}
          className={cn(
            'rounded-md border px-2 py-1.5 text-[11px]',
            selectedRunId === run.id && 'border-primary bg-primary/5',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px]">{run.id}</span>
            <StatusBadge status={run.status} />
          </div>
          <div className="mt-1 text-muted-foreground">{formatTime(run.startedAt)}</div>
        </div>
      ))}
    </div>
  )
}

function NodeRunList({
  nodeRuns,
  nodes,
  agentById,
}: {
  nodeRuns: WorkflowNodeRunRow[]
  nodes: DraftNode[]
  agentById: Map<string, AgentProfileRow>
}) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  if (nodeRuns.length === 0) return <EmptyLine text="选择或启动一次运行后，这里会显示节点进度" />
  return (
    <div className="space-y-1">
      {nodeRuns.map((run) => {
        const node = nodeMap.get(run.nodeId)
        const agent = node?.agentProfileId ? agentById.get(node.agentProfileId) : null
        return (
          <div key={run.id} className="rounded-md border px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {agent?.name ?? node?.type ?? run.nodeId}
              </span>
              <StatusBadge status={run.status} />
            </div>
            <div className="mt-1 truncate text-muted-foreground">
              {run.currentStep ?? run.progressStatus}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmployeeRunList({
  runs,
  agentById,
}: {
  runs: EmployeeRunRow[]
  agentById: Map<string, AgentProfileRow>
}) {
  if (runs.length === 0) return <EmptyLine text="这次运行还没有关联的员工智能体执行记录" />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">员工智能体执行</div>
      {runs.map((run) => (
        <div key={run.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {agentById.get(run.agentProfileId)?.name ?? run.agentProfileId}
            </span>
            <StatusBadge status={run.status} />
          </div>
          <div className="mt-1 truncate text-muted-foreground">
            {run.currentStep ?? run.currentPhase}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
            {run.id}
          </div>
        </div>
      ))}
    </div>
  )
}

function SoftwareCommandRunList({
  runs,
  commandById,
}: {
  runs: SoftwareCommandRunRow[]
  commandById: Map<string, SoftwareCommandRow>
}) {
  if (runs.length === 0) {
    return <EmptyLine text="这次运行还没有软件命令执行记录" />
  }
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">软件命令执行</div>
      {runs.map((run) => {
        const command = commandById.get(run.softwareCommandId)
        return (
          <div key={run.id} className="rounded-md border px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {command?.name ?? run.softwareCommandId}
              </span>
              <SoftwareRunStatusBadge status={run.status} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">{run.adapterType}</span>
              <span>{run.implementationType}</span>
            </div>
            {run.error && <div className="mt-1 line-clamp-2 text-destructive">{run.error}</div>}
          </div>
        )
      })}
    </div>
  )
}

function SoftwareRunStatusBadge({ status }: { status: SoftwareCommandRunRow['status'] }) {
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'failed' || status === 'blocked'
      ? 'destructive'
      : status === 'complete'
        ? 'default'
        : 'secondary'
  return (
    <Badge variant={variant} className="h-5 px-1.5 text-[9px]">
      {softwareRunStatusLabel(status)}
    </Badge>
  )
}

function ComputerSessionList({
  sessions,
  actions,
  onMark,
  busy,
}: {
  sessions: ComputerSessionRow[]
  actions: ComputerActionEventRow[]
  onMark?: (session: ComputerSessionRow, kind: 'observe' | 'screenshot') => void
  busy?: boolean
}) {
  if (sessions.length === 0) return <EmptyLine text="这次运行还没有电脑/浏览器操作会话" />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">电脑操作会话</div>
      {sessions.map((session) => {
        const sessionActions = actions.filter((action) => action.computerSessionId === session.id)
        const latestActions = sessionActions.slice(-3).reverse()
        return (
          <div key={session.id} className="rounded-md border px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{session.mode}</span>
              <Badge
                variant={session.status === 'failed' ? 'destructive' : 'outline'}
                className="h-5 px-1.5 text-[9px]"
              >
                {session.status}
              </Badge>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate font-mono">{session.employeeRunId}</span>
              <span>{sessionActions.length} 个动作</span>
            </div>
            {onMark && (
              <div className="mt-1.5 flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 gap-1 px-2 text-[10px]"
                  disabled={busy}
                  onClick={() => onMark(session, 'observe')}
                >
                  <Eye className="size-3" />
                  观察
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 gap-1 px-2 text-[10px]"
                  disabled={busy}
                  onClick={() => onMark(session, 'screenshot')}
                >
                  <Camera className="size-3" />
                  截图
                </Button>
              </div>
            )}
            {latestActions.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {latestActions.map((action) => (
                  <div key={action.id} className="rounded bg-muted/40 px-1.5 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{action.actionType}</span>
                      <span className="text-[9px] text-muted-foreground">{action.status}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                      {summarizeComputerAction(action)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function summarizeComputerAction(action: ComputerActionEventRow): string {
  const outputSummary = action.output.summary
  if (typeof outputSummary === 'string' && outputSummary.trim()) return outputSummary
  if (action.target) return action.target
  return new Date(action.createdAt).toLocaleTimeString()
}

function ArtifactValidationList({ validations }: { validations: ArtifactValidationRow[] }) {
  if (validations.length === 0) {
    return <EmptyLine text="这次运行还没有产物校验记录" />
  }
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">产物校验</div>
      {validations.map((validation) => (
        <div key={validation.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {validation.rules.length > 0 ? validation.rules.join(', ') : '输出产物要求'}
            </span>
            <Badge
              variant={validation.status === 'failed' ? 'destructive' : 'default'}
              className="h-5 px-1.5 text-[9px]"
            >
              {validation.status}
            </Badge>
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
            {validation.runId}
          </div>
        </div>
      ))}
    </div>
  )
}

function ResourceLockList({ locks }: { locks: ResourceLockRow[] }) {
  if (locks.length === 0) return <EmptyLine text="这次运行还没有资源锁记录" />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">资源锁</div>
      {locks.map((lock) => (
        <div key={lock.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px]">{lock.resourceType}</span>
            <Badge variant={lock.status === 'held' ? 'secondary' : 'outline'} className="h-5 px-1.5 text-[9px]">
              {lock.status}
            </Badge>
          </div>
          <div className="mt-1 truncate text-muted-foreground">{lock.resourceId}</div>
        </div>
      ))}
    </div>
  )
}

function ApprovalRequestList({
  requests,
  saving,
  onApprove,
  onReject,
}: {
  requests: ApprovalRequestRow[]
  saving: string | null
  onApprove: (approvalRequestId: string) => Promise<void>
  onReject: (approvalRequestId: string) => Promise<void>
}) {
  if (requests.length === 0) return <EmptyLine text="这次运行还没有审批请求" />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">审批</div>
      {requests.map((request) => (
        <div key={request.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{request.title}</span>
            <Badge variant={request.status === 'rejected' ? 'destructive' : 'outline'} className="h-5 px-1.5 text-[9px]">
              {request.status}
            </Badge>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">{request.description}</div>
          {request.status === 'pending' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={saving !== null}
                onClick={() => void onReject(request.id)}
              >
                拒绝
              </Button>
              <Button
                size="sm"
                className="h-7"
                disabled={saving !== null}
                onClick={() => void onApprove(request.id)}
              >
                同意
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-md border bg-background/60">
      <div className="flex items-center gap-1.5 border-b px-2.5 py-2 text-xs font-medium">
        {icon}
        <span className="truncate">{title}</span>
      </div>
      <div className="space-y-2 p-2.5">{children}</div>
    </section>
  )
}

function Select({
  value,
  options,
  labels,
  emptyLabel,
  onChange,
}: {
  value: string
  options: string[]
  labels?: Record<string, string>
  emptyLabel?: string
  onChange: (value: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {options.map((option) => (
        <option key={option || '__empty'} value={option}>
          {option ? labels?.[option] ?? option : emptyLabel ?? 'None'}
        </option>
      ))}
    </select>
  )
}

function PreflightStatusBadge({ status }: { status: WorkflowPreflightRow['status'] }) {
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'blocked' ? 'destructive' : status === 'warning' ? 'secondary' : 'default'
  return (
    <Badge variant={variant} className="h-5 px-1.5 text-[9px]">
      {preflightStatusLabel(status)}
    </Badge>
  )
}

function StatusBadge({ status }: { status: RunStatus }) {
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'failed' || status === 'aborted'
      ? 'destructive'
      : status === 'complete'
        ? 'default'
        : status === 'running'
          ? 'secondary'
          : 'outline'
  return (
    <Badge variant={variant} className="h-5 px-1.5 text-[9px]">
      {statusLabel(status)}
    </Badge>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-1.5 py-1">
      <div className="font-mono text-[11px] text-foreground">{value}</div>
      <div className="truncate">{label}</div>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-2 py-3 text-center text-[11px] text-muted-foreground">
      {text}
    </div>
  )
}

function canvasDraftFromNlDraft(draft: NaturalLanguageWorkflowDraftRow): {
  name: string
  description: string
  nodes: DraftNode[]
  edges: DraftEdge[]
} {
  const preview = draft.workflowPreview
  const nodes = jsonArray(preview, 'nodes').map((value, index) => {
    const obj = asRecord(value)
    const config = asJsonObject(obj.config)
    return {
      id: stringValue(obj.id, `nl_node_${index}`),
      type: normalizeNodeType(stringValue(obj.type, 'artifact_transform')),
      label: stringValue(obj.label, stringValue(config.label, stringValue(obj.type, '节点'))),
      agentProfileId: typeof obj.agentProfileId === 'string' ? obj.agentProfileId : null,
      softwareCommandId:
        typeof config.softwareCommandId === 'string' ? config.softwareCommandId : null,
      position: positionValue(obj.position, nextNodePosition(index)),
      config,
      inputMapping: asJsonObject(obj.inputMapping),
      outputContract: asJsonObject(obj.outputContract),
      retryPolicy: asJsonObject(obj.retryPolicy),
      approvalPolicy: asJsonObject(obj.approvalPolicy),
    } satisfies DraftNode
  })
  const edges = jsonArray(preview, 'edges')
    .map((value, index) => {
      const obj = asRecord(value)
      return {
        id: stringValue(obj.id, `nl_edge_${index}`),
        sourceNodeId: stringValue(obj.sourceNodeId, ''),
        targetNodeId: stringValue(obj.targetNodeId, ''),
        mapping: asJsonObject(obj.mapping),
      } satisfies DraftEdge
    })
    .filter((edge) => edge.sourceNodeId && edge.targetNodeId)
  return {
    name: stringValue(preview.name, draft.name),
    description: `由自然语言生成：${nlDraftSummary(draft)}`,
    nodes,
    edges,
  }
}

function nlDraftSummary(draft: NaturalLanguageWorkflowDraftRow): string {
  return stringValue(draft.workflowPreview.summary, draft.prompt)
}

function nlDraftConfirmationText(draft: NaturalLanguageWorkflowDraftRow): string {
  return stringValue(draft.workflowPreview.confirmationText, '这个流程看起来对吗？')
}

function nodeDescription(node: DraftNode): string {
  if (node.type === 'webhook_trigger') {
    return stringField(node.config, 'triggerCondition') || '等待外部触发'
  }
  if (node.type === 'condition') return stringField(node.config, 'classifier') || '判断下一步走哪条分支'
  if (node.type === 'artifact_transform') {
    return stringField(node.config, 'instruction') || '处理上一个节点的产物'
  }
  if (node.type === 'human_approval') return '需要用户确认后继续'
  return nodeTypeLabel(node.type)
}

function nodeTypeLabel(type: DraftNodeType): string {
  return NODE_TYPE_LABELS[type] ?? type
}

function nodeLabel(node?: DraftNode): string {
  return node?.label || (node ? nodeTypeLabel(node.type) : '未知节点')
}

function artifactTypeOf(node: DraftNode): string {
  const value = node.outputContract.artifactType
  return typeof value === 'string' && value ? value : defaultArtifactForNodeType(node.type)
}

function artifactTypeLabel(type: string): string {
  return ARTIFACT_TYPE_LABELS[type] ?? type
}

function artifactTypeIcon(type: string, className = 'size-3.5'): ReactNode {
  if (type === 'video') return <FileVideo className={className} />
  if (type === 'image') return <FileImage className={className} />
  if (type === 'code') return <Code2 className={className} />
  if (type === 'spreadsheet') return <FileSpreadsheet className={className} />
  if (type === 'json') return <FileJson className={className} />
  if (type === 'presentation') return <Presentation className={className} />
  if (type === 'browser_state' || type === 'desktop_result') return <MonitorCheck className={className} />
  if (type === 'file_bundle' || type === 'software_result') return <Package className={className} />
  return <FileText className={className} />
}

function artifactFileHint(type: string): string {
  const map: Record<string, string> = {
    report: '报告页面',
    json: 'JSON 数据',
    document: '文档文件',
    code: '代码文件',
    spreadsheet: '表格文件',
    image: '图片文件',
    video: '视频文件',
    presentation: '演示文稿',
    browser_state: '页面截图/状态',
    desktop_result: '操作截图/日志',
    file_bundle: '文件包',
    approval_decision: '审批记录',
    software_result: '软件执行结果',
  }
  return map[type] ?? '产物文件'
}

function artifactPreviewMode(type: string): string {
  const map: Record<string, string> = {
    report: '页面预览',
    json: '结构化预览',
    document: '文档预览',
    code: '代码差异',
    spreadsheet: '表格预览',
    image: '图片预览',
    video: '视频播放器',
    presentation: '幻灯片预览',
    browser_state: '页面截图',
    desktop_result: '操作回放',
    file_bundle: '文件清单',
    approval_decision: '审批摘要',
    software_result: '执行报告',
  }
  return map[type] ?? '产物预览'
}

function artifactExpectedFile(type: string): string {
  const map: Record<string, string> = {
    report: 'report.html / PDF',
    json: 'result.json',
    document: 'document.docx',
    code: 'patch.diff / src.zip',
    spreadsheet: 'sheet.xlsx',
    image: 'image.png',
    video: 'video.mp4',
    presentation: 'slides.pptx',
    browser_state: 'screenshot.png',
    desktop_result: 'result.png / log.txt',
    file_bundle: 'deliverables.zip',
    approval_decision: 'approval.json',
    software_result: 'software-result.json',
  }
  return map[type] ?? 'artifact'
}

function artifactAcceptanceHint(type: string): string {
  const map: Record<string, string> = {
    report: '内容完整',
    json: 'Schema 通过',
    document: '格式可读',
    code: '测试通过',
    spreadsheet: '数据完整',
    image: '可打开',
    video: '可播放',
    presentation: '可演示',
    browser_state: '截图可信',
    desktop_result: '操作完成',
    file_bundle: '文件齐全',
    approval_decision: '审批明确',
    software_result: '命令成功',
  }
  return map[type] ?? '可验收'
}

function customerVisibleOf(node: DraftNode): boolean {
  const value = node.outputContract.customerVisible
  if (typeof value === 'boolean') return value
  return node.type === 'agent_employee' || node.type === 'software_command' || node.type === 'artifact_transform'
}

function deliveryTitleOf(node: DraftNode): string {
  return stringField(node.outputContract, 'deliverableTitle') || node.label || artifactTypeLabel(artifactTypeOf(node))
}

function deliveryDescriptionOf(node: DraftNode): string {
  return (
    stringField(node.outputContract, 'deliveryDescription') ||
    stringField(node.outputContract, 'description') ||
    nodeDescription(node)
  )
}

function deliveryStateLabel(nodeRun: WorkflowNodeRunRow | null): string {
  if (!nodeRun) return '待产出'
  if (nodeRun.status === 'complete') return '已产出'
  if (nodeRun.status === 'failed' || nodeRun.status === 'aborted') return '需处理'
  if (nodeRun.status === 'running') return '生成中'
  if (nodeRun.status === 'paused') return '待审批'
  return '排队中'
}

function countDeliverablesByType(nodes: DraftNode[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>()
  for (const node of nodes) {
    const type = artifactTypeOf(node)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || artifactTypeLabel(a.type).localeCompare(artifactTypeLabel(b.type)))
}

function defaultOutputContract(
  nodeType: DraftNodeType,
  label: string,
  base: JsonObject = {},
): JsonObject {
  const artifactType =
    typeof base.artifactType === 'string' && base.artifactType
      ? base.artifactType
      : defaultArtifactForNodeType(nodeType)
  const customerVisible =
    typeof base.customerVisible === 'boolean'
      ? base.customerVisible
      : nodeType === 'agent_employee' || nodeType === 'software_command' || nodeType === 'artifact_transform'
  return {
    ...base,
    artifactType,
    customerVisible,
    deliverableTitle: stringValue(base.deliverableTitle, label || artifactTypeLabel(artifactType)),
    deliveryDescription: stringValue(
      base.deliveryDescription,
      stringValue(base.description, `${artifactTypeLabel(artifactType)} · ${artifactFileHint(artifactType)}`),
    ),
  }
}

function normalizedOutputContract(node: DraftNode): JsonObject {
  const normalized = defaultOutputContract(node.type, node.label, node.outputContract)
  return {
    ...normalized,
    artifactType: artifactTypeOf(node),
    customerVisible: customerVisibleOf(node),
    deliverableTitle: deliveryTitleOf(node),
    deliveryDescription: deliveryDescriptionOf(node),
  }
}

function updateOutputContractArtifactType(base: JsonObject, nextType: string): JsonObject {
  const previousType = typeof base.artifactType === 'string' && base.artifactType ? base.artifactType : nextType
  const previousDefault = `${artifactTypeLabel(previousType)} · ${artifactFileHint(previousType)}`
  const nextDefault = `${artifactTypeLabel(nextType)} · ${artifactFileHint(nextType)}`
  const currentDescription = typeof base.description === 'string' ? base.description : ''
  const currentDeliveryDescription = typeof base.deliveryDescription === 'string' ? base.deliveryDescription : ''
  const shouldUpdateDescription = !currentDescription || currentDescription === previousDefault
  const shouldUpdateDeliveryDescription =
    !currentDeliveryDescription ||
    currentDeliveryDescription === currentDescription ||
    currentDeliveryDescription === previousDefault

  return {
    ...base,
    artifactType: nextType,
    description: shouldUpdateDescription ? nextDefault : currentDescription,
    deliveryDescription: shouldUpdateDeliveryDescription ? nextDefault : currentDeliveryDescription,
  }
}

function defaultArtifactForNodeType(type: DraftNodeType): string {
  if (type === 'software_command') return 'software_result'
  if (type === 'human_approval') return 'approval_decision'
  if (type === 'agent_employee') return 'report'
  if (type === 'webhook_trigger') return 'json'
  if (type === 'condition') return 'json'
  return 'file_bundle'
}

function maxAttemptsOf(node: DraftNode): number {
  const value = node.retryPolicy.maxAttempts
  return typeof value === 'number' && Number.isFinite(value) ? value : 1
}

function approvalRequired(node: DraftNode): boolean {
  return node.approvalPolicy.required === true
}

function actionLabel(label: string): string {
  const labels: Record<string, string> = {
    'Generate workflow draft': '生成流程草稿',
    'Modify workflow draft': '修改流程草稿',
    'Confirm generated workflow': '确认流程',
    'Save workflow': '保存流程',
    'Install preset': '安装模板',
    'Run preset': '运行模板',
    'Preflight workflow': '流程预检',
    'Start workflow run': '运行流程',
    'Computer observation': '记录电脑观察',
    'Screenshot marker': '记录截图标记',
    'Approve request': '同意审批',
    'Reject request': '拒绝审批',
  }
  return labels[label] ?? label
}

function statusLabel(status: RunStatus): string {
  const labels: Record<string, string> = {
    queued: '排队中',
    running: '运行中',
    waiting_for_approval: '等待审批',
    complete: '已完成',
    failed: '失败',
    aborted: '已取消',
  }
  return labels[status] ?? status
}

function preflightStatusLabel(status: WorkflowPreflightRow['status']): string {
  const labels: Record<string, string> = {
    ok: '可运行',
    warning: '需注意',
    blocked: '已阻止',
  }
  return labels[status] ?? status
}

function softwareRunStatusLabel(status: SoftwareCommandRunRow['status']): string {
  const labels: Record<string, string> = {
    queued: '排队中',
    running: '运行中',
    complete: '已完成',
    failed: '失败',
    blocked: '已阻止',
  }
  return labels[status] ?? status
}

function nextNodePosition(index: number): { x: number; y: number } {
  return {
    x: 24 + (index % 3) * 192,
    y: 28 + Math.floor(index / 3) * 118,
  }
}

function newDraftId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function normalizeNodeType(type: string): DraftNodeType {
  if (type === 'human_approval') return 'human_approval'
  if (type === 'software_command') return 'software_command'
  if (type === 'artifact_transform') return 'artifact_transform'
  if (type === 'webhook_trigger') return 'webhook_trigger'
  if (type === 'condition') return 'condition'
  return 'agent_employee'
}

function parseJsonObject(value: string): JsonObject {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('运行输入必须是一个 JSON 对象。')
  }
  return parsed as JsonObject
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('预检预算必须是一个不小于 0 的数字。')
  }
  return Math.round(parsed)
}

function stringField(obj: JsonObject, key: string): string {
  const value = obj[key]
  return typeof value === 'string' ? value : ''
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asJsonObject(value: unknown): JsonObject {
  return asRecord(value) as JsonObject
}

function jsonArray(obj: JsonObject, key: string): unknown[] {
  const value = obj[key]
  return Array.isArray(value) ? value : []
}

function positionValue(value: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  const obj = asRecord(value)
  return {
    x: numberValue(obj.x, fallback.x),
    y: numberValue(obj.y, fallback.y),
  }
}

function mergeRuns(current: WorkflowRunRow[], incoming: WorkflowRunRow[]): WorkflowRunRow[] {
  const map = new Map<string, WorkflowRunRow>()
  for (const run of current) map.set(run.id, run)
  for (const run of incoming) map.set(run.id, run)
  return [...map.values()].sort((a, b) => b.startedAt - a.startedAt)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isCanvasInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      [
        '[data-canvas-interactive="true"]',
        'button',
        'input',
        'textarea',
        'select',
        'a',
        '[role="button"]',
      ].join(','),
    ),
  )
}

function isCanvasFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input,textarea,select,[contenteditable="true"]'))
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

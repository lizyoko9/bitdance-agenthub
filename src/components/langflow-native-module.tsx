'use client'

import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  Bot,
  Brain,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  FileJson,
  FileText,
  GitBranch,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  LANGFLOW_PORT_KIND_LABELS,
  buildPortCompatibilityHint,
  canConnectPortKinds,
  summarizeNodePorts,
  type LangflowPortKind,
} from '@/lib/langflow-port-contracts'
import { cn } from '@/lib/utils'

type NodeKind = 'input' | 'prompt' | 'agent' | 'model' | 'tool' | 'memory' | 'code' | 'output'
type PortKind = LangflowPortKind

interface FlowPort {
  id: string
  label: string
  kind: PortKind
}

interface FlowNodeConfig {
  goal?: string
  model?: string
  prompt?: string
  command?: string
  memoryScope?: string
  outputName?: string
}

interface FlowNodeData extends Record<string, unknown> {
  kind: NodeKind
  title: string
  subtitle: string
  description: string
  inputs: FlowPort[]
  outputs: FlowPort[]
  config: FlowNodeConfig
}

interface FlowEdgeData extends Record<string, unknown> {
  kind: PortKind
}

type FlowNode = Node<FlowNodeData, 'agenthubFlowNode'>
type FlowEdge = Edge<FlowEdgeData>

interface ComponentSpec {
  kind: NodeKind
  title: string
  subtitle: string
  description: string
  icon: LucideIcon
  color: string
  inputs: FlowPort[]
  outputs: FlowPort[]
  config: FlowNodeConfig
}

const portLabels = LANGFLOW_PORT_KIND_LABELS

const portColors: Record<PortKind, string> = {
  message: 'bg-sky-500',
  prompt: 'bg-violet-500',
  model: 'bg-orange-500',
  tool: 'bg-emerald-500',
  memory: 'bg-cyan-500',
  code: 'bg-fuchsia-500',
  data: 'bg-blue-500',
  result: 'bg-amber-500',
  document: 'bg-indigo-500',
  image: 'bg-pink-500',
  video: 'bg-red-500',
  audio: 'bg-purple-500',
  report: 'bg-lime-500',
  spreadsheet: 'bg-emerald-500',
  file_bundle: 'bg-stone-500',
  structured_data: 'bg-cyan-500',
}

const specs: ComponentSpec[] = [
  {
    kind: 'input',
    title: '客户输入',
    subtitle: '入口',
    description: '接收客户目标、文件、上下文或上一条任务消息。',
    icon: MessageSquare,
    color: 'text-sky-500',
    inputs: [],
    outputs: [
      { id: 'message', label: '客户消息', kind: 'message' },
      { id: 'data', label: '附件数据', kind: 'data' },
    ],
    config: { goal: '客户要完成的业务目标' },
  },
  {
    kind: 'prompt',
    title: '提示词模板',
    subtitle: '上下文编排',
    description: '把客户目标、记忆和工具范围整理成 Agent 可执行的指令。',
    icon: FileText,
    color: 'text-violet-500',
    inputs: [{ id: 'message', label: '输入消息', kind: 'message' }],
    outputs: [{ id: 'prompt', label: '执行提示词', kind: 'prompt' }],
    config: { prompt: '整理目标、约束、工具边界和交付物要求。' },
  },
  {
    kind: 'model',
    title: '模型',
    subtitle: 'LLM',
    description: '选择已经在模型管理里配置好的模型。',
    icon: Brain,
    color: 'text-orange-500',
    inputs: [],
    outputs: [{ id: 'model', label: '模型能力', kind: 'model' }],
    config: { model: 'DeepSeek / OpenAI / Claude / 本地模型' },
  },
  {
    kind: 'agent',
    title: '员工 Agent',
    subtitle: '执行者',
    description: '根据提示词、模型、工具和记忆持续执行任务。',
    icon: Bot,
    color: 'text-blue-500',
    inputs: [
      { id: 'prompt', label: '任务提示词', kind: 'prompt' },
      { id: 'model', label: '模型', kind: 'model' },
      { id: 'tool', label: '工具包', kind: 'tool' },
      { id: 'memory', label: '记忆', kind: 'memory' },
    ],
    outputs: [
      { id: 'result', label: '执行结果', kind: 'result' },
      { id: 'data', label: '结构化数据', kind: 'data' },
      { id: 'code', label: '代码文件', kind: 'code' },
    ],
    config: { goal: '完成节点目标并输出确定交付物' },
  },
  {
    kind: 'tool',
    title: '工具 / CLI / MCP',
    subtitle: '外部能力',
    description: '把软件、CLI、MCP 或 API 包装成 Agent 可调用能力。',
    icon: Wrench,
    color: 'text-emerald-500',
    inputs: [{ id: 'message', label: '调用目标', kind: 'message' }],
    outputs: [
      { id: 'tool', label: '工具能力', kind: 'tool' },
      { id: 'result', label: '工具结果', kind: 'result' },
    ],
    config: { command: 'codex / claude / 微信 / 剪映 / Chrome' },
  },
  {
    kind: 'memory',
    title: '记忆',
    subtitle: '学习结果',
    description: '检索客户偏好、项目状态、历史错误和可复用流程。',
    icon: Database,
    color: 'text-cyan-500',
    inputs: [{ id: 'message', label: '检索问题', kind: 'message' }],
    outputs: [{ id: 'memory', label: '相关记忆', kind: 'memory' }],
    config: { memoryScope: '项目记忆 + 员工记忆' },
  },
  {
    kind: 'code',
    title: '代码执行',
    subtitle: 'CLI 节点',
    description: '调用 Codex CLI、Claude Code、OpenCode 或自定义脚本。',
    icon: Code2,
    color: 'text-fuchsia-500',
    inputs: [{ id: 'data', label: '输入数据', kind: 'data' }],
    outputs: [
      { id: 'code', label: '源码 / Diff', kind: 'code' },
      { id: 'result', label: '执行日志', kind: 'result' },
    ],
    config: { command: 'codex {{goal}}' },
  },
  {
    kind: 'output',
    title: '交付物',
    subtitle: '客户可见',
    description: '收集最后产物：报告、代码、图片、视频、表格或文件包。',
    icon: FileJson,
    color: 'text-amber-500',
    inputs: [
      { id: 'result', label: '结果', kind: 'result' },
      { id: 'data', label: '结构化数据', kind: 'data' },
      { id: 'code', label: '代码文件', kind: 'code' },
    ],
    outputs: [],
    config: { outputName: '客户最终交付物' },
  },
]

const iconByKind = new Map(specs.map((spec) => [spec.kind, spec.icon]))
const colorByKind = new Map(specs.map((spec) => [spec.kind, spec.color]))
const specByKind = new Map(specs.map((spec) => [spec.kind, spec]))

function createNode(kind: NodeKind, position: { x: number; y: number }, title?: string): FlowNode {
  const spec = specByKind.get(kind)!
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'agenthubFlowNode',
    position,
    data: {
      kind,
      title: title ?? spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      inputs: spec.inputs,
      outputs: spec.outputs,
      config: { ...spec.config },
    },
  }
}

function handleId(direction: 'in' | 'out', port: FlowPort): string {
  return `${direction}:${port.id}:${port.kind}`
}

function parseHandleId(handle: string | null | undefined): { direction: 'in' | 'out'; portId: string; kind: PortKind } | null {
  if (!handle) return null
  const [direction, portId, kind] = handle.split(':') as ['in' | 'out', string, PortKind]
  if ((direction !== 'in' && direction !== 'out') || !portId || !kind) return null
  return { direction, portId, kind }
}

function buildStarterFlow(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const input = createNode('input', { x: 40, y: 160 }, '客户需求')
  const prompt = createNode('prompt', { x: 350, y: 160 }, '任务说明')
  const model = createNode('model', { x: 350, y: 20 }, '主模型')
  const tool = createNode('tool', { x: 350, y: 330 }, '软件能力')
  const agent = createNode('agent', { x: 690, y: 160 }, '执行员工')
  const output = createNode('output', { x: 1030, y: 170 }, '最终交付')

  return {
    nodes: [input, prompt, model, tool, agent, output],
    edges: [
      makeEdge(input, 'message', prompt, 'message', 'message'),
      makeEdge(prompt, 'prompt', agent, 'prompt', 'prompt'),
      makeEdge(model, 'model', agent, 'model', 'model'),
      makeEdge(tool, 'tool', agent, 'tool', 'tool'),
      makeEdge(agent, 'result', output, 'result', 'result'),
    ],
  }
}

function makeEdge(
  source: FlowNode,
  sourcePortId: string,
  target: FlowNode,
  targetPortId: string,
  kind: PortKind,
): FlowEdge {
  const sourcePort = source.data.outputs.find((port) => port.id === sourcePortId)
  const targetPort = target.data.inputs.find((port) => port.id === targetPortId)
  return {
    id: `edge-${source.id}-${sourcePortId}-${target.id}-${targetPortId}`,
    source: source.id,
    target: target.id,
    sourceHandle: sourcePort ? handleId('out', sourcePort) : undefined,
    targetHandle: targetPort ? handleId('in', targetPort) : undefined,
    label: portLabels[kind],
    data: { kind },
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

function AgentHubFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon = iconByKind.get(data.kind) ?? Bot
  const color = colorByKind.get(data.kind) ?? 'text-primary'

  return (
    <div
      className={cn(
        'w-[278px] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition',
        selected ? 'border-primary shadow-lg shadow-primary/15' : 'border-border',
      )}
    >
      <div className="flex items-start gap-2 border-b bg-muted/30 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className={cn('size-4', color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{data.title}</div>
          <div className="truncate text-xs text-muted-foreground">{data.subtitle}</div>
        </div>
        <Badge variant="outline" className="h-5 text-[10px]">
          {data.kind === 'agent' ? '员工' : '组件'}
        </Badge>
      </div>

      <div className="space-y-2 p-3">
        <div className="rounded-lg border bg-background/60 p-2 text-xs leading-5 text-muted-foreground">
          {data.description}
        </div>

        <PortSection title="输入" ports={data.inputs} direction="in" />
        <PortSection title="输出" ports={data.outputs} direction="out" />
      </div>
    </div>
  )
}

function PortSection({
  title,
  ports,
  direction,
}: {
  title: string
  ports: FlowPort[]
  direction: 'in' | 'out'
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-muted-foreground">{title}</div>
      {ports.length === 0 ? (
        <div className="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">无</div>
      ) : (
        ports.map((port) => (
          <div
            key={port.id}
            className={cn(
              'relative flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs',
              direction === 'out' && 'justify-end',
            )}
          >
            <Handle
              type={direction === 'in' ? 'target' : 'source'}
              id={handleId(direction, port)}
              position={direction === 'in' ? Position.Left : Position.Right}
              className="!size-3 !border-2 !border-background"
            />
            {direction === 'in' ? (
              <>
                <span className={cn('size-2 rounded-full', portColors[port.kind])} />
                <span className="truncate">{port.label}</span>
                <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
                  {portLabels[port.kind]}
                </Badge>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {portLabels[port.kind]}
                </Badge>
                <span className="truncate">{port.label}</span>
                <span className={cn('size-2 rounded-full', portColors[port.kind])} />
              </>
            )}
          </div>
        ))
      )}
    </div>
  )
}

const nodeTypes = {
  agenthubFlowNode: AgentHubFlowNode,
}

export function LangflowNativeModule() {
  const starterFlow = useMemo(() => buildStarterFlow(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(starterFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(starterFlow.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(starterFlow.nodes[0]?.id ?? null)
  const [search, setSearch] = useState('')

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const selectedPortSummary = useMemo(() => {
    if (!selectedNode) return null
    return summarizeNodePorts(
      selectedNode.data.inputs.map((port) => port.kind),
      selectedNode.data.outputs.map((port) => port.kind),
    )
  }, [selectedNode])
  const selectedIncomingEdges = useMemo(
    () => edges.filter((edge) => selectedNodeId && edge.target === selectedNodeId),
    [edges, selectedNodeId],
  )
  const selectedOutgoingEdges = useMemo(
    () => edges.filter((edge) => selectedNodeId && edge.source === selectedNodeId),
    [edges, selectedNodeId],
  )

  const filteredSpecs = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return specs
    return specs.filter((spec) =>
      [spec.title, spec.subtitle, spec.description, spec.kind].some((value) => value.toLowerCase().includes(keyword)),
    )
  }, [search])

  const findPortKind = useCallback(
    (nodeId: string | null | undefined, handle: string | null | undefined, direction: 'in' | 'out') => {
      const parsed = parseHandleId(handle)
      const node = nodes.find((item) => item.id === nodeId)
      if (!parsed || !node || parsed.direction !== direction) return null
      const ports = direction === 'in' ? node.data.inputs : node.data.outputs
      return ports.find((port) => port.id === parsed.portId && port.kind === parsed.kind)?.kind ?? null
    },
    [nodes],
  )

  const isValidConnection = useCallback<IsValidConnection<FlowEdge>>(
    (connection) => {
      const outputKind = findPortKind(connection.source, connection.sourceHandle, 'out')
      const inputKind = findPortKind(connection.target, connection.targetHandle, 'in')
      return canConnectPortKinds(outputKind, inputKind)
    },
    [findPortKind],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return
      const kind = findPortKind(connection.source, connection.sourceHandle, 'out') ?? 'result'
      const edge: FlowEdge = {
        ...connection,
        id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        label: portLabels[kind],
        data: { kind },
        markerEnd: { type: MarkerType.ArrowClosed },
      }
      setEdges((current) => addEdge(edge, current))
    },
    [findPortKind, isValidConnection, setEdges],
  )

  const addNode = useCallback(
    (kind: NodeKind) => {
      const offset = nodes.length * 34
      const node = createNode(kind, { x: 120 + offset, y: 120 + offset })
      setNodes((current) => current.concat(node))
      setSelectedNodeId(node.id)
    },
    [nodes.length, setNodes],
  )

  const updateSelectedNode = useCallback(
    (patch: Partial<FlowNodeData>) => {
      if (!selectedNodeId) return
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                  config: {
                    ...node.data.config,
                    ...(patch.config ?? {}),
                  },
                },
              }
            : node,
        ),
      )
    },
    [selectedNodeId, setNodes],
  )

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId))
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId))
    setSelectedNodeId(null)
  }, [selectedNodeId, setEdges, setNodes])

  const resetFlow = useCallback(() => {
    const next = buildStarterFlow()
    setNodes(next.nodes)
    setEdges(next.edges)
    setSelectedNodeId(next.nodes[0]?.id ?? null)
  }, [setEdges, setNodes])

  const flowJson = useMemo(
    () => ({
      source: 'agenthub-langflow-native',
      inspiredBy: 'Langflow v1.10.1 React Flow canvas model',
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data.kind,
        position: node.position,
        data: node.data,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
        kind: edge.data?.kind,
      })),
    }),
    [edges, nodes],
  )

  const validation = useMemo(() => {
    const hasInput = nodes.some((node) => node.data.kind === 'input')
    const hasAgent = nodes.some((node) => node.data.kind === 'agent')
    const hasOutput = nodes.some((node) => node.data.kind === 'output')
    const invalidEdges = edges.filter((edge) => {
      const sourceKind = findPortKind(edge.source, edge.sourceHandle, 'out')
      const targetKind = findPortKind(edge.target, edge.targetHandle, 'in')
      return !canConnectPortKinds(sourceKind, targetKind)
    })

    const warnings = [
      !hasInput ? '缺少客户输入节点' : null,
      !hasAgent ? '缺少员工 Agent 节点' : null,
      !hasOutput ? '缺少交付物节点' : null,
      invalidEdges.length > 0 ? `${invalidEdges.length} 条连线类型不匹配` : null,
    ].filter(Boolean) as string[]

    return {
      ok: warnings.length === 0,
      warnings,
    }
  }, [edges, findPortKind, nodes])

  const copyFlow = useCallback(() => {
    void navigator.clipboard?.writeText(JSON.stringify(flowJson, null, 2))
  }, [flowJson])

  const saveDraft = useCallback(() => {
    window.localStorage.setItem('agenthub.langflow-native.draft', JSON.stringify(flowJson))
  }, [flowJson])

  const selectedIcon = selectedNode ? (iconByKind.get(selectedNode.data.kind) ?? Bot) : Settings2
  const SelectedIcon = selectedIcon

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="size-5 text-primary" />
            <h1 className="text-xl font-semibold">Langflow 编排</h1>
            <Badge variant="secondary">AgentHub 自带模块</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            借鉴 Langflow v1.10.1 的 React Flow 画布方式，在 AgentHub 内直接编辑节点、端口、连线和运行配置。
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={resetFlow}>
            <RotateCcw className="size-4" />
            示例流程
          </Button>
          <Button variant="outline" onClick={copyFlow}>
            <Copy className="size-4" />
            复制 Flow JSON
          </Button>
          <Button variant="outline" onClick={saveDraft}>
            <Save className="size-4" />
            保存草稿
          </Button>
          <Button disabled={!validation.ok}>
            <Play className="size-4" />
            预检运行
          </Button>
        </div>
      </header>

      <div className="agenthub-langflow-shell grid min-h-0 flex-1 overflow-hidden grid-cols-[292px_minmax(0,1fr)_332px]">
        <aside className="relative z-20 flex min-h-0 flex-col overflow-hidden border-r bg-background">
          <div className="shrink-0 space-y-3 border-b p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">组件库</div>
                <div className="text-xs text-muted-foreground">先选组件，再拖线组合流程</div>
              </div>
              <Badge variant="outline">{specs.length} 类</Badge>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索组件"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {filteredSpecs.map((spec) => {
              const Icon = spec.icon
              return (
                <button
                  key={spec.kind}
                  type="button"
                  onClick={() => addNode(spec.kind)}
                  className="w-full rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className={cn('size-4', spec.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">{spec.title}</div>
                        <Plus className="ml-auto size-4 text-muted-foreground" />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{spec.subtitle}</div>
                      <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{spec.description}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="relative z-0 isolate min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_28rem)]">
          <ReactFlow<FlowNode, FlowEdge>
            className="agenthub-langflow-canvas h-full w-full"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            defaultViewport={{ x: 0, y: 96, zoom: 0.82 }}
            minZoom={0.35}
            maxZoom={1.6}
            snapToGrid
            snapGrid={[16, 16]}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls position="bottom-left" showInteractive={false} />
          </ReactFlow>

          <div className="pointer-events-none absolute left-4 top-4 flex gap-2">
            <Badge variant="outline" className="bg-background/90">
              {nodes.length} 节点
            </Badge>
            <Badge variant="outline" className="bg-background/90">
              {edges.length} 连线
            </Badge>
            <Badge variant={validation.ok ? 'secondary' : 'destructive'} className="bg-background/90">
              {validation.ok ? '可预检' : '需修正'}
            </Badge>
          </div>
        </main>

        <aside className="relative z-20 flex min-h-0 flex-col overflow-hidden border-l bg-background">
          <div className="shrink-0 border-b p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <SelectedIcon className="size-4 text-primary" />
                  节点检查器
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedNode ? '配置当前节点的名字、目标和运行参数。' : '点选画布里的节点后在这里设置。'}
                </div>
              </div>
              {selectedNode ? (
                <Button variant="destructive" size="icon-sm" onClick={deleteSelectedNode}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {selectedNode ? (
              <div className="space-y-4">
                <section className="space-y-2 rounded-xl border bg-card p-3">
                  <label className="text-xs font-medium text-muted-foreground">节点名称</label>
                  <Input value={selectedNode.data.title} onChange={(event) => updateSelectedNode({ title: event.target.value })} />
                  <label className="text-xs font-medium text-muted-foreground">说明</label>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-lg border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={selectedNode.data.description}
                    onChange={(event) => updateSelectedNode({ description: event.target.value })}
                  />
                </section>

                <section className="space-y-2 rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">端口</div>
                    <Badge variant="outline">
                      {selectedNode.data.inputs.length} 入 / {selectedNode.data.outputs.length} 出
                    </Badge>
                  </div>
                  {selectedPortSummary ? (
                    <div className="rounded-lg border bg-primary/5 p-2 text-xs leading-5 text-muted-foreground">
                      <div>可接收：{selectedPortSummary.accepts}</div>
                      <div>可产出：{selectedPortSummary.produces}</div>
                      <div className="mt-1 text-foreground">
                        下游只会收到你连过去的那一种产物，例如视频线只传视频，代码线只传代码。
                      </div>
                    </div>
                  ) : null}
                  <InspectorPorts title="可接收" ports={selectedNode.data.inputs} />
                  <InspectorPorts title="可产出" ports={selectedNode.data.outputs} />
                </section>

                <section className="space-y-2 rounded-xl border bg-card p-3">
                  <div className="text-sm font-semibold">当前连线</div>
                  <ConnectionList
                    title="上游输入"
                    emptyLabel="还没有上游节点连到这里"
                    edges={selectedIncomingEdges}
                    nodes={nodes}
                    direction="incoming"
                  />
                  <ConnectionList
                    title="下游输出"
                    emptyLabel="还没有把产物交给下游"
                    edges={selectedOutgoingEdges}
                    nodes={nodes}
                    direction="outgoing"
                  />
                </section>

                <section className="space-y-2 rounded-xl border bg-card p-3">
                  <div className="text-sm font-semibold">运行配置</div>
                  <ConfigInput
                    label="目标"
                    value={selectedNode.data.config.goal ?? ''}
                    onChange={(value) => updateSelectedNode({ config: { goal: value } })}
                  />
                  <ConfigInput
                    label="模型 / 命令"
                    value={selectedNode.data.config.model ?? selectedNode.data.config.command ?? ''}
                    onChange={(value) =>
                      updateSelectedNode({
                        config:
                          selectedNode.data.kind === 'tool' || selectedNode.data.kind === 'code'
                            ? { command: value }
                            : { model: value },
                      })
                    }
                  />
                  <ConfigInput
                    label="交付物名称"
                    value={selectedNode.data.config.outputName ?? ''}
                    onChange={(value) => updateSelectedNode({ config: { outputName: value } })}
                  />
                </section>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
                选择一个节点后，可以在这里编辑名称、输入输出端口和运行配置。
              </div>
            )}
          </div>

          <div className="shrink-0 border-t p-4">
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {validation.ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-destructive" />}
                运行前检查
              </div>
              {validation.ok ? (
                <div className="text-xs text-muted-foreground">流程结构完整，端口类型匹配，可以进入运行层。</div>
              ) : (
                <ul className="space-y-1 text-xs text-destructive">
                  {validation.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ConnectionList({
  title,
  emptyLabel,
  edges,
  nodes,
  direction,
}: {
  title: string
  emptyLabel: string
  edges: FlowEdge[]
  nodes: FlowNode[]
  direction: 'incoming' | 'outgoing'
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {edges.length === 0 ? (
        <div className="rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        edges.map((edge) => {
          const source = nodes.find((node) => node.id === edge.source)
          const target = nodes.find((node) => node.id === edge.target)
          const sourceKind = parseHandleId(edge.sourceHandle)?.kind
          const targetKind = parseHandleId(edge.targetHandle)?.kind
          const hint = buildPortCompatibilityHint(sourceKind, targetKind)
          return (
            <div key={edge.id} className="rounded-md border bg-background px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {direction === 'incoming'
                    ? `${source?.data.title ?? '上游'} -> 当前`
                    : `当前 -> ${target?.data.title ?? '下游'}`}
                </span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {edge.label}
                </Badge>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {hint}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function InspectorPorts({ title, ports }: { title: string; ports: FlowPort[] }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{title}</div>
      {ports.length === 0 ? (
        <div className="rounded-lg border border-dashed px-2 py-2 text-xs text-muted-foreground">无</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ports.map((port) => (
            <Badge key={port.id} variant="outline" className="gap-1">
              <span className={cn('size-2 rounded-full', portColors[port.kind])} />
              {port.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function ConfigInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="未设置" />
    </label>
  )
}

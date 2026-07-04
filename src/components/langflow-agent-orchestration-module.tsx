'use client'

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
  Image,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { AppModuleId } from '@/modules/app-modules'

type FlowBlockType = 'input' | 'prompt' | 'agent' | 'model' | 'tool' | 'memory' | 'validator' | 'output'
type ArtifactKind = 'text' | 'json' | 'code' | 'image' | 'video' | 'file'

interface FlowBlockSpec {
  type: FlowBlockType
  title: string
  subtitle: string
  description: string
  icon: typeof Bot
  accent: string
  outputs: ArtifactKind[]
}

interface FlowNode {
  id: string
  type: FlowBlockType
  title: string
  description: string
  x: number
  y: number
  outputs: ArtifactKind[]
}

interface FlowEdge {
  id: string
  from: string
  to: string
  artifact: ArtifactKind
}

const blockSpecs: FlowBlockSpec[] = [
  {
    type: 'input',
    title: '任务输入',
    subtitle: '客户目标 / 文件 / 约束',
    description: '把用户目标、输入文件、上下文和验收标准整理成结构化入口。',
    icon: FileText,
    accent: 'bg-sky-500',
    outputs: ['text', 'file', 'json'],
  },
  {
    type: 'prompt',
    title: '提示词',
    subtitle: '角色规则 / 工作说明',
    description: '沉淀 Agent 的角色、行为边界、输出格式和失败恢复规则。',
    icon: Sparkles,
    accent: 'bg-violet-500',
    outputs: ['text'],
  },
  {
    type: 'agent',
    title: 'Agent 员工',
    subtitle: '计划 / 执行 / 验证',
    description: '像 Langflow 的组件节点一样，把 Agent 作为可连接、可检查、可运行的工作单元。',
    icon: Bot,
    accent: 'bg-blue-500',
    outputs: ['text', 'json', 'code', 'file'],
  },
  {
    type: 'model',
    title: '模型',
    subtitle: '已配置模型直接选择',
    description: '只引用模型管理里已经配置好的模型，不在节点里重复暴露适配器细节。',
    icon: Brain,
    accent: 'bg-emerald-500',
    outputs: ['text', 'json'],
  },
  {
    type: 'tool',
    title: '工具能力',
    subtitle: 'Skills / MCP / CLI',
    description: '连接已经设置好的技能、MCP、CLI 或软件能力，让 Agent 调用。',
    icon: Wrench,
    accent: 'bg-orange-500',
    outputs: ['json', 'file', 'code'],
  },
  {
    type: 'memory',
    title: '记忆',
    subtitle: '项目经验 / 客户偏好',
    description: '读取或写入长期记忆，让流程可以复用经验和避开旧错误。',
    icon: Database,
    accent: 'bg-cyan-500',
    outputs: ['text', 'json'],
  },
  {
    type: 'validator',
    title: '验收检查',
    subtitle: '产物校验 / 风险拦截',
    description: '检查每个节点是否真的产出了约定交付物，而不是只说完成了。',
    icon: ShieldCheck,
    accent: 'bg-amber-500',
    outputs: ['json', 'text'],
  },
  {
    type: 'output',
    title: '交付产物',
    subtitle: '客户可见结果',
    description: '汇总文档、代码、图片、视频、JSON、文件包等最终可见交付物。',
    icon: CheckCircle2,
    accent: 'bg-lime-500',
    outputs: ['file', 'text', 'json'],
  },
]

const artifactLabels: Record<ArtifactKind, string> = {
  text: '文本',
  json: 'JSON',
  code: '源码',
  image: '图片',
  video: '视频',
  file: '文件',
}

const artifactIcons: Record<ArtifactKind, typeof FileText> = {
  text: FileText,
  json: FileJson,
  code: Code2,
  image: Image,
  video: Video,
  file: FileText,
}

const initialNodes: FlowNode[] = [
  {
    id: 'input-brief',
    type: 'input',
    title: '客户目标',
    description: '接收客户要完成的业务目标、素材和约束。',
    x: 40,
    y: 60,
    outputs: ['text', 'file', 'json'],
  },
  {
    id: 'agent-planner',
    type: 'agent',
    title: '规划 Agent',
    description: '拆解任务，决定需要哪些员工、工具和交付物。',
    x: 300,
    y: 60,
    outputs: ['json', 'text'],
  },
  {
    id: 'tool-worker',
    type: 'tool',
    title: '工具执行',
    description: '调用 Skills、MCP、CLI 或软件命令完成动作。',
    x: 560,
    y: 60,
    outputs: ['file', 'code', 'json'],
  },
  {
    id: 'validator-result',
    type: 'validator',
    title: '验收检查',
    description: '检查产物是否符合输出合约。',
    x: 820,
    y: 60,
    outputs: ['json', 'text'],
  },
  {
    id: 'output-delivery',
    type: 'output',
    title: '客户交付',
    description: '把可见交付物放入交付物中心。',
    x: 1080,
    y: 60,
    outputs: ['file', 'text', 'json'],
  },
]

const initialEdges: FlowEdge[] = [
  { id: 'edge-brief-planner', from: 'input-brief', to: 'agent-planner', artifact: 'json' },
  { id: 'edge-planner-tool', from: 'agent-planner', to: 'tool-worker', artifact: 'json' },
  { id: 'edge-tool-validator', from: 'tool-worker', to: 'validator-result', artifact: 'file' },
  { id: 'edge-validator-output', from: 'validator-result', to: 'output-delivery', artifact: 'json' },
]

export function LangflowAgentOrchestrationModule({
  onModeChange,
}: {
  onModeChange: (mode: AppModuleId) => void
}) {
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes)
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState(initialNodes[1].id)
  const [notice, setNotice] = useState('')

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0]

  const flowExport = useMemo(
    () => ({
      schema: 'agenthub.langflow_style_agent_flow.v1',
      source: {
        family: 'Langflow v1.10.1 clean-room module',
        concepts: ['component palette', 'node graph', 'edge artifact contract', 'inspection panel', 'run trace'],
      },
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        description: node.description,
        position: { x: node.x, y: node.y },
        outputContract: node.outputs,
      })),
      edges,
      runtime: {
        mode: 'plan_execute_verify',
        artifactRouting: 'edge_artifact_kind',
        memory: 'optional_per_agent',
      },
    }),
    [edges, nodes],
  )

  const addNode = (spec: FlowBlockSpec) => {
    const previous = nodes[nodes.length - 1]
    const id = `${spec.type}-${Date.now().toString(36)}`
    const nextNode: FlowNode = {
      id,
      type: spec.type,
      title: spec.title,
      description: spec.description,
      x: previous ? previous.x + 260 : 40,
      y: previous ? previous.y + ((nodes.length % 2) * 130) : 60,
      outputs: spec.outputs,
    }
    setNodes((current) => [...current, nextNode])
    if (previous) {
      setEdges((current) => [
        ...current,
        {
          id: `edge-${previous.id}-${id}`,
          from: previous.id,
          to: id,
          artifact: previous.outputs[0] ?? 'text',
        },
      ])
    }
    setSelectedNodeId(id)
  }

  const updateSelectedNode = (patch: Partial<FlowNode>) => {
    setNodes((current) => current.map((node) => (node.id === selectedNode.id ? { ...node, ...patch } : node)))
  }

  const deleteSelectedNode = () => {
    if (!selectedNode || nodes.length <= 1) return
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
    setEdges((current) => current.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id))
    setSelectedNodeId(nodes.find((node) => node.id !== selectedNode.id)?.id ?? '')
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(flowExport, null, 2))
      setNotice('流程 JSON 已复制，可以交给编排画布或后端运行器继续接入。')
    } catch {
      setNotice('复制失败，但右侧结构已经生成。')
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Agent 编排模块</h2>
            <Badge variant="outline">Langflow 风格</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            把 Agent、模型、提示词、工具、记忆和交付物做成可连接节点，节点之间用明确产物类型传递。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyJson}>
            <Copy className="size-4" />
            复制结构
          </Button>
          <Button onClick={() => onModeChange('agent-canvas')}>
            <Play className="size-4" />
            打开现有画布
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)_21rem] overflow-hidden">
        <aside className="min-h-0 border-r bg-card/40">
          <div className="border-b px-4 py-3">
            <h3 className="font-medium">组件库</h3>
            <p className="mt-1 text-xs text-muted-foreground">点击组件即可加入流程。</p>
          </div>
          <ScrollArea className="h-full">
            <div className="space-y-2 p-3">
              {blockSpecs.map((spec) => {
                const Icon = spec.icon
                return (
                  <button
                    key={spec.type}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary/60 hover:bg-primary/5"
                    onClick={() => addNode(spec)}
                  >
                    <span className={cn('mt-0.5 flex size-9 items-center justify-center rounded-lg text-white', spec.accent)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{spec.title}</span>
                      <span className="block text-xs text-muted-foreground">{spec.subtitle}</span>
                      <span className="mt-2 flex flex-wrap gap-1">
                        {spec.outputs.map((kind) => (
                          <Badge key={kind} variant="outline" className="h-4 px-1.5 text-[10px]">
                            {artifactLabels[kind]}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        <main className="min-h-0 overflow-auto bg-[radial-gradient(circle_at_1px_1px,hsl(var(--muted-foreground)/0.18)_1px,transparent_0)] [background-size:22px_22px]">
          <div className="relative h-[760px] min-w-[1350px] p-8">
            <svg className="pointer-events-none absolute inset-0 size-full">
              {edges.map((edge) => {
                const from = nodes.find((node) => node.id === edge.from)
                const to = nodes.find((node) => node.id === edge.to)
                if (!from || !to) return null
                const startX = from.x + 200
                const startY = from.y + 54
                const endX = to.x
                const endY = to.y + 54
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${startX} ${startY} C ${startX + 70} ${startY}, ${endX - 70} ${endY}, ${endX} ${endY}`}
                      fill="none"
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                    />
                    <text x={(startX + endX) / 2 - 18} y={(startY + endY) / 2 - 8} className="fill-muted-foreground text-[11px]">
                      {artifactLabels[edge.artifact]}
                    </text>
                  </g>
                )
              })}
            </svg>

            {nodes.map((node) => {
              const spec = blockSpecs.find((item) => item.type === node.type) ?? blockSpecs[0]
              const Icon = spec.icon
              return (
                <button
                  key={node.id}
                  type="button"
                  className={cn(
                    'absolute w-[210px] rounded-lg border bg-card p-3 text-left shadow-sm transition',
                    selectedNodeId === node.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50',
                  )}
                  style={{ left: node.x, top: node.y }}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('flex size-7 items-center justify-center rounded-md text-white', spec.accent)}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{node.title}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{node.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {node.outputs.map((kind) => {
                      const ArtifactIcon = artifactIcons[kind]
                      return (
                        <Badge key={kind} variant="outline" className="gap-1">
                          <ArtifactIcon className="size-3" />
                          {artifactLabels[kind]}
                        </Badge>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        </main>

        <aside className="min-h-0 border-l bg-card/40">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>节点检查器</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">节点名称</label>
                    <Input value={selectedNode?.title ?? ''} onChange={(event) => updateSelectedNode({ title: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">职责说明</label>
                    <Textarea
                      value={selectedNode?.description ?? ''}
                      className="min-h-24"
                      onChange={(event) => updateSelectedNode({ description: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">这个节点可以产出</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(artifactLabels) as ArtifactKind[]).map((kind) => {
                        const checked = selectedNode?.outputs.includes(kind)
                        return (
                          <label
                            key={kind}
                            className={cn(
                              'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                              checked && 'border-primary bg-primary/10',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const outputs = event.target.checked
                                  ? [...(selectedNode?.outputs ?? []), kind]
                                  : (selectedNode?.outputs ?? []).filter((item) => item !== kind)
                                updateSelectedNode({ outputs })
                              }}
                            />
                            {artifactLabels[kind]}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <Button variant="destructive" className="w-full" onClick={deleteSelectedNode}>
                    <Trash2 className="size-4" />
                    删除节点
                  </Button>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>运行骨架</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {['接收目标', '选择 Agent 与模型', '调用工具能力', '按产物类型连线', '验证交付物'].map((item, index) => (
                    <div key={item} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                      <Badge variant="secondary">{index + 1}</Badge>
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {notice && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{notice}</div>}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </section>
  )
}

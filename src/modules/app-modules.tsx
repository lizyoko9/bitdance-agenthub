'use client'

import {
  BarChart3,
  Bot,
  Brain,
  GitBranch,
  Layers,
  MessageSquare,
  MonitorCog,
  Package,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { AgentLibrary } from '@/components/agent-library'
import { AgentWorkflowCanvas } from '@/components/agent-workflow-canvas'
import { ArtifactLibrary } from '@/components/artifact-library'
import { ChatPanel } from '@/components/chat-panel'
import { ConfigOpsCenter } from '@/components/config-ops-center'
import { DesktopWorkbench } from '@/components/desktop-workbench'
import { InfiniteCanvasModule } from '@/components/infinite-canvas-module'
import { LangflowAgentOrchestrationModule } from '@/components/langflow-agent-orchestration-module'
import { LangflowNativeModule } from '@/components/langflow-native-module'
import { MemoryManagementCenter } from '@/components/memory-management-center'
import { ModelControlCenter } from '@/components/model-control-center'
import { ProductionIntegrationsCenter } from '@/components/production-integrations-center'
import { SkillsCenter } from '@/components/skills-center'
import { ToolControlCenter } from '@/components/tool-control-center'
import { UsageDashboard } from '@/components/usage-dashboard'
import { WorkflowLibrary } from '@/components/workflow-library'
import { buildVisibleAppModules, normalizeOrchestrationModuleId } from '@/lib/app-module-navigation'

export type AppModuleId =
  | 'workbench'
  | 'conversations'
  | 'artifacts'
  | 'employee-factory'
  | 'workflows'
  | 'agent-canvas'
  | 'agent-orchestration'
  | 'langflow-native'
  | 'infinite-canvas'
  | 'skills'
  | 'memory'
  | 'context'
  | 'models'
  | 'tools'
  | 'capabilities'
  | 'collaboration'
  | 'governance'
  | 'configops'
  | 'production'
  | 'agents'
  | 'analytics'

export type AppModuleGroup = 'primary' | 'advanced' | 'hidden'

export interface AppModuleRenderContext {
  onModeChange: (mode: AppModuleId) => void
  agentSettingsRequestKey: number
  canvasWorkflowId: string | null
  onOpenWorkflow: (workflowId: string) => void
}

export interface AppModuleDefinition {
  id: AppModuleId
  label: string
  description: string
  icon: LucideIcon
  group: AppModuleGroup
  frame?: 'workspace' | 'bare'
  normalizeTo?: AppModuleId
  render: (ctx: AppModuleRenderContext) => ReactNode
}

export const appModules: AppModuleDefinition[] = [
  {
    id: 'workbench',
    label: '工作台',
    description: '按用户业务动态展示任务、数据、运行状态和下一步动作。',
    icon: MonitorCog,
    group: 'primary',
    render: ({ onModeChange }) => <DesktopWorkbench onModeChange={onModeChange} />,
  },
  {
    id: 'conversations',
    label: '对话',
    description: '普通模型对话和多智能体工作对话区。',
    icon: MessageSquare,
    group: 'primary',
    frame: 'bare',
    render: () => <ChatPanel />,
  },
  {
    id: 'agents',
    label: '智能体',
    description: '创建员工级智能体，并配置模型、技能、工具、权限和记忆。',
    icon: Bot,
    group: 'primary',
    render: ({ agentSettingsRequestKey }) => (
      <AgentLibrary
        settingsRequestKey={agentSettingsRequestKey}
        focusCapabilitiesOnSettingsOpen={agentSettingsRequestKey > 0}
      />
    ),
  },
  {
    id: 'workflows',
    label: '工作流',
    description: '集中展示保存过和运行过的编排流程。',
    icon: Workflow,
    group: 'primary',
    render: ({ onOpenWorkflow }) => (
      <WorkflowLibrary
        onOpenWorkflow={onOpenWorkflow}
        onCreateWorkflow={() => {
          onOpenWorkflow('')
        }}
      />
    ),
  },
  {
    id: 'agent-canvas',
    label: '编排画布',
    description: '像搭积木一样连接智能体、产物、审批、条件和工具节点。',
    icon: GitBranch,
    group: 'primary',
    render: ({ canvasWorkflowId }) => <AgentWorkflowCanvas initialWorkflowId={canvasWorkflowId ?? undefined} />,
  },
  {
    id: 'agent-orchestration',
    label: 'Agent 编排',
    description: 'Langflow 风格的 Agent 编排模块：组件库、节点图、产物连线、运行骨架和节点检查器。',
    icon: Workflow,
    group: 'primary',
    render: ({ onModeChange }) => <LangflowAgentOrchestrationModule onModeChange={onModeChange} />,
  },
  {
    id: 'langflow-native',
    label: 'Langflow 原生',
    description: '直接按 Langflow v1.10.1 的 Flow JSON、节点、边、handle 和运行顺序处理。',
    icon: GitBranch,
    group: 'primary',
    render: () => <LangflowNativeModule />,
  },
  {
    id: 'infinite-canvas',
    label: '无限画布',
    description: 'Leafer UI 风格的无限画布模块：拖拽、缩放、图层、节点选择和缩略图。',
    icon: Layers,
    group: 'primary',
    render: () => <InfiniteCanvasModule />,
  },
  {
    id: 'skills',
    label: '技能管理',
    description: '管理本地已安装技能和智能体可使用的技能包。',
    icon: Package,
    group: 'primary',
    render: () => <SkillsCenter />,
  },
  {
    id: 'models',
    label: '模型管理',
    description: '管理模型、落地 IP、连接测试和路由预览。',
    icon: Zap,
    group: 'primary',
    render: () => <ModelControlCenter />,
  },
  {
    id: 'tools',
    label: '工具连接',
    description: '把 CLI、MCP、软件命令和自动化能力注册给智能体。',
    icon: Wrench,
    group: 'primary',
    render: () => <ToolControlCenter />,
  },
  {
    id: 'artifacts',
    label: '交付物',
    description: '查看智能体产出的文件、报告、代码、图片和其它交付结果。',
    icon: Layers,
    group: 'advanced',
    render: () => <ArtifactLibrary />,
  },
  {
    id: 'memory',
    label: '记忆管理',
    description: '查看、编辑和清理智能体长期记忆与学习结果。',
    icon: Brain,
    group: 'advanced',
    render: () => <MemoryManagementCenter />,
  },
  {
    id: 'analytics',
    label: '数据分析',
    description: '查看模型、智能体和会话的 token、费用和运行指标。',
    icon: BarChart3,
    group: 'advanced',
    render: () => <UsageDashboard />,
  },
  {
    id: 'employee-factory',
    label: '智能体设置',
    description: '旧入口兼容模块，统一收口到智能体模块。',
    icon: Bot,
    group: 'hidden',
    normalizeTo: 'agents',
    render: () => <AgentLibrary defaultSettingsOpen />,
  },
  {
    id: 'context',
    label: '上下文',
    description: '旧入口兼容模块，统一收口到智能体设置。',
    icon: Brain,
    group: 'hidden',
    normalizeTo: 'agents',
    render: () => <AgentLibrary defaultSettingsOpen />,
  },
  {
    id: 'capabilities',
    label: '能力图谱',
    description: '旧入口兼容模块，统一收口到智能体设置。',
    icon: Workflow,
    group: 'hidden',
    normalizeTo: 'agents',
    render: () => <AgentLibrary defaultSettingsOpen />,
  },
  {
    id: 'collaboration',
    label: '团队协作',
    description: '旧入口兼容模块，统一收口到智能体设置。',
    icon: Users,
    group: 'hidden',
    normalizeTo: 'agents',
    render: () => <AgentLibrary defaultSettingsOpen />,
  },
  {
    id: 'governance',
    label: '安全治理',
    description: '旧入口兼容模块，统一收口到智能体设置。',
    icon: ShieldCheck,
    group: 'hidden',
    normalizeTo: 'agents',
    render: () => <AgentLibrary defaultSettingsOpen />,
  },
  {
    id: 'configops',
    label: '配置管理',
    description: '高级配置版本、冲突、锁和发布影响检查。',
    icon: Settings2,
    group: 'hidden',
    render: () => <ConfigOpsCenter />,
  },
  {
    id: 'production',
    label: '交付检查',
    description: '交付前检查、真实控制、虚拟工位和现场试运行。',
    icon: ShieldCheck,
    group: 'hidden',
    render: () => <ProductionIntegrationsCenter />,
  },
]

const displayOverrides: Partial<Record<AppModuleId, Pick<AppModuleDefinition, 'label' | 'description'>>> = {
  'langflow-native': {
    label: 'Langflow 编排',
    description: 'AgentHub 自带的 Langflow 风格节点编排模块，支持组件库、节点端口、连线和右侧配置。',
  },
}

function withDisplayOverride(module: AppModuleDefinition): AppModuleDefinition {
  const override = displayOverrides[module.id]
  return override ? { ...module, ...override } : module
}

export const primaryAppModules = buildVisibleAppModules(appModules, 'primary').map(withDisplayOverride)
export const advancedAppModules = buildVisibleAppModules(appModules, 'advanced').map(withDisplayOverride)

const moduleById = new Map(appModules.map((module) => [module.id, module]))

export function getAppModule(id: AppModuleId): AppModuleDefinition {
  return withDisplayOverride(moduleById.get(id) ?? moduleById.get('workbench')!)
}

export function getAppModuleLabel(id: AppModuleId): string {
  return getAppModule(id).label
}

export function normalizeAppModuleId(id: AppModuleId): AppModuleId {
  const orchestrationId = normalizeOrchestrationModuleId(id) as AppModuleId
  if (orchestrationId !== id) return orchestrationId
  return getAppModule(id).normalizeTo ?? id
}

export function renderAppModule(id: AppModuleId, context: AppModuleRenderContext): ReactNode {
  return getAppModule(id).render(context)
}

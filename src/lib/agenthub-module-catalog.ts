export type AgentHubModuleLayer =
  | 'workspace'
  | 'employee'
  | 'orchestration'
  | 'capability'
  | 'delivery'
  | 'insight'
  | 'extension'

export type AgentHubModuleAccess = 'free' | 'paid'

export type AgentHubModuleBlock = {
  id: string
  label: string
  layer: AgentHubModuleLayer
  access: AgentHubModuleAccess
  defaultEnabled: boolean
  dependencyIds: string[]
}

export type AgentHubModuleCompositionReport = {
  valid: boolean
  blockers: string[]
}

const orchestrationAliases = new Set(['workflows', 'agent-orchestration', 'langflow-native', 'infinite-canvas'])

export const AGENTHUB_MODULE_BLOCKS: AgentHubModuleBlock[] = [
  {
    id: 'workbench',
    label: '工作台',
    layer: 'workspace',
    access: 'free',
    defaultEnabled: true,
    dependencyIds: [],
  },
  {
    id: 'conversations',
    label: '对话',
    layer: 'workspace',
    access: 'free',
    defaultEnabled: true,
    dependencyIds: ['models'],
  },
  {
    id: 'agents',
    label: '智能体',
    layer: 'employee',
    access: 'free',
    defaultEnabled: true,
    dependencyIds: ['models'],
  },
  {
    id: 'agent-canvas',
    label: '编排画布',
    layer: 'orchestration',
    access: 'free',
    defaultEnabled: true,
    dependencyIds: ['agents'],
  },
  {
    id: 'skills',
    label: '技能管理',
    layer: 'capability',
    access: 'free',
    defaultEnabled: true,
    dependencyIds: [],
  },
  {
    id: 'models',
    label: '模型管理',
    layer: 'capability',
    access: 'free',
    defaultEnabled: true,
    dependencyIds: [],
  },
  {
    id: 'tools',
    label: '工具连接',
    layer: 'capability',
    access: 'free',
    defaultEnabled: true,
    dependencyIds: [],
  },
  {
    id: 'artifacts',
    label: '交付物',
    layer: 'delivery',
    access: 'free',
    defaultEnabled: false,
    dependencyIds: ['agent-canvas'],
  },
  {
    id: 'memory',
    label: '记忆管理',
    layer: 'employee',
    access: 'free',
    defaultEnabled: false,
    dependencyIds: ['agents'],
  },
  {
    id: 'analytics',
    label: '数据分析',
    layer: 'insight',
    access: 'free',
    defaultEnabled: false,
    dependencyIds: [],
  },
]

export function normalizeModuleBlockId(id: string): string {
  if (orchestrationAliases.has(id)) return 'agent-canvas'
  if (['employee-factory', 'context', 'capabilities', 'collaboration', 'governance'].includes(id)) return 'agents'
  return id
}

export function getDefaultModuleLayout(): AgentHubModuleBlock[] {
  return AGENTHUB_MODULE_BLOCKS.filter((module) => module.defaultEnabled)
}

export function validateModuleComposition(modules: AgentHubModuleBlock[]): AgentHubModuleCompositionReport {
  const ids = new Set([
    ...AGENTHUB_MODULE_BLOCKS.map((moduleBlock) => moduleBlock.id),
    ...modules.map((moduleBlock) => moduleBlock.id),
  ])
  const blockers: string[] = []

  for (const moduleBlock of modules) {
    if (moduleBlock.access !== 'free') {
      blockers.push(`${moduleBlock.id} cannot be paid gated`)
    }

    for (const dependencyId of moduleBlock.dependencyIds) {
      const normalizedDependencyId = normalizeModuleBlockId(dependencyId)
      if (!ids.has(normalizedDependencyId)) {
        blockers.push(`${moduleBlock.id} depends on missing module ${dependencyId}`)
      }
    }
  }

  return {
    valid: blockers.length === 0,
    blockers,
  }
}

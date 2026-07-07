export type AgentHubModuleLayer =
  | 'workspace'
  | 'employee'
  | 'orchestration'
  | 'capability'
  | 'delivery'
  | 'insight'
  | 'extension'

export type AgentHubModuleAccess = 'free'

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

export type AgentHubModuleActivationReport = {
  valid: boolean
  enabledIds: string[]
  disabledIds: string[]
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
  if (['employee-factory', 'context', 'capabilities', 'collaboration', 'governance', 'memory'].includes(id)) {
    return 'agents'
  }
  return id
}

export function getDefaultModuleLayout(): AgentHubModuleBlock[] {
  return AGENTHUB_MODULE_BLOCKS.filter((module) => module.defaultEnabled)
}

export function getEnabledModuleLayout(requestedModuleIds?: string[]): AgentHubModuleBlock[] {
  if (!requestedModuleIds) return getDefaultModuleLayout()

  const defaultModuleIds = getDefaultModuleLayout().map((moduleBlock) => moduleBlock.id)
  const activation = resolveModuleActivation([...defaultModuleIds, ...requestedModuleIds])
  const enabledIdSet = new Set(activation.enabledIds)

  return AGENTHUB_MODULE_BLOCKS.filter((moduleBlock) => enabledIdSet.has(moduleBlock.id))
}

export function resolveModuleActivation(requestedModuleIds: string[]): AgentHubModuleActivationReport {
  const blockById = new Map(AGENTHUB_MODULE_BLOCKS.map((moduleBlock) => [moduleBlock.id, moduleBlock]))
  const enabled = new Set<string>()
  const blockers: string[] = []

  const enableWithDependencies = (moduleId: string, visiting: Set<string>): boolean => {
    const normalizedModuleId = normalizeModuleBlockId(moduleId)
    const moduleBlock = blockById.get(normalizedModuleId)

    if (!moduleBlock) {
      blockers.push(`${moduleId} is not a known AgentHub module`)
      return false
    }

    if (!hasFreeModuleAccess(moduleBlock)) {
      blockers.push(`${normalizedModuleId} cannot be paid gated`)
      return false
    }

    if (visiting.has(normalizedModuleId)) {
      blockers.push(`${normalizedModuleId} has a circular module dependency`)
      return false
    }

    if (enabled.has(normalizedModuleId)) return true

    const nextVisiting = new Set(visiting)
    nextVisiting.add(normalizedModuleId)

    let dependenciesReady = true
    for (const dependencyId of moduleBlock.dependencyIds) {
      dependenciesReady = enableWithDependencies(dependencyId, nextVisiting) && dependenciesReady
    }

    if (dependenciesReady) {
      enabled.add(normalizedModuleId)
    }

    return dependenciesReady
  }

  for (const moduleId of requestedModuleIds) {
    enableWithDependencies(moduleId, new Set())
  }

  const enabledIds = [...enabled]
  const disabledIds = AGENTHUB_MODULE_BLOCKS.map((moduleBlock) => moduleBlock.id).filter(
    (moduleId) => !enabled.has(moduleId),
  )

  return {
    valid: blockers.length === 0,
    enabledIds,
    disabledIds,
    blockers,
  }
}

export function validateModuleComposition(modules: AgentHubModuleBlock[]): AgentHubModuleCompositionReport {
  const ids = new Set([
    ...AGENTHUB_MODULE_BLOCKS.map((moduleBlock) => moduleBlock.id),
    ...modules.map((moduleBlock) => moduleBlock.id),
  ])
  const blockers: string[] = []

  for (const moduleBlock of modules) {
    if (!hasFreeModuleAccess(moduleBlock)) {
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

function hasFreeModuleAccess(moduleBlock: Pick<AgentHubModuleBlock, 'access'>): boolean {
  return String(moduleBlock.access) === 'free'
}

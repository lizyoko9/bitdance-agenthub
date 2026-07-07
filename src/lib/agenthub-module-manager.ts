import {
  AGENTHUB_MODULE_BLOCKS,
  type AgentHubModuleAccess,
  type AgentHubModuleBlock,
  getDefaultModuleLayout,
  normalizeModuleBlockId,
  resolveModuleActivation,
} from './agenthub-module-catalog'

export type AgentHubManagedModule = {
  id: string
  label: string
  access: AgentHubModuleAccess
  layer: AgentHubModuleBlock['layer']
  active: boolean
  defaultEnabled: boolean
  dependencyIds: string[]
  dependencyLabels: string[]
  statusLabel: string
  statusTone: 'ready' | 'muted' | 'warning'
  actionLabel: string
  dependencyHint: string
}

export type AgentHubModuleManagerView = {
  activeModules: AgentHubManagedModule[]
  availableModules: AgentHubManagedModule[]
  blockers: string[]
}

export type BuildAgentHubModuleManagerViewInput = {
  enabledModuleIds?: string[]
}

export function buildAgentHubModuleManagerView(
  input: BuildAgentHubModuleManagerViewInput = {},
): AgentHubModuleManagerView {
  const defaultModuleIds = getDefaultModuleLayout().map((moduleBlock) => moduleBlock.id)
  const requestedModuleIds = input.enabledModuleIds
    ? [...defaultModuleIds, ...input.enabledModuleIds]
    : defaultModuleIds
  const activation = input.enabledModuleIds ? resolveModuleActivation(requestedModuleIds) : null
  const activeIdSet = new Set(input.enabledModuleIds ? (activation?.enabledIds ?? []) : defaultModuleIds)
  const activeModuleIds = AGENTHUB_MODULE_BLOCKS.filter((moduleBlock) => activeIdSet.has(moduleBlock.id)).map(
    (moduleBlock) => moduleBlock.id,
  )
  const managedModules = AGENTHUB_MODULE_BLOCKS.map((moduleBlock) => toManagedModule(moduleBlock, activeIdSet))

  return {
    activeModules: activeModuleIds
      .map((moduleId) => managedModules.find((moduleBlock) => moduleBlock.id === moduleId))
      .filter((moduleBlock): moduleBlock is AgentHubManagedModule => Boolean(moduleBlock)),
    availableModules: managedModules.filter((moduleBlock) => !activeIdSet.has(moduleBlock.id)),
    blockers: activation?.blockers ?? [],
  }
}

function toManagedModule(moduleBlock: AgentHubModuleBlock, activeIdSet: Set<string>): AgentHubManagedModule {
  const dependencyIds = collectDependencyIds(moduleBlock)
  const active = activeIdSet.has(moduleBlock.id)
  const dependencyLabels = dependencyIds
    .map((dependencyId) => AGENTHUB_MODULE_BLOCKS.find((candidate) => candidate.id === dependencyId))
    .filter((dependency): dependency is AgentHubModuleBlock => Boolean(dependency))
    .map((dependency) => dependency.label)
  const hasDependencies = dependencyLabels.length > 0

  return {
    id: moduleBlock.id,
    label: moduleBlock.label,
    access: moduleBlock.access,
    layer: moduleBlock.layer,
    active,
    defaultEnabled: moduleBlock.defaultEnabled,
    dependencyIds,
    dependencyLabels,
    statusLabel: active ? '已启用' : hasDependencies ? '可加入' : '可直接加入',
    statusTone: active || !hasDependencies ? 'ready' : 'muted',
    actionLabel: active ? (moduleBlock.defaultEnabled ? '打开' : '移除模块') : '加入模块',
    dependencyHint: active
      ? hasDependencies
        ? `依赖已就绪：${dependencyLabels.join('、')}`
        : '无需额外依赖'
      : hasDependencies
        ? `加入时会自动带上：${dependencyLabels.join('、')}`
        : '无需额外依赖',
  }
}

function collectDependencyIds(moduleBlock: AgentHubModuleBlock): string[] {
  const ids: string[] = []

  const visit = (dependencyId: string) => {
    const normalizedDependencyId = normalizeModuleBlockId(dependencyId)
    const dependency = AGENTHUB_MODULE_BLOCKS.find((candidate) => candidate.id === normalizedDependencyId)
    if (!dependency) return

    for (const nestedDependencyId of dependency.dependencyIds) {
      visit(nestedDependencyId)
    }

    if (!ids.includes(normalizedDependencyId)) ids.push(normalizedDependencyId)
  }

  for (const dependencyId of moduleBlock.dependencyIds) {
    visit(dependencyId)
  }

  return ids
}

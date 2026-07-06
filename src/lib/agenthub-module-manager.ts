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
  const activeModuleIds = input.enabledModuleIds
    ? resolveModuleActivation(input.enabledModuleIds).enabledIds
    : getDefaultModuleLayout().map((moduleBlock) => moduleBlock.id)
  const activation = input.enabledModuleIds ? resolveModuleActivation(input.enabledModuleIds) : null
  const activeIdSet = new Set(activeModuleIds)
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

  return {
    id: moduleBlock.id,
    label: moduleBlock.label,
    access: moduleBlock.access,
    layer: moduleBlock.layer,
    active: activeIdSet.has(moduleBlock.id),
    defaultEnabled: moduleBlock.defaultEnabled,
    dependencyIds,
    dependencyLabels: dependencyIds
      .map((dependencyId) => AGENTHUB_MODULE_BLOCKS.find((candidate) => candidate.id === dependencyId))
      .filter((dependency): dependency is AgentHubModuleBlock => Boolean(dependency))
      .map((dependency) => dependency.label),
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

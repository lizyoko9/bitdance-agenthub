export const CANONICAL_ORCHESTRATION_MODULE_ID = 'agent-canvas'

export const ORCHESTRATION_MODULE_IDS = [
  'workflows',
  CANONICAL_ORCHESTRATION_MODULE_ID,
  'agent-orchestration',
  'langflow-native',
  'infinite-canvas',
] as const

export type NavigationGroup = 'primary' | 'advanced' | 'hidden'

export type NavigationModuleLike = {
  id: string
  group: NavigationGroup
}

const orchestrationModuleIdSet = new Set<string>(ORCHESTRATION_MODULE_IDS)

export function isOrchestrationModuleId(id: string): boolean {
  return orchestrationModuleIdSet.has(id)
}

export function normalizeOrchestrationModuleId(id: string): string {
  return isOrchestrationModuleId(id) ? CANONICAL_ORCHESTRATION_MODULE_ID : id
}

export function buildVisibleAppModules<T extends NavigationModuleLike>(
  modules: readonly T[],
  group: NavigationGroup,
): T[] {
  const groupModules = modules.filter((module) => module.group === group)
  const canonicalOrchestrationModule = groupModules.find((module) => module.id === CANONICAL_ORCHESTRATION_MODULE_ID)
  const visible: T[] = []
  let addedOrchestrationModule = false

  for (const module of groupModules) {
    if (!isOrchestrationModuleId(module.id)) {
      visible.push(module)
      continue
    }

    if (addedOrchestrationModule) continue
    visible.push(canonicalOrchestrationModule ?? module)
    addedOrchestrationModule = true
  }

  return visible
}

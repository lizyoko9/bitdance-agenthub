import { getEnabledModuleLayout } from './agenthub-module-catalog'

export const APP_MODULE_PREFERENCES_STORAGE_KEY = 'agenthub:enabled-app-modules'

type StoredAppModulePreferences = {
  enabledModuleIds?: unknown
}

export function serializeAppModulePreferences(enabledModuleIds: string[]): string {
  return JSON.stringify({
    enabledModuleIds: uniqueModuleIds(enabledModuleIds),
  })
}

export function addEnabledAppModuleId(
  currentModuleIds: string[] | undefined,
  moduleId: string,
): string[] {
  return normalizeEnabledModuleIds([...(currentModuleIds ?? []), moduleId])
}

export function removeEnabledAppModuleId(
  currentModuleIds: string[] | undefined,
  moduleId: string,
): string[] {
  const normalizedCurrentModuleIds = normalizeEnabledModuleIds(currentModuleIds ?? [])
  return normalizeEnabledModuleIds(
    normalizedCurrentModuleIds.filter((enabledModuleId) => enabledModuleId !== moduleId),
  )
}

export function parseStoredAppModulePreferences(raw: string | null): string[] | undefined {
  if (!raw) return undefined

  let parsed: StoredAppModulePreferences
  try {
    parsed = JSON.parse(raw) as StoredAppModulePreferences
  } catch {
    return undefined
  }

  if (!Array.isArray(parsed.enabledModuleIds)) return undefined

  const requestedModuleIds = parsed.enabledModuleIds.filter(
    (moduleId): moduleId is string => typeof moduleId === 'string' && moduleId.trim().length > 0,
  )
  if (requestedModuleIds.length === 0) return undefined

  return normalizeEnabledModuleIds(requestedModuleIds)
}

function normalizeEnabledModuleIds(moduleIds: string[]): string[] {
  return getEnabledModuleLayout(moduleIds).map((moduleBlock) => moduleBlock.id)
}

function uniqueModuleIds(moduleIds: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const moduleId of moduleIds) {
    const trimmed = moduleId.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }

  return result
}

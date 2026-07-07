import type { CliRunMode, JsonObject } from '@/db/schema'

export interface EmployeeRunCliModePolicyInput {
  autonomyPolicy?: JsonObject | null
  permissionPolicy?: JsonObject | null
}

export function resolveEmployeeRunCliMode(
  input: EmployeeRunCliModePolicyInput,
): CliRunMode {
  if (!canRunCommands(input.permissionPolicy ?? {})) return 'dry_run'

  const level = getString(input.autonomyPolicy ?? {}, 'level')
  if (level === 'execute_low_risk' || level === 'fully_autonomous') return 'execute'

  return 'dry_run'
}

function canRunCommands(permissionPolicy: JsonObject): boolean {
  return (
    getPath(permissionPolicy, ['commands', 'run']) === true ||
    getPath(permissionPolicy, ['cli', 'run']) === true ||
    getPath(permissionPolicy, ['canRunCommands']) === true
  )
}

function getString(source: JsonObject, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' ? value : null
}

function getPath(source: JsonObject, path: string[]): unknown {
  let current: unknown = source
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

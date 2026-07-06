import type {
  AgentHubLifecycleCapabilityKind,
  AgentHubLifecycleManifest,
} from '@/lib/agenthub-lifecycle-types'

export type AgentHubCapabilityInventory = {
  agentIds: string[]
  modelIds: string[]
  cliIds: string[]
  mcpIds: string[]
  softwareIds: string[]
  skillIds: string[]
}

export type AgentHubCapabilityReadinessReport = {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

const inventoryKeyByKind: Record<AgentHubLifecycleCapabilityKind, keyof AgentHubCapabilityInventory> = {
  agent: 'agentIds',
  model: 'modelIds',
  cli: 'cliIds',
  mcp: 'mcpIds',
  software: 'softwareIds',
  skill: 'skillIds',
}

export function evaluateLifecycleCapabilityReadiness(
  manifest: AgentHubLifecycleManifest,
  inventory: AgentHubCapabilityInventory,
): AgentHubCapabilityReadinessReport {
  const blockers: string[] = []
  const warnings: string[] = []

  for (const capability of manifest.capabilityRefs) {
    const inventoryKey = inventoryKeyByKind[capability.kind]
    const exists = inventory[inventoryKey].includes(capability.id)

    if (!exists && capability.required) {
      blockers.push(`Missing required ${capability.kind}: ${capability.name}`)
    }

    if (!exists && !capability.required) {
      warnings.push(`Optional ${capability.kind} is not configured: ${capability.name}`)
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  }
}

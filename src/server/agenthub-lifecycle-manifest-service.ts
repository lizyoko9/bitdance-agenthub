import { nanoid } from 'nanoid'

import type {
  AgentHubEvalCase,
  AgentHubLifecycleCapabilityRef,
  AgentHubLifecycleManifest,
} from '@/lib/agenthub-lifecycle-types'

export type CreateLifecycleManifestInput = {
  name: string
  workflowId?: string
  agentIds?: string[]
  capabilityRefs?: AgentHubLifecycleCapabilityRef[]
  evalCases?: AgentHubEvalCase[]
  now?: string
}

export type DeriveLifecycleManifestFromWorkflowInput = {
  workflow: { id: string; name: string }
  nodes: Array<Record<string, unknown>>
  now?: string
}

export function createLifecycleManifest(input: CreateLifecycleManifestInput): AgentHubLifecycleManifest {
  const now = input.now ?? new Date().toISOString()

  return {
    id: `life_${nanoid(10)}`,
    name: input.name.trim() || 'Untitled lifecycle',
    version: 1,
    source: 'agenthub',
    currentPhase: 'spec',
    workflowId: input.workflowId,
    agentIds: input.agentIds ?? [],
    capabilityRefs: input.capabilityRefs ?? [],
    evalCases: input.evalCases ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

export function deriveLifecycleManifestFromWorkflow(
  input: DeriveLifecycleManifestFromWorkflowInput,
): AgentHubLifecycleManifest {
  const agentIds: string[] = []
  const capabilityRefs: AgentHubLifecycleCapabilityRef[] = []

  for (const node of input.nodes) {
    const type = String(node.type ?? '')
    const label = String(node.label ?? node.name ?? node.id ?? 'Capability')

    if (type === 'agent_employee' && typeof node.agentProfileId === 'string') {
      agentIds.push(node.agentProfileId)
      capabilityRefs.push({ kind: 'agent', id: node.agentProfileId, name: label, required: true })
    }

    if (type === 'cli_command' && typeof node.cliProfileId === 'string') {
      capabilityRefs.push({ kind: 'cli', id: node.cliProfileId, name: label, required: true })
    }

    if (type === 'mcp_tool' && typeof node.mcpServerId === 'string') {
      capabilityRefs.push({ kind: 'mcp', id: node.mcpServerId, name: label, required: true })
    }

    if (type === 'software_command' && typeof node.softwareProfileId === 'string') {
      capabilityRefs.push({ kind: 'software', id: node.softwareProfileId, name: label, required: true })
    }
  }

  return createLifecycleManifest({
    name: input.workflow.name,
    workflowId: input.workflow.id,
    agentIds,
    capabilityRefs,
    evalCases: [],
    now: input.now,
  })
}

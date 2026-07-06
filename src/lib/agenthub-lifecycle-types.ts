export type AgentHubLifecyclePhase = 'spec' | 'scaffold' | 'build' | 'orchestrate' | 'evaluate' | 'observe'

export type AgentHubLifecycleCapabilityKind = 'agent' | 'model' | 'cli' | 'mcp' | 'software' | 'skill'

export type AgentHubLifecycleCapabilityRef = {
  kind: AgentHubLifecycleCapabilityKind
  id: string
  name: string
  required: boolean
}

export type AgentHubEvalMetricKind =
  | 'task_success'
  | 'artifact_contract'
  | 'tool_use'
  | 'instruction_following'
  | 'safety'
  | 'handoff_quality'

export type AgentHubEvalMetric = {
  kind: AgentHubEvalMetricKind
  weight: number
  passingScore: number
}

export type AgentHubEvalCase = {
  id: string
  name: string
  input: Record<string, unknown>
  expectedArtifacts: string[]
  metrics: AgentHubEvalMetric[]
}

export type AgentHubLifecycleManifest = {
  id: string
  name: string
  version: number
  source: 'manual' | 'canvas' | 'agenthub'
  currentPhase: AgentHubLifecyclePhase
  workflowId?: string
  agentIds: string[]
  capabilityRefs: AgentHubLifecycleCapabilityRef[]
  evalCases: AgentHubEvalCase[]
  createdAt: string
  updatedAt: string
}

const lifecyclePhases = new Set<AgentHubLifecyclePhase>([
  'spec',
  'scaffold',
  'build',
  'orchestrate',
  'evaluate',
  'observe',
])

export function normalizeLifecyclePhase(value: string): AgentHubLifecyclePhase {
  return lifecyclePhases.has(value as AgentHubLifecyclePhase) ? (value as AgentHubLifecyclePhase) : 'spec'
}

import {
  planAgentMemoryEvolution,
  type AgentMemoryEvolutionPlan,
  type AgentMemoryRunOutcome,
} from './agent-psm-memory-core'

export type RuntimeAgentLearningStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'failed'
  | 'aborted'
  | 'paused'

export interface RuntimeAgentLearningInput {
  runId: string
  agentId: string
  projectId?: string
  role: string
  goal: string
  status: RuntimeAgentLearningStatus
  error?: string | null
  artifactType?: string | null
  retrievedMemoryIds: string[]
  now?: number
  reusableProcedure?: string[]
  repeatedSuccessCount?: number
}

export interface RuntimeAgentMemoryDraft {
  scope: 'agent'
  type: 'procedural' | 'mistake'
  title: string
  content: string
  confidence: number
  importance: number
}

export interface RuntimeAgentReflectionDraft {
  whatWorked: string[]
  whatFailed: string[]
  newKnowledge: string[]
  reusableProcedure: string[]
  suggestedSkillUpdates: string[]
  futureWarnings: string[]
}

export interface RuntimeAgentLearningPlan {
  outcome: AgentMemoryRunOutcome
  primaryMemoryDraft: RuntimeAgentMemoryDraft
  reflection: RuntimeAgentReflectionDraft
  evolution: AgentMemoryEvolutionPlan
}

export function buildRuntimeAgentLearningPlan(
  input: RuntimeAgentLearningInput,
): RuntimeAgentLearningPlan {
  const outcome = resolveOutcome(input)
  const artifactType = input.artifactType?.trim() || 'artifact'
  const procedure = input.reusableProcedure?.length
    ? input.reusableProcedure
    : defaultRuntimeProcedure(input.role, artifactType)
  const evolution = planAgentMemoryEvolution({
    runId: input.runId,
    agentId: input.agentId,
    projectId: input.projectId,
    goal: input.goal,
    outcome,
    failureReason: normalizeError(input.error) ?? undefined,
    usedMemoryIds: input.retrievedMemoryIds,
    now: input.now ?? Date.now(),
    reusableProcedure: procedure,
    repeatedSuccessCount: input.repeatedSuccessCount,
  })

  return {
    outcome,
    primaryMemoryDraft: buildPrimaryMemoryDraft({
      input,
      outcome,
      artifactType,
      procedure,
      evolution,
    }),
    reflection: buildReflectionDraft({
      input,
      outcome,
      artifactType,
      procedure,
      evolution,
    }),
    evolution,
  }
}

function buildPrimaryMemoryDraft(args: {
  input: RuntimeAgentLearningInput
  outcome: AgentMemoryRunOutcome
  artifactType: string
  procedure: string[]
  evolution: AgentMemoryEvolutionPlan
}): RuntimeAgentMemoryDraft {
  const failureMemory = args.evolution.newMemories.find((memory) => memory.type === 'failure_lesson')
  if (args.outcome === 'failed' && failureMemory) {
    return {
      scope: 'agent',
      type: 'mistake',
      title: failureMemory.title,
      content: failureMemory.content,
      confidence: failureMemory.confidence,
      importance: failureMemory.importance,
    }
  }

  return {
    scope: 'agent',
    type: 'procedural',
    title: `${args.input.role}: ${truncate(args.input.goal, 80)}`,
    content: [
      `Goal: ${args.input.goal}`,
      `Outcome: ${args.input.status}`,
      `Procedure: ${args.procedure.join(' -> ')}.`,
      `Required artifact: ${args.artifactType}.`,
    ].join('\n'),
    confidence: 0.9,
    importance: 0.72,
  }
}

function buildReflectionDraft(args: {
  input: RuntimeAgentLearningInput
  outcome: AgentMemoryRunOutcome
  artifactType: string
  procedure: string[]
  evolution: AgentMemoryEvolutionPlan
}): RuntimeAgentReflectionDraft {
  const error = normalizeError(args.input.error)
  return {
    whatWorked: args.outcome === 'succeeded'
      ? [
          `Completed deterministic runtime lifecycle for ${args.input.role}.`,
          `Verified required ${args.artifactType} output contract before finishing.`,
        ]
      : [],
    whatFailed: error ? [error] : [],
    newKnowledge: [
      `Goal handled: ${args.input.goal}`,
      `Retrieved ${args.input.retrievedMemoryIds.length} relevant memories before planning.`,
      ...args.evolution.approvalRequests.map((request) => request.reason),
    ],
    reusableProcedure: args.procedure,
    suggestedSkillUpdates: [],
    futureWarnings: args.evolution.newMemories
      .filter((memory) => memory.type === 'failure_lesson')
      .map((memory) => memory.title),
  }
}

function defaultRuntimeProcedure(role: string, artifactType: string): string[] {
  return [
    `For ${role} tasks, retrieve memory`,
    'derive a plan',
    `verify the ${artifactType} contract`,
    'checkpoint before handoff',
  ]
}

function resolveOutcome(input: RuntimeAgentLearningInput): AgentMemoryRunOutcome {
  if (input.status === 'complete' && !normalizeError(input.error)) return 'succeeded'
  return 'failed'
}

function normalizeError(error: string | null | undefined): string | null {
  const trimmed = error?.trim()
  return trimmed || null
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`
}

export type AgentMemoryScope =
  | 'agent_private'
  | 'project_shared'
  | 'team_shared'
  | 'global_tool'

export type AgentMemoryType =
  | 'task'
  | 'experience'
  | 'tool_usage'
  | 'failure_lesson'
  | 'playbook'
  | 'self_calibration'
  | 'user_preference'
  | 'project_knowledge'

export type AgentMemoryReviewStatus =
  | 'private'
  | 'pending_review'
  | 'approved_for_sharing'
  | 'rejected'

export interface AgentMemoryBlock {
  id: string
  agentId: string
  projectId?: string
  teamId?: string
  scope: AgentMemoryScope
  type: AgentMemoryType
  title: string
  content: string
  cues: string[]
  tags: string[]
  importance: number
  confidence: number
  successCount: number
  failureCount: number
  reviewStatus: AgentMemoryReviewStatus
  sourceRunId?: string
  lastActivatedAt?: number
  createdAt: number
  updatedAt: number
}

export type AgentMemorySynapseRelation =
  | 'supports'
  | 'conflicts_with'
  | 'fixed_by'
  | 'failed_when_used_with'

export interface AgentMemorySynapse {
  sourceMemoryId: string
  targetMemoryId: string
  relation: AgentMemorySynapseRelation
  weight: number
}

export interface AgentMemoryTaskSignal {
  agentId: string
  projectId?: string
  teamId?: string
  goal: string
  cues: string[]
  tags: string[]
  now: number
}

export interface ExtractAgentMemoryCuesArgs {
  goal: string
  explicitCues?: string[]
  tags?: string[]
}

export interface AgentMemoryRecallResult {
  memory: AgentMemoryBlock
  score: number
  matchedCues: string[]
  matchedTags: string[]
  reasons: string[]
}

export interface RecallAgentMemoriesOptions {
  limit?: number
  minScore?: number
}

export interface AgentMemoryContextItem {
  memoryId: string
  title: string
  content: string
  score: number
  reasons: string[]
}

export interface AgentMemoryContextSection {
  id: string
  title: string
  memoryType: AgentMemoryType
  items: AgentMemoryContextItem[]
}

export interface AgentMemoryContextPack {
  title: string
  agentId: string
  goal: string
  summary: string
  sections: AgentMemoryContextSection[]
}

export interface CompileAgentMemoryContextPackOptions {
  maxItemsPerSection?: number
}

export type AgentMemoryRunOutcome = 'succeeded' | 'failed'

export interface AgentMemoryRunObservation {
  runId: string
  agentId: string
  projectId?: string
  goal: string
  outcome: AgentMemoryRunOutcome
  failureReason?: string
  usedMemoryIds: string[]
  now: number
  reusableProcedure?: string[]
  repeatedSuccessCount?: number
}

export interface AgentMemoryUpdatePlan {
  memoryId: string
  successDelta: number
  failureDelta: number
  confidenceDelta: number
  importanceDelta: number
  reason: string
}

export interface AgentMemoryApprovalRequest {
  kind: 'share_memory' | 'activate_playbook'
  targetId: string
  reason: string
}

export interface AgentMemoryEvolutionPlan {
  memoryUpdates: AgentMemoryUpdatePlan[]
  newMemories: AgentMemoryBlock[]
  playbookDraft: AgentMemoryBlock | null
  approvalRequests: AgentMemoryApprovalRequest[]
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const KNOWN_CUE_PHRASES = [
  '剪映',
  'capcut',
  '导出视频',
  '导出',
  '字幕',
  '视频',
  '音频',
  '图片',
  '代码',
  '源码',
  '文件',
  '文档',
  '表格',
  '浏览器',
  '微信',
  'cli',
  'mcp',
  '失败',
]

const CONTEXT_SECTION_ORDER: AgentMemoryType[] = [
  'user_preference',
  'project_knowledge',
  'tool_usage',
  'failure_lesson',
  'playbook',
  'experience',
  'task',
  'self_calibration',
]

const MEMORY_TYPE_LABELS: Record<AgentMemoryType, string> = {
  task: '任务记忆',
  experience: '长期经验',
  tool_usage: '工具使用经验',
  failure_lesson: '失败教训',
  playbook: 'Agent 工作手册',
  self_calibration: '自我校准',
  user_preference: '用户偏好',
  project_knowledge: '项目知识',
}

export function extractAgentMemoryCues(args: ExtractAgentMemoryCuesArgs): {
  cues: string[]
  tags: string[]
} {
  const goal = args.goal.trim()
  const goalLower = goal.toLowerCase()
  const known = KNOWN_CUE_PHRASES.filter((phrase) => goalLower.includes(phrase.toLowerCase()))
  const technicalTokens = goal.match(/[a-zA-Z0-9][a-zA-Z0-9_.-]*/g) ?? []
  return {
    cues: uniqueNormalized([...(args.explicitCues ?? []), ...known, ...technicalTokens]),
    tags: uniqueNormalized(args.tags ?? []),
  }
}

export function recallAgentMemories(
  signal: AgentMemoryTaskSignal,
  memories: AgentMemoryBlock[],
  synapses: AgentMemorySynapse[],
  options: RecallAgentMemoriesOptions = {},
): AgentMemoryRecallResult[] {
  const visible = memories.filter((memory) => isVisibleToAgent(memory, signal))
  const byId = new Map(visible.map((memory) => [memory.id, memory]))
  const initial = new Map<string, AgentMemoryRecallResult>()

  for (const memory of visible) {
    const result = scoreMemory(signal, memory)
    if (hasDirectMatch(result) && result.score >= (options.minScore ?? 0.1)) {
      initial.set(memory.id, result)
    }
  }

  for (const synapse of synapses) {
    const source = initial.get(synapse.sourceMemoryId)
    const targetMemory = byId.get(synapse.targetMemoryId)
    if (!source || !targetMemory) continue

    const target = initial.get(targetMemory.id) ?? scoreMemory(signal, targetMemory)
    const normalizedWeight = clamp01(synapse.weight)
    if (synapse.relation === 'supports' || synapse.relation === 'fixed_by') {
      target.score += normalizedWeight * 0.45
      addReason(target, '由相关记忆激活')
    }
    if (synapse.relation === 'conflicts_with' || synapse.relation === 'failed_when_used_with') {
      target.score -= normalizedWeight * 0.35
      addReason(target, '存在冲突或失败关联，需要谨慎使用')
    }
    if (target.score >= (options.minScore ?? 0.1)) {
      initial.set(targetMemory.id, target)
    }
  }

  return [...initial.values()]
    .sort((a, b) => b.score - a.score || b.memory.importance - a.memory.importance)
    .slice(0, options.limit ?? 8)
}

export function compileAgentMemoryContextPack(
  signal: AgentMemoryTaskSignal,
  recalledMemories: AgentMemoryRecallResult[],
  options: CompileAgentMemoryContextPackOptions = {},
): AgentMemoryContextPack {
  const maxItemsPerSection = options.maxItemsPerSection ?? 4
  const sections = CONTEXT_SECTION_ORDER.map((type) => {
    const items = recalledMemories
      .filter((result) => result.memory.type === type)
      .slice(0, maxItemsPerSection)
      .map((result) => ({
        memoryId: result.memory.id,
        title: result.memory.title,
        content: result.memory.content,
        score: Number(result.score.toFixed(3)),
        reasons: result.reasons,
      }))

    return {
      id: type,
      title: MEMORY_TYPE_LABELS[type],
      memoryType: type,
      items,
    }
  }).filter((section) => section.items.length > 0)

  const memoryCount = sections.reduce((sum, section) => sum + section.items.length, 0)
  return {
    title: 'Agent 记忆上下文包',
    agentId: signal.agentId,
    goal: signal.goal,
    summary: `已为这个 Agent 编译 ${memoryCount} 条记忆，供本轮计划、执行和验证使用。`,
    sections,
  }
}

export function planAgentMemoryEvolution(
  observation: AgentMemoryRunObservation,
): AgentMemoryEvolutionPlan {
  const memoryUpdates = observation.usedMemoryIds.map((memoryId) => ({
    memoryId,
    successDelta: observation.outcome === 'succeeded' ? 1 : 0,
    failureDelta: observation.outcome === 'failed' ? 1 : 0,
    confidenceDelta: observation.outcome === 'succeeded' ? 0.04 : -0.08,
    importanceDelta: observation.outcome === 'succeeded' ? 0.02 : 0.05,
    reason:
      observation.outcome === 'succeeded'
        ? '本次任务成功，相关记忆可信度小幅上升。'
        : '本次任务失败，相关记忆需要降置信并记录失败经验。',
  }))

  const newMemories: AgentMemoryBlock[] = []
  const approvalRequests: AgentMemoryApprovalRequest[] = []

  if (observation.outcome === 'failed') {
    const failureMemory = buildMemoryBlock({
      id: `${observation.runId}:failure_lesson`,
      agentId: observation.agentId,
      projectId: observation.projectId,
      scope: 'agent_private',
      type: 'failure_lesson',
      title: `失败教训：${truncate(observation.goal, 36)}`,
      content: [
        `任务：${observation.goal}`,
        `失败原因：${observation.failureReason?.trim() || '未填写'}`,
        '下次处理类似任务时，先确认输入、工具状态和交付条件，再继续执行。',
      ].join('\n'),
      cues: extractAgentMemoryCues({ goal: observation.goal }).cues,
      tags: ['失败教训'],
      reviewStatus: 'private',
      sourceRunId: observation.runId,
      now: observation.now,
      importance: 0.82,
      confidence: 0.68,
      failureCount: 1,
    })
    newMemories.push(failureMemory)
    approvalRequests.push({
      kind: 'share_memory',
      targetId: failureMemory.id,
      reason: '先私有保存，等用户或负责人确认后再共享给项目或团队。',
    })
  }

  const shouldDraftPlaybook =
    observation.outcome === 'succeeded' &&
    (observation.reusableProcedure?.length ?? 0) >= 2 &&
    (observation.repeatedSuccessCount ?? 1) >= 3
  const playbookDraft = shouldDraftPlaybook
    ? buildMemoryBlock({
        id: `${observation.runId}:playbook_draft`,
        agentId: observation.agentId,
        projectId: observation.projectId,
        scope: 'agent_private',
        type: 'playbook',
        title: `工作手册草稿：${truncate(observation.goal, 36)}`,
        content: (observation.reusableProcedure ?? [])
          .map((step, index) => `${index + 1}. ${step}`)
          .join('\n'),
        cues: extractAgentMemoryCues({ goal: observation.goal }).cues,
        tags: ['工作手册', '可复用流程'],
        reviewStatus: 'pending_review',
        sourceRunId: observation.runId,
        now: observation.now,
        importance: 0.86,
        confidence: 0.78,
        successCount: observation.repeatedSuccessCount ?? 1,
      })
    : null

  if (playbookDraft) {
    approvalRequests.push({
      kind: 'activate_playbook',
      targetId: playbookDraft.id,
      reason: '多次成功后生成工作手册草稿，需要审核后再成为长期可用经验。',
    })
  }

  return {
    memoryUpdates,
    newMemories,
    playbookDraft,
    approvalRequests,
  }
}

function scoreMemory(
  signal: AgentMemoryTaskSignal,
  memory: AgentMemoryBlock,
): AgentMemoryRecallResult {
  const cueTerms = uniqueNormalized(signal.cues)
  const tagTerms = uniqueNormalized(signal.tags)
  const searchable = normalizeForSearch([
    memory.title,
    memory.content,
    memory.type,
    memory.scope,
    ...memory.cues,
    ...memory.tags,
  ].join(' '))
  const matchedCues = cueTerms.filter((cue) => searchable.includes(normalizeForSearch(cue)))
  const matchedTags = tagTerms.filter((tag) => memory.tags.some((item) => sameTerm(item, tag)))
  const recency = recencyScore(memory.lastActivatedAt ?? memory.updatedAt, signal.now)
  const successRate = (memory.successCount + 1) / (memory.successCount + memory.failureCount + 2)
  const typeBoost = memory.type === 'tool_usage' ? 0.5 : memory.type === 'failure_lesson' ? 0.35 : 0
  const scopeBoost = memory.scope === 'agent_private' ? 0.25 : memory.scope === 'project_shared' ? 0.18 : 0.1
  const score =
    matchedCues.length * 2 +
    matchedTags.length * 1.2 +
    clamp01(memory.importance) +
    clamp01(memory.confidence) +
    successRate * 0.8 +
    recency * 0.5 +
    typeBoost +
    scopeBoost

  const reasons = [
    matchedCues.length ? `匹配线索: ${matchedCues.join(', ')}` : null,
    matchedTags.length ? `匹配标签: ${matchedTags.join(', ')}` : null,
    memory.successCount > memory.failureCount ? '历史成功率较高' : null,
    memory.type === 'failure_lesson' ? '包含失败教训' : null,
  ].filter((item): item is string => Boolean(item))

  return {
    memory,
    score,
    matchedCues,
    matchedTags,
    reasons,
  }
}

function isVisibleToAgent(memory: AgentMemoryBlock, signal: AgentMemoryTaskSignal): boolean {
  if (memory.scope === 'agent_private') return memory.agentId === signal.agentId
  if (memory.scope === 'project_shared') {
    return Boolean(memory.projectId && signal.projectId && memory.projectId === signal.projectId)
  }
  if (memory.scope === 'team_shared') {
    if (!memory.teamId || !signal.teamId) return true
    return memory.teamId === signal.teamId
  }
  return memory.scope === 'global_tool'
}

function buildMemoryBlock(args: {
  id: string
  agentId: string
  projectId?: string
  scope: AgentMemoryScope
  type: AgentMemoryType
  title: string
  content: string
  cues: string[]
  tags: string[]
  reviewStatus: AgentMemoryReviewStatus
  sourceRunId: string
  now: number
  importance: number
  confidence: number
  successCount?: number
  failureCount?: number
}): AgentMemoryBlock {
  return {
    id: args.id,
    agentId: args.agentId,
    projectId: args.projectId,
    scope: args.scope,
    type: args.type,
    title: args.title,
    content: args.content,
    cues: args.cues,
    tags: args.tags,
    importance: args.importance,
    confidence: args.confidence,
    successCount: args.successCount ?? 0,
    failureCount: args.failureCount ?? 0,
    reviewStatus: args.reviewStatus,
    sourceRunId: args.sourceRunId,
    createdAt: args.now,
    updatedAt: args.now,
  }
}

function addReason(result: AgentMemoryRecallResult, reason: string): void {
  if (!result.reasons.includes(reason)) result.reasons.push(reason)
}

function hasDirectMatch(result: AgentMemoryRecallResult): boolean {
  return result.matchedCues.length > 0 || result.matchedTags.length > 0
}

function uniqueNormalized(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase()
}

function sameTerm(a: string, b: string): boolean {
  return normalizeForSearch(a) === normalizeForSearch(b)
}

function recencyScore(time: number | undefined, now: number): number {
  if (!time) return 0
  const ageDays = Math.max(0, (now - time) / ONE_DAY_MS)
  return Math.max(0, 1 - ageDays / 30)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}...`
}

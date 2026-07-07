import {
  buildAgentMemoryContextCacheFrame,
  type AgentMemoryContextCacheFrame,
  AgentMemoryContextPack,
  AgentMemoryEvolutionPlan,
} from './agent-psm-memory-core'

export interface EmployeeRuntimeBrainReflection {
  whatWorked: string[]
  whatFailed: string[]
  reusableProcedure: string[]
  futureWarnings: string[]
}

export interface EmployeeRuntimeBrainOwner {
  agentId: string
  agentName: string
  role: string
  label: string
}

export interface EmployeeRuntimeBrainMemoryBoundary {
  privateFirst: true
  reviewBeforeSharing: true
  privateScopeLabel: string
  sharingScopeLabel: string
  visibleScopeLabels: string[]
  pendingReviewItems: Array<{
    kind: 'share_memory' | 'activate_playbook'
    targetId: string
    label: string
    reason: string
  }>
}

export interface EmployeeRuntimeBrainOutput {
  title: '员工大脑'
  owner: EmployeeRuntimeBrainOwner
  statusLabel: string
  headline: string
  contextSummary: string
  metrics: Array<{ label: string; value: string }>
  recalledSections: Array<{ title: string; itemTitles: string[] }>
  nextRunBriefing: {
    title: '下次开工提示'
    items: Array<{
      label: string
      detail: string
      tone: 'ready' | 'warning' | 'muted'
    }>
  }
  learningSummary: {
    memoryUpdateCount: number
    learningEventCount: number
    approvalRequestCount: number
    playbookDraftTitle: string | null
  }
  contextCache: AgentMemoryContextCacheFrame | null
  memoryBoundary: EmployeeRuntimeBrainMemoryBoundary
}

export function buildEmployeeRuntimeBrainOutput(args: {
  owner?: {
    agentId?: string | null
    agentName?: string | null
    role?: string | null
  }
  contextPack?: AgentMemoryContextPack | null
  reflection?: EmployeeRuntimeBrainReflection | null
  memoryEvolution?: AgentMemoryEvolutionPlan | null
  memoryUpdateCount?: number
  learningEventCount?: number
}): EmployeeRuntimeBrainOutput {
  const recalledSections = (args.contextPack?.sections ?? []).map((section) => ({
    title: section.title,
    itemTitles: section.items.map((item) => item.title).filter(Boolean),
  }))
  const recalledCount = recalledSections.reduce((sum, section) => sum + section.itemTitles.length, 0)
  const memoryUpdateCount = args.memoryUpdateCount ?? args.memoryEvolution?.memoryUpdates.length ?? 0
  const approvalRequestCount = args.memoryEvolution?.approvalRequests.length ?? 0
  const learningEventCount = args.learningEventCount ?? 0
  const playbookDraftTitle = args.memoryEvolution?.playbookDraft?.title ?? null
  const contextSummary =
    args.contextPack?.summary ??
    (recalledCount > 0
      ? `已为这个员工召回 ${recalledCount} 条相关经验。`
      : '本轮还没有可用的历史经验。')

  return {
    title: '员工大脑',
    owner: buildBrainOwner({
      agentId: args.owner?.agentId ?? args.contextPack?.agentId,
      agentName: args.owner?.agentName,
      role: args.owner?.role,
    }),
    statusLabel: recalledCount > 0 || memoryUpdateCount > 0 ? '已生成开工简报' : '等待经验积累',
    headline: `本轮召回 ${recalledCount} 条经验，已沉淀 ${memoryUpdateCount} 条记忆更新。`,
    contextSummary,
    metrics: [
      { label: '召回记忆', value: String(recalledCount) },
      { label: '记忆更新', value: String(memoryUpdateCount) },
      { label: '待审核', value: String(approvalRequestCount) },
    ],
    recalledSections,
    nextRunBriefing: buildNextRunBriefing({
      reusableProcedure: normalizeList(args.reflection?.reusableProcedure ?? []),
      whatFailed: normalizeList(args.reflection?.whatFailed ?? []),
      futureWarnings: normalizeList(args.reflection?.futureWarnings ?? []),
      playbookDraftTitle,
      recalledSections,
    }),
    learningSummary: {
      memoryUpdateCount,
      learningEventCount,
      approvalRequestCount,
      playbookDraftTitle,
    },
    contextCache: args.contextPack ? buildAgentMemoryContextCacheFrame(args.contextPack) : null,
    memoryBoundary: buildMemoryBoundary(args.memoryEvolution),
  }
}

function buildBrainOwner(args: {
  agentId?: string | null
  agentName?: string | null
  role?: string | null
}): EmployeeRuntimeBrainOwner {
  const agentId = normalizeText(args.agentId) ?? 'unknown_agent'
  const agentName = normalizeText(args.agentName) ?? '当前员工'
  const role = normalizeText(args.role) ?? '智能体员工'
  return {
    agentId,
    agentName,
    role,
    label: `${agentName}自己的大脑`,
  }
}

function buildMemoryBoundary(
  memoryEvolution: AgentMemoryEvolutionPlan | null | undefined,
): EmployeeRuntimeBrainMemoryBoundary {
  return {
    privateFirst: true,
    reviewBeforeSharing: true,
    privateScopeLabel: '默认先保存在这个员工自己的大脑里',
    sharingScopeLabel: '确认后再共享给项目、团队或全局工具经验',
    visibleScopeLabels: ['员工私有记忆', '项目共享记忆', '团队共享记忆', '全局工具经验'],
    pendingReviewItems: (memoryEvolution?.approvalRequests ?? []).map((request) => ({
      kind: request.kind,
      targetId: request.targetId,
      label: request.kind === 'activate_playbook' ? '工作手册待审核' : '记忆共享待审核',
      reason: request.reason,
    })),
  }
}

function buildNextRunBriefing(args: {
  reusableProcedure: string[]
  whatFailed: string[]
  futureWarnings: string[]
  playbookDraftTitle: string | null
  recalledSections: Array<{ title: string; itemTitles: string[] }>
}): EmployeeRuntimeBrainOutput['nextRunBriefing'] {
  const items: EmployeeRuntimeBrainOutput['nextRunBriefing']['items'] = []
  if (args.reusableProcedure.length) {
    items.push({
      label: '优先复用',
      detail: joinChinese(args.reusableProcedure.slice(0, 3)),
      tone: 'ready',
    })
  } else {
    const firstRecalled = args.recalledSections.flatMap((section) => section.itemTitles)[0]
    if (firstRecalled) {
      items.push({
        label: '优先参考',
        detail: firstRecalled,
        tone: 'ready',
      })
    }
  }

  if (args.whatFailed.length) {
    items.push({
      label: '先避开',
      detail: joinChinese(args.whatFailed.slice(0, 2)),
      tone: 'warning',
    })
  }
  if (args.futureWarnings.length) {
    items.push({
      label: '开工前检查',
      detail: joinChinese(args.futureWarnings.slice(0, 2)),
      tone: 'warning',
    })
  }
  if (args.playbookDraftTitle) {
    items.push({
      label: '待审核工作手册',
      detail: args.playbookDraftTitle,
      tone: 'warning',
    })
  }
  if (items.length === 0) {
    items.push({
      label: '开工状态',
      detail: '这个员工还在积累经验，下次运行会继续沉淀复盘。',
      tone: 'muted',
    })
  }
  return {
    title: '下次开工提示',
    items: items.slice(0, 4),
  }
}

function normalizeList(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function joinChinese(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join('、')
}

export type AgentBrainReadiness = 'ready' | 'needs_review' | 'empty' | 'disabled'

export interface AgentBrainSummaryReport {
  readiness: AgentBrainReadiness
  readinessScore: number
  memorySummary: {
    ownedTotal?: number
    activeOwnedTotal: number
    byScope?: Partial<Record<string, number>>
    mistakeCount: number
    proceduralCount: number
    semanticCount: number
    averageConfidence: number
    averageImportance: number
  }
  retrieval: {
    sampleGoal?: string
    candidates: Array<{
      id: string
      title: string
      type: string
      scope: string
      score: number
      matchedTerms?: string[]
    }>
    gaps: string[]
    warnings: string[]
  }
  reflectionSummary?: {
    total: number
    reusableProcedureCount: number
    futureWarningCount: number
    suggestedSkillUpdateCount: number
  }
  learningSummary: {
    pendingReview: number
    activePlaybooks: number
    draftPlaybooks: number
    latestEvents?: Array<{
      id: string
      title: string
      status: string
      createdAt: number
    }>
    latestPlaybooks?: Array<{
      id: string
      title: string
      status: string
      updatedAt: number
    }>
  }
  governance: {
    needsHumanReview: boolean
    sensitiveMemoryTitles?: string[]
    mistakeTitles: string[]
    pendingLearningTitles: string[]
    expiringSoonMemoryTitles: string[]
  }
  recommendations: string[]
}

export interface AgentBrainSummaryMetric {
  label: string
  value: string
  detail: string
}

export interface AgentBrainSummarySection {
  title: string
  items: string[]
}

export interface AgentBrainSummaryView {
  title: string
  statusLabel: string
  statusTone: 'ready' | 'warning' | 'muted'
  scoreText: string
  emptyState: string | null
  metrics: AgentBrainSummaryMetric[]
  sections: AgentBrainSummarySection[]
}

export interface AgentBrainDetailStat {
  label: string
  value: string
  detail: string
}

export interface AgentBrainDetailView {
  title: string
  statusLabel: string
  statusTone: AgentBrainSummaryView['statusTone']
  memoryBoundaries: AgentBrainDetailStat[]
  recallFlow: AgentBrainDetailStat[]
  recentContext: string[]
  reviewQueue: string[]
  playbooks: string[]
  recommendations: string[]
}

export function buildAgentBrainSummary(report: AgentBrainSummaryReport): AgentBrainSummaryView {
  const needsReview = report.readiness === 'needs_review' || report.governance.needsHumanReview
  const statusLabel = resolveStatusLabel(report.readiness, needsReview)
  const statusTone = resolveStatusTone(report.readiness, needsReview)
  const pendingItems = unique([
    ...report.governance.pendingLearningTitles,
    ...report.governance.mistakeTitles,
    ...report.governance.expiringSoonMemoryTitles,
  ])
  const experienceItems = report.retrieval.candidates
    .map((candidate) => candidate.title.trim())
    .filter(Boolean)
    .slice(0, 4)
  const recommendationItems = report.recommendations
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)

  const sections: AgentBrainSummarySection[] = []
  if (experienceItems.length) {
    sections.push({
      title: '最近会参考的经验',
      items: experienceItems,
    })
  }
  if (pendingItems.length) {
    sections.push({
      title: '需要你确认',
      items: pendingItems.slice(0, 4),
    })
  }
  if (recommendationItems.length && sections.length < 2) {
    sections.push({
      title: '下一步建议',
      items: recommendationItems,
    })
  }

  return {
    title: '员工大脑',
    statusLabel,
    statusTone,
    scoreText: `${Math.round(report.readinessScore)}%`,
    emptyState:
      report.readiness === 'empty'
        ? '这个员工还没有沉淀经验。跑完任务后，会自动记录成功流程和失败教训。'
        : null,
    metrics: [
      {
        label: '记忆',
        value: String(report.memorySummary.activeOwnedTotal),
        detail: '已沉淀',
      },
      {
        label: '失败教训',
        value: String(report.memorySummary.mistakeCount),
        detail: '避免重复踩坑',
      },
      {
        label: '待审核',
        value: String(report.learningSummary.pendingReview),
        detail: '确认后生效',
      },
      {
        label: '工作手册',
        value: String(report.learningSummary.activePlaybooks),
        detail: '可复用流程',
      },
    ],
    sections,
  }
}

export function buildAgentBrainDetail(report: AgentBrainSummaryReport): AgentBrainDetailView {
  const needsReview = report.readiness === 'needs_review' || report.governance.needsHumanReview
  const memoryEnabled = report.readiness !== 'disabled'
  const scopeCounts = report.memorySummary.byScope ?? {}
  const contextTypeCount = [
    report.memorySummary.semanticCount,
    report.memorySummary.proceduralCount,
    report.memorySummary.mistakeCount,
    report.learningSummary.activePlaybooks,
  ].filter((count) => count > 0).length
  const reviewQueue = unique([
    ...report.governance.pendingLearningTitles,
    ...(report.governance.sensitiveMemoryTitles ?? []),
    ...report.governance.mistakeTitles,
    ...report.governance.expiringSoonMemoryTitles,
    ...report.retrieval.gaps,
  ])

  return {
    title: '员工大脑详情',
    statusLabel: resolveStatusLabel(report.readiness, needsReview),
    statusTone: resolveStatusTone(report.readiness, needsReview),
    memoryBoundaries: [
      {
        label: '私有记忆',
        value: String(scopeCounts.agent ?? 0),
        detail: '优先只给这个员工使用',
      },
      {
        label: '项目共享',
        value: String(scopeCounts.project ?? 0),
        detail: '同项目员工可复用',
      },
      {
        label: '工作区共享',
        value: String(scopeCounts.workspace ?? 0),
        detail: '团队内可见经验',
      },
      {
        label: '全局工具经验',
        value: String(scopeCounts.global ?? 0),
        detail: '审核后才扩散',
      },
    ],
    recallFlow: [
      {
        label: '任务线索',
        value: report.retrieval.sampleGoal?.trim() || '按任务目标提取',
        detail: '运行前提取目标、客户、工具和交付物线索',
      },
      {
        label: '召回经验',
        value: `${report.retrieval.candidates.length} 条`,
        detail: memoryEnabled
          ? '按线索、标签、重要性、置信度和成功率排序'
          : '记忆已关闭，运行时不会注入长期经验',
      },
      {
        label: '上下文包',
        value: `${contextTypeCount} 类`,
        detail: '只把相关记忆放进这个员工的工作上下文',
      },
    ],
    recentContext: report.retrieval.candidates.slice(0, 5).map((candidate) => {
      const matched = candidate.matchedTerms?.filter(Boolean).join('、')
      const suffix = matched ? `命中：${matched}` : `评分：${roundNumber(candidate.score)}`
      return `${candidate.title} · ${candidate.type} · ${suffix}`
    }),
    reviewQueue,
    playbooks: (report.learningSummary.latestPlaybooks ?? [])
      .filter((playbook) => playbook.status === 'active')
      .map((playbook) => playbook.title.trim())
      .filter(Boolean)
      .slice(0, 5),
    recommendations: report.recommendations.map((item) => item.trim()).filter(Boolean).slice(0, 5),
  }
}

function resolveStatusLabel(readiness: AgentBrainReadiness, needsReview: boolean): string {
  if (readiness === 'disabled') return '已关闭'
  if (readiness === 'empty') return '暂无经验'
  if (needsReview) return '需要审核'
  return '可用'
}

function resolveStatusTone(
  readiness: AgentBrainReadiness,
  needsReview: boolean,
): AgentBrainSummaryView['statusTone'] {
  if (readiness === 'disabled' || readiness === 'empty') return 'muted'
  if (needsReview) return 'warning'
  return 'ready'
}

function unique(values: string[]): string[] {
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

function roundNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export type AgentBrainReadiness = 'ready' | 'needs_review' | 'empty' | 'disabled'

export interface AgentBrainSummaryReport {
  readiness: AgentBrainReadiness
  readinessScore: number
  memorySummary: {
    activeOwnedTotal: number
    mistakeCount: number
    proceduralCount: number
    semanticCount: number
    averageConfidence: number
    averageImportance: number
  }
  retrieval: {
    candidates: Array<{
      id: string
      title: string
      type: string
      scope: string
      score: number
    }>
    gaps: string[]
    warnings: string[]
  }
  learningSummary: {
    pendingReview: number
    activePlaybooks: number
    draftPlaybooks: number
  }
  governance: {
    needsHumanReview: boolean
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

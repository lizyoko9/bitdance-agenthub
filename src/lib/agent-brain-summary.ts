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
      type?: string
      status: string
      summary?: string
      createdAt: number
    }>
    latestPlaybooks?: Array<{
      id: string
      title: string
      status: string
      updatedAt: number
    }>
  }
  learningTrace?: Array<{
    runId: string
    reflectionId?: string | null
    createdAt: number
    outcome: 'succeeded' | 'failed' | 'mixed'
    whatWorked: string[]
    whatFailed: string[]
    memoryTitles: string[]
    pendingLearningTitles: string[]
    approvedLearningTitles: string[]
    playbookTitles: string[]
  }>
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

export interface AgentBrainReviewItem {
  eventId?: string
  title: string
  badge: string
  detail: string
}

export interface AgentBrainLearningTraceItem {
  title: string
  badge: string
  tone: 'ready' | 'warning' | 'muted'
  detail: string
  items: string[]
}

export interface AgentBrainLoopItem {
  label: string
  value: string
  state: 'ready' | 'warning' | 'muted'
  detail: string
}

export interface AgentBrainBriefingItem {
  label: string
  detail: string
  tone: 'ready' | 'warning' | 'muted'
}

export interface AgentBrainNextRunBriefing {
  title: string
  items: AgentBrainBriefingItem[]
}

export interface AgentBrainDetailView {
  title: string
  statusLabel: string
  statusTone: AgentBrainSummaryView['statusTone']
  memoryBoundaries: AgentBrainDetailStat[]
  recallFlow: AgentBrainDetailStat[]
  brainLoop: AgentBrainLoopItem[]
  nextRunBriefing: AgentBrainNextRunBriefing
  recentContext: string[]
  reviewQueue: string[]
  reviewItems: AgentBrainReviewItem[]
  learningTrace: AgentBrainLearningTraceItem[]
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
  const reviewItems = buildReviewItems(report)

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
    brainLoop: buildBrainLoop(report, {
      memoryEnabled,
      contextTypeCount,
      needsReview,
    }),
    nextRunBriefing: buildNextRunBriefing(report, {
      memoryEnabled,
    }),
    recentContext: report.retrieval.candidates.slice(0, 5).map((candidate) => {
      const matched = candidate.matchedTerms?.filter(Boolean).join('、')
      const suffix = matched ? `命中：${matched}` : `评分：${roundNumber(candidate.score)}`
      return `${candidate.title} · ${candidate.type} · ${suffix}`
    }),
    reviewQueue,
    reviewItems,
    learningTrace: buildLearningTrace(report),
    playbooks: (report.learningSummary.latestPlaybooks ?? [])
      .filter((playbook) => playbook.status === 'active')
      .map((playbook) => playbook.title.trim())
      .filter(Boolean)
      .slice(0, 5),
    recommendations: report.recommendations.map((item) => item.trim()).filter(Boolean).slice(0, 5),
  }
}

function buildNextRunBriefing(
  report: AgentBrainSummaryReport,
  options: { memoryEnabled: boolean },
): AgentBrainNextRunBriefing {
  const items: AgentBrainBriefingItem[] = []
  const sampleGoal = report.retrieval.sampleGoal?.trim()

  if (sampleGoal) {
    items.push({
      label: '任务方向',
      detail: `按「${sampleGoal}」准备上下文。`,
      tone: options.memoryEnabled ? 'ready' : 'muted',
    })
  }

  if (!options.memoryEnabled) {
    items.push({
      label: '记忆状态',
      detail: '记忆已关闭。这个 Agent 下次运行只会使用当前任务上下文。',
      tone: 'muted',
    })
  } else {
    const referenceTitles = report.retrieval.candidates
      .map((candidate) => candidate.title.trim())
      .filter(Boolean)
      .slice(0, 2)
    if (referenceTitles.length) {
      items.push({
        label: '优先参考',
        detail: joinChinese(referenceTitles),
        tone: 'ready',
      })
    }
  }

  const warningTitles = unique([
    ...report.governance.mistakeTitles,
    ...report.governance.expiringSoonMemoryTitles,
    ...report.retrieval.warnings,
  ]).slice(0, 2)
  if (warningTitles.length) {
    items.push({
      label: '先避开',
      detail: joinChinese(warningTitles),
      tone: 'warning',
    })
  }

  const playbookTitles = (report.learningSummary.latestPlaybooks ?? [])
    .filter((playbook) => playbook.status === 'active')
    .map((playbook) => playbook.title.trim())
    .filter(Boolean)
    .slice(0, 2)
  if (playbookTitles.length) {
    items.push({
      label: '可用手册',
      detail: joinChinese(playbookTitles),
      tone: 'ready',
    })
  }

  const pendingTitles = unique([
    ...report.governance.pendingLearningTitles,
    ...(report.learningSummary.latestEvents ?? [])
      .filter((event) => event.status === 'pending_review')
      .map((event) => event.title),
  ]).slice(0, 1)
  if (pendingTitles.length) {
    items.push({
      label: '需要确认',
      detail: joinChinese(pendingTitles),
      tone: 'warning',
    })
  }

  if (items.length === 0) {
    items.push({
      label: '开工状态',
      detail: '暂无可用经验。完成一次任务后，这里会自动变成这个 Agent 的开工提示。',
      tone: 'muted',
    })
  }

  return {
    title: '下次开工提示',
    items: items.slice(0, 5),
  }
}

function buildBrainLoop(
  report: AgentBrainSummaryReport,
  options: {
    memoryEnabled: boolean
    contextTypeCount: number
    needsReview: boolean
  },
): AgentBrainLoopItem[] {
  const reflectionCount = report.reflectionSummary?.total ?? (report.learningTrace ?? []).length
  const pendingReviewCount = report.learningSummary.pendingReview
  const hasFailureSignals =
    report.memorySummary.mistakeCount > 0 ||
    report.governance.mistakeTitles.length > 0 ||
    (report.learningTrace ?? []).some((trace) => trace.whatFailed.length > 0)

  return [
    {
      label: '提取线索',
      value: report.retrieval.sampleGoal?.trim() || '按任务目标提取',
      state: options.memoryEnabled ? 'ready' : 'muted',
      detail: '从目标里识别客户、工具、交付物和风险点。',
    },
    {
      label: '召回经验',
      value: options.memoryEnabled ? `${report.retrieval.candidates.length} 条` : '未启用',
      state: options.memoryEnabled ? 'ready' : 'muted',
      detail: options.memoryEnabled
        ? '只取这个 Agent 当前最相关的私有经验、项目知识和工具经验。'
        : '记忆已关闭，这个 Agent 不会在运行前召回长期经验。',
    },
    {
      label: '编译上下文',
      value: options.memoryEnabled ? `${options.contextTypeCount} 类` : '未启用',
      state: options.memoryEnabled ? 'ready' : 'muted',
      detail: options.memoryEnabled
        ? '把记忆压成可执行上下文，避免把历史聊天整段塞给模型。'
        : '没有可注入的长期经验，只使用当前任务上下文。',
    },
    {
      label: '执行验证',
      value: reflectionCount > 0 ? `${reflectionCount} 次复盘` : '等待运行',
      state: hasFailureSignals || options.needsReview ? 'warning' : reflectionCount > 0 ? 'ready' : 'muted',
      detail: '运行后检查产物、失败原因和可复用步骤。',
    },
    {
      label: '沉淀经验',
      value:
        pendingReviewCount > 0
          ? `${pendingReviewCount} 条待确认`
          : report.learningSummary.activePlaybooks > 0
            ? `${report.learningSummary.activePlaybooks} 本手册`
            : '等待沉淀',
      state: pendingReviewCount > 0 || options.needsReview ? 'warning' : report.learningSummary.activePlaybooks > 0 ? 'ready' : 'muted',
      detail: '失败教训先留在这个 Agent 内，重要经验确认后才变成工作手册。',
    },
  ]
}

function buildLearningTrace(report: AgentBrainSummaryReport): AgentBrainLearningTraceItem[] {
  return (report.learningTrace ?? [])
    .slice(0, 4)
    .map((trace) => {
      const failed = trace.whatFailed.map((item) => item.trim()).filter(Boolean)
      const worked = trace.whatWorked.map((item) => item.trim()).filter(Boolean)
      const memoryTitles = trace.memoryTitles.map((item) => item.trim()).filter(Boolean)
      const pendingTitles = trace.pendingLearningTitles.map((item) => item.trim()).filter(Boolean)
      const approvedTitles = trace.approvedLearningTitles.map((item) => item.trim()).filter(Boolean)
      const playbookTitles = trace.playbookTitles.map((item) => item.trim()).filter(Boolean)
      const titleSeed = failed[0] ?? worked[0] ?? memoryTitles[0] ?? trace.runId
      const reviewCount = pendingTitles.length
      const items = [
        ...worked.map((item) => `做对了：${item}`),
        ...failed.map((item) => `失败原因：${item}`),
        ...memoryTitles.map((item) => `写入记忆：${item}`),
        ...pendingTitles.map((item) => `待审核：${item}`),
        ...approvedTitles.map((item) => `已确认：${item}`),
        ...playbookTitles.map((item) => `工作手册：${item}`),
      ]
      const tone: AgentBrainLearningTraceItem['tone'] =
        trace.outcome === 'failed' ? 'warning' : trace.outcome === 'succeeded' ? 'ready' : 'muted'

      return {
        title: failed.length ? `失败归因：${titleSeed}` : `经验复盘：${titleSeed}`,
        badge: trace.outcome === 'failed' ? '失败复盘' : trace.outcome === 'succeeded' ? '成功经验' : '复盘记录',
        tone,
        detail: `运行 ${trace.runId} · 已写入 ${memoryTitles.length} 条记忆 · ${reviewCount} 条待审核`,
        items: items.slice(0, 6),
      }
    })
    .filter((trace) => trace.items.length > 0)
}

function buildReviewItems(report: AgentBrainSummaryReport): AgentBrainReviewItem[] {
  const items: AgentBrainReviewItem[] = []
  const pendingEvents = (report.learningSummary.latestEvents ?? [])
    .filter((event) => event.status === 'pending_review')

  for (const event of pendingEvents) {
    items.push({
      eventId: event.id,
      title: event.title,
      badge: labelLearningEventType(event.type),
      detail: event.summary?.trim() || '确认后才会写入这个 Agent 的长期经验。',
    })
  }
  for (const title of report.governance.pendingLearningTitles) {
    items.push({
      title,
      badge: '待审核经验',
      detail: '确认后才会成为这个 Agent 的长期经验或工作手册。',
    })
  }
  for (const title of report.governance.sensitiveMemoryTitles ?? []) {
    items.push({
      title,
      badge: '隐私记忆',
      detail: '确认是否只允许这个 Agent 或项目内使用。',
    })
  }
  for (const title of report.governance.mistakeTitles) {
    items.push({
      title,
      badge: '失败教训',
      detail: '下次计划时优先提醒这个 Agent 避免重复失败。',
    })
  }
  for (const title of report.governance.expiringSoonMemoryTitles) {
    items.push({
      title,
      badge: '即将过期',
      detail: '确认这条记忆是否还值得保留。',
    })
  }
  for (const gap of report.retrieval.gaps) {
    items.push({
      title: gap,
      badge: '需要处理',
      detail: '这会影响这个 Agent 运行前召回经验。',
    })
  }
  return uniqueReviewItems(items).slice(0, 8)
}

function labelLearningEventType(type: string | undefined): string {
  if (type === 'playbook_proposal') return '工作手册草稿'
  if (type === 'memory_share_review') return '记忆共享审核'
  if (type === 'psm_approval_review') return '学习审核'
  return '待审核经验'
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

function joinChinese(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join('、')
}

function uniqueReviewItems(items: AgentBrainReviewItem[]): AgentBrainReviewItem[] {
  const seen = new Set<string>()
  const result: AgentBrainReviewItem[] = []
  for (const item of items) {
    const title = item.title.trim()
    if (!title || seen.has(title)) continue
    seen.add(title)
    result.push({
      eventId: item.eventId,
      title,
      badge: item.badge,
      detail: item.detail,
    })
  }
  return result
}

function roundNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

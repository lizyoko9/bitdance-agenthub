export interface EmployeeRunBrainDigestInput {
  reflection: {
    whatWorked: string[]
    whatFailed: string[]
    reusableProcedure: string[]
    futureWarnings: string[]
  } | null
  memoryItems: Array<{
    title: string
    type: string
  }>
  learningEvents: Array<{
    title: string
    status: string
  }>
}

export interface EmployeeRunBrainDigest {
  title: string
  statusLabel: string
  tone: 'ready' | 'warning' | 'muted'
  headline: string
  metrics: Array<{ label: string; value: string }>
  items: string[]
}

export function buildEmployeeRunBrainDigest(input: EmployeeRunBrainDigestInput): EmployeeRunBrainDigest {
  const whatWorked = normalizeList(input.reflection?.whatWorked ?? [])
  const whatFailed = normalizeList(input.reflection?.whatFailed ?? [])
  const futureWarnings = normalizeList(input.reflection?.futureWarnings ?? [])
  const memoryTitles = normalizeList(input.memoryItems.map((item) => item.title))
  const mistakeCount = input.memoryItems.filter((item) => item.type === 'mistake').length
  const pendingLearningTitles = normalizeList(
    input.learningEvents
      .filter((event) => event.status === 'pending_review')
      .map((event) => event.title),
  )

  if (!input.reflection && memoryTitles.length === 0 && pendingLearningTitles.length === 0) {
    return {
      title: '员工大脑',
      statusLabel: '等待复盘',
      tone: 'muted',
      headline: '这个员工完成任务后，会在这里显示它学到了什么。',
      metrics: [
        { label: '写入记忆', value: '0' },
        { label: '失败教训', value: '0' },
        { label: '待审核', value: '0' },
      ],
      items: ['暂无复盘记录'],
    }
  }

  const hasFailure = whatFailed.length > 0 || mistakeCount > 0
  const items = [
    ...whatWorked.map((item) => `做对了：${item}`),
    ...whatFailed.map((item) => `失败原因：${item}`),
    ...futureWarnings.map((item) => `下次提醒：${item}`),
    ...pendingLearningTitles.map((item) => `待确认：${item}`),
  ]

  return {
    title: '员工大脑',
    statusLabel: hasFailure ? '有失败教训' : '已沉淀经验',
    tone: hasFailure ? 'warning' : 'ready',
    headline: hasFailure
      ? `失败归因：${whatFailed[0] ?? input.memoryItems.find((item) => item.type === 'mistake')?.title ?? '需要复盘'}`
      : `经验沉淀：${whatWorked[0] ?? memoryTitles[0] ?? '已记录本次任务经验'}`,
    metrics: [
      { label: '写入记忆', value: String(input.memoryItems.length) },
      { label: '失败教训', value: String(mistakeCount) },
      { label: '待审核', value: String(pendingLearningTitles.length) },
    ],
    items: items.length ? items.slice(0, 5) : ['已记录本次运行结果'],
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

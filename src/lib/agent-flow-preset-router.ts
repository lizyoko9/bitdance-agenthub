export type CanvasWorkflowPresetId = 'report-delivery' | 'content-video' | 'code-delivery'

const videoKeywords = [
  '视频',
  '短视频',
  '成片',
  '剪辑',
  '剪映',
  'capcut',
  '字幕',
  '配音',
]

const codeKeywords = [
  '代码',
  '源码',
  '程序',
  '开发',
  'bug',
  'diff',
  'pr',
  '仓库',
  '网站',
  '应用',
]

export function selectCanvasWorkflowPresetId(goal: string): CanvasWorkflowPresetId {
  const normalized = goal.trim().toLowerCase()
  if (!normalized) return 'report-delivery'

  if (videoKeywords.some((keyword) => normalized.includes(keyword))) return 'content-video'
  if (codeKeywords.some((keyword) => normalized.includes(keyword))) return 'code-delivery'

  return 'report-delivery'
}

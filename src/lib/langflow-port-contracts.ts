export type LangflowPortKind =
  | 'message'
  | 'prompt'
  | 'model'
  | 'tool'
  | 'memory'
  | 'code'
  | 'data'
  | 'result'
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'report'
  | 'spreadsheet'
  | 'file_bundle'
  | 'structured_data'

export const LANGFLOW_PORT_KIND_LABELS: Record<LangflowPortKind, string> = {
  message: '消息',
  prompt: '提示词',
  model: '模型',
  tool: '工具',
  memory: '记忆',
  code: '代码',
  data: '数据',
  result: '结果',
  document: '文档',
  image: '图片',
  video: '视频',
  audio: '音频',
  report: '报告',
  spreadsheet: '表格',
  file_bundle: '文件包',
  structured_data: '结构化数据',
}

export interface NodePortSummary {
  inputCount: number
  outputCount: number
  accepts: string
  produces: string
}

export function canConnectPortKinds(
  outputKind: LangflowPortKind | null | undefined,
  inputKind: LangflowPortKind | null | undefined,
): boolean {
  return Boolean(outputKind && inputKind && outputKind === inputKind)
}

export function buildPortCompatibilityHint(
  outputKind: LangflowPortKind | null | undefined,
  inputKind: LangflowPortKind | null | undefined,
): string {
  if (canConnectPortKinds(outputKind, inputKind)) {
    return `可以连接：${labelPortKind(outputKind!)} 会原样传给下游节点。`
  }
  const outputLabel = outputKind ? labelPortKind(outputKind) : '未知产物'
  const inputLabel = inputKind ? labelPortKind(inputKind) : '未知入口'
  return `只能连接同类型产物：当前是 ${outputLabel} -> ${inputLabel}，需要改成同一种类型。`
}

export function summarizeNodePorts(
  inputs: LangflowPortKind[],
  outputs: LangflowPortKind[],
): NodePortSummary {
  return {
    inputCount: inputs.length,
    outputCount: outputs.length,
    accepts: formatPortKinds(inputs),
    produces: formatPortKinds(outputs),
  }
}

export function labelPortKind(kind: LangflowPortKind): string {
  return LANGFLOW_PORT_KIND_LABELS[kind] ?? kind
}

function formatPortKinds(kinds: LangflowPortKind[]): string {
  if (kinds.length === 0) return '无'
  return Array.from(new Set(kinds)).map(labelPortKind).join('、')
}

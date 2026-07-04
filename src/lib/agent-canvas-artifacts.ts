export const CANVAS_ARTIFACT_TYPES = [
  'video',
  'audio',
  'image',
  'document',
  'code',
  'spreadsheet',
  'file_bundle',
  'json',
  'report',
  'browser_state',
  'desktop_result',
  'software_result',
  'approval_decision',
  'any_file',
] as const

export type CanvasArtifactType = (typeof CANVAS_ARTIFACT_TYPES)[number]

export const CANVAS_ARTIFACT_LABELS: Record<CanvasArtifactType, string> = {
  video: '视频',
  audio: '音频',
  image: '图片',
  document: '文档',
  code: '代码',
  spreadsheet: '表格',
  file_bundle: '文件包',
  json: '结构化数据',
  report: '报告',
  browser_state: '浏览器状态',
  desktop_result: '电脑操作结果',
  software_result: '软件执行结果',
  approval_decision: '确认结果',
  any_file: '任意文件',
}

export interface CanvasArtifactPort {
  key: string
  type: CanvasArtifactType
  label: string
  description: string
  customerVisible: boolean
}

export interface CanvasArtifactEdgeMapping {
  [key: string]: unknown
  handoffMode: 'fixed_artifact'
  outputKey: string
  targetInputKey: string
  artifactType: CanvasArtifactType
  artifactLabel: string
  artifactOnly: true
  customerVisible: boolean
  waitForSource: boolean
}

export interface AgentCanvasNodeLike {
  id: string
  type?: string
  label?: string
  inputMapping?: Record<string, unknown> | null
  outputContract?: Record<string, unknown> | null
}

export interface AgentCanvasEdgeLike {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string | null
  targetHandle?: string | null
  mapping?: Record<string, unknown> | null
}

const artifactTypeSet = new Set<string>(CANVAS_ARTIFACT_TYPES)

export function normalizeCanvasArtifactType(
  value: unknown,
  fallback: CanvasArtifactType = 'document',
): CanvasArtifactType {
  if (typeof value === 'string' && artifactTypeSet.has(value)) {
    return value as CanvasArtifactType
  }
  return fallback
}

export function getNodeOutputPorts(node: AgentCanvasNodeLike): CanvasArtifactPort[] {
  const outputContract = objectOrEmpty(node.outputContract)
  const fallbackType = normalizeCanvasArtifactType(outputContract.artifactType, 'document')
  const outputs = arrayField(outputContract, 'outputs')
    .map((value, index) => normalizePort(value, index, fallbackType))
    .filter((value): value is CanvasArtifactPort => Boolean(value))

  if (outputs.length > 0) return dedupePorts(outputs)

  const label =
    stringField(outputContract, 'deliverableTitle') ||
    node.label ||
    CANVAS_ARTIFACT_LABELS[fallbackType]
  const description =
    stringField(outputContract, 'deliveryDescription') ||
    stringField(outputContract, 'description') ||
    artifactDescription(fallbackType)

  return [
    {
      key: 'artifact',
      type: fallbackType,
      label,
      description,
      customerVisible: booleanField(outputContract, 'customerVisible', true),
    },
  ]
}

export function getNodeAcceptedInputTypes(node: AgentCanvasNodeLike): CanvasArtifactType[] {
  return uniqueArtifactTypes(arrayField(objectOrEmpty(node.inputMapping), 'acceptedArtifactTypes'))
}

export function createArtifactEdgeMapping(
  output: CanvasArtifactPort,
  overrides: Partial<Pick<CanvasArtifactEdgeMapping, 'targetInputKey' | 'customerVisible' | 'waitForSource'>> = {},
): CanvasArtifactEdgeMapping {
  return {
    handoffMode: 'fixed_artifact',
    outputKey: output.key,
    targetInputKey: overrides.targetInputKey ?? output.key,
    artifactType: output.type,
    artifactLabel: output.label,
    artifactOnly: true,
    customerVisible: overrides.customerVisible ?? output.customerVisible,
    waitForSource: overrides.waitForSource ?? true,
  }
}

export function getEdgeArtifactType(
  edge: AgentCanvasEdgeLike,
  source?: AgentCanvasNodeLike | null,
): CanvasArtifactType {
  const mapping = objectOrEmpty(edge.mapping)
  const mappedType = normalizeCanvasArtifactType(mapping.artifactType, 'any_file')
  if (mappedType !== 'any_file' || typeof mapping.artifactType === 'string') return mappedType

  const outputKey = getEdgeOutputKey(edge)
  const output = source
    ? getNodeOutputPorts(source).find((item) => item.key === outputKey)
    : null
  return output?.type ?? 'any_file'
}

export function getIncomingArtifactTypes(
  targetNode: AgentCanvasNodeLike,
  edges: AgentCanvasEdgeLike[],
  nodes: AgentCanvasNodeLike[],
): CanvasArtifactType[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  return uniqueArtifactTypes(
    edges
      .filter((edge) => edge.targetNodeId === targetNode.id)
      .map((edge) => getEdgeArtifactType(edge, nodeById.get(edge.sourceNodeId))),
  )
}

export function doesEdgeMatchTargetInput(
  edge: AgentCanvasEdgeLike,
  targetNode: AgentCanvasNodeLike,
  source?: AgentCanvasNodeLike | null,
): boolean {
  const accepted = getNodeAcceptedInputTypes(targetNode)
  if (accepted.length === 0 || accepted.includes('any_file')) return true
  return accepted.includes(getEdgeArtifactType(edge, source))
}

export function canConnectArtifactOutputToTarget(
  output: CanvasArtifactPort,
  targetNode: AgentCanvasNodeLike,
): boolean {
  const accepted = getNodeAcceptedInputTypes(targetNode)
  if (accepted.length === 0 || accepted.includes('any_file')) return true
  return accepted.includes(output.type)
}

export function deleteNodeAndConnectedEdges<TNode extends AgentCanvasNodeLike, TEdge extends AgentCanvasEdgeLike>(
  nodeId: string,
  nodes: TNode[],
  edges: TEdge[],
): { nodes: TNode[]; edges: TEdge[] } {
  return {
    nodes: nodes.filter((node) => node.id !== nodeId),
    edges: edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId),
  }
}

export function getEdgeOutputKey(edge: AgentCanvasEdgeLike): string {
  const mapping = objectOrEmpty(edge.mapping)
  if (typeof mapping.outputKey === 'string' && mapping.outputKey.length > 0) {
    return mapping.outputKey
  }
  if (typeof edge.sourceHandle === 'string' && edge.sourceHandle.startsWith('artifact:')) {
    return edge.sourceHandle.slice('artifact:'.length)
  }
  return 'artifact'
}

function normalizePort(
  value: unknown,
  index: number,
  fallbackType: CanvasArtifactType,
): CanvasArtifactPort | null {
  if (!isRecord(value)) return null
  const type = normalizeCanvasArtifactType(value.type, fallbackType)
  return {
    key: stringField(value, 'key') || artifactKey(type, index),
    type,
    label: stringField(value, 'label') || CANVAS_ARTIFACT_LABELS[type],
    description: stringField(value, 'description') || artifactDescription(type),
    customerVisible:
      typeof value.customerVisible === 'boolean' ? value.customerVisible : index === 0,
  }
}

function dedupePorts(outputs: CanvasArtifactPort[]): CanvasArtifactPort[] {
  const used = new Set<string>()
  return outputs.map((output, index) => {
    let key = output.key || artifactKey(output.type, index)
    while (used.has(key)) key = `${output.type}_${used.size + 1}`
    used.add(key)
    return { ...output, key }
  })
}

function uniqueArtifactTypes(values: unknown[]): CanvasArtifactType[] {
  const result: CanvasArtifactType[] = []
  for (const value of values) {
    const type = normalizeCanvasArtifactType(value, 'any_file')
    if (!result.includes(type)) result.push(type)
  }
  return result
}

function artifactKey(type: CanvasArtifactType, index: number): string {
  return index === 0 ? type : `${type}_${index + 1}`
}

function artifactDescription(type: CanvasArtifactType): string {
  const map: Record<CanvasArtifactType, string> = {
    video: '视频文件',
    audio: '音频文件',
    image: '图片文件',
    document: '文档文件',
    code: '代码文件',
    spreadsheet: '表格文件',
    file_bundle: '文件包',
    json: 'JSON 数据',
    report: '报告页面',
    browser_state: '浏览器状态或截图',
    desktop_result: '电脑操作截图或日志',
    software_result: '软件执行结果',
    approval_decision: '人工确认记录',
    any_file: '任意文件',
  }
  return map[type]
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function arrayField(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key]
  return Array.isArray(value) ? value : []
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

function booleanField(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key]
  return typeof value === 'boolean' ? value : fallback
}

import type { JsonObject, RunStatus } from '@/db/schema'

export interface WorkflowRunArtifactHandoffNode {
  id: string
  type: string
  config?: JsonObject | null
  inputMapping?: JsonObject | null
  outputContract?: JsonObject | null
}

export interface WorkflowRunArtifactHandoffEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string | null
  targetHandle?: string | null
  mapping?: JsonObject | null
}

export interface WorkflowRunArtifactHandoffNodeRun {
  id: string
  nodeId: string
  status: RunStatus
  output?: JsonObject | null
}

export interface WorkflowRunSelectedArtifact {
  outputKey: string
  artifactType: string
  artifactId: string | null
  value: JsonObject | null
}

export interface WorkflowRunArtifactHandoff {
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  sourceNodeRunId: string | null
  targetNodeRunId: string | null
  sourceNodeLabel: string
  targetNodeLabel: string
  sourceStatus: RunStatus | null
  targetStatus: RunStatus | null
  outputKey: string
  targetInputKey: string
  artifactType: string
  artifactLabel: string
  sourcePortLabel: string
  targetPortLabel: string
  contract: string
  artifactId: string | null
  selectedArtifact: WorkflowRunSelectedArtifact | null
}

const ARTIFACT_LABELS: Record<string, string> = {
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
  artifact: '产物',
}

export function buildWorkflowRunArtifactHandoffs(input: {
  nodes: WorkflowRunArtifactHandoffNode[]
  edges: WorkflowRunArtifactHandoffEdge[]
  nodeRuns: WorkflowRunArtifactHandoffNodeRun[]
}): WorkflowRunArtifactHandoff[] {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]))
  const nodeRunByNodeId = new Map(input.nodeRuns.map((run) => [run.nodeId, run]))

  return input.edges.flatMap((edge) => {
    const sourceNode = nodeById.get(edge.sourceNodeId)
    const targetNode = nodeById.get(edge.targetNodeId)
    if (!sourceNode || !targetNode) return []

    const mapping = objectOrEmpty(edge.mapping)
    const outputKey = stringField(mapping, 'outputKey') || handleArtifactKey(edge.sourceHandle) || 'artifact'
    const artifactType =
      stringField(mapping, 'artifactType') ||
      outputPortField(sourceNode, outputKey, 'type') ||
      stringField(objectOrEmpty(sourceNode.outputContract), 'artifactType') ||
      'artifact'
    const artifactLabel = artifactTypeLabel(artifactType)
    const targetInputKey = stringField(mapping, 'targetInputKey') || handleInputKey(edge.targetHandle) || outputKey
    const sourcePortLabel =
      stringField(mapping, 'sourcePortLabel') ||
      outputPortField(sourceNode, outputKey, 'label') ||
      stringField(mapping, 'artifactLabel') ||
      artifactLabel
    const targetPortLabel =
      stringField(mapping, 'targetPortLabel') ||
      inputPortLabel(targetNode, targetInputKey, artifactType) ||
      artifactLabel
    const sourceRun = nodeRunByNodeId.get(edge.sourceNodeId) ?? null
    const targetRun = nodeRunByNodeId.get(edge.targetNodeId) ?? null
    const selectedArtifact = sourceRun?.output
      ? selectOutputArtifact(sourceRun.output, outputKey, artifactType)
      : null

    return [
      {
        edgeId: edge.id,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        sourceNodeRunId: sourceRun?.id ?? null,
        targetNodeRunId: targetRun?.id ?? null,
        sourceNodeLabel: nodeLabel(sourceNode),
        targetNodeLabel: nodeLabel(targetNode),
        sourceStatus: sourceRun?.status ?? null,
        targetStatus: targetRun?.status ?? null,
        outputKey,
        targetInputKey,
        artifactType,
        artifactLabel,
        sourcePortLabel,
        targetPortLabel,
        contract: `${artifactLabel}: ${sourcePortLabel} -> ${targetPortLabel}`,
        artifactId: selectedArtifact?.artifactId ?? null,
        selectedArtifact,
      },
    ]
  })
}

function selectOutputArtifact(
  sourceOutput: JsonObject,
  outputKey: string,
  artifactType: string,
): WorkflowRunSelectedArtifact {
  const employeeOutput = objectOrEmpty(sourceOutput.employeeRunOutput)
  const softwareOutput = objectOrEmpty(sourceOutput.softwareCommandOutput)
  const outputArtifacts = {
    ...stringRecord(sourceOutput.outputArtifacts),
    ...stringRecord(employeeOutput.outputArtifacts),
    ...stringRecord(softwareOutput.outputArtifacts),
  }
  const directValue =
    sourceOutput[outputKey] ??
    employeeOutput[outputKey] ??
    softwareOutput[outputKey]
  const artifactId =
    outputArtifacts[outputKey] ||
    (outputKey === 'artifact' ? stringField(sourceOutput, 'artifactId') : '') ||
    null

  return {
    outputKey,
    artifactType,
    artifactId,
    value: valueAsJsonObject(directValue),
  }
}

function outputPortField(
  node: WorkflowRunArtifactHandoffNode,
  outputKey: string,
  field: 'label' | 'type',
): string {
  const outputs = arrayField(objectOrEmpty(node.outputContract), 'outputs')
  const output = outputs.map(objectOrEmpty).find((item) => stringField(item, 'key') === outputKey)
  return output ? stringField(output, field) : ''
}

function inputPortLabel(
  node: WorkflowRunArtifactHandoffNode,
  targetInputKey: string,
  artifactType: string,
): string {
  const inputs = arrayField(objectOrEmpty(node.inputMapping), 'inputs')
  const input = inputs.map(objectOrEmpty).find((item) => stringField(item, 'key') === targetInputKey)
  return input ? stringField(input, 'label') : `${artifactTypeLabel(artifactType)}文件`
}

function nodeLabel(node: WorkflowRunArtifactHandoffNode): string {
  return stringField(objectOrEmpty(node.config), 'label') || node.id
}

function artifactTypeLabel(type: string): string {
  return ARTIFACT_LABELS[type] ?? type
}

function handleArtifactKey(handle: string | null | undefined): string {
  if (!handle) return ''
  if (handle.startsWith('artifact:')) return handle.slice('artifact:'.length)
  if (handle.startsWith('out:')) return handle.slice('out:'.length)
  return ''
}

function handleInputKey(handle: string | null | undefined): string {
  if (!handle) return ''
  if (handle.startsWith('in:')) return handle.slice('in:'.length)
  return handle === 'input' ? '' : handle
}

function objectOrEmpty(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

function arrayField(obj: JsonObject, key: string): unknown[] {
  return Array.isArray(obj[key]) ? obj[key] : []
}

function stringField(obj: JsonObject, key: string): string {
  const value = obj[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(objectOrEmpty(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function valueAsJsonObject(value: unknown): JsonObject | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObject
  return { value }
}

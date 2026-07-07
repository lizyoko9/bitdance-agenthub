import type { JsonObject, RunStatus } from '@/db/schema'
import {
  CANVAS_ARTIFACT_LABELS,
  getNodeOutputPorts,
  type CanvasArtifactType,
} from '@/lib/agent-canvas-artifacts'

export interface WorkflowRunDeliveryPackageNode {
  id: string
  type: string
  config?: JsonObject | null
  outputContract?: JsonObject | null
}

export interface WorkflowRunDeliveryPackageNodeRun {
  id: string
  nodeId: string
  status: RunStatus
  output?: JsonObject | null
}

export type WorkflowRunDeliveryArtifactStatus = 'ready' | 'waiting' | 'failed'

export interface WorkflowRunDeliveryArtifact {
  id: string
  nodeId: string
  nodeRunId: string | null
  sourceNodeLabel: string
  title: string
  description: string
  artifactType: CanvasArtifactType
  artifactLabel: string
  outputKey: string
  artifactId: string | null
  status: WorkflowRunDeliveryArtifactStatus
  fileName: string | null
  path: string | null
}

export interface WorkflowRunDeliveryPackage {
  title: '客户可见交付包'
  summary: string
  totalArtifacts: number
  readyArtifacts: number
  missingArtifacts: string[]
  artifacts: WorkflowRunDeliveryArtifact[]
}

export function buildWorkflowRunDeliveryPackage(input: {
  nodes: WorkflowRunDeliveryPackageNode[]
  nodeRuns: WorkflowRunDeliveryPackageNodeRun[]
}): WorkflowRunDeliveryPackage {
  const nodeRunByNodeId = new Map(input.nodeRuns.map((run) => [run.nodeId, run]))
  const artifacts = input.nodes.flatMap((node) => {
    if (objectOrEmpty(node.outputContract).customerVisible === false) return []

    const sourceNodeLabel = nodeLabel(node)
    return getNodeOutputPorts({
      id: node.id,
      type: node.type,
      label: sourceNodeLabel,
      outputContract: node.outputContract ?? {},
    })
      .filter((port) => port.customerVisible)
      .map((port) => {
        const nodeRun = nodeRunByNodeId.get(node.id) ?? null
        const selected = selectOutputArtifact(nodeRun?.output ?? null, port.key)
        const status = deliveryStatus(nodeRun?.status ?? null, selected)
        const description =
          stringField(objectOrEmpty(node.outputContract), 'deliveryDescription') ||
          stringField(objectOrEmpty(node.outputContract), 'description') ||
          port.description

        return {
          id: `${node.id}:${port.key}`,
          nodeId: node.id,
          nodeRunId: nodeRun?.id ?? null,
          sourceNodeLabel,
          title: port.label,
          description,
          artifactType: port.type,
          artifactLabel: CANVAS_ARTIFACT_LABELS[port.type],
          outputKey: port.key,
          artifactId: selected.artifactId,
          status,
          fileName: selected.fileName,
          path: selected.path,
        }
      })
  })
  const readyArtifacts = artifacts.filter((artifact) => artifact.status === 'ready').length
  const missingArtifacts = artifacts
    .filter((artifact) => artifact.status !== 'ready')
    .map((artifact) => artifact.title)

  return {
    title: '客户可见交付包',
    summary: `已整理 ${artifacts.length} 个客户可见产物，其中 ${readyArtifacts} 个已完成。`,
    totalArtifacts: artifacts.length,
    readyArtifacts,
    missingArtifacts,
    artifacts,
  }
}

function selectOutputArtifact(
  sourceOutput: JsonObject | null,
  outputKey: string,
): {
  artifactId: string | null
  fileName: string | null
  path: string | null
  hasValue: boolean
} {
  if (!sourceOutput) {
    return { artifactId: null, fileName: null, path: null, hasValue: false }
  }

  const employeeOutput = objectOrEmpty(sourceOutput.employeeRunOutput)
  const softwareOutput = objectOrEmpty(sourceOutput.softwareCommandOutput)
  const outputArtifacts = {
    ...stringRecord(sourceOutput.outputArtifacts),
    ...stringRecord(employeeOutput.outputArtifacts),
    ...stringRecord(softwareOutput.outputArtifacts),
  }
  const directValue = valueAsJsonObject(sourceOutput[outputKey])
  const artifactId =
    outputArtifacts[outputKey] ||
    stringField(directValue, 'artifactId') ||
    (outputKey === 'artifact' ? stringField(sourceOutput, 'artifactId') : '') ||
    null

  return {
    artifactId,
    fileName: stringField(directValue, 'fileName') || stringField(directValue, 'name') || null,
    path: stringField(directValue, 'path') || stringField(directValue, 'dataRef') || null,
    hasValue: Object.keys(directValue).length > 0,
  }
}

function deliveryStatus(
  nodeRunStatus: RunStatus | null,
  selected: { artifactId: string | null; hasValue: boolean },
): WorkflowRunDeliveryArtifactStatus {
  if (nodeRunStatus === 'failed' || nodeRunStatus === 'aborted') return 'failed'
  if (nodeRunStatus === 'complete' && (selected.artifactId || selected.hasValue)) return 'ready'
  return 'waiting'
}

function nodeLabel(node: WorkflowRunDeliveryPackageNode): string {
  return stringField(objectOrEmpty(node.config), 'label') || node.id
}

function objectOrEmpty(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
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

function valueAsJsonObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonObject
  if (value === null || value === undefined) return {}
  return { value }
}

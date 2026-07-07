import type { JsonObject } from '@/db/schema'

export interface WorkflowNodeArtifactRoutingEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string | null
  targetHandle?: string | null
  mapping?: JsonObject | null
}

export interface WorkflowNodeSelectedArtifact {
  outputKey: string
  artifactType: string | null
  artifactId: string | null
  value: JsonObject | null
}

export interface WorkflowNodeRoutedArtifactInput extends JsonObject {
  sourceNodeId: string
  edgeId: string
  outputKey: string
  artifactType: string | null
  targetInputKey: string
  artifactOnly: true
  selectedArtifact: WorkflowNodeSelectedArtifact
  mapping: JsonObject | null
}

export interface WorkflowNodeRoutedSourceSummary extends JsonObject {
  sourceNodeId: string
  artifactOnly: true
  multipleHandoffs: true
  handoffs: Record<string, WorkflowNodeRoutedArtifactInput>
}

export function resolveWorkflowNodeArtifactInputs(input: {
  targetNodeId: string
  edges: WorkflowNodeArtifactRoutingEdge[]
  outputsByNodeId: Record<string, JsonObject>
}): Record<string, JsonObject> {
  const routed: Record<string, JsonObject> = {}

  for (const edge of input.edges) {
    if (edge.targetNodeId !== input.targetNodeId) continue
    const sourceOutput = input.outputsByNodeId[edge.sourceNodeId]
    if (!sourceOutput) continue

    const mapping = objectOrEmpty(edge.mapping)
    const outputKey = stringField(mapping, 'outputKey') || handleArtifactKey(edge.sourceHandle)
    const artifactType = stringField(mapping, 'artifactType') || null
    const targetInputKey =
      stringField(mapping, 'targetInputKey') ||
      handleInputKey(edge.targetHandle) ||
      outputKey ||
      'upstreamOutput'

    if (!outputKey) {
      routed[edge.sourceNodeId] = JSON.parse(JSON.stringify(sourceOutput)) as JsonObject
      continue
    }

    const artifactInput: WorkflowNodeRoutedArtifactInput = {
      sourceNodeId: edge.sourceNodeId,
      edgeId: edge.id,
      outputKey,
      artifactType,
      targetInputKey,
      artifactOnly: true,
      selectedArtifact: selectOutputArtifact(sourceOutput, outputKey, artifactType),
      mapping: edge.mapping ?? null,
    }

    routed[targetInputKey] = artifactInput
    attachSourceCompatibilityEntry(routed, edge.sourceNodeId, targetInputKey, artifactInput)
  }

  return routed
}

function attachSourceCompatibilityEntry(
  routed: Record<string, JsonObject>,
  sourceNodeId: string,
  targetInputKey: string,
  artifactInput: WorkflowNodeRoutedArtifactInput,
): void {
  const current = routed[sourceNodeId]
  if (!current) {
    routed[sourceNodeId] = artifactInput
    return
  }

  const currentSummary = asSourceSummary(current)
  if (currentSummary) {
    currentSummary.handoffs[targetInputKey] = artifactInput
    routed[sourceNodeId] = currentSummary
    return
  }

  const currentInput = asRoutedArtifactInput(current)
  const currentTargetInputKey = currentInput?.targetInputKey ?? 'upstreamOutput'
  const handoffs: Record<string, WorkflowNodeRoutedArtifactInput> = {
    [targetInputKey]: artifactInput,
  }
  if (currentInput) handoffs[currentTargetInputKey] = currentInput
  routed[sourceNodeId] = {
    sourceNodeId,
    artifactOnly: true,
    multipleHandoffs: true,
    handoffs,
  } satisfies WorkflowNodeRoutedSourceSummary
}

function selectOutputArtifact(
  sourceOutput: JsonObject,
  outputKey: string,
  artifactType: string | null,
): WorkflowNodeSelectedArtifact {
  const employeeOutput = objectOrEmpty(sourceOutput.employeeRunOutput)
  const softwareOutput = objectOrEmpty(sourceOutput.softwareCommandOutput)
  const outputArtifacts = {
    ...asStringRecord(sourceOutput.outputArtifacts),
    ...asStringRecord(employeeOutput.outputArtifacts),
    ...asStringRecord(softwareOutput.outputArtifacts),
  }
  const directOutput =
    valueAsJsonObject(sourceOutput[outputKey]) ??
    valueAsJsonObject(employeeOutput[outputKey]) ??
    valueAsJsonObject(softwareOutput[outputKey])
  const artifactId =
    outputArtifacts[outputKey] ||
    stringField(directOutput ?? {}, 'artifactId') ||
    (outputKey === 'artifact' ? stringField(sourceOutput, 'artifactId') : '') ||
    null

  return {
    outputKey,
    artifactType,
    artifactId,
    value: directOutput,
  }
}

function asSourceSummary(value: JsonObject): WorkflowNodeRoutedSourceSummary | null {
  if (value.multipleHandoffs !== true) return null
  const handoffs = objectOrEmpty(value.handoffs)
  const routedHandoffs: Record<string, WorkflowNodeRoutedArtifactInput> = {}
  for (const [key, item] of Object.entries(handoffs)) {
    const routed = asRoutedArtifactInput(objectOrEmpty(item))
    if (routed) routedHandoffs[key] = routed
  }
  return {
    sourceNodeId: stringField(value, 'sourceNodeId') || 'unknown_source',
    artifactOnly: true,
    multipleHandoffs: true,
    handoffs: routedHandoffs,
  }
}

function asRoutedArtifactInput(value: JsonObject): WorkflowNodeRoutedArtifactInput | null {
  if (value.artifactOnly !== true) return null
  const outputKey = stringField(value, 'outputKey')
  const sourceNodeId = stringField(value, 'sourceNodeId')
  const edgeId = stringField(value, 'edgeId')
  const targetInputKey = stringField(value, 'targetInputKey')
  if (!outputKey || !sourceNodeId || !edgeId || !targetInputKey) return null
  return value as unknown as WorkflowNodeRoutedArtifactInput
}

function objectOrEmpty(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

function stringField(obj: JsonObject, key: string): string {
  const value = obj[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function asStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(objectOrEmpty(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function valueAsJsonObject(value: unknown): JsonObject | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObject
  return { value }
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

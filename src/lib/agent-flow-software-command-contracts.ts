import {
  LANGFLOW_PORT_KIND_LABELS,
  type LangflowPortKind,
} from './langflow-port-contracts'
import type { AgentFlowTemplatePort, AgentFlowTemplatePortKind } from './agent-flow-node-templates'

export interface SoftwareCommandFlowContractLike {
  name?: string | null
  inputSchema?: Record<string, unknown> | null
  outputSchema?: Record<string, unknown> | null
}

export function buildSoftwareCommandFlowPorts(command: SoftwareCommandFlowContractLike): {
  inputs: AgentFlowTemplatePort[]
  outputs: AgentFlowTemplatePort[]
} {
  const inputs = buildPortsFromSchema(command.inputSchema, {
    direction: 'input',
    fallbackType: 'message',
  })
  const outputs = buildPortsFromSchema(command.outputSchema, {
    direction: 'output',
    fallbackType: 'result',
  })

  return {
    inputs: inputs.length > 0 ? inputs : [{ id: 'message', label: '命令输入', type: 'message' }],
    outputs: outputs.length > 0 ? outputs : [{ id: 'result', label: command.name ?? '命令结果', type: 'result' }],
  }
}

function buildPortsFromSchema(
  schema: Record<string, unknown> | null | undefined,
  options: { direction: 'input' | 'output'; fallbackType: AgentFlowTemplatePortKind },
): AgentFlowTemplatePort[] {
  const record = objectOrEmpty(schema)
  const explicitKey = options.direction === 'input' ? 'inputs' : 'outputs'
  const explicitPorts = arrayField(record, explicitKey)
    .map((value, index) => normalizeSchemaPort(value, index, options.fallbackType))
    .filter((value): value is AgentFlowTemplatePort => Boolean(value))
  if (explicitPorts.length > 0) return dedupePorts(explicitPorts)

  const acceptedArtifactTypes = arrayField(record, 'acceptedArtifactTypes')
    .map((value) => mapArtifactTypeToPortKind(value, options.fallbackType))
    .filter((value, index, all) => all.indexOf(value) === index)
    .map((type) => ({ id: type, label: labelPort(type), type }))
  if (acceptedArtifactTypes.length > 0) return acceptedArtifactTypes

  const artifactType =
    record.artifactType ??
    record.outputArtifactType ??
    record.inputArtifactType
  if (artifactType) {
    const type = mapArtifactTypeToPortKind(artifactType, options.fallbackType)
    return [{ id: type, label: labelPort(type), type }]
  }

  return Object.entries(objectOrEmpty(record.properties))
    .map(([propertyName, propertySchema], index) =>
      inferPortFromProperty(propertyName, propertySchema, index, options.fallbackType),
    )
    .filter((value): value is AgentFlowTemplatePort => Boolean(value))
}

function normalizeSchemaPort(
  value: unknown,
  index: number,
  fallbackType: AgentFlowTemplatePortKind,
): AgentFlowTemplatePort | null {
  if (!isRecord(value)) return null
  const type = mapArtifactTypeToPortKind(value.type ?? value.artifactType, fallbackType)
  const id =
    stringField(value, 'key') ||
    stringField(value, 'id') ||
    stringField(value, 'name') ||
    `${type}_${index + 1}`
  const label = stringField(value, 'label') || stringField(value, 'title') || labelPort(type)
  return { id, label, type }
}

function inferPortFromProperty(
  propertyName: string,
  propertySchema: unknown,
  index: number,
  fallbackType: AgentFlowTemplatePortKind,
): AgentFlowTemplatePort {
  const type = inferPortKind(propertyName, propertySchema, fallbackType)
  return {
    id: propertyName || `${type}_${index + 1}`,
    label: propertyName || labelPort(type),
    type,
  }
}

function inferPortKind(
  propertyName: string,
  propertySchema: unknown,
  fallbackType: AgentFlowTemplatePortKind,
): AgentFlowTemplatePortKind {
  const schema = objectOrEmpty(propertySchema)
  const explicitType = schema.artifactType ?? schema.contentType ?? schema.format
  if (explicitType) return mapArtifactTypeToPortKind(explicitType, fallbackType)

  const text = `${propertyName} ${stringField(schema, 'title')} ${stringField(schema, 'description')}`.toLowerCase()

  if (/(video|clip|movie|mp4|mov|mkv|avi|timeline)/.test(text)) return 'video'
  if (/(audio|voice|sound|music|mp3|wav|subtitle|srt)/.test(text)) return 'audio'
  if (/(image|photo|picture|thumbnail|poster|cover|png|jpg|jpeg|webp|screenshot)/.test(text)) return 'image'
  if (/(report|doc|document|file|pdf|markdown|md|txt)/.test(text)) return 'document'
  if (/(code|source|diff|patch|repository|\brepo\b|script)/.test(text)) return 'code'
  if (/(sheet|spreadsheet|csv|xlsx|table)/.test(text)) return 'spreadsheet'
  if (/(json|schema|metadata|structured|data)/.test(text)) return 'structured_data'
  if (/(bundle|folder|directory|zip|archive|files)/.test(text)) return 'file_bundle'

  if (schema.type === 'object' || schema.type === 'array') return 'structured_data'
  return fallbackType
}

function mapArtifactTypeToPortKind(
  value: unknown,
  fallback: AgentFlowTemplatePortKind,
): AgentFlowTemplatePortKind {
  const type = typeof value === 'string' ? value : fallback
  const direct = new Set<LangflowPortKind>([
    'message',
    'prompt',
    'model',
    'tool',
    'memory',
    'code',
    'data',
    'result',
    'document',
    'image',
    'video',
    'audio',
    'report',
    'spreadsheet',
    'file_bundle',
    'structured_data',
  ])
  if (direct.has(type as LangflowPortKind)) return type as LangflowPortKind

  const mapped: Record<string, AgentFlowTemplatePortKind> = {
    json: 'structured_data',
    object: 'structured_data',
    array: 'structured_data',
    browser_state: 'result',
    desktop_result: 'result',
    software_result: 'result',
    approval_decision: 'document',
    any_file: 'file_bundle',
    file: 'file_bundle',
    files: 'file_bundle',
    folder: 'file_bundle',
    text: 'document',
  }
  return mapped[type] ?? fallback
}

function labelPort(type: AgentFlowTemplatePortKind) {
  if (type === 'any') return '任意'
  return LANGFLOW_PORT_KIND_LABELS[type]
}

function dedupePorts(ports: AgentFlowTemplatePort[]): AgentFlowTemplatePort[] {
  const used = new Set<string>()
  return ports.map((port, index) => {
    let id = port.id || `${port.type}_${index + 1}`
    while (used.has(id)) id = `${port.type}_${used.size + 1}`
    used.add(id)
    return { ...port, id }
  })
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

import {
  getNodeOutputPorts,
  type CanvasArtifactType,
} from './agent-canvas-artifacts'
import {
  LANGFLOW_PORT_KIND_LABELS,
  type LangflowPortKind,
} from './langflow-port-contracts'
import type { AgentFlowTemplatePort, AgentFlowTemplatePortKind } from './agent-flow-node-templates'

export interface AgentFlowContractLike {
  name?: string | null
  inputContract?: Record<string, unknown> | null
  outputContract?: Record<string, unknown> | null
}

export function buildAgentFlowPortsFromContracts(agent: AgentFlowContractLike): {
  inputs: AgentFlowTemplatePort[]
  outputs: AgentFlowTemplatePort[]
} {
  const inputs = buildInputPorts(agent.inputContract)
  const outputs = getNodeOutputPorts({
    id: 'agent',
    label: agent.name ?? undefined,
    outputContract: agent.outputContract,
  }).map((port) => ({
    id: port.key,
    label: port.label,
    type: mapCanvasArtifactTypeToLangflowPort(port.type),
  }))

  return {
    inputs: inputs.length > 0 ? inputs : [{ id: 'message', label: '任务输入', type: 'message' }],
    outputs: outputs.length > 0 ? outputs : [{ id: 'artifact', label: agent.name ?? '交付结果', type: 'report' }],
  }
}

function buildInputPorts(inputContract: Record<string, unknown> | null | undefined): AgentFlowTemplatePort[] {
  const record = objectOrEmpty(inputContract)
  const explicitInputs = arrayField(record, 'inputs')
    .map((item, index) => normalizeInputPort(item, index))
    .filter((item): item is AgentFlowTemplatePort => Boolean(item))
  if (explicitInputs.length > 0) return explicitInputs

  return arrayField(record, 'acceptedArtifactTypes')
    .map((value) => mapCanvasArtifactTypeToLangflowPort(value))
    .filter((value, index, all) => all.indexOf(value) === index)
    .map((type) => ({ id: type, label: labelPort(type), type }))
}

function normalizeInputPort(value: unknown, index: number): AgentFlowTemplatePort | null {
  if (!isRecord(value)) return null
  const type = mapCanvasArtifactTypeToLangflowPort(value.type)
  const label = typeof value.label === 'string' && value.label.trim()
    ? value.label.trim()
    : labelPort(type)
  const id = typeof value.key === 'string' && value.key.trim()
    ? value.key.trim()
    : typeof value.id === 'string' && value.id.trim()
      ? value.id.trim()
      : `${type}_${index + 1}`

  return { id, label, type }
}

function mapCanvasArtifactTypeToLangflowPort(value: unknown): AgentFlowTemplatePortKind {
  const type = typeof value === 'string' ? value : 'report'
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

  const mapped: Partial<Record<CanvasArtifactType, AgentFlowTemplatePortKind>> = {
    json: 'structured_data',
    browser_state: 'result',
    desktop_result: 'result',
    software_result: 'result',
    approval_decision: 'document',
    any_file: 'file_bundle',
  }
  return mapped[type as CanvasArtifactType] ?? 'report'
}

function labelPort(type: AgentFlowTemplatePortKind) {
  if (type === 'any') return '任意'
  return LANGFLOW_PORT_KIND_LABELS[type]
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

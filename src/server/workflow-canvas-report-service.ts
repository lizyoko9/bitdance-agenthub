import { asc, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentProfileRow,
  CanvasPosition,
  JsonObject,
  RunStatus,
  WorkflowEdgeRow,
  WorkflowNodeRow,
  WorkflowNodeRunRow,
  WorkflowRow,
  WorkflowRunRow,
} from '@/db/schema'

export type CanvasWorkflowNodeType =
  | 'agent_employee'
  | 'human_approval'
  | 'artifact_transform'
  | 'condition'
  | 'parallel'
  | 'merge'
  | 'software_command'
  | 'cli_command'
  | 'mcp_tool'

export type WorkflowCanvasReadiness = 'ready' | 'needs_configuration' | 'blocked'

export interface WorkflowCanvasNodeReport {
  id: string
  type: string
  knownType: boolean
  position: CanvasPosition
  agentProfile: Pick<AgentProfileRow, 'id' | 'name' | 'role' | 'status'> | null
  inputMappingKeys: string[]
  outputContractKeys: string[]
  resolvedOutputContract: {
    artifactType: string | null
    requiredFiles: string[]
    validationRules: string[]
    source: 'node' | 'agent' | 'none'
  }
  upstreamNodeIds: string[]
  downstreamNodeIds: string[]
  requiresApproval: boolean
  retryConfigured: boolean
  latestRunStatus: RunStatus | null
  latestProgressStatus: string | null
  latestCurrentStep: string | null
  gaps: string[]
  warnings: string[]
}

export interface WorkflowCanvasEdgeReport {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
  targetHandle: string | null
  mappingKeys: string[]
  sourceExists: boolean
  targetExists: boolean
  artifactType: string | null
}

export interface WorkflowCanvasReport {
  workflow: Pick<WorkflowRow, 'id' | 'name' | 'description' | 'status' | 'version'>
  readiness: WorkflowCanvasReadiness
  readinessScore: number
  summary: {
    nodeCount: number
    edgeCount: number
    agentNodeCount: number
    approvalNodeCount: number
    softwareCommandNodeCount: number
    cliCommandNodeCount: number
    mcpToolNodeCount: number
    entryNodeIds: string[]
    terminalNodeIds: string[]
    hasCycle: boolean
    danglingEdgeCount: number
    parallelGroupCount: number
  }
  nodes: WorkflowCanvasNodeReport[]
  edges: WorkflowCanvasEdgeReport[]
  executionPlan: {
    orderedNodeIds: string[]
    parallelGroups: string[][]
    fallbackOrderUsed: boolean
  }
  artifactFlow: Array<{
    sourceNodeId: string
    targetNodeId: string
    artifactType: string | null
    mappingKeys: string[]
  }>
  latestRun: Pick<WorkflowRunRow, 'id' | 'status' | 'startedAt' | 'finishedAt'> | null
  visualization: {
    statusLegend: Record<string, string>
    nodeStatuses: Array<{
      nodeId: string
      status: RunStatus | 'not_run'
      progressStatus: string
      currentStep: string | null
    }>
  }
  gaps: string[]
  warnings: string[]
  recommendations: string[]
  generatedAt: number
}

const KNOWN_NODE_TYPES: CanvasWorkflowNodeType[] = [
  'agent_employee',
  'human_approval',
  'artifact_transform',
  'condition',
  'parallel',
  'merge',
  'software_command',
  'cli_command',
  'mcp_tool',
]

export async function getWorkflowCanvasReport(workflowId: string): Promise<WorkflowCanvasReport> {
  const workflow = await getRequiredWorkflow(workflowId)
  const [nodes, edges, latestRun] = await Promise.all([
    db.query.workflowNodes.findMany({
      where: eq(schema.workflowNodes.workflowId, workflowId),
      orderBy: [asc(schema.workflowNodes.createdAt)],
    }),
    db.query.workflowEdges.findMany({
      where: eq(schema.workflowEdges.workflowId, workflowId),
      orderBy: [asc(schema.workflowEdges.createdAt)],
    }),
    db.query.workflowRuns.findFirst({
      where: eq(schema.workflowRuns.workflowId, workflowId),
      orderBy: [desc(schema.workflowRuns.startedAt)],
    }),
  ])
  const [agents, latestNodeRuns] = await Promise.all([
    listAgentsForNodes(nodes),
    latestRun
      ? db.query.workflowNodeRuns.findMany({
          where: eq(schema.workflowNodeRuns.workflowRunId, latestRun.id),
          orderBy: [asc(schema.workflowNodeRuns.startedAt)],
        })
      : Promise.resolve([]),
  ])
  const agentById = new Map(agents.map((agent) => [agent.id, agent]))
  const nodeRunByNodeId = new Map(latestNodeRuns.map((run) => [run.nodeId, run]))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const validEdges = edges.filter((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId))
  const graph = analyzeGraph(nodes, validEdges)
  const nodeReports = nodes.map((node) =>
    buildNodeReport({
      node,
      agent: node.agentProfileId ? agentById.get(node.agentProfileId) ?? null : null,
      upstreamNodeIds: graph.upstreamByNodeId.get(node.id) ?? [],
      downstreamNodeIds: graph.downstreamByNodeId.get(node.id) ?? [],
      latestNodeRun: nodeRunByNodeId.get(node.id) ?? null,
    }),
  )
  const outputContractByNodeId = new Map(
    nodeReports.map((node) => [node.id, node.resolvedOutputContract]),
  )
  const edgeReports = edges.map((edge) => ({
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    mappingKeys: Object.keys(edge.mapping ?? {}),
    sourceExists: nodeIds.has(edge.sourceNodeId),
    targetExists: nodeIds.has(edge.targetNodeId),
    artifactType:
      readString(edge.mapping?.artifactType) ??
      outputContractByNodeId.get(edge.sourceNodeId)?.artifactType ??
      null,
  }))
  const workflowGaps = buildWorkflowGaps({ nodes, graph, nodeReports, edgeReports })
  const workflowWarnings = buildWorkflowWarnings({ workflow, nodes, graph, nodeReports })
  const recommendations = buildWorkflowRecommendations(workflowGaps, workflowWarnings, graph)
  const readiness = resolveReadiness(workflowGaps)
  return {
    workflow: {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      version: workflow.version,
    },
    readiness,
    readinessScore: scoreReadiness(readiness, workflowGaps, workflowWarnings, nodes),
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      agentNodeCount: nodes.filter((node) => node.type === 'agent_employee').length,
      approvalNodeCount: nodes.filter((node) => node.type === 'human_approval').length,
      softwareCommandNodeCount: nodes.filter((node) => node.type === 'software_command').length,
      cliCommandNodeCount: nodes.filter((node) => node.type === 'cli_command').length,
      mcpToolNodeCount: nodes.filter((node) => node.type === 'mcp_tool').length,
      entryNodeIds: graph.entryNodeIds,
      terminalNodeIds: graph.terminalNodeIds,
      hasCycle: graph.hasCycle,
      danglingEdgeCount: edgeReports.filter((edge) => !edge.sourceExists || !edge.targetExists).length,
      parallelGroupCount: graph.parallelGroups.filter((group) => group.length > 1).length,
    },
    nodes: nodeReports,
    edges: edgeReports,
    executionPlan: {
      orderedNodeIds: graph.orderedNodeIds,
      parallelGroups: graph.parallelGroups,
      fallbackOrderUsed: graph.hasCycle,
    },
    artifactFlow: edgeReports
      .filter((edge) => edge.sourceExists && edge.targetExists)
      .map((edge) => ({
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        artifactType: edge.artifactType,
        mappingKeys: edge.mappingKeys,
      })),
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          startedAt: latestRun.startedAt,
          finishedAt: latestRun.finishedAt,
        }
      : null,
    visualization: {
      statusLegend: {
        queued: 'Waiting to run',
        running: 'Currently executing',
        paused: 'Waiting for approval or resume',
        complete: 'Finished successfully',
        failed: 'Failed',
        aborted: 'Canceled',
        not_run: 'No run data yet',
      },
      nodeStatuses: nodes.map((node) => {
        const run = nodeRunByNodeId.get(node.id)
        return {
          nodeId: node.id,
          status: run?.status ?? 'not_run',
          progressStatus: run?.progressStatus ?? 'not_run',
          currentStep: run?.currentStep ?? null,
        }
      }),
    },
    gaps: workflowGaps,
    warnings: workflowWarnings,
    recommendations,
    generatedAt: Date.now(),
  }
}

async function getRequiredWorkflow(id: string): Promise<WorkflowRow> {
  const workflow = await db.query.workflows.findFirst({ where: eq(schema.workflows.id, id) })
  if (!workflow) throw new Error(`Workflow not found: ${id}`)
  return workflow
}

async function listAgentsForNodes(nodes: WorkflowNodeRow[]): Promise<AgentProfileRow[]> {
  const ids = uniqueStrings(nodes.map((node) => node.agentProfileId ?? ''))
  if (!ids.length) return []
  return db.query.agentProfiles.findMany({
    where: (table, { inArray }) => inArray(table.id, ids),
    orderBy: [asc(schema.agentProfiles.name)],
  })
}

function buildNodeReport(args: {
  node: WorkflowNodeRow
  agent: AgentProfileRow | null
  upstreamNodeIds: string[]
  downstreamNodeIds: string[]
  latestNodeRun: WorkflowNodeRunRow | null
}): WorkflowCanvasNodeReport {
  const knownType = KNOWN_NODE_TYPES.includes(args.node.type as CanvasWorkflowNodeType)
  const resolvedOutputContract = resolveNodeOutputContract(args.node, args.agent)
  const gaps = buildNodeGaps(args.node, args.agent, resolvedOutputContract)
  const warnings = buildNodeWarnings(args.node, args.agent, knownType)
  return {
    id: args.node.id,
    type: args.node.type,
    knownType,
    position: args.node.position,
    agentProfile: args.agent
      ? {
          id: args.agent.id,
          name: args.agent.name,
          role: args.agent.role,
          status: args.agent.status,
        }
      : null,
    inputMappingKeys: Object.keys(args.node.inputMapping ?? {}),
    outputContractKeys: Object.keys(args.node.outputContract ?? {}),
    resolvedOutputContract,
    upstreamNodeIds: args.upstreamNodeIds,
    downstreamNodeIds: args.downstreamNodeIds,
    requiresApproval:
      args.node.type === 'human_approval' ||
      Boolean(args.node.approvalPolicy.requiresApproval) ||
      Boolean(args.node.approvalPolicy.enabled),
    retryConfigured: Object.keys(args.node.retryPolicy ?? {}).length > 0,
    latestRunStatus: args.latestNodeRun?.status ?? null,
    latestProgressStatus: args.latestNodeRun?.progressStatus ?? null,
    latestCurrentStep: args.latestNodeRun?.currentStep ?? null,
    gaps,
    warnings,
  }
}

function resolveNodeOutputContract(
  node: WorkflowNodeRow,
  agent: AgentProfileRow | null,
): WorkflowCanvasNodeReport['resolvedOutputContract'] {
  const nodeContract = asJsonObject(node.outputContract)
  if (Object.keys(nodeContract).length > 0) {
    return summarizeOutputContract(nodeContract, 'node')
  }
  const agentContract = asJsonObject(agent?.outputContract)
  if (Object.keys(agentContract).length > 0) {
    return summarizeOutputContract(agentContract, 'agent')
  }
  return {
    artifactType: null,
    requiredFiles: [],
    validationRules: [],
    source: 'none',
  }
}

function summarizeOutputContract(
  contract: JsonObject,
  source: 'node' | 'agent',
): WorkflowCanvasNodeReport['resolvedOutputContract'] {
  return {
    artifactType: readString(contract.artifactType),
    requiredFiles: arrayOfStrings(contract.requiredFiles),
    validationRules: arrayOfStrings(contract.validationRules),
    source,
  }
}

function buildNodeGaps(
  node: WorkflowNodeRow,
  agent: AgentProfileRow | null,
  resolvedOutputContract: WorkflowCanvasNodeReport['resolvedOutputContract'],
): string[] {
  const gaps: string[] = []
  if (node.type === 'agent_employee') {
    if (!node.agentProfileId) gaps.push('Agent employee node has no agentProfileId.')
    if (node.agentProfileId && !agent) gaps.push(`Agent profile not found: ${node.agentProfileId}.`)
    if (resolvedOutputContract.source === 'none') {
      gaps.push('Agent employee node has no node-level or Agent-level output contract.')
    }
  }
  if (node.type === 'software_command' && !readString(node.config.softwareCommandId)) {
    gaps.push('Software command node is missing config.softwareCommandId.')
  }
  if (node.type === 'cli_command' && !readString(node.config.cliProfileId)) {
    gaps.push('CLI command node is missing config.cliProfileId.')
  }
  if (node.type === 'mcp_tool' && !readString(node.config.mcpToolId)) {
    gaps.push('MCP tool node is missing config.mcpToolId.')
  }
  return gaps
}

function buildNodeWarnings(
  node: WorkflowNodeRow,
  agent: AgentProfileRow | null,
  knownType: boolean,
): string[] {
  const warnings: string[] = []
  if (!knownType) warnings.push(`Unknown Canvas node type: ${node.type}.`)
  if (agent && agent.status !== 'active') {
    warnings.push(`Agent profile "${agent.name}" is ${agent.status}.`)
  }
  if (Object.keys(node.inputMapping ?? {}).length === 0 && node.type !== 'human_approval') {
    warnings.push('Node input mapping is empty; it will receive default workflow/node context.')
  }
  if (node.type === 'condition' && !readString(node.config.expression)) {
    warnings.push('Condition node has no config.expression.')
  }
  if (node.type === 'parallel' && Object.keys(node.config ?? {}).length === 0) {
    warnings.push('Parallel node has no branch metadata yet.')
  }
  return warnings
}

function buildWorkflowGaps(args: {
  nodes: WorkflowNodeRow[]
  graph: ReturnType<typeof analyzeGraph>
  nodeReports: WorkflowCanvasNodeReport[]
  edgeReports: WorkflowCanvasEdgeReport[]
}): string[] {
  const gaps: string[] = []
  if (args.nodes.length === 0) gaps.push('Workflow has no Canvas nodes.')
  if (args.graph.hasCycle) gaps.push('Workflow graph contains a cycle; deterministic execution order is not guaranteed.')
  for (const edge of args.edgeReports) {
    if (!edge.sourceExists || !edge.targetExists) {
      gaps.push(`Workflow edge ${edge.id} references a missing source or target node.`)
    }
  }
  for (const node of args.nodeReports) {
    gaps.push(...node.gaps.map((gap) => `${node.id}: ${gap}`))
  }
  return gaps
}

function buildWorkflowWarnings(args: {
  workflow: WorkflowRow
  nodes: WorkflowNodeRow[]
  graph: ReturnType<typeof analyzeGraph>
  nodeReports: WorkflowCanvasNodeReport[]
}): string[] {
  const warnings: string[] = []
  if (args.workflow.status === 'draft') warnings.push('Workflow is draft; run it as a dry run before production use.')
  if (args.nodes.length > 1 && args.graph.validEdgeCount === 0) {
    warnings.push('Workflow has multiple nodes but no valid edges.')
  }
  if (args.graph.entryNodeIds.length > 1) {
    warnings.push('Workflow has multiple entry nodes; runner may execute independent branches in creation order.')
  }
  if (args.graph.terminalNodeIds.length > 1) {
    warnings.push('Workflow has multiple terminal nodes; add a merge node if downstream consumers need a single artifact.')
  }
  for (const node of args.nodeReports) {
    warnings.push(...node.warnings.map((warning) => `${node.id}: ${warning}`))
  }
  return warnings
}

function buildWorkflowRecommendations(
  gaps: string[],
  warnings: string[],
  graph: ReturnType<typeof analyzeGraph>,
): string[] {
  const recommendations: string[] = []
  if (gaps.some((gap) => gap.includes('output contract'))) {
    recommendations.push('Define output contracts on every Agent employee node or on each bound Agent profile.')
  }
  if (gaps.some((gap) => gap.includes('cycle'))) {
    recommendations.push('Break the cycle or add an explicit loop controller before relying on deterministic execution.')
  }
  if (gaps.some((gap) => gap.includes('missing source or target'))) {
    recommendations.push('Repair dangling edges before running the workflow.')
  }
  if (warnings.some((warning) => warning.includes('multiple entry'))) {
    recommendations.push('Use a parallel node or explicit branch labels when multiple entry nodes are intentional.')
  }
  if (graph.parallelGroups.some((group) => group.length > 1)) {
    recommendations.push('Run workflow preflight before execution so parallel branches can check resource locks and approvals.')
  }
  if (!recommendations.length) {
    recommendations.push('Canvas graph is ready for preflight and execution monitoring.')
  }
  return recommendations
}

function resolveReadiness(gaps: string[]): WorkflowCanvasReadiness {
  if (gaps.some((gap) => gap.includes('missing source or target') || gap.includes('cycle'))) {
    return 'blocked'
  }
  return gaps.length ? 'needs_configuration' : 'ready'
}

function scoreReadiness(
  readiness: WorkflowCanvasReadiness,
  gaps: string[],
  warnings: string[],
  nodes: WorkflowNodeRow[],
): number {
  if (readiness === 'blocked') return Math.max(0, 55 - gaps.length * 10)
  const contractCoverage = nodes.length === 0
    ? 0
    : nodes.filter((node) => Object.keys(node.outputContract ?? {}).length > 0 || node.type !== 'agent_employee').length / nodes.length
  const base = readiness === 'ready' ? 90 : 75
  return Math.max(0, Math.min(100, Math.round(base + contractCoverage * 10 - gaps.length * 8 - warnings.length * 2)))
}

function analyzeGraph(nodes: WorkflowNodeRow[], edges: WorkflowEdgeRow[]) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const upstreamByNodeId = new Map(nodes.map((node) => [node.id, [] as string[]]))
  const downstreamByNodeId = new Map(nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) continue
    downstreamByNodeId.get(edge.sourceNodeId)?.push(edge.targetNodeId)
    upstreamByNodeId.get(edge.targetNodeId)?.push(edge.sourceNodeId)
  }

  const indegree = new Map(nodes.map((node) => [node.id, upstreamByNodeId.get(node.id)?.length ?? 0]))
  const orderedNodeIds: string[] = []
  const parallelGroups: string[][] = []
  let frontier = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  while (frontier.length > 0) {
    parallelGroups.push(frontier)
    const nextFrontier: string[] = []
    for (const nodeId of frontier) {
      orderedNodeIds.push(nodeId)
      for (const targetId of downstreamByNodeId.get(nodeId) ?? []) {
        const next = (indegree.get(targetId) ?? 0) - 1
        indegree.set(targetId, next)
        if (next === 0) nextFrontier.push(targetId)
      }
    }
    frontier = nextFrontier
  }
  const hasCycle = orderedNodeIds.length < nodes.length
  const fallbackOrderedNodeIds = hasCycle ? nodes.map((node) => node.id) : orderedNodeIds
  return {
    upstreamByNodeId,
    downstreamByNodeId,
    orderedNodeIds: fallbackOrderedNodeIds,
    parallelGroups: hasCycle ? [fallbackOrderedNodeIds] : parallelGroups,
    entryNodeIds: nodes.filter((node) => (upstreamByNodeId.get(node.id)?.length ?? 0) === 0).map((node) => node.id),
    terminalNodeIds: nodes.filter((node) => (downstreamByNodeId.get(node.id)?.length ?? 0) === 0).map((node) => node.id),
    hasCycle,
    validEdgeCount: edges.length,
  }
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

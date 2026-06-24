import { and, asc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentProfileRow,
  ApprovalRequestRow,
  EmployeeRunRow,
  JsonObject,
  RiskLevel,
  ResourceLockRow,
  ResourceType,
  RunStatus,
  WorkflowEdgeRow,
  WorkflowNodeRunRow,
  WorkflowNodeRow,
  WorkflowRunRow,
} from '@/db/schema'
import { startEmployeeRun } from '@/server/employee-runtime-service'
import { newApprovalRequestId } from '@/server/ids'
import {
  acquireResourceLock,
  releaseResourceLocks,
} from '@/server/resource-lock-service'
import { runSoftwareCommand } from '@/server/software-adapter-service'

interface NodeExecutionResult {
  status: RunStatus
  output: JsonObject | null
  error: string | null
}

export async function executeWorkflowRun(
  workflowRunId: string,
  options: { resume?: boolean } = {},
): Promise<WorkflowRunRow> {
  const run = await getRequiredWorkflowRun(workflowRunId)
  if (['complete', 'failed', 'aborted'].includes(run.status)) return run
  if (run.status === 'paused' && !options.resume) return run

  const [nodes, edges] = await Promise.all([
    db.query.workflowNodes.findMany({
      where: eq(schema.workflowNodes.workflowId, run.workflowId),
      orderBy: [asc(schema.workflowNodes.createdAt)],
    }),
    db.query.workflowEdges.findMany({
      where: eq(schema.workflowEdges.workflowId, run.workflowId),
      orderBy: [asc(schema.workflowEdges.createdAt)],
    }),
  ])

  await updateWorkflowRun(workflowRunId, { status: 'running', error: null })

  const orderedNodes = orderNodesForExecution(nodes, edges)
  const outputsByNodeId: Record<string, JsonObject> = {}

  for (const node of orderedNodes) {
    const nodeRun = await getRequiredNodeRun(workflowRunId, node.id)
    if (nodeRun.status === 'complete') {
      if (nodeRun.output) outputsByNodeId[node.id] = nodeRun.output
      continue
    }

    if (nodeRun.status === 'failed' || nodeRun.status === 'aborted') {
      return finishWorkflowRun(workflowRunId, 'failed', outputsByNodeId, nodeRun.error)
    }

    if (nodeRun.status === 'paused') {
      return getRequiredWorkflowRun(workflowRunId)
    }

    await updateNodeRun(nodeRun.id, {
      status: 'running',
      progressStatus: 'running',
      currentStep: `Executing ${node.type}`,
      error: null,
    })

    const upstreamOutputs = routedUpstreamOutputsForNode(node.id, edges, outputsByNodeId)
    const result = await executeNodeSafely(run, node, nodeRun, upstreamOutputs)
    if (result.status === 'paused') {
      const approval = await createWorkflowApprovalRequest(run, node, nodeRun, result)
      result.output = {
        ...(result.output ?? {}),
        approvalRequestId: approval.id,
      }
    }

    await updateNodeRun(nodeRun.id, {
      status: result.status,
      progressStatus: result.status === 'paused' ? 'waiting_for_approval' : result.status,
      currentStep: currentStepForResult(node, result),
      output: result.output,
      error: result.error,
      finishedAt: result.status === 'running' || result.status === 'paused' ? null : Date.now(),
    })

    if (result.output) outputsByNodeId[node.id] = result.output

    if (result.status === 'failed') {
      return finishWorkflowRun(workflowRunId, 'failed', outputsByNodeId, result.error)
    }

    if (result.status === 'paused') {
      await updateWorkflowRun(workflowRunId, {
        status: 'paused',
        output: {
          pausedAtNodeId: node.id,
          reason: result.error ?? 'Waiting for human approval.',
          nodeOutputs: outputsByNodeId,
        },
        error: null,
      })
      return getRequiredWorkflowRun(workflowRunId)
    }
  }

  return finishWorkflowRun(workflowRunId, 'complete', outputsByNodeId, null)
}

export async function resolveWorkflowApprovalRequest(
  approvalRequest: ApprovalRequestRow,
): Promise<WorkflowRunRow | null> {
  if (
    approvalRequest.type !== 'workflow_human_approval' ||
    !approvalRequest.runId ||
    !approvalRequest.nodeRunId
  ) {
    return null
  }

  const nodeRun = await getRequiredNodeRunById(approvalRequest.nodeRunId)
  if (approvalRequest.status === 'rejected') {
    await updateNodeRun(nodeRun.id, {
      status: 'failed',
      progressStatus: 'approval_rejected',
      currentStep: 'Human approval rejected.',
      output: {
        ...(nodeRun.output ?? {}),
        approvalRequestId: approvalRequest.id,
        approved: false,
        response: approvalRequest.response ?? {},
      },
      error: 'Human approval rejected.',
      finishedAt: Date.now(),
    })
    await updateWorkflowRun(approvalRequest.runId, {
      status: 'failed',
      error: 'Human approval rejected.',
      output: {
        approvalRequestId: approvalRequest.id,
        rejectedNodeRunId: nodeRun.id,
        response: approvalRequest.response ?? {},
      },
      finishedAt: Date.now(),
    })
    return getRequiredWorkflowRun(approvalRequest.runId)
  }

  if (approvalRequest.status !== 'approved') return null

  await updateNodeRun(nodeRun.id, {
    status: 'complete',
    progressStatus: 'approval_approved',
    currentStep: 'Human approval approved.',
    output: {
      ...(nodeRun.output ?? {}),
      approvalRequestId: approvalRequest.id,
      approved: true,
      response: approvalRequest.response ?? {},
    },
    error: null,
    finishedAt: Date.now(),
  })

  await updateWorkflowRun(approvalRequest.runId, {
    status: 'running',
    error: null,
  })

  return executeWorkflowRun(approvalRequest.runId, { resume: true })
}

async function executeNode(
  workflowRun: WorkflowRunRow,
  node: WorkflowNodeRow,
  nodeRun: WorkflowNodeRunRow,
  upstreamOutputs: Record<string, JsonObject>,
): Promise<NodeExecutionResult> {
  if (node.type === 'agent_employee') {
    if (!node.agentProfileId) {
      return {
        status: 'failed',
        output: null,
        error: 'Agent employee node requires agentProfileId.',
      }
    }

    return executeAgentNodeWithLocks(workflowRun, node, upstreamOutputs)
  }

  if (node.type === 'human_approval') {
    return {
      status: 'paused',
      output: {
        approvalRequired: true,
        approvalPolicy: node.approvalPolicy,
        upstreamOutputs: cloneJsonObject(upstreamOutputs),
      },
      error: 'Human approval is required before downstream nodes run.',
    }
  }

  if (node.type === 'software_command') {
    return executeSoftwareCommandNode(workflowRun, node, nodeRun, upstreamOutputs)
  }

  return {
    status: 'complete',
    output: {
      passthrough: true,
      nodeType: node.type,
      upstreamOutputs: cloneJsonObject(upstreamOutputs),
    },
    error: null,
  }
}

async function executeNodeSafely(
  workflowRun: WorkflowRunRow,
  node: WorkflowNodeRow,
  nodeRun: WorkflowNodeRunRow,
  upstreamOutputs: Record<string, JsonObject>,
): Promise<NodeExecutionResult> {
  try {
    return await executeNode(workflowRun, node, nodeRun, upstreamOutputs)
  } catch (err) {
    return {
      status: 'failed',
      output: null,
      error: formatError(err),
    }
  }
}

async function executeSoftwareCommandNode(
  workflowRun: WorkflowRunRow,
  node: WorkflowNodeRow,
  nodeRun: WorkflowNodeRunRow,
  upstreamOutputs: Record<string, JsonObject>,
): Promise<NodeExecutionResult> {
  const softwareCommandId = getString(node.config, 'softwareCommandId')
  if (!softwareCommandId) {
    return {
      status: 'failed',
      output: null,
      error: 'Software command node requires config.softwareCommandId.',
    }
  }

  const softwareCommandRun = await runSoftwareCommand({
    softwareCommandId,
    workflowRunId: workflowRun.id,
    workflowNodeRunId: nodeRun.id,
    input: {
      workflowRunId: workflowRun.id,
      workflowInput: workflowRun.input,
      nodeId: node.id,
      nodeConfig: node.config,
      upstreamOutputs,
    },
    mode: 'dry_run',
  })

  const ok = softwareCommandRun.status === 'planned' || softwareCommandRun.status === 'complete'
  return {
    status: ok ? 'complete' : 'failed',
    output: {
      softwareCommandRunId: softwareCommandRun.id,
      softwareCommandRunStatus: softwareCommandRun.status,
      softwareCommandId,
      softwareCommandOutput: softwareCommandRun.output,
      upstreamOutputs: cloneJsonObject(upstreamOutputs),
    },
    error: softwareCommandRun.error,
  }
}

export async function listWorkflowEmployeeRuns(workflowRunId: string): Promise<EmployeeRunRow[]> {
  return db.query.employeeRuns.findMany({
    where: eq(schema.employeeRuns.workflowRunId, workflowRunId),
    orderBy: [asc(schema.employeeRuns.createdAt)],
  })
}

async function executeAgentNodeWithLocks(
  workflowRun: WorkflowRunRow,
  node: WorkflowNodeRow,
  upstreamOutputs: Record<string, JsonObject>,
): Promise<NodeExecutionResult> {
  const agent = await getRequiredAgentProfile(node.agentProfileId)
  const locks = await acquireRequiredLocks(workflowRun, node, agent)
  try {
    const employeeRun = await startEmployeeRun({
      agentProfileId: agent.id,
      workflowRunId: workflowRun.id,
      goal: deriveNodeGoal(workflowRun, node),
      input: {
        workflowRunId: workflowRun.id,
        workflowInput: workflowRun.input,
        nodeId: node.id,
        upstreamOutputs,
        acquiredResourceLocks: locks.map(lockSummary),
      },
      autoComplete: true,
    })
    const releasedLocks = await releaseResourceLocks(locks.map((lock) => lock.id))

    return {
      status: employeeRun.status,
      output: {
        employeeRunId: employeeRun.id,
        employeeRunStatus: employeeRun.status,
        employeeRunOutput: employeeRun.output,
        agentProfileId: agent.id,
        resourceLocks: releasedLocks.map(lockSummary),
      },
      error: employeeRun.error,
    }
  } catch (err) {
    const releasedLocks = await releaseResourceLocks(locks.map((lock) => lock.id))
    return {
      status: 'failed',
      output: {
        agentProfileId: agent.id,
        resourceLocks: releasedLocks.map(lockSummary),
      },
      error: formatError(err),
    }
  }
}

async function acquireRequiredLocks(
  workflowRun: WorkflowRunRow,
  node: WorkflowNodeRow,
  agent: AgentProfileRow,
): Promise<ResourceLockRow[]> {
  const required = requiredLocksForAgent(agent)
  const acquired: ResourceLockRow[] = []
  try {
    for (const requirement of required) {
      acquired.push(
        await acquireResourceLock({
          resourceType: requirement.resourceType,
          resourceId: requirement.resourceId,
          ownerRunId: workflowRun.id,
          ownerAgentId: agent.id,
          ttlMs: requirement.ttlMs,
        }),
      )
    }
    return acquired
  } catch (err) {
    await releaseResourceLocks(acquired.map((lock) => lock.id))
    throw new Error(`Failed to acquire resource locks for node ${node.id}: ${formatError(err)}`)
  }
}

function requiredLocksForAgent(agent: AgentProfileRow): Array<{
  resourceType: ResourceType
  resourceId: string
  ttlMs?: number
}> {
  const locks: Array<{ resourceType: ResourceType; resourceId: string; ttlMs?: number }> = [
    {
      resourceType: 'workspace_path',
      resourceId: `agent:${agent.id}:workspace`,
    },
  ]

  const workstationMode = getString(agent.workstationPolicy, 'mode')
  const canUseBrowser = getBooleanPath(agent.permissionPolicy, ['browser', 'operate'])
    ?? getBooleanPath(agent.permissionPolicy, ['canUseBrowser'])
  const canUseDesktop = getBooleanPath(agent.permissionPolicy, ['desktop', 'operate'])
    ?? getBooleanPath(agent.permissionPolicy, ['canUseDesktop'])

  if (workstationMode === 'browser_context' || canUseBrowser) {
    locks.push({
      resourceType: 'browser_profile',
      resourceId: `agent:${agent.id}:browser`,
    })
  }

  if (workstationMode === 'physical_desktop' || canUseDesktop) {
    locks.push({
      resourceType: 'physical_mouse_keyboard',
      resourceId: 'default',
    })
  }

  for (const softwareProfileId of agent.softwareProfileIds) {
    locks.push({
      resourceType: 'software_instance',
      resourceId: `software:${softwareProfileId}`,
    })
  }

  return dedupeLockRequirements(locks)
}

function dedupeLockRequirements<T extends { resourceType: ResourceType; resourceId: string }>(
  locks: T[],
): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const lock of locks) {
    const key = `${lock.resourceType}:${lock.resourceId}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(lock)
  }
  return unique
}

async function getRequiredAgentProfile(agentProfileId: string | null): Promise<AgentProfileRow> {
  if (!agentProfileId) throw new Error('Agent employee node requires agentProfileId.')
  const agent = await db.query.agentProfiles.findFirst({
    where: eq(schema.agentProfiles.id, agentProfileId),
  })
  if (!agent) throw new Error(`Agent profile not found: ${agentProfileId}`)
  return agent
}

async function finishWorkflowRun(
  workflowRunId: string,
  status: Extract<RunStatus, 'complete' | 'failed'>,
  nodeOutputs: Record<string, JsonObject>,
  error: string | null,
): Promise<WorkflowRunRow> {
  await updateWorkflowRun(workflowRunId, {
    status,
    output: { nodeOutputs },
    error,
    finishedAt: Date.now(),
  })
  return getRequiredWorkflowRun(workflowRunId)
}

async function getRequiredWorkflowRun(workflowRunId: string): Promise<WorkflowRunRow> {
  const run = await db.query.workflowRuns.findFirst({
    where: eq(schema.workflowRuns.id, workflowRunId),
  })
  if (!run) throw new Error(`Workflow run not found: ${workflowRunId}`)
  return run
}

async function getRequiredNodeRun(
  workflowRunId: string,
  nodeId: string,
): Promise<WorkflowNodeRunRow> {
  const nodeRun = await db.query.workflowNodeRuns.findFirst({
    where: (row, { and }) =>
      and(eq(row.workflowRunId, workflowRunId), eq(row.nodeId, nodeId)),
  })
  if (!nodeRun) throw new Error(`Workflow node run not found: ${workflowRunId}:${nodeId}`)
  return nodeRun
}

async function getRequiredNodeRunById(nodeRunId: string): Promise<WorkflowNodeRunRow> {
  const nodeRun = await db.query.workflowNodeRuns.findFirst({
    where: eq(schema.workflowNodeRuns.id, nodeRunId),
  })
  if (!nodeRun) throw new Error(`Workflow node run not found: ${nodeRunId}`)
  return nodeRun
}

async function createWorkflowApprovalRequest(
  workflowRun: WorkflowRunRow,
  node: WorkflowNodeRow,
  nodeRun: WorkflowNodeRunRow,
  result: NodeExecutionResult,
): Promise<ApprovalRequestRow> {
  const existing = await db.query.approvalRequests.findFirst({
    where: and(
      eq(schema.approvalRequests.nodeRunId, nodeRun.id),
      eq(schema.approvalRequests.status, 'pending'),
    ),
  })
  if (existing) return existing

  const now = Date.now()
  const row: ApprovalRequestRow = {
    id: newApprovalRequestId(),
    conversationId: null,
    runId: workflowRun.id,
    nodeRunId: nodeRun.id,
    agentProfileId: node.agentProfileId,
    type: 'workflow_human_approval',
    status: 'pending',
    title: `Approve workflow node ${node.id}`,
    description: result.error ?? 'Human approval is required before the workflow can continue.',
    riskLevel: approvalRiskLevel(node.approvalPolicy),
    payload: {
      workflowId: workflowRun.workflowId,
      workflowRunId: workflowRun.id,
      nodeId: node.id,
      nodeType: node.type,
      nodeOutput: result.output ?? {},
    },
    response: null,
    createdAt: now,
    resolvedAt: null,
  }
  await db.insert(schema.approvalRequests).values(row)
  return row
}

async function updateWorkflowRun(
  workflowRunId: string,
  patch: Partial<WorkflowRunRow>,
): Promise<void> {
  await db.update(schema.workflowRuns).set(patch).where(eq(schema.workflowRuns.id, workflowRunId))
}

async function updateNodeRun(
  nodeRunId: string,
  patch: Partial<typeof schema.workflowNodeRuns.$inferSelect>,
): Promise<void> {
  await db.update(schema.workflowNodeRuns).set(patch).where(eq(schema.workflowNodeRuns.id, nodeRunId))
}

function orderNodesForExecution(
  nodes: WorkflowNodeRow[],
  edges: WorkflowEdgeRow[],
): WorkflowNodeRow[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()

  for (const edge of edges) {
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) continue
    outgoing.set(edge.sourceNodeId, [...(outgoing.get(edge.sourceNodeId) ?? []), edge.targetNodeId])
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1)
  }

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0)
  const ordered: WorkflowNodeRow[] = []

  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) break
    ordered.push(node)
    for (const targetId of outgoing.get(node.id) ?? []) {
      const nextDegree = (indegree.get(targetId) ?? 0) - 1
      indegree.set(targetId, nextDegree)
      if (nextDegree === 0) {
        const target = nodeById.get(targetId)
        if (target) queue.push(target)
      }
    }
  }

  if (ordered.length === nodes.length) return ordered
  const orderedIds = new Set(ordered.map((node) => node.id))
  return [...ordered, ...nodes.filter((node) => !orderedIds.has(node.id))]
}

function deriveNodeGoal(workflowRun: WorkflowRunRow, node: WorkflowNodeRow): string {
  const inputGoal = getString(workflowRun.input, 'goal')
  const nodeGoal = getString(node.config, 'goal')
  return nodeGoal ?? inputGoal ?? `Complete workflow node ${node.id}.`
}

function currentStepForResult(node: WorkflowNodeRow, result: NodeExecutionResult): string {
  if (result.status === 'complete') return `${node.type} completed.`
  if (result.status === 'paused') return 'Waiting for human approval.'
  if (result.status === 'failed') return result.error ?? `${node.type} failed.`
  return `${node.type} ${result.status}.`
}

function getString(obj: JsonObject, key: string): string | null {
  const value = obj[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cloneJsonObject(value: Record<string, JsonObject>): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

function routedUpstreamOutputsForNode(
  targetNodeId: string,
  edges: WorkflowEdgeRow[],
  outputsByNodeId: Record<string, JsonObject>,
): Record<string, JsonObject> {
  const routed: Record<string, JsonObject> = {}
  for (const edge of edges) {
    if (edge.targetNodeId !== targetNodeId) continue
    const sourceOutput = outputsByNodeId[edge.sourceNodeId]
    if (!sourceOutput) continue
    const outputKey = getString(edge.mapping, 'outputKey')
    const artifactType = getString(edge.mapping, 'artifactType')
    const targetInputKey = getString(edge.mapping, 'targetInputKey') ?? outputKey ?? 'upstreamOutput'
    if (!outputKey) {
      routed[edge.sourceNodeId] = JSON.parse(JSON.stringify(sourceOutput)) as JsonObject
      continue
    }
    routed[edge.sourceNodeId] = {
      sourceNodeId: edge.sourceNodeId,
      edgeId: edge.id,
      outputKey,
      artifactType,
      targetInputKey,
      artifactOnly: true,
      selectedArtifact: selectOutputArtifact(sourceOutput, outputKey, artifactType),
      mapping: edge.mapping,
    }
  }
  return routed
}

function selectOutputArtifact(
  sourceOutput: JsonObject,
  outputKey: string,
  artifactType: string | null,
): JsonObject {
  const directOutput = asRecord(sourceOutput[outputKey])
  const employeeOutput = asRecord(sourceOutput.employeeRunOutput)
  const softwareOutput = asRecord(sourceOutput.softwareCommandOutput)
  const outputArtifacts = {
    ...asStringRecord(sourceOutput.outputArtifacts),
    ...asStringRecord(employeeOutput.outputArtifacts),
    ...asStringRecord(softwareOutput.outputArtifacts),
  }
  const artifactId = outputArtifacts[outputKey] ?? null
  return {
    outputKey,
    artifactType,
    artifactId,
    value: Object.keys(directOutput).length > 0 ? directOutput : null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value)
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function getBooleanPath(obj: JsonObject, path: string[]): boolean | null {
  let current: unknown = obj
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'boolean' ? current : null
}

function lockSummary(lock: ResourceLockRow): JsonObject {
  return {
    id: lock.id,
    resourceType: lock.resourceType,
    resourceId: lock.resourceId,
    status: lock.status,
    ownerRunId: lock.ownerRunId,
    ownerAgentId: lock.ownerAgentId,
    createdAt: lock.createdAt,
    releasedAt: lock.releasedAt,
  }
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function approvalRiskLevel(policy: JsonObject): RiskLevel {
  const riskLevel = policy.riskLevel
  return riskLevel === 'low' || riskLevel === 'medium' || riskLevel === 'high'
    ? riskLevel
    : 'medium'
}

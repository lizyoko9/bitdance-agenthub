import { spawnSync } from 'node:child_process'

import { and, asc, desc, eq, inArray } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentPersona,
  AgentPersonaTone,
  AgentProfileRow,
  ArtifactValidationRow,
  ApprovalRequestRow,
  ComputerActionEventRow,
  ComputerSessionRow,
  CliProfileRow,
  EmployeeRunRow,
  HealthStatus,
  JsonObject,
  McpServerRow,
  MemoryItemRow,
  MemoryPrivacyDataType,
  MemoryPrivacyEncryption,
  MemoryPrivacyReadAccess,
  MemoryPrivacyWriteAccess,
  ModelProfileRow,
  NetworkProfileRow,
  ResourceLockRow,
  RunReflectionRow,
  SkillRow,
  SoftwareCommandRunRow,
  SoftwareCommandRow,
  SoftwareProfileRow,
  ToolConnectionRow,
  WorkflowEdgeRow,
  WorkflowNodeRow,
  WorkflowNodeRunRow,
  WorkflowRow,
  WorkflowRunRow,
} from '@/db/schema'
import {
  buildWorkflowNodeBrainStatuses,
  type WorkflowNodeBrainStatus,
} from '@/lib/workflow-node-brain-status'
import {
  buildWorkflowRunArtifactHandoffs,
  type WorkflowRunArtifactHandoff,
} from '@/server/workflow-run-artifact-handoffs'
import {
  buildWorkflowRunDeliveryPackage,
  type WorkflowRunDeliveryPackage,
} from '@/server/workflow-run-delivery-package'
import {
  newAgentProfileId,
  newAgentWorkstationId,
  newApprovalRequestId,
  newCliProfileId,
  newMcpServerId,
  newMemoryItemId,
  newModelProfileId,
  newNetworkProfileId,
  newRunReflectionId,
  newSoftwareCommandId,
  newSoftwareProfileId,
  newToolConnectionId,
  newWorkflowEdgeId,
  newWorkflowId,
  newWorkflowNodeId,
  newWorkflowNodeRunId,
  newWorkflowRunId,
} from '@/server/ids'
import { ensureAgentProbationRecord } from '@/server/agent-probation-service'
import {
  executeWorkflowRun,
  listWorkflowEmployeeRuns,
  resolveWorkflowApprovalRequest,
} from '@/server/workflow-runner-service'
import {
  acquireResourceLock,
  expireResourceLocks,
  listResourceLocksForRun,
  releaseResourceLock,
} from '@/server/resource-lock-service'
import { listSoftwareCommandRunsForWorkflowRun } from '@/server/software-adapter-service'
import { listArtifactValidationsForRun } from '@/server/verification-service'
import {
  listComputerActionEventsForWorkflowRun,
  listComputerSessionsForWorkflowRun,
} from '@/server/computer-session-manager'
export type { AcquireResourceLockArgs } from '@/server/resource-lock-service'
export {
  acquireResourceLock,
  expireResourceLocks,
  listResourceLocksForRun,
  releaseResourceLock,
}

export interface TestResult {
  status: Exclude<HealthStatus, 'unknown'>
  message: string
  checkedAt: number
}

export interface CreateNetworkProfileArgs {
  name: string
  mode?: NetworkProfileRow['mode']
  proxyUrl?: string | null
  bindInterface?: string | null
  regionLabel?: string | null
  appliesTo?: NetworkProfileRow['appliesTo']
}

export async function createNetworkProfile(args: CreateNetworkProfileArgs): Promise<NetworkProfileRow> {
  const now = Date.now()
  const row = {
    id: newNetworkProfileId(),
    name: args.name.trim(),
    mode: args.mode ?? 'direct',
    proxyUrl: normalizeNullable(args.proxyUrl),
    bindInterface: normalizeNullable(args.bindInterface),
    regionLabel: normalizeNullable(args.regionLabel),
    appliesTo: args.appliesTo ?? 'model_only',
    healthStatus: 'unknown' as const,
    lastTestResult: null,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.networkProfiles).values(row)
  return row
}

export async function listNetworkProfiles(): Promise<NetworkProfileRow[]> {
  return db.query.networkProfiles.findMany({ orderBy: [desc(schema.networkProfiles.createdAt)] })
}

export async function testNetworkProfile(id: string): Promise<TestResult> {
  const profile = await getRequiredNetworkProfile(id)
  const checkedAt = Date.now()
  const proxyRequired = profile.mode !== 'direct'
  const ok = !proxyRequired || Boolean(profile.proxyUrl || profile.bindInterface)
  const result: TestResult = {
    status: ok ? 'ok' : 'failed',
    message: ok
      ? 'Network profile configuration is usable.'
      : 'Proxy or gateway mode requires proxyUrl or bindInterface.',
    checkedAt,
  }
  await db
    .update(schema.networkProfiles)
    .set({
      healthStatus: result.status,
      lastTestResult: result.message,
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(schema.networkProfiles.id, id))
  return result
}

async function getRequiredNetworkProfile(id: string): Promise<NetworkProfileRow> {
  const row = await db.query.networkProfiles.findFirst({
    where: eq(schema.networkProfiles.id, id),
  })
  if (!row) throw new Error(`Network profile not found: ${id}`)
  return row
}

export interface CreateModelProfileArgs {
  name: string
  provider: ModelProfileRow['provider']
  baseUrl: string
  apiKeyRef: string
  model: string
  contextWindow?: number | null
  supportsVision?: boolean
  supportsToolCalling?: boolean
  supportsJsonMode?: boolean
  networkProfileId?: string | null
}

export type UpdateModelProfileArgs = CreateModelProfileArgs

export async function createModelProfile(args: CreateModelProfileArgs): Promise<ModelProfileRow> {
  const now = Date.now()
  const row = {
    id: newModelProfileId(),
    name: args.name.trim(),
    provider: args.provider,
    baseUrl: args.baseUrl.trim(),
    apiKeyRef: args.apiKeyRef.trim(),
    model: args.model.trim(),
    contextWindow: args.contextWindow ?? null,
    supportsVision: args.supportsVision ?? false,
    supportsToolCalling: args.supportsToolCalling ?? false,
    supportsJsonMode: args.supportsJsonMode ?? false,
    networkProfileId: normalizeNullable(args.networkProfileId),
    healthStatus: 'unknown' as const,
    lastTestResult: null,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.modelProfiles).values(row)
  return row
}

export async function listModelProfiles(): Promise<ModelProfileRow[]> {
  return db.query.modelProfiles.findMany({ orderBy: [desc(schema.modelProfiles.createdAt)] })
}

export async function updateModelProfile(
  id: string,
  args: UpdateModelProfileArgs,
): Promise<ModelProfileRow> {
  const existing = await getRequiredModelProfile(id)
  const now = Date.now()
  const nextNetworkProfileId = normalizeNullable(args.networkProfileId)
  const connectionRelevantUnchanged =
    existing.provider === args.provider &&
    existing.baseUrl === args.baseUrl.trim() &&
    existing.apiKeyRef === args.apiKeyRef.trim() &&
    existing.model === args.model.trim() &&
    existing.networkProfileId === nextNetworkProfileId &&
    existing.supportsVision === (args.supportsVision ?? false) &&
    existing.supportsToolCalling === (args.supportsToolCalling ?? false) &&
    existing.supportsJsonMode === (args.supportsJsonMode ?? false)

  await db
    .update(schema.modelProfiles)
    .set({
      name: args.name.trim(),
      provider: args.provider,
      baseUrl: args.baseUrl.trim(),
      apiKeyRef: args.apiKeyRef.trim(),
      model: args.model.trim(),
      contextWindow: args.contextWindow ?? null,
      supportsVision: args.supportsVision ?? false,
      supportsToolCalling: args.supportsToolCalling ?? false,
      supportsJsonMode: args.supportsJsonMode ?? false,
      networkProfileId: nextNetworkProfileId,
      healthStatus: connectionRelevantUnchanged ? existing.healthStatus : 'unknown',
      lastTestResult: connectionRelevantUnchanged
        ? existing.lastTestResult
        : 'Model profile changed; run a connection test again.',
      lastCheckedAt: connectionRelevantUnchanged ? existing.lastCheckedAt : null,
      updatedAt: now,
    })
    .where(eq(schema.modelProfiles.id, id))

  return getRequiredModelProfile(id)
}

export async function deleteModelProfile(id: string): Promise<void> {
  const profile = await getRequiredModelProfile(id)
  const now = Date.now()

  const agents = await db.query.agentProfiles.findMany()
  for (const agent of agents) {
    const nextFallbacks = agent.fallbackModelProfileIds.filter((modelId) => modelId !== profile.id)
    if (agent.modelProfileId !== profile.id && nextFallbacks.length === agent.fallbackModelProfileIds.length) {
      continue
    }
    await db
      .update(schema.agentProfiles)
      .set({
        modelProfileId: agent.modelProfileId === profile.id ? null : agent.modelProfileId,
        fallbackModelProfileIds: nextFallbacks,
        updatedAt: now,
      })
      .where(eq(schema.agentProfiles.id, agent.id))
  }

  const routeDecisions = await db.query.modelRouteDecisions.findMany()
  for (const decision of routeDecisions) {
    const nextFallbacks = decision.fallbackModelProfileIds.filter((modelId) => modelId !== profile.id)
    if (
      decision.selectedModelProfileId !== profile.id &&
      nextFallbacks.length === decision.fallbackModelProfileIds.length
    ) {
      continue
    }
    await db
      .update(schema.modelRouteDecisions)
      .set({
        selectedModelProfileId:
          decision.selectedModelProfileId === profile.id ? null : decision.selectedModelProfileId,
        fallbackModelProfileIds: nextFallbacks,
      })
      .where(eq(schema.modelRouteDecisions.id, decision.id))
  }

  await Promise.all([
    db
      .update(schema.conversations)
      .set({ modelProfileId: null })
      .where(eq(schema.conversations.modelProfileId, profile.id)),
    db
      .update(schema.modelConnectionTests)
      .set({ modelProfileId: null })
      .where(eq(schema.modelConnectionTests.modelProfileId, profile.id)),
    db
      .update(schema.projectContexts)
      .set({ modelProfileId: null, updatedAt: now })
      .where(eq(schema.projectContexts.modelProfileId, profile.id)),
    db
      .update(schema.promptDriftMonitors)
      .set({ modelProfileId: null, updatedAt: now })
      .where(eq(schema.promptDriftMonitors.modelProfileId, profile.id)),
    db
      .update(schema.modelBehaviorSnapshots)
      .set({ modelProfileId: null })
      .where(eq(schema.modelBehaviorSnapshots.modelProfileId, profile.id)),
    db
      .update(schema.dualModelVerifications)
      .set({ primaryModelProfileId: null })
      .where(eq(schema.dualModelVerifications.primaryModelProfileId, profile.id)),
    db
      .update(schema.dualModelVerifications)
      .set({ secondaryModelProfileId: null })
      .where(eq(schema.dualModelVerifications.secondaryModelProfileId, profile.id)),
    db
      .update(schema.budgetEvaluations)
      .set({ selectedModelProfileId: null })
      .where(eq(schema.budgetEvaluations.selectedModelProfileId, profile.id)),
    db
      .update(schema.budgetEvaluations)
      .set({ routedModelProfileId: null })
      .where(eq(schema.budgetEvaluations.routedModelProfileId, profile.id)),
    db
      .update(schema.modelResponseCacheEntries)
      .set({ modelProfileId: null, updatedAt: now })
      .where(eq(schema.modelResponseCacheEntries.modelProfileId, profile.id)),
    db
      .update(schema.modelWarmupSessions)
      .set({ modelProfileId: null })
      .where(eq(schema.modelWarmupSessions.modelProfileId, profile.id)),
  ])

  await db.delete(schema.modelProfiles).where(eq(schema.modelProfiles.id, profile.id))
}

export async function testModelProfile(id: string): Promise<TestResult> {
  const profile = await getRequiredModelProfile(id)
  const checkedAt = Date.now()
  const validationError = validateModelProfile(profile)
  const result: TestResult = {
    status: validationError ? 'failed' : 'ok',
    message: validationError ?? 'Model profile configuration is valid; no live provider call was made.',
    checkedAt,
  }
  await db
    .update(schema.modelProfiles)
    .set({
      healthStatus: result.status,
      lastTestResult: result.message,
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(schema.modelProfiles.id, id))
  return result
}

async function getRequiredModelProfile(id: string): Promise<ModelProfileRow> {
  const row = await db.query.modelProfiles.findFirst({ where: eq(schema.modelProfiles.id, id) })
  if (!row) throw new Error(`Model profile not found: ${id}`)
  return row
}

function validateModelProfile(profile: ModelProfileRow): string | null {
  if (!profile.name.trim()) return 'Model profile name is required.'
  if (!profile.model.trim()) return 'Model id is required.'
  if (!profile.apiKeyRef.trim()) return 'apiKeyRef is required so secrets stay indirect.'
  try {
    new URL(profile.baseUrl)
  } catch {
    return 'baseUrl must be a valid URL.'
  }
  return null
}

export interface CreateCliProfileArgs {
  name: string
  command: string
  argsTemplate?: string
  cwdPolicy?: CliProfileRow['cwdPolicy']
  customCwd?: string | null
  env?: Record<string, string>
  timeoutMs?: number
  inputMode?: CliProfileRow['inputMode']
  outputMode?: CliProfileRow['outputMode']
  allowedAgentIds?: string[]
  requiresApproval?: boolean
}

export async function createCliProfile(args: CreateCliProfileArgs): Promise<CliProfileRow> {
  const now = Date.now()
  const row = {
    id: newCliProfileId(),
    name: args.name.trim(),
    command: args.command.trim(),
    argsTemplate: args.argsTemplate?.trim() ?? '',
    cwdPolicy: args.cwdPolicy ?? 'workspace',
    customCwd: normalizeNullable(args.customCwd),
    env: args.env ?? {},
    timeoutMs: args.timeoutMs ?? 120000,
    inputMode: args.inputMode ?? 'args',
    outputMode: args.outputMode ?? 'stdout',
    allowedAgentIds: args.allowedAgentIds ?? [],
    requiresApproval: args.requiresApproval ?? true,
    healthStatus: 'unknown' as const,
    lastTestResult: null,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.cliProfiles).values(row)
  return row
}

export async function listCliProfiles(): Promise<CliProfileRow[]> {
  return db.query.cliProfiles.findMany({ orderBy: [desc(schema.cliProfiles.createdAt)] })
}

export async function testCliProfile(id: string): Promise<TestResult> {
  const profile = await getRequiredCliProfile(id)
  const checkedAt = Date.now()
  const missingCommand = profile.command.trim().length === 0
  const customCwdMissing = profile.cwdPolicy === 'custom' && !profile.customCwd
  const status = missingCommand || customCwdMissing ? 'failed' : 'ok'
  const message = missingCommand
    ? 'CLI command is required.'
    : customCwdMissing
      ? 'custom cwd policy requires customCwd.'
      : 'CLI profile is structurally valid; no command was executed.'
  await db
    .update(schema.cliProfiles)
    .set({ healthStatus: status, lastTestResult: message, lastCheckedAt: checkedAt, updatedAt: checkedAt })
    .where(eq(schema.cliProfiles.id, id))
  return { status, message, checkedAt }
}

async function getRequiredCliProfile(id: string): Promise<CliProfileRow> {
  const row = await db.query.cliProfiles.findFirst({ where: eq(schema.cliProfiles.id, id) })
  if (!row) throw new Error(`CLI profile not found: ${id}`)
  return row
}

export interface CreateMcpServerArgs {
  displayName: string
  transport?: McpServerRow['transport']
  command?: string | null
  args?: string[]
  env?: Record<string, string>
  endpoint?: string | null
  enabled?: boolean
}

export async function createMcpServer(args: CreateMcpServerArgs): Promise<McpServerRow> {
  const now = Date.now()
  const row = {
    id: newMcpServerId(),
    displayName: args.displayName.trim(),
    transport: args.transport ?? 'stdio',
    command: normalizeNullable(args.command),
    args: args.args ?? [],
    env: args.env ?? {},
    endpoint: normalizeNullable(args.endpoint),
    enabled: args.enabled ?? true,
    healthStatus: 'unknown' as const,
    lastTestResult: null,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.mcpServers).values(row)
  return row
}

export async function listMcpServers(): Promise<McpServerRow[]> {
  return db.query.mcpServers.findMany({ orderBy: [desc(schema.mcpServers.createdAt)] })
}

export async function testMcpServer(id: string): Promise<TestResult> {
  const server = await getRequiredMcpServer(id)
  const checkedAt = Date.now()
  const error =
    server.transport === 'stdio' && !server.command
      ? 'stdio MCP servers require a command.'
      : (server.transport === 'http' || server.transport === 'sse') && !server.endpoint
        ? 'http/sse MCP servers require an endpoint.'
        : null
  const result: TestResult = {
    status: error ? 'failed' : 'ok',
    message: error ?? 'MCP server configuration is structurally valid; no server process was started.',
    checkedAt,
  }
  await db
    .update(schema.mcpServers)
    .set({
      healthStatus: result.status,
      lastTestResult: result.message,
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(schema.mcpServers.id, id))
  return result
}

async function getRequiredMcpServer(id: string): Promise<McpServerRow> {
  const row = await db.query.mcpServers.findFirst({ where: eq(schema.mcpServers.id, id) })
  if (!row) throw new Error(`MCP server not found: ${id}`)
  return row
}

export interface CreateToolConnectionArgs {
  displayName: string
  type: ToolConnectionRow['type']
  config?: JsonObject
  enabled?: boolean
}

export async function createToolConnection(args: CreateToolConnectionArgs): Promise<ToolConnectionRow> {
  const now = Date.now()
  const row = {
    id: newToolConnectionId(),
    displayName: args.displayName.trim(),
    type: args.type,
    config: args.config ?? {},
    enabled: args.enabled ?? true,
    healthStatus: 'unknown' as const,
    lastTestResult: null,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.toolConnections).values(row)
  return row
}

export async function listToolConnections(): Promise<ToolConnectionRow[]> {
  return db.query.toolConnections.findMany({ orderBy: [desc(schema.toolConnections.createdAt)] })
}

export async function testToolConnection(id: string): Promise<TestResult> {
  const row = await db.query.toolConnections.findFirst({ where: eq(schema.toolConnections.id, id) })
  if (!row) throw new Error(`Tool connection not found: ${id}`)
  const checkedAt = Date.now()
  const ok = row.enabled && Boolean(row.displayName.trim())
  const result: TestResult = {
    status: ok ? 'ok' : 'failed',
    message: ok
      ? 'Tool connection metadata is usable; no external tool handshake was made.'
      : 'Tool connection must be enabled and named.',
    checkedAt,
  }
  await db
    .update(schema.toolConnections)
    .set({
      healthStatus: result.status,
      lastTestResult: result.message,
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(schema.toolConnections.id, id))
  return result
}

export interface CreateSoftwareProfileArgs {
  name: string
  appType: SoftwareProfileRow['appType']
  adapterType: SoftwareProfileRow['adapterType']
  launchCommand?: string | null
  executablePath?: string | null
  defaultWorkstationMode?: SoftwareProfileRow['defaultWorkstationMode']
}

export async function createSoftwareProfile(args: CreateSoftwareProfileArgs): Promise<SoftwareProfileRow> {
  const now = Date.now()
  const row = {
    id: newSoftwareProfileId(),
    name: args.name.trim(),
    appType: args.appType,
    adapterType: args.adapterType,
    launchCommand: normalizeNullable(args.launchCommand),
    executablePath: normalizeNullable(args.executablePath),
    defaultWorkstationMode: args.defaultWorkstationMode ?? 'browser_context',
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.softwareProfiles).values(row)
  return row
}

export async function listSoftwareProfiles(): Promise<SoftwareProfileRow[]> {
  return db.query.softwareProfiles.findMany({ orderBy: [desc(schema.softwareProfiles.createdAt)] })
}

export interface CreateSoftwareCommandArgs {
  softwareProfileId: string
  name: string
  description?: string
  inputSchema?: JsonObject
  outputSchema?: JsonObject
  implementation: JsonObject
  riskLevel?: SoftwareCommandRow['riskLevel']
  requiresApproval?: boolean
}

export async function createSoftwareCommand(args: CreateSoftwareCommandArgs): Promise<SoftwareCommandRow> {
  await getRequiredSoftwareProfile(args.softwareProfileId)
  const now = Date.now()
  const row = {
    id: newSoftwareCommandId(),
    softwareProfileId: args.softwareProfileId,
    name: args.name.trim(),
    description: args.description?.trim() ?? '',
    inputSchema: args.inputSchema ?? {},
    outputSchema: args.outputSchema ?? {},
    implementation: args.implementation,
    riskLevel: args.riskLevel ?? 'medium',
    requiresApproval: args.requiresApproval ?? true,
    healthStatus: 'unknown' as const,
    lastTestResult: null,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.softwareCommands).values(row)
  return row
}

export async function listSoftwareCommands(softwareProfileId: string): Promise<SoftwareCommandRow[]> {
  return db.query.softwareCommands.findMany({
    where: eq(schema.softwareCommands.softwareProfileId, softwareProfileId),
    orderBy: [desc(schema.softwareCommands.createdAt)],
  })
}

export async function listAllSoftwareCommands(): Promise<SoftwareCommandRow[]> {
  return db.query.softwareCommands.findMany({
    orderBy: [desc(schema.softwareCommands.createdAt)],
  })
}

export async function testSoftwareCommand(id: string): Promise<TestResult> {
  const row = await db.query.softwareCommands.findFirst({ where: eq(schema.softwareCommands.id, id) })
  if (!row) throw new Error(`Software command not found: ${id}`)
  const checkedAt = Date.now()
  const implementationType = typeof row.implementation.type === 'string' ? row.implementation.type : null
  const cliResult = implementationType === 'cli' ? runCliSoftwareCommandTest(row) : null
  const ok = Boolean(row.name.trim() && implementationType) && (cliResult?.ok ?? true)
  const result: TestResult = {
    status: ok ? 'ok' : 'failed',
    message: cliResult
      ? cliResult.message
      : ok
        ? `Software command is structurally valid for ${implementationType}; no software was launched.`
        : 'Software command requires a name and implementation.type.',
    checkedAt,
  }
  await db
    .update(schema.softwareCommands)
    .set({
      healthStatus: result.status,
      lastTestResult: result.message,
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(schema.softwareCommands.id, id))
  return result
}

function runCliSoftwareCommandTest(row: SoftwareCommandRow): { ok: boolean; message: string } | null {
  const testCommandTemplate = stringFromObject(row.implementation, 'testCommandTemplate')
  const commandTemplate = stringFromObject(row.implementation, 'commandTemplate')
  const runnableTemplate =
    testCommandTemplate ??
    (!row.requiresApproval && row.riskLevel === 'low' ? commandTemplate : null)
  if (!runnableTemplate) {
    return {
      ok: true,
      message:
        'CLI software command is structurally valid; live test skipped because this command requires input or approval.',
    }
  }
  if (/\{\{\s*[\w.-]+\s*\}\}/.test(runnableTemplate)) {
    return {
      ok: true,
      message:
        'CLI software command is structurally valid; live test skipped because the test command still contains input placeholders.',
    }
  }
  const argv = splitCommandLine(runnableTemplate)
  const command = argv[0]
  if (!command) {
    return { ok: false, message: 'CLI software command test has an empty command line.' }
  }
  const result = spawnSync(command, argv.slice(1), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PYTHONUTF8: process.env.PYTHONUTF8 ?? '1',
      PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? 'utf-8',
    },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
  })
  if (result.error) {
    return { ok: false, message: `CLI software command test failed: ${result.error.message}` }
  }
  const stdout = firstLine(result.stdout)
  const stderr = firstLine(result.stderr)
  if (result.status !== 0) {
    return {
      ok: false,
      message: `CLI software command test exited ${result.status}: ${stderr ?? stdout ?? 'no output'}`,
    }
  }
  const summary = summarizeCliTestOutput(result.stdout)
  return {
    ok: true,
    message: `CLI software command test passed: ${summary ?? stdout ?? 'command exited 0'}`,
  }
}

function stringFromObject(value: JsonObject, key: string): string | null {
  const field = value[key]
  return typeof field === 'string' && field.trim() ? field.trim() : null
}

function splitCommandLine(input: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '\\' && quote === '"' && input[index + 1] === '"') {
      current += '"'
      index += 1
      continue
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char
      continue
    }
    if (!quote && /\s/.test(char)) {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }
    current += char
  }
  if (current) parts.push(current)
  return parts
}

function firstLine(value: unknown): string | null {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? null
}

function summarizeCliTestOutput(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as unknown
    if (Array.isArray(parsed)) return `${parsed.length} item(s)`
    if (!parsed || typeof parsed !== 'object') return String(parsed)
    const record = parsed as Record<string, unknown>
    const parts = [
      record.ok === false ? 'ok=false' : null,
      typeof record.found === 'boolean' ? `found=${record.found}` : null,
      typeof record.path === 'string' ? `path=${record.path}` : null,
      typeof record.running === 'boolean' ? `running=${record.running}` : null,
      typeof record.process_count === 'number' ? `processes=${record.process_count}` : null,
      typeof record.window_count === 'number' ? `windows=${record.window_count}` : null,
      Array.isArray(record.draft_roots) ? `draftRoots=${record.draft_roots.length}` : null,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : `${Object.keys(record).length} field(s)`
  } catch {
    return firstLine(text)
  }
}

async function getRequiredSoftwareProfile(id: string): Promise<SoftwareProfileRow> {
  const row = await db.query.softwareProfiles.findFirst({ where: eq(schema.softwareProfiles.id, id) })
  if (!row) throw new Error(`Software profile not found: ${id}`)
  return row
}

export interface CreateAgentProfileArgs {
  name: string
  role: string
  description?: string
  modelProfileId?: string | null
  fallbackModelProfileIds?: string[]
  skillIds?: string[]
  mcpServerIds?: string[]
  cliProfileIds?: string[]
  softwareProfileIds?: string[]
  memoryPolicy?: JsonObject
  autonomyPolicy?: JsonObject
  workstationPolicy?: JsonObject
  permissionPolicy?: JsonObject
  inputContract?: JsonObject
  outputContract?: JsonObject
  persona?: Partial<AgentPersona> | JsonObject
  systemPrompt?: string
  behaviorRules?: string[]
  successCriteria?: string[]
  status?: AgentProfileRow['status']
}

export async function createAgentProfile(args: CreateAgentProfileArgs): Promise<AgentProfileRow> {
  const now = Date.now()
  const row = {
    id: newAgentProfileId(),
    name: args.name.trim(),
    role: args.role.trim(),
    description: args.description?.trim() ?? '',
    modelProfileId: normalizeNullable(args.modelProfileId),
    fallbackModelProfileIds: args.fallbackModelProfileIds ?? [],
    skillIds: args.skillIds ?? [],
    mcpServerIds: args.mcpServerIds ?? [],
    cliProfileIds: args.cliProfileIds ?? [],
    softwareProfileIds: args.softwareProfileIds ?? [],
    memoryPolicy: args.memoryPolicy ?? {},
    autonomyPolicy: args.autonomyPolicy ?? {},
    workstationPolicy: args.workstationPolicy ?? {},
    permissionPolicy: args.permissionPolicy ?? {},
    inputContract: args.inputContract ?? {},
    outputContract: args.outputContract ?? {},
    persona: normalizeAgentPersona(args.persona),
    systemPrompt: args.systemPrompt?.trim() ?? '',
    behaviorRules: args.behaviorRules ?? [],
    successCriteria: args.successCriteria ?? [],
    status: args.status ?? 'draft',
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.agentProfiles).values(row)
  await ensureAgentProbationRecord({ agentProfileId: row.id })
  return row
}

export async function listAgentProfiles(): Promise<AgentProfileRow[]> {
  return db.query.agentProfiles.findMany({ orderBy: [desc(schema.agentProfiles.createdAt)] })
}

export async function updateAgentProfile(
  id: string,
  patch: Partial<CreateAgentProfileArgs>,
): Promise<AgentProfileRow> {
  await getRequiredAgentProfile(id)
  const updates: Record<string, unknown> = { updatedAt: Date.now() }
  for (const key of Object.keys(patch) as Array<keyof CreateAgentProfileArgs>) {
    const value = patch[key]
    if (value === undefined) continue
    if (key === 'persona') {
      updates[key] = normalizeAgentPersona(value as JsonObject)
      continue
    }
    updates[key] = typeof value === 'string' ? value.trim() : value
  }
  if (Object.keys(updates).length === 1) return getRequiredAgentProfile(id)
  await db.update(schema.agentProfiles).set(updates).where(eq(schema.agentProfiles.id, id))
  return getRequiredAgentProfile(id)
}

export async function testAgentProfile(id: string): Promise<TestResult> {
  const profile = await getRequiredAgentProfile(id)
  const checkedAt = Date.now()
  const missingOutput = Object.keys(profile.outputContract ?? {}).length === 0
  const ok = Boolean(profile.name.trim() && profile.role.trim() && !missingOutput)
  return {
    status: ok ? 'ok' : 'failed',
    message: ok
      ? 'Agent profile has role and output contract metadata.'
      : 'Agent profile requires name, role, and non-empty outputContract.',
    checkedAt,
  }
}

export type AgentCapabilityReadiness = 'ready' | 'needs_configuration' | 'draft_only' | 'archived'

export interface AgentCapabilityReference {
  id: string
  name: string
  kind: 'model' | 'skill' | 'mcp_server' | 'cli_profile' | 'software_profile' | 'software_command'
  status?: string
  enabled?: boolean
  healthStatus?: HealthStatus
  requiresApproval?: boolean
  riskLevel?: string
  description?: string
  metadata?: JsonObject
}

export interface AgentProfileCapabilityReport {
  agentProfile: Pick<AgentProfileRow, 'id' | 'name' | 'role' | 'description' | 'status'>
  readiness: AgentCapabilityReadiness
  readinessScore: number
  primaryModel: AgentCapabilityReference | null
  fallbackModels: AgentCapabilityReference[]
  skills: AgentCapabilityReference[]
  mcpServers: AgentCapabilityReference[]
  cliProfiles: AgentCapabilityReference[]
  softwareProfiles: AgentCapabilityReference[]
  softwareCommands: AgentCapabilityReference[]
  declaredCapabilities: {
    modelCalling: boolean
    fallbackModels: boolean
    skills: boolean
    mcpTools: boolean
    cli: boolean
    software: boolean
    memory: boolean
    autonomy: boolean
    workstation: boolean
    permissions: boolean
    inputContract: boolean
    outputContract: boolean
    persona: boolean
    behaviorRules: boolean
    successCriteria: boolean
  }
  permissionMatrix: {
    canReadFiles: boolean
    canWriteFiles: boolean
    canRunCommands: boolean
    canUseNetwork: boolean
    canUseBrowser: boolean
    canUseDesktop: boolean
    canUseMobile: boolean
    raw: JsonObject
  }
  contractSummary: {
    inputKeys: string[]
    outputKeys: string[]
    artifactType: string | null
    requiredFiles: string[]
    validationRules: string[]
  }
  missingReferences: {
    modelProfileIds: string[]
    fallbackModelProfileIds: string[]
    skillIds: string[]
    mcpServerIds: string[]
    cliProfileIds: string[]
    softwareProfileIds: string[]
  }
  gaps: string[]
  warnings: string[]
  recommendations: string[]
  employeeRunbook: string[]
  generatedAt: number
}

export async function getAgentProfileCapabilityReport(
  id: string,
): Promise<AgentProfileCapabilityReport> {
  const profile = await getRequiredAgentProfile(id)
  const [
    primaryModels,
    fallbackModels,
    skills,
    mcpServers,
    cliProfiles,
    softwareProfiles,
  ] = await Promise.all([
    profile.modelProfileId ? findModelProfilesByIds([profile.modelProfileId]) : Promise.resolve([]),
    findModelProfilesByIds(profile.fallbackModelProfileIds),
    findSkillsByIds(profile.skillIds),
    findMcpServersByIds(profile.mcpServerIds),
    findCliProfilesByIds(profile.cliProfileIds),
    findSoftwareProfilesByIds(profile.softwareProfileIds),
  ])
  const softwareCommands = softwareProfiles.length
    ? await db.query.softwareCommands.findMany({
        where: inArray(schema.softwareCommands.softwareProfileId, softwareProfiles.map((row) => row.id)),
        orderBy: [asc(schema.softwareCommands.name)],
      })
    : []
  const primaryModel = primaryModels[0] ?? null
  const missingReferences = {
    modelProfileIds: profile.modelProfileId && !primaryModel ? [profile.modelProfileId] : [],
    fallbackModelProfileIds: missingIds(profile.fallbackModelProfileIds, fallbackModels),
    skillIds: missingIds(profile.skillIds, skills),
    mcpServerIds: missingIds(profile.mcpServerIds, mcpServers),
    cliProfileIds: missingIds(profile.cliProfileIds, cliProfiles),
    softwareProfileIds: missingIds(profile.softwareProfileIds, softwareProfiles),
  }
  const permissionPolicy = profile.permissionPolicy ?? {}
  const workstationPolicy = profile.workstationPolicy ?? {}
  const memoryPolicy = profile.memoryPolicy ?? {}
  const autonomyPolicy = profile.autonomyPolicy ?? {}
  const inputKeys = Object.keys(profile.inputContract ?? {})
  const outputKeys = Object.keys(profile.outputContract ?? {})
  const requiredFiles = arrayOfStrings((profile.outputContract as JsonObject).requiredFiles)
  const validationRules = arrayOfStrings((profile.outputContract as JsonObject).validationRules)
  const artifactType = typeof (profile.outputContract as JsonObject).artifactType === 'string'
    ? String((profile.outputContract as JsonObject).artifactType)
    : null
  const declaredCapabilities = {
    modelCalling: Boolean(primaryModel),
    fallbackModels: fallbackModels.length > 0,
    skills: skills.length > 0,
    mcpTools: mcpServers.length > 0,
    cli: cliProfiles.length > 0,
    software: softwareProfiles.length > 0,
    memory: Object.keys(memoryPolicy).length > 0,
    autonomy: Object.keys(autonomyPolicy).length > 0,
    workstation: Object.keys(workstationPolicy).length > 0,
    permissions: Object.keys(permissionPolicy).length > 0,
    inputContract: inputKeys.length > 0,
    outputContract: outputKeys.length > 0,
    persona: Object.keys(profile.persona ?? {}).length > 0,
    behaviorRules: profile.behaviorRules.length > 0,
    successCriteria: profile.successCriteria.length > 0,
  }
  const permissionMatrix = {
    canReadFiles: policyFlag(permissionPolicy, ['canReadFiles', 'readFiles', 'fileRead', 'allowFileRead']),
    canWriteFiles: policyFlag(permissionPolicy, ['canWriteFiles', 'writeFiles', 'fileWrite', 'allowFileWrite']),
    canRunCommands: policyFlag(permissionPolicy, ['canRunCommands', 'runCommands', 'bash', 'allowCommandExecution']),
    canUseNetwork: policyFlag(permissionPolicy, ['canUseNetwork', 'network', 'internet', 'allowNetwork']),
    canUseBrowser: policyFlag(permissionPolicy, ['canUseBrowser', 'browser', 'allowBrowser']),
    canUseDesktop: policyFlag(permissionPolicy, ['canUseDesktop', 'desktop', 'allowDesktop']),
    canUseMobile: policyFlag(permissionPolicy, ['canUseMobile', 'mobile', 'allowMobile']),
    raw: permissionPolicy,
  }
  const gaps = buildAgentCapabilityGaps({
    profile,
    primaryModel,
    fallbackModels,
    declaredCapabilities,
    permissionMatrix,
    missingReferences,
  })
  const warnings = buildAgentCapabilityWarnings({
    profile,
    skills,
    mcpServers,
    cliProfiles,
    softwareCommands,
    permissionMatrix,
  })
  const recommendations = buildAgentCapabilityRecommendations(gaps, warnings, declaredCapabilities)
  const readiness = resolveAgentCapabilityReadiness(profile.status, gaps)
  return {
    agentProfile: {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      description: profile.description,
      status: profile.status,
    },
    readiness,
    readinessScore: scoreAgentReadiness(readiness, gaps, warnings, declaredCapabilities),
    primaryModel: primaryModel ? modelToCapability(primaryModel) : null,
    fallbackModels: fallbackModels.map(modelToCapability),
    skills: skills.map(skillToCapability),
    mcpServers: mcpServers.map(mcpServerToCapability),
    cliProfiles: cliProfiles.map(cliProfileToCapability),
    softwareProfiles: softwareProfiles.map(softwareProfileToCapability),
    softwareCommands: softwareCommands.map(softwareCommandToCapability),
    declaredCapabilities,
    permissionMatrix,
    contractSummary: {
      inputKeys,
      outputKeys,
      artifactType,
      requiredFiles,
      validationRules,
    },
    missingReferences,
    gaps,
    warnings,
    recommendations,
    employeeRunbook: buildAgentEmployeeRunbook(profile, declaredCapabilities, permissionMatrix),
    generatedAt: Date.now(),
  }
}

async function getRequiredAgentProfile(id: string): Promise<AgentProfileRow> {
  const row = await db.query.agentProfiles.findFirst({ where: eq(schema.agentProfiles.id, id) })
  if (!row) throw new Error(`Agent profile not found: ${id}`)
  return row
}

async function findModelProfilesByIds(ids: string[]): Promise<ModelProfileRow[]> {
  const uniqueIds = uniqueStrings(ids)
  if (!uniqueIds.length) return []
  return db.query.modelProfiles.findMany({
    where: inArray(schema.modelProfiles.id, uniqueIds),
    orderBy: [asc(schema.modelProfiles.name)],
  })
}

async function findSkillsByIds(ids: string[]): Promise<SkillRow[]> {
  const uniqueIds = uniqueStrings(ids)
  if (!uniqueIds.length) return []
  return db.query.skills.findMany({
    where: inArray(schema.skills.id, uniqueIds),
    orderBy: [asc(schema.skills.name)],
  })
}

async function findMcpServersByIds(ids: string[]): Promise<McpServerRow[]> {
  const uniqueIds = uniqueStrings(ids)
  if (!uniqueIds.length) return []
  return db.query.mcpServers.findMany({
    where: inArray(schema.mcpServers.id, uniqueIds),
    orderBy: [asc(schema.mcpServers.displayName)],
  })
}

async function findCliProfilesByIds(ids: string[]): Promise<CliProfileRow[]> {
  const uniqueIds = uniqueStrings(ids)
  if (!uniqueIds.length) return []
  return db.query.cliProfiles.findMany({
    where: inArray(schema.cliProfiles.id, uniqueIds),
    orderBy: [asc(schema.cliProfiles.name)],
  })
}

async function findSoftwareProfilesByIds(ids: string[]): Promise<SoftwareProfileRow[]> {
  const uniqueIds = uniqueStrings(ids)
  if (!uniqueIds.length) return []
  return db.query.softwareProfiles.findMany({
    where: inArray(schema.softwareProfiles.id, uniqueIds),
    orderBy: [asc(schema.softwareProfiles.name)],
  })
}

function uniqueStrings(values: string[] = []): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function missingIds<T extends { id: string }>(requestedIds: string[], foundRows: T[]): string[] {
  const found = new Set(foundRows.map((row) => row.id))
  return uniqueStrings(requestedIds).filter((id) => !found.has(id))
}

function policyFlag(policy: JsonObject, keys: string[]): boolean {
  return keys.some((key) => policy[key] === true || policy[key] === 'true' || policy[key] === 'allowed')
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function modelToCapability(row: ModelProfileRow): AgentCapabilityReference {
  return {
    id: row.id,
    name: `${row.name} (${row.provider}:${row.model})`,
    kind: 'model',
    healthStatus: row.healthStatus,
    metadata: {
      provider: row.provider,
      model: row.model,
      contextWindow: row.contextWindow ?? null,
      supportsVision: row.supportsVision,
      supportsToolCalling: row.supportsToolCalling,
      supportsJsonMode: row.supportsJsonMode,
      networkProfileId: row.networkProfileId,
    },
  }
}

function skillToCapability(row: SkillRow): AgentCapabilityReference {
  return {
    id: row.id,
    name: row.name,
    kind: 'skill',
    status: row.status,
    enabled: row.enabled,
    description: row.description,
    metadata: {
      source: row.source,
      sourceUrl: row.sourceUrl,
      installPath: row.installPath,
    },
  }
}

function mcpServerToCapability(row: McpServerRow): AgentCapabilityReference {
  return {
    id: row.id,
    name: row.displayName,
    kind: 'mcp_server',
    enabled: row.enabled,
    healthStatus: row.healthStatus,
    metadata: {
      transport: row.transport,
      endpoint: row.endpoint,
      command: row.command,
    },
  }
}

function cliProfileToCapability(row: CliProfileRow): AgentCapabilityReference {
  return {
    id: row.id,
    name: row.name,
    kind: 'cli_profile',
    healthStatus: row.healthStatus,
    requiresApproval: row.requiresApproval,
    metadata: {
      command: row.command,
      cwdPolicy: row.cwdPolicy,
      inputMode: row.inputMode,
      outputMode: row.outputMode,
      timeoutMs: row.timeoutMs,
    },
  }
}

function softwareProfileToCapability(row: SoftwareProfileRow): AgentCapabilityReference {
  return {
    id: row.id,
    name: row.name,
    kind: 'software_profile',
    metadata: {
      appType: row.appType,
      adapterType: row.adapterType,
      defaultWorkstationMode: row.defaultWorkstationMode,
    },
  }
}

function softwareCommandToCapability(row: SoftwareCommandRow): AgentCapabilityReference {
  return {
    id: row.id,
    name: row.name,
    kind: 'software_command',
    healthStatus: row.healthStatus,
    requiresApproval: row.requiresApproval,
    riskLevel: row.riskLevel,
    description: row.description,
    metadata: {
      softwareProfileId: row.softwareProfileId,
      implementationType: typeof row.implementation.type === 'string' ? row.implementation.type : 'unknown',
    },
  }
}

function buildAgentCapabilityGaps(args: {
  profile: AgentProfileRow
  primaryModel: ModelProfileRow | null
  fallbackModels: ModelProfileRow[]
  declaredCapabilities: AgentProfileCapabilityReport['declaredCapabilities']
  permissionMatrix: AgentProfileCapabilityReport['permissionMatrix']
  missingReferences: AgentProfileCapabilityReport['missingReferences']
}): string[] {
  const gaps: string[] = []
  if (!args.profile.name.trim()) gaps.push('Agent name is empty.')
  if (!args.profile.role.trim()) gaps.push('Agent role is empty.')
  if (!args.primaryModel) gaps.push('Primary model is not configured or cannot be resolved.')
  if (!args.declaredCapabilities.outputContract) gaps.push('Output contract is missing; Agent output is not deterministic.')
  if (!args.declaredCapabilities.successCriteria) gaps.push('Success criteria are missing; verification cannot be targeted.')
  if (!args.declaredCapabilities.permissions) gaps.push('Permission policy is empty; runtime cannot explain allowed actions.')
  if (!args.declaredCapabilities.workstation) gaps.push('Workstation policy is empty; isolation mode is implicit.')
  for (const [kind, ids] of Object.entries(args.missingReferences)) {
    if (ids.length) gaps.push(`Missing ${kind}: ${ids.join(', ')}.`)
  }
  if (
    (args.declaredCapabilities.cli || args.declaredCapabilities.software) &&
    !args.permissionMatrix.canRunCommands
  ) {
    gaps.push('CLI/software capabilities are selected but command execution permission is not declared.')
  }
  if (args.declaredCapabilities.mcpTools && !args.permissionMatrix.canUseNetwork) {
    gaps.push('MCP tools are selected but network/tool access permission is not declared.')
  }
  return gaps
}

function buildAgentCapabilityWarnings(args: {
  profile: AgentProfileRow
  skills: SkillRow[]
  mcpServers: McpServerRow[]
  cliProfiles: CliProfileRow[]
  softwareCommands: SoftwareCommandRow[]
  permissionMatrix: AgentProfileCapabilityReport['permissionMatrix']
}): string[] {
  const warnings: string[] = []
  if (args.profile.status === 'draft') warnings.push('Agent is still draft; orchestration should treat it as not production-ready.')
  if (!args.profile.systemPrompt.trim()) warnings.push('System prompt is empty; role behavior depends only on generic defaults.')
  if (!args.profile.behaviorRules.length) warnings.push('Behavior rules are empty; operating style is under-specified.')
  if (args.skills.some((skill) => !skill.enabled || skill.status !== 'installed')) {
    warnings.push('At least one selected Skill is disabled or not installed.')
  }
  if (args.mcpServers.some((server) => !server.enabled || server.healthStatus === 'failed')) {
    warnings.push('At least one selected MCP server is disabled or unhealthy.')
  }
  if (args.cliProfiles.some((cli) => cli.healthStatus === 'failed')) {
    warnings.push('At least one selected CLI profile has failed health status.')
  }
  if (args.softwareCommands.some((command) => command.riskLevel === 'high' && !command.requiresApproval)) {
    warnings.push('A high-risk software command does not require approval.')
  }
  if (args.permissionMatrix.canUseDesktop && !args.permissionMatrix.canRunCommands) {
    warnings.push('Desktop operation is allowed while command execution is not declared; recovery options may be limited.')
  }
  return warnings
}

function buildAgentCapabilityRecommendations(
  gaps: string[],
  warnings: string[],
  declaredCapabilities: AgentProfileCapabilityReport['declaredCapabilities'],
): string[] {
  const recommendations: string[] = []
  if (gaps.some((gap) => gap.includes('Primary model'))) {
    recommendations.push('Select a tested Model Profile before assigning this Agent to workflow nodes.')
  }
  if (gaps.some((gap) => gap.includes('Output contract'))) {
    recommendations.push('Define artifactType, requiredFiles, and validationRules in the output contract.')
  }
  if (!declaredCapabilities.skills && !declaredCapabilities.mcpTools && !declaredCapabilities.cli && !declaredCapabilities.software) {
    recommendations.push('Attach at least one Skill, MCP server, CLI profile, or software profile for non-chat work.')
  }
  if (warnings.some((warning) => warning.includes('draft'))) {
    recommendations.push('Run profile test and promote status to active after contracts and permissions are reviewed.')
  }
  if (!recommendations.length) {
    recommendations.push('Profile is ready for dry-run orchestration; keep live tool execution behind approval gates.')
  }
  return recommendations
}

function resolveAgentCapabilityReadiness(
  status: AgentProfileRow['status'],
  gaps: string[],
): AgentCapabilityReadiness {
  if (status === 'archived') return 'archived'
  if (status === 'draft') return 'draft_only'
  return gaps.length ? 'needs_configuration' : 'ready'
}

function scoreAgentReadiness(
  readiness: AgentCapabilityReadiness,
  gaps: string[],
  warnings: string[],
  declaredCapabilities: AgentProfileCapabilityReport['declaredCapabilities'],
): number {
  if (readiness === 'archived') return 0
  const declaredCount = Object.values(declaredCapabilities).filter(Boolean).length
  const base = Math.round((declaredCount / Object.keys(declaredCapabilities).length) * 100)
  const penalty = gaps.length * 8 + warnings.length * 3 + (readiness === 'draft_only' ? 10 : 0)
  return Math.max(0, Math.min(100, base - penalty))
}

function buildAgentEmployeeRunbook(
  profile: AgentProfileRow,
  declaredCapabilities: AgentProfileCapabilityReport['declaredCapabilities'],
  permissionMatrix: AgentProfileCapabilityReport['permissionMatrix'],
): string[] {
  const steps = [
    `Adopt role: ${profile.role}.`,
    'Read input contract and success criteria before planning.',
    declaredCapabilities.memory
      ? 'Retrieve relevant memories and include customer/project preferences.'
      : 'Proceed without long-term memory unless runtime supplies external context.',
    declaredCapabilities.skills || declaredCapabilities.mcpTools || declaredCapabilities.cli || declaredCapabilities.software
      ? 'Choose the lowest-risk configured capability that can produce the required artifact.'
      : 'Work in reasoning-only mode because no external capability is selected.',
    permissionMatrix.canRunCommands
      ? 'Use CLI/software commands only through configured profiles and approval policy.'
      : 'Do not run commands unless a later approval grants command execution.',
    permissionMatrix.canUseDesktop
      ? 'Acquire workstation/resource locks before desktop actions and emit takeover-ready observations.'
      : 'Avoid live desktop actions; prefer browser/API/CLI alternatives.',
    'Validate output contract and record artifact evidence before marking the task complete.',
  ]
  return steps
}


export interface CreateMemoryItemArgs {
  agentProfileId?: string | null
  scope: MemoryItemRow['scope']
  type: MemoryItemRow['type']
  title: string
  content: string
  sourceRunId?: string | null
  embedding?: number[] | null
  confidence?: number
  importance?: number
  expiresAt?: number | null
  readAccess?: MemoryPrivacyReadAccess
  writeAccess?: MemoryPrivacyWriteAccess
  encryption?: MemoryPrivacyEncryption
  containsDataTypes?: MemoryPrivacyDataType[]
}

export async function createMemoryItem(args: CreateMemoryItemArgs): Promise<MemoryItemRow> {
  const now = Date.now()
  const containsDataTypes = normalizeMemoryDataTypes(args.containsDataTypes)
  const encryption = normalizeMemoryEncryption(args.encryption, containsDataTypes)
  const row = {
    id: newMemoryItemId(),
    agentProfileId: normalizeNullable(args.agentProfileId),
    scope: args.scope,
    type: args.type,
    title: args.title.trim(),
    content: args.content.trim(),
    sourceRunId: normalizeNullable(args.sourceRunId),
    embedding: args.embedding ?? null,
    confidence: args.confidence ?? 1,
    importance: args.importance ?? 0.5,
    readAccess: args.readAccess ?? defaultMemoryReadAccess(args.scope),
    writeAccess: args.writeAccess ?? 'only_me',
    encryption,
    containsDataTypes,
    createdAt: now,
    updatedAt: now,
    expiresAt: args.expiresAt ?? null,
  }
  await db.insert(schema.memoryItems).values(row)
  return row
}

export async function listMemoryForRun(runId: string): Promise<MemoryItemRow[]> {
  return db.query.memoryItems.findMany({
    where: eq(schema.memoryItems.sourceRunId, runId),
    orderBy: [desc(schema.memoryItems.importance), desc(schema.memoryItems.createdAt)],
  })
}

export async function listMemoryForAgent(agentProfileId: string): Promise<MemoryItemRow[]> {
  return db.query.memoryItems.findMany({
    where: eq(schema.memoryItems.agentProfileId, agentProfileId),
    orderBy: [desc(schema.memoryItems.importance), desc(schema.memoryItems.createdAt)],
  })
}

export interface CreateRunReflectionArgs {
  runId: string
  agentProfileId?: string | null
  whatWorked?: string[]
  whatFailed?: string[]
  newKnowledge?: string[]
  reusableProcedure?: string[]
  suggestedSkillUpdates?: string[]
  futureWarnings?: string[]
}

export async function createRunReflection(args: CreateRunReflectionArgs): Promise<RunReflectionRow> {
  const row = {
    id: newRunReflectionId(),
    runId: args.runId,
    agentProfileId: normalizeNullable(args.agentProfileId),
    whatWorked: args.whatWorked ?? [],
    whatFailed: args.whatFailed ?? [],
    newKnowledge: args.newKnowledge ?? [],
    reusableProcedure: args.reusableProcedure ?? [],
    suggestedSkillUpdates: args.suggestedSkillUpdates ?? [],
    futureWarnings: args.futureWarnings ?? [],
    createdAt: Date.now(),
  }
  await db.insert(schema.runReflections).values(row)
  return row
}

export async function getRunReflection(runId: string): Promise<RunReflectionRow | null> {
  return (
    (await db.query.runReflections.findFirst({
      where: eq(schema.runReflections.runId, runId),
      orderBy: [desc(schema.runReflections.createdAt)],
    })) ?? null
  )
}

export interface CreateWorkflowArgs {
  name: string
  description?: string
  status?: WorkflowRow['status']
  nodes?: Array<{
    id?: string
    type: string
    agentProfileId?: string | null
    position: { x: number; y: number }
    config?: JsonObject
    inputMapping?: JsonObject
    outputContract?: JsonObject
    retryPolicy?: JsonObject
    approvalPolicy?: JsonObject
  }>
  edges?: Array<{
    id?: string
    sourceNodeId: string
    targetNodeId: string
    sourceHandle?: string | null
    targetHandle?: string | null
    mapping?: JsonObject
  }>
}

export type UpdateWorkflowArgs = CreateWorkflowArgs

export async function createWorkflow(args: CreateWorkflowArgs): Promise<WorkflowRow> {
  const now = Date.now()
  const workflow = {
    id: newWorkflowId(),
    name: args.name.trim(),
    description: args.description?.trim() ?? '',
    status: args.status ?? 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.workflows).values(workflow)

  for (const node of args.nodes ?? []) {
    await db.insert(schema.workflowNodes).values({
      id: node.id ?? newWorkflowNodeId(),
      workflowId: workflow.id,
      type: node.type,
      agentProfileId: normalizeNullable(node.agentProfileId),
      position: node.position,
      config: node.config ?? {},
      inputMapping: node.inputMapping ?? {},
      outputContract: node.outputContract ?? {},
      retryPolicy: node.retryPolicy ?? {},
      approvalPolicy: node.approvalPolicy ?? {},
      createdAt: now,
      updatedAt: now,
    })
  }

  for (const edge of args.edges ?? []) {
    await db.insert(schema.workflowEdges).values({
      id: edge.id ?? newWorkflowEdgeId(),
      workflowId: workflow.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      sourceHandle: normalizeNullable(edge.sourceHandle),
      targetHandle: normalizeNullable(edge.targetHandle),
      mapping: edge.mapping ?? {},
      createdAt: now,
    })
  }

  return workflow
}

export async function updateWorkflow(workflowId: string, args: UpdateWorkflowArgs): Promise<WorkflowRow> {
  const existing = await db.query.workflows.findFirst({
    where: eq(schema.workflows.id, workflowId),
  })
  if (!existing) throw new Error(`Workflow not found: ${workflowId}`)

  const now = Date.now()
  const workflow: WorkflowRow = {
    ...existing,
    name: args.name.trim(),
    description: args.description?.trim() ?? '',
    status: args.status ?? existing.status,
    version: existing.version + 1,
    updatedAt: now,
  }

  db.transaction((tx) => {
    tx.delete(schema.workflowEdges).where(eq(schema.workflowEdges.workflowId, workflowId)).run()
    tx.delete(schema.workflowNodes).where(eq(schema.workflowNodes.workflowId, workflowId)).run()
    tx.update(schema.workflows)
      .set({
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        version: workflow.version,
        updatedAt: workflow.updatedAt,
      })
      .where(eq(schema.workflows.id, workflowId))
      .run()

    for (const node of args.nodes ?? []) {
      tx.insert(schema.workflowNodes)
        .values({
          id: node.id ?? newWorkflowNodeId(),
          workflowId,
          type: node.type,
          agentProfileId: normalizeNullable(node.agentProfileId),
          position: node.position,
          config: node.config ?? {},
          inputMapping: node.inputMapping ?? {},
          outputContract: node.outputContract ?? {},
          retryPolicy: node.retryPolicy ?? {},
          approvalPolicy: node.approvalPolicy ?? {},
          createdAt: now,
          updatedAt: now,
        })
        .run()
    }

    for (const edge of args.edges ?? []) {
      tx.insert(schema.workflowEdges)
        .values({
          id: edge.id ?? newWorkflowEdgeId(),
          workflowId,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          sourceHandle: normalizeNullable(edge.sourceHandle),
          targetHandle: normalizeNullable(edge.targetHandle),
          mapping: edge.mapping ?? {},
          createdAt: now,
        })
        .run()
    }
  })

  return workflow
}

export async function listWorkflows(): Promise<WorkflowRow[]> {
  return db.query.workflows.findMany({ orderBy: [desc(schema.workflows.createdAt)] })
}

export interface WorkflowGraph {
  workflow: WorkflowRow
  nodes: WorkflowNodeRow[]
  edges: WorkflowEdgeRow[]
}

export async function getWorkflowGraph(workflowId: string): Promise<WorkflowGraph> {
  const workflow = await db.query.workflows.findFirst({
    where: eq(schema.workflows.id, workflowId),
  })
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)
  const [nodes, edges] = await Promise.all([
    db.query.workflowNodes.findMany({
      where: eq(schema.workflowNodes.workflowId, workflowId),
      orderBy: [asc(schema.workflowNodes.createdAt)],
    }),
    db.query.workflowEdges.findMany({
      where: eq(schema.workflowEdges.workflowId, workflowId),
      orderBy: [asc(schema.workflowEdges.createdAt)],
    }),
  ])
  return { workflow, nodes, edges }
}

export async function startWorkflowRun(
  workflowId: string,
  input: JsonObject = {},
): Promise<WorkflowRunRow> {
  const workflow = await db.query.workflows.findFirst({ where: eq(schema.workflows.id, workflowId) })
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)
  const now = Date.now()
  const run = {
    id: newWorkflowRunId(),
    workflowId,
    status: 'queued' as const,
    input,
    output: null,
    error: null,
    startedAt: now,
    finishedAt: null,
  }
  await db.insert(schema.workflowRuns).values(run)
  const nodes = await db.query.workflowNodes.findMany({
    where: eq(schema.workflowNodes.workflowId, workflowId),
  })
  for (const node of nodes) {
    await db.insert(schema.workflowNodeRuns).values({
      id: newWorkflowNodeRunId(),
      workflowRunId: run.id,
      nodeId: node.id,
      status: 'queued',
      progressStatus: 'queued',
      currentStep: null,
      output: null,
      error: null,
      startedAt: now,
      finishedAt: null,
    })
  }
  return executeWorkflowRun(run.id)
}

export async function getWorkflowRun(runId: string): Promise<WorkflowRunRow | null> {
  return (
    (await db.query.workflowRuns.findFirst({
      where: eq(schema.workflowRuns.id, runId),
    })) ?? null
  )
}

export async function listWorkflowRuns(workflowId?: string): Promise<WorkflowRunRow[]> {
  return db.query.workflowRuns.findMany({
    where: workflowId ? eq(schema.workflowRuns.workflowId, workflowId) : undefined,
    orderBy: [desc(schema.workflowRuns.startedAt)],
    limit: 50,
  })
}

export interface WorkflowRunSnapshot {
  workflowRun: WorkflowRunRow
  nodeRuns: WorkflowNodeRunRow[]
  employeeRuns: EmployeeRunRow[]
  nodeBrainStatuses: WorkflowNodeBrainStatus[]
  artifactHandoffs: WorkflowRunArtifactHandoff[]
  deliveryPackage: WorkflowRunDeliveryPackage
  softwareCommandRuns: SoftwareCommandRunRow[]
  computerSessions: ComputerSessionRow[]
  computerActionEvents: ComputerActionEventRow[]
  artifactValidations: ArtifactValidationRow[]
  approvalRequests: ApprovalRequestRow[]
  resourceLocks: ResourceLockRow[]
}

export async function getWorkflowRunSnapshot(runId: string): Promise<WorkflowRunSnapshot> {
  const workflowRun = await getWorkflowRun(runId)
  if (!workflowRun) throw new Error(`Workflow run not found: ${runId}`)
  const nodeRuns = await db.query.workflowNodeRuns.findMany({
    where: eq(schema.workflowNodeRuns.workflowRunId, runId),
    orderBy: [asc(schema.workflowNodeRuns.startedAt)],
  })
  const [workflowNodes, workflowEdges] = await Promise.all([
    db.query.workflowNodes.findMany({
      where: eq(schema.workflowNodes.workflowId, workflowRun.workflowId),
      orderBy: [asc(schema.workflowNodes.createdAt)],
    }),
    db.query.workflowEdges.findMany({
      where: eq(schema.workflowEdges.workflowId, workflowRun.workflowId),
      orderBy: [asc(schema.workflowEdges.createdAt)],
    }),
  ])
  const artifactHandoffs = buildWorkflowRunArtifactHandoffs({
    nodes: workflowNodes,
    edges: workflowEdges,
    nodeRuns,
  })
  const deliveryPackage = buildWorkflowRunDeliveryPackage({
    nodes: workflowNodes,
    nodeRuns,
  })
  const employeeRuns = await listWorkflowEmployeeRuns(runId)
  const employeeRunIds = employeeRuns.map((run) => run.id)
  const [runReflections, runMemories, runLearningEvents] = employeeRunIds.length
    ? await Promise.all([
        db.query.runReflections.findMany({
          where: inArray(schema.runReflections.runId, employeeRunIds),
          orderBy: [asc(schema.runReflections.createdAt)],
        }),
        db.query.memoryItems.findMany({
          where: inArray(schema.memoryItems.sourceRunId, employeeRunIds),
          orderBy: [asc(schema.memoryItems.createdAt)],
        }),
        db.query.learningEvents.findMany({
          where: inArray(schema.learningEvents.runId, employeeRunIds),
          orderBy: [asc(schema.learningEvents.createdAt)],
        }),
      ])
    : [[], [], []]
  const nodeBrainStatuses = buildWorkflowNodeBrainStatuses({
    nodeRuns: nodeRuns.map((nodeRun) => ({
      id: nodeRun.id,
      nodeId: nodeRun.nodeId,
      output: nodeRun.output,
    })),
    employeeRuns: employeeRuns.map((employeeRun) => ({ id: employeeRun.id })),
    reflections: runReflections.map((reflection) => ({
      runId: reflection.runId,
      whatFailed: reflection.whatFailed,
    })),
    memories: runMemories.map((memory) => ({
      sourceRunId: memory.sourceRunId,
      type: memory.type,
    })),
    learningEvents: runLearningEvents.map((event) => ({
      runId: event.runId,
      status: event.status,
    })),
  })
  const softwareCommandRuns = await listSoftwareCommandRunsForWorkflowRun(runId)
  const computerSessions = await listComputerSessionsForWorkflowRun(runId)
  const computerActionEvents = await listComputerActionEventsForWorkflowRun(runId)
  const artifactValidations = (
    await Promise.all(employeeRuns.map((employeeRun) => listArtifactValidationsForRun(employeeRun.id)))
  ).flat()
  const approvalRequests = await db.query.approvalRequests.findMany({
    where: eq(schema.approvalRequests.runId, runId),
    orderBy: [asc(schema.approvalRequests.createdAt)],
  })
  const resourceLocks = await listResourceLocksForRun(runId)
  return {
    workflowRun,
    nodeRuns,
    employeeRuns,
    nodeBrainStatuses,
    artifactHandoffs,
    deliveryPackage,
    softwareCommandRuns,
    computerSessions,
    computerActionEvents,
    artifactValidations,
    approvalRequests,
    resourceLocks,
  }
}

export interface CreateApprovalRequestArgs {
  conversationId?: string | null
  runId?: string | null
  nodeRunId?: string | null
  agentProfileId?: string | null
  type: string
  title: string
  description?: string
  riskLevel?: ApprovalRequestRow['riskLevel']
  payload?: JsonObject
}

export async function createApprovalRequest(
  args: CreateApprovalRequestArgs,
): Promise<ApprovalRequestRow> {
  const row = {
    id: newApprovalRequestId(),
    conversationId: normalizeNullable(args.conversationId),
    runId: normalizeNullable(args.runId),
    nodeRunId: normalizeNullable(args.nodeRunId),
    agentProfileId: normalizeNullable(args.agentProfileId),
    type: args.type,
    status: 'pending' as const,
    title: args.title.trim(),
    description: args.description?.trim() ?? '',
    riskLevel: args.riskLevel ?? 'medium',
    payload: args.payload ?? {},
    response: null,
    createdAt: Date.now(),
    resolvedAt: null,
  }
  await db.insert(schema.approvalRequests).values(row)
  return row
}

export async function listApprovalRequests(args: {
  status?: ApprovalRequestRow['status']
  agentProfileId?: string
  runId?: string
  limit?: number
} = {}): Promise<ApprovalRequestRow[]> {
  const filters = [
    args.status ? eq(schema.approvalRequests.status, args.status) : undefined,
    args.agentProfileId ? eq(schema.approvalRequests.agentProfileId, args.agentProfileId) : undefined,
    args.runId ? eq(schema.approvalRequests.runId, args.runId) : undefined,
  ].filter(Boolean)

  return db.query.approvalRequests.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    orderBy: [desc(schema.approvalRequests.createdAt)],
    limit: Math.min(Math.max(args.limit ?? 100, 1), 500),
  })
}

export async function respondApprovalRequest(
  id: string,
  approved: boolean,
  response: JsonObject = {},
): Promise<ApprovalRequestRow> {
  const existing = await db.query.approvalRequests.findFirst({
    where: eq(schema.approvalRequests.id, id),
  })
  if (!existing) throw new Error(`Approval request not found: ${id}`)
  if (existing.status !== 'pending') throw new Error(`Approval request is already ${existing.status}`)
  await db
    .update(schema.approvalRequests)
    .set({
      status: approved ? 'approved' : 'rejected',
      response,
      resolvedAt: Date.now(),
    })
    .where(eq(schema.approvalRequests.id, id))
  const updated = await db.query.approvalRequests.findFirst({
    where: eq(schema.approvalRequests.id, id),
  })
  if (!updated) throw new Error(`Approval request missing after response: ${id}`)
  await resolveWorkflowApprovalRequest(updated)
  return updated
}

export async function createDefaultWorkstation(agentProfileId: string) {
  await getRequiredAgentProfile(agentProfileId)
  const now = Date.now()
  const safeId = agentProfileId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const row = {
    id: newAgentWorkstationId(),
    agentProfileId,
    mode: 'browser_context' as const,
    workspacePath: `.agenthub-data/employee-workspaces/${safeId}`,
    browserProfilePath: `.agenthub-data/browser-profiles/${safeId}`,
    tempPath: `.agenthub-data/tmp/${safeId}`,
    displayId: null,
    vncUrl: null,
    rdpConfig: null,
    status: 'idle' as const,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.agentWorkstations).values(row)
  return row
}

const AGENT_PERSONA_TONES: AgentPersonaTone[] = [
  'formal',
  'casual',
  'technical',
  'friendly',
  'concise',
  'detailed',
]

export function normalizeAgentPersona(value: Partial<AgentPersona> | JsonObject | null | undefined): AgentPersona {
  const source = asJsonObject(value)
  const communicationStyle = asJsonObject(source.communicationStyle)
  const personalityTraits = asJsonObject(source.personalityTraits)
  const tone = readTone(source.tone)
  return {
    avatar: readString(source.avatar, 'agent'),
    tone,
    language: readString(source.language, 'zh-CN'),
    communicationStyle: {
      useEmoji: readBoolean(communicationStyle.useEmoji, false),
      useCodeBlocks: readBoolean(communicationStyle.useCodeBlocks, true),
      preferBulletPoints: readBoolean(communicationStyle.preferBulletPoints, true),
      showThinkingProcess: readBoolean(communicationStyle.showThinkingProcess, false),
      selfReference: readString(communicationStyle.selfReference, 'I'),
    },
    personalityTraits: {
      cautious: clamp01(readNumber(personalityTraits.cautious, tone === 'formal' ? 0.72 : 0.6)),
      creative: clamp01(readNumber(personalityTraits.creative, tone === 'casual' ? 0.6 : 0.4)),
      thorough: clamp01(readNumber(personalityTraits.thorough, tone === 'detailed' ? 0.86 : 0.7)),
      efficient: clamp01(readNumber(personalityTraits.efficient, tone === 'concise' ? 0.82 : 0.6)),
    },
  }
}

function asJsonObject(value: unknown): JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {}
}

function readTone(value: unknown): AgentPersonaTone {
  return AGENT_PERSONA_TONES.includes(value as AgentPersonaTone) ? value as AgentPersonaTone : 'friendly'
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function defaultMemoryReadAccess(scope: MemoryItemRow['scope']): MemoryPrivacyReadAccess {
  if (scope === 'agent') return 'only_me'
  if (scope === 'project') return 'project'
  return 'organization'
}

function normalizeMemoryDataTypes(values: MemoryPrivacyDataType[] | undefined): MemoryPrivacyDataType[] {
  const allowed: MemoryPrivacyDataType[] = [
    'pii',
    'credentials',
    'business_secret',
    'customer_data',
    'internal_only',
    'public_ok',
  ]
  return [...new Set((values ?? []).filter((value): value is MemoryPrivacyDataType => allowed.includes(value)))]
}

function normalizeMemoryEncryption(
  requested: MemoryPrivacyEncryption | undefined,
  dataTypes: MemoryPrivacyDataType[],
): MemoryPrivacyEncryption {
  if (dataTypes.some((type) => ['pii', 'credentials', 'business_secret', 'customer_data'].includes(type))) {
    return 'always_encrypted'
  }
  return requested ?? 'at_rest'
}

import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { and, asc, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentProfileRow,
  ApprovalRequestRow,
  CliProfileRow,
  CliRunMode,
  CliRunRow,
  EmployeeRunRow,
} from '@/db/schema'
import { splitRenderedCliArgs } from '@/lib/cli-command-args'
import { resolveEmployeeRunCliMode } from '@/lib/employee-run-cli-mode'
import { runAgentHubCommand } from '@/server/agenthub-command-runner'
import { evaluateAutonomyAction } from '@/server/autonomy-policy-service'
import { newApprovalRequestId, newCliRunId } from '@/server/ids'

type TemplateValue = string | number | boolean | null | undefined

export interface RunCliProfileArgs {
  cliProfileId: string
  agentProfileId?: string | null
  employeeRunId?: string | null
  variables?: Record<string, TemplateValue>
  stdin?: string | null
  mode?: CliRunMode
}

export async function runCliProfile(args: RunCliProfileArgs): Promise<CliRunRow> {
  const profile = await getRequiredCliProfile(args.cliProfileId)
  const agent = args.agentProfileId ? await getOptionalAgentProfile(args.agentProfileId) : null
  const employeeRun = args.employeeRunId ? await getOptionalEmployeeRun(args.employeeRunId) : null
  const mode = args.mode ?? 'dry_run'
  const variables = buildTemplateVariables(profile, agent, employeeRun, args.variables ?? {})
  const renderedArgs = renderTemplate(profile.argsTemplate, variables)
  const cwdResult = resolveCwd(profile, agent?.id ?? args.agentProfileId ?? null)
  const authError = getAuthorizationError(profile, agent?.id ?? args.agentProfileId ?? null)
  const autonomy = await evaluateAutonomyAction({
    agentProfileId: agent?.id ?? args.agentProfileId ?? null,
    actionType: 'cli_profile',
    resourceType: 'cli_profile',
    resourceId: profile.id,
    requestedMode: mode,
    riskLevel: profile.requiresApproval ? 'high' : 'low',
    payload: {
      command: profile.command,
      renderedArgs,
      cwd: cwdResult.cwd,
      envKeys: Object.keys(profile.env ?? {}).sort(),
    },
  })
  const policyError =
    autonomy.decision.status === 'blocked' ? autonomy.decision.reason : null
  const needsApproval =
    profile.requiresApproval || autonomy.decision.requiresApproval || mode === 'execute' && autonomy.decision.status === 'requires_approval'
  const approvalRequest =
    mode === 'execute' && needsApproval && !cwdResult.error && !authError && !policyError
      ? await createCliExecutionApprovalRequest({
          profile,
          agentProfileId: agent?.id ?? args.agentProfileId ?? null,
          employeeRunId: employeeRun?.id ?? args.employeeRunId ?? null,
          renderedArgs,
          cwd: cwdResult.cwd,
          envKeys: Object.keys(profile.env ?? {}).sort(),
          autonomyDecisionId: autonomy.decision.id,
          riskLevel: autonomy.decision.riskLevel,
        })
      : null
  const executeError =
    mode === 'execute' && approvalRequest
      ? 'CLI execution is waiting for approval.'
      : null
  const error = cwdResult.error ?? authError ?? policyError ?? executeError
  const shouldExecute = mode === 'execute' && !error && !needsApproval
  const commandResult = shouldExecute
    ? await runAgentHubCommand({
        command: profile.command,
        args: splitRenderedCliArgs(renderedArgs),
        cwd: cwdResult.cwd,
        env: profile.env ?? {},
        timeoutMs: profile.timeoutMs,
      })
    : null
  const now = Date.now()
  const status = error
    ? 'blocked'
    : commandResult
      ? commandResult.exitCode === 0
        ? 'complete'
        : 'failed'
      : 'planned'
  const row = {
    id: newCliRunId(),
    cliProfileId: profile.id,
    agentProfileId: agent?.id ?? args.agentProfileId ?? null,
    employeeRunId: employeeRun?.id ?? args.employeeRunId ?? null,
    mode,
    status,
    command: profile.command,
    renderedArgs,
    cwd: cwdResult.cwd,
    envKeys: Object.keys(profile.env ?? {}).sort(),
    stdinPreview: truncatePreview(args.stdin),
    output: commandResult
      ? {
          commandRunner: 'agenthub',
          commandLine: [profile.command, renderedArgs].filter(Boolean).join(' '),
          inputMode: profile.inputMode,
          outputMode: profile.outputMode,
          timeoutMs: profile.timeoutMs,
          exitCode: commandResult.exitCode,
          stdout: commandResult.stdout,
          stderr: commandResult.stderr,
          timedOut: commandResult.timedOut,
          startedAt: commandResult.startedAt,
          finishedAt: commandResult.finishedAt,
        }
      : error
      ? null
      : {
          dryRun: true,
          commandLine: [profile.command, renderedArgs].filter(Boolean).join(' '),
          inputMode: profile.inputMode,
          outputMode: profile.outputMode,
          timeoutMs: profile.timeoutMs,
        },
    error: error ?? (commandResult && commandResult.exitCode !== 0 ? commandResult.stderr || `CLI exited with code ${commandResult.exitCode}` : null),
    requiresApproval:
      needsApproval,
    approvalRequestId: approvalRequest?.id ?? null,
    createdAt: now,
    finishedAt: commandResult ? parseCommandFinishedAt(commandResult.finishedAt, now) : now,
  } satisfies CliRunRow

  await db.insert(schema.cliRuns).values(row)
  return row
}

async function createCliExecutionApprovalRequest(args: {
  profile: CliProfileRow
  agentProfileId: string | null
  employeeRunId: string | null
  renderedArgs: string
  cwd: string
  envKeys: string[]
  autonomyDecisionId: string
  riskLevel: ApprovalRequestRow['riskLevel']
}): Promise<ApprovalRequestRow> {
  const now = Date.now()
  const row: ApprovalRequestRow = {
    id: newApprovalRequestId(),
    conversationId: null,
    runId: args.employeeRunId,
    nodeRunId: null,
    agentProfileId: args.agentProfileId,
    type: 'cli_profile_execute',
    status: 'pending',
    title: `Approve CLI execution: ${args.profile.name}`,
    description: 'A CLI Profile requested live execution. Approval is recorded before any real process can run.',
    riskLevel: args.riskLevel,
    payload: {
      cliProfileId: args.profile.id,
      autonomyDecisionId: args.autonomyDecisionId,
      command: args.profile.command,
      renderedArgs: args.renderedArgs,
      cwd: args.cwd,
      envKeys: args.envKeys,
      timeoutMs: args.profile.timeoutMs,
    },
    response: null,
    createdAt: now,
    resolvedAt: null,
  }
  await db.insert(schema.approvalRequests).values(row)
  return row
}

export async function runCliProfilesForEmployeeRun(args: {
  employeeRun: EmployeeRunRow
  agent: AgentProfileRow
  variables?: Record<string, TemplateValue>
}): Promise<CliRunRow[]> {
  const rows: CliRunRow[] = []
  for (const cliProfileId of args.agent.cliProfileIds) {
    rows.push(
      await runCliProfile({
        cliProfileId,
        agentProfileId: args.agent.id,
        employeeRunId: args.employeeRun.id,
        variables: {
          goal: args.employeeRun.goal,
          agentName: args.agent.name,
          agentRole: args.agent.role,
          employeeRunId: args.employeeRun.id,
          workflowRunId: args.employeeRun.workflowRunId,
          ...args.variables,
        },
        mode: resolveEmployeeRunCliMode(args.agent),
      }),
    )
  }
  return rows
}

export async function listCliRunsForEmployeeRun(employeeRunId: string): Promise<CliRunRow[]> {
  return db.query.cliRuns.findMany({
    where: eq(schema.cliRuns.employeeRunId, employeeRunId),
    orderBy: [asc(schema.cliRuns.createdAt)],
  })
}

export async function listCliRuns(args: {
  cliProfileId?: string
  agentProfileId?: string
  employeeRunId?: string
} = {}): Promise<CliRunRow[]> {
  const filters = [
    args.cliProfileId ? eq(schema.cliRuns.cliProfileId, args.cliProfileId) : undefined,
    args.agentProfileId ? eq(schema.cliRuns.agentProfileId, args.agentProfileId) : undefined,
    args.employeeRunId ? eq(schema.cliRuns.employeeRunId, args.employeeRunId) : undefined,
  ].filter(Boolean)
  return db.query.cliRuns.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    orderBy: [desc(schema.cliRuns.createdAt)],
    limit: 200,
  })
}

async function getRequiredCliProfile(id: string): Promise<CliProfileRow> {
  const profile = await db.query.cliProfiles.findFirst({ where: eq(schema.cliProfiles.id, id) })
  if (!profile) throw new Error(`CLI profile not found: ${id}`)
  return profile
}

async function getOptionalAgentProfile(id: string): Promise<AgentProfileRow | null> {
  return (await db.query.agentProfiles.findFirst({ where: eq(schema.agentProfiles.id, id) })) ?? null
}

async function getOptionalEmployeeRun(id: string): Promise<EmployeeRunRow | null> {
  return (await db.query.employeeRuns.findFirst({ where: eq(schema.employeeRuns.id, id) })) ?? null
}

function buildTemplateVariables(
  profile: CliProfileRow,
  agent: AgentProfileRow | null,
  employeeRun: EmployeeRunRow | null,
  variables: Record<string, TemplateValue>,
): Record<string, TemplateValue> {
  return {
    cliProfileId: profile.id,
    cliProfileName: profile.name,
    agentId: agent?.id,
    agentName: agent?.name,
    agentRole: agent?.role,
    employeeRunId: employeeRun?.id,
    workflowRunId: employeeRun?.workflowRunId,
    goal: employeeRun?.goal,
    ...variables,
  }
}

function renderTemplate(template: string, variables: Record<string, TemplateValue>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => {
    const value = variables[key]
    if (value === null || value === undefined) return ''
    return String(value)
  })
}

function resolveCwd(
  profile: CliProfileRow,
  agentProfileId: string | null,
): { cwd: string; error: string | null } {
  const dataDir = process.env.AGENTHUB_DATA_DIR ?? path.resolve(process.cwd(), '.agenthub-data')
  if (profile.cwdPolicy === 'workspace') {
    const cwd = path.join(dataDir, 'workspaces')
    mkdirSync(cwd, { recursive: true })
    return { cwd, error: null }
  }
  if (profile.cwdPolicy === 'agent_workspace') {
    const cwd = path.join(dataDir, 'employee-workspaces', safeSegment(agentProfileId ?? 'unassigned'))
    mkdirSync(cwd, { recursive: true })
    return { cwd, error: null }
  }
  if (!profile.customCwd) {
    const fallback = path.join(dataDir, 'workspaces')
    mkdirSync(fallback, { recursive: true })
    return { cwd: fallback, error: 'custom cwd policy requires customCwd.' }
  }
  return { cwd: path.resolve(profile.customCwd), error: null }
}

function getAuthorizationError(profile: CliProfileRow, agentProfileId: string | null): string | null {
  if (profile.allowedAgentIds.length === 0) return null
  if (agentProfileId && profile.allowedAgentIds.includes(agentProfileId)) return null
  return 'CLI profile is restricted to specific Agent profiles.'
}

function truncatePreview(value: string | null | undefined): string | null {
  if (!value) return null
  return value.length > 500 ? `${value.slice(0, 500)}...` : value
}

function parseCommandFinishedAt(value: string, fallback: number): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

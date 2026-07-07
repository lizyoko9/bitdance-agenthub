import { and, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentProfileRow,
  AutonomyActionType,
  AutonomyDecisionRow,
  AutonomyDecisionStatus,
  AutonomyLevel,
  JsonObject,
  RiskLevel,
} from '@/db/schema'
import { newAutonomyDecisionId } from '@/server/ids'
import { recordAuditLog } from '@/server/security-service'
import { getUserOverrideBlockReason } from '@/server/user-override-service'

export interface EvaluateAutonomyActionArgs {
  agentProfileId?: string | null
  actionType: AutonomyActionType
  resourceType: string
  resourceId?: string | null
  requestedMode?: string
  riskLevel?: RiskLevel
  payload?: JsonObject
}

export interface AutonomyDecisionResult {
  decision: AutonomyDecisionRow
  agent: AgentProfileRow | null
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 }

const MANDATORY_APPROVAL_ACTIONS = new Set<AutonomyActionType>([
  'login',
  'payment',
  'send_message',
  'system_setting',
])

export async function evaluateAutonomyAction(
  args: EvaluateAutonomyActionArgs,
): Promise<AutonomyDecisionResult> {
  const agent = args.agentProfileId ? await getOptionalAgentProfile(args.agentProfileId) : null
  const autonomyLevel = getAutonomyLevel(agent)
  const riskLevel = maxRisk(defaultRiskForAction(args.actionType), args.riskLevel)
  const requestedMode = args.requestedMode?.trim() || 'dry_run'
  const userOverrideBlockReason = await getUserOverrideBlockReason({
    actionType: args.actionType,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
  })
  const permissionBlockReason = userOverrideBlockReason ?? getPermissionBlockReason(agent, args.actionType)
  const { status, requiresApproval, reason } = decide({
    autonomyLevel,
    actionType: args.actionType,
    requestedMode,
    riskLevel,
    permissionBlockReason,
  })
  const row: AutonomyDecisionRow = {
    id: newAutonomyDecisionId(),
    agentProfileId: agent?.id ?? args.agentProfileId ?? null,
    actionType: args.actionType,
    resourceType: args.resourceType.trim(),
    resourceId: normalizeNullable(args.resourceId),
    requestedMode,
    autonomyLevel,
    riskLevel,
    status,
    requiresApproval,
    reason,
    policySnapshot: {
      autonomyPolicy: agent?.autonomyPolicy ?? {},
      permissionPolicy: agent?.permissionPolicy ?? {},
      payload: args.payload ?? {},
    },
    createdAt: Date.now(),
  }
  await db.insert(schema.autonomyDecisions).values(row)
  await recordAuditLog({
    actorType: agent ? 'agent' : 'system',
    actorId: agent?.id ?? null,
    action: `autonomy.evaluate.${args.actionType}`,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    status: auditStatusForDecision(row.status),
    riskLevel: row.riskLevel,
    message: row.reason,
    metadata: {
      autonomyDecisionId: row.id,
      requestedMode: row.requestedMode,
      autonomyLevel: row.autonomyLevel,
      requiresApproval: row.requiresApproval,
    },
  })
  return { decision: row, agent }
}

export async function listAutonomyDecisions(args: {
  agentProfileId?: string
  resourceType?: string
  resourceId?: string
  limit?: number
} = {}): Promise<AutonomyDecisionRow[]> {
  const filters = [
    args.agentProfileId
      ? eq(schema.autonomyDecisions.agentProfileId, args.agentProfileId)
      : undefined,
    args.resourceType ? eq(schema.autonomyDecisions.resourceType, args.resourceType) : undefined,
    args.resourceId ? eq(schema.autonomyDecisions.resourceId, args.resourceId) : undefined,
  ].filter(Boolean)

  return db.query.autonomyDecisions.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    orderBy: [desc(schema.autonomyDecisions.createdAt)],
    limit: Math.min(Math.max(args.limit ?? 100, 1), 500),
  })
}

function decide(args: {
  autonomyLevel: AutonomyLevel
  actionType: AutonomyActionType
  requestedMode: string
  riskLevel: RiskLevel
  permissionBlockReason: string | null
}): { status: AutonomyDecisionStatus; requiresApproval: boolean; reason: string } {
  if (args.permissionBlockReason) {
    return { status: 'blocked', requiresApproval: false, reason: args.permissionBlockReason }
  }
  if (args.requestedMode !== 'execute') {
    return {
      status: 'allowed',
      requiresApproval: false,
      reason: `Dry-run/proposal mode is allowed under ${args.autonomyLevel}.`,
    }
  }
  if (args.autonomyLevel === 'observe_only') {
    return {
      status: 'blocked',
      requiresApproval: false,
      reason: 'Autonomy level observe_only blocks execution.',
    }
  }
  if (args.autonomyLevel === 'propose_only') {
    return {
      status: 'blocked',
      requiresApproval: false,
      reason: 'Autonomy level propose_only allows planning but blocks execution.',
    }
  }
  if (MANDATORY_APPROVAL_ACTIONS.has(args.actionType)) {
    return {
      status: 'requires_approval',
      requiresApproval: true,
      reason: `${args.actionType} always requires approval.`,
    }
  }
  if (args.autonomyLevel === 'execute_with_approval') {
    return {
      status: 'requires_approval',
      requiresApproval: true,
      reason: 'Autonomy level execute_with_approval requires approval before execution.',
    }
  }
  if (args.autonomyLevel === 'execute_low_risk' && args.riskLevel !== 'low') {
    return {
      status: 'requires_approval',
      requiresApproval: true,
      reason: `Risk ${args.riskLevel} exceeds execute_low_risk automatic scope.`,
    }
  }
  if (args.autonomyLevel === 'fully_autonomous' && args.riskLevel === 'high') {
    return {
      status: 'requires_approval',
      requiresApproval: true,
      reason: 'High-risk actions still require approval.',
    }
  }
  return {
    status: 'allowed',
    requiresApproval: false,
    reason: `Action is allowed under ${args.autonomyLevel} with ${args.riskLevel} risk.`,
  }
}

function defaultRiskForAction(actionType: AutonomyActionType): RiskLevel {
  if (actionType === 'cli_profile') return 'low'
  if (
    actionType === 'read_file' ||
    actionType === 'network_request' ||
    actionType === 'browser_operation'
  ) {
    return 'low'
  }
  if (
    actionType === 'write_file' ||
    actionType === 'run_command' ||
    actionType === 'software_command' ||
    actionType === 'mcp_tool'
  ) {
    return 'medium'
  }
  return 'high'
}

function getAutonomyLevel(agent: AgentProfileRow | null): AutonomyLevel {
  const level = agent?.autonomyPolicy.level
  if (
    level === 'observe_only' ||
    level === 'propose_only' ||
    level === 'execute_with_approval' ||
    level === 'execute_low_risk' ||
    level === 'fully_autonomous'
  ) {
    return level
  }
  return 'execute_with_approval'
}

function getPermissionBlockReason(
  agent: AgentProfileRow | null,
  actionType: AutonomyActionType,
): string | null {
  if (!agent) return null
  const policy = agent.permissionPolicy
  const denied = permissionPathsForAction(actionType).some((path) => getPath(policy, path) === false)
  return denied ? `Permission policy blocks ${actionType}.` : null
}

function permissionPathsForAction(actionType: AutonomyActionType): string[][] {
  if (actionType === 'read_file') return [['canReadFiles'], ['files', 'read']]
  if (actionType === 'write_file' || actionType === 'delete_file') {
    return [['canWriteFiles'], ['files', 'write']]
  }
  if (actionType === 'run_command' || actionType === 'install_dependency') {
    return [['canRunCommands'], ['command', 'run']]
  }
  if (actionType === 'cli_profile') return [['canRunCommands'], ['commands', 'run'], ['cli', 'run']]
  if (actionType === 'network_request') return [['canUseNetwork'], ['network', 'access']]
  if (actionType === 'browser_operation') return [['canOperateBrowser'], ['browser', 'operate']]
  if (actionType === 'desktop_operation') return [['canOperateDesktop'], ['desktop', 'operate']]
  if (actionType === 'software_command') return [['canUseSoftware'], ['software', 'operate']]
  if (actionType === 'mcp_tool') return [['canUseMcp'], ['mcp', 'use'], ['tools', 'use']]
  if (actionType === 'mobile_operation') return [['canOperateMobile'], ['mobile', 'operate']]
  if (actionType === 'send_message') return [['canSendMessages'], ['messages', 'send']]
  if (actionType === 'system_setting') return [['canModifySystemSettings'], ['system', 'settings']]
  if (actionType === 'login') return [['canLogin'], ['account', 'login']]
  if (actionType === 'payment') return [['canPay'], ['payment', 'execute']]
  return []
}

function getPath(source: JsonObject, path: string[]): unknown {
  let current: unknown = source
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function maxRisk(left: RiskLevel, right: RiskLevel | undefined): RiskLevel {
  if (!right) return left
  return RISK_ORDER[right] > RISK_ORDER[left] ? right : left
}

function auditStatusForDecision(status: AutonomyDecisionStatus): 'allowed' | 'blocked' | 'warning' {
  if (status === 'allowed') return 'allowed'
  if (status === 'blocked') return 'blocked'
  return 'warning'
}

async function getOptionalAgentProfile(id: string): Promise<AgentProfileRow | null> {
  return (await db.query.agentProfiles.findFirst({ where: eq(schema.agentProfiles.id, id) })) ?? null
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

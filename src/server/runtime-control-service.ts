import { execFile, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentWorkstationRow,
  ApprovalRequestRow,
  ComputerActionEventRow,
  ComputerActionStatus,
  ComputerSessionRow,
  JsonObject,
  ResourceLockRow,
  ResourceType,
  WorkstationStatus,
} from '@/db/schema'
import {
  recordComputerSessionAction,
  getRequiredComputerSession,
} from '@/server/computer-session-manager'
import { evaluateProductionGoLiveRuntimeGate } from '@/server/go-live-enforcement-service'
import {
  acquireResourceLock,
  releaseResourceLock,
} from '@/server/resource-lock-service'
import { recordAuditLog } from '@/server/security-service'

const execFileAsync = promisify(execFile)
export const DESKTOP_TARGET_ALLOWLIST_ENV = 'AGENTHUB_ALLOWED_DESKTOP_TARGETS'
export const MOBILE_DEVICE_ALLOWLIST_ENV = 'AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS'
export const MOBILE_APP_ALLOWLIST_ENV = 'AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES'
export const ADB_PATH_ENV = 'AGENTHUB_ADB_PATH'
export const ADB_ARGS_PREFIX_ENV = 'AGENTHUB_ADB_ARGS_PREFIX_JSON'
export const ADB_SEARCH_ROOTS_ENV = 'AGENTHUB_ADB_SEARCH_ROOTS'
export const WORKSTATION_TARGET_ALLOWLIST_ENV = 'AGENTHUB_ALLOWED_WORKSTATION_TARGETS'
export const RUNTIME_CONTROL_KILL_SWITCH_ENV = 'AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH'

export type RuntimeControlScope = 'desktop' | 'mobile' | 'workstation'

export type RuntimeControlActionType =
  | 'observe_windows'
  | 'capture_screenshot'
  | 'focus_window'
  | 'click'
  | 'scroll'
  | 'type_text'
  | 'key_press'
  | 'list_devices'
  | 'mobile_tap'
  | 'mobile_swipe'
  | 'mobile_text'
  | 'mobile_keyevent'
  | 'mobile_screenshot'
  | 'validate_workstation'
  | 'launch_remote_session'
  | 'release_workstation'

export interface ExecuteRuntimeControlActionArgs {
  computerSessionId: string
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target?: string | null
  input?: JsonObject
  live?: boolean
  confirmRisk?: boolean
  approvalRequestId?: string | null
  trustedApprovalAlreadyValidated?: boolean
}

export interface RuntimeControlApprovalInputArgs {
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target?: string | null
  input?: JsonObject
  live?: boolean
}

export interface RuntimeControlActionResult {
  action: ComputerActionEventRow
  resourceLock: ResourceLockRow | null
  releasedResourceLock: ResourceLockRow | null
  status: ComputerActionStatus
  liveExecuted: boolean
  gate: RuntimeControlGate
  output: JsonObject
}

export interface RuntimeControlGate {
  requiredEnvVar: string | null
  envEnabled: boolean
  confirmRisk: boolean
  liveRequested: boolean
  readOnly: boolean
  approvalRequired: boolean
  approvalRequestId: string | null
  approvalSatisfied: boolean
  runtimeControlKillSwitchEnvVar?: string
  runtimeControlKillSwitchActive?: boolean
  desktopTargetAllowlistRequired?: boolean
  desktopTargetAllowlistEnvVar?: string
  desktopTarget?: string | null
  desktopTargetAllowed?: boolean
  mobileDeviceAllowlistRequired?: boolean
  mobileDeviceAllowlistEnvVar?: string
  mobileDeviceId?: string | null
  mobileDeviceAllowed?: boolean
  mobileAppAllowlistRequired?: boolean
  mobileAppAllowlistEnvVar?: string
  mobileAppPackage?: string | null
  mobileAppAllowed?: boolean
  workstationTargetAllowlistRequired?: boolean
  workstationTargetAllowlistEnvVar?: string
  workstationTarget?: string | null
  workstationTargetAllowed?: boolean
  goLiveRequired?: boolean
  goLiveDecisionHash?: string | null
  goLiveLatestDecisionHash?: string | null
  goLiveDecisionSatisfied?: boolean
  goLiveLatestDecisionCustomerAuthorizationEvidenceHash?: string | null
  goLiveLatestDecisionCustomerAuthorizationEvidenceMatched?: boolean
  goLiveLatestDecisionEnvironmentFingerprintPresent?: boolean
  goLiveLatestDecisionEnvironmentFingerprintMatched?: boolean
  goLiveLatestDecisionEnvironmentFingerprintMismatches?: string[]
  goLiveCustomerAuthorizationRequired?: boolean
  goLiveCustomerAuthorized?: boolean
  goLiveCustomerAuthorizationSwitchEnabled?: boolean
  goLiveCustomerAuthorizationEvidenceHashRequired?: boolean
  goLiveCustomerAuthorizationEvidenceHash?: string | null
  goLiveCustomerAuthorizationEvidenceMatched?: boolean
  goLiveCustomerAuthorizationEvidenceBoundToDecision?: boolean
  goLiveLivePilotLeaseRequired?: boolean
  goLiveLivePilotLeaseHash?: string | null
  goLiveLatestLivePilotLeaseHash?: string | null
  goLiveLatestLivePilotLeaseActive?: boolean
  goLiveLatestLivePilotLeaseExpiresAt?: number | null
  goLiveLivePilotLeaseMatched?: boolean
  goLiveLivePilotLeaseExpired?: boolean
  goLiveLivePilotLeaseBoundToDecision?: boolean
  goLiveLivePilotLeaseBoundToCustomerAuthorization?: boolean
  goLiveLivePilotLeaseBoundToEnvironmentFingerprint?: boolean
  goLiveLivePilotSessionRequired?: boolean
  goLiveLatestLivePilotSessionId?: string | null
  goLiveLatestLivePilotSessionHash?: string | null
  goLiveLatestLivePilotSessionStatus?: 'active' | 'blocked' | 'expired' | 'stopped' | null
  goLiveLatestLivePilotSessionActive?: boolean
  goLiveLatestLivePilotSessionExpiresAt?: number | null
  goLiveLivePilotSessionBoundToLease?: boolean
  goLiveLivePilotSessionBoundToDecision?: boolean
  goLiveLivePilotSessionBoundToCustomerAuthorization?: boolean
  goLiveLivePilotSessionBoundToEnvironmentFingerprint?: boolean
  allowed: boolean
  reason: string
}

type WorkstationLaunchKind =
  | 'rdp_file'
  | 'rdp_host'
  | 'vnc_url'
  | 'browser_url'
  | 'hyperv'
  | 'virtualbox'
  | 'vmware'
  | 'unsupported'

interface WorkstationLaunchPlan {
  kind: WorkstationLaunchKind
  command: string | null
  args: string[]
  targetPreview: string | null
  blockingReasons: string[]
  warnings: string[]
}

interface WorkstationRdpFileReference {
  absolutePath: string
  fileName: string
  relativePath: string
  directory: 'workstation_temp'
  pathRedacted: true
}

interface SessionOutputFileReference {
  absolutePath: string
  fileName: string
  relativePath: string
  directory: 'session_temp'
  pathRedacted: true
}

export async function executeRuntimeControlAction(
  args: ExecuteRuntimeControlActionArgs,
): Promise<RuntimeControlActionResult> {
  const session = await getRequiredComputerSession(args.computerSessionId)
  const requirement = lockRequirementForAction(args)
  const approvalInput = await buildRuntimeControlApprovalInput(args)
  const inputHash = runtimeControlInputHash(approvalInput)
  const gate = await evaluateControlGateForSession(session, args, inputHash)
  let lock: ResourceLockRow | null = null
  let releasedLock: ResourceLockRow | null = null

  if (requirement) {
    lock = await acquireResourceLock({
      resourceType: requirement.resourceType,
      resourceId: requirement.resourceId,
      ownerRunId: session.employeeRunId ?? session.workflowRunId ?? session.id,
      ownerAgentId: session.agentProfileId ?? 'system',
      ttlMs: requirement.ttlMs,
    })
  }

  let status: ComputerActionStatus = 'planned'
  let output: JsonObject = {
    dryRun: !args.live,
    liveRequested: Boolean(args.live),
    liveExecuted: false,
    scope: args.scope,
    actionType: args.actionType,
    approvalInput,
    inputHash,
    gate: gate as unknown as JsonObject,
    resourceLockId: lock?.id ?? null,
  }

  try {
    if (!gate.allowed) {
      status = 'blocked'
      output = { ...output, error: gate.reason }
    } else if (!args.live) {
      const plan = await planRuntimeControlAction(session, args)
      status = plan.status
      output = {
        ...output,
        planned: true,
        message: 'Runtime control action was planned only; live execution was not requested.',
        ...plan.output,
      }
    } else {
      const liveOutput = await executeLiveControl(session, args)
      status = liveOutput.status
      output = {
        ...output,
        ...liveOutput.output,
        liveExecuted: liveOutput.status === 'complete',
      }
    }
  } catch (err) {
    status = 'failed'
    output = { ...output, error: formatError(err) }
  } finally {
    if (lock) releasedLock = await releaseResourceLock(lock.id)
  }

  const action = await recordComputerSessionAction(session.id, {
    actionType: `runtime_control.${args.scope}.${args.actionType}`,
    target: args.target ?? defaultTargetForAction(args),
    input: {
      ...(args.input ?? {}),
      live: Boolean(args.live),
      confirmRisk: Boolean(args.confirmRisk),
      approvalRequestId: args.approvalRequestId ?? null,
      approvalInput,
      inputHash,
      gate: gate as unknown as JsonObject,
    },
    output,
    status,
  })

  await recordAuditLog({
    actorType: session.agentProfileId ? 'agent' : 'system',
    actorId: session.agentProfileId,
    action: `runtime_control.${args.scope}.${args.actionType}`,
    resourceType: 'computer_session',
    resourceId: session.id,
    status: status === 'blocked' ? 'blocked' : status === 'failed' ? 'warning' : 'allowed',
    riskLevel: gate.readOnly ? 'low' : 'high',
    message: gate.allowed
      ? `Runtime control action ${args.actionType} finished with status ${status}.`
      : gate.reason,
    metadata: {
      actionEventId: action.id,
      resourceLockId: lock?.id ?? null,
      releasedResourceLockId: releasedLock?.id ?? null,
      liveExecuted: output.liveExecuted === true,
      inputHash,
      gate: gate as unknown as JsonObject,
    },
  })

  return {
    action,
    resourceLock: lock,
    releasedResourceLock: releasedLock,
    status,
    liveExecuted: output.liveExecuted === true,
    gate,
    output,
  }
}

export function evaluateControlGate(args: {
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target?: string | null
  input?: JsonObject
  live?: boolean
  confirmRisk?: boolean
  approvalRequestId?: string | null
}): RuntimeControlGate {
  const readOnly = isReadOnlyAction(args.actionType)
  const lowRiskLive = isLowRiskLiveAction(args.actionType)
  const approvalRequired = Boolean(args.live) && !readOnly && !lowRiskLive
  const requiredEnvVar = readOnly || lowRiskLive ? null : requiredEnvForScope(args.scope, args.actionType)
  const envEnabled = requiredEnvVar ? process.env[requiredEnvVar] === '1' : true
  const liveRequested = Boolean(args.live)
  const confirmRisk = Boolean(args.confirmRisk)
  const approvalRequestId = args.approvalRequestId ?? null
  const killSwitchActive = process.env[RUNTIME_CONTROL_KILL_SWITCH_ENV] === '1'
  const killSwitchGateFields = {
    runtimeControlKillSwitchEnvVar: RUNTIME_CONTROL_KILL_SWITCH_ENV,
    runtimeControlKillSwitchActive: killSwitchActive,
  }
  const desktopTargetGate = evaluateDesktopTargetAllowlist({
    scope: args.scope,
    actionType: args.actionType,
    target: args.target,
    input: args.input,
    live: args.live,
    readOnly,
    lowRiskLive,
  })
  const mobileDeviceGate = evaluateMobileDeviceAllowlist({
    scope: args.scope,
    actionType: args.actionType,
    target: args.target,
    input: args.input,
    live: args.live,
    readOnly,
    lowRiskLive,
  })
  const mobileAppGate = evaluateMobileAppAllowlist({
    scope: args.scope,
    actionType: args.actionType,
    input: args.input,
    live: args.live,
    readOnly,
    lowRiskLive,
  })
  const workstationTargetGate = evaluateWorkstationTargetAllowlist({
    scope: args.scope,
    actionType: args.actionType,
    target: args.target,
    input: args.input,
    live: args.live,
    readOnly,
    lowRiskLive,
  })
  if (!liveRequested) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: true,
      reason: 'Dry-run planning does not require a production execution gate.',
    }
  }
  if (readOnly || lowRiskLive) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: true,
      reason: readOnly
        ? 'Read-only runtime observation is allowed.'
        : 'Low-risk workstation bookkeeping action is allowed.',
    }
  }
  if (killSwitchActive) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: `High-risk runtime control is stopped by ${RUNTIME_CONTROL_KILL_SWITCH_ENV}=1.`,
    }
  }
  if (!confirmRisk) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: 'High-risk runtime control requires confirmRisk=true.',
    }
  }
  if (!envEnabled) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: `High-risk runtime control requires ${requiredEnvVar}=1.`,
    }
  }
  if (!desktopTargetGate.allowed) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: desktopTargetGate.reason,
    }
  }
  if (!mobileDeviceGate.allowed) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: mobileDeviceGate.reason,
    }
  }
  if (!mobileAppGate.allowed) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: mobileAppGate.reason,
    }
  }
  if (!workstationTargetGate.allowed) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: workstationTargetGate.reason,
    }
  }
  if (!approvalRequestId) {
    return {
      requiredEnvVar,
      envEnabled,
      confirmRisk,
      liveRequested,
      readOnly,
      approvalRequired,
      approvalRequestId,
      approvalSatisfied: false,
      ...killSwitchGateFields,
      ...desktopTargetGate.gateFields,
      ...mobileDeviceGate.gateFields,
      ...mobileAppGate.gateFields,
      ...workstationTargetGate.gateFields,
      allowed: false,
      reason: 'High-risk runtime control requires an approved runtime-control approvalRequestId.',
    }
  }
  return {
    requiredEnvVar,
    envEnabled,
    confirmRisk,
    liveRequested,
    readOnly,
    approvalRequired,
    approvalRequestId,
    approvalSatisfied: false,
    ...killSwitchGateFields,
    ...desktopTargetGate.gateFields,
    ...mobileDeviceGate.gateFields,
    ...mobileAppGate.gateFields,
    ...workstationTargetGate.gateFields,
    allowed: true,
    reason: 'Production runtime control base gate passed; approval binding still needs validation.',
  }
}

function evaluateDesktopTargetAllowlist(args: {
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target?: string | null
  input?: JsonObject
  live?: boolean
  readOnly: boolean
  lowRiskLive: boolean
}): {
  allowed: boolean
  reason: string
  gateFields: Pick<
    RuntimeControlGate,
    | 'desktopTargetAllowlistRequired'
    | 'desktopTargetAllowlistEnvVar'
    | 'desktopTarget'
    | 'desktopTargetAllowed'
  >
} {
  const required =
    Boolean(args.live) &&
    args.scope === 'desktop' &&
    !args.readOnly &&
    !args.lowRiskLive
  if (!required) {
    return {
      allowed: true,
      reason: 'Desktop target allowlist is not required for this runtime action.',
      gateFields:
        args.scope === 'desktop'
          ? {
              desktopTargetAllowlistRequired: false,
              desktopTargetAllowlistEnvVar: DESKTOP_TARGET_ALLOWLIST_ENV,
              desktopTarget: desktopTargetForAction(args.input, args.target),
              desktopTargetAllowed: true,
            }
          : {},
    }
  }

  const candidates = desktopTargetCandidatesForAction(args.input, args.target)
  const target = candidates[0] ?? null
  const allowlist = parseDesktopTargetAllowlist()
  const allowed = candidates.some((candidate) => allowlist.allowAny || allowlist.ids.has(candidate.normalized))
  const gateFields = {
    desktopTargetAllowlistRequired: true,
    desktopTargetAllowlistEnvVar: DESKTOP_TARGET_ALLOWLIST_ENV,
    desktopTarget: target?.raw ?? null,
    desktopTargetAllowed: allowed,
  }
  if (!target) {
    return {
      allowed: false,
      reason: `Desktop runtime control requires an explicit target, processName, titleContains, or targetWindowTitle plus ${DESKTOP_TARGET_ALLOWLIST_ENV}.`,
      gateFields,
    }
  }
  if (!allowlist.configured) {
    return {
      allowed: false,
      reason: `Desktop runtime control requires ${DESKTOP_TARGET_ALLOWLIST_ENV} to list approved windows or processes before live actions can run.`,
      gateFields,
    }
  }
  if (!allowed) {
    return {
      allowed: false,
      reason: `Desktop target ${target.raw} is not in ${DESKTOP_TARGET_ALLOWLIST_ENV}.`,
      gateFields,
    }
  }
  return {
    allowed: true,
    reason: `Desktop target ${target.raw} is allowed by ${DESKTOP_TARGET_ALLOWLIST_ENV}.`,
    gateFields,
  }
}

function desktopTargetForAction(input: JsonObject | undefined, target?: string | null): string | null {
  return desktopTargetCandidatesForAction(input, target)[0]?.raw ?? null
}

function desktopTargetCandidatesForAction(
  input: JsonObject | undefined,
  target?: string | null,
): Array<{ raw: string; normalized: string }> {
  const rawValues = [
    target,
    stringInput(input, 'desktopTarget'),
    stringInput(input, 'targetWindow'),
    stringInput(input, 'targetWindowTitle'),
    stringInput(input, 'windowTitle'),
    stringInput(input, 'titleContains'),
    stringInput(input, 'processName'),
    stringInput(input, 'targetProcessName'),
  ]
  const seen = new Set<string>()
  const candidates: Array<{ raw: string; normalized: string }> = []
  for (const value of rawValues) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const normalized = normalizeDesktopAllowlistValue(trimmed)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    candidates.push({ raw: trimmed, normalized })
  }
  return candidates
}

function parseDesktopTargetAllowlist(): {
  configured: boolean
  allowAny: boolean
  ids: Set<string>
} {
  return parseDelimitedAllowlistEnv(DESKTOP_TARGET_ALLOWLIST_ENV, normalizeDesktopAllowlistValue)
}

function normalizeDesktopAllowlistValue(value: string): string {
  return value.trim().toLowerCase()
}

function desktopActionRequiresFocus(actionType: RuntimeControlActionType): boolean {
  return actionType === 'click' || actionType === 'scroll' || actionType === 'type_text' || actionType === 'key_press'
}

function desktopFocusTargetForAction(
  actionType: RuntimeControlActionType,
  input: JsonObject | undefined,
  target?: string | null,
): {
  required: boolean
  target: string | null
  candidates: string[]
  processName: string | null
  titleContains: string | null
} {
  const required = desktopActionRequiresFocus(actionType)
  const candidates = desktopTargetCandidatesForAction(input, target).map((candidate) => candidate.raw)
  const processName = stringInput(input, 'processName') ?? stringInput(input, 'targetProcessName')
  const titleContains =
    stringInput(input, 'titleContains') ??
    stringInput(input, 'targetWindowTitle') ??
    stringInput(input, 'windowTitle') ??
    stringInput(input, 'targetWindow') ??
    stringInput(input, 'desktopTarget') ??
    target?.trim() ??
    null
  return {
    required,
    target: processName ?? titleContains ?? candidates[0] ?? null,
    candidates,
    processName,
    titleContains,
  }
}

function desktopFocusApprovalInput(focusTarget: ReturnType<typeof desktopFocusTargetForAction>): JsonObject {
  if (!focusTarget.required) return {}
  return {
    desktopFocusRequired: true,
    desktopFocusTarget: focusTarget.target,
    desktopFocusProcessName: focusTarget.processName,
    desktopFocusTitleContains: focusTarget.titleContains,
  }
}

function desktopFocusPlanOutput(focusTarget: ReturnType<typeof desktopFocusTargetForAction>): JsonObject {
  return {
    desktopFocusRequired: focusTarget.required,
    desktopFocusTarget: focusTarget.target,
    desktopFocusProcessName: focusTarget.processName,
    desktopFocusTitleContains: focusTarget.titleContains,
    desktopFocusTargetCandidates: focusTarget.candidates,
  }
}

async function focusDesktopWindowForAction(
  focusTarget: ReturnType<typeof desktopFocusTargetForAction>,
): Promise<{ ok: true; focusedWindow: string } | { ok: false; error: string; stderr: string }> {
  if (!focusTarget.required) return { ok: true, focusedWindow: 'not_required' }
  if (!focusTarget.processName && !focusTarget.titleContains) {
    return {
      ok: false,
      error: 'Desktop live control requires processName, titleContains, targetWindowTitle, desktopTarget, or target before acting on the physical desktop.',
      stderr: '',
    }
  }
  const result = await runCommand(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', FOCUS_WINDOW_SCRIPT],
    {
      AGENTHUB_FOCUS_PROCESS: focusTarget.processName ?? '',
      AGENTHUB_FOCUS_TITLE: focusTarget.titleContains ?? '',
    },
  )
  if (!result.ok) {
    return {
      ok: false,
      error: `Desktop target window was not focused before the live action: ${result.error}`,
      stderr: result.stderr,
    }
  }
  return { ok: true, focusedWindow: firstLine(result.stdout) ?? 'unknown' }
}

function evaluateMobileDeviceAllowlist(args: {
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target?: string | null
  input?: JsonObject
  live?: boolean
  readOnly: boolean
  lowRiskLive: boolean
}): {
  allowed: boolean
  reason: string
  gateFields: Pick<
    RuntimeControlGate,
    | 'mobileDeviceAllowlistRequired'
    | 'mobileDeviceAllowlistEnvVar'
    | 'mobileDeviceId'
    | 'mobileDeviceAllowed'
  >
} {
  const required =
    Boolean(args.live) &&
    args.scope === 'mobile' &&
    !args.readOnly &&
    !args.lowRiskLive
  if (!required) {
    return {
      allowed: true,
      reason: 'Mobile device allowlist is not required for this runtime action.',
      gateFields:
        args.scope === 'mobile'
          ? {
              mobileDeviceAllowlistRequired: false,
              mobileDeviceAllowlistEnvVar: MOBILE_DEVICE_ALLOWLIST_ENV,
              mobileDeviceId: mobileDeviceIdForAction(args.input, args.target),
              mobileDeviceAllowed: true,
            }
          : {},
    }
  }

  const deviceId = mobileDeviceIdForAction(args.input, args.target)
  const allowlist = parseMobileDeviceAllowlist()
  const baseGateFields = {
    mobileDeviceAllowlistRequired: true,
    mobileDeviceAllowlistEnvVar: MOBILE_DEVICE_ALLOWLIST_ENV,
    mobileDeviceId: deviceId,
  }
  if (!deviceId) {
    return {
      allowed: false,
      reason: `Mobile runtime control requires an explicit input.deviceId or target plus ${MOBILE_DEVICE_ALLOWLIST_ENV}.`,
      gateFields: {
        ...baseGateFields,
        mobileDeviceAllowed: false,
      },
    }
  }
  const allowed = allowlist.allowAny || allowlist.ids.has(deviceId)
  const gateFields = {
    ...baseGateFields,
    mobileDeviceAllowed: allowed,
  }
  if (!allowlist.configured) {
    return {
      allowed: false,
      reason: `Mobile runtime control requires ${MOBILE_DEVICE_ALLOWLIST_ENV} to list approved device ids before live actions can run.`,
      gateFields,
    }
  }
  if (!allowed) {
    return {
      allowed: false,
      reason: `Mobile device ${deviceId} is not in ${MOBILE_DEVICE_ALLOWLIST_ENV}.`,
      gateFields,
    }
  }
  return {
    allowed: true,
    reason: `Mobile device ${deviceId} is allowed by ${MOBILE_DEVICE_ALLOWLIST_ENV}.`,
    gateFields,
  }
}

function mobileDeviceIdForAction(input: JsonObject | undefined, target?: string | null): string | null {
  const explicit = stringInput(input, 'deviceId') ?? target ?? null
  const trimmed = explicit?.trim()
  return trimmed ? trimmed : null
}

function parseMobileDeviceAllowlist(): {
  configured: boolean
  allowAny: boolean
  ids: Set<string>
} {
  return parseDelimitedAllowlistEnv(MOBILE_DEVICE_ALLOWLIST_ENV, (value) => value.trim())
}

function evaluateMobileAppAllowlist(args: {
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  input?: JsonObject
  live?: boolean
  readOnly: boolean
  lowRiskLive: boolean
}): {
  allowed: boolean
  reason: string
  gateFields: Pick<
    RuntimeControlGate,
    | 'mobileAppAllowlistRequired'
    | 'mobileAppAllowlistEnvVar'
    | 'mobileAppPackage'
    | 'mobileAppAllowed'
  >
} {
  const required =
    Boolean(args.live) &&
    args.scope === 'mobile' &&
    isMobileControlAction(args.actionType) &&
    !args.readOnly &&
    !args.lowRiskLive
  if (!required) {
    return {
      allowed: true,
      reason: 'Mobile app allowlist is not required for this runtime action.',
      gateFields:
        args.scope === 'mobile'
          ? {
              mobileAppAllowlistRequired: false,
              mobileAppAllowlistEnvVar: MOBILE_APP_ALLOWLIST_ENV,
              mobileAppPackage: mobileAppPackageForAction(args.input),
              mobileAppAllowed: true,
            }
          : {},
    }
  }

  const appPackage = mobileAppPackageForAction(args.input)
  const allowlist = parseMobileAppAllowlist()
  const baseGateFields = {
    mobileAppAllowlistRequired: true,
    mobileAppAllowlistEnvVar: MOBILE_APP_ALLOWLIST_ENV,
    mobileAppPackage: appPackage,
  }
  if (!appPackage) {
    return {
      allowed: false,
      reason: `Mobile runtime control requires input.appPackage, packageName, targetPackage, or mobileAppPackage plus ${MOBILE_APP_ALLOWLIST_ENV}.`,
      gateFields: {
        ...baseGateFields,
        mobileAppAllowed: false,
      },
    }
  }
  const normalized = normalizeMobileAppPackage(appPackage)
  const allowed = allowlist.allowAny || allowlist.ids.has(normalized)
  const gateFields = {
    ...baseGateFields,
    mobileAppAllowed: allowed,
  }
  if (!allowlist.configured) {
    return {
      allowed: false,
      reason: `Mobile runtime control requires ${MOBILE_APP_ALLOWLIST_ENV} to list approved app packages before live phone actions can run.`,
      gateFields,
    }
  }
  if (!allowed) {
    return {
      allowed: false,
      reason: `Mobile app package ${appPackage} is not in ${MOBILE_APP_ALLOWLIST_ENV}.`,
      gateFields,
    }
  }
  return {
    allowed: true,
    reason: `Mobile app package ${appPackage} is allowed by ${MOBILE_APP_ALLOWLIST_ENV}.`,
    gateFields,
  }
}

function isMobileControlAction(actionType: RuntimeControlActionType): boolean {
  return (
    actionType === 'mobile_tap' ||
    actionType === 'mobile_swipe' ||
    actionType === 'mobile_text' ||
    actionType === 'mobile_keyevent'
  )
}

function mobileAppPackageForAction(input: JsonObject | undefined): string | null {
  return (
    stringInput(input, 'appPackage') ??
    stringInput(input, 'packageName') ??
    stringInput(input, 'targetPackage') ??
    stringInput(input, 'mobileAppPackage')
  )
}

function parseMobileAppAllowlist(): {
  configured: boolean
  allowAny: boolean
  ids: Set<string>
} {
  return parseDelimitedAllowlistEnv(MOBILE_APP_ALLOWLIST_ENV, normalizeMobileAppPackage)
}

function normalizeMobileAppPackage(value: string): string {
  return value.trim().toLowerCase()
}

type MobileForegroundCheck =
  | {
      ok: true
      requiredPackage: string
      foregroundPackage: string
    }
  | {
      ok: false
      requiredPackage: string | null
      foregroundPackage: string | null
      error: string
      stderr: string
    }

async function verifyMobileForegroundApp(
  adb: ResolvedAdbCommand,
  adbArgs: string[],
  input: JsonObject | undefined,
): Promise<MobileForegroundCheck> {
  const requiredPackage = mobileAppPackageForAction(input)
  if (!requiredPackage) {
    return {
      ok: false,
      requiredPackage: null,
      foregroundPackage: null,
      error: 'Mobile live control requires a target app package before sending input.',
      stderr: '',
    }
  }

  const result = await runAdbCommand(adb, [...adbArgs, 'shell', 'dumpsys', 'window'])
  if (!result.ok) {
    return {
      ok: false,
      requiredPackage,
      foregroundPackage: null,
      error: `Unable to inspect foreground mobile app before live action: ${result.error}`,
      stderr: result.stderr,
    }
  }

  const foregroundPackage = parseAndroidForegroundPackage(`${result.stdout}\n${result.stderr}`)
  if (!foregroundPackage) {
    return {
      ok: false,
      requiredPackage,
      foregroundPackage: null,
      error: 'Unable to determine foreground mobile app package before live action.',
      stderr: result.stderr,
    }
  }

  if (normalizeMobileAppPackage(foregroundPackage) !== normalizeMobileAppPackage(requiredPackage)) {
    return {
      ok: false,
      requiredPackage,
      foregroundPackage,
      error: `Foreground mobile app ${foregroundPackage} does not match required package ${requiredPackage}.`,
      stderr: result.stderr,
    }
  }

  return {
    ok: true,
    requiredPackage,
    foregroundPackage,
  }
}

function parseAndroidForegroundPackage(value: string): string | null {
  const patterns = [
    /mCurrentFocus=.*?\s([A-Za-z0-9_.]+)\/[A-Za-z0-9_.$/]+/,
    /mFocusedApp=.*?\s([A-Za-z0-9_.]+)\/[A-Za-z0-9_.$/]+/,
    /topResumedActivity=.*?\s([A-Za-z0-9_.]+)\/[A-Za-z0-9_.$/]+/,
    /mResumedActivity=.*?\s([A-Za-z0-9_.]+)\/[A-Za-z0-9_.$/]+/,
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    const packageName = match?.[1]?.trim()
    if (packageName) return packageName
  }
  return null
}

function mobileForegroundOutput(check: MobileForegroundCheck): JsonObject {
  return {
    foregroundCheckRequired: true,
    requiredPackage: check.requiredPackage,
    foregroundPackage: check.foregroundPackage,
    foregroundPackageMatched: check.ok,
  }
}

function mobileForegroundBlockedOutput(check: MobileForegroundCheck): JsonObject {
  return {
    error: check.ok ? 'Mobile foreground app check failed.' : check.error,
    mobileApp: mobileForegroundOutput(check),
    stderr: check.ok ? '' : check.stderr,
  }
}

function evaluateWorkstationTargetAllowlist(args: {
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target?: string | null
  input?: JsonObject
  live?: boolean
  readOnly: boolean
  lowRiskLive: boolean
}): {
  allowed: boolean
  reason: string
  gateFields: Pick<
    RuntimeControlGate,
    | 'workstationTargetAllowlistRequired'
    | 'workstationTargetAllowlistEnvVar'
    | 'workstationTarget'
    | 'workstationTargetAllowed'
  >
} {
  const required =
    Boolean(args.live) &&
    args.scope === 'workstation' &&
    args.actionType === 'launch_remote_session' &&
    !args.readOnly &&
    !args.lowRiskLive
  if (!required) {
    return {
      allowed: true,
      reason: 'Workstation target allowlist is not required for this runtime action.',
      gateFields:
        args.scope === 'workstation'
          ? {
              workstationTargetAllowlistRequired: false,
              workstationTargetAllowlistEnvVar: WORKSTATION_TARGET_ALLOWLIST_ENV,
              workstationTarget: workstationTargetForAction(args.input, args.target),
              workstationTargetAllowed: true,
            }
          : {},
    }
  }

  const candidates = workstationTargetCandidatesForAction(args.input, args.target)
  const target = candidates[0] ?? null
  const allowlist = parseWorkstationTargetAllowlist()
  const allowed = candidates.some((candidate) => allowlist.allowAny || allowlist.ids.has(candidate.normalized))
  const gateFields = {
    workstationTargetAllowlistRequired: true,
    workstationTargetAllowlistEnvVar: WORKSTATION_TARGET_ALLOWLIST_ENV,
    workstationTarget: target?.raw ?? null,
    workstationTargetAllowed: allowed,
  }
  if (!target) {
    return {
      allowed: false,
      reason: `Workstation runtime launch requires an explicit workstationId or target plus ${WORKSTATION_TARGET_ALLOWLIST_ENV}.`,
      gateFields,
    }
  }
  if (!allowlist.configured) {
    return {
      allowed: false,
      reason: `Workstation runtime launch requires ${WORKSTATION_TARGET_ALLOWLIST_ENV} to list approved workstation ids or remote targets before live launches can run.`,
      gateFields,
    }
  }
  if (!allowed) {
    return {
      allowed: false,
      reason: `Workstation target ${target.raw} is not in ${WORKSTATION_TARGET_ALLOWLIST_ENV}.`,
      gateFields,
    }
  }
  return {
    allowed: true,
    reason: `Workstation target ${target.raw} is allowed by ${WORKSTATION_TARGET_ALLOWLIST_ENV}.`,
    gateFields,
  }
}

function workstationTargetForAction(input: JsonObject | undefined, target?: string | null): string | null {
  return workstationTargetCandidatesForAction(input, target)[0]?.raw ?? null
}

function workstationTargetCandidatesForAction(
  input: JsonObject | undefined,
  target?: string | null,
): Array<{ raw: string; normalized: string }> {
  const rawValues = [
    stringInput(input, 'workstationId'),
    stringInput(input, 'workstationTarget'),
    stringInput(input, 'remoteTarget'),
    stringInput(input, 'displayId'),
    target,
  ]
  const seen = new Set<string>()
  const candidates: Array<{ raw: string; normalized: string }> = []
  for (const value of rawValues) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const normalized = normalizeWorkstationAllowlistValue(trimmed)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    candidates.push({ raw: trimmed, normalized })
  }
  return candidates
}

function parseWorkstationTargetAllowlist(): {
  configured: boolean
  allowAny: boolean
  ids: Set<string>
} {
  return parseDelimitedAllowlistEnv(WORKSTATION_TARGET_ALLOWLIST_ENV, normalizeWorkstationAllowlistValue)
}

function normalizeWorkstationAllowlistValue(value: string): string {
  return value.trim().toLowerCase()
}

function evaluateWorkstationLaunchPlanTarget(
  workstation: AgentWorkstationRow,
  launchPlan: WorkstationLaunchPlan,
): {
  allowed: boolean
  reason: string
  candidates: string[]
  matchedTarget: string | null
  envVar: string
} {
  const allowlist = parseWorkstationTargetAllowlist()
  const candidates = workstationLaunchAllowlistCandidates(workstation, launchPlan)
  const matchedTarget =
    candidates.find((candidate) => allowlist.allowAny || allowlist.ids.has(normalizeWorkstationAllowlistValue(candidate))) ??
    null
  if (!allowlist.configured) {
    return {
      allowed: false,
      reason: `Workstation live launch requires ${WORKSTATION_TARGET_ALLOWLIST_ENV} before launching the resolved remote target.`,
      candidates,
      matchedTarget,
      envVar: WORKSTATION_TARGET_ALLOWLIST_ENV,
    }
  }
  if (!matchedTarget) {
    return {
      allowed: false,
      reason: `Resolved workstation launch target is not in ${WORKSTATION_TARGET_ALLOWLIST_ENV}.`,
      candidates,
      matchedTarget,
      envVar: WORKSTATION_TARGET_ALLOWLIST_ENV,
    }
  }
  return {
    allowed: true,
    reason: `Resolved workstation launch target ${matchedTarget} is allowed by ${WORKSTATION_TARGET_ALLOWLIST_ENV}.`,
    candidates,
    matchedTarget,
    envVar: WORKSTATION_TARGET_ALLOWLIST_ENV,
  }
}

function workstationLaunchAllowlistCandidates(
  workstation: AgentWorkstationRow,
  launchPlan: WorkstationLaunchPlan,
): string[] {
  const resolvedTargetValues = [
    launchPlan.targetPreview,
    rdpTargetPreview(workstation.rdpConfig ?? ''),
    workstation.vncUrl,
    workstation.displayId,
  ]
  const rawValues = resolvedTargetValues.some((value) => value?.trim())
    ? resolvedTargetValues
    : [workstation.id]
  const seen = new Set<string>()
  const candidates: string[] = []
  for (const value of rawValues) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const normalized = normalizeWorkstationAllowlistValue(trimmed)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    candidates.push(trimmed)
  }
  return candidates
}

function parseDelimitedAllowlistEnv(
  envVar: string,
  normalize: (value: string) => string,
): {
  configured: boolean
  allowAny: boolean
  ids: Set<string>
} {
  const raw = process.env[envVar] ?? ''
  const values = raw
    .split(/[\s,;]+/u)
    .map((value) => normalize(value))
    .filter(Boolean)
  return {
    configured: values.length > 0,
    allowAny: values.includes('*'),
    ids: new Set(values.filter((value) => value !== '*')),
  }
}

export async function buildRuntimeControlApprovalInput(
  args: RuntimeControlApprovalInputArgs,
): Promise<JsonObject> {
  const base = args.input ?? {}
  const highRiskLive = Boolean(args.live) && !isReadOnlyAction(args.actionType) && !isLowRiskLiveAction(args.actionType)
  if (highRiskLive && args.scope === 'desktop') {
    const targetCandidates = desktopTargetCandidatesForAction(base, args.target).map((candidate) => candidate.raw)
    const focusTarget = desktopFocusTargetForAction(args.actionType, base, args.target)
    return {
      ...base,
      desktopRuntimeTarget: targetCandidates[0] ?? null,
      desktopRuntimeTargetCandidates: targetCandidates,
      ...desktopFocusApprovalInput(focusTarget),
    }
  }
  if (highRiskLive && args.scope === 'mobile') {
    return {
      ...base,
      mobileRuntimeDeviceId: mobileDeviceIdForAction(base, args.target),
      mobileRuntimeAppPackage: mobileAppPackageForAction(base),
    }
  }
  if (args.scope !== 'workstation' || args.actionType !== 'launch_remote_session') return base
  const workstationId = stringInput(base, 'workstationId') ?? args.target
  if (!workstationId) return base
  let workstation: AgentWorkstationRow
  try {
    workstation = await getRequiredAgentWorkstation(workstationId)
  } catch {
    return {
      ...base,
      workstationId,
      workstationLaunchKind: 'unresolved',
      workstationLaunchTarget: null,
    }
  }
  const launchPlan = buildWorkstationLaunchPlan(workstation)
  return {
    ...base,
    workstationId,
    workstationLaunchKind: launchPlan.kind,
    workstationLaunchTarget: workstationApprovalTarget(workstation, launchPlan),
  }
}

function workstationApprovalTarget(
  workstation: AgentWorkstationRow,
  launchPlan: WorkstationLaunchPlan,
): string | null {
  return workstationLaunchAllowlistCandidates(workstation, launchPlan)[0] ?? null
}

async function evaluateControlGateForSession(
  session: ComputerSessionRow,
  args: ExecuteRuntimeControlActionArgs,
  inputHash: string,
): Promise<RuntimeControlGate> {
  const base = evaluateControlGate(args)
  if (!base.allowed || !base.approvalRequired) return base
  const approval = args.trustedApprovalAlreadyValidated
    ? ({ ok: true, approval: null } as const)
    : await validateRuntimeControlApproval({
    session,
    scope: args.scope,
    actionType: args.actionType,
    target: args.target ?? defaultTargetForAction(args),
    approvalRequestId: base.approvalRequestId,
    inputHash,
  })
  if (!approval.ok) {
    return {
      ...base,
      approvalSatisfied: false,
      allowed: false,
      reason: approval.reason,
    }
  }
  const goLive = await evaluateProductionGoLiveRuntimeGate()
  if (!goLive.allowed) {
    return {
      ...base,
      goLiveRequired: goLive.required,
      goLiveDecisionHash: goLive.requiredDecisionHash,
      goLiveLatestDecisionHash: goLive.latestDecisionHash,
      goLiveDecisionSatisfied: false,
      goLiveLatestDecisionCustomerAuthorizationEvidenceHash:
        goLive.latestDecisionCustomerAuthorizationEvidenceHash,
      goLiveLatestDecisionCustomerAuthorizationEvidenceMatched:
        goLive.latestDecisionCustomerAuthorizationEvidenceMatched,
      goLiveLatestDecisionEnvironmentFingerprintPresent: goLive.latestDecisionEnvironmentFingerprintPresent,
      goLiveLatestDecisionEnvironmentFingerprintMatched: goLive.latestDecisionEnvironmentFingerprintMatched,
      goLiveLatestDecisionEnvironmentFingerprintMismatches: goLive.latestDecisionEnvironmentFingerprintMismatches,
      goLiveCustomerAuthorizationRequired: goLive.customerAuthorizationRequired,
      goLiveCustomerAuthorized: goLive.customerAuthorized,
      goLiveCustomerAuthorizationSwitchEnabled: goLive.customerAuthorizationSwitchEnabled,
      goLiveCustomerAuthorizationEvidenceHashRequired: goLive.customerAuthorizationEvidenceHashRequired,
      goLiveCustomerAuthorizationEvidenceHash: goLive.customerAuthorizationEvidenceHash,
      goLiveCustomerAuthorizationEvidenceMatched: goLive.customerAuthorizationEvidenceMatched,
      goLiveCustomerAuthorizationEvidenceBoundToDecision: goLive.customerAuthorizationEvidenceBoundToDecision,
      goLiveLivePilotLeaseRequired: goLive.livePilotLeaseRequired,
      goLiveLivePilotLeaseHash: goLive.livePilotLeaseHash,
      goLiveLatestLivePilotLeaseHash: goLive.latestLivePilotLeaseHash,
      goLiveLatestLivePilotLeaseActive: goLive.latestLivePilotLeaseActive,
      goLiveLatestLivePilotLeaseExpiresAt: goLive.latestLivePilotLeaseExpiresAt,
      goLiveLivePilotLeaseMatched: goLive.livePilotLeaseMatched,
      goLiveLivePilotLeaseExpired: goLive.livePilotLeaseExpired,
      goLiveLivePilotLeaseBoundToDecision: goLive.livePilotLeaseBoundToDecision,
      goLiveLivePilotLeaseBoundToCustomerAuthorization: goLive.livePilotLeaseBoundToCustomerAuthorization,
      goLiveLivePilotLeaseBoundToEnvironmentFingerprint: goLive.livePilotLeaseBoundToEnvironmentFingerprint,
      goLiveLivePilotSessionRequired: goLive.livePilotSessionRequired,
      goLiveLatestLivePilotSessionId: goLive.latestLivePilotSessionId,
      goLiveLatestLivePilotSessionHash: goLive.latestLivePilotSessionHash,
      goLiveLatestLivePilotSessionStatus: goLive.latestLivePilotSessionStatus,
      goLiveLatestLivePilotSessionActive: goLive.latestLivePilotSessionActive,
      goLiveLatestLivePilotSessionExpiresAt: goLive.latestLivePilotSessionExpiresAt,
      goLiveLivePilotSessionBoundToLease: goLive.livePilotSessionBoundToLease,
      goLiveLivePilotSessionBoundToDecision: goLive.livePilotSessionBoundToDecision,
      goLiveLivePilotSessionBoundToCustomerAuthorization:
        goLive.livePilotSessionBoundToCustomerAuthorization,
      goLiveLivePilotSessionBoundToEnvironmentFingerprint:
        goLive.livePilotSessionBoundToEnvironmentFingerprint,
      approvalSatisfied: true,
      allowed: false,
      reason: goLive.reason,
    }
  }
  return {
    ...base,
    goLiveRequired: goLive.required,
    goLiveDecisionHash: goLive.requiredDecisionHash,
    goLiveLatestDecisionHash: goLive.latestDecisionHash,
    goLiveDecisionSatisfied: true,
    goLiveLatestDecisionCustomerAuthorizationEvidenceHash: goLive.latestDecisionCustomerAuthorizationEvidenceHash,
    goLiveLatestDecisionCustomerAuthorizationEvidenceMatched: goLive.latestDecisionCustomerAuthorizationEvidenceMatched,
    goLiveLatestDecisionEnvironmentFingerprintPresent: goLive.latestDecisionEnvironmentFingerprintPresent,
    goLiveLatestDecisionEnvironmentFingerprintMatched: goLive.latestDecisionEnvironmentFingerprintMatched,
    goLiveLatestDecisionEnvironmentFingerprintMismatches: goLive.latestDecisionEnvironmentFingerprintMismatches,
    goLiveCustomerAuthorizationRequired: goLive.customerAuthorizationRequired,
    goLiveCustomerAuthorized: goLive.customerAuthorized,
    goLiveCustomerAuthorizationSwitchEnabled: goLive.customerAuthorizationSwitchEnabled,
    goLiveCustomerAuthorizationEvidenceHashRequired: goLive.customerAuthorizationEvidenceHashRequired,
    goLiveCustomerAuthorizationEvidenceHash: goLive.customerAuthorizationEvidenceHash,
    goLiveCustomerAuthorizationEvidenceMatched: goLive.customerAuthorizationEvidenceMatched,
    goLiveCustomerAuthorizationEvidenceBoundToDecision: goLive.customerAuthorizationEvidenceBoundToDecision,
    goLiveLivePilotLeaseRequired: goLive.livePilotLeaseRequired,
    goLiveLivePilotLeaseHash: goLive.livePilotLeaseHash,
    goLiveLatestLivePilotLeaseHash: goLive.latestLivePilotLeaseHash,
    goLiveLatestLivePilotLeaseActive: goLive.latestLivePilotLeaseActive,
    goLiveLatestLivePilotLeaseExpiresAt: goLive.latestLivePilotLeaseExpiresAt,
    goLiveLivePilotLeaseMatched: goLive.livePilotLeaseMatched,
    goLiveLivePilotLeaseExpired: goLive.livePilotLeaseExpired,
    goLiveLivePilotLeaseBoundToDecision: goLive.livePilotLeaseBoundToDecision,
    goLiveLivePilotLeaseBoundToCustomerAuthorization: goLive.livePilotLeaseBoundToCustomerAuthorization,
    goLiveLivePilotLeaseBoundToEnvironmentFingerprint: goLive.livePilotLeaseBoundToEnvironmentFingerprint,
    goLiveLivePilotSessionRequired: goLive.livePilotSessionRequired,
    goLiveLatestLivePilotSessionId: goLive.latestLivePilotSessionId,
    goLiveLatestLivePilotSessionHash: goLive.latestLivePilotSessionHash,
    goLiveLatestLivePilotSessionStatus: goLive.latestLivePilotSessionStatus,
    goLiveLatestLivePilotSessionActive: goLive.latestLivePilotSessionActive,
    goLiveLatestLivePilotSessionExpiresAt: goLive.latestLivePilotSessionExpiresAt,
    goLiveLivePilotSessionBoundToLease: goLive.livePilotSessionBoundToLease,
    goLiveLivePilotSessionBoundToDecision: goLive.livePilotSessionBoundToDecision,
    goLiveLivePilotSessionBoundToCustomerAuthorization: goLive.livePilotSessionBoundToCustomerAuthorization,
    goLiveLivePilotSessionBoundToEnvironmentFingerprint: goLive.livePilotSessionBoundToEnvironmentFingerprint,
    approvalSatisfied: true,
    allowed: true,
    reason: args.trustedApprovalAlreadyValidated
      ? 'Production runtime control gate passed with a trusted pre-validated approval.'
      : 'Production runtime control gate passed with approved runtime-control request.',
  }
}

async function executeLiveControl(
  session: ComputerSessionRow,
  args: ExecuteRuntimeControlActionArgs,
): Promise<{ status: ComputerActionStatus; output: JsonObject }> {
  switch (args.scope) {
    case 'desktop':
      return executeDesktopAction(session, args)
    case 'mobile':
      return executeMobileAction(session, args)
    case 'workstation':
      return executeWorkstationAction(args)
  }
}

async function executeDesktopAction(
  session: ComputerSessionRow,
  args: ExecuteRuntimeControlActionArgs,
): Promise<{ status: ComputerActionStatus; output: JsonObject }> {
  if (process.platform !== 'win32') {
    return { status: 'blocked', output: { error: 'Desktop control is implemented for Windows first.' } }
  }
  if (args.actionType === 'observe_windows') {
    const result = await runCommand('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -First 12 ProcessName,Id,MainWindowTitle | ConvertTo-Json -Compress",
    ])
    return result.ok
      ? { status: 'complete', output: { windows: parseJsonArray(result.stdout) as unknown as JsonObject[] } }
      : { status: 'failed', output: { error: result.error } }
  }
  if (args.actionType === 'capture_screenshot') {
    const capturePath = resolveScreenshotPath(session, args.input)
    const result = await runCommand('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      SCREENSHOT_SCRIPT,
      capturePath,
    ])
    return result.ok
      ? { status: 'complete', output: screenshotOutputForPath(session, capturePath) }
      : { status: 'failed', output: { error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'click') {
    const x = numberInput(args.input, 'x')
    const y = numberInput(args.input, 'y')
    if (x === null || y === null) return { status: 'blocked', output: { error: 'click requires numeric x and y.' } }
    const focusTarget = desktopFocusTargetForAction(args.actionType, args.input, args.target)
    const focus = await focusDesktopWindowForAction(focusTarget)
    if (!focus.ok) {
      return {
        status: 'blocked',
        output: {
          error: focus.error,
          ...desktopFocusPlanOutput(focusTarget),
          stderr: focus.stderr,
        },
      }
    }
    const result = await runCommand('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      CLICK_SCRIPT,
      String(Math.round(x)),
      String(Math.round(y)),
    ])
    return result.ok
      ? {
          status: 'complete',
          output: {
            clicked: { x: Math.round(x), y: Math.round(y) },
            ...desktopFocusPlanOutput(focusTarget),
            focusedWindow: focus.focusedWindow,
          },
        }
      : { status: 'failed', output: { error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'scroll') {
    const delta = numberInput(args.input, 'delta') ?? numberInput(args.input, 'wheelDelta')
    const clicks = numberInput(args.input, 'clicks')
    const x = numberInput(args.input, 'x')
    const y = numberInput(args.input, 'y')
    const wheelDelta = Math.trunc(delta ?? (clicks === null ? -3 : clicks * 120))
    if (!Number.isFinite(wheelDelta) || wheelDelta === 0) {
      return { status: 'blocked', output: { error: 'scroll requires a non-zero delta, wheelDelta, or clicks value.' } }
    }
    const focusTarget = desktopFocusTargetForAction(args.actionType, args.input, args.target)
    const focus = await focusDesktopWindowForAction(focusTarget)
    if (!focus.ok) {
      return {
        status: 'blocked',
        output: {
          error: focus.error,
          ...desktopFocusPlanOutput(focusTarget),
          stderr: focus.stderr,
        },
      }
    }
    const result = await runCommand('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      SCROLL_SCRIPT,
      String(wheelDelta),
      x === null ? '' : String(Math.round(x)),
      y === null ? '' : String(Math.round(y)),
    ])
    return result.ok
      ? {
          status: 'complete',
          output: {
            scrolled: { delta: wheelDelta, x: x ?? null, y: y ?? null },
            ...desktopFocusPlanOutput(focusTarget),
            focusedWindow: focus.focusedWindow,
          },
        }
      : { status: 'failed', output: { error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'type_text' || args.actionType === 'key_press') {
    const text = stringInput(args.input, args.actionType === 'key_press' ? 'keys' : 'text')
    if (!text) return { status: 'blocked', output: { error: `${args.actionType} requires text/keys input.` } }
    const focusTarget = desktopFocusTargetForAction(args.actionType, args.input, args.target)
    const focus = await focusDesktopWindowForAction(focusTarget)
    if (!focus.ok) {
      return {
        status: 'blocked',
        output: {
          error: focus.error,
          ...desktopFocusPlanOutput(focusTarget),
          stderr: focus.stderr,
        },
      }
    }
    const result = await runCommand(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', SEND_KEYS_SCRIPT],
      { AGENTHUB_SEND_KEYS_TEXT: text.slice(0, 2000) },
    )
    return result.ok
      ? {
          status: 'complete',
          output: {
            sentLength: text.length,
            ...desktopFocusPlanOutput(focusTarget),
            focusedWindow: focus.focusedWindow,
          },
        }
      : { status: 'failed', output: { error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'focus_window') {
    const processName = stringInput(args.input, 'processName')
    const titleContains = stringInput(args.input, 'titleContains')
    if (!processName && !titleContains) {
      return { status: 'blocked', output: { error: 'focus_window requires processName or titleContains.' } }
    }
    const result = await runCommand(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', FOCUS_WINDOW_SCRIPT],
      {
        AGENTHUB_FOCUS_PROCESS: processName ?? '',
        AGENTHUB_FOCUS_TITLE: titleContains ?? '',
      },
    )
    return result.ok
      ? { status: 'complete', output: { focused: firstLine(result.stdout) ?? 'unknown' } }
      : { status: 'failed', output: { error: result.error, stderr: result.stderr } }
  }
  return { status: 'blocked', output: { error: `Unsupported desktop action: ${args.actionType}` } }
}

async function executeMobileAction(
  session: ComputerSessionRow,
  args: ExecuteRuntimeControlActionArgs,
): Promise<{ status: ComputerActionStatus; output: JsonObject }> {
  const adb = resolveAdbCommand()
  const deviceId = stringInput(args.input, 'deviceId') ?? args.target ?? null
  const adbArgs = deviceId ? ['-s', deviceId] : []
  if (args.actionType === 'list_devices') {
    const result = await runAdbCommand(adb, ['devices', '-l'])
    return result.ok
      ? {
          status: 'complete',
          output: {
            adb: adbCommandOutput(adb),
            devices: parseAdbDevices(result.stdout) as unknown as JsonObject[],
          },
        }
      : {
          status: 'blocked',
          output: {
            adb: adbCommandOutput(adb),
            error: 'adb is not available or failed to list devices.',
            details: result.error,
          },
        }
  }
  if (args.actionType === 'mobile_tap') {
    const x = numberInput(args.input, 'x')
    const y = numberInput(args.input, 'y')
    if (x === null || y === null) return { status: 'blocked', output: { error: 'mobile_tap requires numeric x and y.' } }
    const app = await verifyMobileForegroundApp(adb, adbArgs, args.input)
    if (!app.ok) return { status: 'blocked', output: { adb: adbCommandOutput(adb), ...mobileForegroundBlockedOutput(app) } }
    const result = await runAdbCommand(adb, [...adbArgs, 'shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))])
    return result.ok
      ? { status: 'complete', output: { adb: adbCommandOutput(adb), tapped: { deviceId, x: Math.round(x), y: Math.round(y) }, mobileApp: mobileForegroundOutput(app) } }
      : { status: 'failed', output: { adb: adbCommandOutput(adb), error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'mobile_swipe') {
    const x1 = numberInput(args.input, 'x1') ?? numberInput(args.input, 'startX')
    const y1 = numberInput(args.input, 'y1') ?? numberInput(args.input, 'startY')
    const x2 = numberInput(args.input, 'x2') ?? numberInput(args.input, 'endX')
    const y2 = numberInput(args.input, 'y2') ?? numberInput(args.input, 'endY')
    const durationMs = numberInput(args.input, 'durationMs') ?? numberInput(args.input, 'duration') ?? 350
    if (x1 === null || y1 === null || x2 === null || y2 === null) {
      return { status: 'blocked', output: { error: 'mobile_swipe requires x1, y1, x2, and y2 coordinates.' } }
    }
    const duration = Math.max(0, Math.min(60000, Math.round(durationMs)))
    const app = await verifyMobileForegroundApp(adb, adbArgs, args.input)
    if (!app.ok) return { status: 'blocked', output: { adb: adbCommandOutput(adb), ...mobileForegroundBlockedOutput(app) } }
    const result = await runAdbCommand(adb, [
      ...adbArgs,
      'shell',
      'input',
      'swipe',
      String(Math.round(x1)),
      String(Math.round(y1)),
      String(Math.round(x2)),
      String(Math.round(y2)),
      String(duration),
    ])
    return result.ok
      ? {
          status: 'complete',
          output: {
            swiped: {
              deviceId,
              x1: Math.round(x1),
              y1: Math.round(y1),
              x2: Math.round(x2),
              y2: Math.round(y2),
              durationMs: duration,
            },
            adb: adbCommandOutput(adb),
            mobileApp: mobileForegroundOutput(app),
          },
        }
      : { status: 'failed', output: { adb: adbCommandOutput(adb), error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'mobile_text') {
    const text = stringInput(args.input, 'text')
    if (!text) return { status: 'blocked', output: { error: 'mobile_text requires text.' } }
    const app = await verifyMobileForegroundApp(adb, adbArgs, args.input)
    if (!app.ok) return { status: 'blocked', output: { adb: adbCommandOutput(adb), ...mobileForegroundBlockedOutput(app) } }
    const result = await runAdbCommand(adb, [...adbArgs, 'shell', 'input', 'text', escapeAdbText(text)])
    return result.ok
      ? { status: 'complete', output: { adb: adbCommandOutput(adb), deviceId, sentLength: text.length, mobileApp: mobileForegroundOutput(app) } }
      : { status: 'failed', output: { adb: adbCommandOutput(adb), error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'mobile_keyevent') {
    const keycode = stringInput(args.input, 'keycode')
    if (!keycode) return { status: 'blocked', output: { error: 'mobile_keyevent requires keycode.' } }
    const app = await verifyMobileForegroundApp(adb, adbArgs, args.input)
    if (!app.ok) return { status: 'blocked', output: { adb: adbCommandOutput(adb), ...mobileForegroundBlockedOutput(app) } }
    const result = await runAdbCommand(adb, [...adbArgs, 'shell', 'input', 'keyevent', keycode])
    return result.ok
      ? { status: 'complete', output: { adb: adbCommandOutput(adb), deviceId, keycode, mobileApp: mobileForegroundOutput(app) } }
      : { status: 'failed', output: { adb: adbCommandOutput(adb), error: result.error, stderr: result.stderr } }
  }
  if (args.actionType === 'mobile_screenshot') {
    const capturePath = resolveMobileScreenshotPath(session, args.input)
    const result = await runAdbCommandBuffer(adb, [...adbArgs, 'exec-out', 'screencap', '-p'])
    if (!result.ok) return { status: 'failed', output: { adb: adbCommandOutput(adb), error: result.error, stderr: result.stderr } }
    if (result.stdout.length === 0) return { status: 'failed', output: { adb: adbCommandOutput(adb), error: 'adb screencap returned no bytes.' } }
    mkdirSync(path.dirname(capturePath), { recursive: true })
    writeFileSync(capturePath, result.stdout)
    return {
      status: 'complete',
      output: {
        deviceId,
        adb: adbCommandOutput(adb),
        ...screenshotOutputForPath(session, capturePath),
        bytes: result.stdout.length,
      },
    }
  }
  return { status: 'blocked', output: { error: `Unsupported mobile action: ${args.actionType}` } }
}

export interface ResolvedAdbCommand {
  command: string
  argsPrefix: string[]
  configured: boolean
  discovered: boolean
  source: 'configured_env' | 'auto_discovered' | 'path_lookup'
  envVar: typeof ADB_PATH_ENV
  argsPrefixEnvVar: typeof ADB_ARGS_PREFIX_ENV
  searchRootsEnvVar: typeof ADB_SEARCH_ROOTS_ENV
  candidatePaths: string[]
}

export function resolveAdbCommand(): ResolvedAdbCommand {
  const configuredCommand = process.env[ADB_PATH_ENV]?.trim()
  const argsPrefix = parseAdbArgsPrefix()
  const candidatePaths = discoverAdbCandidatePaths()
  if (configuredCommand) {
    return {
      command: configuredCommand,
      argsPrefix,
      configured: true,
      discovered: false,
      source: 'configured_env',
      envVar: ADB_PATH_ENV,
      argsPrefixEnvVar: ADB_ARGS_PREFIX_ENV,
      searchRootsEnvVar: ADB_SEARCH_ROOTS_ENV,
      candidatePaths,
    }
  }
  const discoveredCommand = candidatePaths.find((candidate) => runtimePathExists(candidate))
  if (discoveredCommand) {
    return {
      command: discoveredCommand,
      argsPrefix,
      configured: false,
      discovered: true,
      source: 'auto_discovered',
      envVar: ADB_PATH_ENV,
      argsPrefixEnvVar: ADB_ARGS_PREFIX_ENV,
      searchRootsEnvVar: ADB_SEARCH_ROOTS_ENV,
      candidatePaths,
    }
  }
  return {
    command: 'adb',
    argsPrefix,
    configured: false,
    discovered: false,
    source: 'path_lookup',
    envVar: ADB_PATH_ENV,
    argsPrefixEnvVar: ADB_ARGS_PREFIX_ENV,
    searchRootsEnvVar: ADB_SEARCH_ROOTS_ENV,
    candidatePaths,
  }
}

type RuntimeFsModule = {
  existsSync?: (candidatePath: string) => boolean
}

type ProcessWithBuiltinModule = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown
}

function runtimePathExists(candidatePath: string): boolean {
  try {
    const runtimeFs = (process as ProcessWithBuiltinModule).getBuiltinModule?.('node:fs') as RuntimeFsModule | undefined

    return runtimeFs?.existsSync?.(candidatePath) === true
  } catch {
    return false
  }
}

function adbCommandOutput(adb: ResolvedAdbCommand): JsonObject {
  return {
    command: adb.configured ? 'configured_adb_path' : adb.discovered ? 'auto_discovered_adb_path' : adb.command,
    configured: adb.configured,
    discovered: adb.discovered,
    source: adb.source,
    envVar: adb.envVar,
    argsPrefixConfigured: adb.argsPrefix.length > 0,
    argsPrefixEnvVar: adb.argsPrefixEnvVar,
    argsPrefixCount: adb.argsPrefix.length,
    searchRootsEnvVar: adb.searchRootsEnvVar,
    candidateCount: adb.candidatePaths.length,
    pathRedacted: adb.configured || adb.discovered,
  }
}

function parseAdbArgsPrefix(): string[] {
  const raw = process.env[ADB_ARGS_PREFIX_ENV]?.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) return []
    return parsed.map((item) => item.trim()).filter(Boolean)
  } catch {
    return []
  }
}

function discoverAdbCandidatePaths(): string[] {
  const explicitRoots = parsePathList(process.env[ADB_SEARCH_ROOTS_ENV])
  const roots = [
    ...explicitRoots,
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'AndroidSDK') : null,
    'C:\\Android',
    'D:\\Android',
    'C:\\platform-tools',
    'D:\\platform-tools',
    'C:\\Program Files\\Android\\Android Studio',
    'D:\\Program Files\\Android\\Android Studio',
    'C:\\Program Files\\Genymobile\\Genymotion',
    'D:\\Program Files\\Genymobile\\Genymotion',
    'C:\\Program Files\\Netease\\MuMuPlayer-12.0',
    'D:\\Program Files\\Netease\\MuMuPlayer-12.0',
    'C:\\Program Files\\Netease\\MuMu Player 12',
    'D:\\Program Files\\Netease\\MuMu Player 12',
    'C:\\Program Files\\BlueStacks_nxt',
    'D:\\Program Files\\BlueStacks_nxt',
    'C:\\Program Files\\BlueStacks',
    'D:\\Program Files\\BlueStacks',
    'C:\\LDPlayer\\LDPlayer9',
    'D:\\LDPlayer\\LDPlayer9',
    'C:\\Program Files\\Microvirt\\MEmu',
    'D:\\Program Files\\Microvirt\\MEmu',
  ].filter((value): value is string => Boolean(value?.trim()))

  const candidates: string[] = []
  for (const root of roots) {
    const trimmed = root.trim()
    candidates.push(...adbCandidatesForRoot(trimmed))
  }
  return uniqueStrings(candidates.map((candidate) => path.resolve(candidate)))
}

function adbCandidatesForRoot(root: string): string[] {
  const fileName = process.platform === 'win32' ? 'adb.exe' : 'adb'
  const scriptNames = process.platform === 'win32' ? ['adb.cmd', 'adb.bat'] : []
  const directNames = [fileName, ...scriptNames]
  const subdirs = [
    '',
    'platform-tools',
    path.join('Sdk', 'platform-tools'),
    path.join('tools', 'platform-tools'),
    'tools',
    'shell',
    'bin',
  ]
  const candidates: string[] = []
  for (const subdir of subdirs) {
    for (const name of directNames) {
      candidates.push(appendAdbPathSegments(root, subdir, name))
    }
  }
  if (process.platform === 'win32') {
    candidates.push(appendAdbPathSegments(root, 'HD-Adb.exe'))
    candidates.push(appendAdbPathSegments(root, 'adb_server.exe'))
  }
  return candidates
}

function appendAdbPathSegments(root: string, ...segments: string[]): string {
  let result = root
  for (const segment of segments) {
    if (!segment) continue
    const needsSeparator = !/[\\/]$/.test(result)
    result = `${result}${needsSeparator ? path.sep : ''}${segment}`
  }
  return result
}

function parsePathList(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(process.platform === 'win32' ? /[;,]/ : /[:;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = process.platform === 'win32' ? value.toLowerCase() : value
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function runAdbCommand(
  adb: ResolvedAdbCommand,
  args: string[],
): ReturnType<typeof runCommand> {
  return runCommand(adb.command, [...adb.argsPrefix, ...args])
}

function runAdbCommandBuffer(
  adb: ResolvedAdbCommand,
  args: string[],
): ReturnType<typeof runCommandBuffer> {
  return runCommandBuffer(adb.command, [...adb.argsPrefix, ...args])
}

async function executeWorkstationAction(
  args: ExecuteRuntimeControlActionArgs,
): Promise<{ status: ComputerActionStatus; output: JsonObject }> {
  const workstationId = stringInput(args.input, 'workstationId') ?? args.target
  if (!workstationId) return { status: 'blocked', output: { error: 'workstation action requires workstationId.' } }
  const workstation = await getRequiredAgentWorkstation(workstationId)
  if (args.actionType === 'validate_workstation') {
    const validation = validateWorkstationReadiness(workstation)
    return {
      status: validation.ready ? 'complete' : 'blocked',
      output: {
        ...validation,
        workstationId: workstation.id,
        mode: workstation.mode,
        status: workstation.status,
        hasVncUrl: Boolean(workstation.vncUrl),
        hasRdpConfig: Boolean(workstation.rdpConfig),
      },
    }
  }
  if (args.actionType === 'launch_remote_session') {
    if (workstation.mode !== 'remote_session' && workstation.mode !== 'vm' && workstation.mode !== 'virtual_desktop') {
      return { status: 'blocked', output: { error: `Unsupported workstation mode: ${workstation.mode}` } }
    }
    if (process.platform !== 'win32') {
      return { status: 'blocked', output: { error: 'Remote workstation launch is implemented for Windows first.' } }
    }
    if (workstation.status === 'busy') {
      return {
        status: 'blocked',
        output: {
          error: 'Workstation is already busy; release it before launching a new remote session.',
          workstationId: workstation.id,
          previousStatus: workstation.status,
        },
      }
    }
    const launchPlan = buildWorkstationLaunchPlan(workstation)
    const launchTargetGate = evaluateWorkstationLaunchPlanTarget(workstation, launchPlan)
    if (!launchTargetGate.allowed) {
      return {
        status: 'blocked',
        output: {
          error: launchTargetGate.reason,
          workstationId: workstation.id,
          launchPlan: workstationLaunchPlanForOutput(workstation, launchPlan),
          launchTargetGate: launchTargetGate as unknown as JsonObject,
        },
      }
    }
    if (launchPlan.blockingReasons.length > 0 || !launchPlan.command) {
      return {
        status: 'blocked',
        output: {
          error: launchPlan.blockingReasons[0] ?? 'Workstation does not have a supported live launch target.',
          workstationId: workstation.id,
          launchPlan: workstationLaunchPlanForOutput(workstation, launchPlan),
        },
      }
    }
    const launch = await launchWorkstationFromPlan(workstation, launchPlan)
    const updatedWorkstation =
      launch.status === 'complete'
        ? await updateAgentWorkstationStatus(workstation.id, 'busy')
        : workstation
    return {
      status: launch.status,
      output: {
        ...launch.output,
        workstationId: workstation.id,
        workstationStatus: updatedWorkstation.status,
        previousStatus: workstation.status,
        launchPlan: workstationLaunchPlanForOutput(workstation, launchPlan),
      },
    }
  }
  if (args.actionType === 'release_workstation') {
    const updatedWorkstation = await updateAgentWorkstationStatus(workstation.id, 'idle')
    return {
      status: 'complete',
      output: {
        workstationId: workstation.id,
        previousStatus: workstation.status,
        workstationStatus: updatedWorkstation.status,
        released: true,
      },
    }
  }
  return { status: 'blocked', output: { error: `Unsupported workstation action: ${args.actionType}` } }
}

async function planRuntimeControlAction(
  session: ComputerSessionRow,
  args: ExecuteRuntimeControlActionArgs,
): Promise<{ status: ComputerActionStatus; output: JsonObject }> {
  try {
    if (args.scope === 'desktop' && args.actionType === 'capture_screenshot') {
      const plannedPath = resolveScreenshotPath(session, args.input)
      return {
        status: 'planned',
        output: plannedScreenshotOutputForPath(session, plannedPath),
      }
    }
    if (args.scope === 'desktop' && desktopActionRequiresFocus(args.actionType)) {
      const focusTarget = desktopFocusTargetForAction(args.actionType, args.input, args.target)
      return {
        status: 'planned',
        output: {
          ...desktopFocusPlanOutput(focusTarget),
          plannedInputLength:
            stringInput(args.input, args.actionType === 'key_press' ? 'keys' : 'text')?.length ?? 0,
        },
      }
    }
    if (args.scope === 'mobile' && args.actionType === 'mobile_screenshot') {
      const plannedPath = resolveMobileScreenshotPath(session, args.input)
      return {
        status: 'planned',
        output: plannedScreenshotOutputForPath(session, plannedPath),
      }
    }
    if (args.scope === 'mobile' && isMobileControlAction(args.actionType)) {
      return {
        status: 'planned',
        output: {
          mobileAppForegroundCheckRequired: true,
          mobileAppPackage: mobileAppPackageForAction(args.input),
        },
      }
    }
    if (args.scope === 'workstation' && args.actionType === 'launch_remote_session') {
      const workstationId = stringInput(args.input, 'workstationId') ?? args.target
      if (!workstationId) return { status: 'blocked', output: { error: 'workstation action requires workstationId.' } }
      const workstation = await getRequiredAgentWorkstation(workstationId)
      const launchPlan = buildWorkstationLaunchPlan(workstation)
      const launchTargetGate = evaluateWorkstationLaunchPlanTarget(workstation, launchPlan)
      const publicLaunchPlan = workstationLaunchPlanForOutput(workstation, launchPlan)
      const planningBlocked = launchPlan.blockingReasons.length > 0 || !launchPlan.command
      return {
        status: planningBlocked ? 'blocked' : 'planned',
        output: {
          planningTarget: `workstation:${workstationId}`,
          workstationId: workstation.id,
          workstationMode: workstation.mode,
          workstationStatus: workstation.status,
          launchPlan: publicLaunchPlan,
          launchTargetGate: launchTargetGate as unknown as JsonObject,
          rdpFilePathRedacted: publicLaunchPlan.rdpFilePathRedacted === true,
          rdpFileDirectory: publicLaunchPlan.rdpFileDirectory ?? null,
          planningBlocked,
          error: planningBlocked
            ? launchPlan.blockingReasons[0] ?? 'Workstation does not have a supported launch target.'
            : undefined,
        },
      }
    }
    if (args.scope === 'workstation' && args.actionType === 'release_workstation') {
      const workstationId = stringInput(args.input, 'workstationId') ?? args.target
      if (!workstationId) return { status: 'blocked', output: { error: 'workstation action requires workstationId.' } }
      return {
        status: 'planned',
        output: { planningTarget: `workstation:${workstationId}`, plannedStatus: 'idle' },
      }
    }
    return { status: 'planned', output: {} }
  } catch (err) {
    return {
      status: 'blocked',
      output: {
        error: formatError(err),
        planningBlocked: true,
      },
    }
  }
}

function lockRequirementForAction(args: ExecuteRuntimeControlActionArgs): {
  resourceType: ResourceType
  resourceId: string
  ttlMs?: number
} | null {
  if (isReadOnlyAction(args.actionType)) return null
  if (args.scope === 'desktop') {
    return {
      resourceType: 'physical_mouse_keyboard',
      resourceId: 'default',
      ttlMs: 5 * 60 * 1000,
    }
  }
  if (args.scope === 'mobile') {
    return {
      resourceType: 'mobile_device',
      resourceId: stringInput(args.input, 'deviceId') ?? args.target ?? 'default',
      ttlMs: 5 * 60 * 1000,
    }
  }
  if (args.scope === 'workstation') {
    return {
      resourceType: 'software_instance',
      resourceId: `workstation:${stringInput(args.input, 'workstationId') ?? args.target ?? 'default'}`,
      ttlMs: 5 * 60 * 1000,
    }
  }
  return null
}

function isReadOnlyAction(actionType: RuntimeControlActionType): boolean {
  return actionType === 'observe_windows' || actionType === 'list_devices' || actionType === 'validate_workstation'
}

function isLowRiskLiveAction(actionType: RuntimeControlActionType): boolean {
  return actionType === 'release_workstation'
}

function requiredEnvForScope(scope: RuntimeControlScope, actionType: RuntimeControlActionType): string {
  if (scope === 'desktop' && actionType === 'capture_screenshot') return 'AGENTHUB_ENABLE_REAL_DESKTOP_CAPTURE'
  if (scope === 'desktop') return 'AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL'
  if (scope === 'mobile' && actionType === 'mobile_screenshot') return 'AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE'
  if (scope === 'mobile') return 'AGENTHUB_ENABLE_REAL_MOBILE_CONTROL'
  return 'AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH'
}

function defaultTargetForAction(args: ExecuteRuntimeControlActionArgs): string {
  if (args.scope === 'desktop') return 'physical_desktop:default'
  if (args.scope === 'mobile') return `mobile:${stringInput(args.input, 'deviceId') ?? args.target ?? 'default'}`
  return `workstation:${stringInput(args.input, 'workstationId') ?? args.target ?? 'default'}`
}

async function getRequiredAgentWorkstation(id: string): Promise<AgentWorkstationRow> {
  const row = await db.query.agentWorkstations.findFirst({
    where: eq(schema.agentWorkstations.id, id),
  })
  if (!row) throw new Error(`Agent workstation not found: ${id}`)
  return row
}

async function updateAgentWorkstationStatus(
  id: string,
  status: WorkstationStatus,
): Promise<AgentWorkstationRow> {
  const now = Date.now()
  await db
    .update(schema.agentWorkstations)
    .set({ status, updatedAt: now })
    .where(eq(schema.agentWorkstations.id, id))
  return getRequiredAgentWorkstation(id)
}

async function validateRuntimeControlApproval(args: {
  session: ComputerSessionRow
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target: string
  approvalRequestId: string | null
  inputHash: string
}): Promise<{ ok: true; approval: ApprovalRequestRow } | { ok: false; reason: string }> {
  if (!args.approvalRequestId) {
    return { ok: false, reason: 'High-risk runtime control requires an approvalRequestId.' }
  }
  const approval = await db.query.approvalRequests.findFirst({
    where: eq(schema.approvalRequests.id, args.approvalRequestId),
  })
  if (!approval) return { ok: false, reason: `Approval request not found: ${args.approvalRequestId}` }
  if (approval.status !== 'approved') {
    return { ok: false, reason: `Approval request ${approval.id} is ${approval.status}, not approved.` }
  }
  if (approval.type !== 'runtime_control_action') {
    return {
      ok: false,
      reason: `Approval request ${approval.id} has type ${approval.type}; expected runtime_control_action.`,
    }
  }
  if (approval.agentProfileId && approval.agentProfileId !== args.session.agentProfileId) {
    return { ok: false, reason: `Approval request ${approval.id} belongs to another Agent.` }
  }
  if (approval.runId && ![args.session.employeeRunId, args.session.workflowRunId].includes(approval.runId)) {
    return { ok: false, reason: `Approval request ${approval.id} belongs to another run.` }
  }

  const payload = approval.payload
  const payloadSessionId = readString(payload.computerSessionId)
  if (payloadSessionId && payloadSessionId !== args.session.id) {
    return { ok: false, reason: `Approval request ${approval.id} belongs to another computer session.` }
  }
  if (readString(payload.scope) !== args.scope) {
    return { ok: false, reason: `Approval request ${approval.id} does not approve scope ${args.scope}.` }
  }
  if (readString(payload.actionType) !== args.actionType) {
    return { ok: false, reason: `Approval request ${approval.id} does not approve action ${args.actionType}.` }
  }
  const payloadTarget = readString(payload.target)
  if (payloadTarget && payloadTarget !== args.target) {
    return { ok: false, reason: `Approval request ${approval.id} does not approve target ${args.target}.` }
  }
  const consumedAt = typeof payload.runtimeControlConsumedAt === 'number' ? payload.runtimeControlConsumedAt : null
  if (consumedAt) {
    return {
      ok: false,
      reason: `Approval request ${approval.id} was already consumed at ${new Date(consumedAt).toISOString()}.`,
    }
  }
  const payloadInputHash = readString(payload.inputHash)
  if (!payloadInputHash) {
    return {
      ok: false,
      reason: `Approval request ${approval.id} must include runtime input hash ${args.inputHash}.`,
    }
  }
  if (payloadInputHash !== args.inputHash) {
    return {
      ok: false,
      reason: `Approval request ${approval.id} does not approve runtime input hash ${args.inputHash}.`,
    }
  }
  await markRuntimeControlApprovalConsumed(approval, {
    sessionId: args.session.id,
    scope: args.scope,
    actionType: args.actionType,
    target: args.target,
    inputHash: args.inputHash,
  })
  return { ok: true, approval }
}

async function markRuntimeControlApprovalConsumed(
  approval: ApprovalRequestRow,
  args: {
    sessionId: string
    scope: RuntimeControlScope
    actionType: RuntimeControlActionType
    target: string
    inputHash: string
  },
): Promise<void> {
  await db
    .update(schema.approvalRequests)
    .set({
      payload: {
        ...approval.payload,
        runtimeControlConsumedAt: Date.now(),
        runtimeControlConsumedBySessionId: args.sessionId,
        runtimeControlConsumedScope: args.scope,
        runtimeControlConsumedActionType: args.actionType,
        runtimeControlConsumedTarget: args.target,
        runtimeControlConsumedInputHash: args.inputHash,
      },
    })
    .where(eq(schema.approvalRequests.id, approval.id))
}

function resolveScreenshotPath(session: ComputerSessionRow, input: JsonObject | undefined): string {
  const requested = stringInput(input, 'screenshotPath')
  const dir = path.join(session.tempPath, 'screenshots')
  mkdirSync(dir, { recursive: true })
  return requested
    ? resolveSessionOutputPath(session, requested, 'desktop screenshot')
    : path.join(dir, `screen-${Date.now()}.png`)
}

function resolveMobileScreenshotPath(session: ComputerSessionRow, input: JsonObject | undefined): string {
  const requested = stringInput(input, 'screenshotPath')
  const dir = path.join(session.tempPath, 'mobile-screenshots')
  mkdirSync(dir, { recursive: true })
  return requested
    ? resolveSessionOutputPath(session, requested, 'mobile screenshot')
    : path.join(dir, `mobile-${Date.now()}.png`)
}

function resolveSessionOutputPath(session: ComputerSessionRow, requestedPath: string, label: string): string {
  const base = path.resolve(session.tempPath)
  const resolved = path.resolve(requestedPath)
  assertPathInside(base, resolved, `${label} output path`, 'computer session tempPath')
  mkdirSync(path.dirname(resolved), { recursive: true })
  return resolved
}

function sessionOutputFileReference(
  session: ComputerSessionRow,
  absolutePath: string,
  label: string,
): SessionOutputFileReference {
  const tempRoot = path.resolve(session.tempPath)
  const resolved = path.resolve(absolutePath)
  assertPathInside(tempRoot, resolved, label, 'computer session tempPath')
  return {
    absolutePath: resolved,
    fileName: path.basename(resolved),
    relativePath: path.relative(tempRoot, resolved),
    directory: 'session_temp',
    pathRedacted: true,
  }
}

function screenshotOutputForPath(session: ComputerSessionRow, absolutePath: string): JsonObject {
  const file = sessionOutputFileReference(session, absolutePath, 'screenshot output')
  return {
    screenshotPath: file.relativePath,
    screenshotFileName: file.fileName,
    screenshotRelativePath: file.relativePath,
    screenshotDirectory: file.directory,
    screenshotPathRedacted: file.pathRedacted,
  }
}

function plannedScreenshotOutputForPath(session: ComputerSessionRow, absolutePath: string): JsonObject {
  const file = sessionOutputFileReference(session, absolutePath, 'planned screenshot output')
  return {
    plannedScreenshotPath: file.relativePath,
    plannedScreenshotFileName: file.fileName,
    plannedScreenshotRelativePath: file.relativePath,
    plannedScreenshotDirectory: file.directory,
    plannedScreenshotPathRedacted: file.pathRedacted,
  }
}

function writeRdpFile(workstation: AgentWorkstationRow): WorkstationRdpFileReference {
  const tempRoot = resolveWorkstationTempRoot(workstation)
  const dir = path.join(tempRoot, 'rdp')
  mkdirSync(dir, { recursive: true })
  const fileName = `${safeRuntimeFileSegment(workstation.id)}.rdp`
  const absolutePath = path.resolve(dir, fileName)
  assertPathInside(tempRoot, absolutePath, 'RDP launch file', 'workstation tempPath')
  writeFileSync(absolutePath, workstation.rdpConfig ?? '', 'utf8')
  return {
    absolutePath,
    fileName,
    relativePath: path.relative(tempRoot, absolutePath),
    directory: 'workstation_temp',
    pathRedacted: true,
  }
}

function resolveWorkstationTempRoot(workstation: AgentWorkstationRow): string {
  const tempPath = workstation.tempPath?.trim()
  if (!tempPath) throw new Error('workstation tempPath is required for remote workstation launch files.')
  const resolved = path.resolve(tempPath)
  mkdirSync(resolved, { recursive: true })
  return resolved
}

function assertPathInside(
  basePath: string,
  candidatePath: string,
  label: string,
  rootLabel = 'allowed directory',
): void {
  const base = path.resolve(basePath)
  const candidate = path.resolve(candidatePath)
  const baseForCompare = process.platform === 'win32' ? base.toLowerCase() : base
  const candidateForCompare = process.platform === 'win32' ? candidate.toLowerCase() : candidate
  if (candidateForCompare !== baseForCompare && !candidateForCompare.startsWith(`${baseForCompare}${path.sep}`)) {
    throw new Error(`${label} must stay inside the ${rootLabel}.`)
  }
}

function safeRuntimeFileSegment(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_.-]/g, '_')
  return sanitized || 'workstation'
}

function workstationLaunchPlanForOutput(
  workstation: AgentWorkstationRow,
  launchPlan: WorkstationLaunchPlan,
): JsonObject {
  const targetPreview = redactLaunchTargetPreview(launchPlan.targetPreview)
  const output: JsonObject = {
    kind: launchPlan.kind,
    command: launchPlan.command,
    args:
      launchPlan.kind === 'rdp_file'
        ? [`${safeRuntimeFileSegment(workstation.id)}.rdp`]
        : redactLaunchArgs(launchPlan.args),
    targetPreview: targetPreview.value,
    targetPreviewRedacted: targetPreview.redacted,
    blockingReasons: launchPlan.blockingReasons,
    warnings: launchPlan.warnings,
  }
  if (launchPlan.kind === 'rdp_file') {
    output.rdpFileName = `${safeRuntimeFileSegment(workstation.id)}.rdp`
    output.rdpFileDirectory = 'workstation_temp'
    output.rdpFilePathRedacted = true
  }
  return output
}

function redactLaunchArgs(args: string[]): string[] {
  return args.map((arg) => redactLaunchTargetPreview(arg).value ?? arg)
}

function redactLaunchTargetPreview(value: string | null): { value: string | null; redacted: boolean } {
  if (!value) return { value: value ?? null, redacted: false }
  try {
    const url = new URL(value)
    let redacted = false
    if (url.username) {
      url.username = 'redacted'
      redacted = true
    }
    if (url.password) {
      url.password = 'redacted'
      redacted = true
    }
    if (url.search) {
      url.search = '?redacted=1'
      redacted = true
    }
    if (url.hash) {
      url.hash = '#redacted'
      redacted = true
    }
    return { value: url.toString(), redacted }
  } catch {
    const redacted = value.replace(
      /\b(token|access_token|api_key|key|secret|password|credential)=([^\s&]+)/giu,
      '$1=[redacted]',
    )
    return { value: redacted, redacted: redacted !== value }
  }
}

async function launchWorkstationFromPlan(
  workstation: AgentWorkstationRow,
  launchPlan: WorkstationLaunchPlan,
): Promise<{ status: ComputerActionStatus; output: JsonObject }> {
  try {
    if (launchPlan.kind === 'rdp_file') {
      const rdpFile = writeRdpFile(workstation)
      const child = spawn('mstsc.exe', [rdpFile.absolutePath], { detached: true, stdio: 'ignore', windowsHide: true })
      child.unref()
      return {
        status: 'complete',
        output: {
          launched: 'mstsc.exe',
          rdpFileName: rdpFile.fileName,
          rdpFileRelativePath: rdpFile.relativePath,
          rdpFileDirectory: rdpFile.directory,
          rdpFilePathRedacted: rdpFile.pathRedacted,
        },
      }
    }
    if (launchPlan.kind === 'vnc_url' || launchPlan.kind === 'browser_url') {
      const url = launchPlan.targetPreview
      if (!url) return { status: 'blocked', output: { error: 'URL launch target is missing.' } }
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Start-Process -FilePath $env:AGENTHUB_WORKSTATION_URL'],
        {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          env: { ...process.env, AGENTHUB_WORKSTATION_URL: url },
        },
      )
      child.unref()
      const redactedUrl = redactLaunchTargetPreview(url)
      return {
        status: 'complete',
        output: {
          launched: launchPlan.kind,
          urlPreview: redactedUrl.value,
          urlPreviewRedacted: redactedUrl.redacted,
        },
      }
    }
    if (launchPlan.kind === 'rdp_host' || launchPlan.kind === 'hyperv' || launchPlan.kind === 'virtualbox' || launchPlan.kind === 'vmware') {
      if (!launchPlan.command) return { status: 'blocked', output: { error: 'Launch command is missing.' } }
      const child = spawn(launchPlan.command, launchPlan.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      return {
        status: 'complete',
        output: {
          launched: launchPlan.command,
          args: redactLaunchArgs(launchPlan.args),
          targetPreview: redactLaunchTargetPreview(launchPlan.targetPreview).value,
          targetPreviewRedacted: redactLaunchTargetPreview(launchPlan.targetPreview).redacted,
        },
      }
    }
    return { status: 'blocked', output: { error: 'Unsupported workstation launch plan.' } }
  } catch (err) {
    return { status: 'failed', output: { error: formatError(err) } }
  }
}

function buildWorkstationLaunchPlan(workstation: AgentWorkstationRow): WorkstationLaunchPlan {
  const blockingReasons: string[] = []
  const warnings: string[] = []
  if (workstation.rdpConfig?.trim()) {
    if (rdpConfigContainsSecret(workstation.rdpConfig)) {
      blockingReasons.push('rdpConfig must not contain passwords or credential blobs.')
    }
    return {
      kind: 'rdp_file',
      command: 'mstsc.exe',
      args: [`${workstation.id}.rdp`],
      targetPreview: rdpTargetPreview(workstation.rdpConfig),
      blockingReasons,
      warnings,
    }
  }

  if (workstation.vncUrl?.trim()) {
    const urlPlan = launchPlanForUrl(workstation.vncUrl.trim())
    return {
      ...urlPlan,
      blockingReasons: [...urlPlan.blockingReasons, ...blockingReasons],
      warnings: [...urlPlan.warnings, ...warnings],
    }
  }

  const displayId = workstation.displayId?.trim()
  if (!displayId) {
    return {
      kind: 'unsupported',
      command: null,
      args: [],
      targetPreview: null,
      blockingReasons: ['Workstation needs rdpConfig, vncUrl, or a supported displayId launcher.'],
      warnings,
    }
  }

  return launchPlanForDisplayId(displayId)
}

function launchPlanForUrl(rawUrl: string): WorkstationLaunchPlan {
  const blockingReasons: string[] = []
  const warnings: string[] = []
  try {
    const url = new URL(rawUrl)
    if (url.username || url.password) {
      blockingReasons.push('Remote URL must not embed usernames or passwords.')
    }
    if (url.protocol === 'vnc:') {
      return {
        kind: 'vnc_url',
        command: 'powershell.exe',
        args: ['Start-Process', rawUrl],
        targetPreview: rawUrl,
        blockingReasons,
        warnings,
      }
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return {
        kind: 'browser_url',
        command: 'powershell.exe',
        args: ['Start-Process', rawUrl],
        targetPreview: rawUrl,
        blockingReasons,
        warnings,
      }
    }
    blockingReasons.push('Remote URL must use vnc://, http://, or https://.')
  } catch {
    blockingReasons.push('Remote URL is not valid.')
  }
  return {
    kind: 'unsupported',
    command: null,
    args: [],
    targetPreview: rawUrl,
    blockingReasons,
    warnings,
  }
}

function launchPlanForDisplayId(displayId: string): WorkstationLaunchPlan {
  const [prefixRaw, ...rest] = displayId.split(':')
  const prefix = prefixRaw.toLowerCase()
  const target = rest.join(':').trim()
  if (!target) {
    return {
      kind: 'unsupported',
      command: null,
      args: [],
      targetPreview: displayId,
      blockingReasons: ['displayId must use provider:target, for example hyperv:AgentVM or virtualbox:AgentVM.'],
      warnings: [],
    }
  }
  if (prefix === 'rdp') {
    return {
      kind: 'rdp_host',
      command: 'mstsc.exe',
      args: [`/v:${target}`],
      targetPreview: target,
      blockingReasons: [],
      warnings: [],
    }
  }
  if (prefix === 'url' || prefix === 'vnc' || prefix === 'http' || prefix === 'https') {
    const rawUrl = prefix === 'url' ? target : `${prefix}:${target}`
    return launchPlanForUrl(rawUrl)
  }
  if (prefix === 'hyperv') {
    return {
      kind: 'hyperv',
      command: 'vmconnect.exe',
      args: ['localhost', target],
      targetPreview: target,
      blockingReasons: [],
      warnings: [],
    }
  }
  if (prefix === 'virtualbox' || prefix === 'vbox') {
    return {
      kind: 'virtualbox',
      command: 'VBoxManage',
      args: ['startvm', target, '--type', 'gui'],
      targetPreview: target,
      blockingReasons: [],
      warnings: [],
    }
  }
  if (prefix === 'vmware' || prefix === 'vmrun') {
    return {
      kind: 'vmware',
      command: 'vmrun',
      args: ['start', target, 'gui'],
      targetPreview: target,
      blockingReasons: [],
      warnings: [],
    }
  }
  return {
    kind: 'unsupported',
    command: null,
    args: [],
    targetPreview: displayId,
    blockingReasons: ['displayId provider is not supported. Use rdp:, url:, vnc:, hyperv:, virtualbox:, vbox:, vmware:, or vmrun:.'],
    warnings: [],
  }
}

function rdpTargetPreview(rdpConfig: string): string | null {
  const match = rdpConfig.match(/^\s*full address:s:(.+)$/im)
  return match?.[1]?.trim() ?? null
}

function rdpConfigContainsSecret(rdpConfig: string): boolean {
  return /\bpassword(?:\s+51)?:/i.test(rdpConfig) || /\bcredential(?:s)?:/i.test(rdpConfig)
}

function validateWorkstationReadiness(workstation: AgentWorkstationRow): JsonObject & {
  ready: boolean
  blockingReasons: string[]
  warnings: string[]
} {
  const blockingReasons: string[] = []
  const warnings: string[] = []
  const providerHints: string[] = []
  const launchPlan = buildWorkstationLaunchPlan(workstation)

  if (!existsSync(workstation.workspacePath)) blockingReasons.push('workspacePath does not exist.')
  if (!existsSync(workstation.browserProfilePath)) blockingReasons.push('browserProfilePath does not exist.')
  if (!existsSync(workstation.tempPath)) blockingReasons.push('tempPath does not exist.')
  blockingReasons.push(...launchPlan.blockingReasons)
  warnings.push(...launchPlan.warnings)
  if (launchPlan.command && !commandAvailableForLaunchPlan(launchPlan.command)) {
    blockingReasons.push(`Launch command is not available on this host: ${launchPlan.command}.`)
  }

  if (workstation.mode === 'remote_session') {
    const hasRdp = Boolean(workstation.rdpConfig?.trim())
    const hasVnc = Boolean(workstation.vncUrl?.trim())
    if (!hasRdp && !hasVnc) {
      blockingReasons.push('remote_session needs rdpConfig or vncUrl.')
    }
    if (workstation.rdpConfig && !/\bfull address:s:/i.test(workstation.rdpConfig)) {
      warnings.push('rdpConfig does not contain a full address:s: entry.')
    }
    if (workstation.vncUrl) {
      try {
        const url = new URL(workstation.vncUrl)
        if (!['vnc:', 'http:', 'https:'].includes(url.protocol)) {
          warnings.push('vncUrl should use vnc://, http://, or https://.')
        }
      } catch {
        blockingReasons.push('vncUrl is not a valid URL.')
      }
    }
    providerHints.push('RDP launch uses mstsc.exe on Windows when AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH=1.')
    providerHints.push('VNC and browser URLs launch through the operating-system registered handler.')
  }

  if (workstation.mode === 'vm' || workstation.mode === 'virtual_desktop') {
    if (!workstation.displayId && !workstation.rdpConfig && !workstation.vncUrl) {
      blockingReasons.push(`${workstation.mode} needs displayId, rdpConfig, or vncUrl metadata.`)
    }
    providerHints.push('VM providers are discovered through Hyper-V, VirtualBox, VMware, RDP, or VNC probes.')
    providerHints.push('displayId supports rdp:, url:, vnc:, hyperv:, virtualbox:, vbox:, vmware:, and vmrun: launchers.')
  }

  if (workstation.status === 'error') blockingReasons.push('workstation status is error.')
  if (workstation.status === 'busy') warnings.push('workstation is currently busy.')

  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    providerHints,
    launchPlan: workstationLaunchPlanForOutput(workstation, launchPlan),
    pathChecks: {
      workspacePath: existsSync(workstation.workspacePath),
      browserProfilePath: existsSync(workstation.browserProfilePath),
      tempPath: existsSync(workstation.tempPath),
    },
  }
}

function commandAvailableForLaunchPlan(command: string): boolean {
  if (path.isAbsolute(command) || command.includes(path.sep) || command.includes('/')) return existsSync(command)
  const locator = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(locator, [command], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 3000,
  })
  return result.status === 0
}

async function runCommand(
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<{ ok: true; stdout: string; stderr: string } | { ok: false; error: string; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 8000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, ...env },
    })
    return { ok: true, stdout: String(stdout), stderr: String(stderr) }
  } catch (err) {
    const maybe = err as { message?: string; stdout?: unknown; stderr?: unknown }
    return {
      ok: false,
      error: maybe.message ?? String(err),
      stdout: String(maybe.stdout ?? ''),
      stderr: String(maybe.stderr ?? ''),
    }
  }
}

async function runCommandBuffer(
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<{ ok: true; stdout: Buffer; stderr: string } | { ok: false; error: string; stdout: Buffer; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 8000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'buffer',
      env: { ...process.env, ...env },
    })
    return {
      ok: true,
      stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(String(stdout)),
      stderr: Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr),
    }
  } catch (err) {
    const maybe = err as { message?: string; stdout?: unknown; stderr?: unknown }
    const stdout = Buffer.isBuffer(maybe.stdout)
      ? maybe.stdout
      : Buffer.from(String(maybe.stdout ?? ''))
    return {
      ok: false,
      error: maybe.message ?? String(err),
      stdout,
      stderr: Buffer.isBuffer(maybe.stderr)
        ? maybe.stderr.toString('utf8')
        : String(maybe.stderr ?? ''),
    }
  }
}

function parseJsonArray(value: string): unknown[] {
  if (!value.trim()) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

function parseAdbDevices(stdout: string): Array<{ id: string; status: string; description: string }> {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, status, ...rest] = line.split(/\s+/)
      return { id, status: status ?? 'unknown', description: rest.join(' ') }
    })
}

function numberInput(input: JsonObject | undefined, key: string): number | null {
  const value = input?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function stringInput(input: JsonObject | undefined, key: string): string | null {
  const value = input?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function runtimeControlInputHash(input: JsonObject): string {
  return `sha256:${createHash('sha256').update(stableStringify(input)).digest('hex')}`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

function firstLine(value: string): string | null {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null
}

function escapeAdbText(value: string): string {
  return value.replace(/\s/g, '%s').replace(/[&|;<>()$`\\"]/g, '')
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const CLICK_SCRIPT = `
param([int]$x,[int]$y)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AgentHubMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
}
"@
[AgentHubMouse]::SetCursorPos($x, $y) | Out-Null
[AgentHubMouse]::mouse_event(0x0002, $x, $y, 0, 0)
Start-Sleep -Milliseconds 60
[AgentHubMouse]::mouse_event(0x0004, $x, $y, 0, 0)
`

const SCROLL_SCRIPT = `
param([int]$delta,[string]$x,[string]$y)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AgentHubScroll {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
}
"@
if ($x -and $y) {
  [AgentHubScroll]::SetCursorPos([int]$x, [int]$y) | Out-Null
}
[AgentHubScroll]::mouse_event(0x0800, 0, 0, $delta, 0)
`

const SEND_KEYS_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
$text = $env:AGENTHUB_SEND_KEYS_TEXT
[System.Windows.Forms.SendKeys]::SendWait($text)
`

const FOCUS_WINDOW_SCRIPT = `
$process = $env:AGENTHUB_FOCUS_PROCESS
$title = $env:AGENTHUB_FOCUS_TITLE
$candidates = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and
  (($process -and $_.ProcessName -like "*$process*") -or ($title -and $_.MainWindowTitle -like "*$title*"))
}
$target = $candidates | Select-Object -First 1
if (-not $target) { throw "No matching window" }
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AgentHubWindow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@
[AgentHubWindow]::ShowWindowAsync($target.MainWindowHandle, 5) | Out-Null
[AgentHubWindow]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
$target.ProcessName + ":" + $target.MainWindowTitle
`

const SCREENSHOT_SCRIPT = `
param([string]$path)
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`

import { NextRequest } from 'next/server'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'

import { POST as probeModelCapability } from '../src/app/api/model-profiles/[id]/capability-probe/route'
import { POST as probeDesktop } from '../src/app/api/production-integrations/desktop/probe/route'
import { POST as exportCustomerEnvironmentPackage } from '../src/app/api/production-integrations/customer-environment/package/route'
import { GET as getCustomerEnvironmentReport } from '../src/app/api/production-integrations/customer-environment/report/route'
import {
  GET as getOnsiteEvidenceReport,
  POST as recordOnsiteEvidence,
} from '../src/app/api/production-integrations/final-acceptance/evidence/route'
import { GET as getFinalAcceptanceLedger } from '../src/app/api/production-integrations/final-acceptance/ledger/route'
import { POST as createGoLiveDecision } from '../src/app/api/production-integrations/go-live/decision/route'
import { GET as getGoLiveDrill } from '../src/app/api/production-integrations/go-live/drill/route'
import { POST as createLivePilotLease } from '../src/app/api/production-integrations/go-live/live-pilot/route'
import {
  DELETE as stopLivePilotSession,
  GET as getLivePilotSessionReport,
  POST as startLivePilotSession,
} from '../src/app/api/production-integrations/go-live/live-pilot/session/route'
import { GET as getHardeningReport } from '../src/app/api/production-integrations/hardening-report/route'
import { GET as getExecutionPreflight } from '../src/app/api/production-integrations/execution-preflight/route'
import { GET as getLiveConnectorReport } from '../src/app/api/production-integrations/live-connectors/report/route'
import { GET as getPackageIntegrityReport } from '../src/app/api/production-integrations/package-integrity/report/route'
import {
  GET as getModelCredentialIntakeReport,
  POST as applyModelCredentialIntake,
} from '../src/app/api/production-integrations/model-credentials/intake/route'
import { GET as getModelCredentialReport } from '../src/app/api/production-integrations/model-credentials/report/route'
import { GET as getOnsiteIntakeChecklist } from '../src/app/api/production-integrations/onsite-intake/checklist/route'
import { POST as exportOnsiteActivationPackage } from '../src/app/api/production-integrations/onsite-activation/package/route'
import { GET as getOnsiteActivationGuide } from '../src/app/api/production-integrations/onsite-activation/guide/route'
import { POST as discoverMobile } from '../src/app/api/production-integrations/mobile/devices/route'
import { GET as getReadiness } from '../src/app/api/production-integrations/readiness/route'
import { GET as getRealControlReport } from '../src/app/api/production-integrations/real-control/report/route'
import { GET as getRuntimeControlReadiness } from '../src/app/api/production-integrations/runtime-control/readiness/route'
import { GET as getSetupGuide } from '../src/app/api/production-integrations/setup-guide/route'
import { POST as discoverWorkstationProviders } from '../src/app/api/production-integrations/workstations/providers/route'
import {
  GET as getWorkstationRecovery,
  POST as recoverStaleWorkstations,
} from '../src/app/api/production-integrations/workstations/recovery/route'
import { POST as reserveWorkstation } from '../src/app/api/production-integrations/workstations/reservations/route'
import { POST as runtimeControl } from '../src/app/api/computer-sessions/[id]/runtime-control/route'
import { POST as runSoftwareCommandRoute } from '../src/app/api/software-commands/[id]/run/route'
import {
  createAgentProfile,
  createApprovalRequest,
  createModelProfile,
  createNetworkProfile,
  createSoftwareCommand,
  createSoftwareProfile,
  respondApprovalRequest,
} from '../src/server/control-plane-service'
import { db, schema } from '../src/db/client'
import {
  getEmployeeRunSnapshot,
  startEmployeeRun,
} from '../src/server/employee-runtime-service'
import { testModelConnection } from '../src/server/model-gateway-service'
import { executeRuntimeControlAction } from '../src/server/runtime-control-service'
import { createCredentialScope, createSecret, recordAuditLog } from '../src/server/security-service'

async function readJson(response: Response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function commandExists(command: string): boolean {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(locator, [command], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 3000,
  })
  return result.status === 0
}

function objectContainsString(value: unknown, needle: string): boolean {
  if (!needle) return false
  if (typeof value === 'string') return value.includes(needle)
  if (Array.isArray(value)) return value.some((item) => objectContainsString(item, needle))
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => objectContainsString(item, needle))
  }
  return false
}

function assertReadableChineseMarkdown(markdown: string, label: string) {
  const mojibakeMarkers = ['锛', '鐪', '婵', '闃', '�']
  const englishUiMarkers = [
    'Runtime guardrails',
    '| Guard |',
    'Emergency stop:',
    'configured |',
    'missing |',
    'model_endpoint_host_allowlist',
    'desktop_target_allowlist',
    'mobile_device_allowlist',
    'mobile_app_package_allowlist',
    'workstation_target_allowlist',
    'Model endpoint host',
    'PowerShell available',
    'visible windows observed',
    'Allowed model endpoint hosts',
    'Allowed desktop windows/processes',
    'Allowed mobile device ids',
    'Allowed mobile app packages',
    'Allowed VM/RDP/VNC workstation targets',
    'Runtime control emergency stop',
  ]
  const blockedMarkers = [...mojibakeMarkers, ...englishUiMarkers].filter((marker) => markdown.includes(marker))
  assert(
    blockedMarkers.length === 0,
    `Expected ${label} markdown to be readable Chinese without mojibake or English UI remnants: ${blockedMarkers.join(', ')}`,
  )
  const rawStatusPattern = /状态：(blocked|available|ready|not_configured|needs_action|not_installed|failed|planned|complete|done|stopped)\b/u
  const rawRiskPattern = /风险：(low|medium|high)\b/u
  const rawTableRiskPattern = /\|\s*(low|medium|high)\s*\|/u
  assert(
    !rawStatusPattern.test(markdown) && !rawRiskPattern.test(markdown) && !rawTableRiskPattern.test(markdown),
    `Expected ${label} markdown to translate raw status and risk enums into Chinese labels.`,
  )
}

function postRequest(path: string, body: unknown) {
  return new NextRequest(`http://local${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getRequest(path: string) {
  return new NextRequest(`http://local${path}`, { method: 'GET' })
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
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

const GO_LIVE_BOUND_ENV_VARS = [
  'AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED',
  'AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH',
  'AGENTHUB_ADB_ARGS_PREFIX_JSON',
  'AGENTHUB_ADB_PATH',
  'AGENTHUB_ALLOWED_DESKTOP_TARGETS',
  'AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES',
  'AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS',
  'AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS',
  'AGENTHUB_ALLOWED_WORKSTATION_TARGETS',
  'AGENTHUB_ENABLE_REAL_DESKTOP_CAPTURE',
  'AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL',
  'AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE',
  'AGENTHUB_ENABLE_REAL_MOBILE_CONTROL',
  'AGENTHUB_ENABLE_REAL_MODEL_CONNECTION',
  'AGENTHUB_ENABLE_REAL_MODEL_INVOCATION',
  'AGENTHUB_ENABLE_REAL_NETWORK_EGRESS_TEST',
  'AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH',
  'AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH',
] as const

function goLiveEnvironmentFingerprint() {
  return [...GO_LIVE_BOUND_ENV_VARS]
    .sort((a, b) => a.localeCompare(b))
    .map((envVar) => {
      const value = process.env[envVar]?.trim() ?? ''
      return {
        envVar,
        configured: value.length > 0,
        valueHash: value ? sha256Text(value) : null,
      }
    })
}

async function main() {
  const smokeIntakeEnvVar = 'AGENTHUB_SMOKE_MODEL_INTAKE_KEY'
  const previousFetch = globalThis.fetch
  const previousSmokeKey = process.env.AGENTHUB_SMOKE_MODEL_KEY
  const previousSmokeIntakeKey = process.env[smokeIntakeEnvVar]
  const previousDesktopControl = process.env.AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL
  const previousDesktopTargetAllowlist = process.env.AGENTHUB_ALLOWED_DESKTOP_TARGETS
  const previousRuntimeControlKillSwitch = process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH
  const previousMobileControl = process.env.AGENTHUB_ENABLE_REAL_MOBILE_CONTROL
  const previousMobileCapture = process.env.AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE
  const previousMobileDeviceAllowlist = process.env.AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS
  const previousMobileAppAllowlist = process.env.AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES
  const previousAdbPath = process.env.AGENTHUB_ADB_PATH
  const previousAdbArgsPrefix = process.env.AGENTHUB_ADB_ARGS_PREFIX_JSON
  const previousWorkstationLaunch = process.env.AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH
  const previousWorkstationTargetAllowlist = process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS
  const previousModelConnection = process.env.AGENTHUB_ENABLE_REAL_MODEL_CONNECTION
  const previousModelInvocation = process.env.AGENTHUB_ENABLE_REAL_MODEL_INVOCATION
  const previousModelEndpointAllowlist = process.env.AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS
  const previousCustomerAuthorized = process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED
  const previousCustomerAuthorizationEvidenceHash = process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH
  const previousApprovedGoLiveHash = process.env.AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH
  const previousLivePilotLeaseHash = process.env.AGENTHUB_LIVE_PILOT_LEASE_HASH
  const previousVaultMasterKey = process.env.AGENTHUB_VAULT_MASTER_KEY
  const previousVaultMasterKeyId = process.env.AGENTHUB_VAULT_MASTER_KEY_ID
  const previousVaultMasterKeyRotatedAt = process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATED_AT
  const previousVaultMasterKeyRotationDays = process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATION_DAYS
  process.env.AGENTHUB_SMOKE_MODEL_KEY = 'smoke-model-key'
  process.env[smokeIntakeEnvVar] = 'smoke-model-intake-key'
  process.env.AGENTHUB_VAULT_MASTER_KEY = 'VLTmk_20260622_b9f4c2d7a8e6f3c1d0a5b7e9c4f2d8a6'
  process.env.AGENTHUB_VAULT_MASTER_KEY_ID = 'vlt-20260622-a8e6f3c1'
  process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATED_AT = new Date().toISOString()
  process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATION_DAYS = '90'
  delete process.env.AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL
  delete process.env.AGENTHUB_ALLOWED_DESKTOP_TARGETS
  delete process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH
  delete process.env.AGENTHUB_ENABLE_REAL_MOBILE_CONTROL
  delete process.env.AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE
  delete process.env.AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS
  delete process.env.AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES
  delete process.env.AGENTHUB_ADB_PATH
  delete process.env.AGENTHUB_ADB_ARGS_PREFIX_JSON
  delete process.env.AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH
  delete process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS
  delete process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED
  delete process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH
  delete process.env.AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH
  delete process.env.AGENTHUB_LIVE_PILOT_LEASE_HASH
  delete process.env.AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS
  process.env.AGENTHUB_ENABLE_REAL_MODEL_CONNECTION = '1'
  process.env.AGENTHUB_ENABLE_REAL_MODEL_INVOCATION = '1'
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const url = String(_input instanceof Request ? _input.url : _input)
    const headers = new Headers(init?.headers)
    const authorization = headers.get('authorization')
    const googleApiKey = headers.get('x-goog-api-key')
    assert(
      Boolean((init as RequestInit & { dispatcher?: unknown } | undefined)?.dispatcher),
      'Expected live model request to include Network Profile proxy dispatcher.',
    )
    if (url.includes(':generateContent')) {
      assert(googleApiKey === 'smoke-model-key', 'Expected Gemini probe to use x-goog-api-key from Secret Vault.')
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        generationConfig?: { responseMimeType?: string }
        contents?: Array<{ parts?: unknown[] }>
      }
      assert(
        body.generationConfig?.responseMimeType === 'application/json',
        'Expected Gemini JSON probe to request application/json response MIME type.',
      )
      assert(Array.isArray(body.contents?.[0]?.parts), 'Expected Gemini probe to send content parts.')
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    assert(authorization === 'Bearer smoke-model-key', 'Expected live model test to use Secret Vault credential.')
    if (url.includes('/chat/completions')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { response_format?: { type?: string } }
      assert(body.response_format?.type === 'json_object', 'Expected model capability probe to request JSON mode.')
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  const agent = await createAgentProfile({
    name: 'Smoke Production Workstation Agent',
    role: 'production-integration-smoke',
    outputContract: { artifactType: 'report' },
    workstationPolicy: {
      mode: 'remote_session',
      isolatedBrowserProfile: true,
      isolatedWorkspace: true,
    },
    autonomyPolicy: {
      level: 'fully_autonomous',
      selfRecovery: true,
      requireApprovalForHighRisk: true,
    },
    permissionPolicy: {
      desktop: { operate: true },
      browser: { operate: true },
      software: { operate: true },
    },
    status: 'active',
  })
  const secret = await createSecret({
    name: 'Smoke model key',
    kind: 'env_ref',
    valueRef: 'AGENTHUB_SMOKE_MODEL_KEY',
  })
  const network = await createNetworkProfile({
    name: 'Smoke model proxy outlet',
    mode: 'http_proxy',
    proxyUrl: 'http://127.0.0.1:18080',
    appliesTo: 'model_only',
  })
  const model = await createModelProfile({
    name: 'Smoke vaulted model',
    provider: 'openai',
    baseUrl: 'https://example.invalid/v1',
    apiKeyRef: `secret:${secret.id}`,
    model: 'smoke-model',
    networkProfileId: network.id,
    supportsToolCalling: true,
    supportsJsonMode: true,
  })
  await createCredentialScope({
    secretId: secret.id,
    resourceType: 'model_profile',
    resourceId: model.id,
    capability: 'model.connect',
  })
  await createCredentialScope({
    secretId: secret.id,
    resourceType: 'model_profile',
    resourceId: model.id,
    capability: 'model.invoke',
  })
  const unscopedSecret = await createSecret({
    name: 'Smoke unscoped model key',
    kind: 'env_ref',
    valueRef: 'AGENTHUB_SMOKE_MODEL_KEY',
  })
  const unscopedModel = await createModelProfile({
    name: 'Smoke unscoped vaulted model',
    provider: 'openai',
    baseUrl: 'https://example.invalid/v1',
    apiKeyRef: `secret:${unscopedSecret.id}`,
    model: 'smoke-model',
    networkProfileId: network.id,
    supportsJsonMode: true,
  })
  const googleModel = await createModelProfile({
    name: 'Smoke Gemini vaulted model',
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/',
    apiKeyRef: `secret:${secret.id}`,
    model: 'gemini-1.5-flash',
    networkProfileId: network.id,
    supportsVision: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
  })
  await createCredentialScope({
    secretId: secret.id,
    resourceType: 'model_profile',
    resourceId: googleModel.id,
    capability: 'model.invoke',
  })
  const envIntakeModel = await createModelProfile({
    name: 'Smoke env intake model',
    provider: 'openai',
    baseUrl: 'https://example.invalid/v1',
    apiKeyRef: `env:${smokeIntakeEnvVar}`,
    model: 'smoke-env-intake-model',
    networkProfileId: network.id,
    supportsJsonMode: true,
  })
  const intakeReportBeforePayload = await readJson(await getModelCredentialIntakeReport())
  const intakeDryRunPayload = await readJson(
    await applyModelCredentialIntake(
      postRequest('/api/production-integrations/model-credentials/intake', {
        modelProfileId: envIntakeModel.id,
        envVar: smokeIntakeEnvVar,
      }),
    ),
  )
  const intakeApplyPayload = await readJson(
    await applyModelCredentialIntake(
      postRequest('/api/production-integrations/model-credentials/intake', {
        modelProfileId: envIntakeModel.id,
        envVar: smokeIntakeEnvVar,
        confirmMigrate: true,
      }),
    ),
  )
  const intakeReportAfterPayload = await readJson(await getModelCredentialIntakeReport())
  delete process.env.AGENTHUB_ENABLE_REAL_MODEL_CONNECTION
  const blockedModelConnectionTest = await testModelConnection({
    modelProfileId: model.id,
    live: true,
    confirmExternalCall: true,
  })
  process.env.AGENTHUB_ENABLE_REAL_MODEL_CONNECTION = '1'
  const blockedModelEndpointAllowlistTest = await testModelConnection({
    modelProfileId: model.id,
    live: true,
    confirmExternalCall: true,
  })
  process.env.AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS = 'example.invalid; generativelanguage.googleapis.com'
  const modelTest = await testModelConnection({
    modelProfileId: model.id,
    live: true,
    confirmExternalCall: true,
  })
  const unscopedModelTest = await testModelConnection({
    modelProfileId: unscopedModel.id,
    live: true,
    confirmExternalCall: true,
  })
  const modelInvokeProbePayload = await readJson(
    await probeModelCapability(
      postRequest(`/api/model-profiles/${model.id}/capability-probe`, {
        kind: 'json',
        live: true,
        confirmExternalCall: true,
      }),
      { params: Promise.resolve({ id: model.id }) },
    ),
  )
  const modelInvokeProbe = modelInvokeProbePayload.modelConnectionTest
  const googleProbePayload = await readJson(
    await probeModelCapability(
      postRequest(`/api/model-profiles/${googleModel.id}/capability-probe`, {
        kind: 'json',
        live: true,
        confirmExternalCall: true,
      }),
      { params: Promise.resolve({ id: googleModel.id }) },
    ),
  )
  const googleModelInvokeProbe = googleProbePayload.modelConnectionTest

  const modelCredentialReportPayload = await readJson(await getModelCredentialReport())
  const modelCredentialReport = modelCredentialReportPayload.report
  const scopedModelCredential = modelCredentialReport.models.find(
    (item: { modelProfileId: string }) => item.modelProfileId === model.id,
  )
  const unscopedModelCredential = modelCredentialReport.models.find(
    (item: { modelProfileId: string }) => item.modelProfileId === unscopedModel.id,
  )
  const envIntakeCredential = modelCredentialReport.models.find(
    (item: { modelProfileId: string }) => item.modelProfileId === envIntakeModel.id,
  )
  assert(scopedModelCredential, 'Expected model credential report to include scoped smoke model.')
  assert(unscopedModelCredential, 'Expected model credential report to include unscoped smoke model.')
  assert(envIntakeCredential, 'Expected model credential report to include migrated env intake model.')
  assert(
    intakeReportBeforePayload.report.items.some(
      (item: { modelProfileId: string; canMigrateFromEnv: boolean }) =>
        item.modelProfileId === envIntakeModel.id && item.canMigrateFromEnv === true,
    ),
    'Expected env-backed model to be migratable before credential intake apply.',
  )
  assert(
    intakeDryRunPayload.result.applied === false &&
      intakeDryRunPayload.result.redacted === true &&
      intakeDryRunPayload.result.plan.proposedEnvVar === smokeIntakeEnvVar &&
      /^secret:/.test(String(intakeDryRunPayload.result.nextApiKeyRef)),
    `Expected credential intake dry-run to avoid writes and expose redacted plan: ${JSON.stringify(intakeDryRunPayload.result)}`,
  )
  assert(
    intakeApplyPayload.result.applied === true &&
      intakeApplyPayload.result.createdScopes.length === 2 &&
      /^secret:sec_/.test(intakeApplyPayload.result.nextApiKeyRef),
    `Expected credential intake apply to bind secret ref and scopes: ${JSON.stringify(intakeApplyPayload.result)}`,
  )
  assert(
    intakeReportAfterPayload.report.items.some(
      (item: { modelProfileId: string; credentialRefKind: string; connectScope: string; invokeScope: string }) =>
        item.modelProfileId === envIntakeModel.id &&
        item.credentialRefKind === 'secret_vault' &&
        item.connectScope === 'allowed' &&
        item.invokeScope === 'allowed',
    ),
    'Expected migrated env intake model to become a scoped Secret Vault model.',
  )
  assert(
    ['available', 'ready'].includes(scopedModelCredential.status),
    `Expected scoped smoke model credentials to be structurally usable: ${scopedModelCredential.status}`,
  )
  assert(scopedModelCredential.credential.refKind === 'secret_vault', 'Expected scoped model to use Secret Vault.')
  assert(scopedModelCredential.credential.secretValuePresent === true, 'Expected scoped model secret to be present.')
  assert(scopedModelCredential.credential.connectScope === 'allowed', 'Expected model.connect scope to be allowed.')
  assert(scopedModelCredential.credential.invokeScope === 'allowed', 'Expected model.invoke scope to be allowed.')
  assert(envIntakeCredential.credential.refKind === 'secret_vault', 'Expected env intake model to use Secret Vault after migration.')
  assert(envIntakeCredential.credential.connectScope === 'allowed', 'Expected env intake model.connect scope.')
  assert(envIntakeCredential.credential.invokeScope === 'allowed', 'Expected env intake model.invoke scope.')
  assert(scopedModelCredential.latestLiveConnection?.status === 'ok', 'Expected live connection evidence.')
  assert(
    scopedModelCredential.latestLiveInvocation?.status === 'failed' &&
      scopedModelCredential.latestLiveInvocation.message.includes('AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH'),
    `Expected live invocation to be blocked by go-live hash gate: ${JSON.stringify(scopedModelCredential.latestLiveInvocation)}`,
  )
  assert(unscopedModelCredential.credential.connectScope === 'missing', 'Expected unscoped connect scope to be missing.')
  assert(unscopedModelCredential.credential.invokeScope === 'missing', 'Expected unscoped invoke scope to be missing.')
  assert(
    modelCredentialReport.summary.modelProfiles >= 1,
    'Expected production model credential report to count model profiles.',
  )

  const readinessPayload = await readJson(await getReadiness())
  const desktopPayload = await readJson(
    await probeDesktop(postRequest('/api/production-integrations/desktop/probe', {
      live: true,
      includeWindowList: true,
    })),
  )
  const mobilePayload = await readJson(
    await discoverMobile(postRequest('/api/production-integrations/mobile/devices', { live: false })),
  )
  const workstationProvidersPayload = await readJson(
    await discoverWorkstationProviders(
      postRequest('/api/production-integrations/workstations/providers', { live: false }),
    ),
  )
  const reservationPayload = await readJson(
    await reserveWorkstation(
      postRequest('/api/production-integrations/workstations/reservations', {
        agentProfileId: agent.id,
        mode: 'remote_session',
        displayId: 'smoke-rdp',
        rdpConfig: 'full address:s:smoke.local',
      }),
    ),
  )
  const noLaunchReservationPayload = await readJson(
    await reserveWorkstation(
      postRequest('/api/production-integrations/workstations/reservations', {
        agentProfileId: agent.id,
        mode: 'remote_session',
        displayId: 'smoke-no-rdp-config',
      }),
    ),
  )
  const vncReservationPayload = await readJson(
    await reserveWorkstation(
      postRequest('/api/production-integrations/workstations/reservations', {
        agentProfileId: agent.id,
        mode: 'remote_session',
        vncUrl: 'vnc://127.0.0.1:5900',
      }),
    ),
  )
  const vmReservationPayload = await readJson(
    await reserveWorkstation(
      postRequest('/api/production-integrations/workstations/reservations', {
        agentProfileId: agent.id,
        mode: 'vm',
        displayId: 'hyperv:SmokeAgentVM',
      }),
    ),
  )
  const virtualboxCommandAvailable = commandExists('VBoxManage')
  const virtualboxReservationPayload = await readJson(
    await reserveWorkstation(
      postRequest('/api/production-integrations/workstations/reservations', {
        agentProfileId: agent.id,
        mode: 'vm',
        displayId: 'virtualbox:SmokeAgentVBox',
      }),
    ),
  )
  const targetMismatchReservationPayload = await readJson(
    await reserveWorkstation(
      postRequest('/api/production-integrations/workstations/reservations', {
        agentProfileId: agent.id,
        mode: 'remote_session',
        displayId: 'smoke-target-mismatch',
        rdpConfig: 'full address:s:unapproved-rdp-host.local',
      }),
    ),
  )
  const rejectedWorkstationPathResponse = await reserveWorkstation(
    postRequest('/api/production-integrations/workstations/reservations', {
      agentProfileId: agent.id,
      mode: 'remote_session',
      workspacePath: 'C:\\agenthub-outside-workstation',
      rdpConfig: 'full address:s:smoke.local',
    }),
  )
  const rejectedWorkstationPathText = await rejectedWorkstationPathResponse.text()
  const rejectedRdpSecretResponse = await reserveWorkstation(
    postRequest('/api/production-integrations/workstations/reservations', {
      agentProfileId: agent.id,
      mode: 'remote_session',
      rdpConfig: 'full address:s:smoke.local\npassword 51:b:01020304',
    }),
  )
  const rejectedRdpSecretText = await rejectedRdpSecretResponse.text()
  const rejectedVncSecretResponse = await reserveWorkstation(
    postRequest('/api/production-integrations/workstations/reservations', {
      agentProfileId: agent.id,
      mode: 'remote_session',
      vncUrl: 'vnc://smoke-user:smoke-pass@127.0.0.1:5900',
    }),
  )
  const rejectedVncSecretText = await rejectedVncSecretResponse.text()
  const run = await startEmployeeRun({
    agentProfileId: agent.id,
    goal: 'Prime runtime control adapters for production integration smoke.',
    autoComplete: true,
  })
  const snapshot = await getEmployeeRunSnapshot(run.id)
  const session = snapshot.computerSessions[0]
  assert(session, 'Expected employee runtime to create a computer session.')
  const softwareProfile = await createSoftwareProfile({
    name: 'Smoke Desktop Software',
    appType: 'native_app',
    adapterType: 'desktop_automation',
    defaultWorkstationMode: 'physical_desktop',
  })
  const softwareCommand = await createSoftwareCommand({
    softwareProfileId: softwareProfile.id,
    name: 'Smoke blocked desktop input',
    description: 'Attempts a gated desktop input through runtime-control.',
    implementation: {
      type: 'desktop',
      actionType: 'type_text',
      input: { text: 'blocked-software-command-input' },
    },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    riskLevel: 'low',
    requiresApproval: false,
  })
  const approvalBoundSoftwareCommand = await createSoftwareCommand({
    softwareProfileId: softwareProfile.id,
    name: 'Smoke approval-bound desktop input',
    description: 'Verifies software command approvals are bound to the exact runtime input.',
    implementation: {
      type: 'desktop',
      actionType: 'type_text',
    },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    riskLevel: 'high',
    requiresApproval: true,
  })
  const mobileSoftwareProfile = await createSoftwareProfile({
    name: 'Smoke Mobile Software',
    appType: 'mobile_app',
    adapterType: 'desktop_automation',
    defaultWorkstationMode: 'physical_desktop',
  })
  const mobileScreenshotSoftwareCommand = await createSoftwareCommand({
    softwareProfileId: mobileSoftwareProfile.id,
    name: 'Smoke mobile screenshot software command',
    description: 'Maps a software command to runtime-control mobile_screenshot.',
    implementation: {
      type: 'mobile',
      actionType: 'mobile_screenshot',
      input: { deviceId: 'smoke-device' },
    },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    riskLevel: 'low',
    requiresApproval: false,
  })
  const mobileSwipeSoftwareCommand = await createSoftwareCommand({
    softwareProfileId: mobileSoftwareProfile.id,
    name: 'Smoke mobile swipe software command',
    description: 'Maps a software command to runtime-control mobile_swipe.',
    implementation: {
      type: 'mobile',
      actionType: 'mobile_swipe',
      input: { deviceId: 'smoke-device', x1: 100, y1: 900, x2: 100, y2: 300, durationMs: 250 },
    },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    riskLevel: 'low',
    requiresApproval: false,
  })
  const blockedRuntimeControlPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'type_text',
        input: { text: 'blocked-smoke-input' },
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH = '1'
  const killSwitchRuntimeControlPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'type_text',
        input: { text: 'kill-switch-smoke-input' },
        live: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  delete process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH
  const desktopScrollDryRunPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'scroll',
        input: { delta: -240, x: 640, y: 480 },
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const desktopClickDryRunPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'click',
        target: 'allowed-smoke-window',
        input: { x: 30, y: 40 },
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const desktopTextDryRunPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'type_text',
        target: 'allowed-smoke-window',
        input: { text: 'planned-desktop-target' },
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  process.env.AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL = '1'
  process.env.AGENTHUB_ALLOWED_DESKTOP_TARGETS = 'allowed-smoke-window; powershell'
  const blockedDesktopTargetAllowlistPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'type_text',
        target: 'blocked-smoke-window',
        input: { text: 'blocked-desktop-target' },
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const allowedDesktopTargetAllowlistPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'type_text',
        target: 'allowed-smoke-window',
        input: { text: 'allowed-desktop-target' },
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const desktopRuntimeApprovalInput = {
    text: 'approved-desktop-target',
    desktopRuntimeTarget: 'allowed-smoke-window',
    desktopRuntimeTargetCandidates: ['allowed-smoke-window'],
    desktopFocusRequired: true,
    desktopFocusTarget: 'allowed-smoke-window',
    desktopFocusProcessName: null,
    desktopFocusTitleContains: 'allowed-smoke-window',
  }
  const desktopRuntimeApprovalInputHash = sha256Json(desktopRuntimeApprovalInput)
  const desktopRuntimeApproval = await createApprovalRequest({
    runId: run.id,
    agentProfileId: agent.id,
    type: 'runtime_control_action',
    title: 'Approve smoke desktop target control',
    description: 'Smoke approval validates that desktop live control binds the resolved target into the runtime hash.',
    riskLevel: 'high',
    payload: {
      computerSessionId: session.id,
      scope: 'desktop',
      actionType: 'type_text',
      target: 'allowed-smoke-window',
      inputHash: desktopRuntimeApprovalInputHash,
    },
  })
  await respondApprovalRequest(desktopRuntimeApproval.id, true, { reason: 'smoke desktop target binding check' })
  const approvedDesktopTargetPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'type_text',
        target: 'allowed-smoke-window',
        input: { text: 'approved-desktop-target' },
        live: true,
        confirmRisk: true,
        approvalRequestId: desktopRuntimeApproval.id,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  delete process.env.AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL
  delete process.env.AGENTHUB_ALLOWED_DESKTOP_TARGETS
  const mobileSwipeDryRunPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'mobile',
        actionType: 'mobile_swipe',
        input: { deviceId: 'smoke-device', x1: 100, y1: 900, x2: 100, y2: 300, durationMs: 250 },
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const desktopScreenshotDryRunPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'capture_screenshot',
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const mobileScreenshotDryRunPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'mobile',
        actionType: 'mobile_screenshot',
        input: { deviceId: 'smoke-device' },
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const workstationValidationPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'validate_workstation',
        target: reservationPayload.workstation.id,
        input: { workstationId: reservationPayload.workstation.id },
        live: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const workstationLaunchDryRunPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'launch_remote_session',
        target: reservationPayload.workstation.id,
        input: { workstationId: reservationPayload.workstation.id },
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const incompleteWorkstationValidationPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'validate_workstation',
        target: noLaunchReservationPayload.workstation.id,
        input: { workstationId: noLaunchReservationPayload.workstation.id },
        live: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const vncWorkstationValidationPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'validate_workstation',
        target: vncReservationPayload.workstation.id,
        input: { workstationId: vncReservationPayload.workstation.id },
        live: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const vmWorkstationValidationPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'validate_workstation',
        target: vmReservationPayload.workstation.id,
        input: { workstationId: vmReservationPayload.workstation.id },
        live: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const virtualboxWorkstationValidationPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'validate_workstation',
        target: virtualboxReservationPayload.workstation.id,
        input: { workstationId: virtualboxReservationPayload.workstation.id },
        live: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  await db
    .update(schema.agentWorkstations)
    .set({ status: 'busy', updatedAt: Date.now() })
    .where(eq(schema.agentWorkstations.id, reservationPayload.workstation.id))
  const workstationReleasePayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'release_workstation',
        target: reservationPayload.workstation.id,
        input: { workstationId: reservationPayload.workstation.id },
        live: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const releasedWorkstation = await db.query.agentWorkstations.findFirst({
    where: eq(schema.agentWorkstations.id, reservationPayload.workstation.id),
  })
  await db
    .update(schema.agentWorkstations)
    .set({ status: 'busy', updatedAt: Date.now() - 24 * 60 * 60 * 1000 })
    .where(eq(schema.agentWorkstations.id, reservationPayload.workstation.id))
  const staleRecoveryDryRunPayload = await readJson(
    await getWorkstationRecovery(
      getRequest('/api/production-integrations/workstations/recovery?maxBusyAgeMs=60000'),
    ),
  )
  const staleRecoveryItem = staleRecoveryDryRunPayload.recovery.items.find(
    (item: { workstationId: string }) => item.workstationId === reservationPayload.workstation.id,
  )
  const staleRecoveryApplyPayload = await readJson(
    await recoverStaleWorkstations(
      postRequest('/api/production-integrations/workstations/recovery', {
        maxBusyAgeMs: 60 * 1000,
        apply: true,
        confirmRecovery: true,
      }),
    ),
  )
  const staleRecoveredWorkstation = await db.query.agentWorkstations.findFirst({
    where: eq(schema.agentWorkstations.id, reservationPayload.workstation.id),
  })
  const blockedMobileScreenshotPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'mobile',
        actionType: 'mobile_screenshot',
        input: { deviceId: 'smoke-device' },
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const blockedScreenshotPathPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'desktop',
        actionType: 'capture_screenshot',
        input: { screenshotPath: 'C:\\agenthub-outside-screen.png' },
        live: false,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const softwareRunPayload = await readJson(
    await runSoftwareCommandRoute(
      postRequest(`/api/software-commands/${softwareCommand.id}/run`, {
        agentProfileId: agent.id,
        computerSessionId: session.id,
        input: { text: 'blocked-software-command-input' },
        mode: 'execute',
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: softwareCommand.id }) },
    ),
  )
  const softwareApprovalInput = { text: 'approved-software-input' }
  const pendingSoftwareApprovalPayload = await readJson(
    await runSoftwareCommandRoute(
      postRequest(`/api/software-commands/${approvalBoundSoftwareCommand.id}/run`, {
        agentProfileId: agent.id,
        computerSessionId: session.id,
        input: softwareApprovalInput,
        mode: 'execute',
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: approvalBoundSoftwareCommand.id }) },
    ),
  )
  const softwareApprovalId = pendingSoftwareApprovalPayload.softwareCommandRun.approvalRequestId as string | null
  assert(softwareApprovalId, 'Expected approval-bound software command to create an approval request.')
  await respondApprovalRequest(softwareApprovalId, true, { reason: 'smoke software command approval binding check' })
  const softwareApproval = await db.query.approvalRequests.findFirst({
    where: eq(schema.approvalRequests.id, softwareApprovalId),
  })
  const boundSoftwareApprovalPayload = await readJson(
    await runSoftwareCommandRoute(
      postRequest(`/api/software-commands/${approvalBoundSoftwareCommand.id}/run`, {
        agentProfileId: agent.id,
        computerSessionId: session.id,
        input: softwareApprovalInput,
        mode: 'execute',
        live: true,
        confirmRisk: true,
        approvalRequestId: softwareApprovalId,
      }),
      { params: Promise.resolve({ id: approvalBoundSoftwareCommand.id }) },
    ),
  )
  const replayedSoftwareApprovalPayload = await readJson(
    await runSoftwareCommandRoute(
      postRequest(`/api/software-commands/${approvalBoundSoftwareCommand.id}/run`, {
        agentProfileId: agent.id,
        computerSessionId: session.id,
        input: softwareApprovalInput,
        mode: 'execute',
        live: true,
        confirmRisk: true,
        approvalRequestId: softwareApprovalId,
      }),
      { params: Promise.resolve({ id: approvalBoundSoftwareCommand.id }) },
    ),
  )
  const mismatchedSoftwareApprovalPayload = await readJson(
    await runSoftwareCommandRoute(
      postRequest(`/api/software-commands/${approvalBoundSoftwareCommand.id}/run`, {
        agentProfileId: agent.id,
        computerSessionId: session.id,
        input: { text: 'mutated-software-input' },
        mode: 'execute',
        live: true,
        confirmRisk: true,
        approvalRequestId: softwareApprovalId,
      }),
      { params: Promise.resolve({ id: approvalBoundSoftwareCommand.id }) },
    ),
  )
  const mobileSoftwareRunPayload = await readJson(
    await runSoftwareCommandRoute(
      postRequest(`/api/software-commands/${mobileScreenshotSoftwareCommand.id}/run`, {
        agentProfileId: agent.id,
        computerSessionId: session.id,
        input: {},
        mode: 'execute',
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: mobileScreenshotSoftwareCommand.id }) },
    ),
  )
  const mobileSwipeSoftwareRunPayload = await readJson(
    await runSoftwareCommandRoute(
      postRequest(`/api/software-commands/${mobileSwipeSoftwareCommand.id}/run`, {
        agentProfileId: agent.id,
        computerSessionId: session.id,
        input: {},
        mode: 'execute',
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: mobileSwipeSoftwareCommand.id }) },
    ),
  )
  process.env.AGENTHUB_ENABLE_REAL_MOBILE_CONTROL = '1'
  process.env.AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS = 'allowed-smoke-device; second-smoke-device'
  const blockedMobileDeviceAllowlistPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'mobile',
        actionType: 'mobile_tap',
        input: { deviceId: 'blocked-smoke-device', x: 20, y: 40 },
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  process.env.AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES = 'com.example.allowed; com.example.second'
  const blockedMobileAppAllowlistPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'mobile',
        actionType: 'mobile_tap',
        input: { deviceId: 'allowed-smoke-device', appPackage: 'com.blocked.app', x: 20, y: 40 },
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const allowedMobileDeviceAllowlistPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'mobile',
        actionType: 'mobile_tap',
        input: { deviceId: 'allowed-smoke-device', appPackage: 'com.example.allowed', x: 20, y: 40 },
        live: true,
        confirmRisk: true,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const mobileRuntimeApprovalInput = {
    deviceId: 'allowed-smoke-device',
    appPackage: 'com.example.allowed',
    x: 30,
    y: 50,
    mobileRuntimeDeviceId: 'allowed-smoke-device',
    mobileRuntimeAppPackage: 'com.example.allowed',
  }
  const mobileRuntimeApprovalInputHash = sha256Json(mobileRuntimeApprovalInput)
  const mobileRuntimeApproval = await createApprovalRequest({
    runId: run.id,
    agentProfileId: agent.id,
    type: 'runtime_control_action',
    title: 'Approve smoke mobile device control',
    description: 'Smoke approval validates that mobile live control binds the resolved device id into the runtime hash.',
    riskLevel: 'high',
    payload: {
      computerSessionId: session.id,
      scope: 'mobile',
      actionType: 'mobile_tap',
      target: 'allowed-smoke-device',
      inputHash: mobileRuntimeApprovalInputHash,
    },
  })
  await respondApprovalRequest(mobileRuntimeApproval.id, true, { reason: 'smoke mobile device binding check' })
  const approvedMobileDevicePayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'mobile',
        actionType: 'mobile_tap',
        target: 'allowed-smoke-device',
        input: { deviceId: 'allowed-smoke-device', appPackage: 'com.example.allowed', x: 30, y: 50 },
        live: true,
        confirmRisk: true,
        approvalRequestId: mobileRuntimeApproval.id,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  delete process.env.AGENTHUB_ENABLE_REAL_MOBILE_CONTROL
  delete process.env.AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS
  delete process.env.AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES
  const runtimeApprovalInput = {
    workstationId: noLaunchReservationPayload.workstation.id,
    workstationLaunchKind: 'unsupported',
    workstationLaunchTarget: 'smoke-no-rdp-config',
  }
  const runtimeApprovalRequestInput = { workstationId: noLaunchReservationPayload.workstation.id }
  const runtimeApprovalInputHash = sha256Json(runtimeApprovalInput)
  const runtimeApproval = await createApprovalRequest({
    runId: run.id,
    agentProfileId: agent.id,
    type: 'runtime_control_action',
    title: 'Approve smoke remote workstation launch',
    description: 'Smoke approval validates runtime-control approval binding without launching a real RDP session.',
    riskLevel: 'high',
    payload: {
      computerSessionId: session.id,
        scope: 'workstation',
        actionType: 'launch_remote_session',
        target: noLaunchReservationPayload.workstation.id,
        inputHash: runtimeApprovalInputHash,
    },
  })
  await respondApprovalRequest(runtimeApproval.id, true, { reason: 'smoke approval binding check' })
  const legacyRuntimeApproval = await createApprovalRequest({
    runId: run.id,
    agentProfileId: agent.id,
    type: 'runtime_control_action',
    title: 'Approve legacy smoke remote workstation launch',
    description: 'Smoke approval intentionally omits inputHash to verify strict runtime-control binding.',
    riskLevel: 'high',
    payload: {
      computerSessionId: session.id,
      scope: 'workstation',
      actionType: 'launch_remote_session',
      target: noLaunchReservationPayload.workstation.id,
    },
  })
  await respondApprovalRequest(legacyRuntimeApproval.id, true, { reason: 'legacy approval should be rejected' })
  process.env.AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH = '1'
  process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS = reservationPayload.workstation.id
  const blockedWorkstationTargetAllowlistPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'launch_remote_session',
        target: noLaunchReservationPayload.workstation.id,
        input: runtimeApprovalRequestInput,
        live: true,
        confirmRisk: true,
        approvalRequestId: runtimeApproval.id,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS = noLaunchReservationPayload.workstation.id
  const legacyRuntimeControlPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'launch_remote_session',
        target: noLaunchReservationPayload.workstation.id,
        input: runtimeApprovalRequestInput,
        live: true,
        confirmRisk: true,
        approvalRequestId: legacyRuntimeApproval.id,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const approvedRuntimeControlPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'launch_remote_session',
        target: noLaunchReservationPayload.workstation.id,
        input: runtimeApprovalRequestInput,
        live: true,
        confirmRisk: true,
        approvalRequestId: runtimeApproval.id,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const replayedRuntimeControlPayload = await readJson(
    await runtimeControl(
      postRequest(`/api/computer-sessions/${session.id}/runtime-control`, {
        scope: 'workstation',
        actionType: 'launch_remote_session',
        target: noLaunchReservationPayload.workstation.id,
        input: runtimeApprovalRequestInput,
        live: true,
        confirmRisk: true,
        approvalRequestId: runtimeApproval.id,
      }),
      { params: Promise.resolve({ id: session.id }) },
    ),
  )
  const targetMismatchRunId = `target-mismatch-${Date.now().toString(36)}`
  const approvedGoLiveHashForTargetMismatch = sha256Text(`smoke-approved-go-live:${targetMismatchRunId}`)
  const targetMismatchAuthorizationEvidencePayload = await readJson(
    await recordOnsiteEvidence(
      postRequest('/api/production-integrations/final-acceptance/evidence', {
        category: 'customer_authorization',
        title: 'Smoke target mismatch customer authorization evidence',
        evidence: [
          'Smoke target mismatch customer authorization recorded without secrets.',
          'Smoke operator confirmed this evidence only authorizes synthetic target-mismatch validation.',
        ],
        operator: 'smoke-runner',
        externalRef: 'SMOKE-TARGET-MISMATCH-AUTH',
        riskLevel: 'high',
      }),
    ),
  )
  const targetMismatchWrongAuthorizationEvidencePayload = await readJson(
    await recordOnsiteEvidence(
      postRequest('/api/production-integrations/final-acceptance/evidence', {
        category: 'customer_authorization',
        title: 'Smoke wrong customer authorization evidence',
        evidence: [
          'Smoke wrong customer authorization recorded without secrets.',
          'Smoke operator confirmed this evidence is intentionally not bound to the approved go-live decision.',
        ],
        operator: 'smoke-runner',
        externalRef: 'SMOKE-WRONG-AUTH',
        riskLevel: 'high',
      }),
    ),
  )
  process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED = '1'
  process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS = targetMismatchReservationPayload.workstation.id
  process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH =
    targetMismatchAuthorizationEvidencePayload.evidence.contentHash
  const approvedGoLiveEnvironmentFingerprintForTargetMismatch = goLiveEnvironmentFingerprint()
  const approvedGoLiveEnvironmentFingerprintHashForTargetMismatch = sha256Json(
    approvedGoLiveEnvironmentFingerprintForTargetMismatch,
  )
  delete process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH
  await recordAuditLog({
    actorType: 'system',
    action: 'production.go_live.decision',
    resourceType: 'production_integration',
    resourceId: `smoke-approved-${targetMismatchRunId}`,
    riskLevel: 'high',
    message: 'Smoke approved go-live decision used only to reach workstation launch target validation.',
    metadata: {
      contentHash: approvedGoLiveHashForTargetMismatch,
      decision: 'approved',
      canActivateLive: true,
      customerAuthorizationEvidenceHash: targetMismatchAuthorizationEvidencePayload.evidence.contentHash,
      customerAuthorizationEvidenceMatched: true,
      environmentFingerprint: approvedGoLiveEnvironmentFingerprintForTargetMismatch,
    },
  })
  const approvedLivePilotLeaseBaseForTargetMismatch = {
    id: `smoke-live-pilot-${targetMismatchRunId}`,
    generatedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
    durationMinutes: 60,
    goLiveDecisionHash: approvedGoLiveHashForTargetMismatch,
    customerAuthorizationEvidenceHash: targetMismatchAuthorizationEvidencePayload.evidence.contentHash,
    environmentFingerprintHash: approvedGoLiveEnvironmentFingerprintHashForTargetMismatch,
    environmentFingerprintItems: approvedGoLiveEnvironmentFingerprintForTargetMismatch.length,
    canActivateLivePilot: true,
  }
  const approvedLivePilotLeaseHashForTargetMismatch = sha256Json(
    approvedLivePilotLeaseBaseForTargetMismatch,
  )
  await recordAuditLog({
    actorType: 'system',
    action: 'production.live_pilot.lease',
    resourceType: 'production_integration',
    resourceId: approvedLivePilotLeaseBaseForTargetMismatch.id,
    riskLevel: 'high',
    status: 'allowed',
    message: 'Smoke live pilot lease used only to reach workstation launch target validation.',
    metadata: {
      ...approvedLivePilotLeaseBaseForTargetMismatch,
      contentHash: approvedLivePilotLeaseHashForTargetMismatch,
      status: 'blocked',
      currentlyEnabled: false,
      activationEnvVar: 'AGENTHUB_LIVE_PILOT_LEASE_HASH',
      redacted: true,
    },
  })
  process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED = '1'
  process.env.AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH = approvedGoLiveHashForTargetMismatch
  process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS = targetMismatchReservationPayload.workstation.id
  const workstationMissingAuthorizationEvidenceHashPayload = await executeRuntimeControlAction({
    computerSessionId: session.id,
    scope: 'workstation',
    actionType: 'launch_remote_session',
    target: targetMismatchReservationPayload.workstation.id,
    input: { workstationId: targetMismatchReservationPayload.workstation.id },
    live: true,
    confirmRisk: true,
    approvalRequestId: runtimeApproval.id,
    trustedApprovalAlreadyValidated: true,
  })
  process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH =
    targetMismatchWrongAuthorizationEvidencePayload.evidence.contentHash
  const workstationMismatchedAuthorizationEvidenceHashPayload = await executeRuntimeControlAction({
    computerSessionId: session.id,
    scope: 'workstation',
    actionType: 'launch_remote_session',
    target: targetMismatchReservationPayload.workstation.id,
    input: { workstationId: targetMismatchReservationPayload.workstation.id },
    live: true,
    confirmRisk: true,
    approvalRequestId: runtimeApproval.id,
    trustedApprovalAlreadyValidated: true,
  })
  process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH =
    targetMismatchAuthorizationEvidencePayload.evidence.contentHash
  process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS =
    `${targetMismatchReservationPayload.workstation.id}; smoke-fingerprint-mismatch-workstation`
  const workstationEnvironmentFingerprintMismatchPayload = await executeRuntimeControlAction({
    computerSessionId: session.id,
    scope: 'workstation',
    actionType: 'launch_remote_session',
    target: targetMismatchReservationPayload.workstation.id,
    input: { workstationId: targetMismatchReservationPayload.workstation.id },
    live: true,
    confirmRisk: true,
    approvalRequestId: runtimeApproval.id,
    trustedApprovalAlreadyValidated: true,
  })
  process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS = targetMismatchReservationPayload.workstation.id
  const workstationMissingLivePilotLeasePayload = await executeRuntimeControlAction({
    computerSessionId: session.id,
    scope: 'workstation',
    actionType: 'launch_remote_session',
    target: targetMismatchReservationPayload.workstation.id,
    input: { workstationId: targetMismatchReservationPayload.workstation.id },
    live: true,
    confirmRisk: true,
    approvalRequestId: runtimeApproval.id,
    trustedApprovalAlreadyValidated: true,
  })
  process.env.AGENTHUB_LIVE_PILOT_LEASE_HASH = approvedLivePilotLeaseHashForTargetMismatch
  const workstationMissingLivePilotSessionPayload = await executeRuntimeControlAction({
    computerSessionId: session.id,
    scope: 'workstation',
    actionType: 'launch_remote_session',
    target: targetMismatchReservationPayload.workstation.id,
    input: { workstationId: targetMismatchReservationPayload.workstation.id },
    live: true,
    confirmRisk: true,
    approvalRequestId: runtimeApproval.id,
    trustedApprovalAlreadyValidated: true,
  })
  const targetMismatchLivePilotSessionPayload = await readJson(
    await startLivePilotSession(
      postRequest('/api/production-integrations/go-live/live-pilot/session', {
        durationMinutes: 30,
      }),
    ),
  )
  const workstationResolvedTargetMismatchPayload = await executeRuntimeControlAction({
    computerSessionId: session.id,
    scope: 'workstation',
    actionType: 'launch_remote_session',
    target: targetMismatchReservationPayload.workstation.id,
    input: { workstationId: targetMismatchReservationPayload.workstation.id },
    live: true,
    confirmRisk: true,
    approvalRequestId: runtimeApproval.id,
    trustedApprovalAlreadyValidated: true,
  })
  const stoppedLivePilotSessionPayload = await readJson(
    await stopLivePilotSession(
      postRequest('/api/production-integrations/go-live/live-pilot/session', {
        reason: 'smoke target mismatch validation complete',
      }),
    ),
  )
  const workstationStoppedLivePilotSessionPayload = await executeRuntimeControlAction({
    computerSessionId: session.id,
    scope: 'workstation',
    actionType: 'launch_remote_session',
    target: targetMismatchReservationPayload.workstation.id,
    input: { workstationId: targetMismatchReservationPayload.workstation.id },
    live: true,
    confirmRisk: true,
    approvalRequestId: runtimeApproval.id,
    trustedApprovalAlreadyValidated: true,
  })
  delete process.env.AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH
  delete process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS
  delete process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED
  delete process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH
  delete process.env.AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH
  delete process.env.AGENTHUB_LIVE_PILOT_LEASE_HASH
  const hardeningPayload = await readJson(await getHardeningReport())
  const vaultMasterKeyHardeningCheck = hardeningPayload.report.checks.find(
    (check: { key: string }) => check.key === 'vault_master_key',
  )
  const runtimeReadinessPayload = await readJson(await getRuntimeControlReadiness())
  process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH = '1'
  const killSwitchExecutionPreflightPayload = await readJson(await getExecutionPreflight())
  delete process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH
  const executionPreflightPayload = await readJson(await getExecutionPreflight())
  const goLiveDrillPayload = await readJson(await getGoLiveDrill())
  const livePilotLeasePayload = await readJson(
    await createLivePilotLease(
      postRequest('/api/production-integrations/go-live/live-pilot', {
        durationMinutes: 30,
      }),
    ),
  )
  const livePilotSessionReportPayload = await readJson(await getLivePilotSessionReport())
  const realControlPayload = await readJson(await getRealControlReport())
  const liveConnectorPayload = await readJson(await getLiveConnectorReport())
  const onsiteActivationPayload = await readJson(await getOnsiteActivationGuide())
  const onsiteActivationPackagePayload = await readJson(await exportOnsiteActivationPackage())
  const setupGuidePayload = await readJson(await getSetupGuide())
  const customerEnvironmentPayload = await readJson(await getCustomerEnvironmentReport())
  const customerEnvironmentPackagePayload = await readJson(await exportCustomerEnvironmentPackage())
  const packageIntegrityPayload = await readJson(await getPackageIntegrityReport())
  const hardeningAfterPackagePayload = await readJson(await getHardeningReport())
  const rejectedSensitiveEvidenceResponse = await recordOnsiteEvidence(
    postRequest('/api/production-integrations/final-acceptance/evidence', {
      category: 'customer_authorization',
      title: 'Smoke rejected sensitive evidence',
      evidence: ['password=fake'],
      operator: 'smoke-runner',
      riskLevel: 'high',
    }),
  )
  const rejectedSensitiveEvidencePayload = await rejectedSensitiveEvidenceResponse.json()
  const onsiteEvidencePayload = await readJson(
    await recordOnsiteEvidence(
      postRequest('/api/production-integrations/final-acceptance/evidence', {
        category: 'customer_authorization',
        title: 'Smoke customer authorization evidence',
        evidence: [
          'Smoke customer test account and device authorization recorded without secrets.',
          'Smoke operator confirmed no payment, password, cookie, or private customer data is included.',
        ],
        operator: 'smoke-runner',
        externalRef: 'SMOKE-ONSITE-AUTH',
        notes: 'Synthetic smoke evidence for final acceptance ledger ingestion.',
        riskLevel: 'high',
      }),
    ),
  )
  const onsiteEvidenceReportPayload = await readJson(await getOnsiteEvidenceReport())
  const finalAcceptancePayload = await readJson(await getFinalAcceptanceLedger())
  const onsiteIntakePayload = await readJson(await getOnsiteIntakeChecklist())
  const goLiveDecisionPayload = await readJson(await createGoLiveDecision())
  process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED = '1'
  process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH = onsiteEvidencePayload.evidence.contentHash
  const boundCustomerAuthorizationRealControlPayload = await readJson(await getRealControlReport())
  const boundCustomerAuthorizationLiveConnectorPayload = await readJson(await getLiveConnectorReport())
  const boundCustomerAuthorizationPreflightPayload = await readJson(await getExecutionPreflight())
  const boundCustomerAuthorizationDrillPayload = await readJson(await getGoLiveDrill())
  const boundCustomerAuthorizationEnvironmentPayload = await readJson(await getCustomerEnvironmentReport())
  const boundCustomerAuthorizationFinalAcceptancePayload = await readJson(await getFinalAcceptanceLedger())
  delete process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED
  delete process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH

  assert(readinessPayload.readiness.readinessScore >= 0, 'Expected readiness score.')
  assert(
    ['available', 'not_installed', 'not_configured', 'ready'].includes(desktopPayload.desktop.status),
    `Unexpected desktop status: ${desktopPayload.desktop.status}`,
  )
  assert(typeof desktopPayload.desktop.canObserveWindows === 'boolean', 'Expected desktop probe booleans.')
  assert(
    ['available', 'not_installed'].includes(mobilePayload.mobile.status),
    `Unexpected mobile status: ${mobilePayload.mobile.status}`,
  )
  assert(
    workstationProvidersPayload.workstations.providers.some(
      (provider: { key: string }) => provider.key === 'rdp',
    ),
    'Expected RDP provider entry.',
  )
  assert(reservationPayload.workstation.agentProfileId === agent.id, 'Expected workstation reservation for smoke agent.')
  assert(reservationPayload.workstation.mode === 'remote_session', 'Expected remote_session reservation.')
  assert(hardeningPayload.report.counts.agentWorkstations >= 1, 'Expected hardening report to count workstations.')
  assert(
    vaultMasterKeyHardeningCheck?.status === 'ready',
    `Expected production vault master key gate to be ready: ${JSON.stringify(vaultMasterKeyHardeningCheck)}`,
  )
  assert(
    objectContainsString(vaultMasterKeyHardeningCheck.evidence, 'vault key id=') &&
      objectContainsString(vaultMasterKeyHardeningCheck.evidence, 'vault key rotatedAt=') &&
      objectContainsString(vaultMasterKeyHardeningCheck.evidence, 'vault key rotation window=90 days'),
    `Expected vault master key evidence to include id and rotation metadata: ${JSON.stringify(vaultMasterKeyHardeningCheck.evidence)}`,
  )
  assert(
    !objectContainsString(vaultMasterKeyHardeningCheck, process.env.AGENTHUB_VAULT_MASTER_KEY ?? ''),
    'Expected hardening report to redact the production vault master key value.',
  )
  assert(
    snapshot.computerActionEvents.some(
      (action: { actionType: string }) => action.actionType.includes('runtime_control.desktop.observe_windows'),
    ),
    'Expected employee runtime to prime desktop runtime control adapter.',
  )
  assert(
    snapshot.computerActionEvents.some(
      (action: { actionType: string }) => action.actionType.includes('runtime_control.workstation.validate_workstation'),
    ),
    'Expected employee runtime to validate reserved workstation.',
  )
  assert(
    blockedRuntimeControlPayload.result.status === 'blocked',
    `Expected high-risk desktop control to be blocked without env gate, got ${blockedRuntimeControlPayload.result.status}.`,
  )
  assert(
    blockedRuntimeControlPayload.result.gate.approvalRequired === true,
    'Expected high-risk desktop control to require runtime approval binding.',
  )
  assert(
    blockedRuntimeControlPayload.result.releasedResourceLock?.status === 'released',
    'Expected runtime control resource lock to be released.',
  )
  assert(
    killSwitchRuntimeControlPayload.result.status === 'blocked' &&
      killSwitchRuntimeControlPayload.result.gate.runtimeControlKillSwitchActive === true &&
      killSwitchRuntimeControlPayload.result.gate.runtimeControlKillSwitchEnvVar === 'AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH' &&
      String(killSwitchRuntimeControlPayload.result.output?.error ?? '').includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH'),
    `Expected global runtime-control kill switch to block high-risk live control: ${JSON.stringify(killSwitchRuntimeControlPayload.result.gate)}`,
  )
  assert(
    killSwitchRuntimeControlPayload.result.releasedResourceLock?.status === 'released',
    'Expected kill-switch-blocked runtime control resource lock to be released.',
  )
  assert(
    desktopScrollDryRunPayload.result.status === 'planned' &&
      desktopScrollDryRunPayload.result.output?.actionType === 'scroll' &&
      desktopScrollDryRunPayload.result.output?.dryRun === true,
    `Expected desktop scroll to support safe runtime-control dry-run planning: ${JSON.stringify(desktopScrollDryRunPayload.result)}`,
  )
  assert(
    desktopClickDryRunPayload.result.status === 'planned' &&
      desktopClickDryRunPayload.result.output?.desktopFocusRequired === true &&
      desktopClickDryRunPayload.result.output?.desktopFocusTarget === 'allowed-smoke-window' &&
      desktopClickDryRunPayload.result.output?.desktopFocusTitleContains === 'allowed-smoke-window',
    `Expected desktop click dry-run to expose target focus binding before pointer action: ${JSON.stringify(desktopClickDryRunPayload.result.output)}`,
  )
  assert(
    desktopTextDryRunPayload.result.status === 'planned' &&
      desktopTextDryRunPayload.result.output?.desktopFocusRequired === true &&
      desktopTextDryRunPayload.result.output?.desktopFocusTarget === 'allowed-smoke-window' &&
      desktopTextDryRunPayload.result.output?.desktopFocusTitleContains === 'allowed-smoke-window',
    `Expected desktop text dry-run to expose target focus binding before input: ${JSON.stringify(desktopTextDryRunPayload.result.output)}`,
  )
  assert(
    blockedDesktopTargetAllowlistPayload.result.status === 'blocked' &&
      blockedDesktopTargetAllowlistPayload.result.gate.desktopTargetAllowlistRequired === true &&
      blockedDesktopTargetAllowlistPayload.result.gate.desktopTargetAllowed === false &&
      blockedDesktopTargetAllowlistPayload.result.gate.desktopTargetAllowlistEnvVar === 'AGENTHUB_ALLOWED_DESKTOP_TARGETS' &&
      String(blockedDesktopTargetAllowlistPayload.result.output?.error ?? '').includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS'),
    `Expected desktop control to reject targets outside the live allowlist: ${JSON.stringify(blockedDesktopTargetAllowlistPayload.result.gate)}`,
  )
  assert(
    blockedDesktopTargetAllowlistPayload.result.releasedResourceLock?.status === 'released',
    'Expected desktop allowlist-blocked resource lock to be released.',
  )
  assert(
    allowedDesktopTargetAllowlistPayload.result.status === 'blocked' &&
      allowedDesktopTargetAllowlistPayload.result.gate.desktopTargetAllowlistRequired === true &&
      allowedDesktopTargetAllowlistPayload.result.gate.desktopTargetAllowed === true &&
      allowedDesktopTargetAllowlistPayload.result.gate.desktopTarget === 'allowed-smoke-window' &&
      String(allowedDesktopTargetAllowlistPayload.result.output?.error ?? '').includes('approvalRequestId'),
    `Expected allowlisted desktop target to pass the target gate and stop at approval binding: ${JSON.stringify(allowedDesktopTargetAllowlistPayload.result.gate)}`,
  )
  assert(
    allowedDesktopTargetAllowlistPayload.result.releasedResourceLock?.status === 'released',
    'Expected allowlisted desktop approval-blocked resource lock to be released.',
  )
  assert(
    approvedDesktopTargetPayload.result.status === 'blocked' &&
      approvedDesktopTargetPayload.result.gate.approvalSatisfied === true &&
      approvedDesktopTargetPayload.result.gate.goLiveRequired === true &&
      approvedDesktopTargetPayload.result.output?.inputHash === desktopRuntimeApprovalInputHash &&
      approvedDesktopTargetPayload.result.output?.approvalInput?.desktopRuntimeTarget === 'allowed-smoke-window' &&
      approvedDesktopTargetPayload.result.output?.approvalInput?.desktopFocusRequired === true &&
      approvedDesktopTargetPayload.result.output?.approvalInput?.desktopFocusTarget === 'allowed-smoke-window' &&
      approvedDesktopTargetPayload.result.output?.approvalInput?.desktopFocusTitleContains === 'allowed-smoke-window' &&
      Array.isArray(approvedDesktopTargetPayload.result.output?.approvalInput?.desktopRuntimeTargetCandidates) &&
      approvedDesktopTargetPayload.result.output.approvalInput.desktopRuntimeTargetCandidates.includes(
        'allowed-smoke-window',
      ) &&
      desktopRuntimeApproval.payload.inputHash === desktopRuntimeApprovalInputHash,
    `Expected approved desktop runtime control to bind target candidates into approval hash: ${JSON.stringify({
      output: approvedDesktopTargetPayload.result.output,
      approvalPayload: desktopRuntimeApproval.payload,
    })}`,
  )
  assert(
    approvedDesktopTargetPayload.result.releasedResourceLock?.status === 'released',
    'Expected approved desktop runtime control resource lock to be released.',
  )
  assert(
    mobileSwipeDryRunPayload.result.status === 'planned' &&
      mobileSwipeDryRunPayload.result.output?.actionType === 'mobile_swipe' &&
      mobileSwipeDryRunPayload.result.output?.dryRun === true,
    `Expected mobile swipe to support safe runtime-control dry-run planning: ${JSON.stringify(mobileSwipeDryRunPayload.result)}`,
  )
  assert(
    desktopScreenshotDryRunPayload.result.status === 'planned' &&
      desktopScreenshotDryRunPayload.result.output?.plannedScreenshotPathRedacted === true &&
      desktopScreenshotDryRunPayload.result.output?.plannedScreenshotDirectory === 'session_temp' &&
      !objectContainsString(desktopScreenshotDryRunPayload.result.output, session.tempPath),
    `Expected desktop screenshot dry-run to expose a redacted session-temp path: ${JSON.stringify(
      desktopScreenshotDryRunPayload.result,
    )}`,
  )
  assert(
    mobileScreenshotDryRunPayload.result.status === 'planned' &&
      mobileScreenshotDryRunPayload.result.output?.plannedScreenshotPathRedacted === true &&
      mobileScreenshotDryRunPayload.result.output?.plannedScreenshotDirectory === 'session_temp' &&
      !objectContainsString(mobileScreenshotDryRunPayload.result.output, session.tempPath),
    `Expected mobile screenshot dry-run to expose a redacted session-temp path: ${JSON.stringify(
      mobileScreenshotDryRunPayload.result,
    )}`,
  )
  assert(
    workstationValidationPayload.result.status === 'complete' &&
      workstationValidationPayload.result.output.ready === true,
    `Expected complete RDP workstation validation to pass: ${JSON.stringify(workstationValidationPayload.result.output)}`,
  )
  assert(
    workstationLaunchDryRunPayload.result.status === 'planned' &&
      workstationLaunchDryRunPayload.result.output?.launchPlan?.kind === 'rdp_file' &&
      workstationLaunchDryRunPayload.result.output?.launchPlan?.rdpFilePathRedacted === true &&
      workstationLaunchDryRunPayload.result.output?.launchPlan?.rdpFileDirectory === 'workstation_temp' &&
      workstationLaunchDryRunPayload.result.output?.rdpFilePathRedacted === true,
    `Expected RDP workstation launch dry-run to expose a redacted launch plan: ${JSON.stringify(
      workstationLaunchDryRunPayload.result,
    )}`,
  )
  assert(
    !objectContainsString(
      workstationLaunchDryRunPayload.result.output,
      reservationPayload.workstation.tempPath,
    ),
    `Expected RDP workstation launch dry-run output to avoid leaking tempPath: ${JSON.stringify(
      workstationLaunchDryRunPayload.result.output,
    )}`,
  )
  assert(
    incompleteWorkstationValidationPayload.result.status === 'blocked' &&
      incompleteWorkstationValidationPayload.result.output.ready === false,
    `Expected incomplete remote workstation validation to block: ${JSON.stringify(incompleteWorkstationValidationPayload.result.output)}`,
  )
  assert(
    vncWorkstationValidationPayload.result.status === 'complete' &&
      vncWorkstationValidationPayload.result.output.launchPlan?.kind === 'vnc_url',
    `Expected VNC workstation validation to expose vnc_url launch plan: ${JSON.stringify(vncWorkstationValidationPayload.result.output)}`,
  )
  assert(
    vmWorkstationValidationPayload.result.status === 'complete' &&
    vmWorkstationValidationPayload.result.output.launchPlan?.kind === 'hyperv',
    `Expected VM workstation validation to expose hyperv launch plan: ${JSON.stringify(vmWorkstationValidationPayload.result.output)}`,
  )
  assert(
    virtualboxWorkstationValidationPayload.result.output.launchPlan?.kind === 'virtualbox',
    `Expected VirtualBox workstation validation to expose virtualbox launch plan: ${JSON.stringify(
      virtualboxWorkstationValidationPayload.result.output,
    )}`,
  )
  assert(
    virtualboxCommandAvailable
      ? virtualboxWorkstationValidationPayload.result.status === 'complete'
      : virtualboxWorkstationValidationPayload.result.status === 'blocked' &&
          virtualboxWorkstationValidationPayload.result.output.ready === false &&
          objectContainsString(
            virtualboxWorkstationValidationPayload.result.output.blockingReasons,
            'VBoxManage',
          ),
    `Expected VirtualBox workstation validation to reflect local VBoxManage availability=${virtualboxCommandAvailable}: ${JSON.stringify(
      virtualboxWorkstationValidationPayload.result.output,
    )}`,
  )
  assert(
    workstationReleasePayload.result.status === 'complete' &&
      workstationReleasePayload.result.gate.approvalRequired === false &&
      workstationReleasePayload.result.output?.previousStatus === 'busy' &&
      workstationReleasePayload.result.output?.workstationStatus === 'idle' &&
      releasedWorkstation?.status === 'idle',
    `Expected workstation release action to mark busy workstation idle without a high-risk live gate: ${JSON.stringify({
      result: workstationReleasePayload.result,
      releasedWorkstation,
    })}`,
  )
  assert(
    workstationReleasePayload.result.releasedResourceLock?.status === 'released',
    'Expected workstation release resource lock to be released.',
  )
  assert(
    staleRecoveryItem?.stale === true &&
      staleRecoveryItem?.recoverable === true &&
      staleRecoveryDryRunPayload.recovery.applied === false,
    `Expected stale workstation recovery dry-run to identify a recoverable busy workstation: ${JSON.stringify(
      staleRecoveryDryRunPayload.recovery,
    )}`,
  )
  assert(
    staleRecoveryApplyPayload.recovery.applied === true &&
      staleRecoveryApplyPayload.recovery.recoveredIds.includes(reservationPayload.workstation.id) &&
      staleRecoveryApplyPayload.recovery.summary.recoveredWorkstations >= 1 &&
      staleRecoveredWorkstation?.status === 'idle',
    `Expected stale workstation recovery to return the workstation to idle: ${JSON.stringify({
      recovery: staleRecoveryApplyPayload.recovery,
      staleRecoveredWorkstation,
    })}`,
  )
  assert(
    rejectedWorkstationPathResponse.status === 400 &&
      rejectedWorkstationPathText.includes('AgentHub workstation directory'),
    `Expected workstation reservation to reject paths outside its root: ${rejectedWorkstationPathResponse.status} ${rejectedWorkstationPathText}`,
  )
  assert(
    rejectedRdpSecretResponse.status === 400 &&
      rejectedRdpSecretText.includes('rdpConfig must not contain passwords'),
    `Expected workstation reservation to reject RDP credential blobs: ${rejectedRdpSecretResponse.status} ${rejectedRdpSecretText}`,
  )
  assert(
    rejectedVncSecretResponse.status === 400 &&
      rejectedVncSecretText.includes('vncUrl must not embed usernames or passwords'),
    `Expected workstation reservation to reject VNC embedded credentials: ${rejectedVncSecretResponse.status} ${rejectedVncSecretText}`,
  )
  assert(
    blockedMobileScreenshotPayload.result.status === 'blocked',
    `Expected mobile screenshot to be blocked without env gate, got ${blockedMobileScreenshotPayload.result.status}.`,
  )
  assert(
    blockedMobileScreenshotPayload.result.gate.requiredEnvVar === 'AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE',
    `Expected mobile screenshot to require mobile capture env gate: ${JSON.stringify(blockedMobileScreenshotPayload.result.gate)}`,
  )
  assert(
    blockedMobileScreenshotPayload.result.releasedResourceLock?.status === 'released',
    'Expected mobile screenshot resource lock to be released.',
  )
  assert(
    blockedScreenshotPathPayload.result.status === 'blocked' &&
      blockedScreenshotPathPayload.result.output?.planningBlocked === true &&
      String(blockedScreenshotPathPayload.result.output?.error ?? '').includes('tempPath'),
    `Expected screenshot dry-run to block output path outside session tempPath: ${JSON.stringify(blockedScreenshotPathPayload.result.output)}`,
  )
  assert(
    blockedScreenshotPathPayload.result.releasedResourceLock?.status === 'released',
    'Expected screenshot path dry-run resource lock to be released.',
  )
  assert(
    blockedWorkstationTargetAllowlistPayload.result.status === 'blocked' &&
      blockedWorkstationTargetAllowlistPayload.result.gate.workstationTargetAllowlistRequired === true &&
      blockedWorkstationTargetAllowlistPayload.result.gate.workstationTargetAllowlistEnvVar ===
        'AGENTHUB_ALLOWED_WORKSTATION_TARGETS' &&
      blockedWorkstationTargetAllowlistPayload.result.gate.workstationTargetAllowed === false &&
      String(blockedWorkstationTargetAllowlistPayload.result.output?.error ?? '').includes(
        'AGENTHUB_ALLOWED_WORKSTATION_TARGETS',
      ),
    `Expected workstation launch to be blocked by target allowlist: ${JSON.stringify(blockedWorkstationTargetAllowlistPayload.result)}`,
  )
  assert(
    legacyRuntimeControlPayload.result.status === 'blocked' &&
      legacyRuntimeControlPayload.result.gate.approvalSatisfied === false &&
      String(legacyRuntimeControlPayload.result.output?.error ?? '').includes('must include runtime input hash'),
    `Expected legacy runtime approval without inputHash to be rejected before go-live: ${JSON.stringify(legacyRuntimeControlPayload.result)}`,
  )
  assert(
    approvedRuntimeControlPayload.result.gate.allowed === false &&
      approvedRuntimeControlPayload.result.gate.workstationTargetAllowed === true &&
      approvedRuntimeControlPayload.result.gate.goLiveRequired === true &&
      approvedRuntimeControlPayload.result.gate.goLiveDecisionSatisfied === false &&
      approvedRuntimeControlPayload.result.gate.goLiveCustomerAuthorized === false,
    `Expected approved runtime-control gate to be blocked by go-live hash enforcement: ${JSON.stringify(approvedRuntimeControlPayload.result.gate)}`,
  )
  assert(
    approvedRuntimeControlPayload.result.status === 'blocked' &&
      String(approvedRuntimeControlPayload.result.output?.error ?? '').includes('AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH'),
    `Expected approved runtime-control launch to stop at go-live hash gate: ${JSON.stringify(approvedRuntimeControlPayload.result.output)}`,
  )
  assert(
    approvedRuntimeControlPayload.result.output?.inputHash === runtimeApprovalInputHash &&
      approvedRuntimeControlPayload.result.output?.approvalInput?.workstationLaunchTarget === 'smoke-no-rdp-config' &&
      runtimeApproval.payload.inputHash === runtimeApprovalInputHash,
    `Expected runtime-control approval and audit output to bind input hash: ${JSON.stringify({
      output: approvedRuntimeControlPayload.result.output,
      approvalPayload: runtimeApproval.payload,
    })}`,
  )
  assert(
    replayedRuntimeControlPayload.result.status === 'blocked' &&
      replayedRuntimeControlPayload.result.gate.approvalSatisfied === false &&
      String(replayedRuntimeControlPayload.result.output?.error ?? '').includes('already consumed'),
    `Expected consumed runtime-control approval to reject replay: ${JSON.stringify(replayedRuntimeControlPayload.result)}`,
  )
  assert(
    approvedRuntimeControlPayload.result.releasedResourceLock?.status === 'released',
    'Expected approved runtime control resource lock to be released.',
  )
  assert(
    replayedRuntimeControlPayload.result.releasedResourceLock?.status === 'released',
    'Expected replay-blocked runtime control resource lock to be released.',
  )
  assert(
    workstationMissingAuthorizationEvidenceHashPayload.status === 'blocked' &&
      workstationMissingAuthorizationEvidenceHashPayload.gate.goLiveCustomerAuthorizationRequired === true &&
      workstationMissingAuthorizationEvidenceHashPayload.gate.goLiveCustomerAuthorized === false &&
      workstationMissingAuthorizationEvidenceHashPayload.gate.goLiveCustomerAuthorizationSwitchEnabled === true &&
      workstationMissingAuthorizationEvidenceHashPayload.gate.goLiveCustomerAuthorizationEvidenceHashRequired === true &&
      workstationMissingAuthorizationEvidenceHashPayload.gate.goLiveCustomerAuthorizationEvidenceMatched === false &&
      String(workstationMissingAuthorizationEvidenceHashPayload.output?.error ?? '').includes(
        'AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH',
      ) &&
      workstationMissingAuthorizationEvidenceHashPayload.releasedResourceLock?.status === 'released',
    `Expected live runtime-control to block authorized switch without customer evidence hash: ${JSON.stringify(workstationMissingAuthorizationEvidenceHashPayload)}`,
  )
  assert(
    workstationMismatchedAuthorizationEvidenceHashPayload.status === 'blocked' &&
      workstationMismatchedAuthorizationEvidenceHashPayload.gate.goLiveCustomerAuthorizationEvidenceMatched === true &&
      workstationMismatchedAuthorizationEvidenceHashPayload.gate
        .goLiveCustomerAuthorizationEvidenceBoundToDecision === false &&
      workstationMismatchedAuthorizationEvidenceHashPayload.gate
        .goLiveLatestDecisionCustomerAuthorizationEvidenceHash ===
        targetMismatchAuthorizationEvidencePayload.evidence.contentHash &&
      workstationMismatchedAuthorizationEvidenceHashPayload.gate.goLiveCustomerAuthorizationEvidenceHash ===
        targetMismatchWrongAuthorizationEvidencePayload.evidence.contentHash &&
      String(workstationMismatchedAuthorizationEvidenceHashPayload.output?.error ?? '').includes(
        'bound to the latest approved go-live decision',
      ) &&
      workstationMismatchedAuthorizationEvidenceHashPayload.releasedResourceLock?.status === 'released',
    `Expected live runtime-control to reject customer evidence hash not bound to approved go-live decision: ${JSON.stringify(workstationMismatchedAuthorizationEvidenceHashPayload)}`,
  )
  assert(
    workstationEnvironmentFingerprintMismatchPayload.status === 'blocked' &&
      workstationEnvironmentFingerprintMismatchPayload.gate
        .goLiveLatestDecisionEnvironmentFingerprintPresent === true &&
      workstationEnvironmentFingerprintMismatchPayload.gate
        .goLiveLatestDecisionEnvironmentFingerprintMatched === false &&
      Array.isArray(
        workstationEnvironmentFingerprintMismatchPayload.gate
          .goLiveLatestDecisionEnvironmentFingerprintMismatches,
      ) &&
      workstationEnvironmentFingerprintMismatchPayload.gate
        .goLiveLatestDecisionEnvironmentFingerprintMismatches.includes(
          'AGENTHUB_ALLOWED_WORKSTATION_TARGETS',
        ) &&
      String(workstationEnvironmentFingerprintMismatchPayload.output?.error ?? '').includes(
        'Current runtime environment fingerprint does not match',
      ) &&
      workstationEnvironmentFingerprintMismatchPayload.releasedResourceLock?.status === 'released',
    `Expected live runtime-control to reject drifted go-live environment fingerprint: ${JSON.stringify(workstationEnvironmentFingerprintMismatchPayload)}`,
  )
  assert(
    workstationMissingLivePilotLeasePayload.status === 'blocked' &&
      workstationMissingLivePilotLeasePayload.gate.goLiveLivePilotLeaseRequired === true &&
      workstationMissingLivePilotLeasePayload.gate.goLiveLivePilotLeaseMatched === false &&
      workstationMissingLivePilotLeasePayload.gate.goLiveLatestLivePilotLeaseHash ===
        approvedLivePilotLeaseHashForTargetMismatch &&
      String(workstationMissingLivePilotLeasePayload.output?.error ?? '').includes(
        'AGENTHUB_LIVE_PILOT_LEASE_HASH',
      ) &&
      workstationMissingLivePilotLeasePayload.releasedResourceLock?.status === 'released',
    `Expected live runtime-control to require a bound live pilot lease: ${JSON.stringify(workstationMissingLivePilotLeasePayload)}`,
  )
  assert(
    workstationMissingLivePilotSessionPayload.status === 'blocked' &&
      workstationMissingLivePilotSessionPayload.gate.goLiveLivePilotLeaseMatched === true &&
      workstationMissingLivePilotSessionPayload.gate.goLiveLivePilotSessionRequired === true &&
      workstationMissingLivePilotSessionPayload.gate.goLiveLatestLivePilotSessionActive === false &&
      String(workstationMissingLivePilotSessionPayload.output?.error ?? '').includes(
        'active audited live pilot session',
      ) &&
      workstationMissingLivePilotSessionPayload.releasedResourceLock?.status === 'released',
    `Expected live runtime-control to require an active live pilot session: ${JSON.stringify(workstationMissingLivePilotSessionPayload)}`,
  )
  assert(
    targetMismatchLivePilotSessionPayload.session.status === 'active' &&
      targetMismatchLivePilotSessionPayload.session.canRunLivePilot === true &&
      targetMismatchLivePilotSessionPayload.session.livePilotLeaseHash ===
        approvedLivePilotLeaseHashForTargetMismatch,
    `Expected live pilot session to start against the current lease: ${JSON.stringify(targetMismatchLivePilotSessionPayload.session)}`,
  )
  const workstationLaunchTargetGate = workstationResolvedTargetMismatchPayload.output?.launchTargetGate as
    | { candidates?: string[] }
    | undefined
  assert(
    workstationResolvedTargetMismatchPayload.status === 'blocked' &&
      workstationResolvedTargetMismatchPayload.gate.goLiveLivePilotLeaseRequired === true &&
      workstationResolvedTargetMismatchPayload.gate.goLiveLivePilotLeaseMatched === true &&
      workstationResolvedTargetMismatchPayload.gate.goLiveLivePilotLeaseExpired === false &&
      workstationResolvedTargetMismatchPayload.gate.goLiveLivePilotSessionRequired === true &&
      workstationResolvedTargetMismatchPayload.gate.goLiveLatestLivePilotSessionActive === true &&
      String(workstationResolvedTargetMismatchPayload.output?.error ?? '').includes(
        'AGENTHUB_ALLOWED_WORKSTATION_TARGETS',
      ) &&
      Array.isArray(workstationLaunchTargetGate?.candidates) &&
      workstationLaunchTargetGate.candidates.some((candidate: string) =>
        candidate.includes('unapproved-rdp-host.local'),
      ) &&
      workstationResolvedTargetMismatchPayload.releasedResourceLock?.status === 'released',
    `Expected workstation live launch to block when resolved RDP target is not allowlisted: ${JSON.stringify(workstationResolvedTargetMismatchPayload.output)}`,
  )
  assert(
    stoppedLivePilotSessionPayload.session.status === 'stopped' &&
      stoppedLivePilotSessionPayload.session.id === targetMismatchLivePilotSessionPayload.session.id,
    `Expected active live pilot session to stop: ${JSON.stringify(stoppedLivePilotSessionPayload.session)}`,
  )
  assert(
    workstationStoppedLivePilotSessionPayload.status === 'blocked' &&
      workstationStoppedLivePilotSessionPayload.gate.goLiveLatestLivePilotSessionStatus === 'stopped' &&
      workstationStoppedLivePilotSessionPayload.gate.goLiveLatestLivePilotSessionActive === false &&
      String(workstationStoppedLivePilotSessionPayload.output?.error ?? '').includes('has been stopped') &&
      workstationStoppedLivePilotSessionPayload.releasedResourceLock?.status === 'released',
    `Expected stopped live pilot session to block further live runtime-control: ${JSON.stringify(workstationStoppedLivePilotSessionPayload)}`,
  )
  assert(
    softwareRunPayload.softwareCommandRun.status === 'blocked',
    `Expected gated software command execute to be blocked, got ${softwareRunPayload.softwareCommandRun.status}.`,
  )
  assert(
    softwareRunPayload.softwareCommandRun.output?.runtimeControlActionId ||
      softwareRunPayload.softwareCommandRun.output?.runtimeControl?.runtimeControlActionId,
    `Expected software command run to record runtime-control action id: ${JSON.stringify(softwareRunPayload.softwareCommandRun.output)}`,
  )
  assert(
    pendingSoftwareApprovalPayload.softwareCommandRun.status === 'blocked' &&
      pendingSoftwareApprovalPayload.softwareCommandRun.approvalRequestId === softwareApprovalId,
    `Expected approval-bound software command to wait for approval: ${JSON.stringify(pendingSoftwareApprovalPayload.softwareCommandRun)}`,
  )
  const softwareApprovalRuntimeControl = softwareApproval?.payload.runtimeControl as
    | {
        approvalInputHash?: string
        approvalInput?: {
          desktopRuntimeTarget?: unknown
          desktopRuntimeTargetCandidates?: unknown
          desktopFocusRequired?: unknown
          desktopFocusTarget?: unknown
          desktopFocusProcessName?: unknown
          desktopFocusTitleContains?: unknown
        }
      }
    | null
    | undefined
  assert(
    boundSoftwareApprovalPayload.softwareCommandRun.status === 'blocked' &&
      boundSoftwareApprovalPayload.softwareCommandRun.approvalRequestId === softwareApprovalId &&
      boundSoftwareApprovalPayload.softwareCommandRun.output?.runtimeControlActionId,
    `Expected matching software command approval to reach runtime-control gate: ${JSON.stringify(boundSoftwareApprovalPayload.softwareCommandRun)}`,
  )
  assert(
    typeof softwareApprovalRuntimeControl?.approvalInputHash === 'string' &&
      softwareApprovalRuntimeControl.approvalInputHash ===
        boundSoftwareApprovalPayload.softwareCommandRun.output?.output?.inputHash &&
      softwareApprovalRuntimeControl.approvalInput?.desktopRuntimeTarget === null &&
      softwareApprovalRuntimeControl.approvalInput?.desktopFocusRequired === true &&
      softwareApprovalRuntimeControl.approvalInput?.desktopFocusTarget === null &&
      softwareApprovalRuntimeControl.approvalInput?.desktopFocusProcessName === null &&
      softwareApprovalRuntimeControl.approvalInput?.desktopFocusTitleContains === null &&
      Array.isArray(softwareApprovalRuntimeControl.approvalInput?.desktopRuntimeTargetCandidates) &&
      softwareApprovalRuntimeControl.approvalInput.desktopRuntimeTargetCandidates.length === 0,
    `Expected software command approval to reuse runtime-control approval input hash: ${JSON.stringify({
      approvalPayload: softwareApproval?.payload,
      runtimeOutput: boundSoftwareApprovalPayload.softwareCommandRun.output,
    })}`,
  )
  assert(
    replayedSoftwareApprovalPayload.softwareCommandRun.status === 'blocked' &&
      replayedSoftwareApprovalPayload.softwareCommandRun.approvalRequestId &&
      replayedSoftwareApprovalPayload.softwareCommandRun.approvalRequestId !== softwareApprovalId &&
      !replayedSoftwareApprovalPayload.softwareCommandRun.output,
    `Expected consumed software command approval to require a fresh approval on replay: ${JSON.stringify(replayedSoftwareApprovalPayload.softwareCommandRun)}`,
  )
  assert(
    mismatchedSoftwareApprovalPayload.softwareCommandRun.status === 'blocked' &&
      mismatchedSoftwareApprovalPayload.softwareCommandRun.approvalRequestId &&
      mismatchedSoftwareApprovalPayload.softwareCommandRun.approvalRequestId !== softwareApprovalId &&
      !mismatchedSoftwareApprovalPayload.softwareCommandRun.output,
    `Expected mismatched software command input to require a fresh approval: ${JSON.stringify(mismatchedSoftwareApprovalPayload.softwareCommandRun)}`,
  )
  assert(
    mobileSoftwareRunPayload.softwareCommandRun.status === 'blocked' &&
      mobileSoftwareRunPayload.softwareCommandRun.output?.gate?.requiredEnvVar === 'AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE' &&
      mobileSoftwareRunPayload.softwareCommandRun.output?.output?.actionType === 'mobile_screenshot',
    `Expected mobile software command to map to the mobile screenshot runtime gate: ${JSON.stringify(mobileSoftwareRunPayload.softwareCommandRun.output)}`,
  )
  assert(
    mobileSwipeSoftwareRunPayload.softwareCommandRun.status === 'blocked' &&
      mobileSwipeSoftwareRunPayload.softwareCommandRun.output?.gate?.requiredEnvVar === 'AGENTHUB_ENABLE_REAL_MOBILE_CONTROL' &&
      mobileSwipeSoftwareRunPayload.softwareCommandRun.output?.output?.actionType === 'mobile_swipe',
    `Expected mobile swipe software command to map to the mobile control runtime gate: ${JSON.stringify(mobileSwipeSoftwareRunPayload.softwareCommandRun.output)}`,
  )
  assert(
    blockedMobileDeviceAllowlistPayload.result.status === 'blocked' &&
      blockedMobileDeviceAllowlistPayload.result.gate.mobileDeviceAllowlistRequired === true &&
      blockedMobileDeviceAllowlistPayload.result.gate.mobileDeviceAllowed === false &&
      blockedMobileDeviceAllowlistPayload.result.gate.mobileDeviceAllowlistEnvVar === 'AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS' &&
      String(blockedMobileDeviceAllowlistPayload.result.output?.error ?? '').includes('AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS'),
    `Expected mobile control to reject devices outside the live allowlist: ${JSON.stringify(blockedMobileDeviceAllowlistPayload.result.gate)}`,
  )
  assert(
    blockedMobileDeviceAllowlistPayload.result.releasedResourceLock?.status === 'released',
    'Expected mobile allowlist-blocked resource lock to be released.',
  )
  assert(
    blockedMobileAppAllowlistPayload.result.status === 'blocked' &&
      blockedMobileAppAllowlistPayload.result.gate.mobileDeviceAllowed === true &&
      blockedMobileAppAllowlistPayload.result.gate.mobileAppAllowlistRequired === true &&
      blockedMobileAppAllowlistPayload.result.gate.mobileAppAllowed === false &&
      blockedMobileAppAllowlistPayload.result.gate.mobileAppAllowlistEnvVar === 'AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES' &&
      blockedMobileAppAllowlistPayload.result.gate.mobileAppPackage === 'com.blocked.app' &&
      String(blockedMobileAppAllowlistPayload.result.output?.error ?? '').includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES'),
    `Expected mobile control to reject app packages outside the live allowlist: ${JSON.stringify(blockedMobileAppAllowlistPayload.result.gate)}`,
  )
  assert(
    blockedMobileAppAllowlistPayload.result.releasedResourceLock?.status === 'released',
    'Expected mobile app allowlist-blocked resource lock to be released.',
  )
  assert(
    allowedMobileDeviceAllowlistPayload.result.status === 'blocked' &&
      allowedMobileDeviceAllowlistPayload.result.gate.mobileDeviceAllowlistRequired === true &&
      allowedMobileDeviceAllowlistPayload.result.gate.mobileDeviceAllowed === true &&
      allowedMobileDeviceAllowlistPayload.result.gate.mobileDeviceId === 'allowed-smoke-device' &&
      allowedMobileDeviceAllowlistPayload.result.gate.mobileAppAllowlistRequired === true &&
      allowedMobileDeviceAllowlistPayload.result.gate.mobileAppAllowed === true &&
      allowedMobileDeviceAllowlistPayload.result.gate.mobileAppPackage === 'com.example.allowed' &&
      String(allowedMobileDeviceAllowlistPayload.result.output?.error ?? '').includes('approvalRequestId'),
    `Expected allowlisted mobile device/app to pass allowlists and stop at approval binding: ${JSON.stringify(allowedMobileDeviceAllowlistPayload.result.gate)}`,
  )
  assert(
    allowedMobileDeviceAllowlistPayload.result.releasedResourceLock?.status === 'released',
    'Expected allowlisted mobile approval-blocked resource lock to be released.',
  )
  assert(
    approvedMobileDevicePayload.result.status === 'blocked' &&
      approvedMobileDevicePayload.result.gate.approvalSatisfied === true &&
      approvedMobileDevicePayload.result.gate.goLiveRequired === true &&
      approvedMobileDevicePayload.result.output?.inputHash === mobileRuntimeApprovalInputHash &&
      approvedMobileDevicePayload.result.output?.approvalInput?.mobileRuntimeDeviceId === 'allowed-smoke-device' &&
      approvedMobileDevicePayload.result.output?.approvalInput?.mobileRuntimeAppPackage === 'com.example.allowed' &&
      mobileRuntimeApproval.payload.inputHash === mobileRuntimeApprovalInputHash,
    `Expected approved mobile runtime control to bind device id and app package into approval hash: ${JSON.stringify({
      output: approvedMobileDevicePayload.result.output,
      approvalPayload: mobileRuntimeApproval.payload,
    })}`,
  )
  assert(
    approvedMobileDevicePayload.result.releasedResourceLock?.status === 'released',
    'Expected approved mobile runtime control resource lock to be released.',
  )
  assert(
    hardeningPayload.report.counts.runtimeMappedSoftwareCommands >= 1,
    'Expected hardening report to count runtime-mapped software commands.',
  )
  assert(
    hardeningPayload.report.counts.softwareCommandApprovals >= 1 &&
      hardeningPayload.report.counts.approvalBoundSoftwareCommandApprovals >= 1 &&
      hardeningPayload.report.counts.runtimeApprovalBoundSoftwareCommandApprovals >= 1 &&
      hardeningPayload.report.counts.approvedSoftwareCommandApprovals >= 1,
    `Expected hardening report to count bound software command approvals: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.checks.some(
      (check: { key: string; status: string }) =>
        check.key === 'software_command_approval_binding' && check.status === 'ready',
    ),
    'Expected hardening report to expose ready software command approval binding check.',
  )
  assert(
    hardeningPayload.report.counts.approvedRuntimeControlApprovals >= 1,
    'Expected hardening report to count approved runtime-control approvals.',
  )
  assert(
    hardeningPayload.report.counts.approvalBoundRuntimeControlApprovals >= 1,
    `Expected hardening report to count inputHash-bound runtime-control approvals: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.runtimeControlActions >= 1,
    'Expected hardening report to count runtime-control action evidence.',
  )
  assert(
    hardeningPayload.report.counts.runtimeControlKillSwitchActions >= 1 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'runtime_control_kill_switch' && check.status === 'ready',
      ),
    `Expected hardening report to expose global runtime-control kill switch evidence: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.desktopTargetAllowlistActions >= 2 &&
      hardeningPayload.report.counts.desktopTargetAllowlistBlockedActions >= 1 &&
      hardeningPayload.report.counts.desktopTargetAllowlistPassedActions >= 1 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'desktop_target_allowlist_gate' && check.status === 'ready',
    ),
    `Expected hardening report to expose desktop target allowlist gate evidence: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.desktopInputActions >= 1 &&
      hardeningPayload.report.counts.desktopInputFocusBoundActions >= 1 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'desktop_input_focus_binding' && check.status === 'ready',
      ),
    `Expected hardening report to expose desktop input focus binding evidence: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.desktopPointerActions >= 1 &&
      hardeningPayload.report.counts.desktopPointerFocusBoundActions >= 1 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'desktop_pointer_focus_binding' && check.status === 'ready',
      ),
    `Expected hardening report to expose desktop pointer focus binding evidence: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.successfulWorkstationValidations >= 1,
    'Expected hardening report to count successful workstation validations.',
  )
  assert(
    hardeningPayload.report.counts.blockedWorkstationValidations >= 1,
    'Expected hardening report to count blocked workstation validations.',
  )
  assert(
    hardeningPayload.report.counts.workstationReleaseActions >= 1,
    `Expected hardening report to count workstation release actions: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.staleBusyWorkstations === 0 &&
      hardeningPayload.report.counts.recoverableStaleBusyWorkstations === 0 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'workstation_stale_busy_recovery' && check.status === 'ready',
      ),
    `Expected hardening report to expose clear stale workstation recovery status after recovery: ${JSON.stringify(
      hardeningPayload.report.counts,
    )}`,
  )
  assert(
    hardeningPayload.report.counts.mobileScreenshotActions >= 1,
    'Expected hardening report to count mobile screenshot runtime actions.',
  )
  assert(
    hardeningPayload.report.counts.redactedRuntimeFileOutputs >= 3 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'runtime_output_redaction' && check.status === 'ready',
      ),
    `Expected hardening report to count redacted runtime output path evidence: ${JSON.stringify(
      hardeningPayload.report.counts,
    )}`,
  )
  assert(
    hardeningPayload.report.counts.mobileDeviceAllowlistActions >= 2 &&
      hardeningPayload.report.counts.mobileDeviceAllowlistBlockedActions >= 1 &&
      hardeningPayload.report.counts.mobileDeviceAllowlistPassedActions >= 1 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'mobile_device_allowlist_gate' && check.status === 'ready',
    ),
    `Expected hardening report to expose mobile device allowlist gate evidence: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.mobileAppAllowlistActions >= 2 &&
      hardeningPayload.report.counts.mobileAppAllowlistBlockedActions >= 1 &&
      hardeningPayload.report.counts.mobileAppAllowlistPassedActions >= 1 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'mobile_app_allowlist_gate' && check.status === 'ready',
      ),
    `Expected hardening report to expose mobile app package allowlist gate evidence: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.counts.workstationTargetAllowlistActions >= 2 &&
      hardeningPayload.report.counts.workstationTargetAllowlistBlockedActions >= 1 &&
      hardeningPayload.report.counts.workstationTargetAllowlistPassedActions >= 1 &&
      hardeningPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'workstation_target_allowlist_gate' && check.status === 'ready',
      ),
    `Expected hardening report to expose workstation target allowlist gate evidence: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    runtimeReadinessPayload.runtimeControl.summary.runtimeControlActions >= 1,
    'Expected runtime control readiness to count runtime-control actions.',
  )
  assert(
    runtimeReadinessPayload.runtimeControl.summary.blockedRuntimeControlActions >= 1,
    'Expected runtime control readiness to count blocked runtime-control actions.',
  )
  assert(
    runtimeReadinessPayload.runtimeControl.gates.some(
      (gate: { key: string; envVar: string | null; blockedActions: number }) =>
        gate.key === 'mobile_capture' &&
        gate.envVar === 'AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE' &&
        gate.blockedActions >= 1,
    ),
    'Expected runtime control readiness to expose blocked mobile capture gate.',
  )
  assert(
    runtimeReadinessPayload.runtimeControl.gates.some(
      (gate: { key: string; approvedRuntimeControlApprovals: number }) =>
        gate.key === 'workstation_launch' && gate.approvedRuntimeControlApprovals >= 1,
    ),
    'Expected runtime control readiness to expose approved workstation launch gate evidence.',
  )
  assert(
    runtimeReadinessPayload.runtimeControl.workstationChecks.some(
      (workstation: { id: string; ready: boolean }) =>
        workstation.id === reservationPayload.workstation.id && workstation.ready,
    ),
    'Expected runtime control readiness to mark complete RDP workstation as ready.',
  )
  assert(
    runtimeReadinessPayload.runtimeControl.workstationChecks.some(
      (workstation: { id: string; ready: boolean; blockingReasons: string[] }) =>
        workstation.id === noLaunchReservationPayload.workstation.id &&
        !workstation.ready &&
        workstation.blockingReasons.length > 0,
    ),
    'Expected runtime control readiness to mark incomplete workstation as blocked.',
  )
  assert(
    executionPreflightPayload.preflight.canExecuteReadOnly === true &&
      executionPreflightPayload.preflight.safeToExecuteAnyLiveAction === false,
    `Expected execution preflight to allow read-only checks while blocking live actions: ${JSON.stringify(executionPreflightPayload.preflight.summary)}`,
  )
  assert(
    executionPreflightPayload.preflight.summary.readyModels >= 1 &&
      executionPreflightPayload.preflight.summary.readyWorkstations >= 1,
    `Expected execution preflight to count ready models and workstations: ${JSON.stringify(executionPreflightPayload.preflight.summary)}`,
  )
  assert(
    goLiveDrillPayload.drill.willTouchExternalSystems === false &&
      goLiveDrillPayload.drill.safeToStartLivePilot === false &&
      goLiveDrillPayload.drill.summary.totalScenarios >= 10 &&
      goLiveDrillPayload.drill.summary.blockedScenarios > 0,
    `Expected go-live drill to be non-invasive and blocked until production evidence is complete: ${JSON.stringify(goLiveDrillPayload.drill.summary)}`,
  )
  assert(
    goLiveDrillPayload.drill.scenarios.some(
      (scenario: { id: string; canPassNow: boolean }) =>
        scenario.id === 'approved_go_live_gate' && scenario.canPassNow === false,
    ) &&
      goLiveDrillPayload.drill.scenarios.some(
        (scenario: { id: string; domain: string }) =>
          scenario.id === 'workstation_launch' && scenario.domain === 'workstation',
      ),
    `Expected go-live drill to include approved gate and workstation launch scenarios: ${JSON.stringify(goLiveDrillPayload.drill.scenarios)}`,
  )
  assert(
    livePilotLeasePayload.lease.durationMinutes === 30 &&
      /^sha256:[a-f0-9]{64}$/.test(livePilotLeasePayload.lease.contentHash) &&
      livePilotLeasePayload.lease.activationInstruction.envVar === 'AGENTHUB_LIVE_PILOT_LEASE_HASH' &&
      livePilotLeasePayload.lease.canActivateLivePilot === false &&
      livePilotLeasePayload.lease.blockers.length > 0,
    `Expected blocked live pilot lease endpoint to expose hash, activation instruction, and blockers: ${JSON.stringify(livePilotLeasePayload.lease)}`,
  )
  assert(
    livePilotSessionReportPayload.report.summary.total >= 1 &&
      livePilotSessionReportPayload.report.summary.stopped >= 1 &&
      livePilotSessionReportPayload.report.sessions.some(
        (session: { id: string; status: string }) =>
          session.id === targetMismatchLivePilotSessionPayload.session.id && session.status === 'stopped',
      ),
    `Expected live pilot session report to include stopped smoke session: ${JSON.stringify(livePilotSessionReportPayload.report.summary)}`,
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: { id: string; canExecuteNow: boolean; requiredEnvVars: Array<{ envVar: string }> }) =>
        action.id === 'model_invocation' &&
        !action.canExecuteNow &&
        action.requiredEnvVars.some((gate) => gate.envVar === 'AGENTHUB_ENABLE_REAL_MODEL_INVOCATION'),
    ),
    'Expected execution preflight to expose gated model invocation.',
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: { id: string; canExecuteNow: boolean; requiredEnvVars: Array<{ envVar: string }> }) =>
        action.id === 'model_connection' &&
        action.requiredEnvVars.some((gate) => gate.envVar === 'AGENTHUB_ENABLE_REAL_MODEL_CONNECTION'),
    ),
    'Expected execution preflight to expose gated model connection test.',
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: {
        id: string
        requiredRuntimeGuards?: Array<{ envVar: string; configured: boolean }>
      }) =>
        action.id === 'model_connection' &&
        action.requiredRuntimeGuards?.some(
          (guard) => guard.envVar === 'AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS' && guard.configured === true,
        ),
    ) &&
      executionPreflightPayload.preflight.actions.some(
        (action: {
          id: string
          requiredRuntimeGuards?: Array<{ envVar: string; configured: boolean }>
        }) =>
          action.id === 'model_invocation' &&
          action.requiredRuntimeGuards?.some(
            (guard) => guard.envVar === 'AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS' && guard.configured === true,
          ),
      ),
    'Expected execution preflight to expose configured model endpoint host allowlist guard.',
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: { id: string; canExecuteNow: boolean; blockers: string[] }) =>
        action.id === 'desktop_control' &&
        !action.canExecuteNow &&
        action.blockers.some((blocker) => blocker.includes('AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL')),
    ),
    'Expected execution preflight to block desktop control on env gate.',
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: {
        id: string
        requiredRuntimeGuards?: Array<{ envVar: string; configured: boolean }>
        blockers: string[]
        emergencyStop?: { active: boolean }
      }) =>
        action.id === 'desktop_control' &&
        action.emergencyStop?.active === false &&
        action.requiredRuntimeGuards?.some(
          (guard) => guard.envVar === 'AGENTHUB_ALLOWED_DESKTOP_TARGETS' && guard.configured === false,
        ) &&
        action.blockers.some((blocker) => blocker.includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS')),
    ),
    'Expected execution preflight to expose missing desktop target allowlist guard.',
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: {
        id: string
        requiredRuntimeGuards?: Array<{ envVar: string; configured: boolean }>
        blockers: string[]
      }) =>
        action.id === 'mobile_control' &&
        action.requiredRuntimeGuards?.some(
          (guard) => guard.envVar === 'AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS' && guard.configured === false,
        ) &&
        action.blockers.some((blocker) => blocker.includes('AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS')),
    ),
    'Expected execution preflight to expose missing mobile device allowlist guard.',
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: {
        id: string
        requiredRuntimeGuards?: Array<{ envVar: string; configured: boolean }>
        blockers: string[]
      }) =>
        action.id === 'mobile_control' &&
        action.requiredRuntimeGuards?.some(
          (guard) => guard.envVar === 'AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES' && guard.configured === false,
        ) &&
        action.blockers.some((blocker) => blocker.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES')),
    ),
    'Expected execution preflight to expose missing mobile app package allowlist guard.',
  )
  assert(
    executionPreflightPayload.preflight.actions.some(
      (action: {
        id: string
        requiredRuntimeGuards?: Array<{ envVar: string; configured: boolean }>
        blockers: string[]
      }) =>
        action.id === 'workstation_launch' &&
        action.requiredRuntimeGuards?.some(
          (guard) => guard.envVar === 'AGENTHUB_ALLOWED_WORKSTATION_TARGETS' && guard.configured === false,
        ) &&
        action.blockers.some((blocker) => blocker.includes('AGENTHUB_ALLOWED_WORKSTATION_TARGETS')),
    ),
    'Expected execution preflight to expose missing workstation target allowlist guard.',
  )
  assert(
    killSwitchExecutionPreflightPayload.preflight.actions.some(
      (action: { id: string; emergencyStop?: { active: boolean }; blockers: string[] }) =>
        action.id === 'desktop_control' &&
        action.emergencyStop?.active === true &&
        action.blockers.some((blocker) => blocker.includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH')),
    ),
    'Expected execution preflight to show runtime kill switch blocking high-risk desktop control.',
  )
  assert(
    realControlPayload.report.safeToUseLiveControls === false,
    'Expected real control acceptance to stay unsafe without customer authorization and complete runtime evidence.',
  )
  assert(
    realControlPayload.report.summary.customerAuthorized === false,
    'Expected real control acceptance to require explicit customer authorization.',
  )
  assert(
    realControlPayload.report.summary.customerAuthorizationSwitchEnabled === false &&
      realControlPayload.report.summary.customerAuthorizationEvidenceHashPresent === false &&
      realControlPayload.report.summary.customerAuthorizationEvidenceMatched === false,
    `Expected real control customer authorization to require evidence hash binding: ${JSON.stringify(realControlPayload.report.summary)}`,
  )
  assert(
    realControlPayload.report.summary.blockedActions >= 1,
    'Expected real control acceptance to count blocked runtime-control actions.',
  )
  assert(
    realControlPayload.report.summary.readyWorkstations >= 1,
    'Expected real control acceptance to count ready workstation evidence.',
  )
  assert(
    realControlPayload.report.checks.some(
      (check: { key: string; status: string }) =>
        check.key === 'customer_real_control_authorization' && check.status === 'not_configured',
    ),
    'Expected real control acceptance report to expose customer authorization check.',
  )
  assert(
    realControlPayload.report.desktop.gates.some(
      (gate: { key: string; envVar: string | null }) =>
        gate.key === 'desktop_control' && gate.envVar === 'AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL',
    ),
    'Expected real control acceptance desktop domain to include desktop control gate.',
  )
  assert(
    realControlPayload.report.mobile.gates.some(
      (gate: { key: string; blockedActions: number }) =>
        gate.key === 'mobile_capture' && gate.blockedActions >= 1,
    ),
    'Expected real control acceptance mobile domain to include blocked mobile capture evidence.',
  )
  assert(
    realControlPayload.report.workstations.gates.some(
      (gate: { key: string; approvedRuntimeControlApprovals: number }) =>
        gate.key === 'workstation_launch' && gate.approvedRuntimeControlApprovals >= 1,
    ),
    'Expected real control acceptance workstation domain to include approved launch evidence.',
  )
  assert(
    realControlPayload.report.blockers.length > 0 &&
      Array.isArray(realControlPayload.report.nextActions),
    'Expected real control acceptance to expose blockers and next actions.',
  )
  assert(
    liveConnectorPayload.report.safeToActivateLive === false,
    'Expected live connector report to keep live activation disabled without full customer readiness.',
  )
  assert(
    liveConnectorPayload.report.summary.models >= 1,
    `Expected live connector report to count model connectors: ${JSON.stringify(liveConnectorPayload.report.summary)}`,
  )
  assert(
    liveConnectorPayload.report.connectors.some(
      (connector: { kind: string; ownerId: string | null; routeLabel: string }) =>
        connector.kind === 'model' &&
        connector.ownerId === model.id &&
        connector.routeLabel.includes('Smoke model proxy outlet'),
    ),
    'Expected live connector report to include model connector with Network Profile route.',
  )
  assert(
    liveConnectorPayload.report.connectors.some(
      (connector: { kind: string; ownerId: string | null; envGates: Array<{ envVar: string }> }) =>
        connector.kind === 'model' &&
        connector.ownerId === model.id &&
        connector.envGates.some((gate) => gate.envVar === 'AGENTHUB_ENABLE_REAL_MODEL_CONNECTION') &&
        connector.envGates.some((gate) => gate.envVar === 'AGENTHUB_ENABLE_REAL_MODEL_INVOCATION'),
    ),
    'Expected live connector report to expose separate model connection and invocation env gates.',
  )
  assert(
    liveConnectorPayload.report.connectors.some(
      (connector: { kind: string; envGates: Array<{ envVar: string }> }) =>
        connector.kind === 'desktop' &&
        connector.envGates.some((gate) => gate.envVar === 'AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL'),
    ),
    'Expected live connector report to include desktop real-control env gate.',
  )
  assert(
    liveConnectorPayload.report.connectors.some(
      (connector: { kind: string; blockers: string[]; status: string }) =>
        connector.kind === 'mobile' &&
        (connector.blockers.length > 0 || connector.status === 'not_installed' || connector.status === 'available'),
    ),
    'Expected live connector report to include mobile runtime-control blocker or readiness evidence.',
  )
  assert(
    liveConnectorPayload.report.connectors.some(
      (connector: { kind: string; routeLabel: string }) =>
        connector.kind === 'workstation' && connector.routeLabel.includes('可用'),
    ),
    'Expected live connector report to include workstation connector summary.',
  )
  assert(
    liveConnectorPayload.report.connectors.some(
      (connector: { kind: string; ready: boolean; blockers: string[] }) =>
        connector.kind === 'customer_authorization' &&
        connector.ready === false &&
        connector.blockers.length > 0,
    ),
    'Expected live connector report to include customer authorization blocker.',
  )
  assert(
    liveConnectorPayload.report.connectors.some(
      (connector: { kind: string; envGates: Array<{ envVar: string; enabled: boolean }> }) =>
        connector.kind === 'customer_authorization' &&
        connector.envGates.some(
          (gate) => gate.envVar === 'AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH' && gate.enabled === false,
        ),
    ),
    'Expected live connector report to require customer authorization evidence hash gate.',
  )
  assert(
    onsiteActivationPayload.guide.safeToStartDryRun === true,
    'Expected onsite activation guide to allow dry-run planning once connectors exist.',
  )
  assert(
    onsiteActivationPayload.guide.safeToActivateLive === false,
    'Expected onsite activation guide to keep live activation disabled without complete onsite readiness.',
  )
  assert(
    onsiteActivationPayload.guide.summary.totalSteps >= 8 &&
      onsiteActivationPayload.guide.summary.blockedSteps >= 1,
    `Expected onsite activation guide to expose ordered steps and blockers: ${JSON.stringify(onsiteActivationPayload.guide.summary)}`,
  )
  const onsiteStepIds = new Set(
    onsiteActivationPayload.guide.steps.map((step: { id: string }) => step.id),
  )
  for (const expectedStep of [
    'customer_authorization',
    'model_credentials',
    'network_routes',
    'desktop_runtime',
    'mobile_runtime',
    'workstation_runtime',
    'final_verification',
    'rollback_ready',
  ]) {
    assert(onsiteStepIds.has(expectedStep), `Expected onsite activation step ${expectedStep}.`)
  }
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string }) =>
        item.envVar === 'AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED' &&
        item.powershellPreview.includes('AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED'),
    ),
    'Expected onsite activation guide to expose customer authorization env instruction.',
  )
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string; valueHint: string }) =>
        item.envVar === 'AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH' &&
        item.powershellPreview.includes('sha256:') &&
        item.valueHint.includes('contentHash'),
    ),
    'Expected onsite activation guide to expose customer authorization evidence hash instruction.',
  )
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string; valueHint: string }) =>
        item.envVar === 'AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH' &&
        item.powershellPreview.includes("AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH='0'") &&
        item.valueHint.includes('紧急停止'),
    ),
    'Expected onsite activation guide to expose runtime-control kill-switch instruction.',
  )
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string; valueHint: string }) =>
        item.envVar === 'AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS' &&
        item.powershellPreview.includes('AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS') &&
        item.valueHint.includes('模型供应商主机'),
    ),
    'Expected onsite activation guide to expose model endpoint host allowlist instruction.',
  )
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string; valueHint: string }) =>
        item.envVar === 'AGENTHUB_ALLOWED_DESKTOP_TARGETS' &&
        item.powershellPreview.includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS') &&
        item.valueHint.includes('进程或窗口'),
    ),
    'Expected onsite activation guide to expose desktop target allowlist instruction.',
  )
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string; valueHint: string }) =>
        item.envVar === 'AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS' &&
        item.powershellPreview.includes('AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS') &&
        item.valueHint.includes('设备 ID'),
    ),
    'Expected onsite activation guide to expose mobile device allowlist instruction.',
  )
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string; valueHint: string }) =>
        item.envVar === 'AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES' &&
        item.powershellPreview.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES') &&
        item.valueHint.includes('Android 包名'),
    ),
    'Expected onsite activation guide to expose mobile app package allowlist instruction.',
  )
  assert(
    onsiteActivationPayload.guide.envChecklist.some(
      (item: { envVar: string; powershellPreview: string; valueHint: string }) =>
        item.envVar === 'AGENTHUB_ALLOWED_WORKSTATION_TARGETS' &&
        item.powershellPreview.includes('AGENTHUB_ALLOWED_WORKSTATION_TARGETS') &&
        item.valueHint.includes('工作站 ID'),
    ),
    'Expected onsite activation guide to expose workstation target allowlist instruction.',
  )
  assert(
    onsiteActivationPayload.guide.validationCommands.some(
      (command: { command: string }) =>
        command.command.includes('/api/production-integrations/real-control/report'),
    ),
    'Expected onsite activation guide to include real-control validation command.',
  )
  assert(
    onsiteActivationPayload.guide.rollbackPlan.some(
      (command: { command: string }) =>
        command.command.includes('AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL'),
    ),
    'Expected onsite activation guide to include real desktop rollback command.',
  )
  assert(
    onsiteActivationPayload.guide.rollbackPlan.some(
      (command: { command: string }) =>
        command.command.includes("AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH='1'"),
    ),
    'Expected onsite activation guide to include emergency-stop rollback command.',
  )
  assert(
    onsiteActivationPayload.guide.rollbackPlan.some(
      (command: { command: string }) =>
        command.command.includes("AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS=''"),
    ) &&
      onsiteActivationPayload.guide.rollbackPlan.some(
      (command: { command: string }) =>
        command.command.includes("AGENTHUB_ALLOWED_DESKTOP_TARGETS=''"),
    ) &&
      onsiteActivationPayload.guide.rollbackPlan.some(
        (command: { command: string }) =>
          command.command.includes("AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS=''"),
      ) &&
      onsiteActivationPayload.guide.rollbackPlan.some(
        (command: { command: string }) =>
          command.command.includes("AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES=''"),
      ) &&
      onsiteActivationPayload.guide.rollbackPlan.some(
        (command: { command: string }) =>
          command.command.includes("AGENTHUB_ALLOWED_WORKSTATION_TARGETS=''"),
      ),
    'Expected onsite activation guide to clear model, desktop, mobile device/app, and workstation allowlists during rollback.',
  )
  assert(
    onsiteActivationPackagePayload.package.redacted === true,
    'Expected onsite activation package to be marked redacted.',
  )
  assert(
    /^sha256:[a-f0-9]{64}$/.test(onsiteActivationPackagePayload.package.contentHash),
    `Expected onsite activation package hash: ${onsiteActivationPackagePayload.package.contentHash}`,
  )
  assert(
    existsSync(onsiteActivationPackagePayload.package.files.manifestPath),
    `Expected onsite activation package manifest to exist: ${onsiteActivationPackagePayload.package.files.manifestPath}`,
  )
  assert(
    existsSync(onsiteActivationPackagePayload.package.files.markdownPath),
    `Expected onsite activation package markdown to exist: ${onsiteActivationPackagePayload.package.files.markdownPath}`,
  )
  assert(
    existsSync(onsiteActivationPackagePayload.package.files.activationScriptPath),
    `Expected onsite activation script to exist: ${onsiteActivationPackagePayload.package.files.activationScriptPath}`,
  )
  assert(
    existsSync(onsiteActivationPackagePayload.package.files.rollbackScriptPath),
    `Expected onsite rollback script to exist: ${onsiteActivationPackagePayload.package.files.rollbackScriptPath}`,
  )
  const onsiteActivationMarkdown = readFileSync(
    onsiteActivationPackagePayload.package.files.markdownPath,
    'utf8',
  )
  const onsiteActivationScript = readFileSync(
    onsiteActivationPackagePayload.package.files.activationScriptPath,
    'utf8',
  )
  const onsiteRollbackScript = readFileSync(
    onsiteActivationPackagePayload.package.files.rollbackScriptPath,
    'utf8',
  )
  assert(
    onsiteActivationMarkdown.includes('AgentHub 现场激活包') &&
      onsiteActivationMarkdown.includes('本激活包不包含 API Key'),
    'Expected onsite activation markdown package to include title and redaction notice.',
  )
  assertReadableChineseMarkdown(onsiteActivationMarkdown, 'onsite activation')
  assert(
    onsiteActivationScript.includes('param(') &&
      onsiteActivationScript.includes('ApplyEnv') &&
      onsiteActivationScript.includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH') &&
      onsiteActivationScript.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES') &&
      onsiteActivationScript.includes('does not run live desktop/mobile/workstation/model actions'),
    'Expected onsite activation script to include safe env preview/apply controls.',
  )
  assert(
    onsiteRollbackScript.includes('param(') &&
      onsiteRollbackScript.includes('ApplyEnv') &&
      onsiteRollbackScript.includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH') &&
      onsiteRollbackScript.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES') &&
      onsiteRollbackScript.includes('does not run live desktop/mobile/workstation/model actions'),
    'Expected onsite rollback script to include safe rollback controls.',
  )
  assert(
    setupGuidePayload.setupGuide.summary.total >= 6,
    `Expected production setup guide to expose setup steps: ${JSON.stringify(setupGuidePayload.setupGuide.summary)}`,
  )
  const setupStepKeys = new Set(setupGuidePayload.setupGuide.steps.map((step: { key: string }) => step.key))
  for (const expectedStep of [
    'model_credentials',
    'desktop_runtime',
    'mobile_runtime',
    'virtual_workstations',
    'runtime_approvals',
    'production_hardening',
  ]) {
    assert(setupStepKeys.has(expectedStep), `Expected production setup guide step ${expectedStep}.`)
  }
  assert(
    setupGuidePayload.setupGuide.completionPercent >= 0 &&
      setupGuidePayload.setupGuide.completionPercent <= 100,
    `Expected setup guide completion percent within 0-100: ${setupGuidePayload.setupGuide.completionPercent}`,
  )
  const workstationSetupStep = setupGuidePayload.setupGuide.steps.find(
    (step: { key: string; status: string }) => step.key === 'virtual_workstations',
  )
  assert(workstationSetupStep, 'Expected virtual workstation setup step.')
  assert(
    workstationSetupStep.status !== 'done',
    `Expected virtual workstation setup step to stay incomplete without real launch evidence: ${JSON.stringify(workstationSetupStep)}`,
  )
  const modelSetupStep = setupGuidePayload.setupGuide.steps.find(
    (step: { key: string; evidence: string[]; nextActions: string[] }) => step.key === 'model_credentials',
  )
  assert(
    modelSetupStep &&
      modelSetupStep.evidence.length > 0 &&
      Array.isArray(modelSetupStep.nextActions),
    `Expected model setup step to expose evidence and next actions: ${JSON.stringify(modelSetupStep)}`,
  )
  assert(
    customerEnvironmentPayload.report.checks.some(
      (check: { key: string; status: string }) =>
        check.key === 'customer_authorization' && check.status === 'not_configured',
    ),
    'Expected customer environment report to require explicit customer authorization.',
  )
  assert(
    customerEnvironmentPayload.report.customerAuthorization.switchEnabled === false &&
      customerEnvironmentPayload.report.customerAuthorization.evidenceHashPresent === false &&
      customerEnvironmentPayload.report.customerAuthorization.evidenceMatched === false,
    `Expected customer environment report to expose missing authorization evidence hash: ${JSON.stringify(customerEnvironmentPayload.report.customerAuthorization)}`,
  )
  assert(
    customerEnvironmentPayload.report.safeToRunLive === false,
    'Expected customer environment report to keep live execution unsafe without full customer evidence.',
  )
  assert(
    customerEnvironmentPayload.report.envGates.some(
      (gate: { envVar: string; riskLevel: string; enabled: boolean }) =>
        gate.envVar === 'AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL' &&
        gate.riskLevel === 'high' &&
        gate.enabled === false,
    ),
    'Expected customer environment report to expose real desktop control env gate.',
  )
  assert(
    customerEnvironmentPayload.report.envGates.some(
      (gate: { envVar: string; riskLevel: string; enabled: boolean }) =>
        gate.envVar === 'AGENTHUB_ENABLE_REAL_MODEL_CONNECTION' &&
        gate.riskLevel === 'medium' &&
        gate.enabled === true,
    ),
    'Expected customer environment report to expose real model connection env gate.',
  )
  assert(
    customerEnvironmentPayload.report.runtimeGuards.some(
      (guard: { envVar: string; configured: boolean }) =>
        guard.envVar === 'AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS' && guard.configured === true,
    ) &&
      customerEnvironmentPayload.report.runtimeGuards.some(
        (guard: { envVar: string; configured: boolean }) =>
        guard.envVar === 'AGENTHUB_ALLOWED_DESKTOP_TARGETS' && guard.configured === false,
    ) &&
      customerEnvironmentPayload.report.runtimeGuards.some(
        (guard: { envVar: string; configured: boolean }) =>
          guard.envVar === 'AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS' && guard.configured === false,
      ) &&
      customerEnvironmentPayload.report.runtimeGuards.some(
        (guard: { envVar: string; configured: boolean }) =>
          guard.envVar === 'AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES' && guard.configured === false,
      ) &&
      customerEnvironmentPayload.report.runtimeGuards.some(
        (guard: { envVar: string; configured: boolean }) =>
          guard.envVar === 'AGENTHUB_ALLOWED_WORKSTATION_TARGETS' && guard.configured === false,
      ) &&
      customerEnvironmentPayload.report.emergencyStop.active === false,
    'Expected customer environment report to expose runtime guard status.',
  )
  assert(
    customerEnvironmentPayload.report.checks.some(
      (check: { key: string; status: string; warnings: string[] }) =>
        check.key === 'runtime_guardrails' &&
        check.status === 'blocked' &&
        check.warnings.some((warning) => warning.includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS')) &&
        check.warnings.some((warning) => warning.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES')),
    ),
    'Expected customer environment report to block missing runtime guardrails.',
  )
  assert(
    customerEnvironmentPayload.report.checks.some(
      (check: { key: string; evidence: string[]; nextActions: string[] }) =>
        check.key === 'live_execution_evidence' &&
        check.evidence.length > 0 &&
        Array.isArray(check.nextActions),
    ),
    'Expected customer environment report to expose live execution evidence check.',
  )
  assert(
    customerEnvironmentPackagePayload.package.redacted === true,
    'Expected customer environment package to be marked redacted.',
  )
  assert(
    /^sha256:[a-f0-9]{64}$/.test(customerEnvironmentPackagePayload.package.contentHash),
    `Expected customer environment package hash: ${customerEnvironmentPackagePayload.package.contentHash}`,
  )
  assert(
    existsSync(customerEnvironmentPackagePayload.package.files.manifestPath),
    `Expected customer environment package manifest to exist: ${customerEnvironmentPackagePayload.package.files.manifestPath}`,
  )
  assert(
    existsSync(customerEnvironmentPackagePayload.package.files.markdownPath),
    `Expected customer environment package markdown to exist: ${customerEnvironmentPackagePayload.package.files.markdownPath}`,
  )
  assert(
    existsSync(customerEnvironmentPackagePayload.package.files.preflightScriptPath),
    `Expected customer environment preflight script to exist: ${customerEnvironmentPackagePayload.package.files.preflightScriptPath}`,
  )
  assert(
    existsSync(customerEnvironmentPackagePayload.package.files.rollbackScriptPath),
    `Expected customer environment rollback script to exist: ${customerEnvironmentPackagePayload.package.files.rollbackScriptPath}`,
  )
  const customerEnvironmentMarkdown = readFileSync(
    customerEnvironmentPackagePayload.package.files.markdownPath,
    'utf8',
  )
  const customerEnvironmentPreflightScript = readFileSync(
    customerEnvironmentPackagePayload.package.files.preflightScriptPath,
    'utf8',
  )
  const customerEnvironmentRollbackScript = readFileSync(
    customerEnvironmentPackagePayload.package.files.rollbackScriptPath,
    'utf8',
  )
  assert(
    customerEnvironmentMarkdown.includes('AgentHub 客户环境验收报告') &&
      customerEnvironmentMarkdown.includes('本报告不包含 API Key、密码、Cookie、远程桌面密码或客户账号凭证。'),
    'Expected customer environment markdown package to include report title and redaction notice.',
  )
  assertReadableChineseMarkdown(customerEnvironmentMarkdown, 'customer environment')
  assert(
      customerEnvironmentMarkdown.includes('运行安全护栏') &&
      customerEnvironmentMarkdown.includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH') &&
      customerEnvironmentMarkdown.includes('AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS') &&
      customerEnvironmentMarkdown.includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS') &&
      customerEnvironmentMarkdown.includes('AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS') &&
      customerEnvironmentMarkdown.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES') &&
      customerEnvironmentMarkdown.includes('AGENTHUB_ALLOWED_WORKSTATION_TARGETS'),
    'Expected customer environment markdown package to include runtime guardrails.',
  )
  assert(
    customerEnvironmentMarkdown.includes('AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH') &&
      customerEnvironmentPreflightScript.includes('AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH') &&
      customerEnvironmentRollbackScript.includes('AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH'),
    'Expected customer environment package to include customer authorization evidence hash gate.',
  )
  assert(
    customerEnvironmentPreflightScript.includes('Customer environment preflight') &&
      customerEnvironmentPreflightScript.includes('AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS') &&
      customerEnvironmentPreflightScript.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES') &&
      customerEnvironmentPreflightScript.includes('does not call external model providers or control desktop/mobile/workstations'),
    'Expected customer environment preflight script to include read-only guard checks.',
  )
  assert(
    customerEnvironmentRollbackScript.includes('param(') &&
      customerEnvironmentRollbackScript.includes('ApplyEnv') &&
      customerEnvironmentRollbackScript.includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH') &&
      customerEnvironmentRollbackScript.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES') &&
      customerEnvironmentRollbackScript.includes('does not run live desktop/mobile/workstation/model actions'),
    'Expected customer environment rollback script to include safe rollback controls.',
  )
  const onsiteIntegrity = packageIntegrityPayload.report.packages.find(
    (item: { contentHash: string | null }) =>
      item.contentHash === onsiteActivationPackagePayload.package.contentHash,
  )
  const customerIntegrity = packageIntegrityPayload.report.packages.find(
    (item: { contentHash: string | null }) =>
      item.contentHash === customerEnvironmentPackagePayload.package.contentHash,
  )
  assert(
    packageIntegrityPayload.report.summary.readyPackages >= 2 &&
      onsiteIntegrity?.status === 'ready' &&
      onsiteIntegrity.contentHashMatches === true &&
      onsiteIntegrity.scriptHashesMatch === true &&
      onsiteIntegrity.redacted === true &&
      customerIntegrity?.status === 'ready' &&
      customerIntegrity.contentHashMatches === true &&
      customerIntegrity.scriptHashesMatch === true &&
      customerIntegrity.redacted === true,
    `Expected exported packages to pass integrity checks: ${JSON.stringify(packageIntegrityPayload.report.summary)}`,
  )
  assert(
    hardeningAfterPackagePayload.report.checks.some(
      (check: { key: string; status: string; evidence: string[] }) =>
        check.key === 'production_package_integrity' &&
        (check.status === 'ready' || check.status === 'available') &&
        check.evidence.some((item) => item.includes('packages passed integrity checks')),
    ),
    'Expected hardening report to include production package integrity check.',
  )
  assert(
    finalAcceptancePayload.ledger.canClaimProductionReady === false,
    'Expected final acceptance ledger to reject production-ready claim without live customer authorization.',
  )
  assert(
    rejectedSensitiveEvidenceResponse.status === 400 &&
      String(rejectedSensitiveEvidencePayload.error ?? '').includes('sensitive material'),
    `Expected onsite evidence with password assignment to be rejected: ${JSON.stringify(rejectedSensitiveEvidencePayload)}`,
  )
  assert(
    onsiteEvidencePayload.evidence.category === 'customer_authorization' &&
      /^sha256:[a-f0-9]{64}$/.test(onsiteEvidencePayload.evidence.contentHash),
    `Expected onsite evidence record with hash: ${JSON.stringify(onsiteEvidencePayload.evidence)}`,
  )
  assert(
    onsiteEvidenceReportPayload.report.summary.total >= 1 &&
      onsiteEvidenceReportPayload.report.records.some(
        (record: { contentHash: string }) =>
          record.contentHash === onsiteEvidencePayload.evidence.contentHash,
      ),
    'Expected onsite evidence report to include newly recorded evidence.',
  )
  assert(
    finalAcceptancePayload.ledger.summary.onsiteEvidenceItems >= 1 &&
      finalAcceptancePayload.ledger.summary.latestEvidenceHash === onsiteEvidencePayload.evidence.contentHash,
    `Expected final acceptance ledger to count onsite evidence: ${JSON.stringify(finalAcceptancePayload.ledger.summary)}`,
  )
  assert(
    finalAcceptancePayload.ledger.summary.total >= 8 &&
      finalAcceptancePayload.ledger.categories.length === finalAcceptancePayload.ledger.summary.total,
    `Expected final acceptance ledger to expose all categories: ${JSON.stringify(finalAcceptancePayload.ledger.summary)}`,
  )
  const finalAcceptanceKeys = new Set(
    finalAcceptancePayload.ledger.categories.map((category: { key: string }) => category.key),
  )
  for (const expectedCategory of [
    'model_credentials',
    'desktop_control',
    'mobile_control',
    'workstations',
    'customer_authorization',
    'runtime_guardrails',
    'hardening',
    'rollback',
  ]) {
    assert(finalAcceptanceKeys.has(expectedCategory), `Expected final acceptance category ${expectedCategory}.`)
  }
  const runtimeGuardrailsCategory = finalAcceptancePayload.ledger.categories.find(
    (category: { key: string }) => category.key === 'runtime_guardrails',
  )
  assert(
    runtimeGuardrailsCategory &&
      runtimeGuardrailsCategory.passed === false &&
      runtimeGuardrailsCategory.missingEvidence.some((item: string) =>
        item.includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS'),
      ) &&
      runtimeGuardrailsCategory.missingEvidence.some((item: string) =>
        item.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES'),
      ) &&
      runtimeGuardrailsCategory.missingEvidence.some((item: string) =>
        item.includes('AGENTHUB_ALLOWED_WORKSTATION_TARGETS'),
      ) &&
      runtimeGuardrailsCategory.presentEvidence.some((item: string) =>
        item.includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH'),
      ),
    `Expected runtime guardrails category to block missing allowlists: ${JSON.stringify(runtimeGuardrailsCategory)}`,
  )
  const customerAuthorizationCategory = finalAcceptancePayload.ledger.categories.find(
    (category: { key: string }) => category.key === 'customer_authorization',
  )
  assert(
    customerAuthorizationCategory &&
      customerAuthorizationCategory.passed === false &&
      customerAuthorizationCategory.missingEvidence.length > 0 &&
      customerAuthorizationCategory.presentEvidence.some((item: string) =>
        item.includes(onsiteEvidencePayload.evidence.contentHash),
      ),
    `Expected customer authorization category to remain missing: ${JSON.stringify(customerAuthorizationCategory)}`,
  )
  assert(
    customerAuthorizationCategory.missingEvidence.some((item: string) =>
      item.includes('AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH'),
    ),
    `Expected customer authorization category to require evidence hash binding: ${JSON.stringify(customerAuthorizationCategory)}`,
  )
  const rollbackCategory = finalAcceptancePayload.ledger.categories.find(
    (category: { key: string; presentEvidence: string[] }) => category.key === 'rollback',
  )
  assert(
    rollbackCategory &&
      rollbackCategory.presentEvidence.some((item: string) => item.includes('sha256:')),
    `Expected rollback category to reference exported package hash: ${JSON.stringify(rollbackCategory)}`,
  )
  assert(
    finalAcceptancePayload.ledger.summary.requiredEvidenceItems > 0 &&
      finalAcceptancePayload.ledger.summary.evidenceItems > 0,
    `Expected final acceptance ledger to count required and present evidence: ${JSON.stringify(finalAcceptancePayload.ledger.summary)}`,
  )
  const onsiteIntakeDomains = new Set(
    onsiteIntakePayload.checklist.items.map((item: { domain: string }) => item.domain),
  )
  for (const expectedDomain of [
    'model_credentials',
    'network_routes',
    'desktop_control',
    'mobile_control',
    'workstations',
    'customer_authorization',
    'runtime_guardrails',
    'hardening',
    'go_live',
  ]) {
    assert(onsiteIntakeDomains.has(expectedDomain), `Expected onsite intake domain ${expectedDomain}.`)
  }
  assert(
    onsiteIntakePayload.checklist.redacted === true &&
      onsiteIntakePayload.checklist.summary.totalItems >= 9 &&
      onsiteIntakePayload.checklist.summary.missingFields >= 1,
    `Expected redacted onsite intake checklist with missing real-field work: ${JSON.stringify(onsiteIntakePayload.checklist.summary)}`,
  )
  const runtimeGuardrailIntake = onsiteIntakePayload.checklist.items.find(
    (item: { domain: string }) => item.domain === 'runtime_guardrails',
  )
  assert(
    runtimeGuardrailIntake &&
      runtimeGuardrailIntake.fields.some(
        (field: { key: string; valuePreview?: string | null }) =>
          field.key === 'runtime_kill_switch' &&
          String(field.valuePreview ?? '').includes('AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH'),
      ) &&
      runtimeGuardrailIntake.fields.some(
        (field: { key: string; valuePreview?: string | null; currentStatus: string }) =>
          field.key === 'model_endpoint_host_allowlist' &&
          field.currentStatus === 'ready' &&
          String(field.valuePreview ?? '').includes('AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS'),
      ) &&
      runtimeGuardrailIntake.fields.some(
        (field: { key: string; valuePreview?: string | null; currentStatus: string }) =>
          field.key === 'desktop_target_allowlist' &&
          field.currentStatus === 'missing' &&
          String(field.valuePreview ?? '').includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS'),
      ) &&
      runtimeGuardrailIntake.fields.some(
        (field: { key: string; valuePreview?: string | null; currentStatus: string }) =>
          field.key === 'mobile_device_allowlist' &&
          field.currentStatus === 'missing' &&
          String(field.valuePreview ?? '').includes('AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS'),
      ) &&
      runtimeGuardrailIntake.fields.some(
        (field: { key: string; valuePreview?: string | null; currentStatus: string }) =>
          field.key === 'mobile_app_package_allowlist' &&
          field.currentStatus === 'missing' &&
          String(field.valuePreview ?? '').includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES'),
      ) &&
      runtimeGuardrailIntake.fields.some(
        (field: { key: string; valuePreview?: string | null; currentStatus: string }) =>
          field.key === 'workstation_target_allowlist' &&
          field.currentStatus === 'missing' &&
          String(field.valuePreview ?? '').includes('AGENTHUB_ALLOWED_WORKSTATION_TARGETS'),
      ),
    `Expected onsite intake checklist to expose runtime guardrail fields: ${JSON.stringify(runtimeGuardrailIntake)}`,
  )
  assert(
    onsiteIntakePayload.checklist.items.some(
      (item: { fields: Array<{ key: string; instructions: string[] }> }) =>
        item.fields.some(
          (field) =>
            field.key === 'approved_go_live_hash' &&
            field.instructions.some((instruction) =>
              instruction.includes('AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH'),
            ),
        ),
    ),
    'Expected onsite intake checklist to expose approved go-live hash field.',
  )
  assert(
    onsiteIntakePayload.checklist.items.some(
      (item: { domain: string; fields: Array<{ key: string; valuePreview?: string | null; instructions: string[] }> }) =>
        item.domain === 'customer_authorization' &&
        item.fields.some(
          (field) =>
            field.key === 'customer_authorization_evidence_hash' &&
            String(field.valuePreview ?? '').includes('AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH') &&
            field.instructions.some((instruction) =>
              instruction.includes('AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH'),
            ),
        ),
    ),
    'Expected onsite intake checklist to expose customer authorization evidence hash field.',
  )
  assert(
    onsiteIntakePayload.checklist.safetyNotice.includes('API Key') &&
      onsiteIntakePayload.checklist.safetyNotice.includes('远程桌面密码'),
    `Expected onsite intake safety notice to forbid secrets: ${onsiteIntakePayload.checklist.safetyNotice}`,
  )
  assert(
    goLiveDecisionPayload.decision.decision === 'blocked' &&
      goLiveDecisionPayload.decision.canActivateLive === false,
    `Expected go-live decision to remain blocked: ${JSON.stringify(goLiveDecisionPayload.decision)}`,
  )
  assert(
    /^sha256:[a-f0-9]{64}$/.test(goLiveDecisionPayload.decision.contentHash),
    `Expected go-live decision hash: ${goLiveDecisionPayload.decision.contentHash}`,
  )
  assert(
    goLiveDecisionPayload.decision.approvedHashInstruction?.envVar ===
      'AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH' &&
      goLiveDecisionPayload.decision.approvedHashInstruction.requiredForLive === true &&
      goLiveDecisionPayload.decision.approvedHashInstruction.riskLevel === 'high' &&
      String(goLiveDecisionPayload.decision.approvedHashInstruction.powershellPreview).includes(
        'AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH',
      ),
    `Expected go-live decision to expose approved hash activation instruction: ${JSON.stringify(goLiveDecisionPayload.decision)}`,
  )
  assert(
    goLiveDecisionPayload.decision.blockedReasons.length > 0 &&
      goLiveDecisionPayload.decision.activationPlan.some(
        (item: { envVar: string }) => item.envVar === 'AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED',
      ),
    `Expected blocked go-live decision to include reasons and activation plan: ${JSON.stringify(goLiveDecisionPayload.decision)}`,
  )
  assert(
    goLiveDecisionPayload.decision.activationPlan.some(
      (item: { envVar: string; powershellPreview: string }) =>
        item.envVar === 'AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH' &&
        item.powershellPreview.includes('sha256:'),
    ),
    `Expected go-live decision activation plan to include customer authorization evidence hash: ${JSON.stringify(goLiveDecisionPayload.decision.activationPlan)}`,
  )
  assert(
    goLiveDecisionPayload.decision.blockedReasons.some((reason: string) =>
      reason.includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS'),
    ) &&
      goLiveDecisionPayload.decision.blockedReasons.some((reason: string) =>
        reason.includes('AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS'),
      ) &&
      goLiveDecisionPayload.decision.blockedReasons.some((reason: string) =>
        reason.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES'),
      ) &&
      goLiveDecisionPayload.decision.blockedReasons.some((reason: string) =>
        reason.includes('AGENTHUB_ALLOWED_WORKSTATION_TARGETS'),
      ),
    `Expected go-live decision to block missing runtime guardrails: ${JSON.stringify(goLiveDecisionPayload.decision.blockedReasons)}`,
  )
  assert(
    goLiveDecisionPayload.decision.activationPlan.some(
      (item: { envVar: string; riskLevel: string }) =>
        item.envVar === 'AGENTHUB_ENABLE_REAL_MODEL_CONNECTION' && item.riskLevel === 'medium',
    ),
    `Expected go-live decision activation plan to include real model connection gate: ${JSON.stringify(goLiveDecisionPayload.decision.activationPlan)}`,
  )
  assert(
    goLiveDecisionPayload.decision.activationPlan.some(
      (item: { envVar: string; powershellPreview: string; riskLevel: string }) =>
        item.envVar === 'AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH' &&
        item.riskLevel === 'high' &&
        item.powershellPreview.includes("AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH='0'"),
    ),
    `Expected go-live activation plan to keep runtime-control emergency stop off only when ready: ${JSON.stringify(goLiveDecisionPayload.decision.activationPlan)}`,
  )
  assert(
    goLiveDecisionPayload.decision.activationPlan.some(
      (item: { envVar: string; powershellPreview: string; riskLevel: string }) =>
        item.envVar === 'AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS' &&
        item.riskLevel === 'high' &&
        item.powershellPreview.includes('AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS'),
    ) &&
      goLiveDecisionPayload.decision.activationPlan.some(
        (item: { envVar: string; powershellPreview: string; riskLevel: string }) =>
        item.envVar === 'AGENTHUB_ALLOWED_DESKTOP_TARGETS' &&
        item.riskLevel === 'high' &&
        item.powershellPreview.includes('AGENTHUB_ALLOWED_DESKTOP_TARGETS'),
    ) &&
      goLiveDecisionPayload.decision.activationPlan.some(
        (item: { envVar: string; powershellPreview: string; riskLevel: string }) =>
          item.envVar === 'AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS' &&
          item.riskLevel === 'high' &&
          item.powershellPreview.includes('AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS'),
      ) &&
      goLiveDecisionPayload.decision.activationPlan.some(
        (item: { envVar: string; powershellPreview: string; riskLevel: string }) =>
          item.envVar === 'AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES' &&
          item.riskLevel === 'high' &&
          item.powershellPreview.includes('AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES'),
      ) &&
      goLiveDecisionPayload.decision.activationPlan.some(
        (item: { envVar: string; powershellPreview: string; riskLevel: string }) =>
          item.envVar === 'AGENTHUB_ALLOWED_WORKSTATION_TARGETS' &&
          item.riskLevel === 'high' &&
          item.powershellPreview.includes('AGENTHUB_ALLOWED_WORKSTATION_TARGETS'),
      ),
    `Expected go-live activation plan to include model, desktop, mobile device/app, and workstation allowlist guards: ${JSON.stringify(goLiveDecisionPayload.decision.activationPlan)}`,
  )
  assert(
    goLiveDecisionPayload.decision.ledgerSnapshot.latestEvidenceHash ===
      onsiteEvidencePayload.evidence.contentHash,
    'Expected go-live decision to snapshot latest onsite evidence hash.',
  )
  assert(
    goLiveDecisionPayload.decision.ledgerSnapshot.customerAuthorizationEvidenceHash === null &&
      goLiveDecisionPayload.decision.ledgerSnapshot.customerAuthorizationEvidenceMatched === false,
    `Expected blocked go-live decision to snapshot missing customer authorization binding: ${JSON.stringify(goLiveDecisionPayload.decision.ledgerSnapshot)}`,
  )
  assert(
    boundCustomerAuthorizationRealControlPayload.report.summary.customerAuthorized === true &&
      boundCustomerAuthorizationRealControlPayload.report.summary.customerAuthorizationSwitchEnabled === true &&
      boundCustomerAuthorizationRealControlPayload.report.summary.customerAuthorizationEvidenceHashPresent === true &&
      boundCustomerAuthorizationRealControlPayload.report.summary.customerAuthorizationEvidenceMatched === true,
    `Expected bound customer authorization to pass real-control evidence gate: ${JSON.stringify(boundCustomerAuthorizationRealControlPayload.report.summary)}`,
  )
  assert(
    boundCustomerAuthorizationLiveConnectorPayload.report.connectors.some(
      (connector: { kind: string; ready: boolean; evidence: string[] }) =>
        connector.kind === 'customer_authorization' &&
        connector.ready === true &&
        connector.evidence.some((item) => item.includes(onsiteEvidencePayload.evidence.contentHash)),
    ),
    'Expected bound customer authorization connector to be ready and reference evidence hash.',
  )
  assert(
    boundCustomerAuthorizationPreflightPayload.preflight.actions.some(
      (action: { id: string; requiredEnvVars: Array<{ envVar: string; enabled: boolean }> }) =>
        action.id === 'desktop_control' &&
        action.requiredEnvVars.some(
          (gate) => gate.envVar === 'AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH' && gate.enabled === true,
        ),
    ),
    'Expected bound execution preflight to enable customer authorization evidence hash gate.',
  )
  assert(
    boundCustomerAuthorizationDrillPayload.drill.summary.customerAuthorized === true &&
      boundCustomerAuthorizationDrillPayload.drill.scenarios.some(
        (scenario: { id: string; canPassNow: boolean }) =>
          scenario.id === 'customer_authorization' && scenario.canPassNow === true,
      ),
    `Expected bound go-live drill to pass customer authorization scenario: ${JSON.stringify(boundCustomerAuthorizationDrillPayload.drill.summary)}`,
  )
  assert(
    boundCustomerAuthorizationEnvironmentPayload.report.customerAuthorization.evidenceMatched === true &&
      boundCustomerAuthorizationEnvironmentPayload.report.checks.some(
        (check: { key: string; status: string }) =>
          check.key === 'customer_authorization' && check.status === 'ready',
      ),
    'Expected bound customer environment report to mark customer authorization ready.',
  )
  assert(
    boundCustomerAuthorizationFinalAcceptancePayload.ledger.categories.some(
      (category: { key: string; passed: boolean; presentEvidence: string[] }) =>
        category.key === 'customer_authorization' &&
        category.passed === true &&
        category.presentEvidence.some((item) => item.includes(onsiteEvidencePayload.evidence.contentHash)),
    ),
    'Expected bound final acceptance ledger to pass customer authorization category only after evidence hash matches.',
  )
  assert(
    boundCustomerAuthorizationFinalAcceptancePayload.ledger.summary.customerAuthorizationEvidenceHash ===
      onsiteEvidencePayload.evidence.contentHash &&
      boundCustomerAuthorizationFinalAcceptancePayload.ledger.summary.customerAuthorizationEvidenceMatched === true,
    `Expected bound final acceptance ledger summary to expose matched customer authorization evidence hash: ${JSON.stringify(boundCustomerAuthorizationFinalAcceptancePayload.ledger.summary)}`,
  )
  assert(
    blockedModelConnectionTest.status === 'failed' &&
      String(blockedModelConnectionTest.message).includes('AGENTHUB_ENABLE_REAL_MODEL_CONNECTION') &&
      blockedModelConnectionTest.capabilityChecks.modelConnectionGateAllowed === false,
    `Expected live model connection to be blocked without explicit env gate: ${JSON.stringify(blockedModelConnectionTest)}`,
  )
  assert(
    blockedModelEndpointAllowlistTest.status === 'failed' &&
      String(blockedModelEndpointAllowlistTest.message).includes('AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS') &&
      blockedModelEndpointAllowlistTest.capabilityChecks.modelEndpointAllowlistConfigured === false &&
      blockedModelEndpointAllowlistTest.capabilityChecks.modelEndpointAllowed === false &&
      blockedModelEndpointAllowlistTest.capabilityChecks.modelEndpointHost === 'example.invalid',
    `Expected live model connection to be blocked without approved endpoint host allowlist: ${JSON.stringify(blockedModelEndpointAllowlistTest.capabilityChecks)}`,
  )
  assert(modelTest.status === 'ok', `Expected vaulted live model test to pass, got ${modelTest.status}.`)
  assert(
    modelTest.capabilityChecks.modelEndpointAllowlistConfigured === true &&
      modelTest.capabilityChecks.modelEndpointAllowed === true &&
      modelTest.capabilityChecks.modelEndpointHost === 'example.invalid',
    `Expected model connection test to bind endpoint host allowlist metadata: ${JSON.stringify(modelTest.capabilityChecks)}`,
  )
  assert(
    modelTest.capabilityChecks.credentialSource === 'secret_vault',
    'Expected model connection test to report secret_vault credential source.',
  )
  assert(
    modelTest.capabilityChecks.credentialScopeStatus === 'allowed',
    'Expected model connection test to report allowed credential scope.',
  )
  assert(
    unscopedModelTest.status === 'failed' &&
      unscopedModelTest.capabilityChecks.credentialScopeStatus === 'blocked',
    `Expected unscoped model credential to be blocked: ${JSON.stringify(unscopedModelTest.capabilityChecks)}`,
  )
  assert(
    modelInvokeProbe.status === 'failed' &&
      String(modelInvokeProbe.message).includes('AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH'),
    `Expected vaulted live model invoke probe to be blocked by go-live hash gate, got ${modelInvokeProbe.status}: ${modelInvokeProbe.message}.`,
  )
  assert(
    modelInvokeProbe.capabilityChecks.capabilityProbeKind === 'json',
    'Expected model invoke probe to record json capability kind.',
  )
  assert(
    modelInvokeProbe.capabilityChecks.credentialSource === 'secret_vault',
    'Expected model invoke probe to report secret_vault credential source.',
  )
  assert(
    modelInvokeProbe.capabilityChecks.credentialScopeStatus === 'allowed',
    'Expected model invoke probe to report allowed credential scope.',
  )
  assert(
    modelInvokeProbe.capabilityChecks.goLiveRequired === true &&
      modelInvokeProbe.capabilityChecks.goLiveDecisionSatisfied === false &&
      modelInvokeProbe.capabilityChecks.goLiveCustomerAuthorized === false &&
      modelInvokeProbe.capabilityChecks.goLiveCustomerAuthorizationSwitchEnabled === false &&
      modelInvokeProbe.capabilityChecks.goLiveCustomerAuthorizationEvidenceHashRequired === true &&
      modelInvokeProbe.capabilityChecks.goLiveCustomerAuthorizationEvidenceMatched === false,
    `Expected model invoke probe to expose go-live hash enforcement metadata: ${JSON.stringify(modelInvokeProbe.capabilityChecks)}`,
  )
  assert(
    modelInvokeProbe.capabilityChecks.modelEndpointAllowed === true &&
      modelInvokeProbe.capabilityChecks.modelEndpointHost === 'example.invalid',
    `Expected OpenAI-compatible invoke probe to bind endpoint host allowlist metadata: ${JSON.stringify(modelInvokeProbe.capabilityChecks)}`,
  )
  assert(
    hardeningPayload.report.counts.modelCapabilityProbes >= 1,
    'Expected hardening report to count model capability probes.',
  )
  assert(
    hardeningPayload.report.counts.modelGatewayAuditLogs >= 1 &&
      hardeningPayload.report.counts.modelGatewayInvokeAuditLogs >= 1,
    `Expected hardening report to count model gateway audit logs: ${JSON.stringify(hardeningPayload.report.counts)}`,
  )
  assert(
    hardeningPayload.report.checks.some(
      (check: { key: string; status: string }) =>
        check.key === 'model_gateway_audit' && check.status === 'ready',
    ),
    'Expected hardening report to expose ready model gateway audit check.',
  )
  assert(
    googleModelInvokeProbe.status === 'failed' &&
      String(googleModelInvokeProbe.message).includes('AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH'),
    `Expected vaulted Gemini live model invoke probe to be blocked by go-live hash gate, got ${googleModelInvokeProbe.status}: ${googleModelInvokeProbe.message}.`,
  )
  assert(
    googleModelInvokeProbe.capabilityChecks.requestFamily === 'google_generate_content',
    `Expected Gemini invoke probe to use google_generate_content: ${JSON.stringify(googleModelInvokeProbe.capabilityChecks)}`,
  )
  assert(
    googleModelInvokeProbe.capabilityChecks.credentialScopeStatus === 'allowed',
    'Expected Gemini invoke probe to report allowed credential scope.',
  )
  assert(
    googleModelInvokeProbe.capabilityChecks.modelEndpointAllowed === true &&
      googleModelInvokeProbe.capabilityChecks.modelEndpointHost === 'generativelanguage.googleapis.com',
    `Expected Gemini invoke probe to bind endpoint host allowlist metadata: ${JSON.stringify(googleModelInvokeProbe.capabilityChecks)}`,
  )

  console.log(JSON.stringify({
    modelConnectionTestId: modelTest.id,
    blockedModelConnectionStatus: blockedModelConnectionTest.status,
    blockedModelEndpointAllowlistStatus: blockedModelEndpointAllowlistTest.status,
    modelEndpointHost: modelTest.capabilityChecks.modelEndpointHost,
    modelEndpointAllowed: modelTest.capabilityChecks.modelEndpointAllowed,
    unscopedModelConnectionTestId: unscopedModelTest.id,
    modelInvokeProbeId: modelInvokeProbe.id,
    googleModelInvokeProbeId: googleModelInvokeProbe.id,
    readiness: readinessPayload.readiness.status,
    readinessScore: readinessPayload.readiness.readinessScore,
    desktopStatus: desktopPayload.desktop.status,
    mobileStatus: mobilePayload.mobile.status,
    workstationProviderCount: workstationProvidersPayload.workstations.providers.length,
    reservationId: reservationPayload.workstation.id,
    employeeRunId: run.id,
    runtimeControlBlockedStatus: blockedRuntimeControlPayload.result.status,
    runtimeControlKillSwitchStatus: killSwitchRuntimeControlPayload.result.status,
    desktopScrollDryRunStatus: desktopScrollDryRunPayload.result.status,
    desktopTargetAllowlistBlocked: blockedDesktopTargetAllowlistPayload.result.gate.desktopTargetAllowed,
    desktopTargetAllowlistPassed: allowedDesktopTargetAllowlistPayload.result.gate.desktopTargetAllowed,
    desktopRuntimeApprovalTarget:
      approvedDesktopTargetPayload.result.output?.approvalInput?.desktopRuntimeTarget,
    desktopClickDryRunFocusTarget: desktopClickDryRunPayload.result.output?.desktopFocusTarget,
    desktopTextDryRunFocusTarget: desktopTextDryRunPayload.result.output?.desktopFocusTarget,
    desktopRuntimeApprovalInputHash: desktopRuntimeApprovalInputHash.slice(0, 18),
    mobileSwipeDryRunStatus: mobileSwipeDryRunPayload.result.status,
    desktopScreenshotDryRunRedacted:
      desktopScreenshotDryRunPayload.result.output?.plannedScreenshotPathRedacted,
    mobileScreenshotDryRunRedacted:
      mobileScreenshotDryRunPayload.result.output?.plannedScreenshotPathRedacted,
    workstationValidationStatus: workstationValidationPayload.result.status,
    workstationLaunchDryRunStatus: workstationLaunchDryRunPayload.result.status,
    workstationLaunchDryRunRdpRedacted:
      workstationLaunchDryRunPayload.result.output?.launchPlan?.rdpFilePathRedacted,
    workstationReleaseStatus: workstationReleasePayload.result.output?.workstationStatus,
    incompleteWorkstationValidationStatus: incompleteWorkstationValidationPayload.result.status,
    vncWorkstationLaunchPlan: vncWorkstationValidationPayload.result.output.launchPlan?.kind,
    vmWorkstationLaunchPlan: vmWorkstationValidationPayload.result.output.launchPlan?.kind,
    virtualboxCommandAvailable,
    virtualboxWorkstationValidationStatus: virtualboxWorkstationValidationPayload.result.status,
    rejectedWorkstationPathStatus: rejectedWorkstationPathResponse.status,
    rejectedRdpSecretStatus: rejectedRdpSecretResponse.status,
    rejectedVncSecretStatus: rejectedVncSecretResponse.status,
    mobileScreenshotBlockedStatus: blockedMobileScreenshotPayload.result.status,
    screenshotPathBoundaryStatus: blockedScreenshotPathPayload.result.status,
    goLiveRuntimeGateEnforced: approvedRuntimeControlPayload.result.gate.goLiveRequired,
    goLiveCustomerAuthorized: approvedRuntimeControlPayload.result.gate.goLiveCustomerAuthorized,
    approvedRuntimeControlGate: approvedRuntimeControlPayload.result.gate.approvalSatisfied,
    workstationTargetAllowlistBlocked: blockedWorkstationTargetAllowlistPayload.result.gate.workstationTargetAllowed,
    workstationTargetAllowlistPassed: approvedRuntimeControlPayload.result.gate.workstationTargetAllowed,
    workstationResolvedTargetMismatchStatus: workstationResolvedTargetMismatchPayload.status,
    legacyRuntimeApprovalStatus: legacyRuntimeControlPayload.result.status,
    runtimeApprovalReplayStatus: replayedRuntimeControlPayload.result.status,
    runtimeApprovalInputHash: runtimeApprovalInputHash.slice(0, 18),
    softwareCommandRunStatus: softwareRunPayload.softwareCommandRun.status,
    softwareApprovalBindingFreshApproval:
      mismatchedSoftwareApprovalPayload.softwareCommandRun.approvalRequestId !== softwareApprovalId,
    softwareApprovalBindingReachedRuntime:
      Boolean(boundSoftwareApprovalPayload.softwareCommandRun.output?.runtimeControlActionId),
    softwareApprovalReplayFreshApproval:
      replayedSoftwareApprovalPayload.softwareCommandRun.approvalRequestId !== softwareApprovalId,
    softwareRuntimeApprovalInputHash:
      softwareApprovalRuntimeControl?.approvalInputHash?.slice(0, 18),
    mobileSoftwareRuntimeGate: mobileSoftwareRunPayload.softwareCommandRun.output?.gate?.requiredEnvVar,
    mobileSwipeSoftwareRuntimeGate: mobileSwipeSoftwareRunPayload.softwareCommandRun.output?.gate?.requiredEnvVar,
    mobileDeviceAllowlistBlocked: blockedMobileDeviceAllowlistPayload.result.gate.mobileDeviceAllowed,
    mobileAppAllowlistBlocked: blockedMobileAppAllowlistPayload.result.gate.mobileAppAllowed,
    mobileDeviceAllowlistPassed: allowedMobileDeviceAllowlistPayload.result.gate.mobileDeviceAllowed,
    mobileAppAllowlistPassed: allowedMobileDeviceAllowlistPayload.result.gate.mobileAppAllowed,
    mobileRuntimeApprovalDevice:
      approvedMobileDevicePayload.result.output?.approvalInput?.mobileRuntimeDeviceId,
    mobileRuntimeApprovalApp:
      approvedMobileDevicePayload.result.output?.approvalInput?.mobileRuntimeAppPackage,
    mobileRuntimeApprovalInputHash: mobileRuntimeApprovalInputHash.slice(0, 18),
    runtimeMappedSoftwareCommands: hardeningPayload.report.counts.runtimeMappedSoftwareCommands,
    softwareCommandApprovals: hardeningPayload.report.counts.softwareCommandApprovals,
    approvalBoundSoftwareCommandApprovals:
      hardeningPayload.report.counts.approvalBoundSoftwareCommandApprovals,
    runtimeApprovalBoundSoftwareCommandApprovals:
      hardeningPayload.report.counts.runtimeApprovalBoundSoftwareCommandApprovals,
    approvedRuntimeControlApprovals: hardeningPayload.report.counts.approvedRuntimeControlApprovals,
    approvalBoundRuntimeControlApprovals:
      hardeningPayload.report.counts.approvalBoundRuntimeControlApprovals,
    runtimeControlActions: hardeningPayload.report.counts.runtimeControlActions,
    runtimeControlKillSwitchActions: hardeningPayload.report.counts.runtimeControlKillSwitchActions,
    desktopTargetAllowlistActions: hardeningPayload.report.counts.desktopTargetAllowlistActions,
    desktopTargetAllowlistBlockedActions: hardeningPayload.report.counts.desktopTargetAllowlistBlockedActions,
    desktopTargetAllowlistPassedActions: hardeningPayload.report.counts.desktopTargetAllowlistPassedActions,
    desktopInputFocusBoundActions: hardeningPayload.report.counts.desktopInputFocusBoundActions,
    desktopInputFocusMissingActions: hardeningPayload.report.counts.desktopInputFocusMissingActions,
    desktopPointerFocusBoundActions: hardeningPayload.report.counts.desktopPointerFocusBoundActions,
    desktopPointerFocusMissingActions: hardeningPayload.report.counts.desktopPointerFocusMissingActions,
    successfulWorkstationValidations: hardeningPayload.report.counts.successfulWorkstationValidations,
    blockedWorkstationValidations: hardeningPayload.report.counts.blockedWorkstationValidations,
    workstationReleaseActions: hardeningPayload.report.counts.workstationReleaseActions,
    staleRecoveryRecovered: staleRecoveryApplyPayload.recovery.recoveredIds.length,
    staleBusyWorkstations: hardeningPayload.report.counts.staleBusyWorkstations,
    recoverableStaleBusyWorkstations: hardeningPayload.report.counts.recoverableStaleBusyWorkstations,
    mobileScreenshotActions: hardeningPayload.report.counts.mobileScreenshotActions,
    redactedRuntimeFileOutputs: hardeningPayload.report.counts.redactedRuntimeFileOutputs,
    unredactedRuntimeFileOutputs: hardeningPayload.report.counts.unredactedRuntimeFileOutputs,
    mobileDeviceAllowlistActions: hardeningPayload.report.counts.mobileDeviceAllowlistActions,
    mobileDeviceAllowlistBlockedActions: hardeningPayload.report.counts.mobileDeviceAllowlistBlockedActions,
    mobileDeviceAllowlistPassedActions: hardeningPayload.report.counts.mobileDeviceAllowlistPassedActions,
    mobileAppAllowlistActions: hardeningPayload.report.counts.mobileAppAllowlistActions,
    mobileAppAllowlistBlockedActions: hardeningPayload.report.counts.mobileAppAllowlistBlockedActions,
    mobileAppAllowlistPassedActions: hardeningPayload.report.counts.mobileAppAllowlistPassedActions,
    workstationTargetAllowlistActions: hardeningPayload.report.counts.workstationTargetAllowlistActions,
    workstationTargetAllowlistBlockedActions: hardeningPayload.report.counts.workstationTargetAllowlistBlockedActions,
    workstationTargetAllowlistPassedActions: hardeningPayload.report.counts.workstationTargetAllowlistPassedActions,
    runtimeControlReadinessScore: runtimeReadinessPayload.runtimeControl.readinessScore,
    runtimeControlEnabledGates: runtimeReadinessPayload.runtimeControl.summary.enabledHighRiskGates,
    runtimeControlBlockedWorkstations: runtimeReadinessPayload.runtimeControl.summary.blockedWorkstations,
    executionPreflightScore: executionPreflightPayload.preflight.readinessScore,
    executionPreflightExecutableNow: executionPreflightPayload.preflight.summary.executableNow,
    executionPreflightLiveSafe: executionPreflightPayload.preflight.safeToExecuteAnyLiveAction,
    killSwitchPreflightLiveSafe: killSwitchExecutionPreflightPayload.preflight.safeToExecuteAnyLiveAction,
    goLiveDrillScore: goLiveDrillPayload.drill.readinessScore,
    goLiveDrillScenarios: goLiveDrillPayload.drill.summary.totalScenarios,
    goLiveDrillBlocked: goLiveDrillPayload.drill.summary.blockedScenarios,
    goLiveDrillNonInvasive: goLiveDrillPayload.drill.willTouchExternalSystems === false,
    livePilotLeaseStatus: livePilotLeasePayload.lease.status,
    livePilotLeaseDurationMinutes: livePilotLeasePayload.lease.durationMinutes,
    livePilotLeaseCanActivate: livePilotLeasePayload.lease.canActivateLivePilot,
    livePilotSessionTotal: livePilotSessionReportPayload.report.summary.total,
    livePilotSessionActive: livePilotSessionReportPayload.report.summary.active,
    livePilotSessionStopped: livePilotSessionReportPayload.report.summary.stopped,
    realControlScore: realControlPayload.report.readinessScore,
    realControlSafeToUseLiveControls: realControlPayload.report.safeToUseLiveControls,
    realControlBlockedActions: realControlPayload.report.summary.blockedActions,
    realControlBlockers: realControlPayload.report.blockers.length,
    liveConnectorScore: liveConnectorPayload.report.readinessScore,
    liveConnectorReady: liveConnectorPayload.report.summary.ready,
    liveConnectorTotal: liveConnectorPayload.report.summary.total,
    liveConnectorSafeToActivateLive: liveConnectorPayload.report.safeToActivateLive,
    modelCredentialIntakeReady: intakeReportAfterPayload.report.summary.vaultReadyModels,
    modelCredentialIntakeMigrated: intakeApplyPayload.result.applied,
    modelCredentialIntakeCreatedSecret: intakeApplyPayload.result.createdSecret,
    modelCredentialIntakeCreatedScopes: intakeApplyPayload.result.createdScopes.length,
    onsiteActivationScore: onsiteActivationPayload.guide.readinessScore,
    onsiteActivationDoneSteps: onsiteActivationPayload.guide.summary.doneSteps,
    onsiteActivationBlockedSteps: onsiteActivationPayload.guide.summary.blockedSteps,
    onsiteActivationSafeToActivateLive: onsiteActivationPayload.guide.safeToActivateLive,
    onsiteActivationPackageHash: onsiteActivationPackagePayload.package.contentHash,
    onsiteActivationMarkdown: onsiteActivationPackagePayload.package.files.markdownPath,
    onsiteActivationScript: onsiteActivationPackagePayload.package.files.activationScriptPath,
    onsiteRollbackScript: onsiteActivationPackagePayload.package.files.rollbackScriptPath,
    onsiteIntakeScore: onsiteIntakePayload.checklist.readinessScore,
    onsiteIntakeMissingFields: onsiteIntakePayload.checklist.summary.missingFields,
    onsiteIntakeItems: onsiteIntakePayload.checklist.summary.totalItems,
    setupGuideCompletionPercent: setupGuidePayload.setupGuide.completionPercent,
    setupGuideDone: setupGuidePayload.setupGuide.summary.done,
    setupGuideNeedsAction: setupGuidePayload.setupGuide.summary.needsAction,
    setupGuideBlocked: setupGuidePayload.setupGuide.summary.blocked,
    customerEnvironmentScore: customerEnvironmentPayload.report.readinessScore,
    customerSafeToRunLive: customerEnvironmentPayload.report.safeToRunLive,
    customerEnvironmentChecks: customerEnvironmentPayload.report.checks.length,
    customerEnvironmentPackageHash: customerEnvironmentPackagePayload.package.contentHash,
    customerEnvironmentMarkdown: customerEnvironmentPackagePayload.package.files.markdownPath,
    customerEnvironmentPreflightScript: customerEnvironmentPackagePayload.package.files.preflightScriptPath,
    customerEnvironmentRollbackScript: customerEnvironmentPackagePayload.package.files.rollbackScriptPath,
    packageIntegrityScore: packageIntegrityPayload.report.readinessScore,
    packageIntegrityReadyPackages: packageIntegrityPayload.report.summary.readyPackages,
    packageIntegrityBlockedPackages: packageIntegrityPayload.report.summary.blockedPackages,
    packageIntegrityLatestReadyHash: packageIntegrityPayload.report.summary.latestReadyPackageHash,
    rejectedSensitiveEvidenceStatus: rejectedSensitiveEvidenceResponse.status,
    onsiteEvidenceHash: onsiteEvidencePayload.evidence.contentHash,
    onsiteEvidenceTotal: onsiteEvidenceReportPayload.report.summary.total,
    finalAcceptanceScore: finalAcceptancePayload.ledger.readinessScore,
    finalAcceptanceCanClaimProductionReady: finalAcceptancePayload.ledger.canClaimProductionReady,
    finalAcceptancePassed: finalAcceptancePayload.ledger.summary.passed,
    finalAcceptanceBlocked: finalAcceptancePayload.ledger.summary.blocked,
    finalAcceptanceOnsiteEvidenceItems: finalAcceptancePayload.ledger.summary.onsiteEvidenceItems,
    goLiveDecision: goLiveDecisionPayload.decision.decision,
    goLiveDecisionHash: goLiveDecisionPayload.decision.contentHash,
    goLiveApprovedHashEnv: goLiveDecisionPayload.decision.approvedHashInstruction.envVar,
    goLiveBlockedReasons: goLiveDecisionPayload.decision.blockedReasons.length,
    successfulModelCapabilityProbes: hardeningPayload.report.counts.successfulModelCapabilityProbes,
    modelGatewayAuditLogs: hardeningPayload.report.counts.modelGatewayAuditLogs,
    modelGatewayInvokeAuditLogs: hardeningPayload.report.counts.modelGatewayInvokeAuditLogs,
    vaultMasterKeyStatus: vaultMasterKeyHardeningCheck.status,
    vaultMasterKeyRotationEvidence: objectContainsString(vaultMasterKeyHardeningCheck.evidence, 'vault key rotatedAt='),
    hardeningScore: hardeningPayload.report.readinessScore,
  }, null, 2))

  globalThis.fetch = previousFetch
  if (previousSmokeKey === undefined) delete process.env.AGENTHUB_SMOKE_MODEL_KEY
  else process.env.AGENTHUB_SMOKE_MODEL_KEY = previousSmokeKey
  if (previousSmokeIntakeKey === undefined) delete process.env[smokeIntakeEnvVar]
  else process.env[smokeIntakeEnvVar] = previousSmokeIntakeKey
  if (previousDesktopControl === undefined) delete process.env.AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL
  else process.env.AGENTHUB_ENABLE_REAL_DESKTOP_CONTROL = previousDesktopControl
  if (previousDesktopTargetAllowlist === undefined) delete process.env.AGENTHUB_ALLOWED_DESKTOP_TARGETS
  else process.env.AGENTHUB_ALLOWED_DESKTOP_TARGETS = previousDesktopTargetAllowlist
  if (previousRuntimeControlKillSwitch === undefined) delete process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH
  else process.env.AGENTHUB_RUNTIME_CONTROL_KILL_SWITCH = previousRuntimeControlKillSwitch
  if (previousMobileControl === undefined) delete process.env.AGENTHUB_ENABLE_REAL_MOBILE_CONTROL
  else process.env.AGENTHUB_ENABLE_REAL_MOBILE_CONTROL = previousMobileControl
  if (previousMobileCapture === undefined) delete process.env.AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE
  else process.env.AGENTHUB_ENABLE_REAL_MOBILE_CAPTURE = previousMobileCapture
  if (previousMobileDeviceAllowlist === undefined) delete process.env.AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS
  else process.env.AGENTHUB_ALLOWED_MOBILE_DEVICE_IDS = previousMobileDeviceAllowlist
  if (previousMobileAppAllowlist === undefined) delete process.env.AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES
  else process.env.AGENTHUB_ALLOWED_MOBILE_APP_PACKAGES = previousMobileAppAllowlist
  if (previousAdbPath === undefined) delete process.env.AGENTHUB_ADB_PATH
  else process.env.AGENTHUB_ADB_PATH = previousAdbPath
  if (previousAdbArgsPrefix === undefined) delete process.env.AGENTHUB_ADB_ARGS_PREFIX_JSON
  else process.env.AGENTHUB_ADB_ARGS_PREFIX_JSON = previousAdbArgsPrefix
  if (previousWorkstationLaunch === undefined) delete process.env.AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH
  else process.env.AGENTHUB_ENABLE_REAL_WORKSTATION_LAUNCH = previousWorkstationLaunch
  if (previousWorkstationTargetAllowlist === undefined) delete process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS
  else process.env.AGENTHUB_ALLOWED_WORKSTATION_TARGETS = previousWorkstationTargetAllowlist
  if (previousModelConnection === undefined) delete process.env.AGENTHUB_ENABLE_REAL_MODEL_CONNECTION
  else process.env.AGENTHUB_ENABLE_REAL_MODEL_CONNECTION = previousModelConnection
  if (previousModelInvocation === undefined) delete process.env.AGENTHUB_ENABLE_REAL_MODEL_INVOCATION
  else process.env.AGENTHUB_ENABLE_REAL_MODEL_INVOCATION = previousModelInvocation
  if (previousModelEndpointAllowlist === undefined) delete process.env.AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS
  else process.env.AGENTHUB_ALLOWED_MODEL_ENDPOINT_HOSTS = previousModelEndpointAllowlist
  if (previousCustomerAuthorized === undefined) delete process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED
  else process.env.AGENTHUB_CUSTOMER_ENVIRONMENT_AUTHORIZED = previousCustomerAuthorized
  if (previousCustomerAuthorizationEvidenceHash === undefined) delete process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH
  else process.env.AGENTHUB_CUSTOMER_AUTHORIZATION_EVIDENCE_HASH = previousCustomerAuthorizationEvidenceHash
  if (previousApprovedGoLiveHash === undefined) delete process.env.AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH
  else process.env.AGENTHUB_APPROVED_GO_LIVE_DECISION_HASH = previousApprovedGoLiveHash
  if (previousLivePilotLeaseHash === undefined) delete process.env.AGENTHUB_LIVE_PILOT_LEASE_HASH
  else process.env.AGENTHUB_LIVE_PILOT_LEASE_HASH = previousLivePilotLeaseHash
  if (previousVaultMasterKey === undefined) delete process.env.AGENTHUB_VAULT_MASTER_KEY
  else process.env.AGENTHUB_VAULT_MASTER_KEY = previousVaultMasterKey
  if (previousVaultMasterKeyId === undefined) delete process.env.AGENTHUB_VAULT_MASTER_KEY_ID
  else process.env.AGENTHUB_VAULT_MASTER_KEY_ID = previousVaultMasterKeyId
  if (previousVaultMasterKeyRotatedAt === undefined) delete process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATED_AT
  else process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATED_AT = previousVaultMasterKeyRotatedAt
  if (previousVaultMasterKeyRotationDays === undefined) delete process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATION_DAYS
  else process.env.AGENTHUB_VAULT_MASTER_KEY_ROTATION_DAYS = previousVaultMasterKeyRotationDays
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

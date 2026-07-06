import { createHash } from 'node:crypto'

import { asc, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentEnvironment,
  AgentProfileRow,
  AgentDiaryEntryRow,
  AuditLogRow,
  ArtifactValidationRow,
  BudgetEventRow,
  CliRunRow,
  ComputerActionEventRow,
  ComputerSessionRow,
  ContinuationPlanRow,
  DecisionAuditTrailRow,
  EmployeeRunEventRow,
  EmployeeRunEventType,
  EmployeeRunRow,
  JsonObject,
  LearningEventRow,
  MemoryItemRow,
  MultimodalInputRow,
  MultimodalOutputRow,
  RecoveryEventRow,
  RunReflectionRow,
  RuntimeContextSnapshotRow,
} from '@/db/schema'
import {
  getRunReflection,
  compileRuntimeMemoryContextPack,
  listMemoryForRun,
  reflectAndLearn,
  retrieveRelevantMemories,
  type RetrievedMemory,
} from '@/server/agent-memory-service'
import { buildAgentEnvironment } from '@/server/agent-environment-service'
import {
  listAgentDiaryEntries,
  listContinuationPlans,
  recordRunContinuity,
} from '@/server/agent-continuity-service'
import {
  listCliRunsForEmployeeRun,
  runCliProfilesForEmployeeRun,
} from '@/server/cli-runner-service'
import {
  completeComputerSession,
  listComputerActionEventsForEmployeeRun,
  listComputerSessionsForEmployeeRun,
  recordComputerActionEvent,
  startComputerSessionForEmployeeRun,
} from '@/server/computer-session-manager'
import {
  listLearningEventsForRun,
  proposeLearningEventFromReflection,
} from '@/server/learning-service'
import { revokeDynamicPermissionsForCompletedRun } from '@/server/dynamic-permission-service'
import { assertCanStartNewAgentTask } from '@/server/maintenance-service'
import { recordMetricPoint } from '@/server/observability-service'
import {
  listMultimodalInputsForRun,
  listMultimodalOutputsForRun,
  materializeRunMultimodalIO,
} from '@/server/multimodal-io-service'
import {
  createRuntimeContextSnapshot,
  listRuntimeContextSnapshotsForRun,
} from '@/server/prompt-context-service'
import { listRecoveryEvents, recordRecoveryEvent } from '@/server/recovery-service'
import { executeRuntimeControlAction } from '@/server/runtime-control-service'
import { listAuditLogsForResource, recordAuditLog } from '@/server/security-service'
import {
  listArtifactValidationsForRun,
  validateEmployeeRunArtifactContract,
} from '@/server/verification-service'
import {
  newBudgetEventId,
  newDecisionAuditTrailId,
  newEmployeeRunEventId,
  newEmployeeRunId,
  newRuntimeCheckpointId,
} from '@/server/ids'

export interface StartEmployeeRunArgs {
  agentProfileId: string
  goal: string
  input?: JsonObject
  workflowRunId?: string | null
  budgetLimitCents?: number | null
  autoComplete?: boolean
}

export interface EmployeeRunSnapshot {
  run: EmployeeRunRow
  events: EmployeeRunEventRow[]
  cliRuns: CliRunRow[]
  computerSessions: ComputerSessionRow[]
  computerActionEvents: ComputerActionEventRow[]
  contextSnapshots: RuntimeContextSnapshotRow[]
  budgetEvents: BudgetEventRow[]
  decisionAuditTrails: DecisionAuditTrailRow[]
  securityAuditLogs: AuditLogRow[]
  recoveryEvents: RecoveryEventRow[]
  artifactValidations: ArtifactValidationRow[]
  multimodalInputs: MultimodalInputRow[]
  multimodalOutputs: MultimodalOutputRow[]
  learningEvents: LearningEventRow[]
  memoryItems: MemoryItemRow[]
  diaryEntries: AgentDiaryEntryRow[]
  continuationPlans: ContinuationPlanRow[]
  reflection: RunReflectionRow | null
}

const RUNTIME_PHASES = [
  'understand_goal',
  'retrieve_memory',
  'create_plan',
  'verify_output_contract',
  'checkpoint_ready_state',
] as const

export interface RuntimeLoopStepTrace {
  stepIndex: number
  phase: (typeof RUNTIME_PHASES)[number]
  observation: string
  decision: string
  selectedAction: string
  verification: string
  nextStep: string | null
  status: 'completed' | 'blocked'
  recoveryPlan: string[]
  evidence: JsonObject
}

export interface RuntimeNextAction {
  action: 'handoff_to_executor' | 'request_approval' | 'review_artifact' | 'fix_profile'
  target: string
  reason: string
  requiresUser: boolean
}

interface RuntimeContext {
  retrievedMemories: RetrievedMemory[]
  computerSession: ComputerSessionRow | null
  loopTrace: RuntimeLoopStepTrace[]
  runtimeControlActionIds: string[]
}

export async function startEmployeeRun(args: StartEmployeeRunArgs): Promise<EmployeeRunRow> {
  await assertCanStartNewAgentTask()
  const agent = await getAgentProfile(args.agentProfileId)
  const now = Date.now()
  const plan = buildDeterministicPlan(agent, args.goal)
  const estimatedCostCents = estimateRuntimeCostCents(plan)

  const run: EmployeeRunRow = {
    id: newEmployeeRunId(),
    agentProfileId: agent.id,
    workflowRunId: normalizeNullable(args.workflowRunId),
    goal: args.goal.trim(),
    input: args.input ?? {},
    plan,
    status: 'queued',
    currentPhase: 'queued',
    currentStep: null,
    output: null,
    error: null,
    budgetLimitCents: args.budgetLimitCents ?? null,
    estimatedCostCents,
    actualCostCents: 0,
    createdAt: now,
    startedAt: null,
    updatedAt: now,
    finishedAt: null,
  }

  await db.insert(schema.employeeRuns).values(run)
  await recordEmployeeEvent(run.id, 'status', 'queued', 'Employee run was queued.', {
    agentProfileId: agent.id,
    goal: run.goal,
  })
  await recordAuditLog({
    actorType: 'agent',
    actorId: agent.id,
    action: 'employee_run.queue',
    resourceType: 'employee_run',
    resourceId: run.id,
    status: 'allowed',
    riskLevel: 'low',
    message: 'Employee run was queued with scoped Agent profile permissions.',
    metadata: {
      agentProfileId: agent.id,
      workflowRunId: run.workflowRunId,
      budgetLimitCents: run.budgetLimitCents,
    },
  })
  await recordBudgetEvent(run.id, 'estimate', estimatedCostCents, 'Estimated deterministic runtime overhead.')

  if (args.budgetLimitCents !== undefined && args.budgetLimitCents !== null) {
    if (estimatedCostCents > args.budgetLimitCents) {
      return failEmployeeRun(
        run.id,
        `Estimated runtime cost ${estimatedCostCents}c exceeds budget ${args.budgetLimitCents}c.`,
      )
    }
  }

  if (args.autoComplete === false) return getRequiredEmployeeRun(run.id)
  return executeEmployeeRun(run.id)
}

export async function executeEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const run = await getRequiredEmployeeRun(runId)
  if (run.status === 'complete') return run
  if (run.status === 'aborted') throw new Error(`Employee run is aborted: ${runId}`)
  if (run.status === 'failed') throw new Error(`Employee run is failed: ${runId}`)

  const agent = await getAgentProfile(run.agentProfileId)
  const startedAt = run.startedAt ?? Date.now()
  await updateRun(runId, {
    status: 'running',
    currentPhase: 'understand_goal',
    currentStep: 'Understanding goal and constraints',
    startedAt,
  })
  await recordEmployeeEvent(runId, 'status', 'running', 'Employee runtime started.', {
    startedAt,
  })

  const activeRun = await getRequiredEmployeeRun(runId)
  const context: RuntimeContext = {
    retrievedMemories: [],
    computerSession: await startComputerSessionForEmployeeRun({ run: activeRun, agent }),
    loopTrace: [],
    runtimeControlActionIds: [],
  }
  const runtimeEnvironment = await buildAgentEnvironment({
    agentProfileId: agent.id,
    employeeRunId: runId,
  })
  const runtimeEnvironmentSummary = summarizeRuntimeEnvironmentForEvent(
    runtimeEnvironment,
    context.computerSession,
  )
  await recordEmployeeEvent(
    runId,
    'phase',
    'runtime_environment',
    'Agent runtime workstation environment was prepared.',
    runtimeEnvironmentSummary,
  )
  for (let index = 0; index < RUNTIME_PHASES.length; index++) {
    const phase = RUNTIME_PHASES[index]
    await runPhase(runId, agent, run, phase, index, context)
  }
  await primeRuntimeControlAdapters(runId, agent, context)

  const contextSnapshot = await createRuntimeContextSnapshot({
    run: await getRequiredEmployeeRun(runId),
    agent,
    retrievedMemories: context.retrievedMemories,
  })
  await recordEmployeeEvent(
    runId,
    'phase',
    'context_snapshot',
    'Prompt template and visible runtime context snapshot were saved.',
    {
      contextSnapshotId: contextSnapshot.id,
      promptTemplateId: contextSnapshot.promptTemplateId,
      promptTemplateVersionId: contextSnapshot.promptTemplateVersionId,
      tokenBudget: contextSnapshot.tokenBudget,
      tokenEstimate: contextSnapshot.tokenEstimate,
    },
  )

  const cliRuns = await runCliProfilesForEmployeeRun({
    employeeRun: await getRequiredEmployeeRun(runId),
    agent,
  })
  if (cliRuns.length > 0) {
    await recordEmployeeEvent(runId, 'phase', 'cli_dry_run', 'Configured CLI profiles were rendered as safe dry-runs.', {
      cliRunIds: cliRuns.map((row) => row.id),
      blockedCliRunIds: cliRuns.filter((row) => row.status === 'blocked').map((row) => row.id),
    })
  }

  const output: JsonObject = {
    status: 'ready_for_executor',
    agentProfileId: agent.id,
    requiredArtifact: agent.outputContract,
    retrievedMemoryIds: context.retrievedMemories.map(({ item }) => item.id),
    contextSnapshotId: contextSnapshot.id,
    promptTemplateVersionId: contextSnapshot.promptTemplateVersionId,
    runtimeEnvironment: runtimeEnvironmentSummary,
    cliRunIds: cliRuns.map((row) => row.id),
    runtimeControlActionIds: context.runtimeControlActionIds,
    loopTrace: context.loopTrace,
    nextRuntimeAction: decideNextRuntimeAction(agent, cliRuns),
    recoveryPlan: [],
    nextExecutor: 'model_or_cli_adapter',
    note: 'Deterministic employee runtime lifecycle completed without live model/tool execution.',
  }
  const multimodalSummary = await materializeRunMultimodalIO({
    run: await getRequiredEmployeeRun(runId),
    agent,
    output,
  })
  output.multimodal = multimodalSummary
  await recordEmployeeEvent(runId, 'phase', 'multimodal_io', 'Multimodal input/output registry updated.', {
    inputKinds: multimodalSummary.inputKinds,
    outputKinds: multimodalSummary.outputKinds,
    rejectedInputIds: multimodalSummary.rejectedInputIds,
    rejectedOutputIds: multimodalSummary.rejectedOutputIds,
  })
  const finishedAt = Date.now()
  await updateRun(runId, {
    status: 'complete',
    currentPhase: 'complete',
    currentStep: 'Runtime lifecycle complete',
    output,
    actualCostCents: estimateRuntimeCostCents(run.plan),
    finishedAt,
  })
  await recordEmployeeEvent(runId, 'status', 'complete', 'Employee runtime completed.', output)
  await recordMetricPoint({
    metricName: 'employee_run.duration_ms',
    value: Math.max(0, finishedAt - startedAt),
    unit: 'ms',
    resourceType: 'employee_run',
    resourceId: runId,
    tags: {
      agentProfileId: agent.id,
      status: 'complete',
      workflowRunId: run.workflowRunId,
    },
  })
  await recordMetricPoint({
    metricName: 'employee_run.cost_cents',
    value: estimateRuntimeCostCents(run.plan),
    unit: 'cents',
    resourceType: 'employee_run',
    resourceId: runId,
    tags: {
      agentProfileId: agent.id,
      status: 'complete',
    },
  })
  await recordAuditLog({
    actorType: 'agent',
    actorId: agent.id,
    action: 'employee_run.complete',
    resourceType: 'employee_run',
    resourceId: runId,
    status: 'allowed',
    riskLevel: 'low',
    message: 'Employee run completed deterministic lifecycle.',
    metadata: output,
  })
  if (context.computerSession) {
    await recordComputerActionEvent({
      session: context.computerSession,
      actionType: 'verify_runtime_output',
      target: getString(agent.outputContract, 'artifactType') ?? 'artifact',
      input: { dryRun: true, outputContract: agent.outputContract },
      output: { outputStatus: output.status },
      status: 'complete',
    })
    await completeComputerSession(context.computerSession.id, 'complete')
  }
  await revokeDynamicPermissionsForCompletedRun(runId)

  const completedRun = await getRequiredEmployeeRun(runId)
  const artifactValidation = await validateEmployeeRunArtifactContract({
    run: completedRun,
    agent,
    output,
  })
  await recordEmployeeEvent(runId, 'verification', 'artifact_validation', 'Output contract validation completed.', {
    artifactValidationId: artifactValidation.id,
    status: artifactValidation.status,
  })

  const learning = await reflectAndLearn({
    run: completedRun,
    agent,
    retrievedMemories: context.retrievedMemories,
  })
  const learningProposal = await proposeLearningEventFromReflection({
    reflection: learning.reflection,
    agent,
  })
  await recordEmployeeEvent(runId, 'phase', 'reflect_and_learn', 'Runtime reflection and memory write completed.', {
    reflectionId: learning.reflection?.id ?? null,
    memoryItemId: learning.memoryItem?.id ?? null,
    learningEventId: learningProposal.learningEvent?.id ?? null,
    memoryEvolution: learning.memoryEvolution
      ? {
          updateCount: learning.memoryEvolution.memoryUpdates.length,
          newMemoryCount: learning.memoryEvolution.newMemories.length,
          hasPlaybookDraft: Boolean(learning.memoryEvolution.playbookDraft),
          approvalRequests: learning.memoryEvolution.approvalRequests,
        }
      : null,
  })
  const continuity = await recordRunContinuity({
    run: completedRun,
    agent,
    reflection: learning.reflection,
    artifactValidation,
    learningEvent: learningProposal.learningEvent,
  })
  await recordEmployeeEvent(runId, 'phase', 'continuity_saved', 'Agent diary and continuation plan were saved.', {
    diaryEntryId: continuity.diaryEntry.id,
    continuationPlanId: continuity.continuationPlan.id,
  })
  return getRequiredEmployeeRun(runId)
}

async function runPhase(
  runId: string,
  agent: AgentProfileRow,
  run: EmployeeRunRow,
  phase: (typeof RUNTIME_PHASES)[number],
  stepIndex: number,
  context: RuntimeContext,
): Promise<void> {
  const messageByPhase: Record<typeof phase, string> = {
    understand_goal: 'Goal, role, autonomy, and permissions were normalized.',
    retrieve_memory: 'Relevant memory scopes were inspected for future retrieval.',
    create_plan: 'A deterministic execution plan was derived from the Agent profile.',
    verify_output_contract: 'Output contract was checked before execution.',
    checkpoint_ready_state: 'A resumable checkpoint was written.',
  }
  const message = messageByPhase[phase]
  const payload: JsonObject = {
    agentProfileId: agent.id,
    role: agent.role,
    persona: agent.persona,
    personaDecisionStyle: personaDecisionStyle(agent.persona as unknown as JsonObject),
    outputContract: agent.outputContract,
    retrievedMemoryIds: context.retrievedMemories.map(({ item }) => item.id),
  }

  if (phase === 'retrieve_memory') {
    context.retrievedMemories = await retrieveRelevantMemories({
      agent,
      goal: run.goal,
      input: run.input,
    })
    payload.retrievedMemoryIds = context.retrievedMemories.map(({ item }) => item.id)
    payload.retrievedMemoryTitles = context.retrievedMemories.map(({ item }) => item.title)
    payload.retrievedMemoryScores = context.retrievedMemories.map(({ score }) => score)
    payload.memoryContextPack = compileRuntimeMemoryContextPack({
      agent,
      goal: run.goal,
      input: run.input,
      retrievedMemories: context.retrievedMemories,
    }) as unknown as JsonObject
  }

  if (phase === 'verify_output_contract' && Object.keys(agent.outputContract).length === 0) {
    const blockedTrace = buildRuntimeLoopStepTrace({
      agent,
      run,
      phase,
      stepIndex,
      context,
      status: 'blocked',
      blocker: 'Agent profile outputContract is required before execution.',
    })
    context.loopTrace.push(blockedTrace)
    payload.loopTrace = blockedTrace
    await updateRun(runId, {
      currentPhase: phase,
      currentStep: message,
    })
    await recordEmployeeEvent(runId, 'phase', phase, message, payload)
    await recordDecisionAudit(runId, phase, payload, message, `Runtime phase ${phase} blocked before execution.`)
    await failEmployeeRun(runId, 'Agent profile outputContract is required before execution.', {
      loopTrace: blockedTrace as unknown as JsonObject,
      recoveryPlan: blockedTrace.recoveryPlan,
    })
    throw new Error('Agent profile outputContract is required before execution.')
  }

  const loopTrace = buildRuntimeLoopStepTrace({
    agent,
    run,
    phase,
    stepIndex,
    context,
    status: 'completed',
  })
  context.loopTrace.push(loopTrace)
  payload.loopTrace = loopTrace

  await updateRun(runId, {
    currentPhase: phase,
    currentStep: message,
  })
  await recordEmployeeEvent(runId, 'phase', phase, message, payload)
  await recordDecisionAudit(runId, phase, payload, message, `Runtime phase ${phase} completed.`)

  if (phase === 'checkpoint_ready_state') {
    await createRuntimeCheckpoint(runId, stepIndex, phase, payload, message)
    await recordEmployeeEvent(runId, 'checkpoint', phase, 'Runtime checkpoint saved.', {
      stepIndex,
    })
  }

  if (context.computerSession) {
    await recordComputerActionEvent({
      session: context.computerSession,
      actionType: 'runtime_phase',
      target: phase,
      input: { dryRun: true, stepIndex },
      output: { message },
      status: 'complete',
    })
  }
}

async function primeRuntimeControlAdapters(
  runId: string,
  agent: AgentProfileRow,
  context: RuntimeContext,
): Promise<void> {
  if (!context.computerSession) return
  const actions: Array<{
    scope: 'desktop' | 'mobile' | 'workstation'
    actionType: 'observe_windows' | 'list_devices' | 'validate_workstation'
    target?: string
    input?: JsonObject
  }> = []
  const canUseDesktop =
    getBooleanPath(agent.permissionPolicy, ['desktop', 'operate']) ||
    getString(agent.workstationPolicy, 'mode') === 'physical_desktop'
  const canUseMobile =
    getBooleanPath(agent.permissionPolicy, ['mobile', 'operate']) ||
    getBooleanPath(agent.permissionPolicy, ['mobileDevice', 'operate'])
  const workstationMode = getString(agent.workstationPolicy, 'mode')

  if (canUseDesktop) {
    actions.push({ scope: 'desktop', actionType: 'observe_windows' })
  }
  if (canUseMobile) {
    actions.push({ scope: 'mobile', actionType: 'list_devices' })
  }
  if (
    workstationMode === 'remote_session' ||
    workstationMode === 'vm' ||
    workstationMode === 'virtual_desktop'
  ) {
    const workstation = await db.query.agentWorkstations.findFirst({
      where: eq(schema.agentWorkstations.agentProfileId, agent.id),
    })
    if (workstation) {
      actions.push({
        scope: 'workstation',
        actionType: 'validate_workstation',
        target: workstation.id,
        input: { workstationId: workstation.id },
      })
    }
  }

  if (actions.length === 0) return
  const results = []
  for (const action of actions) {
    const result = await executeRuntimeControlAction({
      computerSessionId: context.computerSession.id,
      scope: action.scope,
      actionType: action.actionType,
      target: action.target,
      input: action.input,
      live: true,
      confirmRisk: false,
    })
    context.runtimeControlActionIds.push(result.action.id)
    results.push({
      actionEventId: result.action.id,
      scope: action.scope,
      actionType: action.actionType,
      status: result.status,
      liveExecuted: result.liveExecuted,
      gate: result.gate as unknown as JsonObject,
    })
  }
  await recordEmployeeEvent(
    runId,
    'phase',
    'runtime_control_adapters',
    'Runtime control adapters were primed with safe read-only probes.',
    {
      results: results as unknown as JsonObject[],
    },
  )
}

function buildRuntimeLoopStepTrace(args: {
  agent: AgentProfileRow
  run: EmployeeRunRow
  phase: (typeof RUNTIME_PHASES)[number]
  stepIndex: number
  context: RuntimeContext
  status: RuntimeLoopStepTrace['status']
  blocker?: string
}): RuntimeLoopStepTrace {
  const nextPhase = RUNTIME_PHASES[args.stepIndex + 1] ?? null
  const outputArtifactType = getString(args.agent.outputContract, 'artifactType') ?? 'unspecified_artifact'
  const memoryCount = args.context.retrievedMemories.length
  const phaseDetails: Record<(typeof RUNTIME_PHASES)[number], {
    observation: string
    decision: string
    selectedAction: string
    verification: string
  }> = {
    understand_goal: {
      observation: `Goal "${args.run.goal}" was received for role "${args.agent.role}".`,
      decision: 'Normalize goal, role, persona, permissions, and output requirements before taking action.',
      selectedAction: 'understand_goal',
      verification: args.run.goal.trim().length > 0 && args.agent.role.trim().length > 0
        ? 'Goal and role are present.'
        : 'Goal or role is missing.',
    },
    retrieve_memory: {
      observation: `${memoryCount} relevant memories are available for this run.`,
      decision: memoryCount > 0
        ? 'Use retrieved memory to bias planning and avoid repeated mistakes.'
        : 'Continue with profile and task context because no relevant memory was found.',
      selectedAction: 'retrieve_relevant_memory',
      verification: `Retrieved memory ids: ${args.context.retrievedMemories.map(({ item }) => item.id).join(', ') || 'none'}.`,
    },
    create_plan: {
      observation: `${args.run.plan.length} deterministic plan steps are available.`,
      decision: `Create a plan that produces ${outputArtifactType} and preserves verification before tool execution.`,
      selectedAction: 'create_execution_plan',
      verification: args.run.plan.length > 0 ? 'Plan contains executable steps.' : 'Plan is empty.',
    },
    verify_output_contract: {
      observation: `Output contract keys: ${Object.keys(args.agent.outputContract).join(', ') || 'none'}.`,
      decision: args.blocker
        ? 'Block execution until the Agent has a deterministic output contract.'
        : 'Allow runtime to continue because output contract metadata exists.',
      selectedAction: 'verify_output_contract',
      verification: args.blocker ?? `Artifact type is ${outputArtifactType}.`,
    },
    checkpoint_ready_state: {
      observation: 'Current run state is ready to persist as a resumable checkpoint.',
      decision: 'Persist checkpoint before handing off to model/tool execution.',
      selectedAction: 'persist_runtime_checkpoint',
      verification: 'Checkpoint event will be written with phase state and recovery metadata.',
    },
  }
  const details = phaseDetails[args.phase]
  return {
    stepIndex: args.stepIndex,
    phase: args.phase,
    observation: details.observation,
    decision: details.decision,
    selectedAction: details.selectedAction,
    verification: details.verification,
    nextStep: nextPhase,
    status: args.status,
    recoveryPlan: args.status === 'blocked'
      ? buildRuntimeRecoveryPlan(args.blocker ?? 'Runtime phase blocked.')
      : [],
    evidence: {
      agentProfileId: args.agent.id,
      employeeRunId: args.run.id,
      outputArtifactType,
      retrievedMemoryCount: memoryCount,
      planStepCount: args.run.plan.length,
      nextPhase,
    },
  }
}

function decideNextRuntimeAction(agent: AgentProfileRow, cliRuns: CliRunRow[]): RuntimeNextAction {
  const blockedCliRuns = cliRuns.filter((row) => row.status === 'blocked')
  if (Object.keys(agent.outputContract).length === 0) {
    return {
      action: 'fix_profile',
      target: 'agent_profile.outputContract',
      reason: 'Agent output contract is missing.',
      requiresUser: true,
    }
  }
  if (blockedCliRuns.length > 0) {
    return {
      action: 'request_approval',
      target: blockedCliRuns.map((row) => row.id).join(','),
      reason: 'At least one configured CLI run requires approval before execution.',
      requiresUser: true,
    }
  }
  if (cliRuns.length > 0) {
    return {
      action: 'review_artifact',
      target: cliRuns.map((row) => row.id).join(','),
      reason: 'CLI dry-runs are rendered and ready for review or approved execution.',
      requiresUser: false,
    }
  }
  return {
    action: 'handoff_to_executor',
    target: 'model_or_cli_adapter',
    reason: 'Runtime lifecycle, context snapshot, checkpoint, and contract validation are ready.',
    requiresUser: false,
  }
}

function buildRuntimeRecoveryPlan(error: string): string[] {
  if (error.toLowerCase().includes('outputcontract')) {
    return [
      'Open Agent Factory and define outputContract.artifactType.',
      'Add requiredFiles and validationRules for the expected artifact.',
      'Resume or restart the employee run after profile validation passes.',
    ]
  }
  if (error.toLowerCase().includes('budget')) {
    return [
      'Review estimated runtime cost and configured budget limit.',
      'Reduce requested scope or increase the explicit budget.',
      'Restart the run with the updated budget policy.',
    ]
  }
  return [
    'Inspect the latest employee-run event and decision audit trail.',
    'Fix the profile, permission, resource, or input blocker described by the error.',
    'Resume from the latest checkpoint when available, otherwise restart the run.',
  ]
}

function personaDecisionStyle(persona: JsonObject): JsonObject {
  const traits = isJsonObject(persona.personalityTraits) ? persona.personalityTraits : {}
  const cautious = readNumber(traits.cautious, 0.6)
  const creative = readNumber(traits.creative, 0.4)
  const thorough = readNumber(traits.thorough, 0.7)
  const efficient = readNumber(traits.efficient, 0.6)
  return {
    riskTolerance: cautious >= 0.7 ? 'low' : cautious <= 0.35 ? 'high' : 'balanced',
    explorationMode: creative >= 0.65 ? 'broad_options' : 'focused_path',
    verificationDepth: thorough >= 0.75 ? 'deep' : 'standard',
    pacing: efficient >= 0.75 ? 'fast_iteration' : 'deliberate',
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export async function getEmployeeRunSnapshot(runId: string): Promise<EmployeeRunSnapshot> {
  return {
    run: await getRequiredEmployeeRun(runId),
    events: await listEmployeeRunEvents(runId),
    cliRuns: await listCliRunsForEmployeeRun(runId),
    computerSessions: await listComputerSessionsForEmployeeRun(runId),
    computerActionEvents: await listComputerActionEventsForEmployeeRun(runId),
    contextSnapshots: await listRuntimeContextSnapshotsForRun(runId),
    budgetEvents: await listBudgetEvents(runId),
    decisionAuditTrails: await listDecisionAuditTrails(runId),
    securityAuditLogs: await listAuditLogsForResource('employee_run', runId),
    recoveryEvents: await listRecoveryEvents({ resourceType: 'employee_run', resourceId: runId }),
    artifactValidations: await listArtifactValidationsForRun(runId),
    multimodalInputs: await listMultimodalInputsForRun(runId),
    multimodalOutputs: await listMultimodalOutputsForRun(runId),
    learningEvents: await listLearningEventsForRun(runId),
    memoryItems: await listMemoryForRun(runId),
    diaryEntries: await listAgentDiaryEntries({ employeeRunId: runId }),
    continuationPlans: await listContinuationPlans({ sourceRunId: runId }),
    reflection: await getRunReflection(runId),
  }
}

export async function listEmployeeRunEvents(runId: string): Promise<EmployeeRunEventRow[]> {
  return db.query.employeeRunEvents.findMany({
    where: eq(schema.employeeRunEvents.employeeRunId, runId),
    orderBy: [asc(schema.employeeRunEvents.createdAt)],
  })
}

export async function listBudgetEvents(runId: string): Promise<BudgetEventRow[]> {
  return db.query.budgetEvents.findMany({
    where: eq(schema.budgetEvents.employeeRunId, runId),
    orderBy: [asc(schema.budgetEvents.createdAt)],
  })
}

export async function listDecisionAuditTrails(runId: string): Promise<DecisionAuditTrailRow[]> {
  return db.query.decisionAuditTrails.findMany({
    where: eq(schema.decisionAuditTrails.employeeRunId, runId),
    orderBy: [asc(schema.decisionAuditTrails.createdAt)],
  })
}

export async function pauseEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const run = await getRequiredEmployeeRun(runId)
  if (!['queued', 'running'].includes(run.status)) {
    throw new Error(`Only queued or running employee runs can be paused; current status is ${run.status}.`)
  }
  await updateRun(runId, {
    status: 'paused',
    currentPhase: 'paused',
    currentStep: 'Paused by user',
  })
  await recordEmployeeEvent(runId, 'status', 'paused', 'Employee run paused by user.')
  return getRequiredEmployeeRun(runId)
}

export async function resumeEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const run = await getRequiredEmployeeRun(runId)
  if (run.status !== 'paused') {
    throw new Error(`Only paused employee runs can be resumed; current status is ${run.status}.`)
  }
  await recordEmployeeEvent(runId, 'status', 'running', 'Employee run resumed by user.')
  return executeEmployeeRun(runId)
}

export async function cancelEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const run = await getRequiredEmployeeRun(runId)
  if (['complete', 'failed', 'aborted'].includes(run.status)) return run
  await updateRun(runId, {
    status: 'aborted',
    currentPhase: 'aborted',
    currentStep: 'Canceled by user',
    finishedAt: Date.now(),
  })
  await recordEmployeeEvent(runId, 'status', 'aborted', 'Employee run canceled by user.')
  await revokeDynamicPermissionsForCompletedRun(runId, 'Run aborted; dynamic permissions were automatically revoked.')
  return getRequiredEmployeeRun(runId)
}

async function failEmployeeRun(
  runId: string,
  error: string,
  metadata: JsonObject = {},
): Promise<EmployeeRunRow> {
  const run = await getRequiredEmployeeRun(runId)
  await updateRun(runId, {
    status: 'failed',
    currentPhase: 'failed',
    currentStep: error,
    error,
    finishedAt: Date.now(),
  })
  const recoveryPlan = Array.isArray(metadata.recoveryPlan)
    ? metadata.recoveryPlan
    : buildRuntimeRecoveryPlan(error)
  await recordEmployeeEvent(runId, 'error', 'failed', error, {
    ...metadata,
    recoveryPlan,
  })
  await recordMetricPoint({
    metricName: 'employee_run.failure',
    value: 1,
    unit: 'count',
    resourceType: 'employee_run',
    resourceId: runId,
    tags: {
      agentProfileId: run.agentProfileId,
      status: 'failed',
    },
  })
  await recordAuditLog({
    actorType: 'agent',
    actorId: run.agentProfileId,
    action: 'employee_run.fail',
    resourceType: 'employee_run',
    resourceId: runId,
    status: 'blocked',
    riskLevel: 'medium',
    message: error,
    metadata: {
      ...metadata,
      recoveryPlan,
    },
  })
  await revokeDynamicPermissionsForCompletedRun(runId, 'Run failed; dynamic permissions were automatically revoked.')
  const failedRun = await getRequiredEmployeeRun(runId)
  const agent = await getAgentProfile(failedRun.agentProfileId)
  const continuity = await recordRunContinuity({
    run: failedRun,
    agent,
    reflection: null,
    artifactValidation: null,
    learningEvent: null,
  })
  await recordEmployeeEvent(runId, 'phase', 'continuity_saved', 'Failure diary and continuation plan were saved.', {
    diaryEntryId: continuity.diaryEntry.id,
    continuationPlanId: continuity.continuationPlan.id,
  })
  return failedRun
}

async function recordEmployeeEvent(
  employeeRunId: string,
  type: EmployeeRunEventType,
  phase: string,
  message: string,
  payload: JsonObject = {},
): Promise<EmployeeRunEventRow> {
  const row = {
    id: newEmployeeRunEventId(),
    employeeRunId,
    type,
    phase,
    message,
    payload,
    createdAt: Date.now(),
  }
  await db.insert(schema.employeeRunEvents).values(row)
  return row
}

async function createRuntimeCheckpoint(
  employeeRunId: string,
  stepIndex: number,
  phase: string,
  state: JsonObject,
  summary: string,
): Promise<void> {
  const checkpointId = newRuntimeCheckpointId()
  await db.insert(schema.runtimeCheckpoints).values({
    id: checkpointId,
    employeeRunId,
    stepIndex,
    phase,
    state,
    summary,
    createdAt: Date.now(),
  })
  await recordRecoveryEvent({
    resourceType: 'employee_run',
    resourceId: employeeRunId,
    eventType: 'checkpoint_saved',
    status: 'recorded',
    summary,
    payload: {
      checkpointId,
      stepIndex,
      phase,
    },
  })
}

async function recordBudgetEvent(
  employeeRunId: string,
  eventType: 'estimate' | 'spend' | 'warning' | 'limit_reached',
  amountCents: number,
  message: string,
): Promise<void> {
  await db.insert(schema.budgetEvents).values({
    id: newBudgetEventId(),
    employeeRunId,
    eventType,
    amountCents,
    message,
    createdAt: Date.now(),
  })
  await recordEmployeeEvent(employeeRunId, 'budget', eventType, message, { amountCents })
}

async function recordDecisionAudit(
  employeeRunId: string,
  decisionType: string,
  input: JsonObject,
  decision: string,
  rationale: string,
): Promise<void> {
  await db.insert(schema.decisionAuditTrails).values({
    id: newDecisionAuditTrailId(),
    employeeRunId,
    decisionType,
    inputHash: hashJson(input),
    decision,
    rationale,
    createdAt: Date.now(),
  })
  await recordEmployeeEvent(employeeRunId, 'decision', decisionType, decision, { rationale })
}

async function getRequiredEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const run = await db.query.employeeRuns.findFirst({
    where: eq(schema.employeeRuns.id, runId),
  })
  if (!run) throw new Error(`Employee run not found: ${runId}`)
  return run
}

async function getAgentProfile(agentProfileId: string): Promise<AgentProfileRow> {
  const agent = await db.query.agentProfiles.findFirst({
    where: eq(schema.agentProfiles.id, agentProfileId),
  })
  if (!agent) throw new Error(`Agent profile not found: ${agentProfileId}`)
  return agent
}

async function updateRun(
  runId: string,
  patch: Partial<EmployeeRunRow>,
): Promise<void> {
  await db
    .update(schema.employeeRuns)
    .set({
      ...patch,
      updatedAt: Date.now(),
    })
    .where(eq(schema.employeeRuns.id, runId))
}

function buildDeterministicPlan(agent: AgentProfileRow, goal: string): string[] {
  const artifactType = getString(agent.outputContract, 'artifactType') ?? 'unspecified_artifact'
  return [
    `Understand goal: ${goal.trim()}`,
    `Load role policy for ${agent.role}`,
    'Retrieve relevant memory and project context',
    `Create execution plan for required artifact: ${artifactType}`,
    'Verify permissions, budget, and output contract before tools execute',
    'Persist checkpoint for safe resume',
  ]
}

function estimateRuntimeCostCents(plan: string[]): number {
  return Math.max(1, plan.length)
}

function getString(obj: JsonObject, key: string): string | null {
  const value = obj[key]
  return typeof value === 'string' ? value : null
}

function getBooleanPath(obj: JsonObject, pathParts: string[]): boolean {
  let current: unknown = obj
  for (const key of pathParts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return false
    current = (current as Record<string, unknown>)[key]
  }
  return current === true
}

function summarizeRuntimeEnvironmentForEvent(
  environment: AgentEnvironment,
  computerSession: ComputerSessionRow | null,
): JsonObject {
  return {
    workspacePath: environment.fs.workspace,
    homePath: environment.fs.home,
    tempPath: environment.env.custom.AGENTHUB_TEMP ?? environment.env.visible.TEMP ?? null,
    browserProfilePath: computerSession?.browserProfilePath ?? null,
    workstationMode: computerSession?.mode ?? 'preview',
    workstationStatus: computerSession?.status ?? 'preview',
    networkMode: environment.network.proxy ? 'proxy' : 'direct',
    proxyConfigured: Boolean(environment.network.proxy),
    allowedDomainCount: environment.network.allowedDomains.length,
    mountCount: environment.fs.mounts.length,
    visibleEnvCount: Object.keys(environment.env.visible).length,
    customEnvNames: Object.keys(environment.env.custom).sort(),
    redactedSecretNames: environment.env.redactedSecretNames,
    isolation: {
      userHomeVisible: environment.isolation.userHomeVisible,
      globalEnvVisible: environment.isolation.globalEnvVisible,
      secretValuesExposed: environment.isolation.secretValuesExposed,
    },
  }
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export async function listRecentEmployeeRuns(agentProfileId?: string): Promise<EmployeeRunRow[]> {
  return db.query.employeeRuns.findMany({
    where: agentProfileId ? eq(schema.employeeRuns.agentProfileId, agentProfileId) : undefined,
    orderBy: [desc(schema.employeeRuns.createdAt)],
    limit: 50,
  })
}

import { z } from 'zod'

import {
  CODE_TASK_RUNNABLE_REQUIRED_EVIDENCE,
  isCodeImplementationTask,
} from '@/server/dispatch-plan'
import type { RunToolEvidence } from '@/server/dispatch-run-evidence'
import type { DispatchPlanItem, TaskResultReport } from '@/shared/types'

export const REPORT_TASK_RESULT_TOOL_NAME = 'report_task_result'

export const ReportTaskResultArgsSchema = z.object({
  status: z.enum(['complete', 'failed', 'blocked']),
  summary: z.string().min(1),
  acceptanceResults: z
    .array(
      z.object({
        criterion: z.string().min(1),
        passed: z.boolean(),
        evidence: z.string().min(1),
      }),
    )
    .optional(),
  filesChanged: z
    .array(
      z.object({
        path: z.string().min(1),
        action: z.enum(['created', 'modified', 'deleted', 'verified']).optional(),
      }),
    )
    .optional(),
  commandsRun: z
    .array(
      z.object({
        command: z.string().min(1),
        exitCode: z.number().int().nullable(),
        cwd: z.string().optional(),
        timedOut: z.boolean().optional(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  tests: z
    .array(
      z.object({
        command: z.string().min(1),
        passed: z.boolean(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  blockers: z.array(z.string().min(1)).optional(),
})

type ParsedTaskResultReport = z.infer<typeof ReportTaskResultArgsSchema>

export interface TaskResultReportEvaluation {
  ok: boolean
  error?: string
}

export function normalizeTaskResultReport(data: ParsedTaskResultReport): TaskResultReport {
  const acceptanceResults = data.acceptanceResults
    ?.map((result) => ({
      criterion: result.criterion.trim(),
      passed: result.passed,
      evidence: result.evidence.trim(),
    }))
    .filter((result) => result.criterion && result.evidence)
  const blockers = data.blockers?.map((blocker) => blocker.trim()).filter(Boolean)
  const filesChanged = data.filesChanged
    ?.map((file) => ({
      path: file.path.trim(),
      ...(file.action ? { action: file.action } : {}),
    }))
    .filter((file) => file.path)
  const commandsRun = data.commandsRun
    ?.map((command) => ({
      command: command.command.trim(),
      exitCode: command.exitCode,
      ...(command.cwd?.trim() ? { cwd: command.cwd.trim() } : {}),
      ...(command.timedOut !== undefined ? { timedOut: command.timedOut } : {}),
      ...(command.summary?.trim() ? { summary: command.summary.trim() } : {}),
    }))
    .filter((command) => command.command)
  const tests = data.tests
    ?.map((test) => ({
      command: test.command.trim(),
      passed: test.passed,
      ...(test.summary?.trim() ? { summary: test.summary.trim() } : {}),
    }))
    .filter((test) => test.command)

  return {
    status: data.status,
    summary: data.summary.trim(),
    ...(acceptanceResults && acceptanceResults.length > 0 ? { acceptanceResults } : {}),
    ...(filesChanged && filesChanged.length > 0 ? { filesChanged } : {}),
    ...(commandsRun && commandsRun.length > 0 ? { commandsRun } : {}),
    ...(tests && tests.length > 0 ? { tests } : {}),
    ...(blockers && blockers.length > 0 ? { blockers } : {}),
  }
}

export function parseTaskResultReport(value: unknown): TaskResultReport | null {
  const parsed = ReportTaskResultArgsSchema.safeParse(value)
  return parsed.success ? normalizeTaskResultReport(parsed.data) : null
}

export function readTaskResultReportFromToolResult(result: unknown): TaskResultReport | null {
  return readTaskResultReportFromUnknown(result, 0)
}

export function isTaskResultReportToolName(toolName: string): boolean {
  return (
    toolName === REPORT_TASK_RESULT_TOOL_NAME ||
    toolName.endsWith(`__${REPORT_TASK_RESULT_TOOL_NAME}`) ||
    toolName.endsWith(`_${REPORT_TASK_RESULT_TOOL_NAME}`)
  )
}

// 评测对照组（AGENTHUB_EVAL_EVIDENCE_GATES=off）：只信子 agent 自己的上报，不看证据
export function evaluateSelfReportedTaskResult(
  task: DispatchPlanItem,
  report: TaskResultReport | undefined,
): TaskResultReportEvaluation {
  if (report && report.status !== 'complete') {
    return { ok: false, error: formatReportedNonCompletion(task.id, report) }
  }
  return { ok: true }
}

export function evaluateTaskResultReport(
  task: DispatchPlanItem,
  report: TaskResultReport | undefined,
  evidence: RunToolEvidence = { fileWrites: [], commands: [] },
): TaskResultReportEvaluation {
  if (!report) {
    return {
      ok: false,
      error: `Task "${task.id}" completed without report_task_result`,
    }
  }

  if (report.status !== 'complete') {
    return {
      ok: false,
      error: formatReportedNonCompletion(task.id, report),
    }
  }

  const failedCommands = evidence.commands.filter(
    (command, index) =>
      !command.prepare &&
      isFailedCommand(command) &&
      !hasLaterSuccessfulCommand(command, index, evidence.commands),
  )
  if (failedCommands.length > 0) {
    return {
      ok: false,
      error: `Task "${task.id}" has failed command evidence: ${failedCommands
        .map((command) =>
          `${command.command} (${command.isError ? command.error ?? 'tool error' : command.timedOut ? 'timed out' : `exit ${command.exitCode}`})`,
        )
        .join('; ')}`,
    }
  }

  const failedAcceptance = report.acceptanceResults?.filter((result) => !result.passed) ?? []
  if (failedAcceptance.length > 0) {
    return {
      ok: false,
      error: `Task "${task.id}" did not satisfy acceptance criteria: ${failedAcceptance
        .map((result) => `${result.criterion} (${result.evidence})`)
        .join('; ')}`,
    }
  }

  const criteria = task.acceptanceCriteria ?? []
  if (criteria.length > 0) {
    const reportedCriteria = new Set(
      (report.acceptanceResults ?? []).map((result) => result.criterion.trim()),
    )
    const missing = criteria.filter((criterion) => !reportedCriteria.has(criterion.trim()))
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Task "${task.id}" report is missing acceptance criteria result(s): ${missing.join('; ')}`,
      }
    }
  }

  const missingTargetPaths = (task.targetPaths ?? []).filter(
    (targetPath) => !hasPathEvidence(targetPath, report, evidence),
  )
  if (missingTargetPaths.length > 0) {
    return {
      ok: false,
      error: `Task "${task.id}" report is missing target path evidence: ${missingTargetPaths.join('; ')}`,
    }
  }

  const missingCommands = (task.requiredCommands ?? []).filter(
    (required) => !hasSuccessfulCommandEvidence(required.command, report, evidence),
  )
  if (missingCommands.length > 0) {
    return {
      ok: false,
      error: `Task "${task.id}" report is missing successful command evidence: ${missingCommands
        .map((required) => required.command)
        .join('; ')}`,
    }
  }

  if (isCodeImplementationTask(task) && !hasSuccessfulVerificationCommandEvidence(evidence)) {
    return {
      ok: false,
      error: `Task "${task.id}" is missing successful runnable verification command evidence: build/compile/test/typecheck/lint command exitCode=0`,
    }
  }

  const missingEvidence = (task.requiredEvidence ?? []).filter(
    (required) => !requiredEvidenceSatisfied(required, report, evidence),
  )
  if (missingEvidence.length > 0) {
    return {
      ok: false,
      error: `Task "${task.id}" report is missing required evidence: ${missingEvidence.join('; ')}`,
    }
  }

  return { ok: true }
}

function hasPathEvidence(
  targetPath: string,
  report: TaskResultReport,
  evidence: RunToolEvidence,
): boolean {
  const candidates = [
    ...(report.filesChanged ?? []).map((file) => file.path),
    ...evidence.fileWrites.flatMap((file) => [file.path, file.absolutePath]),
  ]
  return candidates.some((candidate) => pathsMatch(targetPath, candidate))
}

function hasSuccessfulCommandEvidence(
  requiredCommand: string,
  report: TaskResultReport,
  evidence: RunToolEvidence,
): boolean {
  const reported = report.commandsRun?.some(
    (command) => commandsMatch(requiredCommand, command.command) && command.exitCode === 0,
  )
  const tested = report.tests?.some(
    (test) => commandsMatch(requiredCommand, test.command) && test.passed,
  )
  const recorded = evidence.commands.some(
    (command) =>
      commandsMatch(requiredCommand, command.command) &&
      !command.isError &&
      !command.timedOut &&
      command.exitCode === 0,
  )
  return Boolean(reported || tested || recorded)
}

export function hasSuccessfulVerificationCommandEvidence(evidence: RunToolEvidence): boolean {
  return evidence.commands.some(isSuccessfulVerificationCommandEvidence)
}

export function isVerificationCommand(command: string): boolean {
  const normalized = normalizeCommand(command)
  return (
    !isPrepareCommand(normalized) &&
    VERIFICATION_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))
  )
}

function isSuccessfulVerificationCommandEvidence(
  command: RunToolEvidence['commands'][number],
): boolean {
  return (
    !command.prepare &&
    !command.isError &&
    !command.timedOut &&
    command.exitCode === 0 &&
    isVerificationCommand(command.command)
  )
}

function requiredEvidenceSatisfied(
  required: string,
  report: TaskResultReport,
  evidence: RunToolEvidence,
): boolean {
  if (required.trim() === CODE_TASK_RUNNABLE_REQUIRED_EVIDENCE) {
    return hasSuccessfulVerificationCommandEvidence(evidence)
  }
  return evidenceMentions(required, report, evidence)
}

function evidenceMentions(
  required: string,
  report: TaskResultReport,
  evidence: RunToolEvidence,
): boolean {
  const haystack = [
    report.summary,
    ...(report.acceptanceResults ?? []).flatMap((result) => [result.criterion, result.evidence]),
    ...(report.filesChanged ?? []).flatMap((file) => [file.path, file.action ?? '']),
    ...(report.commandsRun ?? []).flatMap((command) => [command.command, command.summary ?? '']),
    ...(report.tests ?? []).flatMap((test) => [test.command, test.summary ?? '']),
    ...evidence.fileWrites.flatMap((file) => [file.path, file.absolutePath, String(file.bytes ?? '')]),
    ...evidence.commands.flatMap((command) => [
      command.command,
      command.cwd,
      String(command.exitCode ?? ''),
      command.timedOut ? 'timedOut' : '',
      command.isError ? 'isError' : '',
      command.error ?? '',
      command.exitCode === 0 && !command.timedOut && !command.isError ? 'exitCode=0' : '',
    ]),
  ]
    .join('\n')
    .toLowerCase()
  return haystack.includes(required.toLowerCase())
}

function isFailedCommand(command: RunToolEvidence['commands'][number]): boolean {
  return command.isError || command.timedOut || command.exitCode !== 0
}

function hasLaterSuccessfulCommand(
  failed: RunToolEvidence['commands'][number],
  failedIndex: number,
  commands: RunToolEvidence['commands'],
): boolean {
  return commands
    .slice(failedIndex + 1)
    .some(
      (command) =>
        commandsMatch(failed.command, command.command) &&
        !command.isError &&
        !command.timedOut &&
        command.exitCode === 0,
    )
}

function pathsMatch(expected: string, actual: string): boolean {
  const e = normalizePath(expected)
  const a = normalizePath(actual)
  return a === e || a.endsWith(`/${e}`) || a.startsWith(`${e}/`)
}

function commandsMatch(expected: string, actual: string): boolean {
  const e = normalizeCommand(expected)
  const a = normalizeCommand(actual)
  return a === e || a.includes(e)
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '').toLowerCase()
}

function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

const VERIFICATION_COMMAND_PATTERNS = [
  /\b(?:pnpm|npm|yarn|bun)(?:\.cmd)?\b(?=.*\b(?:run\s+)?(?:build|test|lint|typecheck|check|compile)(?:\b|:))/i,
  /\b(?:tsc|tsc\.cmd)\b/i,
  /\bnext(?:\.cmd)?\s+build\b/i,
  /\bvite(?:\.cmd)?\s+build\b/i,
  /\bmvn(?:\.cmd)?\b(?=.*\b(?:compile|test|package|verify)\b)/i,
  /\b(?:gradle|gradlew|gradlew\.bat|\.\/gradlew)\b(?=.*\b(?:build|test|check)\b)/i,
  /\bgo\s+(?:test|build)\b/i,
  /\bcargo\s+(?:test|build|check)\b/i,
  /\b(?:pytest|py\.test)\b/i,
  /\bpython(?:3)?(?:\.exe)?\s+-m\s+pytest\b/i,
  /\bruff\s+check\b/i,
  /\bmypy\b/i,
  /\bdotnet\s+(?:build|test)\b/i,
]

function isPrepareCommand(command: string): boolean {
  return (
    /^\s*(?:pnpm|npm|yarn|bun)(?:\.cmd)?\s+(?:install|i|ci|add)\b/i.test(command) &&
    !/\b(?:build|test|lint|typecheck|check|compile)(?:\b|:)/i.test(command)
  )
}

function readTaskResultReportFromUnknown(
  value: unknown,
  depth: number,
): TaskResultReport | null {
  if (depth > 6) return null

  const direct = parseTaskResultReport(value)
  if (direct) return direct

  if (typeof value === 'string') {
    return readTaskResultReportFromJsonText(value, depth + 1)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = readTaskResultReportFromUnknown(item, depth + 1)
      if (parsed) return parsed
    }
    return null
  }

  if (!isRecord(value)) return null

  if (typeof value.text === 'string') {
    const parsed = readTaskResultReportFromJsonText(value.text, depth + 1)
    if (parsed) return parsed
  }

  for (const key of ['structuredContent', 'structured_content', 'result', 'value', 'content']) {
    if (!(key in value)) continue
    const parsed = readTaskResultReportFromUnknown(value[key], depth + 1)
    if (parsed) return parsed
  }

  return null
}

function readTaskResultReportFromJsonText(text: string, depth: number): TaskResultReport | null {
  try {
    return readTaskResultReportFromUnknown(JSON.parse(text), depth)
  } catch {
    return null
  }
}

function formatReportedNonCompletion(taskId: string, report: TaskResultReport): string {
  const blockers =
    report.blockers && report.blockers.length > 0
      ? ` Blockers: ${report.blockers.join('; ')}`
      : ''
  return `Task "${taskId}" reported ${report.status}: ${report.summary}${blockers}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

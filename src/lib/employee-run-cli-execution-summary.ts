import type { CliRunRow } from '@/db/schema'

export interface EmployeeRunCliExecutionEvidenceCandidate {
  cliRunId: string
  cliProfileId: string
  status: CliRunRow['status']
  commandLine: string
  preview: string
}

export interface EmployeeRunCliExecutionIssue {
  cliRunId: string
  cliProfileId: string
  status: 'blocked' | 'failed'
  message: string
}

export interface EmployeeRunCliExecutionSummary {
  title: 'CLI 执行证据'
  total: number
  counts: {
    planned: number
    executed: number
    completed: number
    failed: number
    blocked: number
  }
  hasExecutableEvidence: boolean
  needsReview: boolean
  evidenceCandidates: EmployeeRunCliExecutionEvidenceCandidate[]
  issues: EmployeeRunCliExecutionIssue[]
}

export function buildEmployeeRunCliExecutionSummary(
  cliRuns: CliRunRow[],
): EmployeeRunCliExecutionSummary {
  const evidenceCandidates = cliRuns
    .filter((run) => run.status === 'complete')
    .map((run) => ({
      cliRunId: run.id,
      cliProfileId: run.cliProfileId,
      status: run.status,
      commandLine: commandLineForRun(run),
      preview: previewForRun(run),
    }))
    .filter((candidate) => candidate.preview.length > 0)

  const issues = cliRuns
    .filter((run): run is CliRunRow & { status: 'blocked' | 'failed' } =>
      run.status === 'blocked' || run.status === 'failed',
    )
    .map((run) => ({
      cliRunId: run.id,
      cliProfileId: run.cliProfileId,
      status: run.status,
      message: issueMessageForRun(run),
    }))

  return {
    title: 'CLI 执行证据',
    total: cliRuns.length,
    counts: {
      planned: cliRuns.filter((run) => run.status === 'planned').length,
      executed: cliRuns.filter(
        (run) => run.mode === 'execute' && (run.status === 'complete' || run.status === 'failed'),
      ).length,
      completed: cliRuns.filter((run) => run.status === 'complete').length,
      failed: cliRuns.filter((run) => run.status === 'failed').length,
      blocked: cliRuns.filter((run) => run.status === 'blocked').length,
    },
    hasExecutableEvidence: evidenceCandidates.length > 0,
    needsReview: issues.length > 0 || cliRuns.some((run) => run.requiresApproval),
    evidenceCandidates,
    issues,
  }
}

function commandLineForRun(run: CliRunRow): string {
  const output = asRecord(run.output)
  const commandLine = stringValue(output.commandLine)
  if (commandLine) return commandLine
  return [run.command, run.renderedArgs].filter(Boolean).join(' ')
}

function previewForRun(run: CliRunRow): string {
  const output = asRecord(run.output)
  const stdout = stringValue(output.stdout)
  const stderr = stringValue(output.stderr)
  const dryRun = output.dryRun === true ? commandLineForRun(run) : null
  return truncate([stdout, stderr, dryRun].filter(Boolean).join('\n'))
}

function issueMessageForRun(run: CliRunRow): string {
  const output = asRecord(run.output)
  return (
    run.error?.trim() ||
    stringValue(output.stderr) ||
    stringValue(output.stdout) ||
    `${commandLineForRun(run)} ${run.status}`
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function truncate(value: string, maxLength = 500): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

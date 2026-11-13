import type { ToolResult } from './tools/types'

export interface VerificationCommandResult {
  command: string
  cwd?: string
  exitCode: number | null
  timedOut: boolean
  ok: boolean
  output?: string
  error?: string
  prepare?: boolean
}

export function toVerificationCommandResult(
  result: ToolResult,
  command: { command: string; cwd?: string },
  prepare: boolean,
): VerificationCommandResult {
  const base = { command: command.command, cwd: command.cwd, ...(prepare ? { prepare: true } : {}) }
  if (!result.ok) return { ...base, exitCode: null, timedOut: false, ok: false, error: result.error }
  const value = result.value
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...base, exitCode: null, timedOut: false, ok: false, error: 'Invalid Bash execution result' }
  }
  const fields = value as Record<string, unknown>
  const exitCode = typeof fields.exitCode === 'number' && Number.isInteger(fields.exitCode) ? fields.exitCode : null
  const timedOut = fields.timedOut === true
  const aborted = fields.aborted === true
  const signaled = fields.signal !== undefined && fields.signal !== null
  const failedStatus = fields.status !== undefined && fields.status !== 'completed'
  const hasFailure = fields.failure !== undefined && fields.failure !== null
  const failure = fields.failure && typeof fields.failure === 'object' && !Array.isArray(fields.failure)
    ? fields.failure as Record<string, unknown> : undefined
  const failureMessage = typeof failure?.message === 'string' && failure.message.trim().length > 0
    ? failure.message : undefined
  const ok = exitCode === 0 && !timedOut && !aborted && !signaled && !failedStatus
    && !hasFailure && result.isError !== true && fields.isError !== true
  const error = failureMessage ?? (timedOut ? 'Command timed out' : aborted ? 'Command aborted'
    : signaled ? `Command terminated by signal ${String(fields.signal)}`
      : exitCode !== 0 ? `Command exited with code ${exitCode ?? 'unknown'}`
        : 'Command result reports execution failure')
  return {
    ...base,
    command: typeof fields.command === 'string' ? fields.command : base.command,
    cwd: typeof fields.cwd === 'string' ? fields.cwd : base.cwd,
    exitCode, timedOut, ok,
    output: typeof fields.output === 'string' ? fields.output : undefined,
    ...(!ok ? { error } : {}),
  }
}

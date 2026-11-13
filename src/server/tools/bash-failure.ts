export interface BashFailure {
  kind: 'timeout' | 'aborted' | 'signal' | 'nonzero_exit' | 'unknown_exit'
  message: string
}

export function describeBashFailure(observation: {
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  aborted: boolean
  timeoutMs: number
}): BashFailure | undefined {
  if (observation.timedOut) {
    return { kind: 'timeout', message: `Command timed out after ${observation.timeoutMs} ms.` }
  }
  if (observation.aborted) {
    return { kind: 'aborted', message: 'Command execution was aborted.' }
  }
  if (observation.signal !== null) {
    return { kind: 'signal', message: `Command terminated by signal ${observation.signal}.` }
  }
  if (observation.exitCode !== null && observation.exitCode !== 0) {
    return { kind: 'nonzero_exit', message: `Command exited with nonzero code ${observation.exitCode}.` }
  }
  if (observation.exitCode === null) {
    return { kind: 'unknown_exit', message: 'No exit code was observed; successful completion could not be confirmed.' }
  }
}

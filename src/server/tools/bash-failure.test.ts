import { describe, expect, it } from 'vitest'

import { describeBashFailure } from './bash-failure'

const completed = { exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 30000 } as const

describe('Bash observed failure explanations', () => {
  it('omits failure for a normal zero exit', () => {
    expect(describeBashFailure(completed)).toBeUndefined()
  })

  it.each([1, 2, 23, 127, 137, 255, -9])('explains generic nonzero exit %i without inferring a program-specific cause', (exitCode) => {
    expect(describeBashFailure({ ...completed, exitCode })).toEqual({
      kind: 'nonzero_exit', message: `Command exited with nonzero code ${exitCode}.`,
    })
  })

  it('keeps a null exit unknown instead of inventing a nonzero code', () => {
    expect(describeBashFailure({ ...completed, exitCode: null })).toEqual({
      kind: 'unknown_exit', message: 'No exit code was observed; successful completion could not be confirmed.',
    })
  })

  it('prioritizes timeout over cancellation, signal and nonzero exit', () => {
    expect(describeBashFailure({ exitCode: 23, signal: 'SIGKILL', timedOut: true, aborted: true, timeoutMs: 1234 })).toEqual({
      kind: 'timeout', message: 'Command timed out after 1234 ms.',
    })
  })

  it('prioritizes cancellation over signal and exit code', () => {
    expect(describeBashFailure({ ...completed, exitCode: 2, signal: 'SIGTERM', aborted: true })).toEqual({
      kind: 'aborted', message: 'Command execution was aborted.',
    })
  })

  it.each([0, 7, null])('preserves signal termination as the cause with exit %s', (exitCode) => {
    expect(describeBashFailure({ ...completed, exitCode, signal: 'SIGTERM' })).toEqual({
      kind: 'signal', message: 'Command terminated by signal SIGTERM.',
    })
  })
})

import { describe, expect, it } from 'vitest'

import { toVerificationCommandResult } from './supervisor-command-result'

const command = { command: 'check', cwd: 'project' }

describe('supervisor command verification', () => {
  it('preserves ordinary zero-exit verification and preparation evidence', () => {
    expect(toVerificationCommandResult({ ok: true, value: { exitCode: 0, output: 'done', timedOut: false } }, command, true))
      .toEqual({ ...command, exitCode: 0, timedOut: false, ok: true, output: 'done', prepare: true })
  })

  it('rejects execution error metadata even when the process exits zero', () => {
    const result = toVerificationCommandResult({ ok: true, isError: true, value: { exitCode: 0, output: 'partial' } }, command, false)
    expect(result).toMatchObject({ exitCode: 0, output: 'partial', ok: false })
  })

  it.each([
    { aborted: true }, { timedOut: true }, { signal: 'SIGTERM' }, { status: 'failed' }, { isError: true },
  ])('rejects interrupted zero-exit results: %j', (interruption) => {
    expect(toVerificationCommandResult({ ok: true, value: { exitCode: 0, output: 'partial', ...interruption } }, command, false))
      .toMatchObject({ exitCode: 0, output: 'partial', ok: false, error: expect.any(String) })
  })

  it('preserves success-shaped output from a nonzero process without accepting it', () => {
    expect(toVerificationCommandResult({ ok: true, value: { exitCode: 23, output: 'STATUS: OK\nRESULT: complete\n' } }, command, false))
      .toMatchObject({ exitCode: 23, output: 'STATUS: OK\nRESULT: complete\n', ok: false })
  })

  it('reuses the exact process failure explanation without discarding raw observations', () => {
    const failure = { kind: 'nonzero_exit', message: 'Command exited with nonzero exit code 17.' }
    expect(toVerificationCommandResult({ ok: true, isError: true, value: {
      exitCode: 17, output: 'STATUS: OK\n', isError: true, status: 'failed', failure,
    } }, command, false)).toMatchObject({ exitCode: 17, output: 'STATUS: OK\n', ok: false, error: failure.message })
  })

  it('does not let a failure object claim success through message text', () => {
    expect(toVerificationCommandResult({ ok: true, value: {
      exitCode: 0, status: 'completed', failure: { kind: 'aborted', message: 'SUCCESS in diagnostic text' },
    } }, command, false)).toMatchObject({ exitCode: 0, ok: false, error: 'SUCCESS in diagnostic text' })
  })

  it.each([{}, { message: '' }, { message: '  ' }, { message: 42 }, 'invalid'])('retains failure gates for malformed details: %j', (failure) => {
    const result = toVerificationCommandResult({ ok: true, value: { exitCode: 0, failure } }, command, false)
    expect(result).toMatchObject({ exitCode: 0, ok: false, error: 'Command result reports execution failure' })
  })

  it.each([null, 0, 'unknown', [], { exitCode: null }, { exitCode: 0.5 }])('does not accept missing/invalid process results: %j', (value) => {
    expect(toVerificationCommandResult({ ok: true, value }, command, false).ok).toBe(false)
  })

  it('retains unavailable tool errors', () => {
    expect(toVerificationCommandResult({ ok: false, error: 'Spawn failed: unavailable shell' }, command, false))
      .toMatchObject({ ...command, exitCode: null, timedOut: false, ok: false, error: 'Spawn failed: unavailable shell' })
  })
})

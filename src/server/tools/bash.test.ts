import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearRunToolEvidence, getRunToolEvidence } from '@/server/dispatch-run-evidence'
import { bashTool, executeBashCommand } from './bash'
import type { BashFailure } from './bash-failure'
import type { ToolContext, ToolResult } from './types'

const mocks = vi.hoisted(() => ({
  spawn: vi.fn<typeof import('node:child_process').spawn>(),
  workspace: vi.fn(),
  approval: vi.fn(),
  waitApproval: vi.fn(),
}))
vi.mock('node:child_process', async (original) => ({
  ...await original<typeof import('node:child_process')>(), spawn: mocks.spawn,
}))
vi.mock('@/db/client', () => ({
  db: { query: { workspaces: { findFirst: mocks.workspace } } },
  schema: { workspaces: { conversationId: 'conversation_id' } },
}))
vi.mock('@/server/bash-command-approval', () => ({
  classifyBashApproval: mocks.approval, waitForBashApproval: mocks.waitApproval,
}))

class ControlledChild extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  kill = vi.fn(() => true)
}

let realSpawn: typeof import('node:child_process').spawn
let directory: string
let controller: AbortController
let context: ToolContext

beforeAll(async () => {
  realSpawn = (await vi.importActual<typeof import('node:child_process')>('node:child_process')).spawn
})

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'agenthub-bash-outcome-'))
  controller = new AbortController()
  context = { conversationId: 'conv-bash', agentId: 'agent-bash', runId: 'run-bash',
    workspacePath: directory, abortSignal: controller.signal }
  mocks.spawn.mockReset().mockImplementation(realSpawn)
  mocks.workspace.mockReset().mockResolvedValue({ mode: 'sandbox', rootPath: directory, boundPath: null })
  mocks.approval.mockReset().mockReturnValue({ required: false, reason: '' })
  mocks.waitApproval.mockReset().mockResolvedValue(true)
  vi.stubEnv('SHELL', '/bin/sh')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  clearRunToolEvidence(context.runId)
  rmSync(directory, { recursive: true, force: true })
})

function controlled() {
  const child = new ControlledChild()
  mocks.spawn.mockReturnValue(child as unknown as ChildProcess)
  return child
}

async function startControlled() {
  const child = controlled()
  const operation = executeBashCommand({ command: 'fixture' }, context)
  await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
  return { child, operation }
}

function expectFailure(result: ToolResult, kind: BashFailure['kind']) {
  if (!result.ok) throw new Error('Expected an obtained process observation')
  const value = result.value as { failure?: BashFailure }
  expect(value.failure).toMatchObject({ kind, message: expect.any(String) })
  expect(getRunToolEvidence(context.runId).commands).toEqual([
    expect.objectContaining({ isError: true, error: value.failure!.message }),
  ])
}

describe.skipIf(process.platform === 'win32')('Bash real process observations', () => {
  it.each([1, 23, 127, 137])('retains success-shaped stdout and stderr while marking real exit %i as failed', async (exitCode) => {
    const result = await executeBashCommand({ command: `printf 'STATUS: OK\\nRESULT: complete\\n'; printf 'diagnostic\\n' >&2; exit ${exitCode}` }, context)
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      command: expect.any(String), cwd: directory, exitCode, status: 'failed',
      isError: true, timedOut: false, aborted: false, signal: null, truncated: false,
      stdout: 'STATUS: OK\nRESULT: complete\n', stderr: 'diagnostic\n',
      stdoutTruncated: false, stderrTruncated: false,
    } })
    if (!result.ok) throw new Error('Expected an obtained process observation')
    const value = result.value as { output: string }
    expect(value.output).toContain('STATUS: OK\nRESULT: complete\n')
    expect(value.output).toContain('diagnostic\n')
    expect(getRunToolEvidence(context.runId).commands).toEqual([
      expect.objectContaining({ exitCode, timedOut: false, isError: true }),
    ])
    expectFailure(result, 'nonzero_exit')
  })

  it('keeps exit zero successful even when output text contains ERROR', async () => {
    const result = await executeBashCommand({ command: "printf 'ERROR is fixture text'; exit 0", evidenceKind: 'prepare' }, context)
    expect(result).toMatchObject({ ok: true, isError: false, value: {
      exitCode: 0, status: 'completed', isError: false, output: 'ERROR is fixture text',
      timedOut: false, aborted: false, signal: null,
    } })
    expect(getRunToolEvidence(context.runId).commands).toEqual([
      expect.objectContaining({ exitCode: 0, isError: false, prepare: true }),
    ])
    if (!result.ok) throw new Error('Expected an obtained process observation')
    expect(result.value).not.toHaveProperty('failure')
    expect(getRunToolEvidence(context.runId).commands[0]).not.toHaveProperty('error')
  })

  it('retains actual Unicode text in both pipes without treating stderr as failure', async () => {
    const result = await executeBashCommand({ command: "printf '完成🙂'; printf '警告中' >&2" }, context)
    expect(result).toMatchObject({ ok: true, isError: false, value: {
      exitCode: 0, status: 'completed', stdout: '完成🙂', stderr: '警告中',
      stdoutTruncated: false, stderrTruncated: false, truncated: false,
    } })
  })

  it('labels pipes after redirection rather than inferring diagnostic origin', async () => {
    const result = await executeBashCommand({ command: "{ printf 'diagnostic' >&2; } 2>&1" }, context)
    expect(result).toMatchObject({ ok: true, isError: false, value: {
      output: 'diagnostic', stdout: 'diagnostic', stderr: '',
      stdoutTruncated: false, stderrTruncated: false,
    } })
  })

  it('retains empty streams for a real command without output', async () => {
    expect(await executeBashCommand({ command: 'exit 0' }, context)).toMatchObject({
      ok: true, value: { stdout: '', stderr: '', output: '',
        stdoutTruncated: false, stderrTruncated: false, status: 'completed' },
    })
  })

  it('preserves bounded output and the truncation annotation', async () => {
    const result = await executeBashCommand({ command: "printf '%12000s' x; exit 9" }, context)
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      exitCode: 9, truncated: true, output: expect.stringContaining('[TRUNCATED at 10000 chars]'),
      stdout: ' '.repeat(10000), stderr: '',
      stdoutTruncated: true, stderrTruncated: false,
    } })
    expectFailure(result, 'nonzero_exit')
  })

  it('closes inherited background stdio without losing the successful shell outcome', async () => {
    const result = await executeBashCommand({ command: "printf out; printf err >&2; sleep 20 & exit 0" }, context)
    expect(result).toMatchObject({ ok: true, isError: false, value: {
      exitCode: 0, status: 'completed', output: expect.stringContaining('[STOPPED background processes'),
      stdout: 'out', stderr: 'err', stdoutTruncated: false, stderrTruncated: false,
    } })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
  })
})

describe('Bash pipe capture boundaries', () => {
  it('preserves decoded callback order and per-pipe ownership', async () => {
    const { child, operation } = await startControlled()
    child.stdout.emit('data', Buffer.from('out-1'))
    child.stderr.emit('data', Buffer.from('err'))
    child.stdout.emit('data', Buffer.from('out-2'))
    child.emit('close', 0, null)
    expect(await operation).toMatchObject({ ok: true, value: {
      output: 'out-1errout-2', stdout: 'out-1out-2', stderr: 'err',
      truncated: false, stdoutTruncated: false, stderrTruncated: false,
    } })
  })

  it('keeps independent UTF-8 decoder state for interleaved partial characters', async () => {
    const { child, operation } = await startControlled()
    const out = Buffer.from('中🙂')
    const err = Buffer.from('文🚀')
    for (let index = 0; index < out.length; index += 1) {
      child.stdout.emit('data', out.subarray(index, index + 1))
      child.stderr.emit('data', err.subarray(index, index + 1))
    }
    child.stdout.emit('end')
    child.stderr.emit('end')
    child.emit('close', 0, null)
    expect(await operation).toMatchObject({ ok: true, value: {
      output: '中文🙂🚀', stdout: '中🙂', stderr: '文🚀',
      stdoutTruncated: false, stderrTruncated: false,
    } })
  })

  it.each([
    { out: 10000, err: 0, extra: '', outFlag: false, errFlag: false },
    { out: 10001, err: 0, extra: '', outFlag: true, errFlag: false },
    { out: 10000, err: 1, extra: '', outFlag: false, errFlag: true },
    { out: 6000, err: 4001, extra: 'late', outFlag: true, errFlag: true },
  ])('shares the cap and attributes only observed omissions: $out/$err/$extra', async ({ out, err, extra, outFlag, errFlag }) => {
    const { child, operation } = await startControlled()
    child.stdout.emit('data', Buffer.from('a'.repeat(out)))
    child.stderr.emit('data', Buffer.from('b'.repeat(err)))
    child.stdout.emit('data', Buffer.from(extra))
    child.emit('close', 0, null)
    const retainedOut = 'a'.repeat(Math.min(out, 10000))
    const retainedErr = 'b'.repeat(Math.min(err, 10000 - retainedOut.length))
    const truncated = outFlag || errFlag
    const result = await operation
    expect(result).toMatchObject({ ok: true, value: {
      stdout: retainedOut, stderr: retainedErr, stdoutTruncated: outFlag, stderrTruncated: errFlag,
      truncated, output: retainedOut + retainedErr + (truncated ? '\n\n[TRUNCATED at 10000 chars]' : ''),
    } })
    if (!result.ok) throw new Error('Expected an obtained process observation')
    const value = result.value as { stdout: string; stderr: string; truncated: boolean;
      stdoutTruncated: boolean; stderrTruncated: boolean }
    expect(value.truncated).toBe(value.stdoutTruncated || value.stderrTruncated)
    expect(value.stdout.length + value.stderr.length).toBeLessThanOrEqual(10000)
  })

  it('omits a whole surrogate pair and freezes even with one unused unit', async () => {
    const { child, operation } = await startControlled()
    child.stdout.emit('data', Buffer.from('a'.repeat(9999)))
    child.stderr.emit('data', Buffer.from('🙂'))
    child.stdout.emit('data', Buffer.from('x'))
    child.emit('close', 0, null)
    expect(await operation).toMatchObject({ ok: true, value: {
      stdout: 'a'.repeat(9999), stderr: '', truncated: true,
      stdoutTruncated: true, stderrTruncated: true,
      output: 'a'.repeat(9999) + '\n\n[TRUNCATED at 10000 chars]',
    } })
  })

  it('retains an entire supplementary character when two units remain', async () => {
    const { child, operation } = await startControlled()
    child.stdout.emit('data', Buffer.from('a'.repeat(9998)))
    child.stderr.emit('data', Buffer.from('🙂'))
    child.emit('close', 0, null)
    expect(await operation).toMatchObject({ ok: true, value: {
      stdout: 'a'.repeat(9998), stderr: '🙂', truncated: false,
      stdoutTruncated: false, stderrTruncated: false,
    } })
  })

  it('flushes incomplete UTF-8 once across duplicate end/close and ignores late data', async () => {
    const { child, operation } = await startControlled()
    child.stdout.emit('data', Buffer.from([0xe4, 0xb8]))
    child.stderr.emit('data', Buffer.from('err'))
    child.stdout.emit('end')
    child.stdout.emit('end')
    child.stdout.emit('data', Buffer.from('after-end'))
    child.stderr.emit('data', Buffer.from([0xf0, 0x9f]))
    child.emit('close', 0, null)
    const result = await operation
    const snapshot = JSON.stringify(result)
    child.stdout.emit('data', Buffer.from('after-close'))
    child.stderr.emit('end')
    child.emit('close', 23, 'SIGTERM')
    child.emit('error', new Error('late error'))
    expect(result).toMatchObject({ ok: true, value: {
      output: 'err��', stdout: '�', stderr: 'err�', truncated: false,
    } })
    expect(JSON.stringify(result)).toBe(snapshot)
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
  })

  it('attributes final decoder omissions after forced abort without requiring end', async () => {
    const { child, operation } = await startControlled()
    child.stdout.emit('data', Buffer.from('a'.repeat(10000)))
    child.stderr.emit('data', Buffer.from([0xe4, 0xb8]))
    controller.abort()
    child.emit('close', null, 'SIGTERM')
    expect(await operation).toMatchObject({ ok: true, value: {
      stdout: 'a'.repeat(10000), stderr: '', stdoutTruncated: false, stderrTruncated: true,
      truncated: true, aborted: true,
      output: 'a'.repeat(10000) + '\n\n[TRUNCATED at 10000 chars]\n\n[KILLED after run abort]',
    } })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
  })
})

describe('Bash controlled lifecycle boundaries', () => {
  it('describes metadata-first outcomes and zero, nonzero and null exit codes', () => {
    for (const text of ['status, isError and failure', 'Exit code 0', 'any nonzero code', 'null exit code', 'Output text does not override']) {
      expect(bashTool.description).toContain(text)
    }
  })

  it('does not spawn or seek approval for an already-aborted command', async () => {
    controller.abort()
    const result = await executeBashCommand({ command: 'echo should-not-run' }, context)
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(mocks.approval).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      exitCode: null, signal: null, aborted: true, timedOut: false, status: 'failed', isError: true,
      stdout: '', stderr: '', stdoutTruncated: false, stderrTruncated: false,
    } })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
    expectFailure(result, 'aborted')
  })

  it('retains cancellation during approval instead of calling it user rejection', async () => {
    mocks.approval.mockReturnValue({ required: true, reason: 'fixture approval' })
    mocks.waitApproval.mockImplementationOnce(async () => { controller.abort(); return false })
    const result = await executeBashCommand({ command: 'echo pending' }, context)
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, isError: true, value: { aborted: true, status: 'failed' } })
    expectFailure(result, 'aborted')
  })

  it('preserves an explicit approval rejection without spawning', async () => {
    mocks.approval.mockReturnValue({ required: true, reason: 'fixture approval' })
    mocks.waitApproval.mockResolvedValueOnce(false)
    expect(await executeBashCommand({ command: 'echo pending' }, context)).toEqual({
      ok: false, error: 'User rejected command execution: fixture approval',
    })
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it.each([[null, 'SIGTERM'], [null, null], [0, 'SIGTERM']] as const)('classifies exit %s and signal %s as failed', async (code, signal) => {
    const child = controlled()
    const operation = executeBashCommand({ command: 'fixture' }, context)
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
    child.emit('close', code, signal)
    const result = await operation
    expect(result).toMatchObject({ ok: true, isError: true,
      value: { exitCode: code, signal, status: 'failed', isError: true } })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
    expectFailure(result, signal ? 'signal' : 'unknown_exit')
  })

  it('marks timeout as failed even when close reports zero', async () => {
    vi.useFakeTimers()
    const child = controlled()
    const operation = executeBashCommand({ command: 'fixture', timeoutMs: 1000 }, context)
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
    child.stdout.write('partial output')
    child.stderr.write('partial error')
    await vi.advanceTimersByTimeAsync(1000)
    child.emit('close', 0, null)
    const result = await operation
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      exitCode: 0, timedOut: true, status: 'failed', isError: true,
      output: expect.stringContaining('partial output'),
      stdout: 'partial output', stderr: 'partial error',
      stdoutTruncated: false, stderrTruncated: false,
    } })
    expect(child.kill).toHaveBeenCalledOnce()
    expect(getRunToolEvidence(context.runId).commands).toEqual([
      expect.objectContaining({ exitCode: 0, timedOut: true, isError: true }),
    ])
    expect(vi.getTimerCount()).toBe(0)
    expectFailure(result, 'timeout')
  })

  it('marks abort as failed even when close reports zero and ignores a later error', async () => {
    const child = controlled()
    const operation = executeBashCommand({ command: 'fixture' }, context)
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
    child.stderr.write('before abort')
    controller.abort()
    child.emit('close', 0, null)
    child.emit('error', new Error('late process error'))
    const result = await operation
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      exitCode: 0, aborted: true, timedOut: false, status: 'failed',
      stdout: '', stderr: 'before abort', stdoutTruncated: false, stderrTruncated: false,
    } })
    expect(child.kill).toHaveBeenCalledOnce()
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
    expectFailure(result, 'aborted')
  })

  it('uses timeout as the single reason while retaining overlapping abort, signal and exit observations', async () => {
    vi.useFakeTimers()
    const child = controlled()
    const operation = executeBashCommand({ command: 'fixture', timeoutMs: 1000 }, context)
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
    await vi.advanceTimersByTimeAsync(1000)
    controller.abort()
    child.emit('close', 23, 'SIGTERM')
    const result = await operation
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      timedOut: true, aborted: true, signal: 'SIGTERM', exitCode: 23,
      failure: { kind: 'timeout', message: 'Command timed out after 1000 ms.' },
    } })
    expectFailure(result, 'timeout')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('settles an error/exit/close race once and clears its timers', async () => {
    vi.useFakeTimers()
    const child = controlled()
    const operation = executeBashCommand({ command: 'fixture' }, context)
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
    child.emit('error', new Error('fixture spawn error'))
    child.emit('exit', 0, null)
    child.emit('close', 0, null)
    child.emit('error', new Error('duplicate error'))
    expect(await operation).toEqual({ ok: false, error: 'Spawn failed: fixture spawn error' })
    expect(getRunToolEvidence(context.runId).commands).toEqual([
      expect.objectContaining({ exitCode: null, isError: true, error: 'Spawn failed: fixture spawn error' }),
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns synchronous spawn errors through the existing error union', async () => {
    mocks.spawn.mockImplementationOnce(() => { throw new Error('fixture synchronous spawn error') })
    expect(await executeBashCommand({ command: 'fixture' }, context)).toEqual({
      ok: false, error: 'Spawn failed: fixture synchronous spawn error',
    })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
  })
})

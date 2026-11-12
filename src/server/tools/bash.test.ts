import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearRunToolEvidence, getRunToolEvidence } from '@/server/dispatch-run-evidence'
import { executeBashCommand } from './bash'
import type { ToolContext } from './types'

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

describe.skipIf(process.platform === 'win32')('Bash real process observations', () => {
  it('retains success-shaped stdout and stderr while marking a real exit 23 as failed', async () => {
    const result = await executeBashCommand({ command: "printf 'STATUS: OK\\nRESULT: complete\\n'; printf 'diagnostic\\n' >&2; exit 23" }, context)
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      command: expect.any(String), cwd: directory, exitCode: 23, status: 'failed',
      isError: true, timedOut: false, aborted: false, signal: null, truncated: false,
    } })
    if (!result.ok) throw new Error('Expected an obtained process observation')
    const value = result.value as { output: string }
    expect(value.output).toContain('STATUS: OK\nRESULT: complete\n')
    expect(value.output).toContain('diagnostic\n')
    expect(getRunToolEvidence(context.runId).commands).toEqual([
      expect.objectContaining({ exitCode: 23, timedOut: false, isError: true }),
    ])
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
  })

  it('preserves bounded output and the truncation annotation', async () => {
    const result = await executeBashCommand({ command: "printf '%12000s' x; exit 9" }, context)
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      exitCode: 9, truncated: true, output: expect.stringContaining('[TRUNCATED at 10000 chars]'),
    } })
  })

  it('closes inherited background stdio without losing the successful shell outcome', async () => {
    const result = await executeBashCommand({ command: 'sleep 20 & exit 0' }, context)
    expect(result).toMatchObject({ ok: true, isError: false, value: {
      exitCode: 0, status: 'completed', output: expect.stringContaining('[STOPPED background processes'),
    } })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
  })
})

describe('Bash controlled lifecycle boundaries', () => {
  it('does not spawn or seek approval for an already-aborted command', async () => {
    controller.abort()
    const result = await executeBashCommand({ command: 'echo should-not-run' }, context)
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(mocks.approval).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, isError: true, value: {
      exitCode: null, signal: null, aborted: true, timedOut: false, status: 'failed', isError: true,
    } })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
  })

  it('retains cancellation during approval instead of calling it user rejection', async () => {
    mocks.approval.mockReturnValue({ required: true, reason: 'fixture approval' })
    mocks.waitApproval.mockImplementationOnce(async () => { controller.abort(); return false })
    const result = await executeBashCommand({ command: 'echo pending' }, context)
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, isError: true, value: { aborted: true, status: 'failed' } })
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
    expect(await operation).toMatchObject({ ok: true, isError: true,
      value: { exitCode: code, signal, status: 'failed', isError: true } })
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
  })

  it('marks timeout as failed even when close reports zero', async () => {
    vi.useFakeTimers()
    const child = controlled()
    const operation = executeBashCommand({ command: 'fixture', timeoutMs: 1000 }, context)
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
    child.stdout.write('partial output')
    await vi.advanceTimersByTimeAsync(1000)
    child.emit('close', 0, null)
    expect(await operation).toMatchObject({ ok: true, isError: true, value: {
      exitCode: 0, timedOut: true, status: 'failed', isError: true,
      output: expect.stringContaining('partial output'),
    } })
    expect(child.kill).toHaveBeenCalledOnce()
    expect(getRunToolEvidence(context.runId).commands).toEqual([
      expect.objectContaining({ exitCode: 0, timedOut: true, isError: true }),
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('marks abort as failed even when close reports zero and ignores a later error', async () => {
    const child = controlled()
    const operation = executeBashCommand({ command: 'fixture' }, context)
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce())
    controller.abort()
    child.emit('close', 0, null)
    child.emit('error', new Error('late process error'))
    expect(await operation).toMatchObject({ ok: true, isError: true, value: {
      exitCode: 0, aborted: true, timedOut: false, status: 'failed',
    } })
    expect(child.kill).toHaveBeenCalledOnce()
    expect(getRunToolEvidence(context.runId).commands).toHaveLength(1)
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

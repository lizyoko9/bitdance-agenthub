import { describe, expect, it } from 'vitest'

import { runAgentHubCommand } from './agenthub-command-runner'

describe('agenthub command runner', () => {
  it('runs a command and captures stdout', async () => {
    const result = await runAgentHubCommand({
      command: process.execPath,
      args: ['-e', 'console.log("agenthub")'],
      cwd: process.cwd(),
      timeoutMs: 5_000,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('agenthub')
    expect(result.timedOut).toBe(false)
  })

  it('times out long-running commands', async () => {
    const result = await runAgentHubCommand({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 10000)'],
      cwd: process.cwd(),
      timeoutMs: 50,
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.timedOut).toBe(true)
  })
})

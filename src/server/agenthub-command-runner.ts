import { spawn } from 'node:child_process'

export type AgentHubCommandInput = {
  command: string
  args?: string[]
  cwd: string
  env?: Record<string, string | undefined>
  timeoutMs: number
}

export type AgentHubCommandResult = {
  command: string
  args: string[]
  cwd: string
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  startedAt: string
  finishedAt: string
}

export async function runAgentHubCommand(input: AgentHubCommandInput): Promise<AgentHubCommandResult> {
  const args = input.args ?? []
  const startedAt = new Date().toISOString()

  return await new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const child = spawn(input.command, args, {
      cwd: input.cwd,
      env: { ...process.env, ...(input.env ?? {}) },
      shell: false,
      windowsHide: true,
    })

    const finish = (exitCode: number | null) => {
      resolve({
        command: input.command,
        args,
        cwd: input.cwd,
        exitCode: timedOut ? 124 : exitCode,
        stdout,
        stderr,
        timedOut,
        startedAt,
        finishedAt: new Date().toISOString(),
      })
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, input.timeoutMs)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      stderr += error.message
      finish(1)
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      finish(exitCode)
    })
  })
}

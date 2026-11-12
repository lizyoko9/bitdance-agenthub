import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { userInfo } from 'node:os'
import { basename } from 'node:path'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db, schema } from '@/db/client'
import { classifyBashApproval, waitForBashApproval } from '@/server/bash-command-approval'
import { recordRunCommand } from '@/server/dispatch-run-evidence'
import { currentPlatform, type Platform } from '@/server/platform'
import { findBannedPattern } from '@/server/security'
import { assertPathWithinWorkspace, getEffectiveCwd } from '@/server/workspace-utils'

import type { ToolContext, ToolDef, ToolResult } from './types'

const ArgsSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
})

const DEFAULT_TIMEOUT_MS = 30_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 15 * 60_000
const MAX_OUTPUT_CHARS = 10_000
const POSIX_ORPHANED_STDIO_GRACE_MS = 500
const POSIX_LOGIN_INTERACTIVE_SHELLS = new Set(['bash', 'zsh'])

export interface BashExecutionArgs {
  command: string
  cwd?: string
  timeoutMs?: number
  evidenceKind?: 'prepare' | 'verification'
}

interface ShellInvocation {
  cmd: string
  args: string[]
}

function readUserInfoShell(): string | null {
  try {
    return userInfo().shell ?? null
  } catch {
    return null
  }
}

function resolvePosixUserShell(): string | null {
  const candidates = [process.env.SHELL, readUserInfoShell()]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('/') && existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function buildPosixShellInvocation(command: string): ShellInvocation {
  const userShell = resolvePosixUserShell()
  if (!userShell) {
    return { cmd: 'sh', args: ['-c', command] }
  }

  const shellName = basename(userShell)
  if (POSIX_LOGIN_INTERACTIVE_SHELLS.has(shellName)) {
    return { cmd: userShell, args: ['-l', '-i', '-c', command] }
  }

  return { cmd: 'sh', args: ['-c', command] }
}

function buildShellInvocation(command: string, platform: Platform): ShellInvocation {
  if (platform === 'windows') {
    const preamble =
      "$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();"
    return {
      cmd: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command', `${preamble} ${command}`],
    }
  }
  return buildPosixShellInvocation(command)
}

function killProcessTree(
  child: ChildProcess,
  platform: Platform,
  signal: NodeJS.Signals = 'SIGTERM',
) {
  if (platform === 'windows' && typeof child.pid === 'number') {
    const killer = spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true })
    killer.on('error', () => {})
    return
  }
  if (typeof child.pid === 'number') {
    try {
      process.kill(-child.pid, signal)
      return
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? (error as { code?: unknown }).code : null
      if (code !== 'ESRCH') {
        child.kill(signal)
      }
      return
    }
  }
  child.kill(signal)
}

const PLATFORM = currentPlatform()

const DESCRIPTION_POSIX =
  'Run a shell command inside the workspace. Optional cwd must stay inside the workspace. POSIX uses the user login shell for zsh/bash ($SHELL -l -i -c) when available, otherwise sh -c. Use POSIX syntax: ls, grep, cat, git, npm, python, etc. Output is stdout + stderr combined, truncated to 10000 chars, 30s timeout. Destructive commands (rm -rf /, sudo, fork bombs, curl | sh) are blocked. No interactive stdin. Do not leave persistent background servers running; start test servers only inside a command that cleans them up.'

const DESCRIPTION_WINDOWS =
  'Run a Windows PowerShell 5.1 command inside the workspace. Optional cwd must stay inside the workspace. ' +
  'CRITICAL: this is Windows, not Linux/macOS. You MUST use PowerShell syntax; POSIX flags like `-la`, `-rf` do not work. ' +
  'Examples of correct commands: `Get-ChildItem -Force` (NOT `ls -la`), `Get-Content file.txt` (NOT `cat`), ' +
  '`Select-String pattern file.txt` (NOT `grep`), `Remove-Item path` (NOT `rm`), `New-Item -ItemType Directory` (NOT `mkdir -p`), ' +
  '`Copy-Item src dst` (NOT `cp`), `Move-Item src dst` (NOT `mv`). git/npm/python/node work as usual. ' +
  'Output is UTF-8, stdout + stderr combined, truncated to 10000 chars. ' +
  'Destructive commands (Remove-Item -Recurse -Force, format, shutdown, iex(iwr ...), reg delete, Set-ExecutionPolicy Unrestricted) are blocked. No interactive stdin. ' +
  'Do not leave persistent background servers running; start test servers only inside a command that cleans them up.'

/**
 * bash —— 在 workspace 内跑 shell 命令。详见 specs/07-tools.md, specs/11-platform.md。
 */
export const bashTool: ToolDef = {
  name: 'bash',
  description: PLATFORM === 'windows' ? DESCRIPTION_WINDOWS : DESCRIPTION_POSIX,
  parameters: {
    type: 'object',
    required: ['command'],
    properties: {
      command: {
        type: 'string',
        description:
          PLATFORM === 'windows'
            ? 'PowerShell command to execute. Use cwd instead of Set-Location.'
            : 'Shell command to execute. Use cwd instead of cd.',
      },
      cwd: {
        type: 'string',
        description:
          'Optional workspace-relative directory to run from, such as "frontend" or "backend". It must resolve inside the workspace.',
      },
      timeoutMs: {
        type: 'number',
        description:
          'Optional timeout in milliseconds. Values are clamped to AgentHub safety bounds.',
      },
    },
  },
  async handler(args, ctx) {
    const parsed = ArgsSchema.safeParse(args)
    if (!parsed.success) {
      return { ok: false, error: `Invalid args: ${parsed.error.message}` }
    }

    return executeBashCommand(parsed.data, ctx)
  },
}

export async function executeBashCommand(
  args: BashExecutionArgs,
  ctx: ToolContext,
): Promise<ToolResult> {
  const banned = findBannedPattern(args.command, PLATFORM)
  if (banned) {
    return { ok: false, error: `Command rejected by safety policy: ${banned.source}` }
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.conversationId, ctx.conversationId),
  })
  if (!workspace) return { ok: false, error: 'Workspace not found' }

  let cwd = getEffectiveCwd(workspace)
  if (args.cwd) {
    try {
      cwd = assertPathWithinWorkspace(workspace, args.cwd)
      if (!statSync(cwd).isDirectory()) {
        return { ok: false, error: `cwd is not a directory: ${args.cwd}` }
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  if (ctx.abortSignal.aborted) return runShellCommand(args, cwd, ctx)

  const approval = classifyBashApproval(args.command, PLATFORM)
  if (approval.required) {
    const approved = await waitForBashApproval({
      conversationId: ctx.conversationId,
      agentId: ctx.agentId,
      runId: ctx.runId,
      command: args.command,
      cwd,
      reason: approval.reason,
      signal: ctx.abortSignal,
    })
    if (!approved && !ctx.abortSignal.aborted) {
      return { ok: false, error: `User rejected command execution: ${approval.reason}` }
    }
  }

  return runShellCommand(args, cwd, ctx)
}

function runShellCommand(
  args: BashExecutionArgs,
  cwd: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  const timeoutMs = clampTimeout(args.timeoutMs)
  const shell = buildShellInvocation(args.command, PLATFORM)

  return new Promise((resolve) => {
    let settled = false
    let timedOut = false
    let aborted = false
    let orphanedStdio = false
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    let orphanedStdioTimer: ReturnType<typeof setTimeout> | null = null
    let child: ChildProcess

    let buffer = ''
    let truncated = false
    const append = (chunk: Buffer) => {
      if (truncated) return
      const text = chunk.toString('utf8')
      if (buffer.length + text.length <= MAX_OUTPUT_CHARS) {
        buffer += text
      } else {
        buffer = (buffer + text).slice(0, MAX_OUTPUT_CHARS)
        truncated = true
      }
    }

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (orphanedStdioTimer) clearTimeout(orphanedStdioTimer)
      ctx.abortSignal.removeEventListener('abort', onAbort)
    }

    const closeInheritedStdio = () => {
      child.stdout?.destroy()
      child.stderr?.destroy()
    }

    const finish = (result: ToolResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const finishClose = (exitCode: number | null, closeSignal: NodeJS.Signals | null) => {
      if (settled) return
      const note = timedOut
        ? `\n\n[KILLED after ${timeoutMs / 1000}s timeout]`
        : aborted
          ? '\n\n[KILLED after run abort]'
          : closeSignal
            ? `\n\n[KILLED by signal ${closeSignal}]`
            : ''
      const orphanNote = orphanedStdio
        ? '\n\n[STOPPED background processes after shell exit to close inherited stdio]'
        : ''
      const truncNote = truncated ? `\n\n[TRUNCATED at ${MAX_OUTPUT_CHARS} chars]` : ''
      const commandFailed = timedOut || aborted || closeSignal !== null || exitCode !== 0

      recordRunCommand(ctx.runId, {
        command: args.command,
        cwd,
        exitCode,
        timedOut,
        isError: commandFailed,
        ...(args.evidenceKind === 'prepare' ? { prepare: true } : {}),
      })

      finish({
        ok: true,
        isError: commandFailed,
        value: {
          cwd,
          command: args.command,
          exitCode,
          output: buffer + truncNote + note + orphanNote,
          truncated,
          timedOut,
          aborted,
          signal: closeSignal,
          isError: commandFailed,
          status: commandFailed ? 'failed' : 'completed',
        },
      })
    }

    const onAbort = () => {
      if (settled) return
      aborted = true
      killProcessTree(child, PLATFORM)
      closeInheritedStdio()
    }

    const finishSpawnError = (err: unknown) => {
      if (settled) return
      const error = `Spawn failed: ${err instanceof Error ? err.message : String(err)}`
      recordRunCommand(ctx.runId, {
        command: args.command,
        cwd,
        exitCode: null,
        timedOut,
        isError: true,
        ...(args.evidenceKind === 'prepare' ? { prepare: true } : {}),
        error,
      })
      finish({ ok: false, error })
    }

    if (ctx.abortSignal.aborted) {
      aborted = true
      finishClose(null, null)
      return
    }

    try {
      child = spawn(shell.cmd, shell.args, {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: PLATFORM !== 'windows',
      })
    } catch (error) {
      finishSpawnError(error)
      return
    }

    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.on('error', finishSpawnError)

    child.on('exit', (exitCode, closeSignal) => {
      if (settled || PLATFORM === 'windows') return
      orphanedStdioTimer = setTimeout(() => {
        if (settled) return
        orphanedStdio = true
        killProcessTree(child, PLATFORM)
        closeInheritedStdio()
        finishClose(exitCode ?? null, closeSignal)
      }, POSIX_ORPHANED_STDIO_GRACE_MS)
    })

    child.on('close', (exitCode, closeSignal) => {
      finishClose(exitCode ?? null, closeSignal)
    })

    timeoutTimer = setTimeout(() => {
      if (settled) return
      timedOut = true
      killProcessTree(child, PLATFORM)
      closeInheritedStdio()
    }, timeoutMs)
    ctx.abortSignal.addEventListener('abort', onAbort, { once: true })
    if (ctx.abortSignal.aborted) onAbort()
  })
}

function clampTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS
  return Math.max(MIN_TIMEOUT_MS, Math.min(timeoutMs, MAX_TIMEOUT_MS))
}

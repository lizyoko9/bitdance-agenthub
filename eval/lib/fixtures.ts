import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

export const TASK_CATEGORIES = ['single-file', 'multi-module', 'refactor', 'multi-step'] as const
export type TaskCategory = (typeof TASK_CATEGORIES)[number]

/** 隐藏验收测试在 workspace 里的目录名；run 结束后才复制进去。 */
export const HIDDEN_TESTS_DIR = '__eval__'

const OUTPUT_TAIL_CHARS = 4000

const TaskFileSchema = z.object({
  id: z.string().min(1),
  category: z.enum(TASK_CATEGORIES),
  prompt: z.string().min(1),
  acceptCommand: z.string().min(1),
  timeoutMs: z.number().int().positive(),
})

export type EvalTask = z.infer<typeof TaskFileSchema> & { dir: string }

export interface CommandResult {
  exitCode: number | null
  timedOut: boolean
  output: string
}

export function loadTasks(tasksDir: string, only: readonly string[] = []): EvalTask[] {
  const ids = readdirSync(tasksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const unknown = only.filter((id) => !ids.includes(id))
  if (unknown.length > 0) throw new Error(`Unknown eval task id(s): ${unknown.join(', ')}`)

  return ids
    .filter((id) => only.length === 0 || only.includes(id))
    .map((id) => {
      const dir = path.join(tasksDir, id)
      const parsed = TaskFileSchema.safeParse(JSON.parse(readFileSync(path.join(dir, 'task.json'), 'utf8')))
      if (!parsed.success) {
        throw new Error(`Invalid task.json for eval task "${id}": ${parsed.error.message}`)
      }
      if (parsed.data.id !== id) {
        throw new Error(`Eval task directory "${id}" declares mismatched id "${parsed.data.id}"`)
      }
      for (const sub of ['repo', 'hidden', 'solution']) {
        if (!existsSync(path.join(dir, sub))) throw new Error(`Eval task "${id}" is missing ${sub}/`)
      }
      return { ...parsed.data, dir }
    })
}

export function prepareWorkspace(task: EvalTask, workspace: string): void {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(workspace, { recursive: true })
  cpSync(path.join(task.dir, 'repo'), workspace, { recursive: true })
}

export function revealHiddenTests(task: EvalTask, workspace: string): void {
  const target = path.join(workspace, HIDDEN_TESTS_DIR)
  // agent 可能自己建了同名目录，覆盖掉，保证跑的是原版验收测试
  rmSync(target, { recursive: true, force: true })
  cpSync(path.join(task.dir, 'hidden'), target, { recursive: true })
}

export function applySolution(task: EvalTask, workspace: string): void {
  cpSync(path.join(task.dir, 'solution'), workspace, { recursive: true })
}

export function runShell(command: string, cwd: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, detached: process.platform !== 'win32' })
    let output = ''
    const append = (chunk: Buffer) => {
      output = (output + chunk.toString('utf8')).slice(-OUTPUT_TAIL_CHARS)
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      // 杀整个进程组，否则 shell 下的 node --test 子进程会残留
      if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL')
      else child.kill('SIGKILL')
    }, timeoutMs)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ exitCode: code, timedOut, output })
    })
  })
}

export interface FixtureCheck {
  taskId: string
  ok: boolean
  problems: string[]
}

const FIXTURE_COMMAND_TIMEOUT_MS = 60_000

/** 题目有效 = 原始 repo 验收失败、套上参考解后验收通过。 */
export async function checkFixture(task: EvalTask, scratchDir: string): Promise<FixtureCheck> {
  const workspace = path.join(scratchDir, task.id)
  const problems: string[] = []

  prepareWorkspace(task, workspace)
  revealHiddenTests(task, workspace)
  const before = await runShell(task.acceptCommand, workspace, FIXTURE_COMMAND_TIMEOUT_MS)
  if (before.exitCode === 0) problems.push('initial repo already passes acceptance')

  applySolution(task, workspace)
  const after = await runShell(task.acceptCommand, workspace, FIXTURE_COMMAND_TIMEOUT_MS)
  if (after.exitCode !== 0) {
    problems.push(`solution fails acceptance (exit ${after.exitCode}):\n${after.output}`)
  }

  rmSync(workspace, { recursive: true, force: true })
  return { taskId: task.id, ok: problems.length === 0, problems }
}

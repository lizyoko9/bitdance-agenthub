/**
 * AgentHub 评测脚本。用法见 eval/README.md。
 *
 *   node eval/run-eval.ts --check-fixtures
 *   node eval/run-eval.ts --groups single,orch-gate --agent ag_frontend --repeat 3
 *
 * 只通过 HTTP API 与 /api/stream 和运行中的 AgentHub 交互，不 import 服务端模块、不写 DB。
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

import type { StreamEvent } from '@/shared/types'

import { createAgentHubClient, type AgentHubClient } from './lib/agenthub-client.ts'
import { openEventStream, type EventStream } from './lib/event-stream.ts'
import { checkFixture, loadTasks, prepareWorkspace, revealHiddenTests, runShell, type EvalTask } from './lib/fixtures.ts'
import { CaseTracker, EVAL_GROUPS, type CaseResult, type EvalGroup } from './lib/metrics.ts'
import { renderSummary } from './lib/report.ts'

const TASKS_DIR = path.join(import.meta.dirname, 'tasks')
const ACCEPT_TIMEOUT_MS = 120_000
const ABORT_GRACE_MS = 15_000
const AUTO_ANSWER = '请按你的判断继续，不要再提问。'

interface EvalOptions {
  baseUrl: string
  groups: EvalGroup[]
  agentIds: string[]
  orchestratorId: string
  taskIds: string[]
  repeat: number
  outDir: string
}

function parseOptions(): { checkFixtures: true; taskIds: string[] } | ({ checkFixtures: false } & EvalOptions) {
  const { values } = parseArgs({
    options: {
      'check-fixtures': { type: 'boolean', default: false },
      'base-url': { type: 'string', default: 'http://127.0.0.1:3000' },
      groups: { type: 'string', default: EVAL_GROUPS.join(',') },
      agent: { type: 'string' },
      orchestrator: { type: 'string', default: 'ag_orchestrator' },
      tasks: { type: 'string', default: '' },
      repeat: { type: 'string', default: '3' },
      out: { type: 'string' },
    },
  })
  const list = (value: string | undefined) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const taskIds = list(values.tasks)
  if (values['check-fixtures']) return { checkFixtures: true, taskIds }

  const groups = list(values.groups)
  const unknownGroups = groups.filter((g) => !(EVAL_GROUPS as readonly string[]).includes(g))
  if (groups.length === 0 || unknownGroups.length > 0) {
    throw new Error(`--groups must be a comma list of ${EVAL_GROUPS.join(' / ')}, got "${values.groups}"`)
  }
  const agentIds = list(values.agent)
  if (agentIds.length === 0) throw new Error('--agent is required (executor agent id, comma list for several)')
  const repeat = Number(values.repeat)
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error(`--repeat must be a positive integer, got "${values.repeat}"`)

  // workspace 必须在 home 子目录：local 模式拒绝 /private、/var 等系统目录，放在仓库内又会让 agent 看到整个 AgentHub 仓库
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.resolve(values.out ?? path.join(homedir(), '.agenthub-eval', stamp))
  return {
    checkFixtures: false,
    baseUrl: values['base-url'],
    groups: groups as EvalGroup[],
    agentIds,
    orchestratorId: values.orchestrator,
    taskIds,
    repeat,
    outDir,
  }
}

async function runCheckFixtures(taskIds: string[]): Promise<number> {
  const tasks = loadTasks(TASKS_DIR, taskIds)
  const scratch = mkdtempSync(path.join(tmpdir(), 'agenthub-eval-fixtures-'))
  let invalid = 0
  for (const task of tasks) {
    const check = await checkFixture(task, scratch)
    if (!check.ok) invalid++
    process.stdout.write(`${check.ok ? 'ok  ' : 'FAIL'} ${task.id}${check.ok ? '' : `\n  ${check.problems.join('\n  ')}`}\n`)
  }
  process.stdout.write(`\n${tasks.length - invalid}/${tasks.length} fixtures valid\n`)
  return invalid === 0 ? 0 : 1
}

function assertGroupsMatchServer(groups: EvalGroup[], evidenceGates: boolean): void {
  const wrong = groups.filter((g) => (g === 'orch-gate' && !evidenceGates) || (g === 'orch-nogate' && evidenceGates))
  if (wrong.length === 0) return
  throw new Error(
    `Server evidence gates are ${evidenceGates ? 'on' : 'off'}, which does not match group(s) ${wrong.join(', ')}. ` +
      'Run orch-nogate against a server started with AGENTHUB_EVAL_EVIDENCE_GATES=off and orch-gate against a default server, ' +
      'reusing the same --out so the summary merges both.',
  )
}

function handlePending(client: AgentHubClient, conversationId: string, event: StreamEvent): void {
  const fail = (what: string) => (err: unknown) => process.stderr.write(`  ! failed to ${what}: ${String(err)}\n`)
  if (event.type === 'dispatch.plan.pending') {
    client.approvePlan(conversationId, event.pendingPlan.id).catch(fail('approve plan'))
  } else if (event.type === 'bash_command.pending') {
    client.approveBash(conversationId, event.pendingCommand.id).catch(fail('approve bash command'))
  } else if (event.type === 'ask_user.pending') {
    const answers = Object.fromEntries(
      event.pendingQuestion.questions.map((q) => [q.question, { selectedLabels: [], freeformNote: AUTO_ANSWER }]),
    )
    client.answerQuestion(conversationId, event.pendingQuestion.id, answers).catch(fail('answer question'))
  }
}

function waitUntil(predicate: () => boolean, timeoutMs: number, poke: (check: () => void) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(predicate()), timeoutMs)
    const check = () => {
      if (!predicate()) return
      clearTimeout(timer)
      resolve(true)
    }
    poke(check)
    check()
  })
}

async function runCase(
  opts: EvalOptions,
  client: AgentHubClient,
  stream: EventStream,
  task: EvalTask,
  group: EvalGroup,
  repeat: number,
): Promise<CaseResult> {
  const caseId = `${task.id}__${group}__${repeat}`
  const workspace = path.join(opts.outDir, 'workspaces', caseId)
  prepareWorkspace(task, workspace)

  const single = group === 'single'
  const conversationId = await client.createConversation({
    title: `[eval] ${caseId}`,
    mode: single ? 'single' : 'group',
    agentIds: single ? [opts.agentIds[0]] : [opts.orchestratorId, ...opts.agentIds],
    boundPath: workspace,
  })
  await client.setAutoApproveWrites(conversationId)

  const tracker = new CaseTracker()
  let notify = () => {}
  const unsubscribe = stream.subscribe(conversationId, (event) => {
    tracker.apply(event)
    handlePending(client, conversationId, event)
    notify()
  })

  const startedAt = Date.now()
  let error: string | undefined
  let timedOut = false
  try {
    const runIds = await client.sendMessage(conversationId, task.prompt, single ? undefined : [opts.orchestratorId])
    if (runIds.length === 0) throw new Error('sendMessage started no agent run')
    const settled = await waitUntil(() => tracker.settled(), task.timeoutMs, (check) => (notify = check))
    if (!settled) {
      timedOut = true
      await Promise.all(tracker.runningRunIds().map((runId) => client.abortRun(runId)))
      await waitUntil(() => tracker.settled(), ABORT_GRACE_MS, (check) => (notify = check))
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  } finally {
    unsubscribe()
  }
  const wallMs = Date.now() - startedAt

  revealHiddenTests(task, workspace)
  const accept = await runShell(task.acceptCommand, workspace, ACCEPT_TIMEOUT_MS)
  return {
    caseId,
    taskId: task.id,
    category: task.category,
    group,
    repeat,
    passed: !error && accept.exitCode === 0,
    acceptExitCode: accept.exitCode,
    acceptOutput: accept.output,
    rootRunStatus: tracker.rootRunStatus(),
    timedOut,
    wallMs,
    error,
    ...tracker.snapshot(),
  }
}

function readResults(file: string): CaseResult[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CaseResult)
}

async function runEval(opts: EvalOptions): Promise<number> {
  const tasks = loadTasks(TASKS_DIR, opts.taskIds)
  const client = createAgentHubClient(opts.baseUrl)
  const { evidenceGates } = await client.platform()
  assertGroupsMatchServer(opts.groups, evidenceGates)

  mkdirSync(opts.outDir, { recursive: true })
  const resultsFile = path.join(opts.outDir, 'results.jsonl')
  const done = new Set(readResults(resultsFile).map((r) => r.caseId))
  const stream = await openEventStream(opts.baseUrl, (err) => process.stderr.write(`  ! stream: ${String(err)}\n`))

  const total = tasks.length * opts.groups.length * opts.repeat
  let index = 0
  try {
    for (let repeat = 1; repeat <= opts.repeat; repeat++) {
      for (const task of tasks) {
        for (const group of opts.groups) {
          index++
          const caseId = `${task.id}__${group}__${repeat}`
          if (done.has(caseId)) {
            process.stdout.write(`[${index}/${total}] ${caseId} skipped (already in results)\n`)
            continue
          }
          process.stdout.write(`[${index}/${total}] ${caseId} ...`)
          const result = await runCase(opts, client, stream, task, group, repeat)
          appendFileSync(resultsFile, JSON.stringify(result) + '\n')
          process.stdout.write(
            ` ${result.passed ? 'PASS' : 'FAIL'} ${(result.wallMs / 1000).toFixed(0)}s` +
              `${result.error ? ` (${result.error})` : result.timedOut ? ' (timeout)' : ''}\n`,
          )
        }
      }
    }
  } finally {
    stream.close()
  }

  const summaryFile = path.join(opts.outDir, 'summary.md')
  writeFileSync(summaryFile, renderSummary(readResults(resultsFile)))
  process.stdout.write(`\nresults: ${resultsFile}\nsummary: ${summaryFile}\n`)
  return 0
}

async function main(): Promise<void> {
  const opts = parseOptions()
  process.exitCode = opts.checkFixtures ? await runCheckFixtures(opts.taskIds) : await runEval(opts)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})

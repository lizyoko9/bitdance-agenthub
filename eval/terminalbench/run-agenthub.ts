import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { loadTrialRuntime, type TrialRuntime } from './profile'
import type { CustomRequestObservation } from './request-policy'
import { classifyTrialTermination, executeTrial, type ExecutionResult } from './trial-execution'
import { validateTrialRequest, type TrialRequest } from './trial-schema'

const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheCreationTokens', 'reasoningTokens'] as const

export function summarizeRequestUsage(requests: CustomRequestObservation[]) {
  const complete = requests.length > 0 && requests.every((request) => request.usageComplete)
  const totals = Object.fromEntries(TOKEN_FIELDS.map((field) => [field,
    requests.length > 0 && requests.every((request) => request.usage[field] !== null)
      ? requests.reduce((sum, request) => sum + (request.usage[field] ?? 0), 0)
      : null,
  ]))
  return { ...totals, complete, observedRequests: requests.length, unknownRequests: requests.filter((request) => !request.usageComplete).length }
}

export function redactLog(text: string, secrets: string[]): string {
  for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[REDACTED]')
  return text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)\S+/gi, '$1[REDACTED]')
}

function commitId(): string | null {
  if (process.env.AGENTHUB_EVAL_SOURCE_SHA) return process.env.AGENTHUB_EVAL_SOURCE_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

export async function runHeadlessTrial(
  request: TrialRequest,
  options: {
    loadRuntime?: typeof loadTrialRuntime
    signal?: AbortSignal
    secrets?: string[]
  } = {},
) {
  mkdirSync(request.outputDir, { recursive: true })
  if (existsSync(path.join(request.outputDir, 'manifest.json'))) throw new Error('Trial output already contains a manifest; use a fresh output directory')
  const secrets = options.secrets ?? [process.env.OPENAI_API_KEY ?? '']
  const serialize = (value: unknown) => redactLog(JSON.stringify(value), secrets)
  const writeJson = (name: string, value: unknown) => writeFileSync(path.join(request.outputDir, name), `${serialize(value)}\n`)
  const observations: CustomRequestObservation[] = []
  const parentRunIds = new Map<string, string | undefined>()
  const manifest = {
    schemaVersion: 1,
    scope: 'one-task integration smoke; official verifier reward is recorded by Harbor',
    taskId: request.taskId,
    group: request.group,
    instructionSha256: createHash('sha256').update(request.instruction).digest('hex'),
    agenthubCommit: commitId(),
    runtimePackageSha256: process.env.AGENTHUB_EVAL_PACKAGE_SHA256 ?? null,
    harborVersion: process.env.AGENTHUB_EVAL_HARBOR_VERSION ?? null,
    datasetVersion: process.env.AGENTHUB_EVAL_DATASET_VERSION ?? null,
    imageDigest: process.env.AGENTHUB_EVAL_IMAGE_DIGEST ?? null,
    taskSha256: process.env.AGENTHUB_EVAL_TASK_SHA256 ?? null,
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    cwd: request.cwd,
    model: { adapter: 'custom', provider: 'openai', requestedModel: request.modelId, reasoningEffort: 'none' },
    limits: { ...request.requestLimits, maxTurns: request.maxTurns, timeoutMs: request.timeoutMs, sdkRetries: 0 },
    policy: { skills: 'none, including public pool', writes: 'auto', plans: 'deferred approval', bash: 'deferred approval after existing policy checks', questions: 'fixed continuation answer' },
    startedAt: new Date().toISOString(),
  }
  writeJson('manifest.json', manifest)
  writeFileSync(path.join(request.outputDir, 'requests.jsonl'), '')
  writeFileSync(path.join(request.outputDir, 'events.jsonl'), '')
  const startedAt = Date.now()
  let runtime: TrialRuntime | undefined
  let execution: ExecutionResult = { runStatus: 'failed', terminationReason: 'error', rootRunIds: [], runs: [], allRunsSettled: false, timedOut: false, budgetExhausted: false }
  try {
    runtime = await (options.loadRuntime ?? loadTrialRuntime)(request, (observation) => {
      observations.push(observation)
      appendFileSync(path.join(request.outputDir, 'requests.jsonl'), `${serialize({ ...observation, parentRunId: parentRunIds.get(observation.runId) ?? null })}\n`)
    })
    writeJson('manifest.json', { ...manifest, dataDir: runtime.dataDir, conversationId: runtime.conversationId, workerIds: runtime.workerIds, orchestratorId: runtime.orchestratorId })
    execution = await executeTrial(runtime, request.timeoutMs, (event) => {
      if (event.type === 'run.start') parentRunIds.set(event.runId, event.parentRunId)
      appendFileSync(path.join(request.outputDir, 'events.jsonl'), `${serialize(event)}\n`)
    }, options.signal)
  } catch (failure) {
    execution.error = failure instanceof Error ? failure.message : String(failure)
    execution.budgetExhausted = execution.error.startsWith('budget_exhausted:')
  } finally {
    try {
      runtime?.close()
    } catch (failure) {
      execution.error ??= `Trial cleanup failed: ${failure instanceof Error ? failure.message : String(failure)}`
      execution.runStatus = 'failed'
    }
  }
  execution.terminationReason = classifyTrialTermination(execution)
  const result = {
    schemaVersion: 1,
    taskId: request.taskId,
    group: request.group,
    modelId: request.modelId,
    conversationId: runtime?.conversationId,
    ...execution,
    wallMs: Date.now() - startedAt,
    usage: summarizeRequestUsage(observations),
  }
  writeJson('result.json', result)
  return JSON.parse(serialize(result)) as typeof result
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { request: { type: 'string' } }, strict: true })
  if (!values.request) throw new Error('Usage: run-agenthub.ts --request <trial.json>')
  const request = validateTrialRequest(JSON.parse(readFileSync(values.request, 'utf8')))
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required in the process environment')
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  try {
    const result = await runHeadlessTrial(request, { signal: controller.signal })
    process.stdout.write(`AgentHub trial ${request.taskId}: ${result.runStatus}\n`)
    process.exitCode = result.runStatus === 'complete' ? 0 : 1
    if (!result.allRunsSettled) process.exit(process.exitCode)
  } finally {
    process.removeListener('SIGTERM', stop)
    process.removeListener('SIGINT', stop)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((failure) => {
    process.stderr.write(`${redactLog(failure instanceof Error ? failure.message : String(failure), [process.env.OPENAI_API_KEY ?? ''])}\n`)
    process.exitCode = 1
  })
}

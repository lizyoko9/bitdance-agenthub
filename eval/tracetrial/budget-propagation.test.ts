import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CustomAgentAdapter } from '../../src/server/adapters/custom-agent-adapter'
import { MAX_CUSTOM_REQUEST_TIMEOUT_MS } from '../../src/server/adapters/custom-agent-limits'
import type { CustomRequestObservation } from '../../src/server/adapters/custom-request-policy'
import type { AdapterInput } from '../../src/server/adapters/types'
import type { StreamEvent } from '../../src/shared/types'
import { createIsolatedProfile } from '../terminalbench/profile'
import { validateTrialRequest } from '../terminalbench/trial-schema'
import { validateTraceTrialRequest } from './run-agenthub'

const tools = vi.hoisted(() => ({ execute: vi.fn() }))
const sdk = vi.hoisted(() => ({ clients: [] as { provided: boolean; timeout?: number; effectiveTimeout: number }[] }))
const profileServices = vi.hoisted(() => ({
  set: vi.fn(), close: vi.fn(), register: vi.fn(), createAgent: vi.fn(), updateAgent: vi.fn(),
}))
vi.mock('../../src/db/client', () => ({
  db: { update: () => ({ set: profileServices.set }) },
  schema: { skills: {}, agents: {}, appSettings: {} }, sqlite: { close: profileServices.close },
}))
vi.mock('../../src/server/agent-service', () => ({ createCustomAgent: profileServices.createAgent, updateCustomAgent: profileServices.updateAgent }))
vi.mock('../../src/server/adapters/registry', () => ({ agentRegistry: { register: profileServices.register } }))
vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>()
  return {
    ...actual,
    default: class extends actual.default {
      constructor(options: ConstructorParameters<typeof actual.default>[0]) {
        super(options)
        sdk.clients.push({ provided: Object.hasOwn(options ?? {}, 'timeout'), timeout: options?.timeout, effectiveTimeout: this.timeout })
      }
    },
  }
})
vi.mock('@/server/tools/registry', () => ({
  toolRegistry: {
    resolve: (names: string[]) => names.map((name) => ({ name, description: name, parameters: { type: 'object' } })),
    execute: tools.execute,
  },
}))

const scratch: string[] = []
const pinnedTaskSource = process.env.AGENTHUB_TRACETRIAL_TEST_SOURCE ?? '/private/tmp/agenthub-tracetrial-source'
const safeEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: process.env.NODE_ENV ?? 'test',
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    ['PATH', 'HOME', 'LANG', 'TMPDIR', 'SYSTEMROOT', 'WINDIR'].includes(name))),
})

function pythonRequest() {
  const directory = mkdtempSync(path.join(tmpdir(), 'agenthub-task-budget-'))
  scratch.push(directory)
  const cwd = path.join(directory, 'workspace')
  mkdirSync(cwd)
  const outputDir = path.join(directory, 'trial')
  const instruction = 'Original public task instruction\n'
  const script = `import json
from eval.tracetrial.budget_contract import build_budget_plan
plan = build_budget_plan('G1-registry-cleanup-002', {'maxUserTurns': 12, 'maxToolCalls': 80, 'maxWallTimeSeconds': 1200})
actor = plan['actor']
request = {'taskId': plan['taskId'], 'instruction': ${JSON.stringify(instruction)}, 'cwd': ${JSON.stringify(cwd)},
    'group': 'single', 'modelId': 'gpt-6-luna', 'outputDir': ${JSON.stringify(outputDir)},
    **{field: actor[field] for field in ('timeoutMs', 'maxTurns', 'maxToolCalls', 'requestLimits')}}
print(json.dumps(request))`
  const request: unknown = JSON.parse(execFileSync('python3', ['-c', script], {
    cwd: path.resolve('.'), encoding: 'utf8', timeout: 10_000,
    env: { ...safeEnvironment(), PYTHONDONTWRITEBYTECODE: '1' },
  }))
  return { directory, instruction, request: validateTraceTrialRequest(request) }
}

function resolvedPinnedRequest(taskId: 'E6-timeout-error-channel-003' | 'L2-deploy-latency-001') {
  const directory = mkdtempSync(path.join(tmpdir(), 'agenthub-resolved-task-'))
  scratch.push(directory)
  const cwd = path.join(directory, 'workspace')
  mkdirSync(cwd)
  const script = `import json,sys
sys.path.insert(0, ${JSON.stringify(pinnedTaskSource)})
from eval.tracetrial.run_trial import resolve_trial_task
task, report, request = resolve_trial_task(${JSON.stringify(pinnedTaskSource)}, ${JSON.stringify(taskId)})
assert report['status'] == 'supported', report['reasons']
assert request['instruction'] == task.prompt
print(json.dumps({'request': request, 'budgetPlan': report['budgetPlan'], 'runtime': report['declaredRuntime'], 'judge': report['judgeCoverage']}))`
  const resolved = JSON.parse(execFileSync('python3', ['-B', '-c', script], {
    cwd: path.resolve('.'), encoding: 'utf8', timeout: 10_000,
    env: { ...safeEnvironment(), PYTHONDONTWRITEBYTECODE: '1' },
  })) as { request: Record<string, unknown>; budgetPlan: { coverage: { completeTaskTrajectory: boolean } }; runtime: { timeout_sec: number }; judge: { rubrics: number; worstCaseRequests: number } }
  return { ...resolved, request: validateTraceTrialRequest({ ...resolved.request, cwd, outputDir: path.join(directory, 'trial') }) }
}

function modelResponse(turn: number, tool: boolean): Response {
  const delta = tool
    ? { tool_calls: [{ index: 0, id: `budget-call-${turn}`, type: 'function', function: { name: 'budget_probe', arguments: JSON.stringify({ index: turn }) } }] }
    : { content: 'Complete' }
  const chunks = [
    { id: `response-${turn}`, object: 'chat.completion.chunk', created: 1, model: 'fake-budget-model', choices: [{ index: 0, delta, finish_reason: tool ? 'tool_calls' : 'stop' }] },
    { id: `response-${turn}`, object: 'chat.completion.chunk', created: 1, model: 'fake-budget-model', choices: [], usage: { prompt_tokens: 10, completion_tokens: 2 } },
  ]
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', {
    headers: { 'content-type': 'text/event-stream', 'x-request-id': `request-${turn}` },
  })
}

describe('task-derived TraceTrial budget propagation without model calls', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.clearAllMocks()
    sdk.clients.length = 0
    vi.stubEnv('AGENTHUB_CUSTOM_MAX_TURNS', undefined)
    vi.stubEnv('AGENTHUB_DATA_DIR', process.env.AGENTHUB_DATA_DIR)
    vi.stubEnv('AGENTHUB_EVAL_EVIDENCE_GATES', process.env.AGENTHUB_EVAL_EVIDENCE_GATES)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('sqlite', undefined)
    profileServices.set.mockResolvedValue(undefined)
    profileServices.createAgent.mockResolvedValue({ id: 'fake-worker' })
    profileServices.updateAgent.mockResolvedValue({ id: 'fake-orchestrator' })
    tools.execute.mockImplementation(async (_name: string, args: unknown) => ({
      ok: true, value: { request: args, content: 'x'.repeat(2048) },
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
  })

  it('accepts the Python G1 plan in TraceTrial while retaining Terminal-Bench limits and defaults', () => {
    const { request } = pythonRequest()
    expect(request).toMatchObject({ timeoutMs: 1_200_000, maxToolCalls: 80, maxTurns: 81,
      requestLimits: { maxRequests: 81, maxRequestBytes: 262144, maxTotalRequestBytes: 21_233_664, maxCompletionTokens: 8192 } })
    expect(() => validateTrialRequest(request)).toThrow()
    expect(validateTraceTrialRequest({ ...request, timeoutMs: MAX_CUSTOM_REQUEST_TIMEOUT_MS }).timeoutMs).toBe(MAX_CUSTOM_REQUEST_TIMEOUT_MS)
    expect(() => validateTraceTrialRequest({ ...request, timeoutMs: MAX_CUSTOM_REQUEST_TIMEOUT_MS+1 })).toThrow()
    const defaults = validateTrialRequest({ taskId: 'terminal-defaults', instruction: request.instruction, cwd: request.cwd, outputDir: request.outputDir })
    expect(defaults).toMatchObject({ timeoutMs: 600_000, maxTurns: 32,
      requestLimits: { maxRequests: 8, maxRequestBytes: 65536, maxTotalRequestBytes: 262144, maxCompletionTokens: 2048 } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps strict fields and canonical path isolation for the extended TraceTrial schema', () => {
    const { directory, request } = pythonRequest()
    const alias = path.join(directory, 'workspace-alias')
    symlinkSync(request.cwd, alias, 'dir')
    for (const outputDir of [request.cwd, path.join(request.cwd, 'logs'), directory, path.join(alias, 'logs')]) {
      expect(() => validateTraceTrialRequest({ ...request, outputDir })).toThrow(/must not overlap/)
    }
    expect(() => validateTraceTrialRequest({ ...request, requestTimeoutMs: request.timeoutMs })).toThrow()
    expect(() => validateTraceTrialRequest({ ...request, apiKey: 'disallowed-field' })).toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the TraceTrial schema in the actual CLI before credentials or runtime startup', () => {
    const { directory, request } = pythonRequest()
    const filename = path.join(directory, 'request.json')
    writeFileSync(filename, JSON.stringify(request))
    const invoke = (entry: string) => spawnSync(process.execPath, ['--import', 'tsx', entry, '--request', filename], {
      cwd: path.resolve('.'), env: safeEnvironment(), encoding: 'utf8', timeout: 10_000,
    })
    const trace = invoke('eval/tracetrial/run-agenthub.ts')
    expect(trace.error).toBeUndefined()
    expect(trace.status).toBe(1)
    expect(trace.stderr).toContain('OPENAI_API_KEY is required in the process environment')
    const terminal = invoke('eval/terminalbench/run-agenthub.ts')
    expect(terminal.error).toBeUndefined()
    expect(terminal.status).toBe(1)
    expect(terminal.stderr).toContain('600000')
    expect(terminal.stderr).not.toContain('OPENAI_API_KEY is required')
    expect(existsSync(request.outputDir)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('executes all eighty allowed fake tools and voluntarily stops on Python-derived request eighty-one', async () => {
    const { instruction, request } = pythonRequest()
    const observations: CustomRequestObservation[] = []
    let turn = 0
    fetchMock.mockImplementation(async () => {
      turn++
      return modelResponse(turn, turn <= request.maxToolCalls!)
    })
    const profile = await createIsolatedProfile(request, (observation) => observations.push(observation), { benchmark: 'tracetrial' })
    expect(profileServices.register).toHaveBeenCalledOnce()
    const adapter = profileServices.register.mock.calls[0][0] as CustomAgentAdapter
    expect(adapter).toBeInstanceOf(CustomAgentAdapter)
    const input: AdapterInput = {
      agentId: 'budget-agent', conversationId: 'budget-conversation', runId: 'budget-run',
      workspacePath: request.cwd, prompt: request.instruction, systemPrompt: 'Use the available test tool.',
      apiKey: 'not-a-real-key', apiBaseUrl: null, modelId: request.modelId, toolNames: ['budget_probe'],
      customConfig: { modelProvider: 'openai' },
    }
    const events: StreamEvent[] = []
    try {
      for await (const event of adapter.stream(input, new AbortController().signal)) events.push(event)
    } finally {
      profile.close()
    }
    expect(input.prompt).toBe(instruction)
    expect(fetchMock).toHaveBeenCalledTimes(81)
    expect(tools.execute).toHaveBeenCalledTimes(80)
    expect(events.filter((event) => event.type === 'tool.call')).toHaveLength(80)
    expect(events.filter((event) => event.type === 'tool.result')).toHaveLength(80)
    expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: { inputTokens: 810, outputTokens: 162 } })
    expect(observations).toHaveLength(81)
    expect(observations.map((observation) => observation.sequence)).toEqual(Array.from({ length: 81 }, (_, index) => index+1))
    expect(observations.every((observation) => observation.status === 'completed')).toBe(true)
    const totalBodyBytes = observations.reduce((sum, observation) => sum+observation.bodyBytes, 0)
    expect(totalBodyBytes).toBeGreaterThan(2 * 1024 * 1024)
    expect(totalBodyBytes).toBeLessThanOrEqual(request.requestLimits.maxTotalRequestBytes)
    expect(Math.max(...observations.map((observation) => observation.bodyBytes))).toBeGreaterThan(64 * 1024)
    expect(Math.max(...observations.map((observation) => observation.bodyBytes))).toBeLessThanOrEqual(request.requestLimits.maxRequestBytes)
    expect(sdk.clients).toHaveLength(81)
    expect(sdk.clients.every((client) => client.provided && client.timeout === request.timeoutMs && client.effectiveTimeout === request.timeoutMs)).toBe(true)
    expect(profileServices.close).toHaveBeenCalledOnce()
    const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(String(options?.body)))
    expect(bodies.every((body) => body.reasoning_effort === 'none' && body.max_completion_tokens === 8192)).toBe(true)
    expect(bodies.at(-1).messages.filter((message: { role: string }) => message.role === 'tool')).toHaveLength(80)
  })

  it.skipIf(!existsSync(path.join(pinnedTaskSource, 'Task/E6-timeout-error-channel-003/task.yaml')))(
    'propagates the real pinned E6 TaskSpec through admission, TS, profile and SDK without model calls', async () => {
      const { request, budgetPlan, runtime, judge } = resolvedPinnedRequest('E6-timeout-error-channel-003')
      expect(request).toMatchObject({ taskId: 'E6-timeout-error-channel-003', timeoutMs: 120_000, maxToolCalls: 6, maxTurns: 7,
        requestLimits: { maxRequests: 7, maxRequestBytes: 262144, maxTotalRequestBytes: 1_835_008, maxCompletionTokens: 8192 } })
      expect(request.instruction).toContain('bash /workspace/tools/sleep_timeout.sh')
      expect(budgetPlan.coverage.completeTaskTrajectory).toBe(true)
      expect(runtime.timeout_sec).toBe(600)
      expect(judge).toMatchObject({ rubrics: 4, worstCaseRequests: 8 })
      let turn = 0
      fetchMock.mockImplementation(async () => modelResponse(++turn, turn <= request.maxToolCalls!))
      const profile = await createIsolatedProfile(request, () => {}, { benchmark: 'tracetrial' })
      const adapter = profileServices.register.mock.calls[0][0] as CustomAgentAdapter
      const events: StreamEvent[] = []
      try {
        for await (const event of adapter.stream({
          agentId: 'e6-budget-agent', conversationId: 'e6-budget-conversation', runId: 'e6-budget-run',
          workspacePath: request.cwd, prompt: request.instruction, systemPrompt: 'Use the available test tool.',
          apiKey: 'not-a-real-key', apiBaseUrl: null, modelId: request.modelId, toolNames: ['budget_probe'],
          customConfig: { modelProvider: 'openai' },
        }, new AbortController().signal)) events.push(event)
      } finally {
        profile.close()
      }
      expect(fetchMock).toHaveBeenCalledTimes(7)
      expect(tools.execute).toHaveBeenCalledTimes(6)
      expect(events.filter((event) => event.type === 'tool.result')).toHaveLength(6)
      expect(sdk.clients).toHaveLength(7)
      expect(sdk.clients.every((client) => client.provided && client.timeout === 120_000 && client.effectiveTimeout === 120_000)).toBe(true)
      expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: { inputTokens: 70, outputTokens: 14 } })
    },
  )

  it.skipIf(!existsSync(path.join(pinnedTaskSource, 'Task/L2-deploy-latency-001/task.yaml')))(
    'propagates the real pinned L2 TaskSpec through all 140 tools and final SDK response without model calls', async () => {
      const { request, budgetPlan, runtime, judge } = resolvedPinnedRequest('L2-deploy-latency-001')
      expect(request).toMatchObject({ taskId: 'L2-deploy-latency-001', timeoutMs: 2_400_000, maxToolCalls: 140, maxTurns: 141,
        requestLimits: { maxRequests: 141, maxRequestBytes: 262144, maxTotalRequestBytes: 36_962_304, maxCompletionTokens: 8192 } })
      expect(request.instruction).toContain('A `submitted` response')
      expect(budgetPlan.coverage.completeTaskTrajectory).toBe(true)
      expect(runtime.timeout_sec).toBe(1800)
      expect(judge).toMatchObject({ rubrics: 2, worstCaseRequests: 4 })
      const observations: CustomRequestObservation[] = []
      tools.execute.mockImplementation(async () => ({ ok: true, value: { content: 'x'.repeat(512) } }))
      let turn = 0
      fetchMock.mockImplementation(async () => modelResponse(++turn, turn <= request.maxToolCalls!))
      const profile = await createIsolatedProfile(request, (observation) => observations.push(observation), { benchmark: 'tracetrial' })
      const adapter = profileServices.register.mock.calls[0][0] as CustomAgentAdapter
      const events: StreamEvent[] = []
      try {
        for await (const event of adapter.stream({
          agentId: 'l2-budget-agent', conversationId: 'l2-budget-conversation', runId: 'l2-budget-run',
          workspacePath: request.cwd, prompt: request.instruction, systemPrompt: 'Use the available test tool.',
          apiKey: 'not-a-real-key', apiBaseUrl: null, modelId: request.modelId, toolNames: ['budget_probe'],
          customConfig: { modelProvider: 'openai' },
        }, new AbortController().signal)) events.push(event)
      } finally {
        profile.close()
      }
      expect(fetchMock).toHaveBeenCalledTimes(141)
      expect(tools.execute).toHaveBeenCalledTimes(140)
      expect(events.filter((event) => event.type === 'tool.call')).toHaveLength(140)
      expect(events.filter((event) => event.type === 'tool.result')).toHaveLength(140)
      expect(observations).toHaveLength(141)
      expect(observations.every((observation) => observation.status === 'completed')).toBe(true)
      expect(observations.reduce((sum, observation) => sum+observation.bodyBytes, 0)).toBeLessThanOrEqual(36_962_304)
      expect(Math.max(...observations.map((observation) => observation.bodyBytes))).toBeLessThanOrEqual(262144)
      expect(sdk.clients).toHaveLength(141)
      expect(sdk.clients.every((client) => client.provided && client.timeout === 2_400_000 && client.effectiveTimeout === 2_400_000)).toBe(true)
      expect(events.at(-1)).toMatchObject({ type: 'run.usage', usage: { inputTokens: 1410, outputTokens: 282 } })
      expect(profileServices.close).toHaveBeenCalledOnce()
    },
  )

})

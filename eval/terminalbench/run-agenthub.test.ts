import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runTraceTrial, TRACETRIAL_SOURCE_REVISION } from '../tracetrial/run-agenthub'
import type { loadTrialRuntime, TrialRuntime } from './profile'
import type { CustomRequestObservation } from './request-policy'
import { redactLog, runHeadlessTrial, summarizeRequestUsage } from './run-agenthub'
import { validateTrialRequest } from './trial-schema'

const scratch: string[] = []
afterEach(() => { for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true }) })

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'agenthub-headless-test-'))
  scratch.push(directory)
  const cwd = path.join(directory, 'task')
  mkdirSync(cwd)
  return { directory, request: validateTrialRequest({ taskId: 'bun-sourcemap-leak', instruction: 'Exact official instruction\n', cwd, outputDir: path.join(directory, 'logs') }) }
}

function observation(overrides: Partial<CustomRequestObservation> = {}): CustomRequestObservation {
  return {
    sequence: 1, attempt: 1, runId: 'root', agentId: 'worker', conversationId: 'conv', messageId: 'msg', requestedModel: 'gpt-6-luna', provider: 'openai', turn: 1,
    responseModel: 'gpt-6-luna', responseId: 'response', systemFingerprint: null, requestId: 'request', startedAt: 1, endedAt: 2, bodyBytes: 128, status: 'completed', httpStatus: 200,
    usage: { inputTokens: 120, outputTokens: 30, cacheReadTokens: 0, cacheCreationTokens: null, reasoningTokens: 0 }, usageComplete: true,
    ...overrides,
  }
}

describe('headless input and artifacts', () => {
  it('preserves exact official instruction bytes and rejects unsupported or secret-bearing input', () => {
    const { request } = fixture()
    expect(request.instruction).toBe('Exact official instruction\n')
    expect(request).toMatchObject({ maxTurns: 32, requestLimits: { maxRequests: 8, maxTotalRequestBytes: 262144, maxCompletionTokens: 2048, maxRequestBytes: 65536 } })
    expect(() => validateTrialRequest({ ...request, group: 'custom' })).toThrow()
    expect(() => validateTrialRequest({ ...request, apiKey: 'not-allowed' })).toThrow()
    expect(() => validateTrialRequest({ ...request, instruction: ' \n ' })).toThrow()
    expect(() => validateTrialRequest({ ...request, timeoutMs: 600_001 })).toThrow()
    expect(() => validateTrialRequest({ ...request, maxTurns: 0 })).toThrow()
    expect(request.maxToolCalls).toBeUndefined()
    expect(validateTrialRequest({ ...request, maxToolCalls: 6 }).maxToolCalls).toBe(6)
    for (const maxToolCalls of [0, -1, 1.5, 10001]) expect(() => validateTrialRequest({ ...request, maxToolCalls })).toThrow()
    expect(() => validateTrialRequest({ ...request, requestLimits: { maxRequests: 1001 } })).toThrow()
  })

  it('accepts explicit budgets above eight through the actual Python request builder', () => {
    const { request } = fixture()
    const script = `import json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('eval/terminalbench'))})
from request_contract import build_trial_request
print(json.dumps(build_trial_request(${JSON.stringify(request.instruction)}, ${JSON.stringify(request.cwd)}, 'single', 'gpt-6-luna', 600, ${JSON.stringify(request.outputDir)}, 64, 32, 1048576)))`
    const actual = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    expect(validateTrialRequest(actual)).toMatchObject({ maxTurns: 64, requestLimits: { maxRequests: 32, maxTotalRequestBytes: 1048576, maxCompletionTokens: 2048, maxRequestBytes: 65536 } })
  })

  it('accepts the actual Harbor Python request builder without changing the instruction', () => {
    const { request } = fixture()
    const script = `import json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve('eval/terminalbench'))})
from request_contract import build_trial_request
print(json.dumps(build_trial_request(${JSON.stringify(request.instruction)}, ${JSON.stringify(request.cwd)}, 'single', 'gpt-6-luna', 600, ${JSON.stringify(request.outputDir)})))`
    const actual = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    expect(validateTrialRequest(actual)).toEqual(request)
  })

  it('rejects output paths inside or enclosing the task, including symlink aliases', () => {
    const { directory, request } = fixture()
    const alias = path.join(directory, 'task-link')
    symlinkSync(request.cwd, alias, 'dir')
    for (const outputDir of [request.cwd, path.join(request.cwd, 'logs'), directory, path.join(alias, 'logs')]) {
      expect(() => validateTrialRequest({ ...request, outputDir })).toThrow(/must not overlap/)
    }
  })

  it('keeps usage unknown when a request or provider detail lacks usage', () => {
    expect(summarizeRequestUsage([observation()])).toMatchObject({ complete: true, inputTokens: 120, cacheCreationTokens: null })
    expect(summarizeRequestUsage([observation(), observation({ usageComplete: false, usage: { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null, reasoningTokens: null } })])).toMatchObject({ complete: false, inputTokens: null, outputTokens: null, unknownRequests: 1 })
    expect(summarizeRequestUsage([])).toMatchObject({ complete: false, inputTokens: null, outputTokens: null })
  })

  it('records the actual entry path, request ledger, and redacted artifacts without model calls', async () => {
    const { request: original } = fixture()
    const request = validateTrialRequest({ ...original, maxTurns: 64, requestLimits: { maxRequests: 32, maxTotalRequestBytes: 1048576 } })
    const secret = 'sk-fixture-secret-123456'
    const loadRuntime = vi.fn<typeof loadTrialRuntime>(async (_request, onRequest): Promise<TrialRuntime> => {
      let emit: Parameters<TrialRuntime['subscribe']>[0] = () => {}
      return {
        conversationId: 'conv', dataDir: '/isolated/state', workerIds: ['worker'], orchestratorId: 'orch', close: vi.fn(), abort: async () => true, approvePending: vi.fn(),
        subscribe: (listener) => { emit = listener; return () => {} },
        async start() {
          emit({ type: 'run.start', conversationId: 'conv', timestamp: 1, runId: 'root', agentId: 'worker', triggerMessageId: 'msg' })
          onRequest(observation())
          emit({ type: 'tool.call', conversationId: 'conv', timestamp: 1, messageId: 'msg', callId: 'tool', toolName: 'bash', args: { command: `echo ${secret}` } })
          emit({ type: 'run.end', conversationId: 'conv', timestamp: 2, runId: 'root', status: 'complete' })
          return { runIds: ['root'] }
        },
      }
    })
    const result = await runHeadlessTrial(request, { loadRuntime, secrets: [secret] })
    expect(result).toMatchObject({ runStatus: 'complete', terminationReason: 'completed', allRunsSettled: true, usage: { complete: true, observedRequests: 1, inputTokens: 120 } })
    expect(loadRuntime).toHaveBeenCalledOnce()
    const events = readFileSync(path.join(request.outputDir, 'events.jsonl'), 'utf8')
    expect(events).not.toContain(secret)
    expect(events).toContain('[REDACTED]')
    expect(JSON.parse(readFileSync(path.join(request.outputDir, 'requests.jsonl'), 'utf8'))).toMatchObject({ runId: 'root', parentRunId: null, usageComplete: true })
    const manifest = JSON.parse(readFileSync(path.join(request.outputDir, 'manifest.json'), 'utf8'))
    expect(manifest).toMatchObject({ taskId: request.taskId, model: { provider: 'openai', requestedModel: request.modelId }, limits: { maxTurns: 64, maxRequests: 32, maxTotalRequestBytes: 1048576, sdkRetries: 0 } })
    expect(manifest.scope).toContain('Harbor')
    expect(manifest).not.toHaveProperty('benchmark')
    expect(manifest.limits).not.toHaveProperty('maxToolCalls')
    await expect(runHeadlessTrial(request, { loadRuntime })).rejects.toThrow(/fresh output directory/)
  })

  it('records the TraceTrial identity and native result without changing official instruction bytes', async () => {
    const { request: original } = fixture()
    const request = validateTrialRequest({ ...original, taskId: 'E8-exit-code-masked-by-output-001', maxToolCalls: 6, timeoutMs: 120000 })
    const loadRuntime = vi.fn<typeof loadTrialRuntime>(async (_request, _onRequest, options): Promise<TrialRuntime> => {
      expect(options).toEqual({ benchmark: 'tracetrial' })
      let emit: Parameters<TrialRuntime['subscribe']>[0] = () => {}
      return {
        conversationId: 'conv', dataDir: '/isolated/state', workerIds: ['worker'], orchestratorId: 'orch', close: vi.fn(), abort: async () => true, approvePending: vi.fn(),
        subscribe: (listener) => { emit = listener; return () => {} },
        async start() {
          emit({ type: 'run.start', conversationId: 'conv', timestamp: 1, runId: 'root', agentId: 'worker', triggerMessageId: 'msg' })
          emit({ type: 'tool.result', conversationId: 'conv', timestamp: 2, messageId: 'msg', callId: 'native', result: { exitCode: 23, output: 'STATUS: OK\nRESULT: complete\n' }, isError: false })
          emit({ type: 'run.end', conversationId: 'conv', timestamp: 3, runId: 'root', status: 'complete' })
          return { runIds: ['root'] }
        },
      }
    })
    const result = await runTraceTrial(request, { loadRuntime })
    expect(result).toMatchObject({ runStatus: 'complete', allRunsSettled: true, terminationReason: 'completed' })
    const manifest = JSON.parse(readFileSync(path.join(request.outputDir, 'manifest.json'), 'utf8'))
    expect(manifest).toMatchObject({ benchmark: 'tracetrial', sourceRevision: TRACETRIAL_SOURCE_REVISION, limits: { maxToolCalls: 6, timeoutMs: 120000 } })
    expect(manifest.scope).not.toContain('Harbor')
    expect(manifest).not.toHaveProperty('harborVersion')
    expect(loadRuntime.mock.calls[0][0].instruction).toBe(original.instruction)
    expect(readFileSync(path.join(request.outputDir, 'events.jsonl'), 'utf8')).toContain('"isError":false')
    expect(readFileSync(path.join(request.outputDir, 'events.jsonl'), 'utf8')).toContain('"exitCode":23')
  })

  it('redacts known credentials and bearer tokens in failures', () => {
    expect(redactLog('failure: tiny-secret Authorization: Bearer token-value', ['tiny-secret'])).toBe('failure: [REDACTED] Authorization: Bearer [REDACTED]')
  })

  it.each(['terminalbench', 'tracetrial'] as const)('creates the real isolated %s profile and leaves the ordinary database untouched', (benchmark) => {
    const { directory } = fixture()
    const bundle = path.join(directory, 'runtime')
    mkdirSync(bundle)
    cpSync(path.resolve('src'), path.join(bundle, 'src'), { recursive: true })
    cpSync(path.resolve('eval/terminalbench'), path.join(bundle, 'eval/terminalbench'), { recursive: true })
    cpSync(path.resolve('tsconfig.json'), path.join(bundle, 'tsconfig.json'))
    symlinkSync(path.resolve('node_modules'), path.join(bundle, 'node_modules'), 'dir')
    writeFileSync(path.join(bundle, 'package.json'), JSON.stringify({ type: 'module' }))
    const profileUrl = pathToFileURL(path.join(bundle, 'eval/terminalbench/profile.ts')).href
    const clientUrl = pathToFileURL(path.join(bundle, 'src/db/client.ts')).href
    const script = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import path from 'node:path';
      globalThis.fetch = () => { throw new Error('Model calls are forbidden in this test'); };
      const ordinary = path.join(${JSON.stringify(directory)}, 'ordinary');
      fs.mkdirSync(ordinary);
      fs.writeFileSync(path.join(ordinary, 'agenthub.db'), 'ordinary database sentinel');
      process.env.AGENTHUB_DATA_DIR = ordinary;
      const { createIsolatedProfile } = await import(${JSON.stringify(profileUrl)});
      const profile = await createIsolatedProfile({outputDir:path.join(${JSON.stringify(directory)}, 'profile'), group:'orch-gate', modelId:'gpt-6-luna', maxToolCalls:${benchmark === 'tracetrial' ? 6 : 'undefined'}}, () => {}, ${JSON.stringify({ benchmark })});
      const { db, sqlite } = await import(${JSON.stringify(clientUrl)});
      assert.notEqual(process.env.AGENTHUB_DATA_DIR, ordinary);
      assert.equal(sqlite.name, path.join(profile.dataDir, 'agenthub.db'));
      assert.equal(fs.readFileSync(path.join(ordinary, 'agenthub.db'), 'utf8'), 'ordinary database sentinel');
      const ids = new Set([...profile.workerIds, profile.orchestratorId]);
      const agents = (await db.query.agents.findMany()).filter(agent => ids.has(agent.id));
      assert.equal(agents.length, 2);
      assert.equal(agents.find(agent => agent.id === profile.workerIds[0]).name, ${JSON.stringify(benchmark === 'tracetrial' ? 'TraceTrial-Bench executor' : 'Terminal-Bench executor')});
      for (const agent of agents) { assert.equal(agent.modelId, 'gpt-6-luna'); assert.equal(agent.modelProvider, 'openai'); assert.equal(agent.adapterName, 'custom'); assert.equal(agent.apiKey, null); assert.deepEqual(agent.skillIds, []); }
      assert.ok((await db.query.skills.findMany()).every(skill => !skill.isGlobalDefault));
      profile.close();
    `
    expect(() => execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: bundle, timeout: 15_000, stdio: 'pipe', env: { ...process.env, OPENAI_API_KEY: 'test-no-model-call' },
    })).not.toThrow()
  })
})

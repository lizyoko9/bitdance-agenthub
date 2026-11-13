import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DispatchPlanItem, StreamEvent } from '@/shared/types'

import type { AdapterInput, AgentPlatformAdapter } from './adapters/types'
import { newMessageId } from './ids'

const registry = vi.hoisted(() => ({ adapter: undefined as AgentPlatformAdapter | undefined }))
vi.mock('./adapters/registry', () => ({ agentRegistry: { getAdapter: () => {
  if (!registry.adapter) throw new Error('Scheduling fixture adapter is not configured')
  return registry.adapter
} } }))

let client: typeof import('@/db/client')
let conversations: typeof import('./conversation-service')
let agents: typeof import('./agent-service')
let eventBus: typeof import('./event-bus').eventBus
let pending: typeof import('./pending-dispatch-plans').pendingDispatchPlans
let tools: typeof import('./tools/registry').toolRegistry
let writes: typeof import('./dispatch-file-writes')
let evidence: typeof import('./dispatch-run-evidence')
let dataDir: string
let adapter: ControlledAdapter
const scenarios: Scenario[] = []
const fetchMock = vi.fn<typeof fetch>()

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

interface Worker {
  id: string
  finish: ReturnType<typeof deferred<void>>
  aborted: ReturnType<typeof deferred<void>>
  input?: AdapterInput
  signal?: AbortSignal
  holdAfterAbort?: boolean
  writeEvidence?: boolean
  writePath?: string
  reportStatus?: 'complete' | 'blocked'
}

interface Scenario {
  conversationId: string
  rootId?: string
  events: StreamEvent[]
  workers: Map<string, Worker>
  ended: ReturnType<typeof deferred<Extract<StreamEvent, { type: 'run.end' }>>>
  unsubscribe(): void
}

class ControlledAdapter implements AgentPlatformAdapter {
  readonly name = 'mock' as const
  readonly plans = new Map<string, DispatchPlanItem[]>()
  readonly workers = new Map<string, Worker>()
  active = 0
  peak = 0

  async *stream(input: AdapterInput, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const messageId = newMessageId()
    const base = { conversationId: input.conversationId, timestamp: Date.now() }
    yield { ...base, type: 'message.start', messageId, runId: input.runId, agentId: input.agentId }
    const plan = this.plans.get(input.agentId)
    if (plan && input.toolNames.includes('plan_tasks')) {
      yield { ...base, type: 'tool.call', messageId, callId: `${messageId}-plan`, toolName: 'plan_tasks', args: { reasoning: 'Independent deferred observations follow explicit prerequisites.', tasks: plan } }
      return
    }
    const worker = this.workers.get(input.agentId)
    if (!worker) {
      yield { ...base, type: 'part.start', messageId, partIndex: 0, part: { type: 'text', content: 'Fixture dispatch settled.' } }
      yield { ...base, type: 'part.end', messageId, partIndex: 0 }
      yield { ...base, type: 'message.end', messageId }
      return
    }
    this.active++
    this.peak = Math.max(this.peak, this.active)
    worker.signal = signal
    const onAbort = () => worker.aborted.resolve()
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    const context = { conversationId: input.conversationId, agentId: input.agentId,
      runId: input.runId, workspacePath: input.workspacePath, abortSignal: signal }
    try {
      if (worker.writeEvidence) {
        const args = { path: worker.writePath ?? `evidence/${worker.id}.txt`, content: `Offline evidence for ${worker.id}` }
        const callId = `${messageId}-write`
        yield { ...base, type: 'tool.call', messageId, callId, toolName: 'fs_write', args }
        const result = await tools.execute('fs_write', args, context)
        if (!result.ok) throw new Error(`Fixture evidence write failed: ${result.error}`)
        yield { ...base, type: 'tool.result', messageId, callId, result: result.value, isError: false }
      }
      worker.input = input
      await (worker.holdAfterAbort ? worker.finish.promise : Promise.race([worker.finish.promise, worker.aborted.promise]))
      if (!signal.aborted) {
        const args = { status: worker.reportStatus ?? 'complete', summary: `Observed ${worker.id}`,
          acceptanceResults: [{ criterion: 'Fixture observation is reported', passed: true, evidence: `Deferred ${worker.id} was explicitly released` }] }
        const callId = `${messageId}-report`
        yield { ...base, type: 'tool.call', messageId, callId, toolName: 'report_task_result', args }
        const result = await tools.execute('report_task_result', args, context)
        if (!result.ok) throw new Error(`Fixture report was invalid: ${result.error}`)
        yield { ...base, type: 'tool.result', messageId, callId, result: result.value, isError: false }
      }
      yield { ...base, type: 'message.end', messageId }
    } finally {
      this.active--
      signal.removeEventListener('abort', onAbort)
    }
  }
}

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agenthub-scheduling-service-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', dataDir)
  ;[client, conversations, agents, { eventBus }, { pendingDispatchPlans: pending }, { toolRegistry: tools }, writes, evidence] = await Promise.all([
    import('@/db/client'), import('./conversation-service'), import('./agent-service'), import('./event-bus'),
    import('./pending-dispatch-plans'), import('./tools/registry'), import('./dispatch-file-writes'), import('./dispatch-run-evidence'),
  ])
})

beforeEach(() => {
  adapter = new ControlledAdapter()
  registry.adapter = adapter
  fetchMock.mockReset().mockRejectedValue(new Error('Network is disabled in the scheduling fixture'))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  for (const scenario of scenarios) {
    for (const worker of scenario.workers.values()) worker.finish.resolve()
    if (scenario.rootId) await conversations.abortRun(scenario.rootId)
  }
  for (const scenario of scenarios.splice(0)) {
    try { await scenario.ended.promise } finally { scenario.unsubscribe() }
  }
  expect(adapter.active).toBe(0)
  expect(fetchMock).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})

afterAll(() => {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
  vi.unstubAllEnvs()
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
})

async function scenario(tasks: Array<Pick<DispatchPlanItem, 'id' | 'dependsOn' | 'expectedOutputs' | 'inputs'>>, options: Partial<Worker> = {}) {
  const orchestrator = await agents.createCustomAgent({ name: 'Offline planner', avatar: '🤖', description: 'Scheduling fixture',
    capabilities: [], systemPrompt: 'Plan observations, then summarize.', modelProvider: 'openai', modelId: 'fixture-model',
    toolNames: ['plan_tasks'], skillIds: [], apiKey: 'fixture-not-a-credential' })
  await client.db.update(client.schema.agents).set({ isOrchestrator: true }).where(eq(client.schema.agents.id, orchestrator.id))
  const workers = new Map<string, Worker>()
  const plan: DispatchPlanItem[] = []
  for (const task of tasks) {
    const agent = await agents.createCustomAgent({ name: `Observer ${task.id}`, avatar: '🤖', description: 'Offline observer',
      capabilities: [], systemPrompt: 'Report one observation.', modelProvider: 'openai', modelId: 'fixture-model',
      toolNames: ['report_task_result', 'fs_write'], skillIds: [], apiKey: 'fixture-not-a-credential' })
    const worker: Worker = { ...options, id: task.id, finish: deferred(), aborted: deferred() }
    workers.set(task.id, worker)
    adapter.workers.set(agent.id, worker)
    plan.push({ ...task, agentId: agent.id, task: `Summarize observation ${task.id}.`, taskKind: 'analysis',
      dependsOn: task.dependsOn ?? [], acceptanceCriteria: ['Fixture observation is reported'] })
  }
  adapter.plans.set(orchestrator.id, plan)
  const conversation = await conversations.createConversation({ mode: 'group', agentIds: [orchestrator.id, ...plan.map((task) => task.agentId)] })
  await conversations.setConversationApprovalMode(conversation.id, 'auto')
  const fixture: Scenario = { conversationId: conversation.id, events: [], workers, ended: deferred(), unsubscribe: () => {} }
  fixture.unsubscribe = eventBus.subscribe(({ event }) => {
    if (event.conversationId !== conversation.id) return
    fixture.events.push(event)
    if (event.type === 'dispatch.plan.pending') setImmediate(() => pending.approve(event.pendingPlan.id))
    if (event.type === 'run.start' && !event.parentRunId) fixture.rootId = event.runId
    if (event.type === 'run.end' && event.runId === fixture.rootId) fixture.ended.resolve(event)
  })
  scenarios.push(fixture)
  const sent = await conversations.sendMessage({ conversationId: conversation.id, content: 'Coordinate these observations.' })
  expect(sent.runIds).toHaveLength(1)
  fixture.rootId = sent.runIds[0]
  return fixture
}

async function started(fixture: Scenario, ids: string[]) {
  await vi.waitFor(() => { for (const id of ids) expect(fixture.workers.get(id)?.input, `worker ${id}`).toBeDefined() })
}

function terminal(fixture: Scenario, id: string) {
  return fixture.events.filter((event) => event.type === 'dispatch.end' && event.taskId === id)
}

describe('AgentRunner DAG scheduling through real conversation services', () => {
  it('releases C after A semantic completion while unrelated B remains active', async () => {
    const fixture = await scenario([{ id: 'A' }, { id: 'B' }, { id: 'C', dependsOn: ['A'] }])
    await started(fixture, ['A', 'B'])
    expect(fixture.workers.get('C')?.input).toBeUndefined()
    fixture.workers.get('A')!.finish.resolve()
    await started(fixture, ['C'])
    expect(terminal(fixture, 'A')).toEqual([expect.objectContaining({ status: 'complete' })])
    expect(terminal(fixture, 'B')).toHaveLength(0)
    const a = fixture.events.find((event) => event.type === 'dispatch.start' && event.taskId === 'A')
    expect(a).toMatchObject({ type: 'dispatch.start' })
    if (a?.type !== 'dispatch.start') throw new Error('A dispatch did not start')
    const persisted = await client.db.query.agentRuns.findFirst({ where: eq(client.schema.agentRuns.id, a.childRunId) })
    expect(persisted?.status).toBe('complete')
    fixture.workers.get('C')!.finish.resolve()
    fixture.workers.get('B')!.finish.resolve()
    expect((await fixture.ended.promise).status).toBe('complete')
    for (const id of ['A', 'B', 'C']) expect(terminal(fixture, id)).toHaveLength(1)
  })

  it('shares four execution slots across independent conversations and admits the next waiter once', async () => {
    const left = await scenario([{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }])
    await started(left, ['L1', 'L2', 'L3'])
    const right = await scenario([{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }])
    await started(right, ['R1'])
    expect(adapter.active).toBe(4)
    expect(right.workers.get('R2')?.input).toBeUndefined()
    expect(right.workers.get('R3')?.input).toBeUndefined()
    left.workers.get('L1')!.finish.resolve()
    await started(right, ['R2'])
    expect(right.workers.get('R3')?.input).toBeUndefined()
    for (const fixture of [left, right]) for (const worker of fixture.workers.values()) worker.finish.resolve()
    expect((await left.ended.promise).status).toBe('complete')
    expect((await right.ended.promise).status).toBe('complete')
    expect(adapter.peak).toBe(4)
    for (const fixture of [left, right]) for (const id of fixture.workers.keys()) expect(terminal(fixture, id)).toHaveLength(1)
  })

  it('propagates a blocked semantic report through descendants while an independent child continues', async () => {
    const fixture = await scenario([{ id: 'A' }, { id: 'B' }, { id: 'C', dependsOn: ['A'] }, { id: 'D', dependsOn: ['C'] }])
    fixture.workers.get('A')!.reportStatus = 'blocked'
    await started(fixture, ['A', 'B'])
    fixture.workers.get('A')!.finish.resolve()
    await vi.waitFor(() => {
      expect(terminal(fixture, 'A')).toEqual([expect.objectContaining({ status: 'failed' })])
      for (const id of ['C', 'D']) expect(terminal(fixture, id)).toEqual([expect.objectContaining({ status: 'skipped' })])
    })
    expect(terminal(fixture, 'B')).toHaveLength(0)
    expect(fixture.workers.get('B')!.signal?.aborted).toBe(false)
    for (const id of ['C', 'D']) expect(fixture.workers.get(id)?.input).toBeUndefined()
    const aRunId = fixture.workers.get('A')!.input!.runId
    expect(fixture.events.find((event) => event.type === 'run.end' && event.runId === aRunId)).toMatchObject({ status: 'complete' })
    await conversations.abortRun(fixture.rootId!)
    expect((await fixture.ended.promise).status).toBe('aborted')
    for (const id of ['A', 'B', 'C', 'D']) expect(terminal(fixture, id)).toHaveLength(1)
  })

  it('skips a required-input consumer once when its successful producer omits an optional document', async () => {
    const fixture = await scenario([
      { id: 'A', expectedOutputs: [{ id: 'notes', type: 'document', required: false }] },
      { id: 'B' },
      { id: 'C', dependsOn: ['A'], inputs: [{ fromTaskId: 'A', outputId: 'notes', required: true }] },
    ])
    await started(fixture, ['A', 'B'])
    fixture.workers.get('A')!.finish.resolve()
    await vi.waitFor(() => {
      expect(terminal(fixture, 'A')).toEqual([expect.objectContaining({ status: 'complete' })])
      expect(terminal(fixture, 'C')).toEqual([expect.objectContaining({ status: 'skipped', error: expect.stringContaining('notes') })])
    })
    expect(fixture.workers.get('C')?.input).toBeUndefined()
    expect(fixture.events.some((event) => event.type === 'dispatch.start' && event.taskId === 'C')).toBe(false)
    expect(terminal(fixture, 'B')).toHaveLength(0)
    expect(fixture.workers.get('B')!.signal?.aborted).toBe(false)
    await conversations.abortRun(fixture.rootId!)
    expect((await fixture.ended.promise).status).toBe('aborted')
    expect(terminal(fixture, 'C')).toHaveLength(1)
  })

  it('retains overlapping write conflicts in the aborted parent after drain and before evidence cleanup', async () => {
    const fixture = await scenario([{ id: 'A' }, { id: 'B' }], {
      writeEvidence: true, writePath: 'shared/overlap.txt', holdAfterAbort: true,
    })
    await started(fixture, ['A', 'B'])
    const runIds = ['A', 'B'].map((id) => fixture.workers.get(id)!.input!.runId)
    const absolutePath = path.join(fixture.workers.get('A')!.input!.workspacePath, 'shared/overlap.txt')
    expect(writes.getFileWrites(runIds[0]).get(absolutePath)).not.toBe(writes.getFileWrites(runIds[1]).get(absolutePath))
    expect(await conversations.abortRun(fixture.rootId!)).toBe(true)
    await Promise.all([...fixture.workers.values()].map((worker) => worker.aborted.promise))
    fixture.workers.get('A')!.finish.resolve()
    await vi.waitFor(() => expect(fixture.events.some((event) => event.type === 'run.end' && event.runId === runIds[0])).toBe(true))
    expect(fixture.events.some((event) => event.type === 'run.end' && event.runId === fixture.rootId)).toBe(false)
    for (const runId of runIds) {
      expect(writes.getFileWrites(runId).has(absolutePath)).toBe(true)
      expect(evidence.getRunToolEvidence(runId).fileWrites).toHaveLength(1)
    }
    fixture.workers.get('B')!.finish.resolve()
    const end = await fixture.ended.promise
    expect(end.status).toBe('aborted')
    expect(end.error).toContain(absolutePath)
    for (const id of ['A', 'B']) {
      expect(end.error).toMatch(new RegExp(`\\b${id}\\b`))
      expect(terminal(fixture, id)).toEqual([expect.objectContaining({ status: 'aborted' })])
    }
    const persisted = await client.db.query.agentRuns.findFirst({ where: eq(client.schema.agentRuns.id, fixture.rootId!) })
    expect(persisted).toMatchObject({ status: 'aborted', error: end.error })
    for (const runId of runIds) {
      expect(writes.getFileWrites(runId).size).toBe(0)
      expect(evidence.getRunToolEvidence(runId)).toEqual({ fileWrites: [], commands: [] })
      expect(fixture.events.filter((event) => event.type === 'run.end' && event.runId === runId)).toHaveLength(1)
    }
  })

  it('drains an uncooperative child on parent abort, cancels queued work once, and cleans only owned evidence', async () => {
    const unrelated = await scenario([{ id: 'U' }], { writeEvidence: true })
    await started(unrelated, ['U'])
    const fixture = await scenario([{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'P', dependsOn: ['A'] }], { writeEvidence: true })
    fixture.workers.get('A')!.holdAfterAbort = true
    await started(fixture, ['A', 'B', 'C'])
    const owned = ['A', 'B', 'C'].map((id) => fixture.workers.get(id)!.input!.runId)
    const unrelatedRun = unrelated.workers.get('U')!.input!.runId
    for (const runId of [...owned, unrelatedRun]) {
      expect(writes.getFileWrites(runId).size).toBe(1)
      expect(evidence.getRunToolEvidence(runId).fileWrites).toHaveLength(1)
    }
    expect(await conversations.abortRun(fixture.rootId!)).toBe(true)
    await fixture.workers.get('A')!.aborted.promise
    await vi.waitFor(() => { for (const id of ['D', 'E', 'P']) expect(terminal(fixture, id)).toEqual([expect.objectContaining({ status: 'aborted' })]) })
    expect(fixture.events.some((event) => event.type === 'run.end' && event.runId === fixture.rootId)).toBe(false)
    expect(unrelated.workers.get('U')!.signal?.aborted).toBe(false)
    expect(writes.getFileWrites(owned[0]).size).toBe(1)
    fixture.workers.get('A')!.finish.resolve()
    expect((await fixture.ended.promise).status).toBe('aborted')
    for (const id of ['A', 'B', 'C', 'D', 'E', 'P']) expect(terminal(fixture, id)).toHaveLength(1)
    for (const id of ['D', 'E', 'P']) expect(fixture.workers.get(id)?.input).toBeUndefined()
    for (const runId of owned) {
      expect(writes.getFileWrites(runId).size).toBe(0)
      expect(evidence.getRunToolEvidence(runId)).toEqual({ fileWrites: [], commands: [] })
      expect(fixture.events.filter((event) => event.type === 'run.end' && event.runId === runId)).toHaveLength(1)
    }
    expect(writes.getFileWrites(unrelatedRun).size).toBe(1)
    expect(evidence.getRunToolEvidence(unrelatedRun).fileWrites).toHaveLength(1)
    unrelated.workers.get('U')!.finish.resolve()
    expect((await unrelated.ended.promise).status).toBe('complete')
    expect(writes.getFileWrites(unrelatedRun).size).toBe(0)
    expect(evidence.getRunToolEvidence(unrelatedRun)).toEqual({ fileWrites: [], commands: [] })
  })
})

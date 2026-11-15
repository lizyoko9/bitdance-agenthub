import { mkdirSync, mkdtempSync } from 'node:fs'
import path from 'node:path'

import type { StreamEvent } from '../../src/shared/types'
import { DEFAULT_CUSTOM_MAX_TURNS } from '../../src/server/adapters/custom-agent-limits'
import { createEvalRequestPolicy, createEvalToolPolicy, type CustomRequestObservation } from './request-policy'
import type { TrialRequest } from './trial-schema'

export interface TrialProfile {
  dataDir: string
  workerIds: string[]
  orchestratorId: string
  close(): void
}

export interface TrialRuntime extends TrialProfile {
  conversationId: string
  subscribe(listener: (event: StreamEvent) => void): () => void
  start(): Promise<{ runIds: string[] }>
  approvePending(event: StreamEvent): void
  abort(runId: string): Promise<boolean>
}

export interface TrialProfileOptions {
  benchmark?: 'terminalbench' | 'tracetrial'
}

const WORKER_PROMPT = `You are AgentHub's terminal task execution agent. Complete the user's original task inside the bound workspace using the available file and command tools. Inspect relevant files, make necessary changes, and run appropriate checks. Keep the final response concise and accurately report remaining blockers.`
const WORKER_TOOLS = ['fs_list', 'fs_read', 'fs_write', 'bash', 'ask_user']

export async function createIsolatedProfile(
  request: Pick<TrialRequest, 'outputDir' | 'group' | 'modelId'> & Partial<Pick<TrialRequest, 'maxTurns' | 'maxToolCalls' | 'requestLimits' | 'timeoutMs'>>,
  onRequest: (observation: CustomRequestObservation) => void,
  options: TrialProfileOptions = {},
): Promise<TrialProfile> {
  if ((globalThis as { sqlite?: unknown }).sqlite) {
    throw new Error('Headless trial requires a fresh process before database modules are loaded')
  }
  mkdirSync(request.outputDir, { recursive: true })
  const dataDir = mkdtempSync(path.join(request.outputDir, 'state-'))
  process.env.AGENTHUB_DATA_DIR = dataDir
  process.env.AGENTHUB_EVAL_EVIDENCE_GATES = request.group === 'orch-nogate' ? 'off' : 'on'

  const [{ db, schema, sqlite }, agents, { agentRegistry }, { CustomAgentAdapter }] = await Promise.all([
    import('../../src/db/client'),
    import('../../src/server/agent-service'),
    import('../../src/server/adapters/registry'),
    import('../../src/server/adapters/custom-agent-adapter'),
  ])
  try {
    await db.update(schema.skills).set({ isGlobalDefault: false })
    await db.update(schema.agents).set({ skillIds: [] })
    const worker = await agents.createCustomAgent({
      name: options.benchmark === 'tracetrial' ? 'TraceTrial-Bench executor' : 'Terminal-Bench executor',
      avatar: '🛠️',
      description: 'Executes and verifies the official terminal task',
      capabilities: ['terminal', 'coding', 'verification'],
      systemPrompt: WORKER_PROMPT,
      adapterName: 'custom',
      modelProvider: 'openai',
      modelId: request.modelId,
      toolNames: WORKER_TOOLS,
      skillIds: [],
      supportsVision: false,
      apiKey: null,
      apiBaseUrl: null,
    })
    const orchestrator = await agents.updateCustomAgent('ag_orchestrator', {
      adapterName: 'custom',
      modelProvider: 'openai',
      modelId: request.modelId,
      toolNames: ['plan_tasks', 'ask_user', 'fs_list', 'fs_read'],
      skillIds: [],
      supportsVision: false,
      apiKey: null,
      apiBaseUrl: null,
    })
    await db.update(schema.appSettings).set({ openaiApiKey: null })
    agentRegistry.register(new CustomAgentAdapter({
      ...createEvalRequestPolicy(request.requestLimits, onRequest),
      maxTurns: request.maxTurns ?? DEFAULT_CUSTOM_MAX_TURNS,
      requestTimeoutMs: request.timeoutMs,
      ...(request.maxToolCalls === undefined ? {} : { toolPolicy: createEvalToolPolicy(request.maxToolCalls) }),
    }))
    return { dataDir, workerIds: [worker.id], orchestratorId: orchestrator.id, close: () => sqlite.close() }
  } catch (error) {
    sqlite.close()
    throw error
  }
}

export async function loadTrialRuntime(
  request: TrialRequest,
  onRequest: (observation: CustomRequestObservation) => void,
  options: TrialProfileOptions = {},
): Promise<TrialRuntime> {
  const profile = await createIsolatedProfile(request, onRequest, options)
  try {
    const [conversations, { eventBus }, { pendingDispatchPlans }, { pendingBashCommands }, { pendingQuestions }, { pendingWrites }, { flushAllMessageParts }] = await Promise.all([
      import('../../src/server/conversation-service'),
      import('../../src/server/event-bus'),
      import('../../src/server/pending-dispatch-plans'),
      import('../../src/server/pending-bash-commands'),
      import('../../src/server/pending-questions'),
      import('../../src/server/pending-writes'),
      import('../../src/server/message-parts-flusher'),
    ])
    const single = request.group === 'single'
    const conversation = await conversations.createConversation({
      title: `[${options.benchmark === 'tracetrial' ? 'TraceTrial-Bench' : 'Terminal-Bench'}] ${request.taskId} / ${request.group}`,
      mode: single ? 'single' : 'group',
      agentIds: single ? profile.workerIds : [profile.orchestratorId, ...profile.workerIds],
      boundPath: request.cwd,
    })
    await conversations.setConversationApprovalMode(conversation.id, 'auto')
    return {
      ...profile,
      conversationId: conversation.id,
      subscribe: (listener) => eventBus.subscribe(({ event }) => {
        if (event.conversationId === conversation.id) listener(event)
      }),
      start: () => conversations.sendMessage({
        conversationId: conversation.id,
        content: request.instruction,
        mentionedAgentIds: single ? undefined : [profile.orchestratorId],
      }),
      approvePending(event) {
        if (event.type === 'dispatch.plan.pending') {
          const result = pendingDispatchPlans.approve(event.pendingPlan.id)
          if (!result.ok) throw new Error(result.error)
        } else if (event.type === 'bash_command.pending') {
          if (!pendingBashCommands.approve(event.pendingCommand.id)) throw new Error('Pending bash approval not found')
        } else if (event.type === 'fs_write.pending') {
          if (!pendingWrites.approve(event.pendingWrite.id)) throw new Error('Pending write could not be approved')
        } else if (event.type === 'ask_user.pending') {
          const answers = Object.fromEntries(event.pendingQuestion.questions.map((question) => [question.question, {
            selectedLabels: [], freeformNote: '请根据任务信息自行判断并继续，不要再提问。',
          }]))
          if (!pendingQuestions.answer(event.pendingQuestion.id, answers)) throw new Error('Pending question not found')
        }
      },
      abort: conversations.abortRun,
      close() {
        flushAllMessageParts()
        profile.close()
      },
    }
  } catch (error) {
    profile.close()
    throw error
  }
}

import path from 'node:path'
import { statSync } from 'node:fs'

import {
  Codex,
  type FileChangeItem,
  type ApprovalMode,
  type Input as CodexInput,
  type SandboxMode,
  type ThreadEvent,
  type ThreadItem,
  type ThreadOptions,
  type Usage,
} from '@openai/codex-sdk'
import { eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import { recordRunFileWrite } from '@/server/dispatch-run-evidence'
import { getInternalToolToken } from '@/server/internal-tool-auth'
import { newMessageId, newToolCallId } from '@/server/ids'
import { isPathWithin } from '@/server/workspace-utils'
import {
  codexResponsesCompatibilityError,
  isCodexResponsesMissingErrorMessage,
  validateCodexBaseUrl,
} from '@/shared/codex-compat'
import type { ArtifactRecord, DeployStatusRecord, StreamEvent } from '@/shared/types'

import {
  buildCodexChildProcessEnv,
  createAdapterEvent,
  isAbortLikeError,
} from './adapter-utils'
import { adapterSessionKey, codexSessions } from './session-store'
import type { AdapterInput, AgentPlatformAdapter } from './types'

const DEFAULT_MODEL = 'gpt-5-codex'
const PLAN_TASKS_TOOL_NAME = 'plan_tasks'
const CODEX_PLAN_STAGE_AGENTHUB_TOOLS = [
  PLAN_TASKS_TOOL_NAME,
  'ask_user',
  'fs_list',
  'read_artifact',
  'read_attachment',
]

export class CodexAdapter implements AgentPlatformAdapter {
  readonly name = 'codex' as const

  async *stream(input: AdapterInput, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const baseUrlError = validateCodexBaseUrl(input.apiBaseUrl)
    if (baseUrlError) throw new Error(baseUrlError)

    const messageId = newMessageId()
    const baseEvent = createAdapterEvent(input.conversationId)

    yield baseEvent({
      type: 'message.start' as const,
      messageId,
      agentId: input.agentId,
      runId: input.runId,
    })

    const conv = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, input.conversationId),
    })
    const approvalMode = conv?.fsWriteApprovalMode ?? 'review'
    const isPlanStage = input.toolNames.includes(PLAN_TASKS_TOOL_NAME)
    const sandboxMode: SandboxMode =
      isPlanStage || approvalMode !== 'auto' ? 'read-only' : 'workspace-write'
    const approvalPolicy: ApprovalMode = 'never'

    const codexEnv = buildCodexChildProcessEnv()
    const codex = new Codex({
      apiKey: input.apiKey ?? undefined,
      baseUrl: input.apiBaseUrl ?? undefined,
      env: codexEnv,
      config: {
        developer_instructions: buildCodexDeveloperInstructions(input.systemPrompt, isPlanStage),
        mcp_servers: {
          agenthub: {
            command: process.execPath,
            args: [getCodexMcpBridgePath()],
            env: buildCodexMcpEnv(input, codexEnv),
          },
        },
      },
    })

    const sessionKey = adapterSessionKey(input.conversationId, input.agentId)
    const previousThreadId = codexSessions.get(sessionKey)
    const threadOptions: ThreadOptions = {
      workingDirectory: input.workspacePath,
      skipGitRepoCheck: true,
      model: input.modelId ?? DEFAULT_MODEL,
      sandboxMode,
      approvalPolicy,
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
    }
    const thread = previousThreadId
      ? codex.resumeThread(previousThreadId, threadOptions)
      : codex.startThread(threadOptions)

    let nextPartIndex = 0
    const toolCallIdByItemId = new Map<string, string>()
    const completedToolItemIds = new Set<string>()

    try {
      const { events } = await thread.runStreamed(buildCodexInput(input), { signal })
      for await (const event of events) {
        if (event.type === 'thread.started') {
          codexSessions.set(sessionKey, event.thread_id)
          continue
        }
        if (event.type === 'turn.failed') {
          throw new Error(event.error.message)
        }
        if (event.type === 'error') {
          throw new Error(event.message)
        }
        if (event.type === 'turn.completed') {
          yield baseEvent({
            type: 'message.usage' as const,
            messageId,
            usage: toMessageUsage(event.usage),
          })
          yield baseEvent({
            type: 'run.usage' as const,
            runId: input.runId,
            usage: toRunUsage(event.usage, input.modelId ?? DEFAULT_MODEL),
          })
          continue
        }

        const translated = translateItemEvent(event, {
          baseEvent,
          messageId,
          nextPartIndex,
          toolCallIdByItemId,
          completedToolItemIds,
        })
        nextPartIndex = translated.nextPartIndex
        for (const streamEvent of translated.events) {
          yield streamEvent
        }
        if (event.type === 'item.completed' && event.item.type === 'file_change') {
          recordCodexFileChangeEvidence(input, event.item)
        }
        if (event.type === 'item.completed' && event.item.type === 'mcp_tool_call') {
          if (event.item.server === 'agenthub' && event.item.tool === 'write_artifact') {
            const artifactId = parseArtifactIdFromCodexMcpResult(event.item.result)
            if (artifactId) {
              const artifact = await loadArtifactRecord(artifactId)
              if (artifact) {
                yield baseEvent({
                  type: 'artifact.create' as const,
                  artifact,
                })
              }
            }
          }
          if (
            event.item.server === 'agenthub' &&
            (event.item.tool === 'deploy_artifact' || event.item.tool === 'deploy_workspace')
          ) {
            const deployment = parseDeploymentFromCodexMcpResult(event.item.result)
            if (deployment) {
              yield baseEvent({
                type: 'deploy.status' as const,
                messageId,
                deployment,
              })
            }
          }
        }
      }
    } catch (err) {
      if (!isAbortLikeError(err, signal)) throw normalizeCodexError(err)
    }

    yield baseEvent({ type: 'message.end' as const, messageId })
  }
}

function buildCodexDeveloperInstructions(systemPrompt: string, isPlanStage: boolean): string {
  if (isPlanStage) {
    return [
      systemPrompt,
      '',
      '## AgentHub MCP tools',
      'You are in the Orchestrator planning stage. Inspect context with fs_list/read_artifact/read_attachment when needed, ask finite blocking questions with ask_user, then call plan_tasks exactly once.',
      'Do not write files, run commands, deploy, or complete child work in the planning stage. AgentHub will execute the approved plan.',
    ].join('\n')
  }
  return [
    systemPrompt,
    '',
    '## AgentHub MCP tools',
    'When you create a previewable web app, use the AgentHub MCP write_artifact tool with type "web_app". After that, call deploy_artifact with the artifactId so the user receives a deployment status card with open/copy/download actions.',
    'When a visual explanation would clarify a flow, architecture, sequence, or dependency graph, create a diagram artifact with write_artifact type "diagram" and content { syntax: "mermaid", source: "flowchart TD..." }. Quote Mermaid labels containing Chinese, math, parentheses, or punctuation as A["..."], omit Markdown fences, and if write_artifact returns Invalid Mermaid diagram, fix the source and call the tool again.',
    'When you build a local workspace web project, deploy the generated static output directory with deploy_workspace, for example path "dist", "build", "out", or "client/dist". Do not create a web_app artifact just to deploy files that already exist on disk.',
    'Use fs_list to inspect AgentHub workspace directories before reading specific files. Prefer it over shell-specific listing commands.',
    'When progress depends on the user choosing from a finite set of options, use ask_user to present structured choices instead of asking only in plain text. Do not use ask_user for open-ended discussion or non-blocking details.',
    'When you are executing an AgentHub dispatched sub-task, call report_task_result exactly once at the end to report whether the task is complete, failed, or blocked.',
    'deploy_artifact returns previewPath as a local relative path for the current AgentHub instance. Do not convert it into an absolute public URL and do not invent hostnames. In user-facing summaries, tell the user to use the deployment card buttons or quote previewPath exactly.',
  ].join('\n')
}

function recordCodexFileChangeEvidence(input: AdapterInput, item: FileChangeItem): void {
  if (item.status !== 'completed') return

  for (const change of item.changes) {
    if (change.kind === 'delete') continue
    const absolutePath = path.resolve(input.workspacePath, change.path)
    if (!isPathWithin(absolutePath, input.workspacePath)) continue

    let bytes: number
    try {
      bytes = statSync(absolutePath).size
    } catch {
      continue
    }

    recordRunFileWrite(input.runId, {
      path: toCodexWorkspacePath(change.path, input.workspacePath, absolutePath),
      absolutePath,
      bytes,
      applied: 'auto',
    })
  }
}

function toCodexWorkspacePath(changePath: string, workspacePath: string, absolutePath: string): string {
  const relativePath = path.isAbsolute(changePath)
    ? path.relative(workspacePath, absolutePath)
    : changePath
  return relativePath.split(path.sep).join('/')
}

function buildCodexMcpEnv(
  input: AdapterInput,
  baseEnv: Record<string, string>,
): Record<string, string> {
  const allowedTools = getCodexAllowedTools(input)
  return {
    ELECTRON_RUN_AS_NODE: baseEnv.ELECTRON_RUN_AS_NODE ?? process.env.ELECTRON_RUN_AS_NODE ?? '1',
    AGENTHUB_INTERNAL_BASE_URL: getAgentHubInternalBaseUrl(),
    AGENTHUB_INTERNAL_TOOL_TOKEN: getInternalToolToken(),
    AGENTHUB_CONVERSATION_ID: input.conversationId,
    AGENTHUB_AGENT_ID: input.agentId,
    AGENTHUB_RUN_ID: input.runId,
    ...(allowedTools ? { AGENTHUB_ALLOWED_TOOLS: allowedTools } : {}),
    // opt-in 额外能力：仅当该 agent 勾选 install_skill 时暴露给 Codex MCP bridge。
    ...(input.toolNames.includes('install_skill') ? { AGENTHUB_ENABLE_INSTALL_SKILL: '1' } : {}),
  }
}

function getCodexAllowedTools(input: AdapterInput): string | undefined {
  if (!input.toolNames.includes(PLAN_TASKS_TOOL_NAME)) return undefined
  const requested = new Set(input.toolNames)
  return CODEX_PLAN_STAGE_AGENTHUB_TOOLS.filter(
    (toolName) => toolName === PLAN_TASKS_TOOL_NAME || requested.has(toolName),
  ).join(',')
}

function getAgentHubInternalBaseUrl(): string {
  return process.env.AGENTHUB_INTERNAL_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`
}

function getCodexMcpBridgePath(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'scripts', 'agenthub-codex-mcp.mjs')
}

async function loadArtifactRecord(artifactId: string): Promise<ArtifactRecord | null> {
  const row = await db.query.artifacts.findFirst({
    where: eq(schema.artifacts.id, artifactId),
  })
  if (!row) return null
  return {
    id: row.id,
    conversationId: row.conversationId,
    type: row.type,
    title: row.title,
    content: row.content,
    version: row.version,
    parentArtifactId: row.parentArtifactId ?? undefined,
    createdByAgentId: row.createdByAgentId,
    createdAt: row.createdAt,
  }
}

function normalizeCodexError(err: unknown): Error {
  if (err instanceof Error) {
    if (isCodexResponsesMissingErrorMessage(err.message)) {
      return new Error(codexResponsesCompatibilityError(err.message))
    }
    return err
  }
  return new Error(String(err))
}

interface TranslateCtx {
  baseEvent: ReturnType<typeof createAdapterEvent>
  messageId: string
  nextPartIndex: number
  toolCallIdByItemId: Map<string, string>
  completedToolItemIds: Set<string>
}

function translateItemEvent(
  event: ThreadEvent,
  ctx: TranslateCtx,
): { events: StreamEvent[]; nextPartIndex: number } {
  if (
    event.type !== 'item.started' &&
    event.type !== 'item.updated' &&
    event.type !== 'item.completed'
  ) {
    return { events: [], nextPartIndex: ctx.nextPartIndex }
  }

  const item = event.item
  const out: StreamEvent[] = []

  if (isToolLikeItem(item)) {
    const call = ensureToolCall(item, ctx)
    if (call) out.push(call)
    if (event.type === 'item.completed' && !ctx.completedToolItemIds.has(item.id)) {
      ctx.completedToolItemIds.add(item.id)
      const callId = ctx.toolCallIdByItemId.get(item.id)
      if (callId) {
        out.push(
          ctx.baseEvent({
            type: 'tool.result' as const,
            messageId: ctx.messageId,
            callId,
            result: toolResultFor(item),
            isError: isToolItemError(item),
          }),
        )
      }
    }
    return { events: out, nextPartIndex: ctx.nextPartIndex }
  }

  if (event.type !== 'item.completed') {
    return { events: [], nextPartIndex: ctx.nextPartIndex }
  }

  if (item.type === 'agent_message' && item.text.trim()) {
    const partIndex = ctx.nextPartIndex
    out.push(
      ctx.baseEvent({
        type: 'part.start' as const,
        messageId: ctx.messageId,
        partIndex,
        part: { type: 'text' as const, content: item.text },
      }),
      ctx.baseEvent({
        type: 'part.end' as const,
        messageId: ctx.messageId,
        partIndex,
      }),
    )
    return { events: out, nextPartIndex: partIndex + 1 }
  }

  if (item.type === 'reasoning' && item.text.trim()) {
    const partIndex = ctx.nextPartIndex
    out.push(
      ctx.baseEvent({
        type: 'part.start' as const,
        messageId: ctx.messageId,
        partIndex,
        part: { type: 'thinking' as const, content: item.text },
      }),
      ctx.baseEvent({
        type: 'part.end' as const,
        messageId: ctx.messageId,
        partIndex,
      }),
    )
    return { events: out, nextPartIndex: partIndex + 1 }
  }

  if (item.type === 'todo_list' && item.items.length > 0) {
    const partIndex = ctx.nextPartIndex
    const content = item.items
      .map((todo) => `${todo.completed ? '[x]' : '[ ]'} ${todo.text}`)
      .join('\n')
    out.push(
      ctx.baseEvent({
        type: 'part.start' as const,
        messageId: ctx.messageId,
        partIndex,
        part: { type: 'thinking' as const, content },
      }),
      ctx.baseEvent({
        type: 'part.end' as const,
        messageId: ctx.messageId,
        partIndex,
      }),
    )
    return { events: out, nextPartIndex: partIndex + 1 }
  }

  if (item.type === 'error' && item.message.trim()) {
    const partIndex = ctx.nextPartIndex
    out.push(
      ctx.baseEvent({
        type: 'part.start' as const,
        messageId: ctx.messageId,
        partIndex,
        part: { type: 'text' as const, content: `Codex error: ${item.message}` },
      }),
      ctx.baseEvent({
        type: 'part.end' as const,
        messageId: ctx.messageId,
        partIndex,
      }),
    )
    return { events: out, nextPartIndex: partIndex + 1 }
  }

  return { events: out, nextPartIndex: ctx.nextPartIndex }
}

function ensureToolCall(item: ThreadItem, ctx: TranslateCtx): StreamEvent | null {
  const existing = ctx.toolCallIdByItemId.get(item.id)
  if (existing) return null
  const callId = newToolCallId()
  ctx.toolCallIdByItemId.set(item.id, callId)
  return ctx.baseEvent({
    type: 'tool.call' as const,
    messageId: ctx.messageId,
    callId,
    toolName: toolNameFor(item),
    args: toolArgsFor(item),
  })
}

function isToolLikeItem(item: ThreadItem): boolean {
  return (
    item.type === 'command_execution' ||
    item.type === 'file_change' ||
    item.type === 'mcp_tool_call' ||
    item.type === 'web_search'
  )
}

function toolNameFor(item: ThreadItem): string {
  switch (item.type) {
    case 'command_execution':
      return 'codex_command'
    case 'file_change':
      return 'codex_file_change'
    case 'mcp_tool_call':
      return `codex_mcp_${safeToolSegment(item.server)}_${safeToolSegment(item.tool)}`
    case 'web_search':
      return 'codex_web_search'
    default:
      return 'codex_item'
  }
}

function toolArgsFor(item: ThreadItem): unknown {
  switch (item.type) {
    case 'command_execution':
      return { command: item.command }
    case 'file_change':
      return { changes: item.changes }
    case 'mcp_tool_call':
      return { server: item.server, tool: item.tool, arguments: item.arguments }
    case 'web_search':
      return { query: item.query }
    default:
      return {}
  }
}

function toolResultFor(item: ThreadItem): unknown {
  switch (item.type) {
    case 'command_execution':
      return {
        command: item.command,
        output: item.aggregated_output,
        exitCode: item.exit_code ?? null,
        status: item.status,
      }
    case 'file_change':
      return { changes: item.changes, status: item.status }
    case 'mcp_tool_call':
      return item.error
        ? { error: item.error.message, status: item.status }
        : { result: item.result ?? null, status: item.status }
    case 'web_search':
      return { query: item.query, status: 'completed' }
    default:
      return item
  }
}

function isToolItemError(item: ThreadItem): boolean {
  switch (item.type) {
    case 'command_execution':
      return item.status === 'failed' || (item.exit_code ?? 0) !== 0
    case 'file_change':
      return item.status === 'failed'
    case 'mcp_tool_call':
      return item.status === 'failed' || !!item.error
    default:
      return false
  }
}

function buildCodexInput(input: AdapterInput): CodexInput {
  const images =
    input.attachments
      ?.filter((att) => att.kind === 'image')
      .map((att) => ({ type: 'local_image' as const, path: att.absPath })) ?? []
  if (images.length === 0) return input.prompt
  return [{ type: 'text' as const, text: input.prompt }, ...images]
}

function toMessageUsage(usage: Usage) {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cached_input_tokens,
  }
}

function toRunUsage(usage: Usage, model: string) {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationTokens: 0,
    cacheReadTokens: usage.cached_input_tokens,
    lastInputTokens: usage.input_tokens,
    model,
  }
}

function parseArtifactIdFromCodexMcpResult(result: unknown): string | null {
  const parsed = parseCodexMcpJsonResult(result)
  return hasArtifactId(parsed) ? parsed.artifactId : null
}

function parseDeploymentFromCodexMcpResult(result: unknown): DeployStatusRecord | null {
  const parsed = parseCodexMcpJsonResult(result)
  return isDeployStatusRecord(parsed) ? parsed : null
}

function parseCodexMcpJsonResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return null
  const structured = (result as { structured_content?: unknown; structuredContent?: unknown }).structured_content ??
    (result as { structuredContent?: unknown }).structuredContent
  if (structured !== undefined) return structured

  const content = (result as { content?: unknown }).content
  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        'text' in block &&
        typeof (block as { text: unknown }).text === 'string'
      ) {
        try {
          return JSON.parse((block as { text: string }).text)
        } catch {
          continue
        }
      }
    }
  }
  return null
}

function hasArtifactId(value: unknown): value is { artifactId: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'artifactId' in value &&
    typeof (value as { artifactId: unknown }).artifactId === 'string'
  )
}

function isDeployStatusRecord(value: unknown): value is DeployStatusRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    'artifactId' in value &&
    typeof (value as { artifactId: unknown }).artifactId === 'string' &&
    'previewPath' in value &&
    typeof (value as { previewPath: unknown }).previewPath === 'string' &&
    'status' in value &&
    ((value as { status: unknown }).status === 'ready' ||
      (value as { status: unknown }).status === 'failed') &&
    'createdAt' in value &&
    typeof (value as { createdAt: unknown }).createdAt === 'number'
  )
}

function safeToolSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'tool'
}

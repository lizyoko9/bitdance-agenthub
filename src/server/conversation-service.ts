import { accessSync, constants, mkdirSync, statSync } from 'node:fs'
import { rm as fsRm } from 'node:fs/promises'
import path from 'node:path'

import { and, desc, eq, gt, gte, inArray } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type { ConversationWithMeta, MessageRow } from '@/db/schema'
import { PIN_LIMIT_PER_CONVERSATION } from '@/shared/constants'
import type { MessagePart } from '@/shared/types'

import { clearClaudeCodeSession, clearCodexSession } from './adapters/session-store'
import {
  handleDeployCommand,
  parseDeployCommand,
  type DeployCommandResult,
} from './deploy-command-service'
import { eventBus } from './event-bus'
import { flushAllMessageParts } from './message-parts-flusher'
import {
  newConversationId,
  newMessageId,
  newWorkspaceId,
} from './ids'
import { pendingDispatchPlans } from './pending-dispatch-plans'
import { IS_WINDOWS } from './platform'
import { isPathSafe } from './workspace-utils'

// Electron 模式下 main 进程注入 AGENTHUB_DATA_DIR；web / dev 走 cwd 兜底（详见 Spec 12 §5）
const DATA_DIR =
  process.env.AGENTHUB_DATA_DIR ??
  path.resolve(/* turbopackIgnore: true */ process.cwd(), '.agenthub-data')
const WORKSPACES_ROOT = path.join(DATA_DIR, 'workspaces')

async function getAgentRunner() {
  return import('./agent-runner')
}

/**
 * 删除 workspace 目录。Windows 上 EBUSY/EPERM/ENOTEMPTY 走指数退避（详见 specs/11-platform.md）：
 * 进程占用、AV 扫描、`.git/index.lock` 残留等场景下，重试 3 次（100/300/900ms）多数能成功。
 */
async function rmDirWithRetry(target: string): Promise<void> {
  const RETRYABLE = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY'])
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await fsRm(target, { recursive: true, force: true })
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? ''
      if (!RETRYABLE.has(code) || attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 100 * Math.pow(3, attempt - 1)))
    }
  }
}

// ─── 创建会话 ────────────────────────────────────────────
export interface CreateConversationArgs {
  title?: string
  mode: 'single' | 'group'
  agentIds: string[]
  /** 用户指定的本地绝对路径；不填走沙箱（默认） */
  boundPath?: string
}

export async function createConversation(args: CreateConversationArgs): Promise<ConversationWithMeta> {
  if (args.agentIds.length === 0) {
    throw new Error('At least one agent is required')
  }
  if (args.mode === 'single' && args.agentIds.length !== 1) {
    throw new Error('Single conversation requires exactly one agent')
  }
  if (args.mode === 'group' && args.agentIds.length < 2) {
    throw new Error('Group conversation requires at least two agents')
  }

  // 校验 agent 都存在
  const agents = await db.query.agents.findMany({
    where: (a, { inArray }) => inArray(a.id, args.agentIds),
  })
  if (agents.length !== args.agentIds.length) {
    const found = new Set(agents.map((a) => a.id))
    const missing = args.agentIds.filter((id) => !found.has(id))
    throw new Error(`Agents not found: ${missing.join(', ')}`)
  }

  // 解析 boundPath（如果提供）
  let workspaceMode: 'sandbox' | 'local' = 'sandbox'
  let resolvedBoundPath: string | null = null
  if (args.boundPath && args.boundPath.trim()) {
    const raw = args.boundPath.trim()
    // Windows 上必须显式给盘符或 UNC；否则 `/tmp` 会被 path.resolve 当成 `C:\tmp`，不符用户意图
    if (IS_WINDOWS && !/^([A-Za-z]:[\\/]|\\\\)/.test(raw)) {
      throw new Error(
        `boundPath must start with a drive letter (e.g. D:\\projects\\foo) on Windows: ${raw}`,
      )
    }
    const candidate = path.resolve(raw)
    if (!path.isAbsolute(candidate)) {
      throw new Error('boundPath must be absolute')
    }
    let stat
    try {
      stat = statSync(candidate)
    } catch {
      throw new Error(`Path does not exist: ${candidate}`)
    }
    if (!stat.isDirectory()) throw new Error(`Not a directory: ${candidate}`)
    try {
      accessSync(candidate, constants.R_OK | constants.W_OK)
    } catch {
      throw new Error(`Not readable/writable: ${candidate}`)
    }
    if (!isPathSafe(candidate)) {
      throw new Error(`Path is not allowed (system / sensitive directory): ${candidate}`)
    }
    workspaceMode = 'local'
    resolvedBoundPath = candidate
  }

  const now = Date.now()
  const conversationId = newConversationId()
  const workspaceId = newWorkspaceId()
  const rootPath = path.join(WORKSPACES_ROOT, conversationId)

  // 内部 sandbox 目录无论 mode 都要 mkdir，用于 attachments 等内部文件
  mkdirSync(rootPath, { recursive: true })

  const title = args.title ?? defaultTitleFor(agents)

  db.transaction((tx) => {
    tx.insert(schema.conversations)
      .values({
        id: conversationId,
        title,
        mode: args.mode,
        agentIds: args.agentIds,
        pinnedMessageIds: [],
        bookmarkedMessageIds: [],
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    tx.insert(schema.workspaces)
      .values({
        id: workspaceId,
        conversationId,
        rootPath,
        mode: workspaceMode,
        boundPath: resolvedBoundPath,
        createdAt: now,
      })
      .run()
  })

  return {
    id: conversationId,
    title,
    mode: args.mode,
    agentIds: args.agentIds,
    pinnedMessageIds: [],
    bookmarkedMessageIds: [],
    archived: false,
    pinnedAt: null,
    fsWriteApprovalMode: 'review',
    createdAt: now,
    updatedAt: now,
    workspaceMode,
    workspaceBoundPath: resolvedBoundPath,
  }
}

function defaultTitleFor(agents: { name: string }[]): string {
  if (agents.length === 1) return `与 ${agents[0].name} 的对话`
  return agents.map((a) => a.name).join(' / ')
}

/** 给单条 Conversation 行附上 workspace mode / boundPath。 */
async function withWorkspaceMeta(
  conv: typeof schema.conversations.$inferSelect,
): Promise<ConversationWithMeta> {
  const ws = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.conversationId, conv.id),
  })
  return {
    ...conv,
    workspaceMode: (ws?.mode ?? 'sandbox') as 'sandbox' | 'local',
    workspaceBoundPath: ws?.boundPath ?? null,
  }
}

// ─── 列出会话 ────────────────────────────────────────────
export async function listConversations(): Promise<ConversationWithMeta[]> {
  // pinnedAt desc nulls last + updatedAt desc：置顶在前，相互按 pinnedAt 倒序；未置顶按活跃时间
  const convs = await db.query.conversations.findMany({
    orderBy: [
      desc(schema.conversations.pinnedAt),
      desc(schema.conversations.updatedAt),
    ],
  })
  if (convs.length === 0) return []

  // 一次 JOIN 出所有 workspace（每会话 1:1）
  const workspaces = await db.query.workspaces.findMany({
    where: inArray(
      schema.workspaces.conversationId,
      convs.map((c) => c.id),
    ),
  })
  const wsByConv = new Map(workspaces.map((w) => [w.conversationId, w]))

  return convs.map((c) => {
    const ws = wsByConv.get(c.id)
    return {
      ...c,
      workspaceMode: (ws?.mode ?? 'sandbox') as 'sandbox' | 'local',
      workspaceBoundPath: ws?.boundPath ?? null,
    }
  })
}

// ─── 置顶 / 取消置顶 ──────────────────────────────────────
export async function togglePinConversation(
  conversationId: string,
): Promise<ConversationWithMeta> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  const nextPinnedAt = conv.pinnedAt ? null : Date.now()
  await db
    .update(schema.conversations)
    .set({ pinnedAt: nextPinnedAt })
    .where(eq(schema.conversations.id, conversationId))

  return withWorkspaceMeta({ ...conv, pinnedAt: nextPinnedAt })
}

// ─── 归档 / 取消归档 ──────────────────────────────────────
// 归档是会话级元操作，不更新 updatedAt（不应顶到列表前），与 togglePinConversation 一致。
export async function toggleArchiveConversation(
  conversationId: string,
): Promise<ConversationWithMeta> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  const nextArchived = !conv.archived
  await db
    .update(schema.conversations)
    .set({ archived: nextArchived })
    .where(eq(schema.conversations.id, conversationId))

  return withWorkspaceMeta({ ...conv, archived: nextArchived })
}

// ─── 列出会话消息 ────────────────────────────────────────
export async function listMessages(conversationId: string) {
  return listMessagesSnapshot(conversationId).messages
}

/**
 * 消息快照 + 对应的 SSE 事件游标。整段同步执行：游标之前的事件都已反映在快照里，
 * 客户端只需应用游标之后的事件（specs/02「断线恢复」）。
 */
export function listMessagesSnapshot(conversationId: string): { messages: MessageRow[]; eventId: string } {
  const eventId = eventBus.lastEventId()
  flushAllMessageParts()
  const messages = db.query.messages
    .findMany({
      where: eq(schema.messages.conversationId, conversationId),
      orderBy: [schema.messages.createdAt],
    })
    .sync()
  return { messages, eventId }
}

// ─── 删除会话 ────────────────────────────────────────────
export async function deleteConversation(conversationId: string): Promise<void> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.conversationId, conversationId),
  })

  // 删 DB：依赖 cascade 级联清理 messages / artifacts / workspaces / agent_runs
  const deleted = await db
    .delete(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .returning({ id: schema.conversations.id })

  if (deleted.length === 0) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  // 物理删 workspace 目录（不影响 DB 事务，容错）
  if (workspace) {
    try {
      await rmDirWithRetry(workspace.rootPath)
    } catch (err) {
      console.warn(`[deleteConversation] failed to remove workspace dir ${workspace.rootPath}`, err)
    }
  }

  // 清掉 SDK session 缓存
  clearClaudeCodeSession(conversationId)
  clearCodexSession(conversationId)
}

// ─── 清空会话历史 ────────────────────────────────────────
export interface ClearConversationHistoryResult {
  conversation: ConversationWithMeta
  deletedMessageCount: number
  deletedRunCount: number
  deletedSummaryCount: number
}

export async function clearConversationHistory(
  conversationId: string,
): Promise<ClearConversationHistoryResult> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  const activeRuns = await db.query.agentRuns.findMany({
    where: and(
      eq(schema.agentRuns.conversationId, conversationId),
      inArray(schema.agentRuns.status, ['queued', 'running']),
    ),
  })
  if (activeRuns.length > 0) {
    throw new Error('Cannot clear conversation history while agent runs are active')
  }

  const messagesToDelete = await db.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversationId),
  })
  const runsToDelete = await db.query.agentRuns.findMany({
    where: eq(schema.agentRuns.conversationId, conversationId),
  })
  const summariesToDelete = await db.query.contextSummaries.findMany({
    where: eq(schema.contextSummaries.conversationId, conversationId),
  })

  const now = Date.now()
  db.transaction((tx) => {
    tx.delete(schema.contextSummaries)
      .where(eq(schema.contextSummaries.conversationId, conversationId))
      .run()
    tx.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId)).run()
    tx.delete(schema.agentRuns)
      .where(eq(schema.agentRuns.conversationId, conversationId))
      .run()
    tx.update(schema.conversations)
      .set({
        pinnedMessageIds: [],
        bookmarkedMessageIds: [],
        updatedAt: now,
      })
      .where(eq(schema.conversations.id, conversationId))
      .run()
  })

  clearClaudeCodeSession(conversationId)
  clearCodexSession(conversationId)

  return {
    conversation: await withWorkspaceMeta({
      ...conv,
      pinnedMessageIds: [],
      bookmarkedMessageIds: [],
      updatedAt: now,
    }),
    deletedMessageCount: messagesToDelete.length,
    deletedRunCount: runsToDelete.length,
    deletedSummaryCount: summariesToDelete.length,
  }
}

// ─── 重命名会话 ──────────────────────────────────────────
export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<ConversationWithMeta> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  const trimmed = title.trim()
  if (!trimmed) throw new Error('Title cannot be empty')
  if (trimmed.length > 100) throw new Error('Title too long (max 100)')

  const now = Date.now()
  await db
    .update(schema.conversations)
    .set({ title: trimmed, updatedAt: now })
    .where(eq(schema.conversations.id, conversationId))

  return withWorkspaceMeta({ ...conv, title: trimmed, updatedAt: now })
}

// ─── 设置 fs_write 审批模式 ─────────────────────────────
export async function setConversationApprovalMode(
  conversationId: string,
  mode: 'auto' | 'review',
): Promise<ConversationWithMeta> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  const now = Date.now()
  await db
    .update(schema.conversations)
    .set({ fsWriteApprovalMode: mode, updatedAt: now })
    .where(eq(schema.conversations.id, conversationId))

  return withWorkspaceMeta({ ...conv, fsWriteApprovalMode: mode, updatedAt: now })
}

// ─── 书签消息（UI 导航用，不影响 LLM 上下文）────────────────
/**
 * Toggle 一条消息在 conversation.bookmarkedMessageIds 中的存在。
 * 用于 ConversationOutline ☆ 收藏：纯 UI 书签，不向 LLM 注入。
 *
 * （另有 pinnedMessageIds 字段做 LLM 长期上下文注入，语义不同，分开管理。）
 */
export async function toggleBookmarkedMessage(
  conversationId: string,
  messageId: string,
): Promise<{ bookmarkedMessageIds: string[]; bookmarked: boolean }> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  // 校验 message 属于该会话
  const msg = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.id, messageId),
      eq(schema.messages.conversationId, conversationId),
    ),
  })
  if (!msg) throw new Error(`Message not found in conversation: ${messageId}`)

  const current = conv.bookmarkedMessageIds ?? []
  const isBookmarked = current.includes(messageId)
  const next = isBookmarked ? current.filter((id) => id !== messageId) : [...current, messageId]

  await db
    .update(schema.conversations)
    .set({ bookmarkedMessageIds: next, updatedAt: Date.now() })
    .where(eq(schema.conversations.id, conversationId))

  return { bookmarkedMessageIds: next, bookmarked: !isBookmarked }
}

// ─── Pin 消息（注入 LLM 长期上下文）────────────────────────
/**
 * Toggle 一条消息在 conversation.pinnedMessageIds 中的存在。
 * 被 pin 的消息会在 agent-runner 拼 system prompt 时注入 <pinned_messages> 块（见 agent-runner.ts:819）。
 *
 * 与 toggleBookmarkedMessage 的差异：
 *  - 这里有 PIN_LIMIT_PER_CONVERSATION 上限（书签是纯 UI 没上限）
 *  - 不更新 conversations.updated_at（pin 不算「会话活跃」，不应顶到 sidebar 列表前）
 */
export async function togglePinnedMessage(
  conversationId: string,
  messageId: string,
): Promise<{ pinnedMessageIds: string[]; pinned: boolean }> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  const msg = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.id, messageId),
      eq(schema.messages.conversationId, conversationId),
    ),
  })
  if (!msg) throw new Error(`Message not found in conversation: ${messageId}`)

  const current = conv.pinnedMessageIds ?? []
  const isPinned = current.includes(messageId)
  if (!isPinned && current.length >= PIN_LIMIT_PER_CONVERSATION) {
    throw new Error('PIN_LIMIT_EXCEEDED')
  }
  const next = isPinned ? current.filter((id) => id !== messageId) : [...current, messageId]

  await db
    .update(schema.conversations)
    .set({ pinnedMessageIds: next })
    .where(eq(schema.conversations.id, conversationId))

  return { pinnedMessageIds: next, pinned: !isPinned }
}

// ─── 添加 Agent 到现有会话 ──────────────────────────────
export interface AddAgentsArgs {
  conversationId: string
  agentIds: string[]
}

export async function addAgentsToConversation(args: AddAgentsArgs): Promise<ConversationWithMeta> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, args.conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${args.conversationId}`)

  // 校验新 agent 存在
  const found = await db.query.agents.findMany({
    where: (a, { inArray }) => inArray(a.id, args.agentIds),
  })
  if (found.length !== args.agentIds.length) {
    const foundSet = new Set(found.map((a) => a.id))
    const missing = args.agentIds.filter((id) => !foundSet.has(id))
    throw new Error(`Agents not found: ${missing.join(', ')}`)
  }

  // 去重合并
  const merged = Array.from(new Set([...conv.agentIds, ...args.agentIds]))
  const newMode = merged.length >= 2 ? 'group' : 'single'

  const now = Date.now()
  await db
    .update(schema.conversations)
    .set({ agentIds: merged, mode: newMode, updatedAt: now })
    .where(eq(schema.conversations.id, args.conversationId))

  return withWorkspaceMeta({
    ...conv,
    agentIds: merged,
    mode: newMode,
    updatedAt: now,
  })
}

// ─── 发消息 ──────────────────────────────────────────────
export interface SendMessageArgs {
  conversationId: string
  content: string
  mentionedAgentIds?: string[]
  parentMessageId?: string
  attachmentIds?: string[]
}

export interface SendMessageResult {
  messageId: string
  runIds: string[]
  messages?: MessageRow[]
  deploy?: DeployCommandResult
}

export async function sendMessage(args: SendMessageArgs): Promise<SendMessageResult> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, args.conversationId),
  })
  if (!conv) {
    throw new Error(`Conversation not found: ${args.conversationId}`)
  }

  const now = Date.now()
  const messageId = newMessageId()
  const parts: MessagePart[] = []
  if (args.content && args.content.trim()) {
    parts.push({ type: 'text', content: args.content })
  }

  // 把附件作为新 parts 加到 message
  if (args.attachmentIds && args.attachmentIds.length > 0) {
    const rows = await db.query.attachments.findMany({
      where: (a, { inArray }) => inArray(a.id, args.attachmentIds!),
    })
    for (const r of rows) {
      if (r.conversationId !== args.conversationId) continue // 防越权引用其他会话的附件
      parts.push(
        r.kind === 'image'
          ? {
              type: 'image_attachment',
              attachmentId: r.id,
              fileName: r.fileName,
              size: r.size,
              mimeType: r.mimeType,
            }
          : {
              type: 'file_attachment',
              attachmentId: r.id,
              fileName: r.fileName,
              size: r.size,
              mimeType: r.mimeType,
            },
      )
    }
  }

  await db.insert(schema.messages).values({
    id: messageId,
    conversationId: args.conversationId,
    role: 'user',
    parts,
    status: 'complete',
    mentionedAgentIds: args.mentionedAgentIds ?? [],
    parentMessageId: args.parentMessageId ?? null,
    createdAt: now,
  })

  await db
    .update(schema.conversations)
    .set({ updatedAt: now })
    .where(eq(schema.conversations.id, args.conversationId))

  // 广播新用户消息：消息已落库，这条事件让其它已连接客户端（如桌面端看手机端发来的消息）实时插入。
  // 发送方自己靠乐观更新 + POST 返回值对账；按 id 幂等，重复收到无副作用。详见 specs/02。
  eventBus.publish({
    type: 'message.added',
    conversationId: args.conversationId,
    timestamp: now,
    message: {
      id: messageId,
      conversationId: args.conversationId,
      role: 'user',
      agentId: null,
      parts,
      status: 'complete',
      parentMessageId: args.parentMessageId ?? null,
      mentionedAgentIds: args.mentionedAgentIds ?? [],
      runId: null,
      usage: null,
      createdAt: now,
    },
  })

  const deployIntent =
    parts.length === 1 &&
    !args.parentMessageId &&
    !(args.mentionedAgentIds && args.mentionedAgentIds.length > 0) &&
    !(args.attachmentIds && args.attachmentIds.length > 0)
      ? parseDeployCommand(args.content)
      : null
  if (deployIntent) {
    const deploy = await handleDeployCommand({
      conversationId: args.conversationId,
      artifactId: deployIntent.artifactId,
      afterCreatedAt: now,
    })
    return { messageId, runIds: [], messages: [deploy.message], deploy }
  }

  // 决定 responder
  const agentsInConv = await db.query.agents.findMany({
    where: (a, { inArray }) => inArray(a.id, conv.agentIds),
  })
  const responders = decideResponders(conv, args.mentionedAgentIds ?? [], agentsInConv)

  const runIds: string[] = []
  const { AgentRunner } = await getAgentRunner()
  for (const agentId of responders) {
    const { runId } = AgentRunner.run({
      agentId,
      conversationId: args.conversationId,
      triggerMessageId: messageId,
    })
    runIds.push(runId)
  }

  return { messageId, runIds }
}

/**
 * 对话式修改待审计划：把用户的自然语言反馈作为一条 user 消息落库并广播（进对话、跨端可见），
 * 再交回正在 await 的 Orchestrator run 重排。不触发新 run（现有 run 会自己续上并发出新 plan）。
 */
export async function reviseDispatchPlan(args: {
  conversationId: string
  planId: string
  feedback: string
}): Promise<{ ok: boolean; error?: string }> {
  const pending = pendingDispatchPlans.get(args.planId)
  if (!pending || pending.conversationId !== args.conversationId) {
    return { ok: false, error: 'Pending dispatch plan not found' }
  }

  const messageId = newMessageId()
  const now = Date.now()
  const parts: MessagePart[] = [{ type: 'text', content: args.feedback }]
  await db.insert(schema.messages).values({
    id: messageId,
    conversationId: args.conversationId,
    role: 'user',
    parts,
    status: 'complete',
    mentionedAgentIds: [],
    parentMessageId: null,
    createdAt: now,
  })
  await db
    .update(schema.conversations)
    .set({ updatedAt: now })
    .where(eq(schema.conversations.id, args.conversationId))
  eventBus.publish({
    type: 'message.added',
    conversationId: args.conversationId,
    timestamp: now,
    message: {
      id: messageId,
      conversationId: args.conversationId,
      role: 'user',
      agentId: null,
      parts,
      status: 'complete',
      parentMessageId: null,
      mentionedAgentIds: [],
      runId: null,
      usage: null,
      createdAt: now,
    },
  })

  const ok = pendingDispatchPlans.revise(args.planId, args.feedback)
  return ok ? { ok: true } : { ok: false, error: 'Failed to revise pending dispatch plan' }
}

function decideResponders(
  conv: typeof schema.conversations.$inferSelect,
  mentions: string[],
  agentsInConv: { id: string; isOrchestrator: boolean }[],
): string[] {
  // 单聊：直接交给那个 agent
  if (conv.mode === 'single') return conv.agentIds

  // 群聊有 @ 时，被 @ 的 agent 各自响应
  if (mentions.length > 0) {
    return mentions.filter((id) => conv.agentIds.includes(id))
  }

  // 群聊无 @ 时：交给群里的 Orchestrator
  const orchestrator = agentsInConv.find((a) => a.isOrchestrator)
  return orchestrator ? [orchestrator.id] : []
}

// ─── 中止 run ────────────────────────────────────────────
export async function abortRun(runId: string): Promise<boolean> {
  const { AgentRunner } = await getAgentRunner()
  return AgentRunner.abort(runId)
}

// ─── 撤回 / 编辑最后一条 user 消息 ──────────────────────
export interface WithdrawResult {
  deletedMessageIds: string[]
  deletedArtifactIds: string[]
}

/**
 * 撤回会话中**最后一条** user 消息，及其触发的所有下游 agent message + artifact。
 *
 * 处理逻辑：
 *  1. 校验 messageId 是会话最后一条 user 消息
 *  2. abort 所有运行中 run（fire-and-forget）
 *  3. wait 500ms 让 AgentRunner.finalize 跑完（避免 emitErrorVisualisation 后插的死消息漏删）
 *  4. 时间窗删除：DELETE messages / artifacts / agent_runs WHERE created_at/started_at >= userMsg.createdAt
 */
export async function withdrawLatestUserMessage(
  conversationId: string,
  messageId: string,
): Promise<WithdrawResult> {
  const msg = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.id, messageId),
      eq(schema.messages.conversationId, conversationId),
    ),
  })
  if (!msg) throw new Error(`Message not found: ${messageId}`)
  if (msg.role !== 'user') throw new Error('Only user messages can be withdrawn')

  // 校验是会话最后一条 user message（防误操作 / 防过期请求）
  const latestUser = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.conversationId, conversationId),
      eq(schema.messages.role, 'user'),
    ),
    orderBy: [desc(schema.messages.createdAt)],
  })
  if (!latestUser || latestUser.id !== messageId) {
    throw new Error('Only the latest user message can be withdrawn')
  }

  // 先收集 running run 调 abort（fire-and-forget）
  const runsToAbort = await db.query.agentRuns.findMany({
    where: and(
      eq(schema.agentRuns.conversationId, conversationId),
      gte(schema.agentRuns.startedAt, msg.createdAt),
      eq(schema.agentRuns.status, 'running'),
    ),
  })
  if (runsToAbort.length > 0) {
    const { AgentRunner } = await getAgentRunner()
    for (const r of runsToAbort) AgentRunner.abort(r.id)
    // 让 finalize 跑完，把 emitErrorVisualisation 的 msg_err_* 也落进时间窗
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // 撤回会让 SDK session 中保存的「user msg → agent reply」对儿和 DB 不一致；清掉重来
  clearClaudeCodeSession(conversationId)
  clearCodexSession(conversationId)

  // 重新扫一遍待删的 ids（含 wait 期间补写入的死消息）
  const messagesToDelete = await db.query.messages.findMany({
    where: and(
      eq(schema.messages.conversationId, conversationId),
      gte(schema.messages.createdAt, msg.createdAt),
    ),
  })
  const messageIds = messagesToDelete.map((m) => m.id)

  // 从 parts 提取 artifact_ref 拿到要删的 artifact id
  const artifactIds = new Set<string>()
  for (const m of messagesToDelete) {
    for (const p of m.parts) {
      if (p.type === 'artifact_ref') artifactIds.add(p.artifactId)
    }
  }

  const runsToDelete = await db.query.agentRuns.findMany({
    where: and(
      eq(schema.agentRuns.conversationId, conversationId),
      gte(schema.agentRuns.startedAt, msg.createdAt),
    ),
  })
  const runIds = runsToDelete.map((r) => r.id)

  db.transaction((tx) => {
    if (messageIds.length > 0) {
      tx.delete(schema.messages).where(inArray(schema.messages.id, messageIds)).run()
    }
    if (artifactIds.size > 0) {
      tx.delete(schema.artifacts)
        .where(inArray(schema.artifacts.id, [...artifactIds]))
        .run()
    }
    if (runIds.length > 0) {
      tx.delete(schema.agentRuns).where(inArray(schema.agentRuns.id, runIds)).run()
    }
  })

  // 广播删除：让其它已连接客户端（尤其桌面端）实时移除被撤回/编辑掉的消息及其产物。
  // 同时覆盖编辑路径——editAndResendLatestUserMessage 内部就是调本函数删除的。
  eventBus.publish({
    type: 'message.removed',
    conversationId,
    timestamp: Date.now(),
    messageIds,
    artifactIds: [...artifactIds],
  })

  return { deletedMessageIds: messageIds, deletedArtifactIds: [...artifactIds] }
}

export interface EditAndResendResult extends WithdrawResult {
  newMessage: typeof schema.messages.$inferSelect
  runIds: string[]
}

// ─── 重新生成最后一次 agent 响应 ──────────────────────────
/**
 * 删除最后一条 user 消息之后的所有 agent message + agent_runs + artifact_ref，
 * 然后以同一条 user 消息为触发，重启 AgentRunner（responders 重新决定）。
 *
 * 用 case：用户对最后一个 agent 回答不满意，点「重新生成」让 agent 再答一次。
 */
export interface RegenerateResult extends WithdrawResult {
  triggerMessageId: string
  runIds: string[]
}
export async function regenerateLatestResponse(
  conversationId: string,
): Promise<RegenerateResult> {
  const conv = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  })
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`)

  // 取最后一条 user message —— 我们要保留它，删它之后的所有
  const latestUser = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.conversationId, conversationId),
      eq(schema.messages.role, 'user'),
    ),
    orderBy: [desc(schema.messages.createdAt)],
  })
  if (!latestUser) throw new Error('No user message to regenerate from')

  // abort 任何还在跑的 run（不一定有）
  const runsToAbort = await db.query.agentRuns.findMany({
    where: and(
      eq(schema.agentRuns.conversationId, conversationId),
      gt(schema.agentRuns.startedAt, latestUser.createdAt),
      eq(schema.agentRuns.status, 'running'),
    ),
  })
  if (runsToAbort.length > 0) {
    const { AgentRunner } = await getAgentRunner()
    for (const r of runsToAbort) AgentRunner.abort(r.id)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // 重新生成等价于「让 agent 对同一个 user msg 重新作答」，SDK session 里那个旧 reply 要扔；清掉重新开 session
  clearClaudeCodeSession(conversationId)
  clearCodexSession(conversationId)

  // 删除 latestUser 之后的所有 message（保留 latestUser 本身）
  const messagesToDelete = await db.query.messages.findMany({
    where: and(
      eq(schema.messages.conversationId, conversationId),
      gt(schema.messages.createdAt, latestUser.createdAt),
    ),
  })
  const messageIds = messagesToDelete.map((m) => m.id)

  const artifactIds = new Set<string>()
  for (const m of messagesToDelete) {
    for (const p of m.parts) {
      if (p.type === 'artifact_ref') artifactIds.add(p.artifactId)
    }
  }

  const runsToDelete = await db.query.agentRuns.findMany({
    where: and(
      eq(schema.agentRuns.conversationId, conversationId),
      gt(schema.agentRuns.startedAt, latestUser.createdAt),
    ),
  })
  const runIds = runsToDelete.map((r) => r.id)

  db.transaction((tx) => {
    if (messageIds.length > 0) {
      tx.delete(schema.messages).where(inArray(schema.messages.id, messageIds)).run()
    }
    if (artifactIds.size > 0) {
      tx.delete(schema.artifacts)
        .where(inArray(schema.artifacts.id, [...artifactIds]))
        .run()
    }
    if (runIds.length > 0) {
      tx.delete(schema.agentRuns).where(inArray(schema.agentRuns.id, runIds)).run()
    }
  })

  // 广播删除：在启动新 run 之前发，保证其它客户端「先移除旧回复，再收到新回复」。
  eventBus.publish({
    type: 'message.removed',
    conversationId,
    timestamp: Date.now(),
    messageIds,
    artifactIds: [...artifactIds],
  })

  // 重新决定 responders（沿用 sendMessage 的 decideResponders）
  const agentsInConv = await db.query.agents.findMany({
    where: (a, { inArray: inArr }) => inArr(a.id, conv.agentIds),
  })
  const responders = decideResponders(conv, latestUser.mentionedAgentIds, agentsInConv)

  const newRunIds: string[] = []
  const { AgentRunner } = await getAgentRunner()
  for (const agentId of responders) {
    const { runId } = AgentRunner.run({
      agentId,
      conversationId,
      triggerMessageId: latestUser.id,
    })
    newRunIds.push(runId)
  }

  return {
    deletedMessageIds: messageIds,
    deletedArtifactIds: [...artifactIds],
    triggerMessageId: latestUser.id,
    runIds: newRunIds,
  }
}

/**
 * 编辑最后一条 user 消息：先撤回，再用新内容重新 sendMessage（保留原 mentions / parent / attachments）。
 */
export async function editAndResendLatestUserMessage(
  conversationId: string,
  messageId: string,
  newContent: string,
): Promise<EditAndResendResult> {
  const trimmed = newContent.trim()
  if (!trimmed) throw new Error('Content cannot be empty')

  const original = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.id, messageId),
      eq(schema.messages.conversationId, conversationId),
    ),
  })
  if (!original) throw new Error(`Message not found: ${messageId}`)
  if (original.role !== 'user') throw new Error('Only user messages can be edited')

  // 从原 message 提取附件 id（image_attachment + file_attachment）
  const attachmentIds: string[] = []
  for (const p of original.parts) {
    if (p.type === 'image_attachment' || p.type === 'file_attachment') {
      attachmentIds.push(p.attachmentId)
    }
  }

  const withdrawn = await withdrawLatestUserMessage(conversationId, messageId)

  const sent = await sendMessage({
    conversationId,
    content: trimmed,
    mentionedAgentIds: original.mentionedAgentIds,
    parentMessageId: original.parentMessageId ?? undefined,
    attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
  })

  // 把新写入的 user message row 完整读出来返给发送方做即时对账（其它客户端由 sendMessage 内的 message.added 广播补上）
  const newMessage = await db.query.messages.findFirst({
    where: eq(schema.messages.id, sent.messageId),
  })
  if (!newMessage) throw new Error('New message disappeared after insert')

  return {
    ...withdrawn,
    newMessage,
    runIds: sent.runIds,
  }
}

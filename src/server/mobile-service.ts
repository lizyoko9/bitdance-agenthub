import { and, desc, eq, inArray } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type { AgentRunRow, ConversationWithMeta } from '@/db/schema'
import { listAgentsOrdered } from '@/server/agent-service'
import {
  editAndResendLatestUserMessage,
  listConversations,
  listMessages,
  regenerateLatestResponse,
  sendMessage,
  withdrawLatestUserMessage,
} from '@/server/conversation-service'
import { pendingQuestions } from '@/server/pending-questions'
import { pendingWrites } from '@/server/pending-writes'
import type {
  ArtifactContent,
  ArtifactType,
  DeployCandidateRecord,
  MessagePart,
  PendingQuestion,
  PendingWrite,
} from '@/shared/types'

import packageJson from '../../package.json'

export interface MobileConversationSummary {
  id: string
  title: string
  mode: 'single' | 'group'
  updatedAt: number
  runningRunCount: number
  pendingWriteCount: number
  pendingQuestionCount: number
}

export interface MobileAgent {
  id: string
  name: string
  avatar: string
  description: string
  isOrchestrator: boolean
}

export interface MobileRun {
  id: string
  conversationId: string
  agentId: string
  status: 'queued' | 'running' | 'complete' | 'failed' | 'aborted'
  startedAt: number
}

export type MobileMessagePart =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; callId: string; toolName: string }
  | { type: 'tool_result'; callId: string; isError: boolean }
  | { type: 'artifact_ref'; artifactId: string }
  | {
      type: 'deploy_status'
      title: string
      version: number
      sourceType?: 'artifact' | 'workspace'
      workspacePath?: string
      previewPath: string
      status: 'ready' | 'failed'
      error?: string
    }
  | { type: 'deploy_candidates'; candidates: DeployCandidateRecord[] }
  | { type: 'attachment'; fileName: string; kind: 'image' | 'file' }

export interface MobileArtifactSummary {
  id: string
  type: ArtifactType
  title: string
  version: number
  createdAt: number
}

export interface MobileArtifact extends MobileArtifactSummary {
  conversationId: string
  content: ArtifactContent
  parentArtifactId?: string
  createdByAgentId: string
}

export interface MobileMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  agentId: string | null
  parts: MobileMessagePart[]
  status: 'streaming' | 'complete' | 'error' | 'aborted'
  createdAt: number
}

export interface MobileConversationDetail {
  conversation: {
    id: string
    title: string
    mode: 'single' | 'group'
    agentIds: string[]
    updatedAt: number
  }
  messages: MobileMessage[]
  artifacts: MobileArtifactSummary[]
  runningRuns: MobileRun[]
  pendingWrites: MobilePendingWrite[]
  pendingQuestions: MobilePendingQuestion[]
}

export interface MobilePendingWrite {
  id: string
  conversationId: string
  agentId: string
  runId: string
  path: string
  oldContent: string | null
  newContent: string
  createdAt: number
}

export interface MobilePendingQuestion {
  id: string
  conversationId: string
  agentId: string
  runId: string
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description?: string }>
    multiSelect?: boolean
  }>
  createdAt: number
}

export interface MobileSnapshot {
  conversations: MobileConversationSummary[]
  agents: MobileAgent[]
  runningRuns: MobileRun[]
  pendingWrites: MobilePendingWrite[]
  pendingQuestions: MobilePendingQuestion[]
  server: {
    version: string
    companionMode: 'lan' | 'tailnet'
  }
}

export async function getMobileSnapshot(): Promise<MobileSnapshot> {
  const [conversations, agents] = await Promise.all([
    listConversations(),
    listAgentsOrdered(),
  ])

  const runningRuns = await listActiveRuns(conversations.map((conversation) => conversation.id))
  const pendingWritesByConversation = collectPendingWrites(conversations)
  const pendingQuestionsByConversation = collectPendingQuestions(conversations)

  return {
    conversations: conversations.map((conversation) =>
      toMobileConversation(
        conversation,
        runningRuns,
        pendingWritesByConversation.get(conversation.id) ?? [],
        pendingQuestionsByConversation.get(conversation.id) ?? [],
      ),
    ),
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      description: agent.description,
      isOrchestrator: agent.isOrchestrator,
    })),
    runningRuns: runningRuns.map(toMobileRun),
    pendingWrites: Array.from(pendingWritesByConversation.values())
      .flat()
      .map(toMobilePendingWrite),
    pendingQuestions: Array.from(pendingQuestionsByConversation.values())
      .flat()
      .map(toMobilePendingQuestion),
    server: {
      version: packageJson.version,
      companionMode: process.env.AGENTHUB_COMPANION_MODE === 'tailnet' ? 'tailnet' : 'lan',
    },
  }
}

export async function getMobileConversationDetail(
  conversationId: string,
): Promise<MobileConversationDetail> {
  const conversations = await listConversations()
  const conversation = conversations.find((item) => item.id === conversationId)
  if (!conversation) throw new Error(`Conversation not found: ${conversationId}`)

  const [messages, runningRuns] = await Promise.all([
    listMessages(conversationId),
    listActiveRuns([conversationId]),
  ])
  const artifacts = await listMobileArtifactSummaries(extractArtifactIds(messages.flatMap((message) => message.parts)))
  const writes = pendingWrites.listByConversation(conversationId)
  const questions = pendingQuestions.listByConversation(conversationId)

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      mode: conversation.mode,
      agentIds: conversation.agentIds,
      updatedAt: conversation.updatedAt,
    },
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      agentId: message.agentId,
      parts: message.parts.map(toMobileMessagePart),
      status: message.status,
      createdAt: message.createdAt,
    })),
    artifacts,
    runningRuns: runningRuns.map(toMobileRun),
    pendingWrites: writes.map(toMobilePendingWrite),
    pendingQuestions: questions.map(toMobilePendingQuestion),
  }
}

export async function getMobileArtifact(artifactId: string): Promise<MobileArtifact> {
  const artifact = await db.query.artifacts.findFirst({
    where: eq(schema.artifacts.id, artifactId),
  })
  if (!artifact) throw new Error(`Artifact not found: ${artifactId}`)

  return {
    id: artifact.id,
    conversationId: artifact.conversationId,
    type: artifact.type,
    title: artifact.title,
    content: artifact.content as ArtifactContent,
    version: artifact.version,
    parentArtifactId: artifact.parentArtifactId ?? undefined,
    createdByAgentId: artifact.createdByAgentId,
    createdAt: artifact.createdAt,
  }
}

export async function sendMobileMessage(args: {
  conversationId: string
  content: string
}): Promise<{ messageId: string; runIds: string[] }> {
  return sendMessage({
    conversationId: args.conversationId,
    content: args.content,
  })
}

// 撤回 / 编辑 / 重新生成：复用桌面的服务函数（仅作用于最新可操作消息）。删除会经
// message.removed 广播给其它客户端；移动端自身靠操作后 refetch 收敛。
export async function withdrawMobileMessage(args: { conversationId: string; messageId: string }) {
  return withdrawLatestUserMessage(args.conversationId, args.messageId)
}

export async function editMobileMessage(args: {
  conversationId: string
  messageId: string
  content: string
}) {
  return editAndResendLatestUserMessage(args.conversationId, args.messageId, args.content)
}

export async function regenerateMobileResponse(args: { conversationId: string }) {
  return regenerateLatestResponse(args.conversationId)
}

async function listActiveRuns(conversationIds: string[]): Promise<AgentRunRow[]> {
  if (conversationIds.length === 0) return []
  return db.query.agentRuns.findMany({
    where: and(
      inArray(schema.agentRuns.conversationId, conversationIds),
      inArray(schema.agentRuns.status, ['queued', 'running']),
    ),
    orderBy: [desc(schema.agentRuns.startedAt)],
  })
}

function collectPendingWrites(
  conversations: ConversationWithMeta[],
): Map<string, PendingWrite[]> {
  return new Map(
    conversations.map((conversation) => [
      conversation.id,
      pendingWrites.listByConversation(conversation.id),
    ]),
  )
}

function collectPendingQuestions(
  conversations: ConversationWithMeta[],
): Map<string, PendingQuestion[]> {
  return new Map(
    conversations.map((conversation) => [
      conversation.id,
      pendingQuestions.listByConversation(conversation.id),
    ]),
  )
}

function toMobileConversation(
  conversation: ConversationWithMeta,
  runningRuns: AgentRunRow[],
  writes: PendingWrite[],
  questions: PendingQuestion[],
): MobileConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    mode: conversation.mode,
    updatedAt: conversation.updatedAt,
    runningRunCount: runningRuns.filter((run) => run.conversationId === conversation.id).length,
    pendingWriteCount: writes.length,
    pendingQuestionCount: questions.length,
  }
}

function toMobileRun(run: AgentRunRow): MobileRun {
  return {
    id: run.id,
    conversationId: run.conversationId,
    agentId: run.agentId,
    status: run.status,
    startedAt: run.startedAt,
  }
}

function toMobileMessagePart(part: MessagePart): MobileMessagePart {
  switch (part.type) {
    case 'text':
      return { type: 'text', content: part.content }
    case 'code':
      return { type: 'code', language: part.language, content: part.content }
    case 'thinking':
      return { type: 'thinking', content: part.content }
    case 'tool_use':
      return { type: 'tool_use', callId: part.callId, toolName: part.toolName }
    case 'tool_result':
      return { type: 'tool_result', callId: part.callId, isError: part.isError }
    case 'artifact_ref':
      return { type: 'artifact_ref', artifactId: part.artifactId }
    case 'deploy_status':
      return {
        type: 'deploy_status',
        title: part.deployment.title,
        version: part.deployment.version,
        sourceType: part.deployment.sourceType,
        workspacePath: part.deployment.workspacePath,
        previewPath: part.deployment.previewPath,
        status: part.deployment.status,
        error: part.deployment.error,
      }
    case 'deploy_candidates':
      return { type: 'deploy_candidates', candidates: part.candidates }
    case 'delivery_acceptance': {
      const labels = {
        pending: '交付验收中', pass: '交付验收通过', fail: '交付未通过',
        unverified: '交付未验证', not_run: '交付未执行验收',
      }
      const acceptance = part.acceptance
      const detail = acceptance.reason ?? acceptance.checks?.find((check) => check.status !== 'pass')?.location
      return { type: 'text', content: labels[acceptance.status] + (detail ? ' · ' + detail : '') }
    }
    case 'image_attachment':
      return { type: 'attachment', fileName: part.fileName, kind: 'image' }
    case 'file_attachment':
      return { type: 'attachment', fileName: part.fileName, kind: 'file' }
  }
}

function extractArtifactIds(parts: MessagePart[]): string[] {
  return Array.from(
    new Set(
      parts.flatMap((part) => (part.type === 'artifact_ref' ? [part.artifactId] : [])),
    ),
  )
}

async function listMobileArtifactSummaries(artifactIds: string[]): Promise<MobileArtifactSummary[]> {
  if (artifactIds.length === 0) return []
  const rows = await db.query.artifacts.findMany({
    where: inArray(schema.artifacts.id, artifactIds),
  })
  const order = new Map(artifactIds.map((id, index) => [id, index]))
  return rows
    .map((artifact) => ({
      id: artifact.id,
      type: artifact.type,
      title: artifact.title,
      version: artifact.version,
      createdAt: artifact.createdAt,
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

function toMobilePendingWrite(write: PendingWrite): MobilePendingWrite {
  return {
    id: write.id,
    conversationId: write.conversationId,
    agentId: write.agentId,
    runId: write.runId,
    path: write.path,
    oldContent: write.oldContent,
    newContent: write.newContent,
    createdAt: write.createdAt,
  }
}

function toMobilePendingQuestion(question: PendingQuestion): MobilePendingQuestion {
  return {
    id: question.id,
    conversationId: question.conversationId,
    agentId: question.agentId,
    runId: question.runId,
    questions: question.questions.map((item) => ({
      question: item.question,
      header: item.header,
      options: item.options.map((option) => ({
        label: option.label,
        description: option.description,
      })),
      multiSelect: item.multiSelect,
    })),
    createdAt: question.createdAt,
  }
}

import type {
  AgentRow,
  AppSettingsRow,
  ArtifactRow,
  AttachmentRow,
  ConversationWithMeta,
  ContextSummaryRow,
  MessageRow,
  SkillRow,
} from '@/db/schema'
import type {
  AskUserAnswer,
  DeployCandidateRecord,
  DeployStatusRecord,
  PendingBashCommand,
  PendingDispatchPlan,
  PendingQuestion,
  PendingSkillInstall,
  PendingWrite,
} from '@/shared/types'
import type { AgentConfigDraft, AgentDraftRequest } from '@/shared/agent-builder-config'

export interface ArtifactListItem {
  id: string
  conversationId: string
  conversationTitle: string | null
  type: string
  title: string
  version: number
  parentArtifactId: string | null
  createdByAgentId: string
  createdAt: number
}

async function json<T>(req: Promise<Response>): Promise<T> {
  const res = await req
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ─── Agents ─────────────────────────────────────
export async function fetchAgents(): Promise<AgentRow[]> {
  const { agents } = await json<{ agents: AgentRow[] }>(fetch('/api/agents'))
  return agents
}

export interface CreateAgentBody {
  name: string
  avatar: string
  description: string
  capabilities: string[]
  systemPrompt: string
  /** 默认 'custom'。SDK adapter 使用各自内置工具集 */
  adapterName?: 'custom' | 'claude-code' | 'codex'
  /** custom: required；SDK adapter: 忽略 */
  modelProvider?: 'anthropic' | 'openai' | 'deepseek' | 'volcano-ark' | 'openai-compatible'
  /** custom: required；SDK adapter: 可选，默认 SDK 默认模型 */
  modelId?: string
  toolNames: string[]
  /** 选用的 Skill id；对所有 adapter 生效 */
  skillIds?: string[]
  supportsVision?: boolean
  apiKey?: string
  /** 自定义 API base URL。Claude/Codex 对 endpoint 协议兼容性要求不同；空走默认 */
  apiBaseUrl?: string
}

export async function createAgent(body: CreateAgentBody): Promise<AgentRow> {
  const { agent } = await json<{ agent: AgentRow }>(
    fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agent
}

export async function fetchSkills(opts?: { all?: boolean }): Promise<SkillRow[]> {
  const url = opts?.all ? '/api/skills?all=1' : '/api/skills'
  const { skills } = await json<{ skills: SkillRow[] }>(fetch(url))
  return skills
}

/** 市场/库管理视图：全部 Skill + 每条被多少 agent 使用（公共 = 全部 agent）。 */
export async function fetchSkillsWithUsage(): Promise<{
  skills: SkillRow[]
  usage: Record<string, number>
}> {
  return json<{ skills: SkillRow[]; usage: Record<string, number> }>(fetch('/api/skills?all=1'))
}

export interface CreateSkillBody {
  name: string
  description: string
  category: string
  instruction: string
  requiredToolNames?: string[]
  isGlobalDefault?: boolean
}

export async function createSkill(body: CreateSkillBody): Promise<SkillRow> {
  const { skill } = await json<{ skill: SkillRow }>(
    fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return skill
}

export type UpdateSkillBody = Partial<CreateSkillBody> & {
  enabled?: boolean
  isGlobalDefault?: boolean
}

export async function updateSkill(skillId: string, body: UpdateSkillBody): Promise<SkillRow> {
  const { skill } = await json<{ skill: SkillRow }>(
    fetch(`/api/skills/${skillId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return skill
}

export async function deleteSkill(skillId: string): Promise<void> {
  await json<{ ok: true }>(fetch(`/api/skills/${skillId}`, { method: 'DELETE' }))
}

/** 从精选目录安装一个 Skill：服务端经 skill-fetch 拉取 SKILL.md（SSRF 白名单）后建为 imported。 */
export async function installCatalogSkill(body: {
  sourceUri: string
  category: string
  name?: string
  description?: string
}): Promise<SkillRow> {
  const { skill } = await json<{ skill: SkillRow }>(
    fetch('/api/skills/install-from-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return skill
}

export interface RegistrySkill {
  id: string
  name: string
  author: string
  description: string
  githubUrl: string
  stars: number
  updatedAt: number | null
}

export interface RegistrySearchResult {
  skills: RegistrySkill[]
  page: number
  hasNext: boolean
  total: number
}

/** 搜索 SkillsMP 在线注册表（经本项目服务端代理 + zod 校验）。 */
export async function searchSkillRegistry(params: {
  q: string
  page?: number
  sort?: 'stars' | 'recent'
}): Promise<RegistrySearchResult> {
  const sp = new URLSearchParams({ q: params.q })
  if (params.page) sp.set('page', String(params.page))
  if (params.sort) sp.set('sort', params.sort)
  return json<RegistrySearchResult>(fetch(`/api/skills/registry?${sp.toString()}`))
}

/** 预览一个 GitHub SKILL.md 的解析结果（不落库），供在线市场详情弹窗展示正文。 */
export async function previewSkillMarkdown(url: string): Promise<{
  name: string
  description: string
  instruction: string
  finalUrl: string
}> {
  return json(fetch(`/api/skills/preview?url=${encodeURIComponent(url)}`))
}

export interface ImportSkillsResult {
  created: SkillRow[]
  failed: { index: number; name: string; error: string }[]
}

export async function importSkills(skills: CreateSkillBody[]): Promise<ImportSkillsResult> {
  return json<ImportSkillsResult>(
    fetch('/api/skills/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills }),
    }),
  )
}

export async function createAgentDraft(body: AgentDraftRequest): Promise<AgentConfigDraft> {
  const { draft } = await json<{ draft: AgentConfigDraft }>(
    fetch('/api/agents/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return draft
}

export type UpdateAgentBody = Partial<
  Omit<CreateAgentBody, 'avatar' | 'apiKey' | 'apiBaseUrl' | 'modelId'>
> & {
  // SDK adapter 可用 null 清空，表示走 SDK 默认模型；custom 仍必须有非空 modelId
  modelId?: string | null
  // 显式 null 表示清除自定义 key；undefined 表示不改
  apiKey?: string | null
  // 同上
  apiBaseUrl?: string | null
}

export async function updateAgent(agentId: string, patch: UpdateAgentBody): Promise<AgentRow> {
  const { agent } = await json<{ agent: AgentRow }>(
    fetch(`/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
  return agent
}

export async function deleteAgent(agentId: string): Promise<void> {
  await json<{ ok: true }>(fetch(`/api/agents/${agentId}`, { method: 'DELETE' }))
}

// ─── Conversations ──────────────────────────────
export async function fetchConversations(): Promise<ConversationWithMeta[]> {
  const { conversations } = await json<{ conversations: ConversationWithMeta[] }>(
    fetch('/api/conversations'),
  )
  return conversations
}

export interface CreateConversationBody {
  title?: string
  mode: 'single' | 'group'
  agentIds: string[]
  boundPath?: string
}

export async function createConversation(body: CreateConversationBody): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return conversation
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' }),
  )
}

export async function addAgentsToConversation(
  conversationId: string,
  addAgentIds: string[],
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addAgentIds }),
    }),
  )
  return conversation
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }),
  )
  return conversation
}

export async function togglePinConversation(conversationId: string): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ togglePin: true }),
    }),
  )
  return conversation
}

export async function toggleArchiveConversation(
  conversationId: string,
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toggleArchive: true }),
    }),
  )
  return conversation
}

export async function setFsWriteApprovalMode(
  conversationId: string,
  mode: 'auto' | 'review',
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fsWriteApprovalMode: mode }),
    }),
  )
  return conversation
}

// ─── Pending writes (fs_write review mode) ─────
export async function fetchPendingWrites(conversationId: string): Promise<PendingWrite[]> {
  const { pendingWrites } = await json<{ pendingWrites: PendingWrite[] }>(
    fetch(`/api/conversations/${conversationId}/pending-writes`),
  )
  return pendingWrites
}

export async function approvePendingWrite(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-writes/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
  )
}

export async function rejectPendingWrite(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-writes/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }),
  )
}

// ─── Pending skill installs (install_skill 审批) ─────
export async function fetchPendingSkillInstalls(
  conversationId: string,
): Promise<PendingSkillInstall[]> {
  const { pendingSkillInstalls } = await json<{ pendingSkillInstalls: PendingSkillInstall[] }>(
    fetch(`/api/conversations/${conversationId}/pending-skill-installs`),
  )
  return pendingSkillInstalls
}

export async function approvePendingSkillInstall(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-skill-installs/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
  )
}

export async function rejectPendingSkillInstall(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-skill-installs/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }),
  )
}

// ─── Pending bash commands ─────
export async function fetchPendingBashCommands(
  conversationId: string,
): Promise<PendingBashCommand[]> {
  const { pendingCommands } = await json<{ pendingCommands: PendingBashCommand[] }>(
    fetch(`/api/conversations/${conversationId}/pending-bash-commands`),
  )
  return pendingCommands
}

export async function approvePendingBashCommand(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-bash-commands/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
  )
}

export async function rejectPendingBashCommand(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-bash-commands/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }),
  )
}

// ─── Pending questions (ask_user) ───────────────
export async function fetchPendingQuestions(conversationId: string): Promise<PendingQuestion[]> {
  const { pendingQuestions } = await json<{ pendingQuestions: PendingQuestion[] }>(
    fetch(`/api/conversations/${conversationId}/pending-questions`),
  )
  return pendingQuestions
}

export async function submitQuestionAnswers(
  conversationId: string,
  questionId: string,
  answers: Record<string, AskUserAnswer>,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-questions/${questionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    }),
  )
}

// ─── Messages ───────────────────────────────────
// ─── Pending dispatch plans (Orchestrator plan review) ───
export async function fetchPendingDispatchPlans(
  conversationId: string,
): Promise<PendingDispatchPlan[]> {
  const { pendingDispatchPlans } = await json<{ pendingDispatchPlans: PendingDispatchPlan[] }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans`),
  )
  return pendingDispatchPlans
}

export async function approvePendingDispatchPlan(
  conversationId: string,
  planId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
  )
}

export async function reviseDispatchPlan(
  conversationId: string,
  planId: string,
  feedback: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revise', feedback }),
    }),
  )
}

export async function rejectPendingDispatchPlan(
  conversationId: string,
  planId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }),
  )
}

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const { messages } = await json<{ messages: MessageRow[] }>(
    fetch(`/api/conversations/${conversationId}/messages`),
  )
  return messages
}

// ─── Search ──────────────────────────────────────
export interface SearchApiResult {
  hits: Array<{
    messageId: string
    conversationId: string
    conversationTitle: string
    role: 'user' | 'agent' | 'system'
    agentId: string | null
    agentName: string | null
    agentAvatar: string | null
    createdAt: number
    snippetHtml: string
  }>
  total: number
  tookMs: number
}

export async function searchMessagesApi(
  query: string,
  opts: { fallback?: 'like'; conversationId?: string; role?: 'user' | 'agent' } = {},
): Promise<SearchApiResult> {
  const params = new URLSearchParams({ q: query })
  if (opts.fallback) params.set('fallback', opts.fallback)
  if (opts.conversationId) params.set('conversationId', opts.conversationId)
  if (opts.role) params.set('role', opts.role)
  const { data } = await json<{ ok: true; data: SearchApiResult }>(
    fetch(`/api/search?${params}`),
  )
  return data
}

export interface ClearConversationHistoryResult {
  conversation: ConversationWithMeta
  deletedMessageCount: number
  deletedRunCount: number
  deletedSummaryCount: number
}

export async function clearConversationHistory(
  conversationId: string,
): Promise<ClearConversationHistoryResult> {
  return json<ClearConversationHistoryResult>(
    fetch(`/api/conversations/${conversationId}/messages`, { method: 'DELETE' }),
  )
}

export interface SendMessageBody {
  content: string
  mentionedAgentIds?: string[]
  parentMessageId?: string
  attachmentIds?: string[]
}

export interface SendMessageResult {
  messageId: string
  runIds: string[]
  messages?: MessageRow[]
  deploy?: DeployConversationResult
}

export async function sendMessage(
  conversationId: string,
  body: SendMessageBody,
): Promise<SendMessageResult> {
  return json<SendMessageResult>(
    fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export type DeployConversationResult =
  | {
      kind: 'no_candidates'
      candidates: []
      message: MessageRow
    }
  | {
      kind: 'candidate_selection'
      candidates: DeployCandidateRecord[]
      message: MessageRow
    }
  | {
      kind: 'deployed'
      deployment: DeployStatusRecord
      message: MessageRow
    }

export async function fetchDeployCandidates(
  conversationId: string,
): Promise<DeployCandidateRecord[]> {
  const { candidates } = await json<{ candidates: DeployCandidateRecord[] }>(
    fetch(`/api/conversations/${conversationId}/deploy`),
  )
  return candidates
}

export async function deployConversationArtifact(
  conversationId: string,
  artifactId?: string,
): Promise<DeployConversationResult> {
  return json<DeployConversationResult>(
    fetch(`/api/conversations/${conversationId}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifactId ? { artifactId } : {}),
    }),
  )
}

// ─── Runs ───────────────────────────────────────
export interface CompactConversationResult {
  summary: ContextSummaryRow
  message: MessageRow
}

export async function compactConversation(
  conversationId: string,
): Promise<CompactConversationResult> {
  return json<CompactConversationResult>(
    fetch(`/api/conversations/${conversationId}/compact`, { method: 'POST' }),
  )
}

export async function abortRun(runId: string): Promise<void> {
  await json<{ ok: true }>(fetch(`/api/runs/${runId}/abort`, { method: 'POST' }))
}

// ─── Messages: withdraw / edit ──────────────────
export interface WithdrawResult {
  deletedMessageIds: string[]
  deletedArtifactIds: string[]
}

export async function withdrawMessage(
  messageId: string,
  conversationId: string,
): Promise<WithdrawResult> {
  return json<WithdrawResult>(
    fetch(`/api/messages/${messageId}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

export interface EditAndResendResult extends WithdrawResult {
  newMessage: MessageRow
  runIds: string[]
}

export interface RegenerateResult extends WithdrawResult {
  triggerMessageId: string
  runIds: string[]
}

export async function regenerateLastResponse(conversationId: string): Promise<RegenerateResult> {
  return json<RegenerateResult>(
    fetch(`/api/conversations/${conversationId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

export async function editAndResendMessage(
  messageId: string,
  conversationId: string,
  content: string,
): Promise<EditAndResendResult> {
  return json<EditAndResendResult>(
    fetch(`/api/messages/${messageId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, content }),
    }),
  )
}

export interface ToggleBookmarkResult {
  bookmarkedMessageIds: string[]
  bookmarked: boolean
}

export async function toggleMessageBookmark(
  messageId: string,
  conversationId: string,
): Promise<ToggleBookmarkResult> {
  return json<ToggleBookmarkResult>(
    fetch(`/api/messages/${messageId}/bookmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

export interface TogglePinResult {
  pinnedMessageIds: string[]
  pinned: boolean
}

export async function toggleMessagePin(
  messageId: string,
  conversationId: string,
): Promise<TogglePinResult> {
  return json<TogglePinResult>(
    fetch(`/api/messages/${messageId}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

// ─── Filesystem (DirPicker) ────────────────────
export interface ListDirResult {
  path: string
  parent: string | null
  entries: Array<{ name: string; isDirectory: boolean; path?: string }>
}

export type ServerPlatform = 'posix' | 'windows'

export async function getServerPlatform(): Promise<ServerPlatform> {
  const res = await json<{ platform: ServerPlatform }>(fetch('/api/platform'))
  return res.platform
}

export async function listDirectory(targetPath?: string): Promise<ListDirResult> {
  const qs = targetPath ? `?path=${encodeURIComponent(targetPath)}` : ''
  return json<ListDirResult>(fetch(`/api/fs/listdir${qs}`))
}

// ─── Filesystem (conversation-scoped, 文件浏览器面板用) ────────
export interface WorkspaceListResult {
  relPath: string
  absolutePath: string
  parent: string | null
  entries: Array<{ name: string; isDirectory: boolean; size?: number }>
}

export async function workspaceListDir(
  conversationId: string,
  relPath = '',
): Promise<WorkspaceListResult> {
  const qs = relPath ? `?path=${encodeURIComponent(relPath)}` : ''
  return json<WorkspaceListResult>(fetch(`/api/conversations/${conversationId}/fs/listdir${qs}`))
}

export interface WorkspaceReadResult {
  path: string
  absolutePath: string
  cwd: string
  size: number
  content: string
  truncated: boolean
}

export async function workspaceReadFile(
  conversationId: string,
  relPath: string,
): Promise<WorkspaceReadResult> {
  return json<WorkspaceReadResult>(
    fetch(`/api/conversations/${conversationId}/fs/read?path=${encodeURIComponent(relPath)}`),
  )
}

export interface WorkspaceWriteResult {
  path: string
  absolutePath: string
  cwd: string
  bytes: number
}

export async function workspaceWriteFile(
  conversationId: string,
  relPath: string,
  content: string,
): Promise<WorkspaceWriteResult> {
  return json<WorkspaceWriteResult>(
    fetch(`/api/conversations/${conversationId}/fs/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relPath, content }),
    }),
  )
}

// ─── Artifacts ─────────────────────────────────
export async function fetchArtifacts(): Promise<ArtifactListItem[]> {
  const { artifacts } = await json<{ artifacts: ArtifactListItem[] }>(fetch('/api/artifacts'))
  return artifacts
}

export async function fetchArtifact(artifactId: string): Promise<ArtifactRow> {
  const { artifact } = await json<{ artifact: ArtifactRow }>(
    fetch(`/api/artifacts/${artifactId}`),
  )
  return artifact
}

export async function fetchArtifactVersions(artifactId: string): Promise<ArtifactRow[]> {
  const { versions } = await json<{ versions: ArtifactRow[] }>(
    fetch(`/api/artifacts/${artifactId}/versions`),
  )
  return versions
}

/** 以 artifactId 为父，提交编辑后的内容为新版本（version+1）；返回新产物行。 */
export async function createArtifactVersion(
  artifactId: string,
  body: { content: unknown; title?: string },
): Promise<ArtifactRow> {
  const { artifact } = await json<{ artifact: ArtifactRow }>(
    fetch(`/api/artifacts/${artifactId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return artifact
}

export async function deleteArtifact(artifactId: string): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/artifacts/${artifactId}`, { method: 'DELETE' }),
  )
}

// ─── Attachments ───────────────────────────────
export async function fetchAttachments(conversationId: string): Promise<AttachmentRow[]> {
  const { attachments } = await json<{ attachments: AttachmentRow[] }>(
    fetch(`/api/conversations/${conversationId}/attachments`),
  )
  return attachments
}

export async function uploadAttachment(
  conversationId: string,
  file: File,
): Promise<AttachmentRow> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/conversations/${conversationId}/attachments`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`)
  }
  const { attachment } = (await res.json()) as { attachment: AttachmentRow }
  return attachment
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await json<{ ok: true }>(fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' }))
}

export function attachmentDownloadUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}`
}

// ─── Usage / Analytics ─────────────────────────────
export interface UsageBucket {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
  runs: number
}

export interface UsageSummary {
  today: UsageBucket
  week: UsageBucket
  allTime: UsageBucket
  topConversations: Array<{
    id: string
    title: string
    totalTokens: number
    runs: number
    updatedAt: number
  }>
  byAgent: Array<{ agentId: string; name: string; totalTokens: number; runs: number }>
  byModel: Array<{ model: string; totalTokens: number; runs: number }>
}

export async function fetchUsageSummary(): Promise<UsageSummary> {
  return json<UsageSummary>(fetch('/api/usage/summary'))
}

// ─── Mobile companion connection hints ─────────────
export interface ConnectionHint {
  kind: 'tailscale' | 'lan' | 'local'
  label: string
  host: string
  url: string
  interfaceName?: string
}

export async function fetchConnectionHints(): Promise<ConnectionHint[]> {
  const { hints } = await json<{ hints: ConnectionHint[] }>(fetch('/api/connection-hints'))
  return hints
}

// ─── App Settings (全局 API key) ───────────────
export async function fetchAppSettings(): Promise<AppSettingsRow> {
  const { settings } = await json<{ settings: AppSettingsRow }>(fetch('/api/settings'))
  return settings
}

export interface AppSettingsPatchBody {
  anthropicApiKey?: string | null
  anthropicBaseUrl?: string | null
  openaiApiKey?: string | null
  deepseekApiKey?: string | null
  arkApiKey?: string | null
  companionMode?: 'off' | 'lan' | 'tailnet'
  mobileDeviceToken?: string | null
  deploymentPublishEnabled?: boolean
  deploymentPublishDir?: string | null
  deploymentPublicBaseUrl?: string | null
}

export async function updateAppSettings(patch: AppSettingsPatchBody): Promise<AppSettingsRow> {
  const { settings } = await json<{ settings: AppSettingsRow }>(
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
  return settings
}

export async function regenerateMobileDeviceToken(): Promise<AppSettingsRow> {
  const { settings } = await json<{ settings: AppSettingsRow }>(
    fetch('/api/settings/mobile-token', { method: 'POST' }),
  )
  return settings
}

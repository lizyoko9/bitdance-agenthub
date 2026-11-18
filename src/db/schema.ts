/**
 * Drizzle schema — 与 specs/01-core-entities.md 对应。
 *
 * 修改本文件后必须运行 `pnpm db:push` 同步到 SQLite。
 */

import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { DeliveryFixture, DeliveryInput, DeliveryReceiptView, DeliveryRequirement } from '@/shared/delivery-validation'
import type { ArtifactContent, ArtifactType, AdapterName, MessagePart, ModelProvider } from '@/shared/types'

// ─── Agents ──────────────────────────────────────────────────
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  avatar: text('avatar').notNull(),
  description: text('description').notNull(),
  capabilities: text('capabilities', { mode: 'json' }).$type<string[]>().notNull(),

  systemPrompt: text('system_prompt').notNull(),
  adapterName: text('adapter_name').$type<AdapterName>().notNull(),

  modelProvider: text('model_provider').$type<ModelProvider>(),
  modelId: text('model_id'),
  /**
   * 该 agent 单独的 API key。优先级高于 app_settings / env var。
   * Codex adapter 会把最终 key 注入隔离 CODEX_HOME 下的 SDK runtime。
   */
  apiKey: text('api_key'),

  /**
   * 该 agent 单独的 API base URL。
   * NULL 表示走 adapter 默认 endpoint；Claude Code 还可走 app_settings.anthropicBaseUrl。
   * 配合 apiKey 一起用：base URL 非空时，SDK adapter 会把 apiKey 作为对应 token 传入。
   * Codex 只支持 Codex/Responses 兼容 endpoint，Chat Completions-only provider 需走 custom。
   */
  apiBaseUrl: text('api_base_url'),

  toolNames: text('tool_names', { mode: 'json' }).$type<string[]>().notNull(),

  /**
   * 该 agent 选用的 Skill（方法论模块）id 列表。默认空数组。
   * 运行时由 AgentRunner 解析为指令注入 system prompt（见 specs/13）；
   * 缺失/已删除/禁用的 id 在解析期静默跳过，不影响 run。
   */
  skillIds: text('skill_ids', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),

  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  isOrchestrator: integer('is_orchestrator', { mode: 'boolean' }).notNull().default(false),
  supportsVision: integer('supports_vision', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at').notNull(),
})

// ─── Skills (可复用方法论模块) ───────────────────────────────
/**
 * Skill = 可复用的「工作方法 / 工作流」指令包，被 Agent 选用后由 AgentRunner
 * 注入 system prompt。Skill 本身**不授予可执行工具权限**（见 openspec tools spec）；
 * `requiredToolNames` 只用于 UI 依赖提示（「此 Skill 配合 X 工具效果更好」）。
 */
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  /** 注入到 system prompt 的方法论指令正文 */
  instruction: text('instruction').notNull(),
  /** 建议配套的 AgentHub 工具（仅 UI 提示，不扩权） */
  requiredToolNames: text('required_tool_names', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  /** 来源：builtin（seed，不可删/编）/ user（库内自建）/ imported（导入或会话安装） */
  source: text('source', { enum: ['builtin', 'user', 'imported'] })
    .notNull()
    .default('user'),
  /** 公共 skill：为 true 时自动挂给所有 agent（有效 skill = 公共池 ∪ agent.skillIds）。默认 opt-in。 */
  isGlobalDefault: integer('is_global_default', { mode: 'boolean' }).notNull().default(false),
  /** 导入来源 URL（install_skill 会话安装时记录；手动导入/自建为 null）。 */
  sourceUri: text('source_uri'),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull().default(0),
})

// ─── Conversations ───────────────────────────────────────────
export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    mode: text('mode', { enum: ['single', 'group'] }).notNull(),
    agentIds: text('agent_ids', { mode: 'json' }).$type<string[]>().notNull(),
    /** 注入 LLM 长期上下文的重要消息（agent-runner 用，UI 暂未暴露入口）。 */
    pinnedMessageIds: text('pinned_message_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** 用户的 UI 书签 —— 仅用于 outline 导航定位 / 高亮，不影响 LLM 上下文。 */
    bookmarkedMessageIds: text('bookmarked_message_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    /** 置顶时间戳；NULL 表示未置顶。排序时 pinned 永远在前，相互按 pinnedAt desc。 */
    pinnedAt: integer('pinned_at'),

    /**
     * Agent 通过 fs_write 改文件时的审批策略：
     * 'review' — 写入前推送 fs_write.pending，让前端弹审批 dialog（默认）
     * 'auto'   — 直接写
     * 仅影响 agent；用户手动在 FileTab 编辑保存不走审批。
     */
    fsWriteApprovalMode: text('fs_write_approval_mode', { enum: ['auto', 'review'] })
      .notNull()
      .default('review'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('idx_conv_updated').on(t.updatedAt)],
)

// ─── Messages ────────────────────────────────────────────────
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    role: text('role', { enum: ['user', 'agent', 'system'] }).notNull(),
    agentId: text('agent_id').references(() => agents.id),

    parts: text('parts', { mode: 'json' }).$type<MessagePart[]>().notNull(),

    status: text('status', { enum: ['streaming', 'complete', 'error', 'aborted'] }).notNull(),
    parentMessageId: text('parent_message_id'),
    mentionedAgentIds: text('mentioned_agent_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),

    runId: text('run_id'),

    /** 这条消息（单 LLM 响应）的 token 用量。null 表示 user 消息 / 不上报的 mock / 旧数据 */
    usage: text('usage', { mode: 'json' }).$type<MessageUsage>(),

    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_messages_conv_created').on(t.conversationId, t.createdAt)],
)

/** Per-message token usage —— 比 RunUsage 略简，单条 LLM 响应级别。 */
export interface MessageUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  inputTokensIncludeCache?: boolean
}

// ─── Artifacts ───────────────────────────────────────────────
export const artifacts = sqliteTable(
  'artifacts',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    type: text('type').$type<ArtifactType>().notNull(),
    title: text('title').notNull(),
    content: text('content', { mode: 'json' }).$type<ArtifactContent>().notNull(),

    version: integer('version').notNull().default(1),
    parentArtifactId: text('parent_artifact_id'),

    createdByAgentId: text('created_by_agent_id')
      .notNull()
      .references(() => agents.id),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_artifacts_conv').on(t.conversationId)],
)

// ─── Workspaces ──────────────────────────────────────────────
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .unique()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  rootPath: text('root_path').notNull(),
  /**
   * 'sandbox' — 隔离目录（.agenthub-data/workspaces/<convId>），默认
   * 'local'   — 绑定用户机器上的真实目录
   */
  mode: text('mode', { enum: ['sandbox', 'local'] }).notNull().default('sandbox'),
  /** mode='local' 时填，绝对路径；sandbox 时为 null */
  boundPath: text('bound_path'),
  createdAt: integer('created_at').notNull(),
})

// ─── Attachments (会话文件库) ─────────────────────────────────
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    kind: text('kind', { enum: ['image', 'file'] }).notNull(),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),    // 相对 workspace.rootPath
    size: integer('size').notNull(),
    mimeType: text('mime_type').notNull(),

    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_attachments_conv').on(t.conversationId)],
)

// ─── AgentRuns ───────────────────────────────────────────────
export const agentRuns = sqliteTable(
  'agent_runs',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    triggerMessageId: text('trigger_message_id'),

    status: text('status', { enum: ['queued', 'running', 'complete', 'failed', 'aborted'] }).notNull(),
    error: text('error'),

    parentRunId: text('parent_run_id'),

    /** Token 使用量。run 完成时由 adapter 报告并由 AgentRunner 落库。null = 该 run 未上报（如 mock / 失败）。 */
    usage: text('usage', { mode: 'json' }).$type<RunUsage>(),

    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
  },
  (t) => [index('idx_runs_parent').on(t.parentRunId)],
)

export const deliveryValidationRevisions = sqliteTable(
  'delivery_validation_revisions',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull(),
    revision: integer('revision').notNull(),
    title: text('title').notNull(),
    workspaceDigest: text('workspace_digest').notNull(),
    requirementDigest: text('requirement_digest').notNull(),
    requirements: text('requirements', { mode: 'json' })
      .$type<(DeliveryRequirement & { messageDigest: string; quoteDigest: string })[]>().notNull(),
    inputs: text('inputs', { mode: 'json' }).$type<DeliveryInput[]>().notNull(),
    definition: text('definition', { mode: 'json' }).$type<unknown>().notNull(),
    definitionDigest: text('definition_digest').notNull(),
    engineVersion: integer('engine_version').notNull(),
    generatorRunId: text('generator_run_id').notNull(),
    modelId: text('model_id').notNull(),
    createdAt: integer('created_at').notNull(),
    activatedAt: integer('activated_at'),
    revokedAt: integer('revoked_at'),
    qualification: text('qualification', { mode: 'json' }).$type<{
      fixtures: (DeliveryFixture & { inputsDigest: string })[]
      outcomes: { ruleId: string; expected: DeliveryFixture['expected']; actual: string }[]
    }>(),
  },
  (t) => [
    index('idx_delivery_revisions_conv').on(t.conversationId, t.createdAt),
    uniqueIndex('uidx_delivery_plan_rev').on(t.planId, t.revision),
  ],
)

export const deliveryValidationReceipts = sqliteTable(
  'delivery_validation_receipts',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull()
      .references(() => deliveryValidationRevisions.id, { onDelete: 'cascade' }),
    definitionDigest: text('definition_digest').notNull(),
    engineVersion: integer('engine_version').notNull(),
    createdAt: integer('created_at').notNull(),
    result: text('result', { mode: 'json' })
      .$type<Pick<DeliveryReceiptView, 'status' | 'checks' | 'inputs'>>().notNull(),
  },
  (t) => [index('idx_delivery_receipts_rev').on(t.revisionId, t.createdAt)],
)

/** RunUsage —— 一次 run 累计的 token 用量。token 计数字段为 0+ 整数；不返回的计数字段为 0，而不是 null。 */
export interface RunUsage {
  inputTokens: number
  outputTokens: number
  /** 模型上报的缓存写入数量 */
  cacheCreationTokens: number
  /** 模型上报的缓存命中数量 */
  cacheReadTokens: number
  /** true 表示 inputTokens 已包含缓存明细；缺省保留旧记录的独立缓存口径 */
  inputTokensIncludeCache?: boolean
  /** 用于上下文窗口仪表的最近一次「input prompt 长度」（不是累计），方便 UI 显示 ctx X/200k */
  lastInputTokens?: number
  /** 实际使用的模型 id；不同 run 可能不同（agent 配置改过 / 第三方网关动态路由），用来归类 */
  model?: string
}

// ─── Conversation context summaries ────────────────────────────────────────
export const contextSummaries = sqliteTable(
  'conversation_context_summaries',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    coveredUntilMessageId: text('covered_until_message_id').notNull(),
    coveredUntilCreatedAt: integer('covered_until_created_at').notNull(),
    sourceMessageCount: integer('source_message_count').notNull(),
    tokenEstimate: integer('token_estimate').notNull(),
    modelProvider: text('model_provider').$type<ModelProvider>(),
    modelId: text('model_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_context_summaries_conv_created').on(t.conversationId, t.createdAt)],
)

// ─── AppSettings (全局 API key / endpoint) ──────────────────
/**
 * 全局应用设置。单行表（PK 固定 'singleton'），存用户在「设置」面板填写的
 * API key / base URL。优先级高于 process.env，让用户不必编辑 .env.local。
 *
 * 桌面版 Electron 模式下也是这张表（不引入 keychain / safeStorage 等额外存储）。
 */
export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey(),                      // 永远 = 'singleton'
  anthropicApiKey: text('anthropic_api_key'),       // ANTHROPIC_API_KEY 等价
  anthropicBaseUrl: text('anthropic_base_url'),     // 第三方网关（anyrouter 等）；非空时 anthropicApiKey 作 AUTH_TOKEN
  openaiApiKey: text('openai_api_key'),
  deepseekApiKey: text('deepseek_api_key'),
  arkApiKey: text('ark_api_key'),
  companionMode: text('companion_mode', { enum: ['off', 'lan', 'tailnet'] }).notNull().default('off'),
  mobileDeviceToken: text('mobile_device_token'),
  deploymentPublishEnabled: integer('deployment_publish_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  deploymentPublishDir: text('deployment_publish_dir'),
  deploymentPublicBaseUrl: text('deployment_public_base_url'),
  updatedAt: integer('updated_at').notNull(),
})

export type AppSettingsRow = typeof appSettings.$inferSelect
export type AppSettingsInsert = typeof appSettings.$inferInsert

// ─── 类型导出（推断行类型）─────────────────────────────────
export type AgentRow = typeof agents.$inferSelect
export type AgentInsert = typeof agents.$inferInsert

export type SkillRow = typeof skills.$inferSelect
export type SkillInsert = typeof skills.$inferInsert

export type ConversationRow = typeof conversations.$inferSelect
export type ConversationInsert = typeof conversations.$inferInsert

/**
 * Conversation 行 + 关联 workspace 的 mode / boundPath（前端需要在多处显示
 * 「本地工作目录」标识，每次 lazy fetch workspace 太啰嗦，listConversations
 * 一次 JOIN 出来）。
 */
export interface ConversationWithMeta extends ConversationRow {
  workspaceMode: 'sandbox' | 'local'
  workspaceBoundPath: string | null
}

export type MessageRow = typeof messages.$inferSelect
export type MessageInsert = typeof messages.$inferInsert

export type ArtifactRow = typeof artifacts.$inferSelect
export type ArtifactInsert = typeof artifacts.$inferInsert

export type WorkspaceRow = typeof workspaces.$inferSelect
export type WorkspaceInsert = typeof workspaces.$inferInsert

export type AttachmentRow = typeof attachments.$inferSelect
export type AttachmentInsert = typeof attachments.$inferInsert

export type AgentRunRow = typeof agentRuns.$inferSelect
export type AgentRunInsert = typeof agentRuns.$inferInsert

export type ContextSummaryRow = typeof contextSummaries.$inferSelect
export type ContextSummaryInsert = typeof contextSummaries.$inferInsert

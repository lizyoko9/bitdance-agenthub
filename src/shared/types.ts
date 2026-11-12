/**
 * 共享类型 — 前后端都引用此文件。
 * 与 specs/01-core-entities.md, specs/02-stream-events.md, specs/03-message-parts.md 对应。
 */

// ─── MessagePart 联合类型 ─────────────────────────────────
export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; callId: string; toolName: string; args: unknown }
  | { type: 'tool_result'; callId: string; result: unknown; isError: boolean }
  | { type: 'artifact_ref'; artifactId: string }
  | { type: 'deploy_status'; deployment: DeployStatusRecord }
  | { type: 'deploy_candidates'; candidates: DeployCandidateRecord[] }
  | {
      type: 'image_attachment'
      attachmentId: string
      fileName: string
      size: number
      mimeType: string
    }
  | {
      type: 'file_attachment'
      attachmentId: string
      fileName: string
      size: number
      mimeType: string
    }

// ─── 增量 delta（流式追加）─────────────────────────────────
export type PartDelta =
  | { type: 'text.append'; text: string }
  | { type: 'code.append'; text: string }
  | { type: 'thinking.append'; text: string }

// ─── Artifact 内容（联合）─────────────────────────────────
export type ArtifactType =
  | 'web_app'
  | 'code_file'
  | 'diff'
  | 'document'
  | 'image'
  | 'ppt'
  | 'diagram'
  | 'project'
export type WritableArtifactType = Extract<
  ArtifactType,
  'web_app' | 'document' | 'image' | 'ppt' | 'diagram'
>
export type DispatchExpectedOutputType = WritableArtifactType | 'project'

export type ArtifactContent =
  | {
      type: 'web_app'
      files: Record<string, string>
      entry: string
    }
  | {
      type: 'code_file'
      workspacePath: string
      language: string
      sizeBytes: number
      checksum: string
    }
  | {
      type: 'diff'
      targetArtifactId: string
      hunks: DiffHunk[]
      applied: boolean
    }
  | {
      type: 'document'
      format: 'markdown'
      content: string
    }
  | {
      type: 'image'
      url: string
      alt: string
      width?: number
      height?: number
    }
  | {
      type: 'diagram'
      syntax: 'mermaid'
      source: string
      theme?: MermaidTheme
    }
  | {
      type: 'ppt'
      title?: string
      theme?: PptTheme
      slides: PptSlide[]
    }
  | {
      type: 'project'
      /** 该任务写入 workspace 的代码文件清单（相对 workspace 根）；正文留 workspace，不入 DB。 */
      files: ProjectFile[]
      taskId?: string
      agentId?: string
    }

export interface ProjectFile {
  path: string
  sizeBytes: number
}

export type MermaidTheme = 'default' | 'base' | 'dark' | 'forest' | 'neutral'

export type PptLayout =
  | 'title'
  | 'title-bullets'
  | 'section'
  | 'blank'
  | 'content'
  | 'two-column'
  | 'metrics'
  | 'timeline'
  | 'quote'

export type PptTone = 'neutral' | 'positive' | 'negative' | 'info' | 'warning'

export type PptBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[]; ordered?: boolean }
  | { type: 'metric'; label: string; value: string; change?: string; tone?: PptTone }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'timeline'; items: PptTimelineItem[] }
  | { type: 'columns'; columns: PptColumn[] }
  | { type: 'callout'; title?: string; text: string; tone?: PptTone }
  | { type: 'divider' }
  | { type: 'spacer'; size?: 'sm' | 'md' | 'lg' }

export interface PptTimelineItem {
  label: string
  title?: string
  text?: string
}

export interface PptColumn {
  title?: string
  blocks?: PptColumnBlock[]
}

export type PptColumnBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[]; ordered?: boolean }
  | { type: 'metric'; label: string; value: string; change?: string; tone?: PptTone }
  | { type: 'callout'; title?: string; text: string; tone?: PptTone }

export interface PptSlide {
  title?: string
  subtitle?: string
  bullets?: string[]
  blocks?: PptBlock[]
  notes?: string
  layout?: PptLayout
}

/** 幻灯片视觉 token；颜色为不带 # 的 hex（如 '1A3C6E'）。全部可选，渲染时经 resolvePptTheme 填默认值。 */
export interface PptTheme {
  primary?: string // 主色：标题、强调、顶部色条
  background?: string // 幻灯片背景（建议冷白，非纯白）
  surface?: string // 卡片 / 容器背景
  textBody?: string // 正文 / 要点
  textMuted?: string // 副标题 / 页码 / 脚注
  accentPositive?: string // 正面指标（增长 / 利润）
  accentNegative?: string // 警示 / 风险
  divider?: string // 分割线 / 边框
  fontHeading?: string // 标题字体
  fontBody?: string // 正文字体
  /** @deprecated 旧字段，resolvePptTheme 兼容映射到 primary / fontHeading+fontBody */
  primaryColor?: string
  fontFace?: string
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

// ─── Adapter 名称 ──────────────────────────────────────────
export type AdapterName = 'claude-code' | 'codex' | 'custom' | 'mock'

export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'volcano-ark'
  | 'openai-compatible'

// ─── 调度 plan ────────────────────────────────────────────
export interface DispatchPlanItem {
  id: string
  agentId: string
  task: string
  taskKind?: DispatchTaskKind
  dependsOn?: string[]
  expectedOutputs?: DispatchExpectedOutput[]
  inputs?: DispatchTaskInput[]
  acceptanceCriteria?: string[]
  targetPaths?: string[]
  expectedWorkspaceChanges?: string[]
  requiredCommands?: DispatchRequiredCommand[]
  requiredEvidence?: string[]
}

export type DispatchTaskKind = 'code' | 'test' | 'review' | 'design' | 'doc' | 'analysis'

export interface DispatchExpectedOutput {
  id: string
  type: DispatchExpectedOutputType
  required?: boolean
  description?: string
}

export interface DispatchTaskInput {
  fromTaskId: string
  outputId: string
  required?: boolean
  description?: string
}

export interface DispatchRequiredCommand {
  command: string
  description?: string
  cwd?: string
  timeoutMs?: number
}

export type TaskResultReportStatus = 'complete' | 'failed' | 'blocked'

export interface TaskAcceptanceResult {
  criterion: string
  passed: boolean
  evidence: string
}

export interface TaskFileEvidence {
  path: string
  action?: 'created' | 'modified' | 'deleted' | 'verified'
}

export interface TaskCommandEvidence {
  command: string
  exitCode: number | null
  cwd?: string
  timedOut?: boolean
  summary?: string
}

export interface TaskTestEvidence {
  command: string
  passed: boolean
  summary?: string
}

export interface TaskResultReport {
  status: TaskResultReportStatus
  summary: string
  acceptanceResults?: TaskAcceptanceResult[]
  filesChanged?: TaskFileEvidence[]
  commandsRun?: TaskCommandEvidence[]
  tests?: TaskTestEvidence[]
  blockers?: string[]
}

export type DispatchTaskStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'aborted'
  | 'skipped'

export type DispatchTaskEndStatus = Exclude<DispatchTaskStatus, 'pending' | 'running'>

// ─── Agent 写文件审批 ─────────────────────────────────────
/**
 * Agent 调 fs_write 在 review 模式下产出的「待审批」记录。后端持有 promise，
 * 前端展示 diff 让用户决定 approve / reject。详见 specs/07-tools.md fs_write 一节。
 */
export interface PendingWrite {
  id: string                  // pwr_<nanoid>
  conversationId: string
  agentId: string
  runId: string
  /** 相对 workspace 的路径 */
  path: string
  absolutePath: string
  /** null = 新建文件 */
  oldContent: string | null
  newContent: string
  createdAt: number
}

/**
 * Agent 调 install_skill 想从 GitHub 链接安装一个 Skill；fetch+解析后注册待审批，
 * 前端展示来源 URL + 解析出的 name/description/instruction 预览让用户决定。详见 specs/16。
 */
export interface PendingSkillInstall {
  id: string                  // psi_<nanoid>
  conversationId: string
  agentId: string
  runId: string
  /** 经重定向后的最终来源 URL */
  sourceUrl: string
  name: string
  description: string
  category: string
  /** 完整方法论正文（供用户审阅；面板里截断显示） */
  instruction: string
  createdAt: number
}

/**
 * Agent 调 ask_user 工具想结构化问用户问题；前端弹 dialog 让用户选项，
 * 选完后通过 attachResolver 唤醒 await，工具 handler 返回 answers。
 * Schema 对齐 Anthropic SDK 的 AskUserQuestion（1-4 questions × 2-4 options），
 * 让 CustomAgent / ClaudeCodeAdapter 共用同一 UI。
 */
export interface AskUserOption {
  label: string
  description?: string
  /** 可选的预览内容（mockup / code snippet 等），UI 显示在右侧或下方 */
  preview?: string
}
export interface AskUserQuestionItem {
  /** 完整问题文本 */
  question: string
  /** 短标签（chip） */
  header: string
  options: AskUserOption[]
  /** 默认 false。true 时允许多选；答案在 answers 里逗号分隔。 */
  multiSelect?: boolean
}
export interface PendingQuestion {
  id: string                  // pq_<nanoid>
  conversationId: string
  agentId: string
  runId: string
  questions: AskUserQuestionItem[]
  createdAt: number
}

export interface PendingDispatchPlan {
  id: string                  // pdp_<nanoid>
  conversationId: string
  agentId: string
  runId: string
  plan: DispatchPlanItem[]
  createdAt: number
}

export interface PendingBashCommand {
  id: string
  conversationId: string
  agentId: string
  runId: string
  command: string
  cwd: string
  reason: string
  createdAt: number
}

export interface DeployStatusRecord {
  id: string
  artifactId: string
  title: string
  version: number
  previewPath: string
  status: 'ready' | 'failed'
  sourceType?: 'artifact' | 'workspace'
  workspacePath?: string
  deploymentType?: 'local_static' | 'external_static'
  deploymentPath?: string
  localPreviewPath?: string
  publicUrl?: string
  publishPath?: string
  publishTargetType?: 'static_directory'
  sourceDownloadPath?: string
  containerDownloadPath?: string
  summaryInstruction?: string
  error?: string
  createdAt: number
}

export interface DeployCandidateRecord {
  artifactId: string
  title: string
  version: number
  createdByAgentId: string
  createdAt: number
}
/** 单条问题的答案：选中的 label 列表 + 可选自由文本（点「其他」时填）。 */
export interface AskUserAnswer {
  selectedLabels: string[]
  freeformNote?: string
}

// ─── StreamEvent 联合 ─────────────────────────────────────
interface BaseEvent {
  conversationId: string
  timestamp: number
}

export type StreamEvent = BaseEvent &
  (
    | { type: 'run.start'; runId: string; agentId: string; triggerMessageId: string; parentRunId?: string }
    | { type: 'run.end'; runId: string; status: 'complete' | 'failed' | 'aborted'; error?: string }
    | { type: 'run.usage'; runId: string; usage: RunUsageEvent }
    | { type: 'message.start'; messageId: string; agentId: string; runId: string }
    | { type: 'message.end'; messageId: string }
    | { type: 'message.usage'; messageId: string; usage: MessageUsageEvent }
    | { type: 'message.added'; message: MessageRecord }
    | { type: 'message.removed'; messageIds: string[]; artifactIds: string[] }
    | { type: 'part.start'; messageId: string; partIndex: number; part: MessagePart }
    | { type: 'part.delta'; messageId: string; partIndex: number; delta: PartDelta }
    | { type: 'part.end'; messageId: string; partIndex: number }
    | { type: 'tool.call'; messageId: string; callId: string; toolName: string; args: unknown }
    | { type: 'tool.result'; messageId: string; callId: string; result: unknown; isError: boolean }
    | { type: 'artifact.create'; artifact: ArtifactRecord }
    | { type: 'artifact.update'; artifactId: string; patch: Partial<ArtifactContent> }
    | { type: 'deploy.status'; messageId: string; deployment: DeployStatusRecord }
    | { type: 'dispatch.plan.pending'; pendingPlan: PendingDispatchPlan }
    | { type: 'dispatch.plan.resolved'; pendingId: string; runId: string; approved: boolean; revising?: boolean }
    | { type: 'dispatch.plan'; runId: string; plan: DispatchPlanItem[] }
    | { type: 'dispatch.start'; parentRunId: string; childRunId: string; taskId: string; agentId: string }
    | {
        type: 'dispatch.end'
        parentRunId: string
        childRunId?: string
        taskId: string
        status: DispatchTaskEndStatus
        error?: string
      }
    | { type: 'fs_write.pending'; pendingWrite: PendingWrite }
    | { type: 'fs_write.resolved'; pendingId: string; applied: boolean }
    | { type: 'bash_command.pending'; pendingCommand: PendingBashCommand }
    | { type: 'bash_command.resolved'; pendingId: string; approved: boolean }
    | { type: 'ask_user.pending'; pendingQuestion: PendingQuestion }
    | { type: 'ask_user.resolved'; pendingId: string; answered: boolean }
    | { type: 'skill_install.pending'; pendingInstall: PendingSkillInstall }
    | { type: 'skill_install.resolved'; pendingId: string; installed: boolean; skillId?: string }
    | { type: 'heartbeat' }
  )

/** RunUsage 事件 payload。与 db/schema.ts 的 RunUsage 同形，重复定义避开 client/server 边界 import。 */
export interface RunUsageEvent {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  lastInputTokens?: number
  model?: string
}

/** Per-message usage 事件 payload。与 db/schema.ts 的 MessageUsage 同形。 */
export interface MessageUsageEvent {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
}

// 简化版 Artifact，用于事件 payload（与 DB 行结构一致）
export interface ArtifactRecord {
  id: string
  conversationId: string
  type: ArtifactType
  title: string
  content: ArtifactContent
  version: number
  parentArtifactId?: string
  createdByAgentId: string
  createdAt: number
}

// 用于事件 payload 的完整消息（与 db/schema.ts 的 MessageRow 同形）。
// types 不反向 import schema 以免循环依赖，故在此重复定义，类比上面的 ArtifactRecord。
export interface MessageRecord {
  id: string
  conversationId: string
  role: 'user' | 'agent' | 'system'
  agentId: string | null
  parts: MessagePart[]
  status: 'streaming' | 'complete' | 'error' | 'aborted'
  parentMessageId: string | null
  mentionedAgentIds: string[]
  runId: string | null
  usage: MessageUsageEvent | null
  createdAt: number
}

// ─── Search 结果 ───────────────────────────────────────────
export interface SearchHit {
  messageId: string
  conversationId: string
  conversationTitle: string
  role: 'user' | 'agent' | 'system'
  agentId: string | null
  agentName: string | null
  agentAvatar: string | null
  createdAt: number
  /** FTS5 path: contains <mark>...</mark> tags. LIKE path: plain text. */
  snippetHtml: string
}

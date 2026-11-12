import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

import type { AdapterName, ModelProvider, StreamEvent } from '@/shared/types'

/**
 * AgentPlatformAdapter — 屏蔽不同 Agent 平台（Claude Code / Codex / Custom / Mock）
 * 的 API 差异，对上层提供统一的事件流。
 *
 * 详细规格见 specs/05-adapter-interface.md。
 */
export interface AgentPlatformAdapter {
  readonly name: AdapterName

  stream(input: AdapterInput, signal: AbortSignal): AsyncIterable<StreamEvent>
}

export interface AdapterInput {
  agentId: string
  conversationId: string
  runId: string

  /** 已被外层拼好的完整 prompt（群聊场景用 XML 包装） */
  prompt: string

  /** 工作目录绝对路径 */
  workspacePath: string

  /** 系统提示，已注入 `<workspace_info>` 块。所有 adapter 共用。 */
  systemPrompt: string

  /** 该 agent 单独配置的 API key（来自 agent.apiKey）；为 null 时 adapter 走环境 / OAuth fallback。
   *  当 apiBaseUrl 非空时，此值会被当作对应 SDK / endpoint 的 token。 */
  apiKey: string | null

  /** 该 agent 单独配置的 API base URL。Claude/Codex 对 endpoint 协议兼容性要求不同。 */
  apiBaseUrl: string | null

  /** 该 agent 选择的模型 id。所有 adapter 共用：
   *  - CustomAgentAdapter: 必填（OpenAI 兼容协议的 model 字段）
   *  - ClaudeCodeAdapter: 可选，null 时 adapter 走 SDK 默认（如 'claude-opus-4-7'）
   *  - CodexAdapter: 可选，null 时 adapter 走 SDK 默认（如 'gpt-5-codex'） */
  modelId: string | null

  /** 当前 run 可用的工具名列表。AgentRunner 已经做完 override 选择，adapter 直接用。
   *  SDK adapters use this to scope AgentHub MCP tools and Orchestrator plan-stage restrictions. */
  toolNames: string[]

  /** 触发消息的附件（图片 / 文件），adapter 决定是否注入到 LLM content */
  attachments?: AdapterAttachment[]

  /**
   * 跨 run 对话历史（OpenAI ChatMessage 格式），不含当前触发消息。
   * 由 AgentRunner 通过 conversation-context.buildHistoryFor 序列化，详见 specs/13-conversation-context.md。
   * - CustomAgentAdapter：拼到 [system, ...history, currentUser] 中间
   * - ClaudeCodeAdapter / CodexAdapter：忽略（走 SDK 自己的 session resume）
   * - MockAdapter：忽略
   */
  history?: ChatCompletionMessageParam[]

  /** 仅 CustomAgentAdapter 使用（OpenAI 兼容协议特有的模型选择） */
  customConfig?: {
    modelProvider: ModelProvider
    /** 该 agent 的 model 是否支持视觉（来自 agent.supportsVision） */
    supportsVision?: boolean
  }

  /**
   * 解析后的选用 Skill（仅 ClaudeCodeAdapter 使用）：adapter 把它们物化成
   * workspace `.claude/skills/<dir>/SKILL.md`，交给 SDK 原生渐进披露（`options.skills` + `Skill` 工具）。
   * custom / codex 的 Skill 走 systemPrompt 文本注入（catalog + 内联），不用此字段。
   * 详见 specs/13 + design「2C per-adapter 策略」。
   */
  skills?: { name: string; description: string; instruction: string }[]
}

export interface AdapterAttachment {
  id: string
  fileName: string
  mimeType: string
  kind: 'image' | 'file'
  /** 文件的本地绝对路径，adapter 读 base64 用 */
  absPath: string
}

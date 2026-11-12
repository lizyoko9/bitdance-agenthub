/**
 * Tool 系统的类型定义。
 *
 * 详细规格见 specs/01-core-entities.md §6 Tool。
 */

export interface ToolContext {
  conversationId: string
  workspacePath: string
  agentId: string
  runId: string
  abortSignal: AbortSignal
}

export type ToolResult =
  | { ok: true; value: unknown; isError?: boolean }
  | { ok: false; error: string }

export interface ToolDef {
  name: string
  description: string
  /** JSON Schema —— 同时用于 LLM API 的 tool 声明和我们自己的运行时校验 */
  parameters: Record<string, unknown>
  handler: (args: unknown, ctx: ToolContext) => Promise<ToolResult>
}

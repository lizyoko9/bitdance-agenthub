declare module '@anthropic-ai/claude-agent-sdk' {
  export class AbortError extends Error {}

  export type SdkToolArgs = Record<string, unknown>

  export type SdkToolResult = {
    content?: Array<{ type: 'text'; text: string } | Record<string, unknown>>
    isError?: boolean
  }

  export type SdkMcpTool<TSchema extends Record<string, unknown> = Record<string, unknown>> = {
    name: string
    description: string
    inputSchema: TSchema
    handler: (args: SdkToolArgs) => SdkToolResult | Promise<SdkToolResult>
  }

  export function tool<TSchema extends Record<string, unknown>>(
    name: string,
    description: string,
    inputSchema: TSchema,
    handler: (args: SdkToolArgs) => SdkToolResult | Promise<SdkToolResult>,
  ): SdkMcpTool<TSchema>

  export type CanUseToolResult =
    | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
    | { behavior: 'deny'; message: string }

  export type Options = {
    cwd?: string
    abortController?: AbortController
    model?: string
    systemPrompt?: { type: 'preset'; preset: string; append?: string }
    tools?: readonly string[] | { type: 'preset'; preset: string }
    disallowedTools?: readonly string[]
    mcpServers?: Record<string, unknown>
    includePartialMessages?: boolean
    settingSources?: readonly string[]
    permissionMode?: string
    env?: Record<string, string | undefined>
    resume?: string
    canUseTool?: (
      toolName: string,
      toolInput: Record<string, unknown>,
    ) => CanUseToolResult | Promise<CanUseToolResult>
  }

  export type SdkStreamEventMessage = {
    type: 'stream_event'
    event: unknown
  }

  export type SdkAssistantMessage = {
    type: 'assistant'
    message?: {
      content?: unknown
    }
  }

  export type SdkUserMessage = {
    type: 'user'
    message?: {
      content?: unknown
    }
  }

  export type SdkSystemMessage = {
    type: 'system'
    session_id?: string
  }

  export type SdkResultMessage = {
    type: 'result'
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    modelUsage?: Record<string, unknown>
  }

  export type SdkMessage =
    | SdkStreamEventMessage
    | SdkAssistantMessage
    | SdkUserMessage
    | SdkSystemMessage
    | SdkResultMessage
    | { type: string; [key: string]: unknown }

  export function createSdkMcpServer(input: {
    name: string
    version: string
    instructions?: string
    tools: readonly SdkMcpTool[]
  }): unknown

  export function query(input: { prompt: string; options: Options }): AsyncIterable<SdkMessage>
}

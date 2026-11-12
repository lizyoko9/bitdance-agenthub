import { readFileSync } from 'node:fs'

import OpenAI from 'openai'

import { newMessageId } from '@/server/ids'
import { toolRegistry } from '@/server/tools/registry'
import type { ToolContext } from '@/server/tools/types'
import type { DeployStatusRecord, ModelProvider, StreamEvent } from '@/shared/types'

import { resolveCustomProviderClientConfig } from './custom-provider-client'
import { CustomAgentTerminationError, resolveCustomMaxTurns } from './custom-agent-limits'
import { CustomRequestTracker, type CustomAgentAdapterOptions, type CustomRequestStatus } from './custom-request-policy'
import type { AdapterAttachment, AdapterInput, AgentPlatformAdapter } from './types'

/**
 * CustomAgentAdapter —— 自配置 Agent 的适配器。
 *
 * 通过 openai SDK 调用底层模型（OpenAI Chat Completions 兼容协议），
 * 自己实现 tool loop：流式拉模型输出 → 解析 tool_calls → 调用 ToolExecutor →
 * 把结果回灌到 messages → 续写下一轮，直到模型不再调工具。
 *
 * 详细规格见 specs/05-adapter-interface.md。
 */

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam

interface AccumulatingToolCall {
  id: string
  name: string
  argsBuffer: string
}

/** 防止单条 user message 塞太多图片（token 爆炸 + provider 通常有上限） */
const MAX_IMAGES_PER_MESSAGE = 5

export class CustomAgentAdapter implements AgentPlatformAdapter {
  readonly name = 'custom' as const
  private readonly maxTurns: number

  constructor(private options: CustomAgentAdapterOptions = {}) {
    this.maxTurns = resolveCustomMaxTurns(options.maxTurns)
  }

  async *stream(input: AdapterInput, signal: AbortSignal): AsyncIterable<StreamEvent> {
    if (!input.customConfig) {
      throw new Error('CustomAgentAdapter requires customConfig')
    }
    if (!input.modelId) {
      throw new Error('CustomAgentAdapter requires modelId')
    }
    const { modelProvider, supportsVision } = input.customConfig
    const modelId = input.modelId
    const systemPrompt = input.systemPrompt
    const apiKey = input.apiKey

    const defaultClient = this.options.requestPolicy
      ? undefined
      : buildClient(modelProvider, apiKey, input.apiBaseUrl, this.options)

    const toolDefs = toolRegistry.resolve(input.toolNames)
    const apiTools = toolDefs.map(toApiTool)

    const ctx: ToolContext = {
      conversationId: input.conversationId,
      workspacePath: input.workspacePath,
      agentId: input.agentId,
      runId: input.runId,
      abortSignal: signal,
    }

    // 构造 user message content：若 agent 声明 vision + 实际有图片，走 multimodal blocks
    const imageAttachments =
      input.attachments?.filter((a) => a.kind === 'image').slice(0, MAX_IMAGES_PER_MESSAGE) ?? []
    const useMultimodal = !!supportsVision && imageAttachments.length > 0

    const userContent: ChatMessage['content'] = useMultimodal
      ? buildMultimodalUserContent(input.prompt, imageAttachments)
      : input.prompt

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // 跨 run 历史：spec 13 序列化的对话上下文。空数组时行为与旧版一致（向后兼容）。
      ...(input.history ?? []),
      { role: 'user', content: userContent },
    ]

    let turn = 0
    // 跨 turn 累加 token 用量；run 结束前 yield run.usage 给 AgentRunner 落库
    const runUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      lastInputTokens: 0,
    }

    while (turn < this.maxTurns) {
      if (signal.aborted) return
      turn++

      const messageId = newMessageId()
      yield baseEvent(input, {
        type: 'message.start',
        messageId,
        agentId: input.agentId,
        runId: input.runId,
      })

      let textPartIndex = -1
      let textBuffer = ''
      let thinkingPartIndex = -1
      let reasoningBuffer = ''
      let nextPartIndex = 0
      const toolCallBuffer = new Map<number, AccumulatingToolCall>()

      const request = this.options.requestPolicy
        ? new CustomRequestTracker(this.options.requestPolicy, {
            runId: input.runId,
            agentId: input.agentId,
            conversationId: input.conversationId,
            messageId,
            requestedModel: modelId,
            provider: modelProvider,
            turn,
          }, signal)
        : undefined
      const client = defaultClient ?? buildClient(modelProvider, apiKey, input.apiBaseUrl, this.options, request?.fetch)
      let stream: Awaited<ReturnType<typeof client.chat.completions.create>>
      try {
        stream = await client.chat.completions.create(
          {
            model: modelId,
            messages,
            tools: apiTools.length > 0 ? apiTools : undefined,
            stream: true,
            stream_options: { include_usage: true },
            ...this.options.requestSettings,
          },
          { signal },
        )
      } catch (err) {
        request?.finish(signal.aborted ? 'aborted' : 'failed')
        yield baseEvent(input, { type: 'message.end', messageId })
        throw request?.policyError ?? err
      }

      let finishReason: string | null = null
      // 本 turn 单条 message 的 usage（per-message）；与 runUsage 同时维护
      const msgUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }

      let requestStatus: CustomRequestStatus = 'interrupted'
      try {
        for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
          if (signal.aborted) return
          request?.observeChunk(chunk)
          // Final usage chunk (stream_options.include_usage)：choices 通常空，只携 usage。
          // DeepSeek 还附带 prompt_cache_hit_tokens / prompt_cache_miss_tokens。
          const usage = (chunk as { usage?: Record<string, number> | null }).usage
          if (usage) {
            const inp = usage.prompt_tokens ?? 0
            const out = usage.completion_tokens ?? 0
            const cached = usage.prompt_cache_hit_tokens ?? usage.cached_tokens ?? 0
            msgUsage.inputTokens += inp
            msgUsage.outputTokens += out
            msgUsage.cacheReadTokens += cached
            runUsage.inputTokens += inp
            runUsage.outputTokens += out
            runUsage.cacheReadTokens += cached
            runUsage.lastInputTokens = inp
          }
          const choice = chunk.choices[0]
          if (!choice) continue
          // DeepSeek V4/R1 等 thinking-mode 模型在 delta 上加了 reasoning_content
          // 字段，OpenAI SDK 的官方类型不含，这里宽放成扩展形态。
          const delta = choice.delta as OpenAI.Chat.Completions.ChatCompletionChunk['choices'][number]['delta'] & {
            reasoning_content?: string
          }

          // —— reasoning_content (thinking mode) —— 先 yield 出来让 UI 渲染 thinking part
          if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
            if (thinkingPartIndex < 0) {
              thinkingPartIndex = nextPartIndex++
              yield baseEvent(input, {
                type: 'part.start',
                messageId,
                partIndex: thinkingPartIndex,
                part: { type: 'thinking', content: '' },
              })
            }
            reasoningBuffer += delta.reasoning_content
            yield baseEvent(input, {
              type: 'part.delta',
              messageId,
              partIndex: thinkingPartIndex,
              delta: { type: 'thinking.append', text: delta.reasoning_content },
            })
          }

          if (typeof delta.content === 'string' && delta.content.length > 0) {
            if (textPartIndex < 0) {
              textPartIndex = nextPartIndex++
              yield baseEvent(input, {
                type: 'part.start',
                messageId,
                partIndex: textPartIndex,
                part: { type: 'text', content: '' },
              })
            }
            textBuffer += delta.content
            yield baseEvent(input, {
              type: 'part.delta',
              messageId,
              partIndex: textPartIndex,
              delta: { type: 'text.append', text: delta.content },
            })
          }

          if (delta.tool_calls) {
            for (const tcd of delta.tool_calls) {
              const idx = tcd.index
              let entry = toolCallBuffer.get(idx)
              if (!entry) {
                entry = { id: '', name: '', argsBuffer: '' }
                toolCallBuffer.set(idx, entry)
              }
              if (tcd.id) entry.id = tcd.id
              if (tcd.function?.name) entry.name = tcd.function.name
              if (tcd.function?.arguments) entry.argsBuffer += tcd.function.arguments
            }
          }

          if (choice.finish_reason) finishReason = choice.finish_reason
        }
        requestStatus = 'completed'
      } catch (error) {
        requestStatus = signal.aborted ? 'aborted' : 'failed'
        throw error
      } finally {
        request?.finish(signal.aborted ? 'aborted' : requestStatus)
      }

      if (thinkingPartIndex >= 0) {
        yield baseEvent(input, { type: 'part.end', messageId, partIndex: thinkingPartIndex })
      }
      if (textPartIndex >= 0) {
        yield baseEvent(input, { type: 'part.end', messageId, partIndex: textPartIndex })
      }

      const toolCalls = Array.from(toolCallBuffer.values()).filter((tc) => tc.id && tc.name)

      // 写回 assistant message
      // DeepSeek thinking-mode 模型要求把 reasoning_content 一起回传到下一轮，
      // 否则 API 返回 "The reasoning_content in the thinking mode must be passed back".
      // OpenAI SDK 类型不识 reasoning_content，用扩展 cast。
      const assistantMsg = {
        role: 'assistant' as const,
        content: textBuffer || null,
        tool_calls:
          toolCalls.length > 0
            ? toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.argsBuffer || '{}' },
              }))
            : undefined,
        ...(reasoningBuffer ? { reasoning_content: reasoningBuffer } : {}),
      }
      messages.push(assistantMsg as ChatMessage)

      const modelStopped = finishReason === 'stop' && toolCallBuffer.size === 0
      const requestsTools = finishReason === 'tool_calls' && toolCalls.length > 0 && toolCalls.length === toolCallBuffer.size
      if (!requestsTools) {
        if (msgUsage.inputTokens > 0 || msgUsage.outputTokens > 0) {
          yield baseEvent(input, { type: 'message.usage', messageId, usage: msgUsage })
        }
        yield baseEvent(input, { type: 'message.end', messageId })
        yield baseEvent(input, {
          type: 'run.usage',
          runId: input.runId,
          usage: { ...runUsage, model: modelId },
        })
        if (!modelStopped) {
          const reason = finishReason === 'length' ? 'output_limit'
            : finishReason === 'content_filter' ? 'content_filter' : 'model_interrupted'
          throw new CustomAgentTerminationError(reason, turn, this.maxTurns)
        }
        return
      }

      // 执行工具
      for (const tc of toolCalls) {
        let args: unknown
        try {
          args = tc.argsBuffer ? JSON.parse(tc.argsBuffer) : {}
        } catch {
          args = {}
        }

        try {
          // Consumers may execute a tool as soon as tool.call is published.
          this.options.toolPolicy?.beforeTool({
            runId: input.runId,
            agentId: input.agentId,
            conversationId: input.conversationId,
            messageId,
            requestedModel: modelId,
            provider: modelProvider,
            turn,
            callId: tc.id,
            toolName: tc.name,
            args,
          }, signal)
        } catch (error) {
          if (msgUsage.inputTokens > 0 || msgUsage.outputTokens > 0) {
            yield baseEvent(input, { type: 'message.usage', messageId, usage: msgUsage })
          }
          yield baseEvent(input, { type: 'message.end', messageId })
          yield baseEvent(input, { type: 'run.usage', runId: input.runId, usage: { ...runUsage, model: modelId } })
          throw error
        }

        yield baseEvent(input, {
          type: 'tool.call',
          messageId,
          callId: tc.id,
          toolName: tc.name,
          args,
        })

        const result = await toolRegistry.execute(tc.name, args, ctx)
        const value = result.ok ? result.value : { error: result.error }

        yield baseEvent(input, {
          type: 'tool.result',
          messageId,
          callId: tc.id,
          result: value,
          isError: !result.ok,
        })

        // 工具结果含 artifactId 视为「创建了产物」的约定，统一由 adapter 发布
        // artifact.create 事件，让上层 AgentRunner 注入 artifact_ref part。
        if (tc.name === 'write_artifact' && result.ok && hasArtifactId(value)) {
          const artifactId = (value as { artifactId: string }).artifactId
          const { db, schema } = await import('@/db/client')
          const { eq } = await import('drizzle-orm')
          const artifact = await db.query.artifacts.findFirst({
            where: eq(schema.artifacts.id, artifactId),
          })
          if (artifact) {
            yield baseEvent(input, {
              type: 'artifact.create',
              artifact: {
                id: artifact.id,
                conversationId: artifact.conversationId,
                type: artifact.type,
                title: artifact.title,
                content: artifact.content,
                version: artifact.version,
                parentArtifactId: artifact.parentArtifactId ?? undefined,
                createdByAgentId: artifact.createdByAgentId,
                createdAt: artifact.createdAt,
              },
            })
          }
        }

        if (
          (tc.name === 'deploy_artifact' || tc.name === 'deploy_workspace') &&
          result.ok &&
          isDeployStatusRecord(value)
        ) {
          yield baseEvent(input, {
            type: 'deploy.status',
            messageId,
            deployment: value,
          })
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(value),
        })
      }

      if (msgUsage.inputTokens > 0 || msgUsage.outputTokens > 0) {
        yield baseEvent(input, { type: 'message.usage', messageId, usage: msgUsage })
      }
      yield baseEvent(input, { type: 'message.end', messageId })
      // 继续下一轮
    }
    yield baseEvent(input, {
      type: 'run.usage',
      runId: input.runId,
      usage: { ...runUsage, model: modelId },
    })
    if (signal.aborted) return
    throw new CustomAgentTerminationError('iteration_limit', turn, this.maxTurns)
  }
}

// ─── 辅助 ────────────────────────────────────────────────

/**
 * OpenAI SDK 默认 maxRetries=2，对 408 / 429 / >= 500 / APIConnectionError 自动指数退避重试。
 * 这里显式声明同样的 2 次重试，让 spec 05 §「错误处理」承诺的「网络/速率限制重试」在代码层
 * 可见且可调（未来按 provider 调整时只动这一个常量）。
 *
 * 注意：重试只对「初始连接」生效；stream 一旦开始 emit chunks 就不会再重试。
 */
const MAX_API_RETRIES = 2

function buildClient(
  provider: ModelProvider,
  overrideKey?: string | null,
  apiBaseUrl?: string | null,
  options: CustomAgentAdapterOptions = {},
  fetch?: typeof globalThis.fetch,
): OpenAI {
  return new OpenAI({
    ...resolveCustomProviderClientConfig(provider, overrideKey, apiBaseUrl),
    maxRetries: options.maxRetries ?? MAX_API_RETRIES,
    ...(fetch ? { fetch } : {}),
  })
}

function toApiTool(t: {
  name: string
  description: string
  parameters: Record<string, unknown>
}): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }
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

/**
 * 构造 OpenAI 风格的多模态 user message content：
 *   [{ type: 'text', text: ... }, { type: 'image_url', image_url: { url: 'data:...' } }, ...]
 *
 * DeepSeek 兼容 OpenAI schema；Anthropic 的 image block 形态不同，目前 CustomAgentAdapter
 * 走 openai SDK + OpenAI-compatible endpoint，先只支持这一套。
 */
function buildMultimodalUserContent(
  prompt: string,
  images: AdapterAttachment[],
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  const blocks: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: prompt },
  ]
  for (const img of images) {
    try {
      const data = readFileSync(img.absPath).toString('base64')
      blocks.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${data}`,
        },
      })
    } catch (err) {
      console.warn('[CustomAgentAdapter] failed to read image', img.absPath, err)
    }
  }
  return blocks
}

function baseEvent<T extends Omit<StreamEvent, 'conversationId' | 'timestamp'>>(
  input: AdapterInput,
  body: T,
): StreamEvent {
  return {
    ...body,
    conversationId: input.conversationId,
    timestamp: Date.now(),
  } as StreamEvent
}

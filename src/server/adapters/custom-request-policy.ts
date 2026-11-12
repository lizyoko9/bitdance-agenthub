import type OpenAI from 'openai'

import type { ModelProvider } from '@/shared/types'

export interface CustomRequestContext {
  runId: string
  agentId: string
  conversationId: string
  messageId: string
  requestedModel: string
  provider: ModelProvider
  turn: number
}

export interface CustomRequestUsage {
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheCreationTokens: number | null
  reasoningTokens: number | null
}

export type CustomRequestStatus = 'completed' | 'failed' | 'aborted' | 'interrupted'

export interface CustomRequestObservation extends CustomRequestContext {
  sequence: number
  attempt: number
  bodyBytes: number
  startedAt: number
  endedAt: number
  requestId: string | null
  responseId: string | null
  responseModel: string | null
  systemFingerprint: string | null
  httpStatus: number | null
  status: CustomRequestStatus
  usage: CustomRequestUsage
  usageComplete: boolean
}

export interface CustomRequestPolicy {
  beforeRequest(context: CustomRequestContext, bodyBytes: number, signal: AbortSignal): number
  observe(observation: CustomRequestObservation): void
}

export interface CustomAgentAdapterOptions {
  maxTurns?: number
  maxRetries?: number
  requestSettings?: Pick<
    OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
    'reasoning_effort' | 'max_completion_tokens'
  >
  requestPolicy?: CustomRequestPolicy
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function readCustomRequestUsage(value: unknown): CustomRequestUsage {
  const usage = record(value)
  return {
    inputTokens: numberOrNull(usage.prompt_tokens),
    outputTokens: numberOrNull(usage.completion_tokens),
    cacheReadTokens: numberOrNull(record(usage.prompt_tokens_details).cached_tokens)
      ?? numberOrNull(usage.prompt_cache_hit_tokens)
      ?? numberOrNull(usage.cached_tokens),
    cacheCreationTokens: numberOrNull(usage.cache_creation_input_tokens),
    reasoningTokens: numberOrNull(record(usage.completion_tokens_details).reasoning_tokens),
  }
}

interface RequestAttempt {
  observation: CustomRequestObservation
  emitted: boolean
}

export class CustomRequestTracker {
  private attempts: RequestAttempt[] = []
  policyError: unknown

  constructor(
    private policy: CustomRequestPolicy,
    private context: CustomRequestContext,
    private signal: AbortSignal,
  ) {}

  fetch: typeof fetch = async (input, init) => {
    const body = init?.body
    if (typeof body !== 'string') throw new Error('Observed Chat Completions request must have a JSON string body')
    const bodyBytes = Buffer.byteLength(body, 'utf8')
    let sequence: number
    try {
      sequence = this.policy.beforeRequest(this.context, bodyBytes, init?.signal ?? this.signal)
    } catch (error) {
      this.policyError = error
      throw error
    }
    const attempt: RequestAttempt = {
      emitted: false,
      observation: {
        ...this.context,
        sequence,
        attempt: this.attempts.length + 1,
        bodyBytes,
        startedAt: Date.now(),
        endedAt: 0,
        requestId: null,
        responseId: null,
        responseModel: null,
        systemFingerprint: null,
        httpStatus: null,
        status: 'interrupted',
        usage: readCustomRequestUsage(null),
        usageComplete: false,
      },
    }
    this.attempts.push(attempt)
    try {
      const response = await globalThis.fetch(input, { ...init, redirect: 'error' })
      attempt.observation.requestId = response.headers.get('x-request-id')
      attempt.observation.httpStatus = response.status
      if (!response.ok) this.emit(attempt, this.signal.aborted ? 'aborted' : 'failed')
      return response
    } catch (error) {
      this.emit(attempt, this.signal.aborted ? 'aborted' : 'failed')
      throw error
    }
  }

  observeChunk(chunk: OpenAI.Chat.Completions.ChatCompletionChunk): void {
    const attempt = this.attempts.at(-1)
    if (!attempt || attempt.emitted) return
    const observation = attempt.observation
    observation.responseId = chunk.id ?? observation.responseId
    observation.responseModel = chunk.model ?? observation.responseModel
    observation.systemFingerprint = chunk.system_fingerprint ?? observation.systemFingerprint
    if (chunk.usage) {
      observation.usage = readCustomRequestUsage(chunk.usage)
      observation.usageComplete = observation.usage.inputTokens !== null && observation.usage.outputTokens !== null
    }
  }

  finish(status: CustomRequestStatus): void {
    for (const attempt of this.attempts) this.emit(attempt, status)
  }

  private emit(attempt: RequestAttempt, status: CustomRequestStatus): void {
    if (attempt.emitted) return
    attempt.emitted = true
    this.policy.observe({ ...attempt.observation, status, endedAt: Date.now() })
  }
}

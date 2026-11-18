import { z } from 'zod'

export const DEFAULT_CUSTOM_MAX_TURNS = 32
export const MAX_CUSTOM_TURNS = 10_000
export const CustomMaxTurnsSchema = z.number().int().min(1).max(MAX_CUSTOM_TURNS)
export const MAX_CUSTOM_REQUEST_TIMEOUT_MS = 2_147_483_647
export const CustomRequestTimeoutMsSchema = z.number().int().positive().max(MAX_CUSTOM_REQUEST_TIMEOUT_MS)

export function resolveCustomRequestTimeoutMs(override?: number): number | undefined {
  if (override === undefined) return undefined
  const parsed = CustomRequestTimeoutMsSchema.safeParse(override)
  if (!parsed.success) {
    throw new Error(`Invalid CustomAgentAdapter requestTimeoutMs: expected an integer from 1 to ${MAX_CUSTOM_REQUEST_TIMEOUT_MS}`)
  }
  return parsed.data
}

export function resolveCustomMaxTurns(override?: number): number {
  const environment = process.env.AGENTHUB_CUSTOM_MAX_TURNS
  const value = override ?? (environment === undefined ? DEFAULT_CUSTOM_MAX_TURNS : Number(environment))
  const parsed = CustomMaxTurnsSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid CustomAgentAdapter maxTurns: expected an integer from 1 to ${MAX_CUSTOM_TURNS} (option or AGENTHUB_CUSTOM_MAX_TURNS)`)
  }
  return parsed.data
}

export type CustomAgentTerminationReason = 'iteration_limit' | 'output_limit' | 'content_filter' | 'model_interrupted'

export class CustomAgentTextOnlyResponseError extends Error {
  constructor(reason: 'unexpected_tool' | 'response_size') {
    super(reason === 'unexpected_tool'
      ? 'Text-only model response attempted a tool call.'
      : 'Text-only model response exceeded the byte limit.')
    this.name = 'CustomAgentTextOnlyResponseError'
  }
}

export class CustomAgentTerminationError extends Error {
  constructor(
    readonly code: CustomAgentTerminationReason,
    readonly turns: number,
    readonly maxTurns: number,
  ) {
    const details = {
      iteration_limit: `Custom agent reached its ${maxTurns}-turn limit while still requesting tools`,
      output_limit: 'Model output reached its token limit before voluntary completion; partial tools were not executed',
      content_filter: 'Model output was stopped by the provider content filter',
      model_interrupted: 'Model stream ended without a consistent stop or tool_calls finish reason',
    }
    super(`${code}: ${details[code]} (turn ${turns}/${maxTurns})`)
    this.name = 'CustomAgentTerminationError'
  }
}

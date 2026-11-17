import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

import { redactLog, runHeadlessCli, runHeadlessTrial, type HeadlessTrialOptions } from '../terminalbench/run-agenthub'
import { TrialRequestSchema, validateTrialRequest, type ConversationTrialRequest } from '../terminalbench/trial-schema'
import { CustomRequestTimeoutMsSchema } from '../../src/server/adapters/custom-agent-limits'

export const TRACETRIAL_SOURCE_REVISION = '98a381307184fa4212db3466b21b4c92a031940b'
export const TraceTrialRequestSchema = TrialRequestSchema.extend({
  timeoutMs: CustomRequestTimeoutMsSchema.default(600_000),
  conversation: z.object({
    mode: z.literal('fixed_turns'),
    turns: z.array(TrialRequestSchema.shape.instruction).length(10),
  }).strict().optional(),
}).superRefine((request, context) => {
  if (request.taskId === 'E2-shard-stderr-003' && !request.conversation) {
    context.addIssue({ code: 'custom', path: ['conversation'], message: 'The E2 task requires its complete fixed conversation' })
  }
  if (!request.conversation) return
  if (request.taskId !== 'E2-shard-stderr-003' || request.group !== 'single') {
    context.addIssue({ code: 'custom', path: ['conversation'], message: 'Fixed turns are supported only for the approved E2 single-agent task' })
  }
  if (request.instruction !== request.conversation.turns[0]) {
    context.addIssue({ code: 'custom', path: ['instruction'], message: 'Instruction must equal the first conversation turn' })
  }
})

export function validateTraceTrialRequest(input: unknown): ConversationTrialRequest {
  return validateTrialRequest(input, TraceTrialRequestSchema)
}

export function runTraceTrial(request: ConversationTrialRequest, options: Omit<HeadlessTrialOptions, 'benchmark' | 'sourceRevision'> = {}) {
  return runHeadlessTrial(request, { ...options, benchmark: 'tracetrial', sourceRevision: TRACETRIAL_SOURCE_REVISION })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHeadlessCli({ benchmark: 'tracetrial', sourceRevision: TRACETRIAL_SOURCE_REVISION, requestSchema: TraceTrialRequestSchema }).catch((failure) => {
    process.stderr.write(`${redactLog(failure instanceof Error ? failure.message : String(failure), [process.env.OPENAI_API_KEY ?? ''])}\n`)
    process.exitCode = 1
  })
}

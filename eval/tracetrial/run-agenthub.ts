import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { redactLog, runHeadlessCli, runHeadlessTrial, type HeadlessTrialOptions } from '../terminalbench/run-agenthub'
import { TrialRequestSchema, validateTrialRequest, type TrialRequest } from '../terminalbench/trial-schema'
import { CustomRequestTimeoutMsSchema } from '../../src/server/adapters/custom-agent-limits'

export const TRACETRIAL_SOURCE_REVISION = '98a381307184fa4212db3466b21b4c92a031940b'
export const TraceTrialRequestSchema = TrialRequestSchema.extend({ timeoutMs: CustomRequestTimeoutMsSchema.default(600_000) })

export function validateTraceTrialRequest(input: unknown): TrialRequest {
  return validateTrialRequest(input, TraceTrialRequestSchema)
}

export function runTraceTrial(request: TrialRequest, options: Omit<HeadlessTrialOptions, 'benchmark' | 'sourceRevision'> = {}) {
  return runHeadlessTrial(request, { ...options, benchmark: 'tracetrial', sourceRevision: TRACETRIAL_SOURCE_REVISION })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHeadlessCli({ benchmark: 'tracetrial', sourceRevision: TRACETRIAL_SOURCE_REVISION, requestSchema: TraceTrialRequestSchema }).catch((failure) => {
    process.stderr.write(`${redactLog(failure instanceof Error ? failure.message : String(failure), [process.env.OPENAI_API_KEY ?? ''])}\n`)
    process.exitCode = 1
  })
}

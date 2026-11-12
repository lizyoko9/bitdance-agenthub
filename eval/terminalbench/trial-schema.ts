import { realpathSync, statSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { CustomMaxTurnsSchema, DEFAULT_CUSTOM_MAX_TURNS } from '../../src/server/adapters/custom-agent-limits'
import { DEFAULT_EVAL_REQUEST_LIMITS, EvalMaxToolCallsSchema, EvalRequestLimitsSchema } from './request-policy'

const AbsolutePath = z.string().min(1).refine(path.isAbsolute, 'Path must be absolute')

export const TrialRequestSchema = z.object({
  taskId: z.string().min(1).max(128).regex(/^[\w.-]+$/),
  instruction: z.string().min(1).max(256 * 1024).refine((value) => value.trim().length > 0, 'Instruction must not be blank'),
  cwd: AbsolutePath,
  group: z.enum(['single', 'orch-nogate', 'orch-gate']).default('single'),
  modelId: z.string().min(1).max(128).regex(/^[\w.-]+$/).default('gpt-6-luna'),
  timeoutMs: z.number().int().positive().max(600_000).default(600_000),
  maxTurns: CustomMaxTurnsSchema.default(DEFAULT_CUSTOM_MAX_TURNS),
  maxToolCalls: EvalMaxToolCallsSchema.optional(),
  requestLimits: EvalRequestLimitsSchema.default(DEFAULT_EVAL_REQUEST_LIMITS),
  outputDir: AbsolutePath,
}).strict()

export type TrialRequest = z.infer<typeof TrialRequestSchema>

function canonicalPath(target: string): string {
  try {
    return realpathSync(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return path.join(canonicalPath(path.dirname(target)), path.basename(target))
  }
}

const contains = (parent: string, child: string): boolean => {
  const relative = path.relative(parent, child)
  return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

export function validateTrialRequest(input: unknown): TrialRequest {
  const request = TrialRequestSchema.parse(input)
  const cwd = realpathSync(request.cwd)
  if (!statSync(cwd).isDirectory()) throw new Error(`Task cwd is not a directory: ${cwd}`)
  const outputDir = canonicalPath(path.resolve(request.outputDir))
  if (contains(cwd, outputDir) || contains(outputDir, cwd)) {
    throw new Error('Trial output directory and task cwd must not overlap')
  }
  return { ...request, cwd, outputDir }
}


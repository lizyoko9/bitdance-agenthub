import { z } from 'zod'

import {
  AVAILABLE_AGENT_TOOLS,
  type AgentConfigDraft,
  type AgentDraftRequest,
  type AgentDraftResponse,
} from '@/shared/agent-builder-config'

const ToolNameSchema = z.enum(AVAILABLE_AGENT_TOOLS)
const ProviderSchema = z.enum(['anthropic', 'openai', 'deepseek', 'volcano-ark', 'openai-compatible'])
const AdapterSchema = z.enum(['custom', 'claude-code', 'codex'])

export const AgentDraftRequestSchema = z.object({
  intent: z.string().trim().min(6).max(4000),
  followUp: z.string().trim().max(2000).optional(),
}) satisfies z.ZodType<AgentDraftRequest>

export const AgentConfigDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    avatar: z.string().max(8).default('🤖'),
    description: z.string().trim().min(1).max(280),
    capabilities: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
    systemPrompt: z.string().trim().min(1),
    adapterName: AdapterSchema.default('custom'),
    modelProvider: ProviderSchema.optional(),
    modelId: z.string().trim().min(1).optional(),
    toolNames: z.array(ToolNameSchema).default([]),
    skillIds: z.array(z.string().trim().min(1)).max(16).default([]),
    supportsVision: z.boolean().default(true),
    rationale: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
    assumptions: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(40),
          detail: z.string().trim().min(1).max(240),
        }),
      )
      .max(8)
      .default([]),
    toolPermissionSummaries: z
      .array(
        z.object({
          toolName: ToolNameSchema,
          label: z.string().trim().min(1).max(40),
          desc: z.string().trim().min(1).max(200),
        }),
      )
      .default([]),
  })
  .refine(
    (draft) => draft.adapterName !== 'custom' || (draft.modelProvider && draft.modelId),
    { message: 'Custom draft requires modelProvider and modelId' },
  )
  .refine(
    (draft) => draft.adapterName === 'custom' || draft.toolNames.length === 0,
    { message: 'SDK adapter draft must not include custom toolNames' },
  ) satisfies z.ZodType<AgentConfigDraft>

export const AgentDraftResponseSchema = z.object({
  draft: AgentConfigDraftSchema,
}) satisfies z.ZodType<AgentDraftResponse>

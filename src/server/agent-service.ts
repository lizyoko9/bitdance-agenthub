import { and, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import { resolveAgentProfileForAgent } from '@/server/agent-profile-bridge-service'
import { newAgentId } from '@/server/ids'
import {
  validateOpenAICompatibleApiKey,
  validateOpenAICompatibleBaseUrl,
} from '@/shared/openai-compatible'
import type { AdapterName, ModelProvider } from '@/shared/types'

/**
 * 用户自建 Agent 的服务。
 *
 * 自建 Agent 默认走 adapterName='custom'，也可选择 Claude Code / Codex SDK adapter。
 * 内置 Agent (isBuiltin=true) 不可被删除或修改。
 */

export interface CreateAgentArgs {
  name: string
  avatar: string
  description: string
  capabilities: string[]
  systemPrompt: string
  /** 'custom' (默认) | 'claude-code' | 'codex'。SDK adapter 用内置工具集 + 仅需 modelId */
  adapterName?: 'custom' | 'claude-code' | 'codex'
  /** custom: required；SDK adapter: 忽略（可不传） */
  modelProvider?: ModelProvider
  /** custom: required；SDK adapter: 可选，默认 SDK 默认模型 */
  modelId?: string
  /** SDK adapter 忽略此字段（SDK 内置工具集，不走 toolRegistry）*/
  toolNames: string[]
  skillIds?: string[]
  mcpServerIds?: string[]
  cliProfileIds?: string[]
  supportsVision?: boolean
  apiKey?: string | null
  /** 自定义 API base URL。Claude/Codex 对 endpoint 协议兼容性要求不同；NULL 走默认 */
  apiBaseUrl?: string | null
}

export async function createCustomAgent(args: CreateAgentArgs) {
  const id = newAgentId()
  const createdAt = Date.now()
  const adapterName: AdapterName = args.adapterName ?? 'custom'

  if (adapterName === 'custom') {
    if (!args.modelProvider || !args.modelId) {
      throw new Error('Custom adapter requires modelProvider and modelId')
    }
    const baseUrlError = validateOpenAICompatibleBaseUrl(args.modelProvider, args.apiBaseUrl)
    if (baseUrlError) throw new Error(baseUrlError)
    const apiKeyError = validateOpenAICompatibleApiKey(args.modelProvider, args.apiKey)
    if (apiKeyError) throw new Error(apiKeyError)
  }

  const row = {
    id,
    name: args.name.trim(),
    avatar: args.avatar.trim() || '🤖',
    description: args.description.trim(),
    capabilities: args.capabilities,
    systemPrompt: args.systemPrompt,
    adapterName,
    modelProvider: adapterName === 'custom' ? (args.modelProvider ?? null) : null,
    modelId: args.modelId ?? null,
    apiKey: args.apiKey?.trim() || null,
    apiBaseUrl: args.apiBaseUrl?.trim() || null,
    // SDK adapter 走各自内置工具集，不消费 toolNames；强制空数组避免 UI 残留
    toolNames: adapterName === 'custom' ? args.toolNames : [],
    skillIds: args.skillIds ?? [],
    mcpServerIds: args.mcpServerIds ?? [],
    cliProfileIds: args.cliProfileIds ?? [],
    isBuiltin: false,
    isOrchestrator: false,
    supportsVision: args.supportsVision ?? false,
    createdAt,
  }

  await db.insert(schema.agents).values(row)
  await resolveAgentProfileForAgent(row.id)
  return row
}

export async function deleteCustomAgent(agentId: string): Promise<void> {
  // 防止误删内置
  const agent = await db.query.agents.findFirst({
    where: eq(schema.agents.id, agentId),
  })
  if (!agent) throw new Error(`Agent not found: ${agentId}`)
  if (agent.isBuiltin) throw new Error('Built-in agents cannot be deleted')

  const deleted = await db
    .delete(schema.agents)
    .where(and(eq(schema.agents.id, agentId), eq(schema.agents.isBuiltin, false)))
    .returning({ id: schema.agents.id })

  if (deleted.length === 0) {
    throw new Error(`Failed to delete agent: ${agentId}`)
  }
}

export interface UpdateAgentPatch {
  name?: string
  description?: string
  capabilities?: string[]
  systemPrompt?: string
  adapterName?: 'custom' | 'claude-code' | 'codex'
  modelProvider?: ModelProvider
  modelId?: string | null
  toolNames?: string[]
  skillIds?: string[]
  mcpServerIds?: string[]
  cliProfileIds?: string[]
  supportsVision?: boolean
  /** 传 null 显式清除自定义 key（fallback 回 env）；undefined 表示不动 */
  apiKey?: string | null
  /** 传 null 显式清除自定义 base URL；undefined 表示不动 */
  apiBaseUrl?: string | null
}

export async function updateCustomAgent(agentId: string, patch: UpdateAgentPatch) {
  const agent = await db.query.agents.findFirst({
    where: eq(schema.agents.id, agentId),
  })
  if (!agent) throw new Error(`Agent not found: ${agentId}`)
  // 内建 agent 允许修改配置（API key / system prompt / model 等），但删除仍受保护

  const updates: Record<string, unknown> = {}
  const nextAdapterName: AdapterName = patch.adapterName ?? agent.adapterName
  const nextModelProvider = patch.modelProvider ?? agent.modelProvider
  const nextModelId = patch.modelId ?? agent.modelId
  const nextApiBaseUrl =
    patch.apiBaseUrl !== undefined ? patch.apiBaseUrl?.trim() || null : agent.apiBaseUrl
  const nextApiKey = patch.apiKey !== undefined ? patch.apiKey?.trim() || null : agent.apiKey

  if (nextAdapterName === 'custom' && (!nextModelProvider || !nextModelId)) {
    throw new Error('Custom adapter requires modelProvider and modelId')
  }
  if (nextAdapterName === 'custom') {
    const baseUrlError = validateOpenAICompatibleBaseUrl(nextModelProvider, nextApiBaseUrl)
    if (baseUrlError) throw new Error(baseUrlError)
    const apiKeyError = validateOpenAICompatibleApiKey(nextModelProvider, nextApiKey)
    if (apiKeyError) throw new Error(apiKeyError)
  }

  if (patch.name !== undefined) updates.name = patch.name.trim()
  if (patch.description !== undefined) updates.description = patch.description.trim()
  if (patch.capabilities !== undefined) updates.capabilities = patch.capabilities
  if (patch.systemPrompt !== undefined) updates.systemPrompt = patch.systemPrompt
  if (patch.adapterName !== undefined) updates.adapterName = patch.adapterName
  if (patch.modelId !== undefined) updates.modelId = patch.modelId?.trim() || null
  if (patch.skillIds !== undefined) updates.skillIds = patch.skillIds
  if (patch.mcpServerIds !== undefined) updates.mcpServerIds = patch.mcpServerIds
  if (patch.cliProfileIds !== undefined) updates.cliProfileIds = patch.cliProfileIds
  if (patch.supportsVision !== undefined) updates.supportsVision = patch.supportsVision
  if (patch.apiKey !== undefined) updates.apiKey = patch.apiKey?.trim() || null
  if (patch.apiBaseUrl !== undefined) updates.apiBaseUrl = patch.apiBaseUrl?.trim() || null

  if (nextAdapterName === 'custom') {
    if (patch.modelProvider !== undefined) updates.modelProvider = patch.modelProvider
    if (patch.toolNames !== undefined) updates.toolNames = patch.toolNames
  } else {
    // SDK adapter 走各自内置工具集，不消费 modelProvider/toolNames。
    if (patch.adapterName !== undefined && patch.modelId === undefined) {
      updates.modelId = null
    }
    if (
      patch.adapterName !== undefined ||
      patch.modelProvider !== undefined ||
      patch.toolNames !== undefined
    ) {
      updates.modelProvider = null
      updates.toolNames = []
    }
  }

  if (Object.keys(updates).length === 0) return agent

  await db.update(schema.agents).set(updates).where(eq(schema.agents.id, agentId))

  const updated = await db.query.agents.findFirst({ where: eq(schema.agents.id, agentId) })
  if (!updated) throw new Error('Update succeeded but row missing afterwards')
  await resolveAgentProfileForAgent(updated.id)
  return updated
}

export async function listAgentsOrdered() {
  // 内置在前，按 createdAt desc
  return db.query.agents.findMany({
    orderBy: [desc(schema.agents.isBuiltin), desc(schema.agents.createdAt)],
  })
}

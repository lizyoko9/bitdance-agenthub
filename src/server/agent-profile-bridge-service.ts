import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { agentProfiles, agents } from '@/db/schema'
import type { AgentProfileRow, AgentRow } from '@/db/schema'

export async function resolveAgentProfileForAgent(agentId: string): Promise<AgentProfileRow> {
  const existing = await db.query.agentProfiles.findFirst({
    where: eq(agentProfiles.id, agentId),
  })

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  })
  if (!agent) throw new Error(`Agent not found: ${agentId}`)

  if (existing) return syncBridgeOwnedAgentProfile(existing, agent)

  const profile = buildAgentProfileFromLegacyAgent(agent)
  await db.insert(agentProfiles).values(profile)
  return profile
}

export async function syncBridgeOwnedAgentProfile(
  existing: AgentProfileRow,
  agent: AgentRow,
): Promise<AgentProfileRow> {
  if (!isBridgeOwnedProfile(existing, agent.id)) return existing

  const updates = buildBridgeSyncPatch(existing, agent)
  if (Object.keys(updates).length === 0) return existing

  await db.update(agentProfiles).set(updates).where(eq(agentProfiles.id, existing.id))
  return { ...existing, ...updates }
}

export function buildAgentProfileFromLegacyAgent(agent: AgentRow): AgentProfileRow {
  const now = Date.now()
  const artifactType = inferArtifactType(agent.capabilities)
  return {
    id: agent.id,
    name: agent.name,
    role: agent.name,
    description: agent.description,
    modelProfileId: null,
    fallbackModelProfileIds: [],
    skillIds: agent.skillIds,
    mcpServerIds: agent.mcpServerIds,
    cliProfileIds: agent.cliProfileIds,
    softwareProfileIds: [],
    memoryPolicy: {
      enabled: true,
      sourceAgentId: agent.id,
      privateFirst: true,
      reviewBeforeSharing: true,
    },
    autonomyPolicy: {
      mode: 'execute_low_risk',
      askBeforeHighRisk: true,
    },
    workstationPolicy: {
      mode: 'browser_context',
      physicalDesktopRequiresLock: true,
    },
    permissionPolicy: {
      toolNames: agent.toolNames,
      supportsVision: agent.supportsVision,
      adapterName: agent.adapterName,
      modelProvider: agent.modelProvider,
      modelId: agent.modelId,
    },
    inputContract: {
      source: 'legacy_agent',
      accepts: ['task_goal', 'artifact_input', 'human_instruction'],
    },
    outputContract: {
      artifactType,
      validationRules: ['必须输出客户可查看的交付物'],
      sourceCapabilities: agent.capabilities,
    },
    persona: {
      avatar: agent.avatar,
      tone: 'friendly',
      language: 'zh-CN',
      communicationStyle: {
        useEmoji: false,
        useCodeBlocks: true,
        preferBulletPoints: true,
        showThinkingProcess: false,
        selfReference: agent.name,
      },
      personalityTraits: {
        cautious: 0.7,
        creative: 0.55,
        thorough: 0.8,
        efficient: 0.7,
      },
    },
    systemPrompt: agent.systemPrompt,
    behaviorRules: [
      '运行前先检索自己的私有记忆和项目记忆。',
      '新经验先保存在本员工内，需要审核后再共享。',
      '失败教训必须在下次计划时优先参考。',
    ],
    successCriteria: buildSuccessCriteria(agent.capabilities, artifactType),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

function inferArtifactType(capabilities: string[]): string {
  const text = capabilities.join(' ').toLowerCase()
  if (containsAny(text, ['视频', 'video', '剪映', 'capcut'])) return 'video'
  if (containsAny(text, ['图片', 'image', '设计', '海报'])) return 'image'
  if (containsAny(text, ['代码', 'code', '源码', 'diff', 'pr'])) return 'code'
  if (containsAny(text, ['表格', 'spreadsheet', 'excel', 'csv'])) return 'spreadsheet'
  if (containsAny(text, ['文件包', 'bundle', '压缩包'])) return 'file_bundle'
  if (containsAny(text, ['报告', 'report'])) return 'report'
  if (containsAny(text, ['文档', 'document', 'doc'])) return 'document'
  return 'artifact'
}

function buildSuccessCriteria(capabilities: string[], artifactType: string): string[] {
  const criteria = ['交付物必须能被下一个节点或用户直接查看。']
  if (artifactType !== 'artifact') criteria.push(`最终产物类型必须是 ${artifactType}。`)
  for (const capability of capabilities.slice(0, 4)) {
    const trimmed = capability.trim()
    if (trimmed) criteria.push(`覆盖能力要求：${trimmed}。`)
  }
  return criteria
}

function containsAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value.toLowerCase()))
}

function isBridgeOwnedProfile(profile: AgentProfileRow, agentId: string): boolean {
  return readString(profile.memoryPolicy.sourceAgentId) === agentId
}

function buildBridgeSyncPatch(
  existing: AgentProfileRow,
  agent: AgentRow,
): Partial<AgentProfileRow> {
  const artifactType = inferArtifactType(agent.capabilities)
  const next = {
    name: agent.name,
    role: agent.name,
    description: agent.description,
    skillIds: agent.skillIds,
    mcpServerIds: agent.mcpServerIds,
    cliProfileIds: agent.cliProfileIds,
    permissionPolicy: {
      ...existing.permissionPolicy,
      toolNames: agent.toolNames,
      supportsVision: agent.supportsVision,
      adapterName: agent.adapterName,
      modelProvider: agent.modelProvider,
      modelId: agent.modelId,
    },
    outputContract: {
      ...existing.outputContract,
      artifactType,
      validationRules: ['必须输出客户可查看的交付物'],
      sourceCapabilities: agent.capabilities,
    },
    persona: {
      ...existing.persona,
      avatar: agent.avatar,
      communicationStyle: {
        ...existing.persona.communicationStyle,
        selfReference: agent.name,
      },
    },
    systemPrompt: agent.systemPrompt,
    successCriteria: buildSuccessCriteria(agent.capabilities, artifactType),
  }

  const updates: Partial<AgentProfileRow> = {}
  for (const [key, value] of Object.entries(next) as Array<[keyof typeof next, unknown]>) {
    if (JSON.stringify(existing[key as keyof AgentProfileRow]) !== JSON.stringify(value)) {
      Object.assign(updates, { [key]: value })
    }
  }
  if (Object.keys(updates).length > 0) updates.updatedAt = Date.now()
  return updates
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

import type { AgentProfileRow, AgentRow } from '@/db/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  currentId: '',
  agents: [] as AgentRow[],
  profiles: [] as AgentProfileRow[],
  insertedProfiles: [] as AgentProfileRow[],
}))

vi.mock('@/db/client', () => ({
  db: {
    query: {
      agents: {
        findFirst: vi.fn(async () => store.agents.find((agent) => agent.id === store.currentId) ?? null),
      },
      agentProfiles: {
        findFirst: vi.fn(
          async () => store.profiles.find((profile) => profile.id === store.currentId) ?? null,
        ),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(async (profile: AgentProfileRow) => {
        store.profiles.push(profile)
        store.insertedProfiles.push(profile)
      }),
    })),
  },
}))

import { resolveAgentProfileForAgent } from './agent-profile-bridge-service'

describe('agent profile bridge service', () => {
  beforeEach(() => {
    store.currentId = ''
    store.agents = []
    store.profiles = []
    store.insertedProfiles = []
  })

  it('creates a matching employee Agent Profile for a legacy UI Agent', async () => {
    const agent = legacyAgent({
      id: 'agent_clip',
      name: '剪辑员工',
      description: '负责剪映导出和素材整理',
      capabilities: ['视频', '文件包'],
      systemPrompt: '你是剪辑员工。',
      toolNames: ['fs_read', 'fs_write', 'browser_open'],
      skillIds: ['jianying-video-editor'],
      mcpServerIds: ['mcp_video'],
      cliProfileIds: ['cli_jianying'],
    })
    store.currentId = agent.id
    store.agents.push(agent)

    const profile = await resolveAgentProfileForAgent(agent.id)

    expect(profile).toMatchObject({
      id: agent.id,
      name: '剪辑员工',
      role: '剪辑员工',
      description: '负责剪映导出和素材整理',
      skillIds: ['jianying-video-editor'],
      mcpServerIds: ['mcp_video'],
      cliProfileIds: ['cli_jianying'],
      systemPrompt: '你是剪辑员工。',
      status: 'active',
    })
    expect(profile.memoryPolicy).toMatchObject({
      enabled: true,
      sourceAgentId: agent.id,
      privateFirst: true,
    })
    expect(profile.outputContract).toMatchObject({
      artifactType: 'video',
      validationRules: ['必须输出客户可查看的交付物'],
    })
    expect(store.insertedProfiles).toHaveLength(1)
  })

  it('returns an existing Agent Profile without overwriting its brain policy', async () => {
    const agent = legacyAgent({
      id: 'agent_code',
      name: '代码员工',
      description: '负责代码修改',
      capabilities: ['代码'],
      systemPrompt: '旧系统提示。',
      toolNames: ['fs_read'],
    })
    const existing = agentProfile({
      id: agent.id,
      name: '已有员工档案',
      role: '代码专家',
      description: '已经手动配置过',
      memoryPolicy: { enabled: false, privateFirst: false },
      outputContract: { artifactType: 'code' },
      systemPrompt: '保留这个提示。',
      status: 'draft',
    })
    store.currentId = agent.id
    store.agents.push(agent)
    store.profiles.push(existing)

    const profile = await resolveAgentProfileForAgent(agent.id)

    expect(profile).toMatchObject({
      id: agent.id,
      name: '已有员工档案',
      role: '代码专家',
      systemPrompt: '保留这个提示。',
      status: 'draft',
    })
    expect(profile.memoryPolicy).toEqual({ enabled: false, privateFirst: false })
    expect(store.insertedProfiles).toHaveLength(0)
  })
})

function legacyAgent(overrides: Partial<AgentRow>): AgentRow {
  return {
    id: 'agent_test',
    name: '测试员工',
    avatar: '测',
    description: '测试',
    capabilities: [],
    systemPrompt: '测试提示',
    adapterName: 'custom',
    modelProvider: 'deepseek',
    modelId: 'deepseek-chat',
    apiKey: null,
    apiBaseUrl: null,
    toolNames: [],
    skillIds: [],
    mcpServerIds: [],
    cliProfileIds: [],
    isBuiltin: false,
    isOrchestrator: false,
    supportsVision: false,
    createdAt: 1,
    ...overrides,
  }
}

function agentProfile(overrides: Partial<AgentProfileRow>): AgentProfileRow {
  return {
    id: 'agent_test',
    name: '测试员工档案',
    role: '员工',
    description: '',
    modelProfileId: null,
    fallbackModelProfileIds: [],
    skillIds: [],
    mcpServerIds: [],
    cliProfileIds: [],
    softwareProfileIds: [],
    memoryPolicy: {},
    autonomyPolicy: {},
    workstationPolicy: {},
    permissionPolicy: {},
    inputContract: {},
    outputContract: {},
    persona: {
      avatar: '测',
      tone: 'friendly',
      language: 'zh-CN',
      communicationStyle: {
        useEmoji: false,
        useCodeBlocks: true,
        preferBulletPoints: true,
        showThinkingProcess: false,
        selfReference: '测试员工档案',
      },
      personalityTraits: {
        cautious: 0.7,
        creative: 0.55,
        thorough: 0.8,
        efficient: 0.7,
      },
    },
    systemPrompt: '',
    behaviorRules: [],
    successCriteria: [],
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

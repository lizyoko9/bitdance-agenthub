import type { AgentProfileRow, AgentRow } from '@/db/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  currentId: '',
  agents: [] as AgentRow[],
  profiles: [] as AgentProfileRow[],
  insertedProfiles: [] as AgentProfileRow[],
  updatedProfiles: [] as Partial<AgentProfileRow>[],
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
    update: vi.fn(() => ({
      set: vi.fn((updates: Partial<AgentProfileRow>) => ({
        where: vi.fn(async () => {
          const index = store.profiles.findIndex((profile) => profile.id === store.currentId)
          if (index >= 0) {
            store.profiles[index] = { ...store.profiles[index], ...updates } as AgentProfileRow
            store.updatedProfiles.push(updates)
          }
        }),
      })),
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
    store.updatedProfiles = []
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
    expect(store.updatedProfiles).toHaveLength(0)
  })

  it('syncs a bridge-owned Agent Profile when the UI Agent capabilities change', async () => {
    const agent = legacyAgent({
      id: 'agent_ops',
      name: '运营员工',
      description: '负责文案和表格',
      capabilities: ['报告'],
      systemPrompt: '旧提示。',
      toolNames: ['fs_read'],
      skillIds: ['copywriting'],
      mcpServerIds: [],
      cliProfileIds: [],
    })
    const existing = agentProfile({
      id: agent.id,
      name: '旧运营员工',
      role: '旧运营员工',
      description: '旧描述',
      skillIds: ['old_skill'],
      mcpServerIds: ['old_mcp'],
      cliProfileIds: ['old_cli'],
      memoryPolicy: {
        enabled: false,
        sourceAgentId: agent.id,
        privateFirst: false,
        customNote: '用户关闭了记忆，不能被同步覆盖',
      },
      permissionPolicy: {
        toolNames: ['old_tool'],
        modelId: 'old-model',
      },
      outputContract: {
        artifactType: 'document',
        validationRules: ['旧规则'],
      },
      systemPrompt: '旧提示。',
    })
    const changedAgent = legacyAgent({
      ...agent,
      name: '运营增长员工',
      description: '负责文案、表格和增长报告',
      capabilities: ['表格', '报告'],
      systemPrompt: '新的长期工作规则。',
      toolNames: ['fs_read', 'fs_write', 'bash'],
      skillIds: ['copywriting', 'spreadsheet'],
      mcpServerIds: ['mcp_sheets'],
      cliProfileIds: ['cli_report'],
      modelId: 'deepseek-reasoner',
      supportsVision: true,
    })
    store.currentId = agent.id
    store.agents.push(changedAgent)
    store.profiles.push(existing)

    const profile = await resolveAgentProfileForAgent(agent.id)

    expect(profile).toMatchObject({
      id: agent.id,
      name: '运营增长员工',
      role: '运营增长员工',
      description: '负责文案、表格和增长报告',
      skillIds: ['copywriting', 'spreadsheet'],
      mcpServerIds: ['mcp_sheets'],
      cliProfileIds: ['cli_report'],
      systemPrompt: '新的长期工作规则。',
    })
    expect(profile.memoryPolicy).toEqual({
      enabled: false,
      sourceAgentId: agent.id,
      privateFirst: false,
      customNote: '用户关闭了记忆，不能被同步覆盖',
    })
    expect(profile.permissionPolicy).toMatchObject({
      toolNames: ['fs_read', 'fs_write', 'bash'],
      modelId: 'deepseek-reasoner',
      supportsVision: true,
    })
    expect(profile.outputContract).toMatchObject({
      artifactType: 'spreadsheet',
      validationRules: ['必须输出客户可查看的交付物'],
    })
    expect(store.updatedProfiles).toHaveLength(1)
  })

  it('does not rewrite an unchanged bridge-owned Agent Profile', async () => {
    const agent = legacyAgent({
      id: 'agent_same',
      name: '报告员工',
      description: '负责客户报告',
      capabilities: ['报告'],
      systemPrompt: '按客户要求写报告。',
      toolNames: ['fs_read'],
      skillIds: ['reporting'],
      mcpServerIds: ['mcp_docs'],
      cliProfileIds: ['cli_doc'],
    })
    const existing = agentProfile({
      ...legacyProfileSnapshot(agent),
      updatedAt: 123,
    })
    store.currentId = agent.id
    store.agents.push(agent)
    store.profiles.push(existing)

    const profile = await resolveAgentProfileForAgent(agent.id)

    expect(profile.updatedAt).toBe(123)
    expect(store.updatedProfiles).toHaveLength(0)
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

function legacyProfileSnapshot(agent: AgentRow): Partial<AgentProfileRow> {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.name,
    description: agent.description,
    skillIds: agent.skillIds,
    mcpServerIds: agent.mcpServerIds,
    cliProfileIds: agent.cliProfileIds,
    memoryPolicy: {
      enabled: true,
      sourceAgentId: agent.id,
      privateFirst: true,
      reviewBeforeSharing: true,
    },
    permissionPolicy: {
      toolNames: agent.toolNames,
      supportsVision: agent.supportsVision,
      adapterName: agent.adapterName,
      modelProvider: agent.modelProvider,
      modelId: agent.modelId,
    },
    outputContract: {
      artifactType: 'report',
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
    successCriteria: ['交付物必须能被下一个节点或用户直接查看。', '最终产物类型必须是 report。', '覆盖能力要求：报告。'],
  }
}

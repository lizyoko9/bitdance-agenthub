import { describe, expect, it } from 'vitest'

import type {
  AgentProfileRow,
  SoftwareCommandRow,
  SoftwareProfileRow,
} from '@/db/schema'

import {
  buildSoftwareCapabilityStore,
  getFreeProductNotice,
  toggleSoftwareForAgent,
} from './software-capability-store'

const now = 1780000000000

function baseSoftwareProfile(overrides: Partial<SoftwareProfileRow> = {}): SoftwareProfileRow {
  return {
    id: 'sw_codex',
    name: 'Codex CLI',
    appType: 'cli_app',
    adapterType: 'cli',
    launchCommand: 'codex',
    executablePath: null,
    defaultWorkstationMode: 'browser_context',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function baseSoftwareCommand(overrides: Partial<SoftwareCommandRow> = {}): SoftwareCommandRow {
  return {
    id: 'cmd_codex_run',
    softwareProfileId: 'sw_codex',
    name: '运行 Codex',
    description: '用 Codex CLI 执行目标',
    inputSchema: {},
    outputSchema: {},
    implementation: { type: 'cli', commandTemplate: 'codex {{goal}}' },
    riskLevel: 'medium',
    requiresApproval: true,
    healthStatus: 'ok',
    lastTestResult: 'CLI software command test passed',
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function baseAgent(overrides: Partial<AgentProfileRow> = {}): AgentProfileRow {
  return {
    id: 'agent_writer',
    name: '写代码 Agent',
    role: 'writer',
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
    persona: {},
    systemPrompt: '',
    behaviorRules: [],
    successCriteria: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('software capability store', () => {
  it('builds store cards from software profiles and commands', () => {
    const state = buildSoftwareCapabilityStore({
      softwareProfiles: [baseSoftwareProfile()],
      softwareCommands: [baseSoftwareCommand()],
      cliProfiles: [],
      mcpServers: [],
      mcpTools: [],
      agents: [baseAgent({ softwareProfileIds: ['sw_codex'] })],
    })

    expect(state.cards).toHaveLength(10)
    expect(state.cards[0]).toMatchObject({
      key: 'software:sw_codex',
      name: 'Codex CLI',
      category: '开发工具',
      connectionStatus: '已接入',
      defaultMode: 'CLI',
      assignedAgentCount: 1,
    })
    expect(state.cards[0].modes.map((mode) => mode.kind)).toEqual(['CLI', '命令'])
  })

  it('keeps not-connected software visible from built-in catalog', () => {
    const state = buildSoftwareCapabilityStore({
      softwareProfiles: [],
      softwareCommands: [],
      cliProfiles: [],
      mcpServers: [],
      mcpTools: [],
      agents: [],
    })

    expect(state.cards.some((card) => card.name === '微信')).toBe(true)
    expect(state.cards.find((card) => card.name === '微信')?.connectionStatus).toBe('未接入')
  })

  it('toggles a software profile for an agent without touching other capabilities', () => {
    const agent = baseAgent({ softwareProfileIds: ['sw_a'], cliProfileIds: ['cli_keep'] })

    expect(toggleSoftwareForAgent(agent, 'sw_b')).toEqual({ softwareProfileIds: ['sw_a', 'sw_b'] })
    expect(toggleSoftwareForAgent({ ...agent, softwareProfileIds: ['sw_a', 'sw_b'] }, 'sw_a')).toEqual({
      softwareProfileIds: ['sw_b'],
    })
  })

  it('states that AgentHub is free and does not mention paid gates', () => {
    const notice = getFreeProductNotice()

    expect(notice).toContain('AgentHub 本体永久免费')
    expect(notice).not.toContain('会员')
    expect(notice).not.toContain('付费墙')
  })
})

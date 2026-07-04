import { describe, expect, it } from 'vitest'

import {
  AGENT_EMPLOYEE_SETTING_SECTIONS,
  assertSimpleAgentSettingsLabels,
  buildAgentSettingsCapabilitySummary,
} from './agent-employee-settings'

describe('agent employee settings model', () => {
  it('keeps visible sections at employee level', () => {
    expect(AGENT_EMPLOYEE_SETTING_SECTIONS.map((section) => section.id)).toEqual([
      'basic',
      'model',
      'toolkit',
      'permissions',
      'memory',
      'output',
    ])
    expect(AGENT_EMPLOYEE_SETTING_SECTIONS.map((section) => section.label)).toEqual([
      '基础信息',
      '模型选择',
      '员工工具包',
      '权限边界',
      '记忆学习',
      '交付产物',
    ])
  })

  it('rejects infrastructure creation labels inside agent settings', () => {
    expect(() =>
      assertSimpleAgentSettingsLabels(['基础信息', 'Network Profile', 'CLI Profile']),
    ).toThrow(/low-level/i)
    expect(() =>
      assertSimpleAgentSettingsLabels(['基础信息', 'Prompt Template', 'Style Guide']),
    ).toThrow(/low-level/i)
  })

  it('allows assigning already configured capabilities', () => {
    expect(() =>
      assertSimpleAgentSettingsLabels(['模型选择', '员工工具包', 'Skills', 'MCP', 'CLI']),
    ).not.toThrow()
  })

  it('summarizes selected toolkit counts', () => {
    const summary = buildAgentSettingsCapabilitySummary({
      toolNames: ['read_artifact', 'write_artifact'],
      skillIds: ['skill_a', 'skill_b', 'skill_c'],
      mcpServerIds: ['mcp_local'],
      cliProfileIds: ['cli_codex', 'cli_jianying'],
    })

    expect(summary).toEqual({
      tools: 2,
      skills: 3,
      mcpServers: 1,
      cliProfiles: 2,
      total: 8,
    })
  })
})

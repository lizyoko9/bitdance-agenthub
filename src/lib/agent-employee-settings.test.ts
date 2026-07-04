import { describe, expect, it } from 'vitest'

import {
  AGENT_EMPLOYEE_SETTING_SECTIONS,
  assertSimpleAgentSettingsLabels,
  buildAgentModelSelectionPatch,
  buildAgentSettingsCapabilitySummary,
} from './agent-employee-settings'

describe('agent employee settings', () => {
  it('keeps the visible editor focused on employee setup instead of infrastructure forms', () => {
    expect(() =>
      assertSimpleAgentSettingsLabels([
        ...AGENT_EMPLOYEE_SETTING_SECTIONS.map((section) => section.label),
        '选择模型',
        '员工工具包',
        '权限边界',
        '记忆学习',
        '交付产物',
      ]),
    ).not.toThrow()

    expect(() =>
      assertSimpleAgentSettingsLabels(['Network Profile', 'CLI Profile', 'MCP Server']),
    ).toThrow(/low-level infrastructure/)
  })

  it('summarizes assigned employee capabilities without counting duplicates', () => {
    expect(
      buildAgentSettingsCapabilitySummary({
        toolNames: ['bash', 'bash', 'fs_read'],
        skillIds: ['skill-a', 'skill-a'],
        mcpServerIds: ['mcp-a'],
        cliProfileIds: ['cli-a', 'cli-b'],
      }),
    ).toEqual({
      tools: 2,
      skills: 1,
      mcpServers: 1,
      cliProfiles: 2,
      total: 6,
    })
  })

  it('only lets agents pick already configured assignable models', () => {
    expect(
      buildAgentModelSelectionPatch({
        provider: 'deepseek',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        supportsVision: false,
      }),
    ).toEqual({
      adapterName: 'custom',
      modelProvider: 'deepseek',
      modelId: 'deepseek-chat',
      apiBaseUrl: 'https://api.deepseek.com',
      supportsVision: false,
    })

    expect(
      buildAgentModelSelectionPatch({
        provider: 'ollama',
        model: 'llama3',
        baseUrl: 'http://127.0.0.1:11434',
        supportsVision: false,
      }),
    ).toBeNull()
  })
})

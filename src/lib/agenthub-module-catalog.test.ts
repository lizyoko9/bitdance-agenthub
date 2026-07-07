import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AGENTHUB_MODULE_BLOCKS,
  getDefaultModuleLayout,
  getEnabledModuleLayout,
  normalizeModuleBlockId,
  resolveModuleActivation,
  validateModuleComposition,
} from './agenthub-module-catalog'

describe('agenthub module catalog', () => {
  it('keeps the primary product as composable free modules', () => {
    expect(getDefaultModuleLayout().map((module) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
    ])
    expect(AGENTHUB_MODULE_BLOCKS.every((module) => module.access === 'free')).toBe(true)
  })

  it('models module access as free-only instead of a free-or-paid product tier', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/agenthub-module-catalog.ts'), 'utf8')

    expect(source).toContain("export type AgentHubModuleAccess = 'free'")
    expect(source).not.toContain("'free' | 'paid'")
  })

  it('normalizes retired orchestration entries into the canonical canvas module', () => {
    expect(normalizeModuleBlockId('workflows')).toBe('agent-canvas')
    expect(normalizeModuleBlockId('agent-orchestration')).toBe('agent-canvas')
    expect(normalizeModuleBlockId('langflow-native')).toBe('agent-canvas')
    expect(normalizeModuleBlockId('infinite-canvas')).toBe('agent-canvas')
  })

  it('keeps agent memory inside the agent module instead of exposing a standalone memory block', () => {
    expect(normalizeModuleBlockId('memory')).toBe('agents')
    expect(AGENTHUB_MODULE_BLOCKS.map((module) => module.id)).not.toContain('memory')
  })

  it('documents memory and learning as an agent-internal employee brain, not a standalone module', () => {
    const moduleDoc = readFileSync(resolve(process.cwd(), 'docs/app-module-system.md'), 'utf8')
    const reportDoc = readFileSync(resolve(process.cwd(), 'docs/reference/agent-memory-learning-report.md'), 'utf8')

    expect(moduleDoc).toContain('记忆和学习不注册成独立主模块')
    expect(moduleDoc).toContain('旧的 `memory` 入口统一归一到 `agents`')
    expect(moduleDoc).toContain('自我校准')
    expect(moduleDoc).toContain('反思学习')
    expect(moduleDoc).not.toContain('`交付物`、`记忆管理`、`数据分析`')

    expect(reportDoc).toContain('用户看到的是“员工大脑”')
    expect(reportDoc).toContain('自我校准')
    expect(reportDoc).toContain('反思学习')
    expect(reportDoc).not.toContain('Memory Center')
    expect(reportDoc).not.toContain('Agent Factory')
    expect(reportDoc).not.toContain('PSM')
  })

  it('keeps the default layout visible when optional modules are added', () => {
    const activation = resolveModuleActivation(['analytics'])

    expect(activation.valid).toBe(true)
    expect(activation.enabledIds).toEqual(['analytics'])
    expect(activation.disabledIds).toContain('agent-canvas')
    expect(getEnabledModuleLayout(['analytics']).map((module) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
      'analytics',
    ])
  })

  it('normalizes legacy module ids before activation', () => {
    const activation = resolveModuleActivation(['langflow-native', 'employee-factory'])

    expect(activation.valid).toBe(true)
    expect(activation.enabledIds).toEqual(['models', 'agents', 'agent-canvas'])
    expect(activation.enabledIds).not.toContain('langflow-native')
    expect(activation.enabledIds).not.toContain('employee-factory')
  })

  it('reports unknown requested modules without enabling them', () => {
    const activation = resolveModuleActivation(['unknown-module'])

    expect(activation.valid).toBe(false)
    expect(activation.enabledIds).toEqual([])
    expect(activation.blockers).toEqual(['unknown-module is not a known AgentHub module'])
  })

  it('rejects missing dependencies and paid gated modules', () => {
    const report = validateModuleComposition([
      {
        id: 'custom-paid',
        label: '付费模块',
        layer: 'extension',
        access: 'paid' as 'free',
        defaultEnabled: true,
        dependencyIds: ['missing-module'],
      },
    ])

    expect(report.valid).toBe(false)
    expect(report.blockers).toEqual([
      'custom-paid cannot be paid gated',
      'custom-paid depends on missing module missing-module',
    ])
  })
})

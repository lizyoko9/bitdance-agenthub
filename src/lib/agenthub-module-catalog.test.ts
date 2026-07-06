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

  it('normalizes retired orchestration entries into the canonical canvas module', () => {
    expect(normalizeModuleBlockId('workflows')).toBe('agent-canvas')
    expect(normalizeModuleBlockId('agent-orchestration')).toBe('agent-canvas')
    expect(normalizeModuleBlockId('langflow-native')).toBe('agent-canvas')
    expect(normalizeModuleBlockId('infinite-canvas')).toBe('agent-canvas')
  })

  it('activates requested modules with dependencies in dependency-first order', () => {
    const activation = resolveModuleActivation(['memory'])

    expect(activation.valid).toBe(true)
    expect(activation.enabledIds).toEqual(['models', 'agents', 'memory'])
    expect(activation.disabledIds).toContain('agent-canvas')
    expect(getEnabledModuleLayout(['memory']).map((module) => module.id)).toEqual(['models', 'agents', 'memory'])
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
        access: 'paid',
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

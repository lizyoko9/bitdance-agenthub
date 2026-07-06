import { describe, expect, it } from 'vitest'

import {
  AGENTHUB_MODULE_BLOCKS,
  getDefaultModuleLayout,
  normalizeModuleBlockId,
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

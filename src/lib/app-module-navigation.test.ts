import { describe, expect, it } from 'vitest'

import {
  CANONICAL_ORCHESTRATION_MODULE_ID,
  buildVisibleAppModules,
  normalizeOrchestrationModuleId,
} from './app-module-navigation'

describe('app module navigation', () => {
  const modules = [
    { id: 'workbench', group: 'primary' },
    { id: 'workflows', group: 'primary' },
    { id: 'agent-canvas', group: 'primary' },
    { id: 'agent-orchestration', group: 'primary' },
    { id: 'langflow-native', group: 'primary' },
    { id: 'infinite-canvas', group: 'primary' },
    { id: 'analytics', group: 'advanced' },
  ] as const

  it('shows one primary orchestration entry in the sidebar', () => {
    const visible = buildVisibleAppModules(modules, 'primary')

    expect(visible.map((module) => module.id)).toEqual(['workbench', CANONICAL_ORCHESTRATION_MODULE_ID])
  })

  it('routes older orchestration module ids to the same canvas', () => {
    expect(normalizeOrchestrationModuleId('workflows')).toBe(CANONICAL_ORCHESTRATION_MODULE_ID)
    expect(normalizeOrchestrationModuleId('agent-orchestration')).toBe(CANONICAL_ORCHESTRATION_MODULE_ID)
    expect(normalizeOrchestrationModuleId('langflow-native')).toBe(CANONICAL_ORCHESTRATION_MODULE_ID)
    expect(normalizeOrchestrationModuleId('infinite-canvas')).toBe(CANONICAL_ORCHESTRATION_MODULE_ID)
  })
})

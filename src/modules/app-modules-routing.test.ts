import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { getDefaultModuleLayout } from '@/lib/agenthub-module-catalog'
import { buildAgentHubModuleManagerView } from '@/lib/agenthub-module-manager'
import { assertFreeProductCopy } from '@/lib/free-product-policy'

import {
  advancedAppModules,
  appModules,
  getEnabledAppModules,
  getAppModule,
  normalizeAppModuleId,
  primaryAppModules,
  type AppModuleId,
} from './app-modules'

describe('app module routing', () => {
  const legacyOrchestrationIds = [
    'workflows',
    'agent-orchestration',
    'langflow-native',
    'infinite-canvas',
  ] satisfies AppModuleId[]

  it('opens every legacy orchestration entry as the unified canvas module', () => {
    for (const id of legacyOrchestrationIds) {
      expect(normalizeAppModuleId(id)).toBe('agent-canvas')
      expect(getAppModule(id).id).toBe('agent-canvas')
      expect(getAppModule(id).label).toBe('编排画布')
    }
  })

  it('keeps retired orchestration aliases out of primary navigation data', () => {
    const moduleById = new Map(appModules.map((module) => [module.id, module]))

    for (const id of legacyOrchestrationIds) {
      expect(moduleById.get(id)?.group).toBe('hidden')
      expect(moduleById.get(id)?.label).toBe('编排画布')
    }
  })

  it('does not load the retired experimental orchestration pages from the registry', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app-modules.tsx'), 'utf8')

    expect(source).not.toContain('LangflowAgentOrchestrationModule')
    expect(source).not.toContain('LangflowNativeModule')
    expect(source).not.toContain('InfiniteCanvasModule')
    expect(source).not.toContain('WorkflowLibrary')
  })

  it('does not expose separate lifecycle or langflow canvas modules in primary navigation', () => {
    const primaryIds = primaryAppModules.map((module) => module.id)

    expect(primaryIds).toContain('agent-canvas')
    expect(primaryIds).not.toContain('workflows')
    expect(primaryIds).not.toContain('agent-orchestration')
    expect(primaryIds).not.toContain('langflow-native')
    expect(primaryIds).not.toContain('infinite-canvas')
    expect(appModules.some((module) => String(module.id) === 'agenthub-lifecycle')).toBe(false)
  })

  it('keeps primary navigation labels readable for Chinese users', () => {
    const primaryLabels = primaryAppModules.map((module) => module.label)

    expect(primaryLabels).toEqual([
      '工作台',
      '对话',
      '智能体',
      '编排画布',
      '技能管理',
      '模型管理',
      '工具连接',
    ])
  })

  it('keeps visible module copy aligned with the free-only product policy', () => {
    for (const appModule of [...primaryAppModules, ...advancedAppModules]) {
      expect(() => assertFreeProductCopy(`${appModule.label}\n${appModule.description}`)).not.toThrow()
    }
  })

  it('keeps primary navigation aligned with the default module block layout', () => {
    expect(primaryAppModules.map((module) => module.id)).toEqual(getDefaultModuleLayout().map((module) => module.id))
  })

  it('keeps default module manager activation aligned with the primary navigation', () => {
    expect(buildAgentHubModuleManagerView().activeModules.map((module) => module.id)).toEqual(
      primaryAppModules.map((module) => module.id),
    )
  })

  it('keeps optional modules out of the default sidebar until they are enabled', () => {
    expect(advancedAppModules.map((module) => module.id)).toEqual([])
  })

  it('keeps the default workspace modules visible when a workbench block is added', () => {
    expect(getEnabledAppModules(['analytics']).map((module) => module.id)).toEqual([
      ...getDefaultModuleLayout().map((module) => module.id),
      'analytics',
    ])
  })

  it('routes the retired memory module back into the agent settings module', () => {
    expect(getEnabledAppModules(['memory']).map((module) => module.id)).toEqual(
      getDefaultModuleLayout().map((module) => module.id),
    )
    expect(normalizeAppModuleId('memory')).toBe('agents')
  })

  it('routes retired config and delivery-check modules back to the workbench without loading their old pages', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/app-modules.tsx'), 'utf8')

    expect(normalizeAppModuleId('configops')).toBe('workbench')
    expect(normalizeAppModuleId('production')).toBe('workbench')
    expect(getAppModule('configops').id).toBe('workbench')
    expect(getAppModule('production').id).toBe('workbench')
    expect(source).not.toContain('ConfigOpsCenter')
    expect(source).not.toContain('ProductionIntegrationsCenter')
  })
})

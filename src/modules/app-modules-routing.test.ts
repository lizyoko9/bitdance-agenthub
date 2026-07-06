import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  appModules,
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
})

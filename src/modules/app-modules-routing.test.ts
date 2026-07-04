import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { appModules, getAppModule, normalizeAppModuleId, type AppModuleId } from './app-modules'

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
})

import { describe, expect, it } from 'vitest'

import { buildAgentHubModuleManagerView } from './agenthub-module-manager'

describe('agenthub module manager', () => {
  it('shows the default product as active free modules and keeps optional modules available', () => {
    const view = buildAgentHubModuleManagerView()

    expect(view.activeModules.map((module) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
    ])
    expect(view.availableModules.map((module) => module.id)).toEqual(['artifacts', 'analytics'])
    expect(view.activeModules.every((module) => module.access === 'free')).toBe(true)
    expect(view.availableModules.every((module) => module.access === 'free')).toBe(true)
  })

  it('moves requested optional modules into the active module set with dependencies', () => {
    const view = buildAgentHubModuleManagerView({ enabledModuleIds: ['artifacts'] })

    expect(view.activeModules.map((module) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
      'artifacts',
    ])
    expect(view.availableModules.map((module) => module.id)).toEqual([
      'analytics',
    ])
    expect(view.activeModules.find((module) => module.id === 'artifacts')?.dependencyIds).toEqual([
      'models',
      'agents',
      'agent-canvas',
    ])
  })

  it('normalizes legacy module requests before building the view', () => {
    const view = buildAgentHubModuleManagerView({ enabledModuleIds: ['langflow-native', 'employee-factory'] })

    expect(view.activeModules.map((module) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
    ])
    expect(view.blockers).toEqual([])
  })

  it('surfaces invalid module ids without dropping the default workspace modules', () => {
    const view = buildAgentHubModuleManagerView({ enabledModuleIds: ['unknown-module'] })

    expect(view.activeModules.map((module) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
    ])
    expect(view.blockers).toEqual(['unknown-module is not a known AgentHub module'])
  })

  it('adds user-facing module status and dependency guidance for the module store UI', () => {
    const view = buildAgentHubModuleManagerView({ enabledModuleIds: ['analytics'] })
    const activeCanvas = view.activeModules.find((module) => module.id === 'agent-canvas')
    const artifacts = view.availableModules.find((module) => module.id === 'artifacts')
    const analytics = view.activeModules.find((module) => module.id === 'analytics')

    expect(activeCanvas).toMatchObject({
      statusLabel: '已启用',
      statusTone: 'ready',
      actionLabel: '打开',
      dependencyHint: '依赖已就绪：模型管理、智能体',
    })
    expect(artifacts).toMatchObject({
      statusTone: 'muted',
      dependencyIds: ['models', 'agents', 'agent-canvas'],
    })
    expect(analytics).toMatchObject({
      defaultEnabled: false,
      active: true,
    })
  })
})

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
    expect(view.availableModules.map((module) => module.id)).toEqual(['artifacts', 'memory', 'analytics'])
    expect(view.activeModules.every((module) => module.access === 'free')).toBe(true)
    expect(view.availableModules.every((module) => module.access === 'free')).toBe(true)
  })

  it('moves requested optional modules into the active module set with dependencies', () => {
    const view = buildAgentHubModuleManagerView({ enabledModuleIds: ['memory'] })

    expect(view.activeModules.map((module) => module.id)).toEqual(['models', 'agents', 'memory'])
    expect(view.availableModules.map((module) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agent-canvas',
      'skills',
      'tools',
      'artifacts',
      'analytics',
    ])
    expect(view.activeModules.find((module) => module.id === 'memory')?.dependencyLabels).toEqual([
      '模型管理',
      '智能体',
    ])
  })

  it('normalizes legacy module requests before building the view', () => {
    const view = buildAgentHubModuleManagerView({ enabledModuleIds: ['langflow-native', 'employee-factory'] })

    expect(view.activeModules.map((module) => module.id)).toEqual(['models', 'agents', 'agent-canvas'])
    expect(view.blockers).toEqual([])
  })

  it('surfaces invalid module ids without enabling them', () => {
    const view = buildAgentHubModuleManagerView({ enabledModuleIds: ['unknown-module'] })

    expect(view.activeModules).toEqual([])
    expect(view.blockers).toEqual(['unknown-module is not a known AgentHub module'])
  })

  it('adds user-facing module status and dependency guidance for the module store UI', () => {
    const view = buildAgentHubModuleManagerView()
    const activeCanvas = view.activeModules.find((module) => module.id === 'agent-canvas')
    const memory = view.availableModules.find((module) => module.id === 'memory')
    const analytics = view.availableModules.find((module) => module.id === 'analytics')

    expect(activeCanvas).toMatchObject({
      statusLabel: '已启用',
      statusTone: 'ready',
      actionLabel: '打开',
      dependencyHint: '依赖已就绪：模型管理、智能体',
    })
    expect(memory).toMatchObject({
      statusLabel: '可加入',
      statusTone: 'muted',
      actionLabel: '加入模块',
      dependencyHint: '加入时会自动带上：模型管理、智能体',
    })
    expect(analytics).toMatchObject({
      statusLabel: '可直接加入',
      statusTone: 'ready',
      actionLabel: '加入模块',
      dependencyHint: '无需额外依赖',
    })
  })
})

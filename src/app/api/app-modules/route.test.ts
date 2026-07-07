import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { GET } from './route'

function makeReq(url: string) {
  return new NextRequest(new Request(url))
}

describe('GET /api/app-modules', () => {
  it('returns the default module manager view', async () => {
    const res = await GET(makeReq('http://localhost/api/app-modules'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.moduleManager.activeModules.map((module: { id: string }) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
    ])
    expect(body.moduleManager.availableModules.map((module: { id: string }) => module.id)).toEqual([
      'artifacts',
      'analytics',
    ])
    expect(
      body.moduleManager.activeModules.find((module: { id: string }) => module.id === 'agent-canvas'),
    ).toMatchObject({
      statusLabel: '已启用',
      actionLabel: '打开',
      dependencyHint: '依赖已就绪：模型管理、智能体',
    })
    expect(
      body.moduleManager.availableModules.find((module: { id: string }) => module.id === 'artifacts'),
    ).toMatchObject({
      dependencyIds: ['models', 'agents', 'agent-canvas'],
    })
  })

  it('previews requested module activation on top of the default workspace modules', async () => {
    const res = await GET(makeReq('http://localhost/api/app-modules?enabled=artifacts'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.moduleManager.activeModules.map((module: { id: string }) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
      'artifacts',
    ])
    expect(body.moduleManager.blockers).toEqual([])
  })

  it('surfaces invalid requested modules without dropping defaults', async () => {
    const res = await GET(makeReq('http://localhost/api/app-modules?enabled=unknown-module'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.moduleManager.activeModules.map((module: { id: string }) => module.id)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
    ])
    expect(body.moduleManager.blockers).toEqual(['unknown-module is not a known AgentHub module'])
  })
})

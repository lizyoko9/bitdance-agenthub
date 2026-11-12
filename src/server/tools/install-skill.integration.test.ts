import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { StreamEvent } from '@/shared/types'
import type { ToolContext } from './types'

vi.mock('@/server/skill-fetch', () => ({ fetchSkillFromGitHub: vi.fn() }))

let tool: typeof import('./install-skill').installSkillTool
let pending: typeof import('../pending-skill-installs').pendingSkillInstalls
let service: typeof import('../skill-service')
let fetchSkill: ReturnType<typeof vi.fn>
const context: ToolContext = {
  conversationId: 'conv_tool_install',
  agentId: 'ag_tool_install',
  runId: 'run_tool_install',
  workspacePath: '/tmp',
  abortSignal: new AbortController().signal,
}
const sourceUrl = 'https://raw.githubusercontent.com/o/r/main/SKILL.md'

beforeAll(async () => {
  process.env.AGENTHUB_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'agenthub-install-tool-it-'))
  service = await import('../skill-service')
  pending = (await import('../pending-skill-installs')).pendingSkillInstalls
  tool = (await import('./install-skill')).installSkillTool
  fetchSkill = vi.mocked((await import('../skill-fetch')).fetchSkillFromGitHub)
  const { db, schema } = await import('@/db/client')
  await db.insert(schema.agents).values({
    id: context.agentId, name: 'Installer', avatar: '🤖', description: 'test',
    capabilities: [], systemPrompt: 'p', adapterName: 'custom', modelProvider: 'deepseek',
    modelId: 'm', toolNames: ['install_skill'], skillIds: [], createdAt: Date.now(),
  })
})

afterEach(() => {
  for (const install of pending.listByConversation(context.conversationId)) pending.cancel(install.id)
  vi.clearAllMocks()
})

describe('install_skill approval boundary', () => {
  it('normalizes long metadata before approval and shares the catalog rules', async () => {
    const instruction = 'A complete instruction body that must remain unchanged.'
    fetchSkill.mockResolvedValue({
      mode: 'install', finalUrl: sourceUrl,
      parsed: { name: 'n'.repeat(90), description: 'd'.repeat(837), instruction },
    })
    const operation = tool.handler({ url: sourceUrl }, context)
    await vi.waitFor(() => expect(pending.listByConversation(context.conversationId)).toHaveLength(1))
    const install = pending.listByConversation(context.conversationId)[0]
    expect(install.name).toHaveLength(64)
    expect(install.description).toHaveLength(280)
    expect(install.instruction).toBe(instruction)
    expect(await pending.approve(install.id)).toBe(true)
    expect((await operation).ok).toBe(true)

    const catalog = await service.installCatalogSkill({ sourceUri: sourceUrl, category: 'imported' })
    expect(catalog.name).toBe(install.name)
    expect(catalog.description).toBe(install.description)
    expect(catalog.instruction).toBe(instruction)
  })

  it('rejects oversized instruction bodies before publishing an approval', async () => {
    fetchSkill.mockResolvedValue({
      mode: 'install', finalUrl: sourceUrl,
      parsed: { name: 'Too large', description: 'd', instruction: 'x'.repeat(20_001) },
    })
    const result = await tool.handler({ url: sourceUrl }, context)
    expect(result).toEqual({ ok: false, error: 'Skill 指令正文不能超过 20000 字' })
    expect(pending.listByConversation(context.conversationId)).toEqual([])
    await expect(service.installCatalogSkill({ sourceUri: sourceUrl, category: 'imported' }))
      .rejects.toThrow('Skill 指令正文不能超过 20000 字')
  })

  it('settles an aborted approval and broadcasts exactly one removal event', async () => {
    fetchSkill.mockResolvedValue({
      mode: 'install', finalUrl: sourceUrl,
      parsed: { name: 'Abort skill', description: 'd', instruction: 'complete body' },
    })
    const controller = new AbortController()
    const { eventBus } = await import('../event-bus')
    const events: StreamEvent[] = []
    const unsubscribe = eventBus.subscribe(({ event }) => events.push(event))
    try {
      const operation = tool.handler({ url: sourceUrl }, { ...context, abortSignal: controller.signal })
      await vi.waitFor(() => expect(pending.listByConversation(context.conversationId)).toHaveLength(1))
      const install = pending.listByConversation(context.conversationId)[0]
      controller.abort()
      expect((await operation).ok).toBe(false)
      pending.cancel(install.id)
      expect(await pending.approve(install.id)).toBe(false)
      expect(pending.listByConversation(context.conversationId)).toEqual([])
      expect(events.filter((event) => event.type === 'skill_install.resolved'))
        .toEqual([expect.objectContaining({ pendingId: install.id, installed: false })])
      expect((await service.listAllSkills()).some((skill) => skill.name === 'Abort skill')).toBe(false)
    } finally {
      unsubscribe()
    }
  })

  it('does not publish an approval after the run has already aborted', async () => {
    fetchSkill.mockResolvedValue({
      mode: 'install', finalUrl: sourceUrl,
      parsed: { name: 'Already aborted', description: 'd', instruction: 'body' },
    })
    const controller = new AbortController()
    controller.abort()
    expect((await tool.handler({ url: sourceUrl }, { ...context, abortSignal: controller.signal })).ok)
      .toBe(false)
    expect(pending.listByConversation(context.conversationId)).toEqual([])
  })
})

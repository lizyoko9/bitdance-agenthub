import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

// 在导入 @/db/client 之前把数据目录指向临时 DB，隔离真实 .agenthub-data。
// 用动态 import 保证 env 先于 client.ts 模块初始化生效。
let svc: typeof import('./skill-service')

beforeAll(async () => {
  process.env.AGENTHUB_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'agenthub-skill-it-'))
  svc = await import('./skill-service')
})

describe('skill-service integration (temp DB)', () => {
  it('bootstrap seeds builtin skills', async () => {
    const all = await svc.listAllSkills()
    expect(all.filter((s) => s.isBuiltin).length).toBeGreaterThanOrEqual(8)
  })

  it('creates, updates, and deletes a user skill', async () => {
    const created = await svc.createSkill({
      name: 'IT Skill',
      description: 'd',
      category: 'c',
      instruction: 'do x',
    })
    expect(created.source).toBe('user')
    expect(created.id.startsWith('skill_')).toBe(true)

    const updated = await svc.updateSkill(created.id, { name: 'IT Skill 2', enabled: false })
    expect(updated.name).toBe('IT Skill 2')
    expect(updated.enabled).toBe(false)
    expect(updated.updatedAt).toBeGreaterThan(0)

    await svc.deleteSkill(created.id)
    const after = await svc.listAllSkills()
    expect(after.find((s) => s.id === created.id)).toBeUndefined()
  })

  it('blocks editing/deleting builtin content but allows enable/disable', async () => {
    const builtin = (await svc.listAllSkills()).find((s) => s.isBuiltin)
    expect(builtin).toBeDefined()
    await expect(svc.updateSkill(builtin!.id, { name: 'hacked' })).rejects.toThrow()
    await expect(svc.deleteSkill(builtin!.id)).rejects.toThrow()

    const toggled = await svc.updateSkill(builtin!.id, { enabled: false })
    expect(toggled.enabled).toBe(false)
    await svc.updateSkill(builtin!.id, { enabled: true })
  })

  it('imports a batch, marks source=imported, reports per-item failure', async () => {
    const res = await svc.importSkills([
      { name: 'Imp A', description: 'a', category: 'imported', instruction: 'ia' },
      { name: '', description: 'bad', category: 'imported', instruction: 'ib' },
    ])
    expect(res.created).toHaveLength(1)
    expect(res.created[0].source).toBe('imported')
    expect(res.failed).toHaveLength(1)
    expect(res.failed[0].index).toBe(1)
  })

  it('resolveSkillsByIds preserves order, skips missing and disabled', async () => {
    const a = await svc.createSkill({ name: 'A', description: 'd', category: 'c', instruction: 'ia' })
    const b = await svc.createSkill({ name: 'B', description: 'd', category: 'c', instruction: 'ib' })
    await svc.updateSkill(b.id, { enabled: false })

    const resolved = await svc.resolveSkillsByIds([b.id, 'skill_missing', a.id])
    expect(resolved.map((s) => s.id)).toEqual([a.id])
  })

  it('load_skill tool enforces agent scope (越权拒)', async () => {
    const { db, schema } = await import('@/db/client')
    const { loadSkillTool } = await import('@/server/tools/load-skill')

    const bound = await svc.createSkill({ name: 'Bound', description: 'd', category: 'c', instruction: 'bound body' })
    const other = await svc.createSkill({ name: 'Other', description: 'd', category: 'c', instruction: 'other body' })

    const now = Date.now()
    await db.insert(schema.agents).values({
      id: 'ag_skilltest',
      name: 'T',
      avatar: '🤖',
      description: 'd',
      capabilities: [],
      systemPrompt: 'p',
      adapterName: 'custom',
      modelProvider: 'deepseek',
      modelId: 'm',
      toolNames: [],
      skillIds: [bound.id],
      createdAt: now,
    })

    const ctx = {
      conversationId: 'conv_x',
      workspacePath: '/tmp',
      agentId: 'ag_skilltest',
      runId: 'run_x',
      abortSignal: new AbortController().signal,
    }

    const okRes = await loadSkillTool.handler({ skillId: bound.id }, ctx)
    expect(okRes.ok).toBe(true)
    if (okRes.ok) expect((okRes.value as { instruction: string }).instruction).toBe('bound body')

    // 未绑定的 skill → 拒绝（即便它真实存在）
    const denied = await loadSkillTool.handler({ skillId: other.id }, ctx)
    expect(denied.ok).toBe(false)

    // 不存在的 skill → 拒绝
    const missing = await loadSkillTool.handler({ skillId: 'skill_nope' }, ctx)
    expect(missing.ok).toBe(false)
  })

  it('pending skill install approve creates imported skill + binds to agent', async () => {
    const { db, schema } = await import('@/db/client')
    const { pendingSkillInstalls } = await import('./pending-skill-installs')
    const { eq } = await import('drizzle-orm')

    const now = Date.now()
    await db.insert(schema.agents).values({
      id: 'ag_install',
      name: 'Inst',
      avatar: '🤖',
      description: 'd',
      capabilities: [],
      systemPrompt: 'p',
      adapterName: 'custom',
      modelProvider: 'deepseek',
      modelId: 'm',
      toolNames: [],
      skillIds: [],
      createdAt: now,
    })

    const pending = pendingSkillInstalls.register({
      conversationId: 'conv_i',
      agentId: 'ag_install',
      runId: 'run_i',
      sourceUrl: 'https://raw.githubusercontent.com/o/r/main/skills/x/SKILL.md',
      name: 'Installed',
      description: 'from web',
      category: 'imported',
      instruction: 'web body',
    })

    const ok = await pendingSkillInstalls.approve(pending.id)
    expect(ok).toBe(true)

    const all = await svc.listAllSkills()
    const installed = all.find((s) => s.name === 'Installed')
    expect(installed).toBeDefined()
    expect(installed!.source).toBe('imported')
    expect(installed!.sourceUri).toBe('https://raw.githubusercontent.com/o/r/main/skills/x/SKILL.md')

    const agent = await db.query.agents.findFirst({ where: eq(schema.agents.id, 'ag_install') })
    expect(agent!.skillIds).toContain(installed!.id)
  })

  it('SDK agent keeps only opt-in install_skill in toolNames; custom keeps all', async () => {
    const { createCustomAgent } = await import('./agent-service')

    const sdk = await createCustomAgent({
      name: 'CC',
      avatar: '',
      description: 'd',
      capabilities: [],
      systemPrompt: 'p',
      adapterName: 'claude-code',
      toolNames: ['install_skill', 'bash', 'fs_write'],
    })
    expect(sdk.toolNames).toEqual(['install_skill'])

    const custom = await createCustomAgent({
      name: 'CU',
      avatar: '',
      description: 'd',
      capabilities: [],
      systemPrompt: 'p',
      adapterName: 'custom',
      modelProvider: 'deepseek',
      modelId: 'deepseek-v4-flash',
      toolNames: ['install_skill', 'bash', 'fs_write'],
    })
    expect(custom.toolNames).toEqual(['install_skill', 'bash', 'fs_write'])
  })

  // ─── Phase 2E: 公共池 + 有效 Skill 并集 ───────────────────────────
  it('resolveEffectiveSkills = selected first, public appended, deduped', async () => {
    const sel = await svc.createSkill({ name: 'ESel', description: 'd', category: 'c', instruction: 's' })
    const pubOnly = await svc.createSkill({
      name: 'EPub',
      description: 'd',
      category: 'c',
      instruction: 'p',
      isGlobalDefault: true,
    })

    const eff = await svc.resolveEffectiveSkills({ skillIds: [sel.id] })
    const ids = eff.map((s) => s.id)
    expect(ids).toContain(sel.id)
    expect(ids).toContain(pubOnly.id)
    // 自选排在公共之前（优先拿内联额度）
    expect(ids.indexOf(sel.id)).toBeLessThan(ids.indexOf(pubOnly.id))

    // 既被自选又是公共 → 只出现一次，且保持在自选位置
    await svc.updateSkill(sel.id, { isGlobalDefault: true })
    const eff2 = await svc.resolveEffectiveSkills({ skillIds: [sel.id] })
    expect(eff2.filter((s) => s.id === sel.id)).toHaveLength(1)
  })

  it('resolveEffectiveSkills excludes a disabled public skill', async () => {
    const pub = await svc.createSkill({
      name: 'EPubDis',
      description: 'd',
      category: 'c',
      instruction: 'p',
      isGlobalDefault: true,
    })
    await svc.updateSkill(pub.id, { enabled: false })
    const eff = await svc.resolveEffectiveSkills({ skillIds: [] })
    expect(eff.map((s) => s.id)).not.toContain(pub.id)
  })

  it('builtin skill can toggle public (isGlobalDefault) but still not content-edit', async () => {
    const builtin = (await svc.listAllSkills()).find((s) => s.isBuiltin)!
    const toggled = await svc.updateSkill(builtin.id, { isGlobalDefault: true })
    expect(toggled.isGlobalDefault).toBe(true)
    await expect(svc.updateSkill(builtin.id, { name: 'nope' })).rejects.toThrow()
    await svc.updateSkill(builtin.id, { isGlobalDefault: false }) // 复位，避免污染后续用例
  })

  it('load_skill allows a public skill not listed in agent.skillIds', async () => {
    const { db, schema } = await import('@/db/client')
    const { loadSkillTool } = await import('@/server/tools/load-skill')

    const pub = await svc.createSkill({
      name: 'LPub',
      description: 'd',
      category: 'c',
      instruction: 'public body',
      isGlobalDefault: true,
    })
    const now = Date.now()
    await db.insert(schema.agents).values({
      id: 'ag_pubscope',
      name: 'P',
      avatar: '🤖',
      description: 'd',
      capabilities: [],
      systemPrompt: 'p',
      adapterName: 'custom',
      modelProvider: 'deepseek',
      modelId: 'm',
      toolNames: [],
      skillIds: [], // 没有显式选任何 skill
      createdAt: now,
    })

    const ctx = {
      conversationId: 'conv_p',
      workspacePath: '/tmp',
      agentId: 'ag_pubscope',
      runId: 'run_p',
      abortSignal: new AbortController().signal,
    }
    const res = await loadSkillTool.handler({ skillId: pub.id }, ctx)
    expect(res.ok).toBe(true)
    if (res.ok) expect((res.value as { instruction: string }).instruction).toBe('public body')
  })

  it('countSkillUsage counts selecting agents; public = all agents', async () => {
    const { db, schema } = await import('@/db/client')
    const s1 = await svc.createSkill({ name: 'USkill', description: 'd', category: 'c', instruction: 'x' })
    const now = Date.now()
    await db.insert(schema.agents).values({
      id: 'ag_use1',
      name: 'U1',
      avatar: '🤖',
      description: 'd',
      capabilities: [],
      systemPrompt: 'p',
      adapterName: 'custom',
      modelProvider: 'deepseek',
      modelId: 'm',
      toolNames: [],
      skillIds: [s1.id],
      createdAt: now,
    })

    const usage = await svc.countSkillUsage()
    expect(usage[s1.id]).toBeGreaterThanOrEqual(1)

    const pub = await svc.createSkill({
      name: 'UPub',
      description: 'd',
      category: 'c',
      instruction: 'p',
      isGlobalDefault: true,
    })
    const usage2 = await svc.countSkillUsage()
    const totalAgents = (await db.query.agents.findMany()).length
    expect(usage2[pub.id]).toBe(totalAgents)
  })
})

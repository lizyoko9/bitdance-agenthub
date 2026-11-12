import { eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type { PendingSkillInstall } from '@/shared/types'

import { eventBus } from './event-bus'
import { newPendingSkillInstallId } from './ids'
import { createSkill, deleteSkill } from './skill-service'

/**
 * install_skill 会话安装审批中心（spec 16）。镜像 pending-writes：
 * 每个 pending 持有 promise resolver；用户 approve / reject / run abort 时 resolve。
 *
 * approve 时才真正 createSkill(source='imported') 并绑定到当前 agent —— fetch 已在工具层
 * 完成（SSRF 已拦），审批门负责「装不装这份内容」。
 */

interface PendingEntry {
  install: PendingSkillInstall
  resolver: ((decision: { installed: boolean; skillId?: string }) => void) | null
}

class PendingSkillInstallsStore {
  private map = new Map<string, PendingEntry>()

  register(args: {
    conversationId: string
    agentId: string
    runId: string
    sourceUrl: string
    name: string
    description: string
    category: string
    instruction: string
  }): PendingSkillInstall {
    const install: PendingSkillInstall = {
      id: newPendingSkillInstallId(),
      conversationId: args.conversationId,
      agentId: args.agentId,
      runId: args.runId,
      sourceUrl: args.sourceUrl,
      name: args.name,
      description: args.description,
      category: args.category,
      instruction: args.instruction,
      createdAt: Date.now(),
    }
    this.map.set(install.id, { install, resolver: null })

    eventBus.publish({
      type: 'skill_install.pending',
      conversationId: args.conversationId,
      timestamp: install.createdAt,
      pendingInstall: install,
    })
    return install
  }

  attachResolver(
    id: string,
    resolver: (decision: { installed: boolean; skillId?: string }) => void,
  ): void {
    const entry = this.map.get(id)
    if (entry) entry.resolver = resolver
  }

  get(id: string): PendingSkillInstall | undefined {
    return this.map.get(id)?.install
  }

  listByConversation(conversationId: string): PendingSkillInstall[] {
    return Array.from(this.map.values())
      .filter((e) => e.install.conversationId === conversationId)
      .map((e) => e.install)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  /** 批准：建 imported skill + 绑定到当前 agent；绑定失败回滚已建 skill。 */
  async approve(id: string): Promise<boolean> {
    const entry = this.map.get(id)
    if (!entry) return false
    const { install } = entry

    let skillId: string | undefined
    try {
      const skill = await createSkill({
        name: install.name,
        description: install.description,
        category: install.category,
        instruction: install.instruction,
        source: 'imported',
        sourceUri: install.sourceUrl,
      })
      skillId = skill.id

      const agent = await db.query.agents.findFirst({
        where: eq(schema.agents.id, install.agentId),
      })
      if (agent) {
        const next = agent.skillIds.includes(skill.id)
          ? agent.skillIds
          : [...agent.skillIds, skill.id]
        await db.update(schema.agents).set({ skillIds: next }).where(eq(schema.agents.id, agent.id))
      }
    } catch (err) {
      console.error('[pendingSkillInstalls] approve failed', err)
      if (skillId) await deleteSkill(skillId).catch(() => {}) // 回滚半截 skill
      this.finalize(id, false)
      return false
    }

    this.finalize(id, true, skillId)
    return true
  }

  reject(id: string): boolean {
    if (!this.map.has(id)) return false
    this.finalize(id, false)
    return true
  }

  /** run abort 路径：resolve 为未安装并移除，不发 SSE（run cleanup 会处理前端）。 */
  cancel(id: string): void {
    const entry = this.map.get(id)
    if (!entry) return
    entry.resolver?.({ installed: false })
    this.map.delete(id)
  }

  private finalize(id: string, installed: boolean, skillId?: string) {
    const entry = this.map.get(id)
    if (!entry) return
    entry.resolver?.({ installed, skillId })
    this.map.delete(id)
    eventBus.publish({
      type: 'skill_install.resolved',
      conversationId: entry.install.conversationId,
      timestamp: Date.now(),
      pendingId: id,
      installed,
      skillId,
    })
  }
}

const globalForPSI = globalThis as unknown as {
  __agenthubPendingSkillInstalls?: PendingSkillInstallsStore
}

export const pendingSkillInstalls =
  globalForPSI.__agenthubPendingSkillInstalls ?? new PendingSkillInstallsStore()

if (!globalForPSI.__agenthubPendingSkillInstalls) {
  globalForPSI.__agenthubPendingSkillInstalls = pendingSkillInstalls
}

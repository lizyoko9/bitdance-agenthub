import type { PendingSkillInstall } from '@/shared/types'

import { eventBus } from './event-bus'
import { newPendingSkillInstallId } from './ids'
import { createAndBindSkill } from './skill-service'

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
    const entry = this.take(id)
    if (!entry) return false
    const { install } = entry

    let skillId: string | undefined
    try {
      const skill = createAndBindSkill({
        name: install.name,
        description: install.description,
        category: install.category,
        instruction: install.instruction,
        source: 'imported',
        sourceUri: install.sourceUrl,
      }, install.agentId)
      skillId = skill.id
    } catch (err) {
      console.error('[pendingSkillInstalls] approve failed', err)
      this.finalize(entry, false)
      return false
    }

    this.finalize(entry, true, skillId)
    return true
  }

  reject(id: string): boolean {
    const entry = this.take(id)
    if (!entry) return false
    this.finalize(entry, false)
    return true
  }

  /** 中止也广播终态，让所有客户端移除审批卡。 */
  cancel(id: string): void {
    this.reject(id)
  }

  private take(id: string): PendingEntry | undefined {
    const entry = this.map.get(id)
    this.map.delete(id)
    return entry
  }

  private finalize(entry: PendingEntry, installed: boolean, skillId?: string) {
    entry.resolver?.({ installed, skillId })
    eventBus.publish({
      type: 'skill_install.resolved',
      conversationId: entry.install.conversationId,
      timestamp: Date.now(),
      pendingId: entry.install.id,
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

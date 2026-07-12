import { z } from 'zod'

import { fetchSkillFromGitHub } from '@/server/skill-fetch'
import { pendingSkillInstalls } from '@/server/pending-skill-installs'

import type { ToolDef } from './types'

export const INSTALL_SKILL_TOOL_NAME = 'install_skill'

const ArgsSchema = z.object({ url: z.string().min(1) })

const IMPORTED_CATEGORY = 'imported'

/**
 * install_skill —— 从 GitHub 公开链接安装一个 Skill 到当前 Agent（spec 16）。
 *
 * - bare 仓库链接 → 枚举候选返回（不安装、不审批）；模型再用具体链接调一次。
 * - 具体 SKILL.md/目录链接 → fetch+解析（SSRF 已在 skill-fetch 拦死）→ 注册审批 →
 *   用户批准才建 imported skill 并绑定到当前 agent。
 *
 * opt-in：默认不在任何工具预设，用户须显式勾选该工具。
 */
export const installSkillTool: ToolDef = {
  name: INSTALL_SKILL_TOOL_NAME,
  description:
    '从一个公开 GitHub 链接安装 Skill 到当前 Agent（需用户审批）。仅支持 GitHub：可传 SKILL.md 的 raw/blob 链接、skill 目录的 tree 链接，或仓库链接（会先列出其中的 SKILL.md 候选让你再选）。',
  parameters: {
    type: 'object',
    required: ['url'],
    properties: {
      url: {
        type: 'string',
        description: 'GitHub 链接：SKILL.md（raw/blob）、skill 目录（tree），或仓库根（枚举候选）。',
      },
    },
  },
  async handler(args, ctx) {
    const parsed = ArgsSchema.safeParse(args)
    if (!parsed.success) return { ok: false, error: `Invalid args: ${parsed.error.message}` }

    let fetched
    try {
      fetched = await fetchSkillFromGitHub(parsed.data.url, ctx.abortSignal)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }

    // bare 仓库：返回候选列表，不安装。
    if (fetched.mode === 'enumerate') {
      if (fetched.candidates.length === 0) {
        return { ok: false, error: `仓库 ${fetched.owner}/${fetched.repo} 内未找到 SKILL.md` }
      }
      return {
        ok: true,
        value: {
          mode: 'enumerate' as const,
          message: `仓库内发现 ${fetched.candidates.length} 个 skill，请用具体链接再次调用 install_skill 安装其中一个。`,
          candidates: fetched.candidates.map((c) => ({
            name: c.dir || c.path,
            installUrl: c.installUrl,
          })),
        },
      }
    }

    // 具体 SKILL.md：注册审批门，阻塞等用户决定。
    const { parsed: skill, finalUrl } = fetched
    const pending = pendingSkillInstalls.register({
      conversationId: ctx.conversationId,
      agentId: ctx.agentId,
      runId: ctx.runId,
      sourceUrl: finalUrl,
      name: skill.name || '未命名 Skill',
      description: skill.description || '（来自导入，无描述）',
      category: IMPORTED_CATEGORY,
      instruction: skill.instruction,
    })

    const decision = await new Promise<{ installed: boolean; skillId?: string }>((resolve) => {
      pendingSkillInstalls.attachResolver(pending.id, resolve)
      const onAbort = () => {
        pendingSkillInstalls.cancel(pending.id)
        resolve({ installed: false })
      }
      if (ctx.abortSignal.aborted) onAbort()
      else ctx.abortSignal.addEventListener('abort', onAbort, { once: true })
    })

    if (!decision.installed) {
      return { ok: false, error: '用户未批准该 Skill 安装' }
    }
    return {
      ok: true,
      value: {
        mode: 'installed' as const,
        skillId: decision.skillId,
        name: pending.name,
        message: `已安装 Skill「${pending.name}」并绑定到当前 Agent。`,
      },
    }
  },
}

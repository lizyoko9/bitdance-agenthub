import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db, schema } from '@/db/client'
import { resolveEffectiveSkills } from '@/server/skill-service'

import type { ToolDef } from './types'

export const LOAD_SKILL_TOOL_NAME = 'load_skill'

const ArgsSchema = z.object({ skillId: z.string().min(1) })

/**
 * 渐进披露：按需加载当前 Agent 已装备 Skill 的完整方法说明。
 * **作用域严格限定**：只能加载该 Agent 的**有效 Skill 集**（自选 ∪ 公共池）内的 skill；
 * 集合之外的 id 一律拒绝（防模型传任意 id 越权读其它 Skill）。
 * 见 design「知识检索工具严格作用域」同款原则。
 */
export const loadSkillTool: ToolDef = {
  name: LOAD_SKILL_TOOL_NAME,
  description:
    '加载当前 Agent 已装备的某个 Skill 的完整方法说明。只能加载 Skills catalog 中列出的 skillId；用于按需获取未内联的长方法。',
  parameters: {
    type: 'object',
    properties: {
      skillId: {
        type: 'string',
        description: '要加载的 Skill id（来自 Skills catalog 条目前的 `id`）',
      },
    },
    required: ['skillId'],
  },
  async handler(args, ctx) {
    const parsed = ArgsSchema.safeParse(args)
    if (!parsed.success) {
      return { ok: false, error: `Invalid args: ${parsed.error.message}` }
    }
    const { skillId } = parsed.data

    const agent = await db.query.agents.findFirst({ where: eq(schema.agents.id, ctx.agentId) })
    const effective = await resolveEffectiveSkills({ skillIds: agent?.skillIds ?? [] })
    const skill = effective.find((row) => row.id === skillId)
    if (!skill) {
      return { ok: false, error: `Skill 未绑定到当前 Agent 或不存在/已停用，拒绝加载: ${skillId}` }
    }
    return {
      ok: true,
      value: { id: skill.id, name: skill.name, description: skill.description, instruction: skill.instruction },
    }
  },
}

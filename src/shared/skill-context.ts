import { estimateTokens } from './model-registry'

/**
 * Skill 上下文装配的纯函数（不依赖 DB，便于单测）。
 *
 * 渐进披露（2C）：始终给出 catalog（name+description）；**短 skill 内联全文**保证总是生效，
 * 长 skill 仅进 catalog——custom 可用 `load_skill` 工具按需取正文（`loadable`），
 * SDK adapter 暂不提供 load_skill 时降级为「仅 catalog 描述」。整条要么内联要么进 catalog，
 * 不截断单条、不做 summarize（见 openspec 审查修订）。
 */

export interface SkillForContext {
  id: string
  name: string
  description: string
  instruction: string
}

/** 单条 skill 内联的 token 阈值；超过的不内联、只进 catalog。 */
export const INLINE_SKILL_TOKENS = 350

/** 内联总预算随模型上下文浮动：min(3000, ctx*8%)，下限 1500；ctx 未知时取 1500。 */
export function skillInlineBudget(contextWindow: number | undefined | null): number {
  if (!contextWindow || contextWindow <= 0) return 1500
  return Math.max(1500, Math.min(3000, Math.floor(contextWindow * 0.08)))
}

export interface SkillContextSplit {
  inline: SkillForContext[]
  catalogOnly: SkillForContext[]
}

/** 按选用顺序切分：短且仍在预算内 → 内联；否则 → 仅 catalog。 */
export function splitSkillsForContext(
  skills: readonly SkillForContext[],
  totalInlineBudget: number,
): SkillContextSplit {
  const inline: SkillForContext[] = []
  const catalogOnly: SkillForContext[] = []
  let used = 0
  for (const skill of skills) {
    const cost = estimateTokens(`### ${skill.name}\n${skill.instruction}\n\n`)
    if (cost <= INLINE_SKILL_TOKENS && used + cost <= totalInlineBudget) {
      inline.push(skill)
      used += cost
    } else {
      catalogOnly.push(skill)
    }
  }
  return { inline, catalogOnly }
}

/** 渲染注入 system prompt 的 Skill 块；无 skill 返回空串。 */
export function buildSkillContext(
  skills: readonly SkillForContext[],
  opts: { totalInlineBudget: number; loadable: boolean },
): string {
  if (skills.length === 0) return ''
  const { inline, catalogOnly } = splitSkillsForContext(skills, opts.totalInlineBudget)

  const sections: string[] = ['## 专业技能 (Skills)']
  if (inline.length > 0) {
    sections.push('以下工作方法请直接遵循：')
    for (const skill of inline) {
      sections.push(`### ${skill.name}\n${skill.instruction.trim()}`)
    }
  }
  if (catalogOnly.length > 0) {
    sections.push(
      opts.loadable
        ? '以下方法可按需加载——相关时调用 load_skill(skillId) 获取完整说明：'
        : '以下方法可供参考（完整说明未内联）：',
    )
    for (const skill of catalogOnly) {
      sections.push(`- \`${skill.id}\` · ${skill.name}：${skill.description}`)
    }
  }
  return sections.join('\n\n')
}

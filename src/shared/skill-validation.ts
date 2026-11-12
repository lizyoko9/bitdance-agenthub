/**
 * Skill 输入校验的纯函数（不依赖 DB，便于单测 + 服务端/API 共用）。
 */

export const SKILL_NAME_MAX = 64
export const SKILL_DESCRIPTION_MAX = 280
export const SKILL_CATEGORY_MAX = 32
export const SKILL_INSTRUCTION_MAX = 20_000

export interface SkillDraftInput {
  name: string
  description: string
  category: string
  instruction: string
  requiredToolNames?: string[]
}

/** 校验自建/导入 skill 的字段；返回第一条错误信息，合法返回 null。 */
export function validateSkillDraft(input: SkillDraftInput): string | null {
  const name = input.name?.trim() ?? ''
  if (!name) return 'Skill 名称不能为空'
  if (name.length > SKILL_NAME_MAX) return `Skill 名称不能超过 ${SKILL_NAME_MAX} 字`

  const description = input.description?.trim() ?? ''
  if (!description) return 'Skill 描述不能为空'
  if (description.length > SKILL_DESCRIPTION_MAX)
    return `Skill 描述不能超过 ${SKILL_DESCRIPTION_MAX} 字`

  const category = input.category?.trim() ?? ''
  if (!category) return 'Skill 分类不能为空'
  if (category.length > SKILL_CATEGORY_MAX) return `Skill 分类不能超过 ${SKILL_CATEGORY_MAX} 字`

  const instruction = input.instruction?.trim() ?? ''
  if (!instruction) return 'Skill 指令正文不能为空'
  if (instruction.length > SKILL_INSTRUCTION_MAX)
    return `Skill 指令正文不能超过 ${SKILL_INSTRUCTION_MAX} 字`

  return null
}

/**
 * builtin skill 只允许改 `enabled`（启停）与 `isGlobalDefault`（是否公共），不允许改内容。
 * 返回 true 表示该 patch 触碰了 builtin 不可改的内容字段。
 */
export function isBuiltinContentEdit(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => key !== 'enabled' && key !== 'isGlobalDefault')
}

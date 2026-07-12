import { describe, expect, it } from 'vitest'

import {
  isBuiltinContentEdit,
  validateSkillDraft,
  SKILL_INSTRUCTION_MAX,
} from './skill-validation'

const valid = {
  name: '实现计划',
  description: '先定位再小步改',
  category: 'coding',
  instruction: '1. 先读 2. 小步改 3. 验证',
}

describe('validateSkillDraft', () => {
  it('accepts a well-formed draft', () => {
    expect(validateSkillDraft(valid)).toBeNull()
  })

  it('rejects empty name / description / category / instruction', () => {
    expect(validateSkillDraft({ ...valid, name: '  ' })).toMatch(/名称/)
    expect(validateSkillDraft({ ...valid, description: '' })).toMatch(/描述/)
    expect(validateSkillDraft({ ...valid, category: '' })).toMatch(/分类/)
    expect(validateSkillDraft({ ...valid, instruction: '' })).toMatch(/指令/)
  })

  it('rejects instruction over the length cap', () => {
    expect(validateSkillDraft({ ...valid, instruction: 'x'.repeat(SKILL_INSTRUCTION_MAX + 1) })).toMatch(
      /指令/,
    )
  })
})

describe('isBuiltinContentEdit', () => {
  it('allows toggling only enabled on a builtin', () => {
    expect(isBuiltinContentEdit({ enabled: false })).toBe(false)
  })

  it('flags any content field as a builtin content edit', () => {
    expect(isBuiltinContentEdit({ name: 'x' })).toBe(true)
    expect(isBuiltinContentEdit({ enabled: true, instruction: 'y' })).toBe(true)
  })
})

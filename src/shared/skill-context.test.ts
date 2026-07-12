import { describe, expect, it } from 'vitest'

import {
  buildSkillContext,
  skillInlineBudget,
  splitSkillsForContext,
  INLINE_SKILL_TOKENS,
  type SkillForContext,
} from './skill-context'

const skill = (id: string, instruction: string): SkillForContext => ({
  id,
  name: id,
  description: `${id} desc`,
  instruction,
})

describe('skillInlineBudget', () => {
  it('returns 1500 floor when context window unknown', () => {
    expect(skillInlineBudget(undefined)).toBe(1500)
    expect(skillInlineBudget(0)).toBe(1500)
  })

  it('floats with context window up to a 3000 cap and 1500 floor', () => {
    expect(skillInlineBudget(200_000)).toBe(3000) // min(3000, 16000)
    expect(skillInlineBudget(10_000)).toBe(1500) // 800 → floor 1500
  })
})

describe('splitSkillsForContext', () => {
  it('inlines short skills and pushes long ones to catalog-only', () => {
    const long = 'x'.repeat(INLINE_SKILL_TOKENS * 4 + 100) // > threshold
    const { inline, catalogOnly } = splitSkillsForContext(
      [skill('short', 'tiny method'), skill('long', long)],
      10_000,
    )
    expect(inline.map((s) => s.id)).toEqual(['short'])
    expect(catalogOnly.map((s) => s.id)).toEqual(['long'])
  })

  it('demotes short skills to catalog when total budget is exhausted', () => {
    const med = 'x'.repeat(300) // ~ within per-skill threshold
    const { inline, catalogOnly } = splitSkillsForContext(
      [skill('a', med), skill('b', med), skill('c', med)],
      90, // only room for ~1
    )
    expect(inline).toHaveLength(1)
    expect(catalogOnly).toHaveLength(2)
  })
})

describe('buildSkillContext', () => {
  it('returns empty string for no skills', () => {
    expect(buildSkillContext([], { totalInlineBudget: 1500, loadable: true })).toBe('')
  })

  it('inlines short skills under a Skills heading', () => {
    const out = buildSkillContext([skill('plan', '先定位再小步改')], {
      totalInlineBudget: 1500,
      loadable: true,
    })
    expect(out).toContain('## 专业技能 (Skills)')
    expect(out).toContain('### plan')
    expect(out).toContain('先定位再小步改')
  })

  it('mentions load_skill for catalog-only skills when loadable', () => {
    const long = 'y'.repeat(INLINE_SKILL_TOKENS * 4 + 100)
    const out = buildSkillContext([skill('big', long)], { totalInlineBudget: 1500, loadable: true })
    expect(out).toContain('load_skill')
    expect(out).toContain('`big`')
  })

  it('omits load_skill mention when not loadable (SDK degrade)', () => {
    const long = 'y'.repeat(INLINE_SKILL_TOKENS * 4 + 100)
    const out = buildSkillContext([skill('big', long)], { totalInlineBudget: 1500, loadable: false })
    expect(out).not.toContain('load_skill')
    expect(out).toContain('`big`')
  })
})

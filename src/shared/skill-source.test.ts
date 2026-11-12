import { describe, expect, it } from 'vitest'

import { githubSkillKey } from './skill-source'

describe('githubSkillKey', () => {
  const blob = 'https://github.com/owner/repo/blob/main/skills/review/SKILL.md'

  it('recognizes the same skill in raw, blob, and tree links', () => {
    const expected = githubSkillKey(blob)
    expect(githubSkillKey('https://raw.githubusercontent.com/owner/repo/main/skills/review/SKILL.md')).toBe(expected)
    expect(githubSkillKey('https://github.com/owner/repo/tree/main/skills/review/')).toBe(expected)
    expect(githubSkillKey(`${blob}?raw=true#instructions`)).toBe(expected)
  })

  it('recognizes root-level skills and case-insensitive repository names', () => {
    expect(githubSkillKey('https://github.com/OWNER/Repo/tree/main')).toBe(
      githubSkillKey('https://raw.githubusercontent.com/owner/repo/main/SKILL.md'),
    )
  })

  it.each([
    'https://github.com/another/repo/blob/main/skills/review/SKILL.md',
    'https://github.com/owner/another/blob/main/skills/review/SKILL.md',
    'https://github.com/owner/repo/blob/develop/skills/review/SKILL.md',
    'https://github.com/owner/repo/blob/main/other/review/SKILL.md',
    'https://github.com/owner/repo/blob/Main/skills/review/SKILL.md',
    'https://github.com/owner/repo/blob/main/skills/Review/SKILL.md',
  ])('keeps a distinct resource installable: %s', (other) => {
    expect(githubSkillKey(other)).not.toBe(githubSkillKey(blob))
  })

  it('normalizes URL-encoded ref and path segments consistently', () => {
    expect(githubSkillKey('https://github.com/owner/repo/tree/feat%2Freview/my%20skills/review')).toBe(
      githubSkillKey('https://raw.githubusercontent.com/owner/repo/feat%2Freview/my%20skills/review/SKILL.md'),
    )
  })

  it('keeps unsupported or malformed URLs distinct instead of collapsing their last directory', () => {
    expect(githubSkillKey('https://example.com/owner/repo/main/skills/review/SKILL.md')).not.toBe(githubSkillKey(blob))
    expect(githubSkillKey('not a url')).toBe('not a url')
    expect(githubSkillKey('https://github.com/owner/repo')).not.toBe(githubSkillKey(blob))
  })
})

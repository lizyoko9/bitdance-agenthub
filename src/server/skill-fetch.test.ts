import { describe, expect, it } from 'vitest'

import {
  isAllowedContentType,
  isAllowedSkillHost,
  isBlockedAddress,
  isFetchableSkillUrl,
  parseRepoTreeForSkills,
  planGitHubSkillUrl,
} from './skill-fetch'

describe('isAllowedSkillHost', () => {
  it('allows GitHub hosts only', () => {
    expect(isAllowedSkillHost('raw.githubusercontent.com')).toBe(true)
    expect(isAllowedSkillHost('github.com')).toBe(true)
    expect(isAllowedSkillHost('api.github.com')).toBe(true)
    expect(isAllowedSkillHost('evil.com')).toBe(false)
    expect(isAllowedSkillHost('raw.githubusercontent.com.evil.com')).toBe(false)
  })
})

describe('isFetchableSkillUrl', () => {
  it('requires https + allowlisted host', () => {
    expect(isFetchableSkillUrl('https://raw.githubusercontent.com/a/b/main/SKILL.md')).toBe(true)
    expect(isFetchableSkillUrl('http://raw.githubusercontent.com/a/b/main/SKILL.md')).toBe(false)
    expect(isFetchableSkillUrl('https://evil.com/SKILL.md')).toBe(false)
    expect(isFetchableSkillUrl('file:///etc/passwd')).toBe(false)
    expect(isFetchableSkillUrl('not a url')).toBe(false)
  })
})

describe('isAllowedContentType', () => {
  it('allows text/json, rejects html/binary, allows missing', () => {
    expect(isAllowedContentType('text/plain; charset=utf-8')).toBe(true)
    expect(isAllowedContentType('text/markdown')).toBe(true)
    expect(isAllowedContentType('application/json')).toBe(true)
    expect(isAllowedContentType(null)).toBe(true)
    expect(isAllowedContentType('text/html')).toBe(false)
    expect(isAllowedContentType('image/png')).toBe(false)
  })
})

describe('isBlockedAddress (SSRF IP guard)', () => {
  it('blocks loopback / private / link-local / metadata', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(true)
    }
  })
  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '140.82.112.3', '1.1.1.1']) {
      expect(isBlockedAddress(ip), ip).toBe(false)
    }
  })
  it('handles IPv6 loopback / link-local / unique-local / mapped', () => {
    expect(isBlockedAddress('::1')).toBe(true)
    expect(isBlockedAddress('fe80::1')).toBe(true)
    expect(isBlockedAddress('fc00::1')).toBe(true)
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false)
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false)
  })
  it('blocks malformed addresses', () => {
    expect(isBlockedAddress('')).toBe(true)
    expect(isBlockedAddress('999.1.1.1')).toBe(true)
    expect(isBlockedAddress('garbage')).toBe(true)
  })
})

describe('planGitHubSkillUrl', () => {
  it('rejects non-https, non-GitHub, invalid', () => {
    expect(planGitHubSkillUrl('http://github.com/a/b').kind).toBe('reject')
    expect(planGitHubSkillUrl('https://evil.com/a/SKILL.md').kind).toBe('reject')
    expect(planGitHubSkillUrl('nonsense').kind).toBe('reject')
  })

  it('accepts raw .md directly', () => {
    const p = planGitHubSkillUrl('https://raw.githubusercontent.com/o/r/main/skills/x/SKILL.md')
    expect(p).toEqual({ kind: 'raw', url: 'https://raw.githubusercontent.com/o/r/main/skills/x/SKILL.md' })
  })

  it('rejects raw that is not .md', () => {
    expect(planGitHubSkillUrl('https://raw.githubusercontent.com/o/r/main/README').kind).toBe('reject')
  })

  it('normalizes blob → raw', () => {
    const p = planGitHubSkillUrl('https://github.com/o/r/blob/main/skills/x/SKILL.md')
    expect(p).toEqual({ kind: 'raw', url: 'https://raw.githubusercontent.com/o/r/main/skills/x/SKILL.md' })
  })

  it('normalizes tree dir → <dir>/SKILL.md raw', () => {
    const p = planGitHubSkillUrl('https://github.com/o/r/tree/main/skills/pdf')
    expect(p).toEqual({ kind: 'raw', url: 'https://raw.githubusercontent.com/o/r/main/skills/pdf/SKILL.md' })
  })

  it('treats bare repo as enumerate', () => {
    expect(planGitHubSkillUrl('https://github.com/o/r')).toEqual({ kind: 'enumerate', owner: 'o', repo: 'r' })
  })
})

describe('parseRepoTreeForSkills', () => {
  it('extracts SKILL.md blobs and builds install urls', () => {
    const json = {
      tree: [
        { path: 'README.md', type: 'blob' },
        { path: 'skills/pdf/SKILL.md', type: 'blob' },
        { path: 'skills/docx/SKILL.md', type: 'blob' },
        { path: 'skills/sub', type: 'tree' },
        { path: 'SKILL.md', type: 'blob' },
      ],
    }
    const got = parseRepoTreeForSkills(json, 'o', 'r', 'main')
    expect(got.map((c) => c.path)).toEqual(['skills/pdf/SKILL.md', 'skills/docx/SKILL.md', 'SKILL.md'])
    expect(got[0]).toMatchObject({ dir: 'skills/pdf', installUrl: 'https://github.com/o/r/blob/main/skills/pdf/SKILL.md' })
    expect(got[2].dir).toBe('')
  })

  it('returns [] for malformed tree', () => {
    expect(parseRepoTreeForSkills({}, 'o', 'r', 'main')).toEqual([])
    expect(parseRepoTreeForSkills(null, 'o', 'r', 'main')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildSkillMarkdown,
  parseSkillMarkdown,
  parseSkillsJson,
  skillMarkdownToDraft,
} from './skill-import'

describe('parseSkillMarkdown', () => {
  it('reads name/description from frontmatter and body as instruction', () => {
    const md = `---
name: PDF Filler
description: Fill PDF forms from structured data
allowed-tools: Read, Bash, Write
license: MIT
---
# How to fill PDFs

Use the bundled script to map fields.`
    const r = parseSkillMarkdown(md)
    expect(r.name).toBe('PDF Filler')
    expect(r.description).toBe('Fill PDF forms from structured data')
    expect(r.instruction).toContain('How to fill PDFs')
    expect(r.instruction).toContain('bundled script')
  })

  it('drops allowed-tools (and any other frontmatter) — no permission leakage', () => {
    const md = `---
name: x
description: y
allowed-tools:
  - Bash
  - Write
---
body`
    const r = parseSkillMarkdown(md)
    expect(r.instruction).toBe('body')
    // instruction/name/description must not carry allowed-tools content
    expect(JSON.stringify(r)).not.toContain('allowed-tools')
    expect(r.instruction).not.toContain('Bash')
  })

  it('falls back to first heading / paragraph when no frontmatter', () => {
    const md = `# Code Review Method

Find real risks, ordered by severity.`
    const r = parseSkillMarkdown(md)
    expect(r.name).toBe('Code Review Method')
    expect(r.description).toBe('Find real risks, ordered by severity.')
    expect(r.instruction).toContain('# Code Review Method')
  })

  it('uses whole text as instruction when plain text has no structure', () => {
    const r = parseSkillMarkdown('just a flat instruction line')
    expect(r.instruction).toBe('just a flat instruction line')
  })

  it('skillMarkdownToDraft sets a default category and empty tools', () => {
    const d = skillMarkdownToDraft('---\nname: a\ndescription: b\n---\nbody')
    expect(d.category).toBe('imported')
    expect(d.requiredToolNames).toEqual([])
  })
})

describe('parseSkillsJson', () => {
  it('parses a single object', () => {
    const d = parseSkillsJson('{"name":"a","description":"b","instruction":"c"}')
    expect(d).toHaveLength(1)
    expect(d[0].name).toBe('a')
    expect(d[0].category).toBe('imported')
  })

  it('parses an array (batch) and keeps only known fields', () => {
    const d = parseSkillsJson(
      '[{"name":"a","description":"b","instruction":"c","category":"x","allowedTools":["Bash"]},{"name":"d","description":"e","instruction":"f"}]',
    )
    expect(d).toHaveLength(2)
    expect(d[0].category).toBe('x')
    expect(JSON.stringify(d[0])).not.toContain('Bash')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseSkillsJson('not json')).toThrow()
  })
})

describe('buildSkillMarkdown', () => {
  it('round-trips with parseSkillMarkdown', () => {
    const skill = { name: 'Impl Plan', description: 'small steps', instruction: '1. read\n2. change\n3. verify' }
    const md = buildSkillMarkdown(skill)
    const parsed = parseSkillMarkdown(md)
    expect(parsed.name).toBe(skill.name)
    expect(parsed.description).toBe(skill.description)
    expect(parsed.instruction).toBe(skill.instruction)
  })

  it('quotes YAML-special values so frontmatter stays valid', () => {
    const md = buildSkillMarkdown({ name: 'A: B #c', description: 'has: colon', instruction: 'body' })
    const parsed = parseSkillMarkdown(md)
    expect(parsed.name).toBe('A: B #c')
    expect(parsed.description).toBe('has: colon')
  })
})


import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { materializeClaudeSkills } from './claude-skill-files'

const skill = (name: string, instruction = `Instructions for ${name}`) => ({
  name,
  description: `${name} description`,
  instruction,
})

describe('Claude skill files', () => {
  let root: string
  let cwd: string
  let skillsPath: string

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'agenthub-claude-skills-')))
    cwd = path.join(root, 'workspace')
    skillsPath = path.join(cwd, '.claude', 'skills')
    mkdirSync(cwd)
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const linkDirectory = (target: string, link: string) =>
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')

  it('isolates concurrent runs and preserves pre-existing skill directories', () => {
    const existing = path.join(skillsPath, 'agenthub-0-skill')
    mkdirSync(existing, { recursive: true })
    writeFileSync(path.join(existing, 'SKILL.md'), 'User skill')

    const a = materializeClaudeSkills(cwd, [skill('实现计划')])
    const aDir = readdirSync(skillsPath).find((name) => name !== 'agenthub-0-skill')!
    const b = materializeClaudeSkills(cwd, [skill('审查准则')])
    const bDir = readdirSync(skillsPath).find((name) => name !== aDir && name !== 'agenthub-0-skill')!

    expect(a.names).toEqual([aDir])
    expect(b.names).toEqual([bDir])
    expect(bDir).not.toBe(aDir)
    expect(readFileSync(path.join(skillsPath, aDir, 'SKILL.md'), 'utf8')).toContain('实现计划')
    expect(readFileSync(path.join(skillsPath, bDir, 'SKILL.md'), 'utf8')).toContain('审查准则')
    a.cleanup()
    expect(existsSync(path.join(skillsPath, aDir))).toBe(false)
    expect(readFileSync(path.join(skillsPath, bDir, 'SKILL.md'), 'utf8')).toContain('审查准则')
    b.cleanup()
    b.cleanup()
    expect(readdirSync(skillsPath)).toEqual(['agenthub-0-skill'])
    expect(readFileSync(path.join(existing, 'SKILL.md'), 'utf8')).toBe('User skill')
  })

  it('uses distinct SDK skill names for concurrent runs with the same display name', () => {
    const a = materializeClaudeSkills(cwd, [skill('review', 'Run A instructions')])
    const b = materializeClaudeSkills(cwd, [skill('review', 'Run B instructions')])

    expect(a.names[0]).not.toBe(b.names[0])
    for (const [materialized, instruction] of [[a, 'Run A instructions'], [b, 'Run B instructions']] as const) {
      const content = readFileSync(path.join(skillsPath, materialized.names[0], 'SKILL.md'), 'utf8')
      expect(content).toContain(`name: ${materialized.names[0]}\n`)
      expect(content).toContain('review: review description')
      expect(content).toContain(instruction)
    }
    a.cleanup()
    expect(readFileSync(path.join(skillsPath, b.names[0], 'SKILL.md'), 'utf8')).toContain('Run B instructions')
    b.cleanup()
  })

  it.each(['.claude', 'skills'])('rejects a symlink at %s before writing outside the workspace', (segment) => {
    const outside = path.join(root, 'outside')
    mkdirSync(outside)
    const parent = segment === '.claude' ? cwd : path.join(cwd, '.claude')
    mkdirSync(parent, { recursive: true })
    linkDirectory(outside, path.join(parent, segment))

    expect(() => materializeClaudeSkills(cwd, [skill('review')])).toThrow('must not be a symlink')
    expect(readdirSync(outside)).toEqual([])
  })

  it('does not follow a skill directory replaced by a symlink during a run', () => {
    const materialized = materializeClaudeSkills(cwd, [skill('review')])
    const directory = path.join(skillsPath, readdirSync(skillsPath)[0])
    const moved = `${directory}-moved`
    const outside = path.join(root, 'outside')
    mkdirSync(outside)
    writeFileSync(path.join(outside, 'SKILL.md'), 'External skill')
    renameSync(directory, moved)
    linkDirectory(outside, directory)

    materialized.cleanup()
    expect(lstatSync(directory).isSymbolicLink()).toBe(true)
    expect(readFileSync(path.join(outside, 'SKILL.md'), 'utf8')).toBe('External skill')
    expect(existsSync(path.join(moved, 'SKILL.md'))).toBe(true)
  })

  it('does not traverse a parent directory replaced by a symlink during a run', () => {
    const materialized = materializeClaudeSkills(cwd, [skill('review')])
    const directoryName = readdirSync(skillsPath)[0]
    const outside = path.join(root, 'outside')
    mkdirSync(path.join(outside, directoryName), { recursive: true })
    writeFileSync(path.join(outside, directoryName, 'SKILL.md'), 'External skill')
    renameSync(skillsPath, `${skillsPath}-moved`)
    linkDirectory(outside, skillsPath)

    materialized.cleanup()
    expect(readFileSync(path.join(outside, directoryName, 'SKILL.md'), 'utf8')).toBe('External skill')
  })

  it.runIf(process.platform !== 'win32')('preserves a replacement file symlink', () => {
    const materialized = materializeClaudeSkills(cwd, [skill('review')])
    const file = path.join(skillsPath, readdirSync(skillsPath)[0], 'SKILL.md')
    const outside = path.join(root, 'outside.txt')
    writeFileSync(outside, 'External file')
    unlinkSync(file)
    symlinkSync(outside, file)

    materialized.cleanup()
    expect(lstatSync(file).isSymbolicLink()).toBe(true)
    expect(readFileSync(outside, 'utf8')).toBe('External file')
  })

  it('preserves files added to a temporary skill directory during a run', () => {
    const materialized = materializeClaudeSkills(cwd, [skill('review')])
    const directory = path.join(skillsPath, readdirSync(skillsPath)[0])
    const added = path.join(directory, 'user-notes.txt')
    writeFileSync(added, 'User notes')

    materialized.cleanup()
    expect(existsSync(path.join(directory, 'SKILL.md'))).toBe(false)
    expect(readFileSync(added, 'utf8')).toBe('User notes')
  })

  it('preserves a skill file edited during the run', () => {
    const materialized = materializeClaudeSkills(cwd, [skill('review')])
    const file = path.join(skillsPath, readdirSync(skillsPath)[0], 'SKILL.md')
    writeFileSync(file, 'User edits')

    materialized.cleanup()
    expect(readFileSync(file, 'utf8')).toBe('User edits')
  })

  it('rolls back earlier materialization if a later skill fails', () => {
    const broken = {
      ...skill('broken'),
      get instruction(): string {
        throw new Error('Invalid skill data')
      },
    }

    expect(() => materializeClaudeSkills(cwd, [skill('review'), broken])).toThrow('Invalid skill data')
    expect(readdirSync(cwd)).toEqual([])
  })
})

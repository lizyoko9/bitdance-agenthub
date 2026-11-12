import { randomUUID } from 'node:crypto'
import {
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { buildSkillMarkdown } from '@/shared/skill-import'

interface OwnedPath {
  path: string
  dev: number
  ino: number
  birthtimeMs: number
  directory: boolean
}

interface SkillFiles {
  directory: OwnedPath
  file?: OwnedPath
  content?: string
}

export interface MaterializedClaudeSkills {
  names: string[]
  cleanup(): void
}

function rememberPath(target: string, stat = lstatSync(target)): OwnedPath {
  return {
    path: target,
    dev: stat.dev,
    ino: stat.ino,
    birthtimeMs: stat.birthtimeMs,
    directory: stat.isDirectory(),
  }
}

function stillOwned(entry: OwnedPath): boolean {
  try {
    const stat = lstatSync(entry.path)
    return (
      stat.dev === entry.dev &&
      stat.ino === entry.ino &&
      stat.birthtimeMs === entry.birthtimeMs &&
      (entry.directory ? stat.isDirectory() : stat.isFile())
    )
  } catch {
    return false
  }
}

export function materializeClaudeSkills(
  cwd: string,
  skills: { name: string; description: string; instruction: string }[],
): MaterializedClaudeSkills {
  const root = realpathSync(cwd)
  const parents: OwnedPath[] = [rememberPath(root)]
  const createdParents: OwnedPath[] = []
  const files: SkillFiles[] = []
  const names: string[] = []
  const runToken = randomUUID()
  const parentsUnchanged = () => parents.every(stillOwned)

  const cleanup = () => {
    if (!parentsUnchanged()) return
    for (const entry of files.toReversed()) {
      try {
        if (!parentsUnchanged() || !stillOwned(entry.directory)) continue
        if (
          entry.file &&
          stillOwned(entry.file) &&
          (entry.content === undefined || readFileSync(entry.file.path, 'utf8') === entry.content)
        ) {
          unlinkSync(entry.file.path)
        }
        // rmdir preserves any files added by the user or SDK while the run was active.
        if (parentsUnchanged() && stillOwned(entry.directory)) rmdirSync(entry.directory.path)
      } catch {
        // Changed or nonempty directories belong to the caller to inspect, not recursive cleanup.
      }
    }
    for (const entry of createdParents.toReversed()) {
      try {
        if (parents.slice(0, parents.indexOf(entry) + 1).every(stillOwned)) rmdirSync(entry.path)
      } catch {
        // Another run may still be using these shared parent directories.
      }
    }
  }

  try {
    if (skills.length === 0) return { names: [], cleanup }
    let parent = root
    for (const segment of ['.claude', 'skills']) {
      if (!parentsUnchanged()) throw new Error('Claude skill parent directory changed during setup')
      parent = path.join(parent, segment)
      let created = false
      try {
        mkdirSync(parent)
        created = true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
      const stat = lstatSync(parent)
      if (!stat.isDirectory()) {
        throw new Error(`Claude skill directory must not be a symlink or file: ${parent}`)
      }
      const entry = rememberPath(parent, stat)
      parents.push(entry)
      if (created) createdParents.push(entry)
    }

    for (const [index, skill] of skills.entries()) {
      const name = `agenthub-${runToken}-${index}`
      const content = buildSkillMarkdown({
        ...skill,
        name,
        description: `${skill.name}: ${skill.description}`,
      })
      if (!parentsUnchanged()) throw new Error('Claude skill parent directory changed during setup')
      const directoryPath = path.join(parent, name)
      mkdirSync(directoryPath)
      const directory = rememberPath(directoryPath)
      const entry: SkillFiles = { directory }
      files.push(entry)
      if (!parentsUnchanged() || !stillOwned(directory)) {
        throw new Error('Claude skill directory changed during setup')
      }
      const filePath = path.join(directory.path, 'SKILL.md')
      const fd = openSync(filePath, 'wx', 0o600)
      try {
        entry.file = rememberPath(filePath, fstatSync(fd))
        writeFileSync(fd, content, 'utf8')
        entry.content = content
      } finally {
        closeSync(fd)
      }
      names.push(name)
    }
    return { names, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}

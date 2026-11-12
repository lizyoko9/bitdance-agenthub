import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { bootstrapDatabase } from './bootstrap'
import { BUILTIN_SKILLS } from './builtin-skills'

describe('bootstrapDatabase — skills migration (Phase 2)', () => {
  it('creates the skills table and seeds built-in skills', () => {
    const sqlite = new Database(':memory:')
    bootstrapDatabase(sqlite)

    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM skills WHERE is_builtin = 1').get() as {
      n: number
    }
    expect(count.n).toBe(BUILTIN_SKILLS.length)
    sqlite.close()
  })

  it('adds agents.skill_ids column defaulting to empty array', () => {
    const sqlite = new Database(':memory:')
    bootstrapDatabase(sqlite)

    const cols = sqlite.prepare('PRAGMA table_info(agents)').all() as { name: string }[]
    expect(cols.some((c) => c.name === 'skill_ids')).toBe(true)

    // 内置 agent 在没有显式 skill_ids 时落到默认 '[]'
    const row = sqlite
      .prepare('SELECT skill_ids FROM agents WHERE is_builtin = 1 LIMIT 1')
      .get() as { skill_ids: string } | undefined
    if (row) expect(row.skill_ids).toBe('[]')
    sqlite.close()
  })

  it('adds skills.is_global_default column defaulting to 0 (opt-in)', () => {
    const sqlite = new Database(':memory:')
    bootstrapDatabase(sqlite)

    const cols = sqlite.prepare('PRAGMA table_info(skills)').all() as { name: string }[]
    expect(cols.some((c) => c.name === 'is_global_default')).toBe(true)

    // builtin seed 默认 opt-in（非公共），不改变既有 agent 行为
    const row = sqlite
      .prepare('SELECT is_global_default FROM skills WHERE is_builtin = 1 LIMIT 1')
      .get() as { is_global_default: number } | undefined
    if (row) expect(row.is_global_default).toBe(0)
    sqlite.close()
  })

  it('backfills is_global_default=0 for pre-existing skills missing the column', () => {
    const sqlite = new Database(':memory:')
    // 模拟 2D 之前 schema：skills 表无 is_global_default 列。
    sqlite.exec(`CREATE TABLE skills (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, instruction TEXT NOT NULL,
      required_tool_names TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'user', source_uri TEXT,
      is_builtin INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL DEFAULT 0
    )`)
    sqlite
      .prepare(
        "INSERT INTO skills (id, name, description, category, instruction, created_at) VALUES ('skill_y','y','y','c','i',1)",
      )
      .run()

    bootstrapDatabase(sqlite)

    const row = sqlite.prepare("SELECT is_global_default FROM skills WHERE id = 'skill_y'").get() as {
      is_global_default: number
    }
    expect(row.is_global_default).toBe(0)
    sqlite.close()
  })

  it('is idempotent: running twice does not duplicate skills', () => {
    const sqlite = new Database(':memory:')
    bootstrapDatabase(sqlite)
    bootstrapDatabase(sqlite)

    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM skills').get() as { n: number }
    expect(count.n).toBe(BUILTIN_SKILLS.length)
    sqlite.close()
  })

  it('seeds builtin skills with source=builtin and updated_at', () => {
    const sqlite = new Database(':memory:')
    bootstrapDatabase(sqlite)
    const row = sqlite
      .prepare("SELECT source, updated_at FROM skills WHERE is_builtin = 1 LIMIT 1")
      .get() as { source: string; updated_at: number }
    expect(row.source).toBe('builtin')
    expect(row.updated_at).toBeGreaterThan(0)
    sqlite.close()
  })

  it('backfills source=builtin for pre-existing builtin rows missing the column', () => {
    const sqlite = new Database(':memory:')
    // 模拟 Phase 2 早期 schema：skills 表无 source / updated_at 列。
    sqlite.exec(`CREATE TABLE skills (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, instruction TEXT NOT NULL,
      required_tool_names TEXT NOT NULL DEFAULT '[]',
      is_builtin INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`)
    sqlite
      .prepare(
        "INSERT INTO skills (id, name, description, category, instruction, is_builtin, enabled, created_at) VALUES ('skill_x','x','x','c','i',1,1,1)",
      )
      .run()

    bootstrapDatabase(sqlite)

    const row = sqlite.prepare("SELECT source FROM skills WHERE id = 'skill_x'").get() as {
      source: string
    }
    expect(row.source).toBe('builtin')
    sqlite.close()
  })
})

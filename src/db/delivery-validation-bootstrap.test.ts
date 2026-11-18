import Database from 'better-sqlite3'
import { expect, it } from 'vitest'

import { bootstrapDatabase } from './bootstrap'

it('adds delivery validation tables to a previously bootstrapped local database without changing existing history', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    bootstrapDatabase(sqlite)
    sqlite.exec(`
      DROP TABLE delivery_validation_receipts;
      DROP TABLE delivery_validation_revisions;
      INSERT INTO conversations (id, title, mode, agent_ids, created_at, updated_at)
      VALUES ('existing-conv', 'Existing task', 'single', '[]', 1, 1);
      INSERT INTO messages (id, conversation_id, role, parts, status, created_at)
      VALUES ('existing-message', 'existing-conv', 'user', '[{"type":"text","content":"Keep me"}]', 'complete', 1);
    `)
    const original = sqlite.prepare('SELECT * FROM messages').all()
    bootstrapDatabase(sqlite)
    bootstrapDatabase(sqlite)
    expect(sqlite.prepare('SELECT * FROM messages').all()).toEqual(original)
    expect(sqlite.prepare('SELECT * FROM delivery_validation_revisions').all()).toEqual([])
    expect(sqlite.prepare('SELECT * FROM delivery_validation_receipts').all()).toEqual([])
  } finally {
    sqlite.close()
  }
})

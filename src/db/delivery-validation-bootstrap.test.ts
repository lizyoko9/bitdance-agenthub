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

it('adds nullable formal delivery bindings and run verdicts without rewriting earlier messages', () => {
  const sqlite = new Database(':memory:')
  try {
    bootstrapDatabase(sqlite)
    sqlite.exec(`
      ALTER TABLE messages DROP COLUMN delivery_validation_revision_id;
      ALTER TABLE agent_runs DROP COLUMN delivery_acceptance;
      INSERT INTO conversations (id, title, mode, agent_ids, created_at, updated_at)
      VALUES ('before-gate', 'Existing task', 'single', '[]', 1, 1);
      INSERT INTO messages (id, conversation_id, role, parts, status, created_at)
      VALUES ('before-gate-message', 'before-gate', 'user', '[{"type":"text","content":"Keep me"}]', 'complete', 1);
      INSERT INTO agent_runs (id, conversation_id, agent_id, trigger_message_id, status, started_at)
      SELECT 'before-gate-run', 'before-gate', id, 'before-gate-message', 'complete', 1 FROM agents LIMIT 1;
    `)
    bootstrapDatabase(sqlite)
    bootstrapDatabase(sqlite)
    expect(sqlite.prepare("SELECT parts, delivery_validation_revision_id FROM messages WHERE id = 'before-gate-message'").get())
      .toEqual({ parts: '[{"type":"text","content":"Keep me"}]', delivery_validation_revision_id: null })
    expect(sqlite.prepare("SELECT status, delivery_acceptance FROM agent_runs WHERE id = 'before-gate-run'").get())
      .toEqual({ status: 'complete', delivery_acceptance: null })
  } finally {
    sqlite.close()
  }
})

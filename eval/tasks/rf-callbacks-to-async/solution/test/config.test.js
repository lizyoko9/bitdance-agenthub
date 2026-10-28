import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { DEFAULTS, loadConfig, saveConfig } from '../src/config.js'

const tmpFile = () => join(mkdtempSync(join(tmpdir(), 'eval-cfg-')), 'config.json')

test('missing file returns defaults', async () => {
  assert.deepEqual(await loadConfig(tmpFile()), DEFAULTS)
})

test('save merges and persists', async () => {
  const file = tmpFile()
  const saved = await saveConfig(file, { theme: 'dark' })
  assert.deepEqual(saved, { theme: 'dark', retries: 3 })
  assert.deepEqual(await loadConfig(file), saved)
})

import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { DEFAULTS, loadConfig, saveConfig } from '../src/config.js'

const tmpFile = () => join(mkdtempSync(join(tmpdir(), 'eval-cfg-')), 'config.json')

test('missing file returns defaults', (_, done) => {
  loadConfig(tmpFile(), (err, cfg) => {
    assert.equal(err, null)
    assert.deepEqual(cfg, DEFAULTS)
    done()
  })
})

test('save merges and persists', (_, done) => {
  const file = tmpFile()
  saveConfig(file, { theme: 'dark' }, (err, saved) => {
    assert.equal(err, null)
    assert.deepEqual(saved, { theme: 'dark', retries: 3 })
    loadConfig(file, (loadErr, cfg) => {
      assert.equal(loadErr, null)
      assert.deepEqual(cfg, saved)
      done()
    })
  })
})

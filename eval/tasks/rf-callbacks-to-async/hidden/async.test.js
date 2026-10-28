import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { DEFAULTS, loadConfig, saveConfig } from '../src/config.js'
import { readJson, writeJson } from '../src/json-file.js'

const tmpDir = () => mkdtempSync(join(tmpdir(), 'eval-async-'))

test('readJson/writeJson return promises', async () => {
  const file = join(tmpDir(), 'a.json')
  const written = writeJson(file, { a: 1 })
  assert.ok(written instanceof Promise)
  await written
  assert.equal(readFileSync(file, 'utf8'), '{\n  "a": 1\n}\n')
  assert.deepEqual(await readJson(file), { a: 1 })
})

test('readJson rejects with ENOENT and with path on bad JSON', async () => {
  const dir = tmpDir()
  await assert.rejects(readJson(join(dir, 'missing.json')), (err) => err.code === 'ENOENT')
  const bad = join(dir, 'bad.json')
  writeFileSync(bad, '{nope')
  await assert.rejects(readJson(bad), (err) => err.message.includes(bad))
})

test('writeJson leaves no temp files behind', async () => {
  const dir = tmpDir()
  await writeJson(join(dir, 'c.json'), { ok: true })
  assert.deepEqual(readdirSync(dir), ['c.json'])
})

test('loadConfig / saveConfig are async', async () => {
  const file = join(tmpDir(), 'config.json')
  assert.deepEqual(await loadConfig(file), DEFAULTS)
  const saved = await saveConfig(file, { retries: 5 })
  assert.deepEqual(saved, { theme: 'light', retries: 5 })
  assert.deepEqual(await loadConfig(file), saved)
  const defaults = await loadConfig(join(tmpDir(), 'x.json'))
  defaults.theme = 'mutated'
  assert.equal(DEFAULTS.theme, 'light')
})

test('json-file no longer accepts callbacks', () => {
  const source = readFileSync('src/json-file.js', 'utf8')
  assert.match(source, /node:fs\/promises/)
  assert.doesNotMatch(source, /\bcb\b|callback/)
})

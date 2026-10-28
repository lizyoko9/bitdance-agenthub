import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createKv } from '../src/kv.js'
import { load, save } from '../src/persist.js'

function clock(start = 1000) {
  let t = start
  const now = () => t
  now.advance = (ms) => {
    t += ms
  }
  return now
}

test('ttl hides expired keys', () => {
  const now = clock()
  const kv = createKv({ now })
  kv.set('a', 1, { ttlMs: 100 })
  kv.set('b', 2)
  now.advance(99)
  assert.equal(kv.get('a'), 1)
  now.advance(1)
  assert.equal(kv.get('a'), undefined)
  assert.equal(kv.has('a'), false)
  assert.deepEqual(kv.keys(), ['b'])
  assert.deepEqual(kv.entries(), [{ key: 'b', value: 2, expiresAt: null }])
})

test('invalid ttl throws RangeError', () => {
  const kv = createKv()
  for (const ttlMs of [0, -1, 1.5, '10']) {
    assert.throws(() => kv.set('a', 1, { ttlMs }), RangeError)
  }
})

test('overwriting a key resets ttl', () => {
  const now = clock()
  const kv = createKv({ now })
  kv.set('a', 1, { ttlMs: 10 })
  kv.set('a', 2)
  now.advance(50)
  assert.equal(kv.get('a'), 2)
})

test('save/load keeps absolute expiry', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'eval-kv-')), 'kv.json')
  const now = clock()
  const kv = createKv({ now })
  kv.set('keep', 'x', { ttlMs: 1000 })
  kv.set('soon', 'y', { ttlMs: 10 })
  kv.set('forever', { n: 1 })
  save(kv, file)
  now.advance(500)
  const restored = load(file, { now })
  assert.deepEqual(restored.keys().sort(), ['forever', 'keep'])
  assert.deepEqual(restored.entries().find((e) => e.key === 'keep'), { key: 'keep', value: 'x', expiresAt: 2000 })
  now.advance(600)
  assert.equal(restored.get('keep'), undefined)
  assert.deepEqual(restored.get('forever'), { n: 1 })
})

test('load missing file gives empty kv', () => {
  const kv = load(join(mkdtempSync(join(tmpdir(), 'eval-kv-')), 'none.json'))
  assert.deepEqual(kv.keys(), [])
})

test('cli set/get/dump', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'eval-kv-')), 'kv.json')
  const cli = (...args) => spawnSync(process.execPath, ['src/cli.js', file, ...args], { encoding: 'utf8' })
  assert.equal(cli('set', 'name', 'ada').status, 0)
  assert.equal(cli('set', 'tmp', 'x', '--ttl', '60000').status, 0)
  assert.equal(cli('get', 'name').stdout.trim(), 'ada')
  assert.equal(cli('get', 'missing').status, 2)
  const dump = JSON.parse(execFileSync(process.execPath, ['src/cli.js', file, 'dump'], { encoding: 'utf8' }))
  assert.deepEqual(dump.map((e) => e.key).sort(), ['name', 'tmp'])
  assert.equal(typeof dump.find((e) => e.key === 'tmp').expiresAt, 'number')
})

test('cli ignores expired entries in file', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'eval-kv-')), 'kv.json')
  writeFileSync(file, JSON.stringify([{ key: 'old', value: 'v', expiresAt: 1 }]))
  assert.equal(spawnSync(process.execPath, ['src/cli.js', file, 'get', 'old']).status, 2)
})

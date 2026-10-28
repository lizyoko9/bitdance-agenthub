import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { groupBy } from '../src/aggregate.js'
import { parseCsv } from '../src/parse.js'

const CSV = 'region,city,amount\nnorth,"Oslo, NO",10\nsouth,Rome,5\nnorth,"The ""Big"" One",2.5\nsouth,Nice,4\n\n'

test('parses quoted fields and ignores trailing blank lines', () => {
  const rows = parseCsv(CSV)
  assert.equal(rows.length, 4)
  assert.equal(rows[0].city, 'Oslo, NO')
  assert.equal(rows[2].city, 'The "Big" One')
  assert.equal(rows[2].amount, '2.5')
})

test('groupBy sorts keys and computes stats', () => {
  assert.deepEqual(groupBy(parseCsv(CSV), 'region', 'amount'), [
    { key: 'north', count: 2, sum: 12.5, avg: 6.25 },
    { key: 'south', count: 2, sum: 9, avg: 4.5 },
  ])
})

test('avg rounds to two decimals', () => {
  const rows = [{ k: 'a', v: '1' }, { k: 'a', v: '1' }, { k: 'a', v: '2' }]
  assert.equal(groupBy(rows, 'k', 'v')[0].avg, 1.33)
})

function writeCsv() {
  const dir = mkdtempSync(join(tmpdir(), 'eval-csv-'))
  const file = join(dir, 'data.csv')
  writeFileSync(file, CSV)
  return file
}

test('cli --group-by', () => {
  const out = execFileSync(process.execPath, ['src/cli.js', writeCsv(), '--group-by', 'region', '--value', 'amount'], { encoding: 'utf8' })
  assert.deepEqual(JSON.parse(out), groupBy(parseCsv(CSV), 'region', 'amount'))
})

test('cli keeps row count without --group-by', () => {
  const out = execFileSync(process.execPath, ['src/cli.js', writeCsv()], { encoding: 'utf8' })
  assert.deepEqual(JSON.parse(out), { rows: 4 })
})

test('cli fails on unknown column', () => {
  const res = spawnSync(process.execPath, ['src/cli.js', writeCsv(), '--group-by', 'nope', '--value', 'amount'], { encoding: 'utf8' })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /nope/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { daysInRange } from '../src/range.js'

test('includes both ends', () => {
  assert.deepEqual(daysInRange('2024-01-30', '2024-02-02'), ['2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02'])
})

test('single day', () => {
  assert.deepEqual(daysInRange('2024-03-10', '2024-03-10'), ['2024-03-10'])
})

test('end before start is empty', () => {
  assert.deepEqual(daysInRange('2024-03-10', '2024-03-09'), [])
})

test('leap year february', () => {
  const days = daysInRange('2024-02-27', '2024-03-01')
  assert.deepEqual(days, ['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01'])
})

test('long range has no duplicates or gaps', () => {
  const days = daysInRange('2023-01-01', '2023-12-31')
  assert.equal(days.length, 365)
  assert.equal(new Set(days).size, 365)
})

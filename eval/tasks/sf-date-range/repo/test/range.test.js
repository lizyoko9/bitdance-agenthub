import assert from 'node:assert/strict'
import test from 'node:test'

import { daysInRange } from '../src/range.js'

test('returns an array', () => {
  assert.ok(Array.isArray(daysInRange('2024-01-01', '2024-01-03')))
})

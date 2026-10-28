import assert from 'node:assert/strict'
import test from 'node:test'

import { createKv } from '../src/kv.js'

test('basic set/get/delete', () => {
  const kv = createKv()
  kv.set('a', 1)
  kv.set('b', 2)
  assert.equal(kv.get('a'), 1)
  assert.equal(kv.delete('a'), true)
  assert.equal(kv.has('a'), false)
  assert.deepEqual(kv.keys(), ['b'])
})

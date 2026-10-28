import assert from 'node:assert/strict'
import test from 'node:test'

import { createEmitter } from '../src/emitter.js'

test('module loads', () => {
  assert.equal(typeof createEmitter, 'function')
})

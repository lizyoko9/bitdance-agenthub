import assert from 'node:assert/strict'
import test from 'node:test'

import { slugify } from '../src/slug.js'

test('exports slugify', () => {
  assert.equal(typeof slugify, 'function')
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { parseCsv } from '../src/parse.js'

test('parses simple csv', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n3,4'), [
    { a: '1', b: '2' },
    { a: '3', b: '4' },
  ])
})

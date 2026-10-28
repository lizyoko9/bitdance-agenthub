import assert from 'node:assert/strict'
import test from 'node:test'

import { validateUser } from '../src/users.js'

test('valid user', () => {
  assert.deepEqual(validateUser({ name: 'Ada', email: 'ada@example.com', age: 36 }), [])
})

test('missing and invalid fields', () => {
  assert.deepEqual(validateUser({ name: '  ', email: 'nope', age: 0 }), [
    'name is required',
    'email is invalid',
    'age must be a positive integer',
  ])
  assert.deepEqual(validateUser({}), ['name is required', 'email is required'])
})

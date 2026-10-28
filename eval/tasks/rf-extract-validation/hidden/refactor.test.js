import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { isEmail, isPositiveInt, requireFields } from '../src/validate.js'

test('requireFields', () => {
  assert.deepEqual(requireFields({ a: 1, b: ' ', c: null, e: 0 }, ['a', 'b', 'c', 'd', 'e']), ['b', 'c', 'd'])
})

test('isEmail and isPositiveInt', () => {
  assert.equal(isEmail('a@b.co'), true)
  assert.equal(isEmail('a@b'), false)
  assert.equal(isPositiveInt(3), true)
  assert.equal(isPositiveInt(0), false)
  assert.equal(isPositiveInt(2.5), false)
  assert.equal(isPositiveInt('3'), false)
})

test('modules use validate.js and drop their own regex', () => {
  for (const file of ['src/users.js', 'src/orders.js']) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /from ['"]\.\/validate\.js['"]/, file)
    assert.doesNotMatch(source, /@\[\^\\s@\]/, `${file} still defines an email regex`)
  }
})

test('original behaviour tests still pass', () => {
  execFileSync(process.execPath, ['--test', 'test/users.test.js', 'test/orders.test.js'], { stdio: 'pipe' })
})

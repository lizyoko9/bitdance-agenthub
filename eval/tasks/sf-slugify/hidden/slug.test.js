import assert from 'node:assert/strict'
import test from 'node:test'

import { slugify } from '../src/slug.js'

test('basic', () => {
  assert.equal(slugify('Hello World'), 'hello-world')
})

test('accents', () => {
  assert.equal(slugify('Crème Brûlée'), 'creme-brulee')
})

test('collapses symbols and trims dashes', () => {
  assert.equal(slugify('  --Node.js & TypeScript!!  '), 'node-js-typescript')
})

test('empty or symbols only', () => {
  assert.equal(slugify(''), 'untitled')
  assert.equal(slugify('!!! ???'), 'untitled')
})

test('max length without trailing dash', () => {
  const slug = slugify('word '.repeat(30))
  assert.ok(slug.length <= 60)
  assert.ok(!slug.endsWith('-'))
  assert.ok(slug.startsWith('word-word'))
})

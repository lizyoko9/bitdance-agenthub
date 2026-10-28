import assert from 'node:assert/strict'
import test from 'node:test'

import { validateOrder } from '../src/orders.js'

test('valid order', () => {
  assert.deepEqual(validateOrder({ sku: 'A1', quantity: 2, contactEmail: 'a@b.co' }), [])
})

test('invalid order', () => {
  assert.deepEqual(validateOrder({ sku: '', quantity: 1.5, contactEmail: 'x@y' }), [
    'sku is required',
    'quantity must be a positive integer',
    'contactEmail is invalid',
  ])
  assert.deepEqual(validateOrder({ sku: 'A1', contactEmail: null }), [
    'quantity is required',
    'contactEmail is required',
  ])
})

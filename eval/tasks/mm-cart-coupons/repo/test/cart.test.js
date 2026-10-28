import assert from 'node:assert/strict'
import test from 'node:test'

import { createCart } from '../src/cart.js'
import { computeTotals } from '../src/pricing.js'

test('subtotal sums lines', () => {
  const cart = createCart()
  cart.add('a', 1000, 2)
  cart.add('b', 250)
  cart.add('a', 1000)
  assert.equal(computeTotals(cart).subtotal, 3250)
  assert.equal(computeTotals(cart).total, 3250)
})

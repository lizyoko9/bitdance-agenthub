import assert from 'node:assert/strict'
import test from 'node:test'

import { createCart } from '../src/cart.js'
import { findCoupon } from '../src/coupons.js'
import { computeTotals } from '../src/pricing.js'

function cartWith(cents) {
  const cart = createCart()
  cart.add('x', cents)
  return cart
}

test('findCoupon is case-insensitive', () => {
  assert.equal(findCoupon('save10').code, 'SAVE10')
  assert.equal(findCoupon('nope'), null)
})

test('no coupon', () => {
  assert.deepEqual(computeTotals(cartWith(1234)), { subtotal: 1234, discount: 0, total: 1234 })
})

test('percent coupon rounds to cents', () => {
  const cart = cartWith(1235)
  cart.applyCoupon('SAVE10')
  assert.deepEqual(computeTotals(cart), { subtotal: 1235, discount: 124, total: 1111 })
})

test('fixed coupon respects minSubtotal', () => {
  const small = cartWith(1999)
  small.applyCoupon('MINUS500')
  assert.equal(computeTotals(small).discount, 0)
  const big = cartWith(2000)
  big.applyCoupon('minus500')
  assert.deepEqual(computeTotals(big), { subtotal: 2000, discount: 500, total: 1500 })
})

test('invalid coupon throws', () => {
  assert.throws(() => cartWith(100).applyCoupon('BOGUS'), /invalid coupon/i)
})

test('coupons do not stack and can be removed', () => {
  const cart = cartWith(20000)
  cart.applyCoupon('SAVE10')
  cart.applyCoupon('HALF')
  assert.equal(computeTotals(cart).discount, 10000)
  cart.removeCoupon()
  assert.equal(computeTotals(cart).discount, 0)
})

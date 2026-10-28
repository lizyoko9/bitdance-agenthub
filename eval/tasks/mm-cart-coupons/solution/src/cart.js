import { findCoupon } from './coupons.js'

export function createCart() {
  const lines = new Map()
  let coupon = null
  return {
    add(sku, priceCents, qty = 1) {
      const line = lines.get(sku) ?? { sku, priceCents, qty: 0 }
      line.qty += qty
      lines.set(sku, line)
    },
    remove(sku) {
      lines.delete(sku)
    },
    lines() {
      return [...lines.values()]
    },
    applyCoupon(code) {
      const found = findCoupon(code)
      if (!found) throw new Error(`invalid coupon: ${code}`)
      coupon = found
    },
    removeCoupon() {
      coupon = null
    },
    coupon() {
      return coupon
    },
  }
}

function discountFor(coupon, subtotal) {
  if (!coupon) return 0
  if (coupon.minSubtotal !== undefined && subtotal < coupon.minSubtotal) return 0
  if (coupon.type === 'percent') return Math.round((subtotal * coupon.value) / 100)
  return Math.min(coupon.value, subtotal)
}

export function computeTotals(cart) {
  const subtotal = cart.lines().reduce((sum, l) => sum + l.priceCents * l.qty, 0)
  const discount = discountFor(cart.coupon?.() ?? null, subtotal)
  return { subtotal, discount, total: subtotal - discount }
}

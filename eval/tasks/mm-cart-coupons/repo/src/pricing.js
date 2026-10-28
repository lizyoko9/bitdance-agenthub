export function computeTotals(cart) {
  const subtotal = cart.lines().reduce((sum, l) => sum + l.priceCents * l.qty, 0)
  return { subtotal, total: subtotal }
}

export function createCart() {
  const lines = new Map()
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
  }
}

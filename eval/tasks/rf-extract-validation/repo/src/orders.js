const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateOrder(order) {
  const errors = []
  for (const field of ['sku', 'quantity', 'contactEmail']) {
    const v = order[field]
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      errors.push(`${field} is required`)
    }
  }
  if (order.quantity !== undefined && !(Number.isInteger(order.quantity) && order.quantity > 0)) {
    errors.push('quantity must be a positive integer')
  }
  if (order.contactEmail && !EMAIL_PATTERN.test(order.contactEmail)) {
    errors.push('contactEmail is invalid')
  }
  return errors
}

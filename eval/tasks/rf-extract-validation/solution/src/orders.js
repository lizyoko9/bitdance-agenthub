import { isEmail, isPositiveInt, requireFields } from './validate.js'

export function validateOrder(order) {
  const errors = requireFields(order, ['sku', 'quantity', 'contactEmail']).map((field) => `${field} is required`)
  if (order.quantity !== undefined && !isPositiveInt(order.quantity)) {
    errors.push('quantity must be a positive integer')
  }
  if (order.contactEmail && !isEmail(order.contactEmail)) errors.push('contactEmail is invalid')
  return errors
}

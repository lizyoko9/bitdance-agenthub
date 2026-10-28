import { isEmail, isPositiveInt, requireFields } from './validate.js'

export function validateUser(user) {
  const errors = requireFields(user, ['name', 'email']).map((field) => `${field} is required`)
  if (user.email && !isEmail(user.email)) errors.push('email is invalid')
  if (user.age !== undefined && !isPositiveInt(user.age)) errors.push('age must be a positive integer')
  return errors
}

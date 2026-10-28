const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateUser(user) {
  const errors = []
  for (const field of ['name', 'email']) {
    const v = user[field]
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      errors.push(`${field} is required`)
    }
  }
  if (user.email && !EMAIL_RE.test(user.email)) errors.push('email is invalid')
  if (user.age !== undefined && !(Number.isInteger(user.age) && user.age > 0)) {
    errors.push('age must be a positive integer')
  }
  return errors
}

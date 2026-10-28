const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function requireFields(obj, fields) {
  return fields.filter((field) => {
    const v = obj[field]
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
  })
}

export function isEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value)
}

export function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0
}

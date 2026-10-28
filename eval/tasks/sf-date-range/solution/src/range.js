function parseUtc(date) {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function daysInRange(start, end) {
  const out = []
  const cursor = new Date(parseUtc(start))
  const last = parseUtc(end)
  while (cursor.getTime() <= last) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

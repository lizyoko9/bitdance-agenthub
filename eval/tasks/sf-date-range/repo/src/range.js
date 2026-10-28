const DAY_MS = 24 * 60 * 60 * 1000

export function daysInRange(start, end) {
  const out = []
  let t = new Date(start).getTime()
  const last = new Date(end).getTime()
  while (t < last) {
    out.push(new Date(t).toISOString().slice(0, 10))
    t += DAY_MS
  }
  return out
}

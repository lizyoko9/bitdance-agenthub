export function createKv({ now = Date.now } = {}) {
  const data = new Map()

  const alive = (key) => {
    const entry = data.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= now()) {
      data.delete(key)
      return null
    }
    return entry
  }

  return {
    set(key, value, { ttlMs } = {}) {
      if (ttlMs !== undefined && !(Number.isInteger(ttlMs) && ttlMs > 0)) {
        throw new RangeError(`ttlMs must be a positive integer, got ${ttlMs}`)
      }
      data.set(key, { value, expiresAt: ttlMs === undefined ? null : now() + ttlMs })
    },
    setWithExpiry(key, value, expiresAt) {
      data.set(key, { value, expiresAt })
    },
    get(key) {
      return alive(key)?.value
    },
    has(key) {
      return alive(key) !== null
    },
    delete(key) {
      return data.delete(key)
    },
    keys() {
      return [...data.keys()].filter((key) => alive(key))
    },
    entries() {
      return this.keys().map((key) => ({ key, ...data.get(key) }))
    },
  }
}

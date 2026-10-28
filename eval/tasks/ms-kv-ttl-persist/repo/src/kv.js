export function createKv() {
  const data = new Map()
  return {
    set(key, value) {
      data.set(key, value)
    },
    get(key) {
      return data.get(key)
    },
    has(key) {
      return data.has(key)
    },
    delete(key) {
      return data.delete(key)
    },
    keys() {
      return [...data.keys()]
    },
  }
}

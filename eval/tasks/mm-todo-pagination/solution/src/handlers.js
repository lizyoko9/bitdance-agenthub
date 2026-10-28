const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function parseDone(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function parsePositiveInt(value, fallback) {
  if (value === undefined) return fallback
  return /^[1-9]\d*$/.test(value) ? Number(value) : null
}

export function createHandlers(store) {
  return {
    listTodos(query = {}) {
      const page = parsePositiveInt(query.page, 1)
      const pageSize = parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE)
      if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
        return { status: 400, body: { error: 'page and pageSize must be positive integers, pageSize <= 100' } }
      }
      const done = parseDone(query.done)
      const items = store.list({ done, offset: (page - 1) * pageSize, limit: pageSize })
      return { status: 200, body: { items, total: store.count({ done }), page, pageSize } }
    },
    createTodo(body = {}) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return { status: 400, body: { error: 'title is required' } }
      }
      return { status: 201, body: store.add(body.title.trim()) }
    },
  }
}

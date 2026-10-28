function parseDone(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function createHandlers(store) {
  return {
    listTodos(query = {}) {
      const items = store.list({ done: parseDone(query.done) })
      return { status: 200, body: { items } }
    },
    createTodo(body = {}) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return { status: 400, body: { error: 'title is required' } }
      }
      return { status: 201, body: store.add(body.title.trim()) }
    },
  }
}

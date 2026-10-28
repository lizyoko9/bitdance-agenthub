export function createStore(initial = []) {
  const todos = initial.map((t, i) => ({ id: i + 1, done: false, ...t }))
  let nextId = todos.length + 1

  const filtered = (done) => todos.filter((t) => done === undefined || t.done === done)

  return {
    add(title) {
      const todo = { id: nextId++, title, done: false }
      todos.push(todo)
      return todo
    },
    list({ done, offset = 0, limit = Infinity } = {}) {
      return filtered(done).slice(offset, offset + limit)
    },
    count({ done } = {}) {
      return filtered(done).length
    },
    toggle(id) {
      const todo = todos.find((t) => t.id === id)
      if (!todo) return null
      todo.done = !todo.done
      return todo
    },
  }
}

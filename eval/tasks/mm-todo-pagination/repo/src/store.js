export function createStore(initial = []) {
  const todos = initial.map((t, i) => ({ id: i + 1, done: false, ...t }))
  let nextId = todos.length + 1

  return {
    add(title) {
      const todo = { id: nextId++, title, done: false }
      todos.push(todo)
      return todo
    },
    list({ done } = {}) {
      return todos.filter((t) => done === undefined || t.done === done)
    },
    toggle(id) {
      const todo = todos.find((t) => t.id === id)
      if (!todo) return null
      todo.done = !todo.done
      return todo
    },
  }
}

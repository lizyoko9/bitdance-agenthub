import assert from 'node:assert/strict'
import test from 'node:test'

import { createHandlers } from '../src/handlers.js'
import { createStore } from '../src/store.js'

test('creates and filters todos', () => {
  const store = createStore()
  const h = createHandlers(store)
  assert.equal(h.createTodo({ title: 'a' }).status, 201)
  assert.equal(h.createTodo({ title: ' ' }).status, 400)
  store.toggle(1)
  h.createTodo({ title: 'b' })
  assert.deepEqual(h.listTodos({ done: 'true' }).body.items.map((t) => t.title), ['a'])
})

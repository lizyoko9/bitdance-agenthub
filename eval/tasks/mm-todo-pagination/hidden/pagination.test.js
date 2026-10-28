import assert from 'node:assert/strict'
import test from 'node:test'

import { createHandlers } from '../src/handlers.js'
import { createStore } from '../src/store.js'

function seeded(n) {
  return createStore(Array.from({ length: n }, (_, i) => ({ title: `t${i + 1}`, done: i % 3 === 0 })))
}

test('store supports offset/limit and count', () => {
  const store = seeded(10)
  assert.deepEqual(store.list({ offset: 2, limit: 3 }).map((t) => t.title), ['t3', 't4', 't5'])
  assert.equal(store.count(), 10)
  assert.equal(store.count({ done: true }), 4)
})

test('default page and pageSize', () => {
  const res = createHandlers(seeded(25)).listTodos({})
  assert.equal(res.status, 200)
  assert.equal(res.body.items.length, 20)
  assert.equal(res.body.total, 25)
  assert.equal(res.body.page, 1)
  assert.equal(res.body.pageSize, 20)
})

test('second page', () => {
  const res = createHandlers(seeded(25)).listTodos({ page: '2', pageSize: '10' })
  assert.deepEqual(res.body.items.map((t) => t.title), ['t11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't19', 't20'])
  assert.equal(res.body.page, 2)
  assert.equal(res.body.pageSize, 10)
})

test('page past the end is empty but keeps total', () => {
  const res = createHandlers(seeded(5)).listTodos({ page: '3', pageSize: '10' })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.items, [])
  assert.equal(res.body.total, 5)
})

test('combines with done filter', () => {
  const res = createHandlers(seeded(10)).listTodos({ done: 'true', page: '1', pageSize: '2' })
  assert.deepEqual(res.body.items.map((t) => t.title), ['t1', 't4'])
  assert.equal(res.body.total, 4)
})

test('rejects invalid params', () => {
  const h = createHandlers(seeded(3))
  for (const query of [{ page: '0' }, { page: 'x' }, { pageSize: '101' }, { pageSize: '-1' }, { page: '1.5' }]) {
    const res = h.listTodos(query)
    assert.equal(res.status, 400, JSON.stringify(query))
    assert.equal(typeof res.body.error, 'string')
  }
})

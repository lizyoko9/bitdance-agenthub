import assert from 'node:assert/strict'
import test from 'node:test'

import { createEmitter } from '../src/emitter.js'

test('on/off/emit order and count', () => {
  const e = createEmitter()
  const calls = []
  const off = e.on('x', (v) => calls.push(`a${v}`))
  e.on('x', (v) => calls.push(`b${v}`))
  assert.equal(e.emit('x', 1), 2)
  off()
  assert.equal(e.emit('x', 2), 1)
  assert.deepEqual(calls, ['a1', 'b1', 'b2'])
  assert.equal(e.emit('none'), 0)
})

test('off by reference and once', () => {
  const e = createEmitter()
  let n = 0
  const fn = () => n++
  e.on('x', fn)
  e.off('x', fn)
  e.once('x', fn)
  e.emit('x')
  e.emit('x')
  assert.equal(n, 1)
})

test('listener errors are isolated and forwarded', () => {
  const e = createEmitter()
  const seen = []
  e.on('x', () => {
    throw new Error('boom')
  })
  e.on('x', () => seen.push('second'))
  e.on('error', (err, event) => seen.push(`${err.message}@${event}`))
  e.emit('x')
  assert.deepEqual(seen, ['second', 'boom@x'])
})

test('errors without error listener are swallowed, error listener errors do not loop', () => {
  const e = createEmitter()
  e.on('x', () => {
    throw new Error('boom')
  })
  assert.doesNotThrow(() => e.emit('x'))
  let errorCalls = 0
  e.on('error', () => {
    errorCalls++
    throw new Error('again')
  })
  assert.doesNotThrow(() => e.emit('x'))
  assert.equal(errorCalls, 1)
})

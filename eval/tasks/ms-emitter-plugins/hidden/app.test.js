import assert from 'node:assert/strict'
import test from 'node:test'

import { createApp } from '../src/app.js'
import { createEmitter } from '../src/emitter.js'
import { createLogger } from '../src/plugins/logger.js'
import { createMetrics } from '../src/plugins/metrics.js'

test('plugins work standalone', () => {
  const e = createEmitter()
  const logger = createLogger(e)
  const metrics = createMetrics(e)
  e.emit('request', { method: 'GET', path: '/a' })
  e.emit('response', { status: 404 })
  assert.deepEqual(logger.lines(), ['GET /a'])
  assert.deepEqual(metrics.snapshot(), { requests: 1, byStatus: { 404: 1 } })
})

test('app wires plugins', () => {
  const app = createApp()
  app.handle('GET', '/', 200)
  app.handle('POST', '/items', 201)
  app.handle('GET', '/', 200)
  assert.deepEqual(app.logs(), ['GET /', 'POST /items', 'GET /'])
  assert.deepEqual(app.metrics(), { requests: 3, byStatus: { 200: 2, 201: 1 } })
})

test('dispose stops recording', () => {
  const app = createApp()
  app.handle('GET', '/', 200)
  app.dispose()
  app.handle('GET', '/', 500)
  assert.deepEqual(app.logs(), ['GET /'])
  assert.deepEqual(app.metrics(), { requests: 1, byStatus: { 200: 1 } })
})

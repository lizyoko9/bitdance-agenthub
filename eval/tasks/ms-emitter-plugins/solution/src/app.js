import { createEmitter } from './emitter.js'
import { createLogger } from './plugins/logger.js'
import { createMetrics } from './plugins/metrics.js'

export function createApp() {
  const emitter = createEmitter()
  const logger = createLogger(emitter)
  const metrics = createMetrics(emitter)
  return {
    handle(method, path, status) {
      emitter.emit('request', { method, path })
      emitter.emit('response', { status })
    },
    logs: () => logger.lines(),
    metrics: () => metrics.snapshot(),
    dispose() {
      logger.dispose()
      metrics.dispose()
    },
  }
}

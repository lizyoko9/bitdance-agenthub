export function createMetrics(emitter) {
  let requests = 0
  const byStatus = {}
  const offRequest = emitter.on('request', () => requests++)
  const offResponse = emitter.on('response', ({ status }) => {
    byStatus[status] = (byStatus[status] ?? 0) + 1
  })
  return {
    snapshot: () => ({ requests, byStatus: { ...byStatus } }),
    dispose() {
      offRequest()
      offResponse()
    },
  }
}

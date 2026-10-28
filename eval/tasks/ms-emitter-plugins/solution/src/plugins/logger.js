export function createLogger(emitter) {
  const lines = []
  const dispose = emitter.on('request', ({ method, path }) => lines.push(`${method} ${path}`))
  return { lines: () => [...lines], dispose }
}

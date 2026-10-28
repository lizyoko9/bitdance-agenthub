import { createServer } from 'node:http'

import { createHandlers } from './handlers.js'
import { createStore } from './store.js'

export function startServer(port = 3000) {
  const handlers = createHandlers(createStore())
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    let result
    if (req.method === 'GET' && url.pathname === '/todos') {
      result = handlers.listTodos(Object.fromEntries(url.searchParams))
    } else if (req.method === 'POST' && url.pathname === '/todos') {
      let raw = ''
      for await (const chunk of req) raw += chunk
      result = handlers.createTodo(JSON.parse(raw || '{}'))
    } else {
      result = { status: 404, body: { error: 'not found' } }
    }
    res.writeHead(result.status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result.body))
  })
  return server.listen(port)
}

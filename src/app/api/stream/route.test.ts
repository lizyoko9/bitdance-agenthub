import { NextRequest } from 'next/server'
import { expect, it, vi } from 'vitest'

import { eventBus } from '@/server/event-bus'
import type { StreamEvent } from '@/shared/types'

import { GET } from './route'

vi.mock('@/server/event-bus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/event-bus')>()
  return { ...actual, eventBus: new actual.EventBus(10, 'boot', 512) }
})

vi.mock('@/server/sse-connections', () => ({ registerSseStream: () => () => {} }))

async function connect(lastEventId: string, signal: AbortSignal) {
  const response = await GET(new NextRequest('http://localhost/api/stream', {
    headers: { 'last-event-id': lastEventId },
    signal,
  }))
  if (!response.body) throw new Error('Missing SSE response body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  return async () => decoder.decode((await reader.read()).value)
}

it('keeps live SSE intact and sends resync for a cursor across an oversized event', async () => {
  const connections = new AbortController()
  const origin = { conversationId: 'conv', timestamp: 1 }
  eventBus.publish({ ...origin, type: 'heartbeat' })
  try {
    const readLive = await connect('boot-1', connections.signal)
    const oversized: StreamEvent = { ...origin, type: 'tool.result', messageId: 'msg', callId: 'call',
      result: '中'.repeat(512), isError: false }
    eventBus.publish(oversized)

    const readReconnect = await connect('boot-1', connections.signal)
    const finished: StreamEvent = { ...origin, type: 'run.end', runId: 'run', status: 'complete' }
    eventBus.publish(finished)

    expect(await readLive()).toContain('"type":"connected"')
    expect(await readLive()).toBe(`id: boot-2\ndata: ${JSON.stringify(oversized)}\n\n`)
    expect(await readReconnect()).toContain('"type":"connected"')
    expect(await readReconnect()).toMatch(/^data: {"type":"resync"/)
    expect(await readReconnect()).toBe(`id: boot-3\ndata: ${JSON.stringify(finished)}\n\n`)
  } finally {
    connections.abort()
  }
})

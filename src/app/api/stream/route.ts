import type { NextRequest } from 'next/server'

import { eventBus, type SequencedEvent } from '@/server/event-bus'

/**
 * GET /api/stream
 *
 * 全局 SSE 端点。所有会话的事件都从这一条流推出，事件携带 conversationId，
 * 前端按 id 分发到对应桶。详见 specs/02-stream-events.md。
 *
 * 每个事件带 SSE `id:`；浏览器自动重连时带回 Last-Event-ID，这里补发断线期间的事件，
 * 补不上（进程重启 / 缺口超出缓冲）则发 `resync` 控制消息让客户端重拉快照。
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const send = (data: unknown, id?: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`${id ? `id: ${id}\n` : ''}data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // 控制器已关闭，忽略
        }
      }
      const sendEntry = (entry: SequencedEvent) => send(entry.event, entry.id)

      // 推送一条 hello 让客户端立即知道连接 OK
      send({ type: 'connected', timestamp: Date.now() })

      // 补发与订阅在同一同步块内完成，中间不会有新事件漏掉或重复
      // 浏览器自动重连带头；客户端手动重建连接时走 query
      const lastEventId = req.headers.get('last-event-id') ?? req.nextUrl.searchParams.get('lastEventId')
      if (lastEventId) {
        const replay = eventBus.replaySince(lastEventId)
        if (replay.kind === 'resync') send({ type: 'resync', timestamp: Date.now() })
        else replay.events.forEach(sendEntry)
      }
      const unsubscribe = eventBus.subscribe(sendEntry)

      // 15s 心跳防止中间代理 / 浏览器空闲断连
      const heartbeat = setInterval(() => {
        send({ type: 'heartbeat', timestamp: Date.now() })
      }, 15000)

      const close = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // 已关闭
        }
      }

      req.signal.addEventListener('abort', close)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

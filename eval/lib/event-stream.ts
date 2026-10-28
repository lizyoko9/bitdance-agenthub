import { z } from 'zod'

import type { StreamEvent } from '@/shared/types'

const RECONNECT_DELAY_MS = 1000

const FrameSchema = z.object({ type: z.string(), conversationId: z.string().optional() }).passthrough()

export interface EventStream {
  /** 订阅某个会话的事件，返回取消订阅函数。 */
  subscribe(conversationId: string, listener: (event: StreamEvent) => void): () => void
  close(): void
}

/** 解析一段 SSE 文本，返回完整帧与剩余未完成的部分。 */
export function parseSseChunk(buffer: string): { frames: Array<{ id?: string; data: string }>; rest: string } {
  const blocks = buffer.split('\n\n')
  const rest = blocks.pop() ?? ''
  const frames = blocks.flatMap((block) => {
    let id: string | undefined
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('id: ')) id = line.slice(4)
      else if (line.startsWith('data: ')) data.push(line.slice(6))
    }
    return data.length > 0 ? [{ id, data: data.join('\n') }] : []
  })
  return { frames, rest }
}

/** 连上 /api/stream 后 resolve；断线时带 lastEventId 重连，服务端会补发缺口。 */
export async function openEventStream(baseUrl: string, onError: (err: unknown) => void): Promise<EventStream> {
  const listeners = new Map<string, Set<(event: StreamEvent) => void>>()
  const controller = new AbortController()
  let lastEventId: string | null = null
  let markConnected: (() => void) | null = null
  const connected = new Promise<void>((resolve) => {
    markConnected = resolve
  })

  const dispatch = (raw: string) => {
    const parsed = FrameSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return
    if (parsed.data.type === 'connected') {
      markConnected?.()
      return
    }
    if (parsed.data.type === 'resync') {
      onError(new Error('AgentHub stream requested resync (server restarted or replay buffer exceeded)'))
      return
    }
    const conversationId = parsed.data.conversationId
    if (!conversationId) return
    for (const listener of listeners.get(conversationId) ?? []) listener(parsed.data as unknown as StreamEvent)
  }

  const loop = async () => {
    while (!controller.signal.aborted) {
      try {
        const url = new URL('/api/stream', baseUrl)
        if (lastEventId) url.searchParams.set('lastEventId', lastEventId)
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok || !res.body) throw new Error(`AgentHub /api/stream responded ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const { frames, rest } = parseSseChunk(buffer)
          buffer = rest
          for (const frame of frames) {
            if (frame.id) lastEventId = frame.id
            dispatch(frame.data)
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        onError(err)
      }
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS))
    }
  }
  void loop()
  await connected

  return {
    subscribe(conversationId, listener) {
      const set = listeners.get(conversationId) ?? new Set()
      set.add(listener)
      listeners.set(conversationId, set)
      return () => set.delete(listener)
    },
    close() {
      controller.abort()
    },
  }
}

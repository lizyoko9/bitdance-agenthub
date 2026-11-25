import { EventEmitter } from 'node:events'

import type { StreamEvent } from '@/shared/types'

/** 断线补发窗口。part.delta 占绝大多数，5000 条约覆盖数分钟的流式输出。 */
export const REPLAY_BUFFER_SIZE = 5000
const REPLAY_BUFFER_MAX_BYTES = 32 * 1024 * 1024

export interface SequencedEvent {
  /** SSE `id:` 字段，格式 `<bootId>-<seq>`；bootId 区分进程重启（seq 会归零） */
  id: string
  seq: number
  event: StreamEvent
}

export type ReplayResult = { kind: 'replay'; events: SequencedEvent[] } | { kind: 'resync' }

type BufferedEvent = { json: string; bytes: number }

/**
 * 进程内事件总线。所有 Adapter 产生的 StreamEvent 经由此分发到 SSE 订阅者。
 *
 * 设计要点：
 *  - 单例：跨 Next.js HMR 用 globalThis 保活
 *  - emitter.setMaxListeners(0)：本地单进程预计同时 ≤ 几十个订阅者，但
 *    /api/stream 长连接 + 偶发重连可能短期内堆积，关闭限制避免误警告
 *  - 每个事件分配单调 seq，最近一段连续快照受条数和字节数双重约束
 */
export class EventBus {
  private emitter = new EventEmitter()
  private readonly bootId: string
  private seq = 0
  private readonly buffer = new Map<number, BufferedEvent>()
  private oldestSeq = 1
  private bufferedBytes = 0

  constructor(
    private readonly bufferSize = REPLAY_BUFFER_SIZE,
    bootId = Date.now().toString(36),
    private readonly maxReplayBytes = REPLAY_BUFFER_MAX_BYTES,
  ) {
    this.emitter.setMaxListeners(0)
    this.bootId = bootId
  }

  publish(event: StreamEvent): void {
    const seq = ++this.seq
    const entry: SequencedEvent = { id: `${this.bootId}-${seq}`, seq, event }
    this.retainForReplay(entry)
    this.emitter.emit('event', entry)
  }

  private retainForReplay({ seq, event }: SequencedEvent): void {
    let json: string | undefined
    try {
      json = JSON.stringify(event)
    } catch {
      // Serialization failure creates a replay gap without interrupting live dispatch.
    }
    const bytes = json === undefined ? 0 : Buffer.byteLength(json, 'utf8')
    if (json === undefined || bytes > this.maxReplayBytes) {
      this.buffer.clear()
      this.bufferedBytes = 0
      this.oldestSeq = seq + 1
      return
    }

    this.buffer.set(seq, { json, bytes })
    this.bufferedBytes += bytes
    const targetCount = this.buffer.size > this.bufferSize * 2 ? this.bufferSize : this.buffer.size
    while (this.buffer.size > targetCount || this.bufferedBytes > this.maxReplayBytes) {
      const oldest = this.buffer.get(this.oldestSeq)!
      this.bufferedBytes -= oldest.bytes
      this.buffer.delete(this.oldestSeq)
      this.oldestSeq++
    }
  }

  subscribe(listener: (entry: SequencedEvent) => void): () => void {
    this.emitter.on('event', listener)
    return () => {
      this.emitter.off('event', listener)
    }
  }

  /** 最近一次 publish 的事件 id；快照接口随快照返回，客户端只应用之后的事件。 */
  lastEventId(): string {
    return `${this.bootId}-${this.seq}`
  }

  /** 按 Last-Event-ID 计算补发内容；进程重启或缺口超出缓冲时返回 resync，让客户端重拉快照。 */
  replaySince(lastEventId: string): ReplayResult {
    const sep = lastEventId.lastIndexOf('-')
    const bootId = lastEventId.slice(0, sep)
    const seq = Number(lastEventId.slice(sep + 1))
    if (sep <= 0 || bootId !== this.bootId || !Number.isInteger(seq) || seq < 0 || seq > this.seq) {
      return { kind: 'resync' }
    }

    if (seq + 1 < this.oldestSeq) return { kind: 'resync' }

    const events: SequencedEvent[] = []
    for (let nextSeq = seq + 1; nextSeq <= this.seq; nextSeq++) {
      const { json } = this.buffer.get(nextSeq)!
      events.push({ id: `${this.bootId}-${nextSeq}`, seq: nextSeq, event: JSON.parse(json) as StreamEvent })
    }
    return { kind: 'replay', events }
  }
}

const globalForBus = globalThis as unknown as {
  __agenthubEventBus?: EventBus
}

export const eventBus = globalForBus.__agenthubEventBus ?? new EventBus()

if (!globalForBus.__agenthubEventBus) {
  globalForBus.__agenthubEventBus = eventBus
}

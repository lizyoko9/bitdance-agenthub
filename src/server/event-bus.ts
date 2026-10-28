import { EventEmitter } from 'node:events'

import type { StreamEvent } from '@/shared/types'

/** 断线补发窗口。part.delta 占绝大多数，5000 条约覆盖数分钟的流式输出。 */
export const REPLAY_BUFFER_SIZE = 5000

export interface SequencedEvent {
  /** SSE `id:` 字段，格式 `<bootId>-<seq>`；bootId 区分进程重启（seq 会归零） */
  id: string
  seq: number
  event: StreamEvent
}

export type ReplayResult = { kind: 'replay'; events: SequencedEvent[] } | { kind: 'resync' }

/**
 * 进程内事件总线。所有 Adapter 产生的 StreamEvent 经由此分发到 SSE 订阅者。
 *
 * 设计要点：
 *  - 单例：跨 Next.js HMR 用 globalThis 保活
 *  - emitter.setMaxListeners(0)：本地单进程预计同时 ≤ 几十个订阅者，但
 *    /api/stream 长连接 + 偶发重连可能短期内堆积，关闭限制避免误警告
 *  - 每个事件分配单调 seq，并保留最近 REPLAY_BUFFER_SIZE 条，供 SSE 重连按
 *    Last-Event-ID 补发（specs/02「断线恢复」）
 */
export class EventBus {
  private emitter = new EventEmitter()
  private readonly bootId: string
  private seq = 0
  private buffer: SequencedEvent[] = []

  constructor(
    private readonly bufferSize = REPLAY_BUFFER_SIZE,
    bootId = Date.now().toString(36),
  ) {
    this.emitter.setMaxListeners(0)
    this.bootId = bootId
  }

  publish(event: StreamEvent): void {
    const seq = ++this.seq
    const entry: SequencedEvent = { id: `${this.bootId}-${seq}`, seq, event }
    this.buffer.push(entry)
    // 摊还 O(1) 截断，避免每次 publish 都 shift
    if (this.buffer.length > this.bufferSize * 2) this.buffer = this.buffer.slice(-this.bufferSize)
    this.emitter.emit('event', entry)
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

    const oldest = this.buffer[0]?.seq ?? this.seq + 1
    if (seq + 1 < oldest) return { kind: 'resync' }
    return { kind: 'replay', events: this.buffer.filter((e) => e.seq > seq) }
  }
}

const globalForBus = globalThis as unknown as {
  __agenthubEventBus?: EventBus
}

export const eventBus = globalForBus.__agenthubEventBus ?? new EventBus()

if (!globalForBus.__agenthubEventBus) {
  globalForBus.__agenthubEventBus = eventBus
}

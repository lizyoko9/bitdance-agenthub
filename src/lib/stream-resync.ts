import type { StreamEvent } from '@/shared/types'

export interface QueuedStreamEvent {
  /** SSE lastEventId，格式 `<bootId>-<seq>`（见 src/server/event-bus.ts） */
  id: string
  event: StreamEvent
}

// 这些事件改的是消息模型，快照里已经包含；重放会重复追加 delta / tool part
const MESSAGE_MODEL_EVENT_TYPES = new Set<StreamEvent['type']>([
  'message.start',
  'message.end',
  'message.added',
  'message.removed',
  'part.start',
  'part.delta',
  'part.end',
  'tool.call',
  'tool.result',
])

function parseEventId(id: string): { bootId: string; seq: number } | null {
  const sep = id.lastIndexOf('-')
  if (sep <= 0) return null
  const seq = Number(id.slice(sep + 1))
  return Number.isInteger(seq) ? { bootId: id.slice(0, sep), seq } : null
}

/** resync 期间排队的事件里，挑出快照之后仍需应用的那些。 */
export function selectEventsAfterSnapshot(
  queued: QueuedStreamEvent[],
  snapshotEventId: string,
): StreamEvent[] {
  const snapshot = parseEventId(snapshotEventId)
  return queued
    .filter(({ id, event }) => {
      if (!MESSAGE_MODEL_EVENT_TYPES.has(event.type)) return true
      const parsed = parseEventId(id)
      if (!snapshot || !parsed || parsed.bootId !== snapshot.bootId) return true
      return parsed.seq > snapshot.seq
    })
    .map((q) => q.event)
}

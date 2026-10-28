import type { MessagePart } from '@/shared/types'

/** part.delta 落库合并窗口，见 specs/02「持久化 vs 透传」。 */
export const PART_DELTA_FLUSH_INTERVAL_MS = 100

// 同步写：快照读要在一个同步块里完成「取事件游标 → 刷盘 → 读库」，中间不能让出事件循环
type WriteParts = (messageId: string, parts: MessagePart[]) => void

export interface MessagePartsFlusher {
  markDirty(messageId: string): void
  /** 调用方即将整体写入该消息 parts 时调用，省掉一次重复写 */
  clear(messageId: string): void
  flush(): void
  dispose(): void
}

const globalForFlushers = globalThis as unknown as {
  __agenthubPartsFlushers?: Set<MessagePartsFlusher>
}
const activeFlushers = (globalForFlushers.__agenthubPartsFlushers ??= new Set())

export function createMessagePartsFlusher(
  partsBuffer: Map<string, MessagePart[]>,
  write: WriteParts,
  intervalMs = PART_DELTA_FLUSH_INTERVAL_MS,
): MessagePartsFlusher {
  const dirty = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const ids = [...dirty]
    dirty.clear()
    for (const id of ids) {
      const parts = partsBuffer.get(id)
      if (parts) write(id, parts)
    }
  }

  const flusher: MessagePartsFlusher = {
    markDirty(messageId) {
      dirty.add(messageId)
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        try {
          flush()
        } catch (err) {
          console.error('[MessagePartsFlusher] timed flush of message parts failed', err)
        }
      }, intervalMs)
    },
    clear(messageId) {
      dirty.delete(messageId)
    },
    flush,
    dispose() {
      activeFlushers.delete(flusher)
      flush()
    },
  }
  activeFlushers.add(flusher)
  return flusher
}

/** 刷掉所有进行中 run 的未落库 delta；读消息快照前调用，保证快照不比已推送的事件旧。 */
export function flushAllMessageParts(): void {
  for (const f of activeFlushers) f.flush()
}

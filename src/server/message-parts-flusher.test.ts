import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessagePart } from '@/shared/types'

import { createMessagePartsFlusher, flushAllMessageParts } from './message-parts-flusher'

function setup(intervalMs = 100) {
  const partsBuffer = new Map<string, MessagePart[]>()
  const writes: Array<{ messageId: string; content: string }> = []
  const write = vi.fn((messageId: string, parts: MessagePart[]) => {
    const first = parts[0]
    writes.push({ messageId, content: first?.type === 'text' ? first.content : '' })
  })
  const flusher = createMessagePartsFlusher(partsBuffer, write, intervalMs)
  return { partsBuffer, writes, write, flusher }
}

describe('createMessagePartsFlusher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces a burst of deltas into one write per interval', async () => {
    const { partsBuffer, writes, flusher } = setup()
    const part: MessagePart = { type: 'text', content: '' }
    partsBuffer.set('msg_1', [part])

    for (let i = 0; i < 5000; i++) {
      part.content += 'x'
      flusher.markDirty('msg_1')
    }
    expect(writes).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(100)
    expect(writes).toEqual([{ messageId: 'msg_1', content: 'x'.repeat(5000) }])
    flusher.dispose()
  })

  it('writes the latest parts on dispose without waiting for the timer', async () => {
    const { partsBuffer, writes, flusher } = setup()
    partsBuffer.set('msg_1', [{ type: 'text', content: 'partial' }])
    flusher.markDirty('msg_1')

    flusher.dispose()
    expect(writes).toEqual([{ messageId: 'msg_1', content: 'partial' }])

    await vi.advanceTimersByTimeAsync(200)
    expect(writes).toHaveLength(1)
  })

  it('skips messages the caller already wrote in full', async () => {
    const { partsBuffer, write, flusher } = setup()
    partsBuffer.set('msg_1', [{ type: 'text', content: 'a' }])
    flusher.markDirty('msg_1')
    flusher.clear('msg_1')

    await vi.advanceTimersByTimeAsync(100)
    expect(write).not.toHaveBeenCalled()
    flusher.dispose()
  })

  it('flushAllMessageParts drains every active flusher, and disposed ones are dropped', async () => {
    const a = setup()
    const b = setup()
    a.partsBuffer.set('msg_a', [{ type: 'text', content: 'A' }])
    b.partsBuffer.set('msg_b', [{ type: 'text', content: 'B' }])
    a.flusher.markDirty('msg_a')
    b.flusher.markDirty('msg_b')

    flushAllMessageParts()
    expect(a.writes).toEqual([{ messageId: 'msg_a', content: 'A' }])
    expect(b.writes).toEqual([{ messageId: 'msg_b', content: 'B' }])

    a.flusher.dispose()
    a.flusher.markDirty('msg_a')
    flushAllMessageParts()
    expect(a.writes).toHaveLength(1)
    b.flusher.dispose()
  })
})

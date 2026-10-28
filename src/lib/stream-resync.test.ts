import { describe, expect, it } from 'vitest'

import type { StreamEvent } from '@/shared/types'

import { selectEventsAfterSnapshot, type QueuedStreamEvent } from './stream-resync'

const base = { conversationId: 'conv_1', timestamp: 0 }

function delta(id: string, text: string): QueuedStreamEvent {
  const event: StreamEvent = {
    ...base,
    type: 'part.delta',
    messageId: 'msg_1',
    partIndex: 0,
    delta: { type: 'text.append', text },
  }
  return { id, event }
}

function runEnd(id: string): QueuedStreamEvent {
  const event: StreamEvent = { ...base, type: 'run.end', runId: 'run_1', status: 'complete' }
  return { id, event }
}

describe('selectEventsAfterSnapshot', () => {
  it('drops message events already contained in the snapshot', () => {
    const queued = [delta('boot-4', 'a'), delta('boot-5', 'b'), delta('boot-6', 'c')]
    const kept = selectEventsAfterSnapshot(queued, 'boot-5')
    expect(kept).toEqual([queued[2].event])
  })

  it('keeps non-message events even if they precede the snapshot', () => {
    const queued = [runEnd('boot-3'), delta('boot-4', 'a')]
    expect(selectEventsAfterSnapshot(queued, 'boot-5')).toEqual([queued[0].event])
  })

  it('keeps everything when the server restarted between snapshot and events', () => {
    const queued = [delta('boot2-1', 'a')]
    expect(selectEventsAfterSnapshot(queued, 'boot1-99')).toEqual([queued[0].event])
  })
})

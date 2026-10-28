import { describe, expect, it } from 'vitest'

import type { StreamEvent } from '@/shared/types'

import { EventBus, type SequencedEvent } from './event-bus'

function heartbeat(n: number): StreamEvent {
  return { type: 'heartbeat', conversationId: 'conv_1', timestamp: n }
}

function seqs(result: ReturnType<EventBus['replaySince']>): number[] | 'resync' {
  return result.kind === 'resync' ? 'resync' : result.events.map((e) => e.seq)
}

describe('EventBus replay', () => {
  it('assigns monotonically increasing ids and delivers them to subscribers', () => {
    const bus = new EventBus(10, 'boot')
    const received: SequencedEvent[] = []
    bus.subscribe((e) => received.push(e))

    bus.publish(heartbeat(1))
    bus.publish(heartbeat(2))

    expect(received.map((e) => e.id)).toEqual(['boot-1', 'boot-2'])
    expect(bus.lastEventId()).toBe('boot-2')
  })

  it('replays only the events after Last-Event-ID', () => {
    const bus = new EventBus(10, 'boot')
    for (let i = 1; i <= 5; i++) bus.publish(heartbeat(i))

    expect(seqs(bus.replaySince('boot-2'))).toEqual([3, 4, 5])
    expect(seqs(bus.replaySince('boot-5'))).toEqual([])
  })

  it('replays from an id captured before any event was published', () => {
    const bus = new EventBus(10, 'boot')
    const cursor = bus.lastEventId()
    bus.publish(heartbeat(1))

    expect(cursor).toBe('boot-0')
    expect(seqs(bus.replaySince(cursor))).toEqual([1])
  })

  it('asks for resync once the gap falls out of the buffer', () => {
    const bus = new EventBus(3, 'boot')
    for (let i = 1; i <= 20; i++) bus.publish(heartbeat(i))

    expect(seqs(bus.replaySince('boot-1'))).toBe('resync')
    expect(seqs(bus.replaySince('boot-17'))).toEqual([18, 19, 20])
  })

  it('asks for resync after a server restart or for a malformed id', () => {
    const bus = new EventBus(10, 'boot2')
    bus.publish(heartbeat(1))

    expect(seqs(bus.replaySince('boot1-1'))).toBe('resync')
    expect(seqs(bus.replaySince('boot2-99'))).toBe('resync')
    expect(seqs(bus.replaySince('garbage'))).toBe('resync')
    expect(seqs(bus.replaySince('boot2-x'))).toBe('resync')
  })
})

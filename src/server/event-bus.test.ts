import { describe, expect, it } from 'vitest'

import type { StreamEvent } from '@/shared/types'

import { EventBus, type SequencedEvent } from './event-bus'

function heartbeat(n: number): StreamEvent {
  return { type: 'heartbeat', conversationId: 'conv_1', timestamp: n }
}

function toolResult(result: unknown): StreamEvent {
  return { type: 'tool.result', conversationId: 'conv_1', timestamp: 1,
    messageId: 'msg', callId: 'call', result, isError: false }
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

  it.each([
    ['multibyte UTF-8', '中😀'.repeat(128)],
    ['JSON escapes', '\n"\\'.repeat(128)],
  ])('retains an exact byte boundary and evicts only the oldest event for %s', (_label, content) => {
    const event = toolResult(content)
    const bytes = Buffer.byteLength(JSON.stringify(event), 'utf8')
    const bus = new EventBus(10, 'boot', bytes * 2)

    bus.publish(event)
    bus.publish(event)
    expect(seqs(bus.replaySince('boot-0'))).toEqual([1, 2])

    bus.publish(event)
    expect(seqs(bus.replaySince('boot-0'))).toBe('resync')
    expect(seqs(bus.replaySince('boot-1'))).toEqual([2, 3])
  })

  it('keeps count trimming and releases the corresponding byte budget', () => {
    const bytes = Buffer.byteLength(JSON.stringify(heartbeat(1)), 'utf8')
    const bus = new EventBus(2, 'boot', bytes * 5)
    for (let seq = 1; seq <= 4; seq++) bus.publish(heartbeat(seq))
    expect(seqs(bus.replaySince('boot-0'))).toEqual([1, 2, 3, 4])

    bus.publish(heartbeat(5))
    expect(seqs(bus.replaySince('boot-2'))).toBe('resync')
    expect(seqs(bus.replaySince('boot-3'))).toEqual([4, 5])

    bus.publish(heartbeat(6))
    bus.publish(heartbeat(7))
    expect(seqs(bus.replaySince('boot-3'))).toEqual([4, 5, 6, 7])
  })

  it.each([
    ['oversized', toolResult('中'.repeat(512))],
    ['non-serializable', toolResult(BigInt(1))],
  ])('delivers the %s event live and resyncs cursors that cross its gap', (_label, event) => {
    const bus = new EventBus(10, 'boot', 256)
    const received: SequencedEvent[] = []
    bus.subscribe(entry => received.push(entry))
    bus.publish(heartbeat(1))

    expect(() => bus.publish(event)).not.toThrow()
    expect(received[1]).toEqual({ id: 'boot-2', seq: 2, event })
    expect(bus.lastEventId()).toBe('boot-2')
    expect(seqs(bus.replaySince('boot-1'))).toBe('resync')
    expect(seqs(bus.replaySince('boot-2'))).toEqual([])

    bus.publish(heartbeat(3))
    expect(seqs(bus.replaySince('boot-1'))).toBe('resync')
    expect(seqs(bus.replaySince('boot-2'))).toEqual([3])
  })

  it('replays the published part snapshot so a later delta is applied once', () => {
    const bus = new EventBus(10, 'boot', 1024)
    const part = { type: 'text' as const, content: '' }
    const origin = { conversationId: 'conv_1', timestamp: 1, messageId: 'msg', partIndex: 0 }
    bus.publish({ ...origin, type: 'part.start', part })

    part.content = '流式输出😀'
    const delta: StreamEvent = { ...origin, type: 'part.delta', delta: { type: 'text.append', text: part.content } }
    bus.publish(delta)

    const replay = bus.replaySince('boot-0')
    expect(replay).toMatchObject({
      kind: 'replay',
      events: [
        { seq: 1, event: { type: 'part.start', part: { type: 'text', content: '' } } },
        { seq: 2, event: delta },
      ],
    })
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

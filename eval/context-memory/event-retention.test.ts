import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { expect, it } from 'vitest'

import { selectEventsAfterSnapshot } from '@/lib/stream-resync'
import { EventBus, REPLAY_BUFFER_SIZE } from '@/server/event-bus'
import type { StreamEvent } from '@/shared/types'

const outputDirectory = process.env.AGENTHUB_CONTEXT_MEMORY_OUT
const deltaBytes = 8192
const highWaterEvents = REPLAY_BUFFER_SIZE * 2
const defaultReplayBytes = 32 * 1024 * 1024
const streamCounts = [1, 8]

function checkpoint(phase: string, start: number, counters: Record<string, number> = {}) {
  globalThis.gc?.()
  const { rss, heapUsed, external, arrayBuffers } = process.memoryUsage()
  return {
    phase,
    elapsedMs: performance.now() - start,
    rssBytes: rss,
    heapUsedBytes: heapUsed,
    externalBytes: external,
    arrayBuffersBytes: arrayBuffers,
    ...counters,
  }
}

function replayCount(bus: EventBus, cursor: string) {
  const result = bus.replaySince(cursor)
  expect(result.kind).toBe('replay')
  if (result.kind !== 'replay') throw new Error('Expected an available replay cursor')
  return result.events.length
}

function fixtureDelta(payload: Buffer, sequence: number, streams: number): StreamEvent {
  const stream = (sequence - 1) % streams
  payload.write(sequence.toString(16).padStart(8, '0'), 0, 'ascii')
  return {
    type: 'part.delta', conversationId: `conversation-${stream}`, messageId: `message-${stream}`,
    partIndex: 0, timestamp: sequence, delta: { type: 'text.append', text: payload.toString('latin1') },
  }
}

function runRetentionScenario(streams: number, start: number, samples: ReturnType<typeof checkpoint>[]) {
  const bus = new EventBus(undefined, undefined, Number.POSITIVE_INFINITY)
  const beginning = bus.lastEventId()
  const payload = Buffer.alloc(deltaBytes, 'a')
  let subscriberDeliveries = 0
  const unsubscribe = bus.subscribe(() => subscriberDeliveries++)
  const capture = (phase: string, retainedDeltaEvents: number) => samples.push(checkpoint(phase, start, {
    retainedDeltaEvents,
    retainedDeltaBytes: retainedDeltaEvents * deltaBytes,
    subscriberDeliveries,
  }))
  let compactedCursor = beginning
  let queuedCursor = beginning
  let snapshotCursor = beginning
  try {
    for (let sequence = 1; sequence <= highWaterEvents + 1; sequence++) {
      bus.publish(fixtureDelta(payload, sequence, streams))
      if (sequence === REPLAY_BUFFER_SIZE + 1) compactedCursor = bus.lastEventId()
      if (sequence === highWaterEvents - 16) queuedCursor = bus.lastEventId()
      if (sequence === highWaterEvents - 8) snapshotCursor = bus.lastEventId()
      if (sequence === highWaterEvents) capture('before_compaction', replayCount(bus, beginning))
    }
    expect(bus.replaySince(beginning).kind).toBe('resync')
    capture('after_compaction', replayCount(bus, compactedCursor))

    const pending = bus.replaySince(queuedCursor)
    if (pending.kind !== 'replay') throw new Error('Expected recent events for the resync projection')
    const selected = selectEventsAfterSnapshot(pending.events, snapshotCursor)
    expect(selected).toHaveLength(9)
    samples.push(checkpoint('resync_projection', start, {
      queuedEvents: pending.events.length,
      selectedEvents: selected.length,
    }))
  } finally {
    unsubscribe()
  }

  const deliveriesBeforeUnsubscribe = subscriberDeliveries
  bus.publish({ type: 'heartbeat', conversationId: 'fixture', timestamp: highWaterEvents + 2 })
  expect(subscriberDeliveries).toBe(deliveriesBeforeUnsubscribe)
  expect(replayCount(bus, compactedCursor)).toBe(REPLAY_BUFFER_SIZE + 1)
  capture('unsubscribed_bus_alive', REPLAY_BUFFER_SIZE)
}

it.skipIf(!outputDirectory)('measures EventBus replay, compaction, and subscriber release using synthetic deltas', () => {
  if (!outputDirectory) throw new Error('Set AGENTHUB_CONTEXT_MEMORY_OUT to retain the measurement')
  const scenarios = streamCounts.map((streams) => {
    const start = performance.now()
    const samples = [checkpoint('baseline', start)]
    runRetentionScenario(streams, start, samples)
    samples.push(checkpoint('released_bus_owner', start))
    expect(samples.find((sample) => sample.phase === 'before_compaction')).toMatchObject({
      retainedDeltaEvents: highWaterEvents, subscriberDeliveries: highWaterEvents,
    })
    expect(samples.find((sample) => sample.phase === 'after_compaction')).toMatchObject({
      retainedDeltaEvents: REPLAY_BUFFER_SIZE, subscriberDeliveries: highWaterEvents + 1,
    })
    return { streams, samples }
  })
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(path.join(outputDirectory, 'event-retention.json'), JSON.stringify({
    schemaVersion: 1,
    mode: 'count-only baseline with the current EventBus implementation',
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    gcAvailable: typeof globalThis.gc === 'function',
    settings: { replayTargetEvents: REPLAY_BUFFER_SIZE, highWaterEvents, deltaBytes },
    scenarios,
  }, null, 2) + '\n', { flag: 'wx' })
})

function measureReplayWindow(bus: EventBus, cursor: string) {
  const result = bus.replaySince(cursor)
  if (result.kind !== 'replay') throw new Error('Expected the whole retained replay window')
  return {
    retainedDeltaEvents: result.events.length,
    retainedDeltaBytes: result.events.length * deltaBytes,
    retainedEventJsonBytes: result.events.reduce((total, entry) =>
      total + Buffer.byteLength(JSON.stringify(entry.event)), 0),
  }
}

function runByteBudgetScenario(streams: number, start: number, samples: ReturnType<typeof checkpoint>[]) {
  const bus = new EventBus(REPLAY_BUFFER_SIZE, 'byte-budget-probe')
  const payload = Buffer.alloc(deltaBytes, 'a')
  const publishedSizes = new Uint32Array(highWaterEvents + 2)
  let firstRetained = 1
  let expectedRetainedBytes = 0
  let subscriberDeliveries = 0
  const unsubscribe = bus.subscribe(() => subscriberDeliveries++)

  try {
    for (let sequence = 1; sequence <= highWaterEvents + 1; sequence++) {
      const event = fixtureDelta(payload, sequence, streams)
      publishedSizes[sequence] = Buffer.byteLength(JSON.stringify(event))
      expectedRetainedBytes += publishedSizes[sequence]
      while (expectedRetainedBytes > defaultReplayBytes) {
        expectedRetainedBytes -= publishedSizes[firstRetained++]
      }
      bus.publish(event)
      if (sequence < highWaterEvents) continue

      const cursor = `byte-budget-probe-${firstRetained - 1}`
      const window = measureReplayWindow(bus, cursor)
      expect(window.retainedDeltaEvents).toBe(sequence - firstRetained + 1)
      expect(window.retainedEventJsonBytes).toBe(expectedRetainedBytes)
      expect(bus.replaySince(`byte-budget-probe-${firstRetained - 2}`).kind).toBe('resync')
      expect(subscriberDeliveries).toBe(sequence)
      const phase = sequence === highWaterEvents ? 'before_count_compaction' : 'after_one_more_event'
      samples.push(checkpoint(phase, start, { ...window, subscriberDeliveries }))
    }
  } finally {
    unsubscribe()
  }

  const pending = bus.replaySince(`byte-budget-probe-${highWaterEvents - 16}`)
  if (pending.kind !== 'replay') throw new Error('Expected recent events for the resync projection')
  const selected = selectEventsAfterSnapshot(pending.events, `byte-budget-probe-${highWaterEvents - 8}`)
  expect(selected).toHaveLength(9)
  samples.push(checkpoint('resync_projection', start, {
    queuedEvents: pending.events.length,
    selectedEvents: selected.length,
  }))
}

it.skipIf(!outputDirectory)('measures default byte-budgeted replay using the same synthetic deltas', () => {
  if (!outputDirectory) throw new Error('Set AGENTHUB_CONTEXT_MEMORY_OUT to retain the measurement')
  const scenarios = streamCounts.map((streams) => {
    const start = performance.now()
    const samples = [checkpoint('baseline', start)]
    runByteBudgetScenario(streams, start, samples)
    samples.push(checkpoint('released_bus_owner', start))
    return { streams, samples }
  })
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(path.join(outputDirectory, 'event-replay-byte-budget.json'), JSON.stringify({
    schemaVersion: 1,
    mode: 'default byte budget with the current EventBus implementation',
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    gcAvailable: typeof globalThis.gc === 'function',
    settings: { defaultReplayBytes, replayTargetEvents: REPLAY_BUFFER_SIZE, highWaterEvents, deltaBytes },
    scenarios,
  }, null, 2) + '\n', { flag: 'wx' })
})

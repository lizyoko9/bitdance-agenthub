import { describe, expect, it } from 'vitest'

import { parseSseChunk } from './event-stream.ts'

describe('parseSseChunk', () => {
  it('splits complete frames and keeps the partial tail', () => {
    const { frames, rest } = parseSseChunk('id: b-1\ndata: {"a":1}\n\ndata: {"b":2}\n\nid: b-3\ndata: {"c"')
    expect(frames).toEqual([
      { id: 'b-1', data: '{"a":1}' },
      { id: undefined, data: '{"b":2}' },
    ])
    expect(rest).toBe('id: b-3\ndata: {"c"')
  })
})

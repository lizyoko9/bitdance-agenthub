import { describe, expect, it, vi } from 'vitest'

import { closeAllSseStreams, openSseStreamCount, registerSseStream } from './sse-connections'

describe('sse-connections', () => {
  it('closes every registered stream once and empties the registry', () => {
    const a = vi.fn()
    const b = vi.fn()
    registerSseStream(a)
    registerSseStream(b)

    closeAllSseStreams()

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(openSseStreamCount()).toBe(0)
  })

  it('does not close streams that already unregistered themselves', () => {
    const close = vi.fn()
    const unregister = registerSseStream(close)
    unregister()

    closeAllSseStreams()
    expect(close).not.toHaveBeenCalled()
  })

  it('tolerates a stream unregistering itself while being closed', () => {
    let unregister = () => {}
    const close = vi.fn(() => unregister())
    unregister = registerSseStream(close)
    const other = vi.fn()
    registerSseStream(other)

    closeAllSseStreams()
    expect(close).toHaveBeenCalledTimes(1)
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('installs SIGTERM/SIGINT handlers only once', () => {
    const before = process.listenerCount('SIGTERM')
    registerSseStream(vi.fn())
    registerSseStream(vi.fn())
    expect(process.listenerCount('SIGTERM')).toBe(before)
    closeAllSseStreams()
  })
})

import { describe, expect, it } from 'vitest'

import { normalizeLifecyclePhase } from './agenthub-lifecycle-types'

describe('agenthub lifecycle types', () => {
  it('normalizes known lifecycle phases', () => {
    expect(normalizeLifecyclePhase('spec')).toBe('spec')
    expect(normalizeLifecyclePhase('scaffold')).toBe('scaffold')
    expect(normalizeLifecyclePhase('build')).toBe('build')
    expect(normalizeLifecyclePhase('orchestrate')).toBe('orchestrate')
    expect(normalizeLifecyclePhase('evaluate')).toBe('evaluate')
    expect(normalizeLifecyclePhase('observe')).toBe('observe')
  })

  it('falls back to spec for unknown phase values', () => {
    expect(normalizeLifecyclePhase('google-cloud-deploy')).toBe('spec')
    expect(normalizeLifecyclePhase('')).toBe('spec')
  })
})

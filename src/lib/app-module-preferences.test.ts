import { describe, expect, it } from 'vitest'

import {
  APP_MODULE_PREFERENCES_STORAGE_KEY,
  addEnabledAppModuleId,
  parseStoredAppModulePreferences,
  removeEnabledAppModuleId,
  serializeAppModulePreferences,
} from './app-module-preferences'

describe('app module preferences', () => {
  it('stores enabled module ids as a stable compact payload', () => {
    expect(APP_MODULE_PREFERENCES_STORAGE_KEY).toBe('agenthub:enabled-app-modules')
    expect(serializeAppModulePreferences(['workbench', 'analytics', 'analytics'])).toBe(
      JSON.stringify({ enabledModuleIds: ['workbench', 'analytics'] }),
    )
  })

  it('restores only known enabled modules and normalizes retired module ids', () => {
    const raw = JSON.stringify({
      enabledModuleIds: ['analytics', 'memory', 'unknown-module', 'langflow-native'],
    })

    expect(parseStoredAppModulePreferences(raw)).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
      'analytics',
    ])
  })

  it('falls back to defaults for empty or broken storage payloads', () => {
    expect(parseStoredAppModulePreferences(null)).toBeUndefined()
    expect(parseStoredAppModulePreferences('not json')).toBeUndefined()
    expect(parseStoredAppModulePreferences(JSON.stringify({ enabledModuleIds: [] }))).toBeUndefined()
  })

  it('adds optional modules on top of the default layout', () => {
    expect(addEnabledAppModuleId(undefined, 'analytics')).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
      'analytics',
    ])
  })

  it('removes optional modules without removing the default product modules', () => {
    const current = addEnabledAppModuleId(['analytics'], 'artifacts')

    expect(removeEnabledAppModuleId(current, 'analytics')).toEqual([
      'workbench',
      'conversations',
      'agents',
      'agent-canvas',
      'skills',
      'models',
      'tools',
      'artifacts',
    ])
    expect(removeEnabledAppModuleId(current, 'agents')).toContain('agents')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('app shell module preferences', () => {
  it('loads and persists enabled module ids through local storage', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/app-shell.tsx'), 'utf8')

    expect(source).toContain('APP_MODULE_PREFERENCES_STORAGE_KEY')
    expect(source).toContain('parseStoredAppModulePreferences')
    expect(source).toContain('serializeAppModulePreferences')
    expect(source).toContain('addEnabledAppModuleId')
    expect(source).toContain('removeEnabledAppModuleId')
    expect(source).toContain('window.localStorage.getItem(APP_MODULE_PREFERENCES_STORAGE_KEY)')
    expect(source).toContain('window.localStorage.setItem(')
    expect(source).toContain('onDisableModule={handleDisableModule}')
  })
})

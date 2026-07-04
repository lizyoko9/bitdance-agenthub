import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('sidebar simplification', () => {
  it('does not expose the old global settings dialog in the main shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/sidebar.tsx'), 'utf8')

    expect(source).not.toContain('SettingsButton')
    expect(source).not.toContain('@/components/settings-dialog')
  })
})

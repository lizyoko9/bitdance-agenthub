import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('eslint ignore policy', () => {
  it('keeps local reference downloads and run logs outside project lint', () => {
    const source = readFileSync(resolve(process.cwd(), 'eslint.config.mjs'), 'utf8')

    expect(source).toContain('".external/**"')
    expect(source).toContain('".codex-runlogs/**"')
  })
})

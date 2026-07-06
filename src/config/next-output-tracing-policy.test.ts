import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('next output tracing policy', () => {
  const source = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8')

  it('excludes generated release and local workspace folders from standalone tracing', () => {
    expect(source).toContain("'release/**'")
    expect(source).toContain("'release-*/**'")
    expect(source).toContain("'.external/**'")
    expect(source).toContain("'.codex-runlogs/**'")
  })
})

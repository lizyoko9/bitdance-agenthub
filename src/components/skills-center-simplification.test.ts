import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('skills center simplification', () => {
  it('keeps skills management free of search-market UI', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/skills-center.tsx'), 'utf8')

    expect(source).not.toContain('installed-skills-search')
    expect(source).not.toContain('Search')
    expect(source).not.toContain('marketplacePublications.map')
  })
})

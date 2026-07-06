import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('desktop typecheck scope', () => {
  it('does not include the paused mobile app in the desktop TypeScript project', () => {
    const tsconfig = JSON.parse(readFileSync(resolve(process.cwd(), 'tsconfig.json'), 'utf8')) as {
      exclude?: string[]
    }

    expect(tsconfig.exclude).toContain('apps/mobile')
  })
})

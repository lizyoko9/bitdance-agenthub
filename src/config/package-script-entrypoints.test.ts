import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

type PackageJson = {
  scripts: Record<string, string>
}

describe('package script entrypoints', () => {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as PackageJson

  it('uses direct Node entrypoints for TypeScript and Vitest scripts', () => {
    expect(pkg.scripts.lint).toBe('node node_modules/eslint/bin/eslint.js')
    expect(pkg.scripts.typecheck).toBe('node node_modules/typescript/bin/tsc --noEmit')
    expect(pkg.scripts['electron:tsc']).toBe('node node_modules/typescript/bin/tsc -p electron/tsconfig.json')
    expect(pkg.scripts.test).toContain('node node_modules/vitest/vitest.mjs run')
    expect(pkg.scripts['test:watch']).toContain('node node_modules/vitest/vitest.mjs')
  })
})

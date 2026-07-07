import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('runtime control adb discovery', () => {
  it('keeps adb existence checks runtime-only so bundlers do not trace broad dynamic paths', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/server/runtime-control-service.ts'), 'utf8')

    expect(source).toContain('function runtimePathExists')
    expect(source).not.toContain('candidatePaths.find((candidate) => existsSync(candidate))')
    expect(source).toContain('function appendAdbPathSegments')
    expect(source).not.toContain('path.join(root, subdir)')
  })
})

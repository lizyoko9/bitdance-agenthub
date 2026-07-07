import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('gitignore release safety policy', () => {
  it('keeps local reference downloads and server start logs out of public commits', () => {
    const source = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8')

    expect(source).toContain('/.external/')
    expect(source).toContain('/.next-start-logs/')
    expect(source).toContain('/.electron-builder-cache/')
  })

  it('allows the tracked desktop icon while keeping release output ignored', () => {
    const iconCheck = spawnSync('git', ['check-ignore', '-q', 'build/icon.ico'], {
      cwd: process.cwd(),
    })
    const releaseCheck = spawnSync('git', ['check-ignore', '-q', 'release-icon-final'], {
      cwd: process.cwd(),
    })

    expect(iconCheck.status).not.toBe(0)
    expect(releaseCheck.status).toBe(0)
  })
})

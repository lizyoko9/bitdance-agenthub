import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
  build?: {
    win?: {
      icon?: string
    }
  }
}

describe('electron app icon policy', () => {
  it('packages the Windows desktop app with a tracked ICO icon', () => {
    expect(packageJson.build?.win?.icon).toBe('build/icon.ico')

    const iconPath = path.join(projectRoot, packageJson.build?.win?.icon ?? '')
    expect(existsSync(iconPath)).toBe(true)

    const iconHeader = readFileSync(iconPath).subarray(0, 4)
    expect([...iconHeader]).toEqual([0, 0, 1, 0])
  })
})

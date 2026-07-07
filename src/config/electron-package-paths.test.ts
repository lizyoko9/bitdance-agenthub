import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildElectronBuilderNodeArgs,
  buildPackageBridgeNodeArgs,
  isPathInsideRoot,
  pathContainsNonAscii,
  selectAvailableBridgeDrive,
  toBridgePath,
} from '../../scripts/electron-package-paths.mjs'

describe('electron package path helpers', () => {
  it('treats files below a drive root as inside the project root', () => {
    expect(isPathInsideRoot('X:\\', 'X:\\.electron-package')).toBe(true)
    expect(isPathInsideRoot('X:\\', 'X:\\release\\win-unpacked')).toBe(true)
  })

  it('rejects sibling paths outside the project root', () => {
    const root = path.join('C:\\agenthub', 'project')

    expect(isPathInsideRoot(root, path.join('C:\\agenthub', 'other'))).toBe(false)
  })

  it('detects non-ascii Windows workspace paths that need an ASCII packaging bridge', () => {
    expect(pathContainsNonAscii('C:\\Users\\九思\\project')).toBe(true)
    expect(pathContainsNonAscii('C:\\agenthub\\project')).toBe(false)
  })

  it('selects an unused ASCII drive for Windows package bridging', () => {
    expect(selectAvailableBridgeDrive(new Set(['Z:', 'Y:']))).toBe('X:')
    expect(selectAvailableBridgeDrive(new Set(['Z:', 'Y:', 'X:', 'W:', 'V:', 'U:']))).toBe('T:')
  })

  it('runs package and builder child processes through the ASCII bridge without global symlink preservation', () => {
    expect(buildPackageBridgeNodeArgs('X:\\scripts\\electron-package.mjs')).toEqual([
      'X:\\scripts\\electron-package.mjs',
    ])
    expect(buildElectronBuilderNodeArgs('X:\\scripts\\electron-builder-nsis-wrapper.mjs', 'X:\\.electron-package')).toEqual([
      'X:\\scripts\\electron-builder-nsis-wrapper.mjs',
      '--projectDir',
      'X:\\.electron-package',
    ])
  })

  it('converts real paths below the original workspace to the bridge drive', () => {
    expect(toBridgePath('C:\\Users\\九思\\project', 'X:\\', 'C:\\Users\\九思\\project\\node_modules\\pkg')).toBe(
      'X:\\node_modules\\pkg',
    )
    expect(toBridgePath('C:\\Users\\九思\\project', 'X:\\', 'C:\\Users\\九思\\other')).toBeNull()
  })
})

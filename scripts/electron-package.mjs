import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildElectronBuilderNodeArgs,
  buildPackageBridgeNodeArgs,
  isPathInsideRoot,
  pathContainsNonAscii,
  selectAvailableBridgeDrive,
} from './electron-package-paths.mjs'

const root = process.cwd()
const asciiBridgeActiveEnv = 'AGENTHUB_ELECTRON_ASCII_BRIDGE_ACTIVE'

if (process.platform === 'win32' && pathContainsNonAscii(root) && process.env[asciiBridgeActiveEnv] !== '1') {
  process.exit(runWithAsciiBridge())
}

const stageDir = path.join(root, '.electron-package')
const releaseDir = process.env.AGENTHUB_RELEASE_DIR
  ? path.resolve(root, process.env.AGENTHUB_RELEASE_DIR)
  : path.join(root, 'release')

function assertInsideRoot(target, label) {
  const resolvedTarget = path.resolve(target)
  if (!isPathInsideRoot(root, resolvedTarget)) {
    throw new Error(`${label} is outside project root: ${resolvedTarget}`)
  }
}

function resetDir(target, label) {
  assertInsideRoot(target, label)
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
}

function runWithAsciiBridge() {
  const drive = selectAvailableBridgeDrive(getUsedWindowsDrives())
  if (!drive) {
    console.error('✗ Electron packaging needs an ASCII Windows path, but no free bridge drive was found.')
    return 1
  }

  const bridgeRoot = `${drive}\\`
  const mapResult = spawnSync('subst', [drive, root], { stdio: 'inherit' })
  if (mapResult.error) {
    throw mapResult.error
  }
  if (mapResult.status !== 0) {
    return mapResult.status ?? 1
  }

  try {
    const bridgedScript = path.join(bridgeRoot, 'scripts', 'electron-package.mjs')
    const result = spawnSync(process.execPath, buildPackageBridgeNodeArgs(bridgedScript), {
      cwd: bridgeRoot,
      env: {
        ...process.env,
        [asciiBridgeActiveEnv]: '1',
        AGENTHUB_ELECTRON_ASCII_ORIGINAL_ROOT: root,
        AGENTHUB_ELECTRON_ASCII_BRIDGE_ROOT: bridgeRoot,
        ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE ?? path.join(bridgeRoot, '.electron-builder-cache'),
      },
      stdio: 'inherit',
    })

    if (result.error) {
      throw result.error
    }
    return result.status ?? 1
  } finally {
    const cleanup = spawnSync('subst', [drive, '/D'], { stdio: 'inherit' })
    if (cleanup.error) {
      console.warn(`⚠ Failed to remove Electron package bridge drive ${drive}: ${cleanup.error.message}`)
    }
  }
}

function getUsedWindowsDrives() {
  const used = new Set()
  for (let code = 65; code <= 90; code += 1) {
    const drive = `${String.fromCharCode(code)}:`
    if (fs.existsSync(`${drive}\\`)) {
      used.add(drive)
    }
  }
  return used
}

function copyDir(src, dest, label) {
  if (!fs.existsSync(src)) {
    throw new Error(`${label} does not exist: ${src}`)
  }
  fs.cpSync(src, dest, { recursive: true, force: true, dereference: true })
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const rootPkg = readJson(path.join(root, 'package.json'))
const electronPkg = readJson(
  path.join(root, 'node_modules', 'electron', 'package.json'),
)
const builderCli = path.join(
  root,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js',
)
const builderEntry = process.env.AGENTHUB_ELECTRON_ASCII_ORIGINAL_ROOT
  ? path.join(root, 'scripts', 'electron-builder-nsis-wrapper.mjs')
  : builderCli

resetDir(stageDir, 'Electron staging directory')
if (process.env.AGENTHUB_RELEASE_DIR) {
  resetDir(releaseDir, 'Electron release directory')
}

copyDir(path.join(root, 'dist-electron'), path.join(stageDir, 'dist-electron'), 'dist-electron')
fs.mkdirSync(path.join(stageDir, '.next'), { recursive: true })
copyDir(
  path.join(root, '.next', 'standalone'),
  path.join(stageDir, '.next', 'standalone'),
  'Next standalone output',
)

const buildConfig = {
  appId: rootPkg.build?.appId ?? 'com.agenthub.app',
  productName: rootPkg.build?.productName ?? 'AgentHub',
  electronVersion: electronPkg.version,
  compression: process.env.AGENTHUB_ELECTRON_COMPRESSION ?? rootPkg.build?.compression ?? 'store',
  directories: {
    output: releaseDir,
    buildResources: path.join(root, 'build'),
  },
  asar: true,
  asarUnpack: ['.next/standalone/**'],
  files: ['dist-electron/**', '.next/standalone/**', 'package.json'],
  npmRebuild: false,
  win: rootPkg.build?.win ?? {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: rootPkg.build?.nsis ?? {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
}

const stagePkg = {
  name: 'agenthub-desktop',
  version: rootPkg.version,
  description: rootPkg.description,
  author: rootPkg.author,
  license: rootPkg.license,
  packageManager: 'npm@10.9.2',
  main: rootPkg.main,
  dependencies: {},
  devDependencies: {},
  build: buildConfig,
}

fs.writeFileSync(
  path.join(stageDir, 'package.json'),
  JSON.stringify(stagePkg, null, 2) + '\n',
)

if (!fs.existsSync(builderEntry)) {
  throw new Error(`electron-builder entry not found: ${builderEntry}`)
}

const result = spawnSync(process.execPath, buildElectronBuilderNodeArgs(builderEntry, stageDir), {
  cwd: root,
  env: {
    ...process.env,
    USE_HARD_LINKS: 'false',
  },
  stdio: 'inherit',
})

if (result.error) {
  throw result.error
}
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

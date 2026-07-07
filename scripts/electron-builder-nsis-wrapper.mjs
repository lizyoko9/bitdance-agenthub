import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

function isPathInsideRoot(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target))

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function toBridgePath(originalRoot, bridgeRoot, target) {
  if (!isPathInsideRoot(originalRoot, target)) return null

  return path.join(path.resolve(bridgeRoot), path.relative(path.resolve(originalRoot), path.resolve(target)))
}

const requireFromWrapper = createRequire(import.meta.url)
const originalRoot = process.env.AGENTHUB_ELECTRON_ASCII_ORIGINAL_ROOT
const bridgeRoot = process.env.AGENTHUB_ELECTRON_ASCII_BRIDGE_ROOT

if (originalRoot && bridgeRoot) {
  const electronBuilderRoot = path.dirname(requireFromWrapper.resolve('electron-builder/package.json'))
  const pathManagerPath = requireFromWrapper.resolve('app-builder-lib/out/util/pathManager', {
    paths: [electronBuilderRoot],
  })
  const pathManagerModule = await import(pathToFileURL(pathManagerPath).href)
  const pathManager = pathManagerModule.default ?? pathManagerModule
  const appBuilderRoot = path.resolve(path.dirname(pathManagerPath), '..', '..')
  const bridgedAppBuilderRoot = toBridgePath(originalRoot, bridgeRoot, appBuilderRoot)

  if (bridgedAppBuilderRoot) {
    pathManager.getTemplatePath = (file) => path.join(bridgedAppBuilderRoot, 'templates', file)
  }
}

await import('electron-builder/out/cli/cli.js')

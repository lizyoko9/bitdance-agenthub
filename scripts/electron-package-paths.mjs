import path from 'node:path'

export function isPathInsideRoot(root, target) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  const relative = path.relative(resolvedRoot, resolvedTarget)

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function pathContainsNonAscii(value) {
  return /[^\x00-\x7F]/.test(value)
}

export function selectAvailableBridgeDrive(usedDrives) {
  const candidates = ['Z:', 'Y:', 'X:', 'W:', 'V:', 'U:', 'T:', 'S:', 'R:', 'Q:', 'P:']

  return candidates.find((drive) => !usedDrives.has(drive)) ?? null
}

export function buildPackageBridgeNodeArgs(scriptPath) {
  return [scriptPath]
}

export function buildElectronBuilderNodeArgs(builderCli, projectDir) {
  return [builderCli, '--projectDir', projectDir]
}

export function toBridgePath(originalRoot, bridgeRoot, target) {
  if (!isPathInsideRoot(originalRoot, target)) return null

  return path.join(path.resolve(bridgeRoot), path.relative(path.resolve(originalRoot), path.resolve(target)))
}

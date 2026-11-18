import { createHash } from 'node:crypto'
import { constants, type BigIntStats } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import path from 'node:path'

import type { WorkspaceRow } from '@/db/schema'
import {
  MAX_DELIVERY_FILE_BYTES,
  MAX_DELIVERY_INPUTS,
  MAX_DELIVERY_SNAPSHOT_BYTES,
  type DeliverySnapshot,
  type DeliveryValidationInput,
} from '@/server/delivery-validation-engine'
import { assertPathWithinWorkspace, getEffectiveCwd } from '@/server/workspace-utils'

const aliasPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const invalidPathCharacters = /[<>:"|?*\x00-\x1f]/
const windowsDeviceName = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i

class UnsafeSnapshot extends Error {}

type Probe = {
  nodes: { path: string; stats: BigIntStats }[]
  missing?: string
}

type Capture = {
  snapshot: DeliverySnapshot
  bytes: number
  probe?: Probe
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function unavailable(reason: string): Capture {
  return { snapshot: { status: 'unavailable', reason }, bytes: 0 }
}

function pathSegments(relative: string): string[] {
  if (relative.length > 1024 || invalidPathCharacters.test(relative) || path.isAbsolute(relative) ||
      path.win32.isAbsolute(relative)) throw new UnsafeSnapshot('Input must be a safe workspace-relative path')
  const segments = relative.split(/[\\/]/)
  if (segments.length > 64 || segments.some(segment =>
    !segment || segment === '.' || segment === '..' || /[. ]$/.test(segment) || windowsDeviceName.test(segment))) {
    throw new UnsafeSnapshot('Input must contain safe file path segments')
  }
  return segments
}

function sameIdentity(a: BigIntStats, b: BigIntStats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.mode === b.mode
}

function sameFile(a: BigIntStats, b: BigIntStats): boolean {
  return sameIdentity(a, b) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs && a.nlink === b.nlink
}

function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

async function readTree(root: string, parts: string[]): Promise<Probe> {
  const nodes: Probe['nodes'] = []
  let target = root
  for (let index = 0; index < parts.length; index++) {
    target = path.join(target, parts[index])
    let stats
    try {
      stats = await lstat(target, { bigint: true })
    } catch (error) {
      if (isMissing(error)) return { nodes, missing: target }
      throw error
    }
    if (stats.isSymbolicLink()) throw new UnsafeSnapshot('Symbolic links are unavailable for validation')
    const isFile = index === parts.length - 1
    if (isFile ? !stats.isFile() : !stats.isDirectory()) {
      throw new UnsafeSnapshot(isFile ? 'Input is not a regular file' : 'Input parent is not a directory')
    }
    nodes.push({ path: target, stats })
  }
  return { nodes }
}

async function verifyTree(probe: Probe) {
  for (const node of probe.nodes) {
    const stats = await lstat(node.path, { bigint: true })
    const consistent = node.stats.isFile() ? sameFile(node.stats, stats) : sameIdentity(node.stats, stats)
    if (!consistent) throw new UnsafeSnapshot('Input changed while files were being captured')
  }
  if (probe.missing) {
    try { await lstat(probe.missing) } catch (error) {
      if (isMissing(error)) return
      throw error
    }
    throw new UnsafeSnapshot('Input appeared while files were being captured')
  }
  const final = probe.nodes.at(-1)
  if (final && !samePath(await realpath(final.path), final.path)) {
    throw new UnsafeSnapshot('Input resolved outside its physical path')
  }
}

async function captureFile(
  root: string,
  parts: string[],
  totalRemaining: number,
  signal?: AbortSignal,
): Promise<Capture> {
  const probe = await readTree(root, parts)
  if (probe.missing) return {
    snapshot: { status: 'missing', reason: 'Declared input does not exist' }, bytes: 0, probe,
  }
  const leaf = probe.nodes.at(-1)
  if (!leaf) throw new UnsafeSnapshot('Input is not a regular file')
  if (leaf.stats.nlink !== BigInt(1)) return unavailable('Input is a multiply linked file')
  if (leaf.stats.size > MAX_DELIVERY_FILE_BYTES) return unavailable('Input exceeds the file size limit')
  if (leaf.stats.size > totalRemaining) return unavailable('Input exceeds the remaining snapshot size limit')

  await verifyTree(probe)
  signal?.throwIfAborted()
  const handle = await open(leaf.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    const before = await handle.stat({ bigint: true })
    if (!before.isFile() || !sameFile(leaf.stats, before)) throw new UnsafeSnapshot('Input changed before it could be read')
    await verifyTree(probe)
    const cap = Math.min(MAX_DELIVERY_FILE_BYTES, totalRemaining)
    const buffer = Buffer.allocUnsafe(Math.min(cap, Number(before.size)) + 1)
    let offset = 0
    while (offset < buffer.length) {
      signal?.throwIfAborted()
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset)
      if (bytesRead === 0) break
      offset += bytesRead
    }
    const after = await handle.stat({ bigint: true })
    if (offset !== Number(before.size) || !sameFile(before, after)) {
      throw new UnsafeSnapshot('Input changed while it was being read')
    }
    await verifyTree(probe)
    const bytes = buffer.subarray(0, offset)
    let text
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch {
      throw new UnsafeSnapshot('Input is not complete UTF-8 text')
    }
    return {
      snapshot: { status: 'ready', text, sha256: createHash('sha256').update(bytes).digest('hex') },
      bytes: offset, probe,
    }
  } finally {
    await handle.close()
  }
}

export async function captureDeliverySnapshots(
  workspace: WorkspaceRow,
  inputs: readonly DeliveryValidationInput[],
  signal?: AbortSignal,
): Promise<Record<string, DeliverySnapshot>> {
  if (inputs.length > MAX_DELIVERY_INPUTS || new Set(inputs.map(input => input.alias)).size !== inputs.length ||
      inputs.some(input => !aliasPattern.test(input.alias))) throw new Error('Validation inputs exceed their scope or bounds')
  signal?.throwIfAborted()
  const root = path.resolve(getEffectiveCwd(workspace))
  const captures: Record<string, Capture> = Object.create(null)
  let physicalRoot: string
  let rootStats: BigIntStats
  try {
    rootStats = await lstat(root, { bigint: true })
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw new UnsafeSnapshot('Workspace root is not an eligible directory')
    physicalRoot = await realpath(root)
  } catch (error) {
    const reason = error instanceof UnsafeSnapshot ? error.message : 'Workspace root is unavailable'
    return Object.fromEntries(inputs.map(input => [input.alias, unavailable(reason).snapshot]))
  }
  const verifyRoot = async () => {
    if (!sameIdentity(rootStats, await lstat(root, { bigint: true })) || !samePath(await realpath(root), physicalRoot)) {
      throw new UnsafeSnapshot('Workspace root changed while files were being captured')
    }
  }
  let remaining = MAX_DELIVERY_SNAPSHOT_BYTES
  for (const input of inputs) {
    signal?.throwIfAborted()
    try {
      const parts = pathSegments(input.path)
      assertPathWithinWorkspace(workspace, parts.join(path.sep))
      await verifyRoot()
      const capture = await captureFile(physicalRoot, parts, remaining, signal)
      captures[input.alias] = capture
      remaining -= capture.bytes
    } catch (error) {
      signal?.throwIfAborted()
      captures[input.alias] = unavailable(error instanceof UnsafeSnapshot ? error.message : 'Input could not be read safely')
    }
  }
  for (const input of inputs) {
    signal?.throwIfAborted()
    const capture = captures[input.alias]
    if (!capture.probe) continue
    try {
      await verifyRoot()
      await verifyTree(capture.probe)
    } catch (error) {
      captures[input.alias] = unavailable(error instanceof UnsafeSnapshot ? error.message : 'Input became unavailable during capture')
    }
  }
  return Object.fromEntries(inputs.map(input => [input.alias, captures[input.alias].snapshot]))
}

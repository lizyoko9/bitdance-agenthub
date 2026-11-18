import { createHash } from 'node:crypto'
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { WorkspaceRow } from '@/db/schema'
import { MAX_DELIVERY_FILE_BYTES, type DeliveryValidationInput } from './delivery-validation-engine'
import { captureDeliverySnapshots } from './delivery-validation-snapshot'

let fixture: string
let workspace: WorkspaceRow

const input = (alias: string, relative: string): DeliveryValidationInput => ({ alias, path: relative, format: 'text' })

beforeEach(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), 'agenthub-validation-'))
  const rootPath = path.join(fixture, 'workspace')
  await mkdir(path.join(rootPath, 'output'), { recursive: true })
  workspace = { id: 'workspace', conversationId: 'conv', mode: 'sandbox', rootPath, boundPath: null, createdAt: 0 }
})

afterEach(async () => {
  await rm(fixture, { recursive: true, force: true })
})

describe('workspace delivery snapshots', () => {
  it('captures exact bytes and refreshes the digest after an edit', async () => {
    const relative = 'output/report.md'
    const target = path.join(workspace.rootPath, relative)
    const first = Buffer.from('# Summary 你好\r\n')
    await writeFile(target, first)
    const job = input('report', relative)
    const old = await captureDeliverySnapshots(workspace, [job])
    expect(old.report).toEqual({
      status: 'ready', text: first.toString('utf8'), sha256: createHash('sha256').update(first).digest('hex'),
    })
    await writeFile(target, '# Revised 你好\r\n')
    const next = await captureDeliverySnapshots(workspace, [job])
    expect(next.report.status).toBe('ready')
    expect(next.report).not.toEqual(old.report)
  })

  it('separates missing, path escape, oversized, nonfiles and invalid UTF-8 inputs', async () => {
    const put = (name: string, data: string | Buffer) => writeFile(path.join(workspace.rootPath, name), data)
    await put('large.txt', Buffer.alloc(MAX_DELIVERY_FILE_BYTES + 1, 65))
    await put('bad.txt', Buffer.from([0x61, 0xc3]))
    await writeFile(path.join(fixture, 'outside.txt'), 'outside the workspace')
    const snapshots = await captureDeliverySnapshots(workspace, [
      input('missing', 'absent.txt'), input('escape', '../outside.txt'), input('large', 'large.txt'),
      input('bad', 'bad.txt'), input('directory', 'output'), input('drive', 'C:\\outside.txt'),
    ])
    expect(snapshots.missing.status).toBe('missing')
    for (const alias of ['escape', 'large', 'bad', 'directory', 'drive']) expect(snapshots[alias].status).toBe('unavailable')
  })

  it.skipIf(process.platform === 'win32')('rejects symlinks used as the leaf or as an intermediate directory', async () => {
    const outside = path.join(fixture, 'neighbor')
    await mkdir(outside)
    await writeFile(path.join(outside, 'file.txt'), 'neighbor')
    await symlink(path.join(outside, 'file.txt'), path.join(workspace.rootPath, 'file-link.txt'))
    await symlink(outside, path.join(workspace.rootPath, 'dir-link'))
    const snapshots = await captureDeliverySnapshots(workspace, [
      input('linkedLeaf', 'file-link.txt'), input('linkedDir', 'dir-link/file.txt'),
    ])
    expect(snapshots.linkedLeaf).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('Symbolic links') })
    expect(snapshots.linkedDir).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('Symbolic links') })
  })

  it('rejects an input hard link to a different workspace', async () => {
    const external = path.join(fixture, 'outside.txt')
    await writeFile(external, 'outside bytes')
    await link(external, path.join(workspace.rootPath, 'linked.txt'))
    const snapshots = await captureDeliverySnapshots(workspace, [input('linked', 'linked.txt')])
    expect(snapshots.linked).toEqual({ status: 'unavailable', reason: 'Input is a multiply linked file' })
  })

  it('bounds aggregate bytes and keeps the final oversized file unverified instead of truncating it', async () => {
    const files = Array.from({ length: 5 }, (_, index) => input(`file${index}`, `file${index}.txt`))
    for (const file of files) await writeFile(path.join(workspace.rootPath, file.path), Buffer.alloc(MAX_DELIVERY_FILE_BYTES, 65))
    const snapshots = await captureDeliverySnapshots(workspace, files)
    for (const file of files.slice(0, 4)) expect(snapshots[file.alias]).toMatchObject({ status: 'ready' })
    expect(snapshots.file4).toEqual({ status: 'unavailable', reason: 'Input exceeds the remaining snapshot size limit' })
  })

  it('propagates cancellation instead of returning a checkable snapshot', async () => {
    const signal = AbortSignal.abort()
    await expect(captureDeliverySnapshots(workspace, [input('report', 'output/report.md')], signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

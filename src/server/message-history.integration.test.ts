import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MessageHistoryPage } from '@/shared/message-history'

let directory: string
let client: typeof import('@/db/client')
let route: typeof import('@/app/api/conversations/[id]/messages/history/route')
const id = (index: number) => `msg_${String(index).padStart(3, '0')}`
const rows = Array.from({ length: 125 }, (_, index) => ({
  id: id(index), conversationId: 'conv_history', role: index === 0 ? 'agent' as const : 'user' as const,
  parts: [{ type: 'text' as const, content: 'text '.repeat(300) }], status: 'complete' as const, createdAt: 12,
  ...(index === 0 ? { runId: 'run_historical', usage: { inputTokens: 108, outputTokens: 12, cacheReadTokens: 8 } } : {}),
})).reverse()

beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'agenthub-message-history-'))
  vi.stubEnv('AGENTHUB_DATA_DIR', directory)
  ;[client, route] = await Promise.all([import('@/db/client'), import('@/app/api/conversations/[id]/messages/history/route')])
  const { db, schema } = client
  db.insert(schema.conversations).values([
    { id: 'conv_history', title: 'History', mode: 'single', agentIds: [], createdAt: 12, updatedAt: 12,
      pinnedMessageIds: [id(0), 'other_msg'] },
    { id: 'conv_other', title: 'Other', mode: 'single', agentIds: [], createdAt: 12, updatedAt: 12 },
  ]).run()
  for (const row of rows) db.insert(schema.messages).values(row).run()
  db.insert(schema.messages).values({ ...rows[0], id: 'other_msg', conversationId: 'conv_other' }).run()
})

afterAll(() => {
  client?.sqlite.close()
  delete (globalThis as { sqlite?: unknown }).sqlite
  vi.unstubAllEnvs()
  if (directory) rmSync(directory, { recursive: true, force: true })
})

function request(params?: Record<string, string>) {
  const query = new URLSearchParams(params)
  return route.GET(new NextRequest(`http://localhost/api/conversations/conv_history/messages/history?${query}`),
    { params: Promise.resolve({ id: 'conv_history' }) })
}

async function page(params?: Record<string, string>): Promise<MessageHistoryPage> {
  const response = await request(params)
  expect(response.status).toBe(200)
  return response.json()
}

describe('GET message history', () => {
  it('traverses equal timestamps in both directions and carries actual latest author IDs', async () => {
    const latest = await page()
    const older = await page({ before: latest.olderCursor! })
    const oldest = await page({ before: older.olderCursor! })
    expect([...oldest.messages, ...older.messages, ...latest.messages].map(row => row.id)).toEqual(
      Array.from({ length: 125 }, (_, index) => id(index)),
    )
    expect(latest.newerCursor).toBeNull()
    expect(oldest.olderCursor).toBeNull()
    const again = await page({ after: oldest.newerCursor! })
    expect(again.messages.map(row => row.id)).toEqual(older.messages.map(row => row.id))
    expect(older.latestUserMessageId).toBe(id(124))
    expect(older.latestAgentMessageId).toBe(id(0))
    expect(older.eventId).toMatch(/-.+$/)
    expect(older.usageTotals).toBeUndefined()
    expect(latest.usageTotals).toMatchObject({ inputTokens: 116, outputTokens: 12,
      cacheReadTokens: 8, totalTokens: 128, runCount: 1 })
  })

  it('selects a bounded window around an old or boundary target and projects scoped references', async () => {
    const first = await page({ around: id(0) })
    expect(first.messages).toHaveLength(50)
    expect(first.messages[0]?.id).toBe(id(0))
    const center = await page({ around: id(54) })
    expect(center.messages.map(row => row.id)).toContain(id(54))
    expect(center.olderCursor).toBeTruthy()
    expect(center.newerCursor).toBeTruthy()
    expect(center.references?.map(row => row.id)).toEqual([id(0)])
    expect(center.references?.[0]?.parts[0]).toMatchObject({ content: 'text '.repeat(32) })
    expect((await request({ around: 'other_msg' })).status).toBe(404)
    expect((await request({ before: 'invalid' })).status).toBe(400)
    expect((await request({ before: 'one', after: 'two' })).status).toBe(400)
  })
})

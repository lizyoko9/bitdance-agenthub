import { and, asc, desc, eq, gt, inArray, isNotNull, lt, or, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { db, schema } from '@/db/client'
import type { MessageRow } from '@/db/schema'
import {
  encodeMessageHistoryCursor, messageHistoryReference, type ConversationUsageTotal, type MessageHistoryPage,
} from '@/shared/message-history'
import { getPromptTokenTotal, getTokenTotal } from '@/shared/token-usage'

import { eventBus } from './event-bus'
import { flushAllMessageParts } from './message-parts-flusher'

const PAGE_SIZE = 50
const MAX_REFERENCES = 100
const table = schema.messages
const cursorSchema = z.tuple([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.string().min(1).max(128)])

export const messageHistoryQuerySchema = z.object({
  before: z.string().max(256).optional(),
  after: z.string().max(256).optional(),
  around: z.string().min(1).max(128).optional(),
}).refine((query) => Object.values(query).filter(value => value !== undefined).length <= 1)

type HistoryQuery = z.infer<typeof messageHistoryQuerySchema>
type Cursor = z.infer<typeof cursorSchema>

export class InvalidMessageHistoryCursor extends Error {}

function decodeCursor(cursor: string): Cursor {
  try {
    return cursorSchema.parse(JSON.parse(cursor))
  } catch {
    throw new InvalidMessageHistoryCursor('Invalid message history cursor')
  }
}

function before([createdAt, id]: Cursor): SQL | undefined {
  return or(lt(table.createdAt, createdAt), and(eq(table.createdAt, createdAt), lt(table.id, id)))
}

function after([createdAt, id]: Cursor): SQL | undefined {
  return or(gt(table.createdAt, createdAt), and(eq(table.createdAt, createdAt), gt(table.id, id)))
}

export function listMessageHistory(conversationId: string, query: HistoryQuery): MessageHistoryPage | null {
  const scope = eq(table.conversationId, conversationId)
  const previous = query.before !== undefined ? before(decodeCursor(query.before)) : undefined
  const next = query.after !== undefined ? after(decodeCursor(query.after)) : undefined
  const eventId = eventBus.lastEventId()
  flushAllMessageParts()
  const selectWindow = (direction: 'before' | 'after', limit: number, where?: SQL): MessageRow[] => {
    if (limit === 0) return []
    const order = direction === 'before' ? desc : asc
    const rows = db.select().from(table).where(and(scope, where))
      .orderBy(order(table.createdAt), order(table.id)).limit(limit).all()
    return direction === 'before' ? rows.reverse() : rows
  }

  let messages: MessageRow[]
  if (query.around !== undefined) {
    const target = db.select().from(table).where(and(scope, eq(table.id, query.around))).get()
    if (!target) return null
    const position: Cursor = [target.createdAt, target.id]
    let older = selectWindow('before', Math.floor(PAGE_SIZE / 2), before(position))
    const newer = selectWindow('after', PAGE_SIZE - 1 - older.length, after(position))
    if (older.length + newer.length < PAGE_SIZE - 1) {
      older = selectWindow('before', PAGE_SIZE - 1 - newer.length, before(position))
    }
    messages = [...older, target, ...newer]
  } else {
    messages = next ? selectWindow('after', PAGE_SIZE, next) : selectWindow('before', PAGE_SIZE, previous)
  }

  const first = messages[0]
  const last = messages[messages.length - 1]
  const contains = (where: SQL | undefined) => Boolean(db.select({ id: table.id }).from(table)
    .where(and(scope, where)).limit(1).get())
  const latest = (role: 'user' | 'agent') => db.select({ id: table.id }).from(table)
    .where(and(scope, eq(table.role, role))).orderBy(desc(table.createdAt), desc(table.id)).limit(1).get()?.id ?? null

  const conversation = db.select({
    pinned: schema.conversations.pinnedMessageIds,
    bookmarked: schema.conversations.bookmarkedMessageIds,
  }).from(schema.conversations).where(eq(schema.conversations.id, conversationId)).get()
  const referenceIds = [...new Set([
    ...(conversation?.pinned ?? []), ...messages.flatMap(({ parentMessageId }) => parentMessageId ? [parentMessageId] : []),
    ...(conversation?.bookmarked ?? []),
  ])].slice(0, MAX_REFERENCES)
  const references = referenceIds.length > 0
    ? db.select().from(table).where(and(scope, inArray(table.id, referenceIds))).all().map(messageHistoryReference)
    : []
  return {
    messages, eventId, references,
    olderCursor: first && contains(before([first.createdAt, first.id])) ? encodeMessageHistoryCursor(first) : null,
    newerCursor: last && contains(after([last.createdAt, last.id])) ? encodeMessageHistoryCursor(last) : null,
    latestUserMessageId: latest('user'),
    latestAgentMessageId: latest('agent'),
    ...(!previous && !next ? { usageTotals: listMessageUsage(scope) } : {}),
  }
}

function listMessageUsage(scope: SQL): ConversationUsageTotal {
  const result: ConversationUsageTotal = {
    inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0,
    lastInputTokens: 0, byAgent: {}, byModel: {}, runCount: 0,
  }
  const runs = new Set<string>()
  let first = true
  const usageRows = db.select({
    usage: table.usage, runId: table.runId, agentId: table.agentId, modelId: schema.agents.modelId,
  }).from(table).leftJoin(schema.agents, eq(table.agentId, schema.agents.id))
    .where(and(scope, eq(table.role, 'agent'), isNotNull(table.usage)))
    .orderBy(desc(table.createdAt), desc(table.id))
    .all()
  for (const { usage, runId, agentId, modelId } of usageRows) {
    if (!usage) continue
    const prompt = getPromptTokenTotal(usage)
    if (first) {
      result.lastInputTokens = prompt
      first = false
    }
    result.inputTokens += prompt
    result.outputTokens += usage.outputTokens
    result.cacheReadTokens += usage.cacheReadTokens
    if (runId) runs.add(runId)
    const total = getTokenTotal(usage)
    if (agentId) result.byAgent[agentId] = (result.byAgent[agentId] ?? 0) + total
    if (modelId) result.byModel[modelId] = (result.byModel[modelId] ?? 0) + total
  }
  result.totalTokens = result.inputTokens + result.outputTokens
  result.runCount = runs.size
  return result
}

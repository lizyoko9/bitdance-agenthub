import type { MessageRow } from '@/db/schema'

export interface ConversationUsageTotal {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  lastInputTokens: number
  byAgent: Record<string, number>
  byModel: Record<string, number>
  runCount: number
}

export interface MessageHistoryPage {
  messages: MessageRow[]
  eventId: string
  olderCursor: string | null
  newerCursor: string | null
  latestUserMessageId: string | null
  latestAgentMessageId: string | null
  references?: MessageRow[]
  usageTotals?: ConversationUsageTotal
}

type MessagePosition = Pick<MessageRow, 'createdAt' | 'id'>

export function encodeMessageHistoryCursor({ createdAt, id }: MessagePosition): string {
  return JSON.stringify([createdAt, id])
}

export function compareMessageHistoryPositions(a: MessagePosition, b: MessagePosition): number {
  return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id === b.id ? 0 : 1)
}

export function messageHistoryReference(message: MessageRow): MessageRow {
  const text = message.parts.find(part => part.type === 'text' && part.content)
  const part = text?.type === 'text' ? text : message.parts[0]
  const preview = part?.type === 'text' || part?.type === 'thinking' || part?.type === 'code'
    ? { ...part, content: part.content.slice(0, 160) }
    : { type: 'text' as const, content: part?.type === 'tool_use'
      ? `[调用 ${part.toolName}]` : part?.type === 'artifact_ref' ? '[产物引用]' : '' }
  return { ...message, parts: [preview] }
}

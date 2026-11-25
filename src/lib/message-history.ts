import type { MessageHistoryPage } from '@/shared/message-history'

export async function fetchMessageHistory(
  conversationId: string,
  { before, after, around, signal }: { before?: string; after?: string; around?: string; signal?: AbortSignal } = {},
): Promise<MessageHistoryPage> {
  const params = new URLSearchParams()
  if (before !== undefined) params.set('before', before)
  if (after !== undefined) params.set('after', after)
  if (around !== undefined) params.set('around', around)
  const query = params.size ? `?${params}` : ''
  const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages/history${query}`, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Message history request failed (HTTP ${response.status})`)
  return response.json() as Promise<MessageHistoryPage>
}

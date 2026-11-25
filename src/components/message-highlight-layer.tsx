'use client'

import { useEffect } from 'react'

import { requestMessageJump } from '@/stores/message-jump-store'
import { useSearchStore } from '@/stores/search-store'
import { useAppStore } from '@/stores/app-store'

export function MessageHighlightLayer() {
  const highlightedId = useSearchStore((s) => s.highlightedMessageId)
  const setActive = useAppStore((s) => s.setActiveConversation)
  const pendingConv = useSearchStore((s) => s.pendingJumpConversationId)
  const consume = useSearchStore((s) => s.consumePendingJump)

  useEffect(() => {
    if (!pendingConv || !highlightedId) return
    setActive(pendingConv)
    requestMessageJump(pendingConv, highlightedId)
    consume()
  }, [highlightedId, pendingConv, setActive, consume])

  return null
}

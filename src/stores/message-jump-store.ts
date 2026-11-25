'use client'

import { create } from 'zustand'

import { useAppStore } from '@/stores/app-store'

export interface MessageJump {
  conversationId: string
  messageId: string
}

export const useMessageJumpStore = create<{ target: MessageJump | null }>(() => ({ target: null }))

export function requestMessageJump(conversationId: string, messageId: string): void {
  const app = useAppStore.getState()
  app.setActiveTab(conversationId, 'chat')
  useMessageJumpStore.setState({ target: { conversationId, messageId } })
}

export function finishMessageJump(target: MessageJump): void {
  if (useMessageJumpStore.getState().target === target) useMessageJumpStore.setState({ target: null })
}

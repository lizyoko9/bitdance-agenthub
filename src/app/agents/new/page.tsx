import type { Metadata } from 'next'

import { AgentStudio } from '@/components/agent-studio'

export const metadata: Metadata = {
  title: '创建 Agent - AgentHub',
}

export default function NewAgentPage() {
  return <AgentStudio />
}

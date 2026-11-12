import type { Metadata } from 'next'

import { SkillMarketplace } from '@/components/skill-marketplace'

export const metadata: Metadata = {
  title: 'Skills 市场 - AgentHub',
}

export default function SkillsPage() {
  return <SkillMarketplace />
}

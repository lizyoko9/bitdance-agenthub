import type { AgentProfileRow, SoftwareCommandRow, SoftwareProfileRow } from '@/db/schema'
import type {
  SoftwareCapabilityCard,
  StoreCapabilityMode,
  StoreSoftwareCategory,
} from '@/lib/software-capability-store'

export type CapabilityStoreActionState = 'idle' | 'loading'

export interface SoftwareSelectionProps {
  selectedCard: SoftwareCapabilityCard | null
  onSelectCard: (card: SoftwareCapabilityCard) => void
}

export interface SoftwareStoreOverviewProps extends SoftwareSelectionProps {
  cards: SoftwareCapabilityCard[]
  categories: StoreSoftwareCategory[]
  search: string
  category: StoreSoftwareCategory | '全部'
  onSearchChange: (value: string) => void
  onCategoryChange: (value: StoreSoftwareCategory | '全部') => void
}

export interface SoftwareModePanelProps {
  card: SoftwareCapabilityCard
  commands: SoftwareCommandRow[]
  actionState: CapabilityStoreActionState
  onTestCommand: (commandId: string) => void
  onRunCommand: (commandId: string) => void
}

export interface SoftwareAgentAssignmentProps {
  card: SoftwareCapabilityCard
  agents: AgentProfileRow[]
  actionState: CapabilityStoreActionState
  onToggleAgent: (agentId: string, softwareProfileId: string) => void
}

export interface SoftwareAdvancedConfigProps {
  selectedCard: SoftwareCapabilityCard | null
  softwareProfiles: SoftwareProfileRow[]
  actionState: CapabilityStoreActionState
  onCreateSoftwareProfile: (draft: {
    name: string
    appType: SoftwareProfileRow['appType']
    adapterType: SoftwareProfileRow['adapterType']
    launchCommand?: string
    executablePath?: string
  }) => void
  onCreateCommand: (
    softwareProfileId: string,
    draft: {
      name: string
      description: string
      implementationText: string
      riskLevel: 'low' | 'medium' | 'high'
      requiresApproval: boolean
    },
  ) => void
}

export function modeTone(mode: StoreCapabilityMode): string {
  if (mode.status === '已接入') {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }
  if (mode.status === '异常') {
    return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
  }
  return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
}

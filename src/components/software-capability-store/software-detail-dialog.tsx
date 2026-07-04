'use client'

import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AgentProfileRow, SoftwareCommandRow, SoftwareProfileRow } from '@/db/schema'
import type { SoftwareCapabilityCard } from '@/lib/software-capability-store'

import { SoftwareAdvancedConfig } from './software-advanced-config'
import { SoftwareAgentAssignment } from './software-agent-assignment'
import { SoftwareModePanel } from './software-mode-panel'
import type { CapabilityStoreActionState } from './types'

export interface SoftwareDetailDialogProps {
  open: boolean
  card: SoftwareCapabilityCard | null
  agents: AgentProfileRow[]
  softwareProfiles: SoftwareProfileRow[]
  commands: SoftwareCommandRow[]
  actionState: CapabilityStoreActionState
  onOpenChange: (open: boolean) => void
  onTestCommand: (commandId: string) => void
  onRunCommand: (commandId: string) => void
  onToggleAgent: (agentId: string, softwareProfileId: string) => void
  onCreateSoftwareProfile: ComponentProps<typeof SoftwareAdvancedConfig>['onCreateSoftwareProfile']
  onCreateCommand: ComponentProps<typeof SoftwareAdvancedConfig>['onCreateCommand']
}

export function SoftwareDetailDialog({
  open,
  card,
  agents,
  softwareProfiles,
  commands,
  actionState,
  onOpenChange,
  onTestCommand,
  onRunCommand,
  onToggleAgent,
  onCreateSoftwareProfile,
  onCreateCommand,
}: SoftwareDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-4xl overflow-y-auto" data-testid="software-detail-dialog">
        {card ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <DialogTitle>{card.name}</DialogTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => onOpenChange(false)}
                >
                  返回软件商店
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{card.category}</Badge>
                <Badge variant={card.connectionStatus === '已接入' ? 'default' : 'outline'}>
                  {card.connectionStatus}
                </Badge>
                <Badge variant="secondary">默认：{card.defaultMode}</Badge>
                <Badge variant="outline">全部免费</Badge>
              </div>
            </DialogHeader>
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <SoftwareModePanel
                  card={card}
                  commands={commands}
                  actionState={actionState}
                  onTestCommand={onTestCommand}
                  onRunCommand={onRunCommand}
                />
                <SoftwareAdvancedConfig
                  selectedCard={card}
                  softwareProfiles={softwareProfiles}
                  actionState={actionState}
                  onCreateSoftwareProfile={onCreateSoftwareProfile}
                  onCreateCommand={onCreateCommand}
                />
              </div>
              <SoftwareAgentAssignment
                card={card}
                agents={agents}
                actionState={actionState}
                onToggleAgent={onToggleAgent}
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

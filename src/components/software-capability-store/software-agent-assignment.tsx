'use client'

import { Bot, CheckCircle2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { SoftwareAgentAssignmentProps } from './types'

export function SoftwareAgentAssignment({
  card,
  agents,
  actionState,
  onToggleAgent,
}: SoftwareAgentAssignmentProps) {
  if (!card.softwareProfileId) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        这个软件还没有接入。接入后才能分配给智能体。
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold">分配给智能体</div>
        <p className="text-xs text-muted-foreground">勾选后，这个软件会进入该智能体的员工工具包。</p>
      </div>
      <div className="grid gap-2">
        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            暂无可分配智能体。
          </div>
        ) : (
          agents.map((agent) => {
            const assigned = agent.softwareProfileIds.includes(card.softwareProfileId!)
            return (
              <Button
                key={agent.id}
                type="button"
                variant={assigned ? 'default' : 'outline'}
                className="h-auto justify-between gap-3 p-3"
                disabled={actionState === 'loading'}
                onClick={() => onToggleAgent(agent.id, card.softwareProfileId!)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Bot className="size-4 shrink-0" />
                  <span className="truncate text-left">
                    <span className="block font-medium">{agent.name}</span>
                    <span className="block text-xs opacity-80">{agent.role}</span>
                  </span>
                </span>
                {assigned ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="size-3" />
                    已分配
                  </Badge>
                ) : (
                  <Badge variant="outline">未分配</Badge>
                )}
              </Button>
            )
          })
        )}
      </div>
    </div>
  )
}

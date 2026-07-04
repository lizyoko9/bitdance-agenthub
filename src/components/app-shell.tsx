'use client'

import { useCallback, useEffect, useState } from 'react'

import { Sidebar, type SidebarMode } from '@/components/sidebar'
import { subscribeUiCommand } from '@/lib/ui-command-events'
import { getAppModule, normalizeAppModuleId, renderAppModule } from '@/modules/app-modules'

export function AppShell() {
  const [mode, setMode] = useState<SidebarMode>('workbench')
  const [agentSettingsRequestKey, setAgentSettingsRequestKey] = useState(0)
  const [canvasWorkflowId, setCanvasWorkflowId] = useState<string | null>(null)

  const handleModeChange = useCallback((nextMode: SidebarMode) => {
    setMode(normalizeWorkspaceMode(nextMode))
  }, [])

  useEffect(() => {
    return subscribeUiCommand((command) => {
      if (command !== 'open-agent-settings') return
      setMode('agents')
      setAgentSettingsRequestKey((key) => key + 1)
    })
  }, [])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Sidebar mode={mode} onModeChange={handleModeChange} />
      <WorkspaceMain
        mode={mode}
        onModeChange={handleModeChange}
        agentSettingsRequestKey={agentSettingsRequestKey}
        canvasWorkflowId={canvasWorkflowId}
        onOpenWorkflow={(workflowId) => {
          setCanvasWorkflowId(workflowId)
          setMode('agent-canvas')
        }}
      />
    </div>
  )
}

function normalizeWorkspaceMode(mode: SidebarMode): SidebarMode {
  return normalizeAppModuleId(mode)
}

function WorkspaceMain({
  mode,
  onModeChange,
  agentSettingsRequestKey,
  canvasWorkflowId,
  onOpenWorkflow,
}: {
  mode: SidebarMode
  onModeChange: (mode: SidebarMode) => void
  agentSettingsRequestKey: number
  canvasWorkflowId: string | null
  onOpenWorkflow: (workflowId: string) => void
}) {
  const module = getAppModule(mode)
  const content = renderAppModule(mode, {
    onModeChange,
    agentSettingsRequestKey,
    canvasWorkflowId,
    onOpenWorkflow,
  })

  if (module.frame === 'bare') return content

  return (
    <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      {content}
    </main>
  )
}

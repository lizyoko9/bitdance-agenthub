'use client'

import { useCallback, useEffect, useState } from 'react'

import { AgentLibrary } from '@/components/agent-library'
import { AgentWorkflowCanvas } from '@/components/agent-workflow-canvas'
import { ArtifactLibrary } from '@/components/artifact-library'
import { ChatPanel } from '@/components/chat-panel'
import { ConfigOpsCenter } from '@/components/config-ops-center'
import { DesktopWorkbench } from '@/components/desktop-workbench'
import { ModelControlCenter } from '@/components/model-control-center'
import { ObservabilityCenter } from '@/components/observability-center'
import { ProductionIntegrationsCenter } from '@/components/production-integrations-center'
import { Sidebar, type SidebarMode } from '@/components/sidebar'
import { SkillsCenter } from '@/components/skills-center'
import { TaskSchedulerCenter } from '@/components/task-scheduler-center'
import { ToolControlCenter } from '@/components/tool-control-center'
import { UsageDashboard } from '@/components/usage-dashboard'
import { WorkflowLibrary } from '@/components/workflow-library'
import { subscribeUiCommand } from '@/lib/ui-command-events'

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
  if (
    [
      'employee-factory',
      'memory',
      'context',
      'capabilities',
      'collaboration',
      'governance',
    ].includes(mode)
  ) {
    return 'agents'
  }
  return mode
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
  if (mode === 'conversations') {
    return <ChatPanel />
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      {mode === 'workbench' ? (
        <DesktopWorkbench onModeChange={onModeChange} />
      ) : (
        renderWorkspace(mode, agentSettingsRequestKey, canvasWorkflowId, onOpenWorkflow)
      )}
    </main>
  )
}

function renderWorkspace(
  mode: SidebarMode,
  agentSettingsRequestKey: number,
  canvasWorkflowId: string | null,
  onOpenWorkflow: (workflowId: string) => void,
) {
  switch (mode) {
    case 'workbench':
      return null
    case 'artifacts':
      return <ArtifactLibrary />
    case 'agents':
      return (
        <AgentLibrary
          settingsRequestKey={agentSettingsRequestKey}
          focusCapabilitiesOnSettingsOpen={agentSettingsRequestKey > 0}
        />
      )
    case 'employee-factory':
      return <AgentLibrary defaultSettingsOpen />
    case 'workflows':
      return (
        <WorkflowLibrary
          onOpenWorkflow={onOpenWorkflow}
          onCreateWorkflow={() => {
            onOpenWorkflow('')
          }}
        />
      )
    case 'agent-canvas':
      return <AgentWorkflowCanvas initialWorkflowId={canvasWorkflowId ?? undefined} />
    case 'skills':
      return <SkillsCenter />
    case 'scheduler':
      return <TaskSchedulerCenter />
    case 'memory':
    case 'context':
    case 'capabilities':
    case 'collaboration':
    case 'governance':
      return <AgentLibrary defaultSettingsOpen />
    case 'models':
      return <ModelControlCenter />
    case 'tools':
      return <ToolControlCenter />
    case 'monitor':
      return <ObservabilityCenter />
    case 'configops':
      return <ConfigOpsCenter />
    case 'production':
      return <ProductionIntegrationsCenter />
    case 'analytics':
      return <UsageDashboard />
    case 'conversations':
      return <ChatPanel />
  }
}

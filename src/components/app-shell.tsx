'use client'

import { useCallback, useEffect, useState } from 'react'

import { Sidebar, type SidebarMode } from '@/components/sidebar'
import {
  APP_MODULE_PREFERENCES_STORAGE_KEY,
  addEnabledAppModuleId,
  parseStoredAppModulePreferences,
  removeEnabledAppModuleId,
  serializeAppModulePreferences,
} from '@/lib/app-module-preferences'
import { subscribeUiCommand } from '@/lib/ui-command-events'
import { getAppModule, normalizeAppModuleId, renderAppModule } from '@/modules/app-modules'

export function AppShell() {
  const [mode, setMode] = useState<SidebarMode>('workbench')
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[] | undefined>(undefined)
  const [modulePreferencesReady, setModulePreferencesReady] = useState(false)
  const [agentSettingsRequestKey, setAgentSettingsRequestKey] = useState(0)
  const [canvasWorkflowId, setCanvasWorkflowId] = useState<string | null>(null)

  const handleModeChange = useCallback((nextMode: SidebarMode) => {
    setMode(normalizeWorkspaceMode(nextMode))
  }, [])

  const handleEnableModule = useCallback((moduleId: SidebarMode) => {
    setEnabledModuleIds((currentModuleIds) => addEnabledAppModuleId(currentModuleIds, moduleId))
    setMode(normalizeWorkspaceMode(moduleId))
  }, [])

  const handleDisableModule = useCallback((moduleId: SidebarMode) => {
    setEnabledModuleIds((currentModuleIds) => removeEnabledAppModuleId(currentModuleIds, moduleId))
    setMode((currentMode) => (normalizeWorkspaceMode(moduleId) === currentMode ? 'workbench' : currentMode))
  }, [])

  useEffect(() => {
    const storedModuleIds = parseStoredAppModulePreferences(
      window.localStorage.getItem(APP_MODULE_PREFERENCES_STORAGE_KEY),
    )
    if (storedModuleIds) setEnabledModuleIds(storedModuleIds)
    setModulePreferencesReady(true)
  }, [])

  useEffect(() => {
    if (!modulePreferencesReady || !enabledModuleIds) return
    window.localStorage.setItem(
      APP_MODULE_PREFERENCES_STORAGE_KEY,
      serializeAppModulePreferences(enabledModuleIds),
    )
  }, [enabledModuleIds, modulePreferencesReady])

  useEffect(() => {
    return subscribeUiCommand((command) => {
      if (command !== 'open-agent-settings') return
      setMode('agents')
      setAgentSettingsRequestKey((key) => key + 1)
    })
  }, [])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Sidebar mode={mode} enabledModuleIds={enabledModuleIds} onModeChange={handleModeChange} />
      <WorkspaceMain
        mode={mode}
        onModeChange={handleModeChange}
        enabledModuleIds={enabledModuleIds}
        onEnableModule={handleEnableModule}
        onDisableModule={handleDisableModule}
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
  enabledModuleIds,
  onEnableModule,
  onDisableModule,
  agentSettingsRequestKey,
  canvasWorkflowId,
  onOpenWorkflow,
}: {
  mode: SidebarMode
  onModeChange: (mode: SidebarMode) => void
  enabledModuleIds?: string[]
  onEnableModule: (mode: SidebarMode) => void
  onDisableModule: (mode: SidebarMode) => void
  agentSettingsRequestKey: number
  canvasWorkflowId: string | null
  onOpenWorkflow: (workflowId: string) => void
}) {
  const appModule = getAppModule(mode)
  const content = renderAppModule(mode, {
    onModeChange,
    enabledModuleIds,
    onEnableModule,
    onDisableModule,
    agentSettingsRequestKey,
    canvasWorkflowId,
    onOpenWorkflow,
  })

  if (appModule.frame === 'bare') return content

  return (
    <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      {content}
    </main>
  )
}

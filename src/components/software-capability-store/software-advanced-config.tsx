'use client'

import { useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { SoftwareAdvancedConfigProps } from './types'

export function SoftwareAdvancedConfig({
  selectedCard,
  softwareProfiles,
  actionState,
  onCreateSoftwareProfile,
  onCreateCommand,
}: SoftwareAdvancedConfigProps) {
  const [open, setOpen] = useState(false)
  const [softwareName, setSoftwareName] = useState(selectedCard?.name ?? '')
  const [launchCommand, setLaunchCommand] = useState('')
  const [commandName, setCommandName] = useState('检测命令')
  const [commandTemplate, setCommandTemplate] = useState('echo ok')
  const [description, setDescription] = useState('低风险检测命令')

  useEffect(() => {
    setSoftwareName(selectedCard?.name ?? '')
  }, [selectedCard?.name])

  const selectedProfile = useMemo(
    () => softwareProfiles.find((profile) => profile.id === selectedCard?.softwareProfileId) ?? null,
    [selectedCard?.softwareProfileId, softwareProfiles],
  )

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2 font-semibold">
          <Settings2 className="size-4" />
          完整配置
        </span>
        <span className="text-xs text-muted-foreground">{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <div className="space-y-4 border-t p-3">
          <div className="space-y-2">
            <div className="text-sm font-medium">创建软件接入</div>
            <Input value={softwareName} onChange={(event) => setSoftwareName(event.target.value)} placeholder="软件名称" />
            <Input
              value={launchCommand}
              onChange={(event) => setLaunchCommand(event.target.value)}
              placeholder="CLI 或启动命令，例如 codex"
            />
            <Button
              type="button"
              disabled={actionState === 'loading' || !softwareName.trim()}
              onClick={() =>
                onCreateSoftwareProfile({
                  name: softwareName.trim(),
                  appType: 'cli_app',
                  adapterType: 'cli',
                  launchCommand: launchCommand.trim(),
                })
              }
            >
              创建 CLI 接入
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">创建封装命令</div>
            <Input value={commandName} onChange={(event) => setCommandName(event.target.value)} placeholder="命令名称" />
            <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="命令说明" />
            <Textarea value={commandTemplate} onChange={(event) => setCommandTemplate(event.target.value)} placeholder="commandTemplate" />
            <Button
              type="button"
              disabled={actionState === 'loading' || !selectedProfile || !commandName.trim()}
              onClick={() =>
                selectedProfile &&
                onCreateCommand(selectedProfile.id, {
                  name: commandName.trim(),
                  description: description.trim(),
                  implementationText: JSON.stringify({
                    type: 'cli',
                    commandTemplate,
                    testCommandTemplate: commandTemplate,
                  }),
                  riskLevel: 'low',
                  requiresApproval: false,
                })
              }
            >
              创建命令
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

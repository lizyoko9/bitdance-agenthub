'use client'

import { Play, RefreshCw, ShieldAlert, Terminal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { modeTone, type SoftwareModePanelProps } from './types'

export function SoftwareModePanel({
  card,
  commands,
  actionState,
  onTestCommand,
  onRunCommand,
}: SoftwareModePanelProps) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">接入方式</div>
        <p className="text-xs text-muted-foreground">
          这个软件当前可用的 CLI、MCP、API、浏览器、桌面或封装命令。
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {card.modes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            还没有接入方式。打开完整配置后可以创建 CLI、MCP 或软件命令。
          </div>
        ) : (
          card.modes.map((mode) => (
            <div key={mode.id} className={`rounded-lg border p-3 ${modeTone(mode)}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <Terminal className="size-4" />
                  {mode.label}
                </div>
                <Badge variant="outline">{mode.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{mode.kind}</Badge>
                {mode.riskLevel ? <Badge variant="outline">风险：{mode.riskLevel}</Badge> : null}
                {mode.requiresApproval ? (
                  <Badge variant="outline" className="gap-1">
                    <ShieldAlert className="size-3" />
                    需确认
                  </Badge>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold">可检测命令</div>
        {commands.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">暂无封装命令。</div>
        ) : (
          commands.map((command) => (
            <div key={command.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="font-medium">{command.name}</div>
                <div className="text-xs text-muted-foreground">{command.description || '没有描述'}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionState === 'loading'}
                  onClick={() => onTestCommand(command.id)}
                >
                  <RefreshCw className="size-3.5" />
                  检测
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={actionState === 'loading'}
                  onClick={() => onRunCommand(command.id)}
                >
                  <Play className="size-3.5" />
                  试运行
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

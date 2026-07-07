'use client'

import { Eye, Pencil, ShieldCheck, Sparkles, Wrench } from 'lucide-react'
import { useState } from 'react'

import { AgentAvatar } from '@/components/agent-avatar'
import { CreateAgentDialog } from '@/components/create-agent-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { AgentRow } from '@/db/schema'
import {
  localizeAgentHubDisplayText,
  localizeGeneratedAgentProfileName,
} from '@/lib/agenthub-display-text'
import { cn } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md' | 'lg'

/**
 * AgentInfoPopover —— 包一层 AgentAvatar，点击弹出 popover 显示 agent 资料。
 *
 * popover 内容：放大头像 + 名字 + 描述 + capabilities tags + 底层 model +
 * 各种 badge（内置 / 调度 / 视觉）+ 「编辑配置」按钮（打开 CreateAgentDialog）
 */
export function AgentInfoPopover({
  agent,
  size = 'md',
  className,
  avatarClassName,
}: {
  agent: AgentRow
  size?: Size
  className?: string
  avatarClassName?: string
}) {
  const [editOpen, setEditOpen] = useState(false)

  const providerLabel = providerName(agent.modelProvider)

  return (
    <>
      <Popover>
        <PopoverTrigger
          className={cn(
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            className,
          )}
          aria-label={`查看 ${localizeGeneratedAgentProfileName(agent.name)} 的资料`}
        >
          <AgentAvatar agent={agent} size={size} className={avatarClassName} />
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          {/* 头部：头像 + 名字 + 描述 */}
          <div className="flex items-start gap-3">
            <AgentAvatar agent={agent} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{localizeGeneratedAgentProfileName(agent.name)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {agent.isBuiltin && <Badge tone="muted">内置</Badge>}
                {agent.isOrchestrator && (
                  <Badge tone="primary">
                    <Sparkles className="size-2.5" />
                    调度
                  </Badge>
                )}
                {agent.supportsVision && (
                  <Badge tone="emerald">
                    <Eye className="size-2.5" />
                    视觉
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {agent.description && (
            <p className="text-xs leading-5 text-muted-foreground">
              {safeAgentDisplayText(agent.description, '')}
            </p>
          )}

          {/* 能力标签 */}
          {agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.map((c) => (
                <span
                  key={c}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* 底层 model */}
          <div className="space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3" />
              <span className="font-mono">
                {agent.adapterName}
                {agent.modelId ? ` · ${providerLabel ?? agent.modelProvider} / ${agent.modelId}` : ''}
              </span>
            </div>
            {(agent.skillIds.length > 0 || agent.mcpServerIds.length > 0 || agent.cliProfileIds.length > 0) && (
              <div className="flex items-start gap-1.5">
                <Wrench className="mt-0.5 size-3 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {agent.skillIds.length > 0 && <Badge tone="muted">Skills {agent.skillIds.length}</Badge>}
                  {agent.mcpServerIds.length > 0 && <Badge tone="muted">MCP {agent.mcpServerIds.length}</Badge>}
                  {agent.cliProfileIds.length > 0 && <Badge tone="muted">CLI {agent.cliProfileIds.length}</Badge>}
                </div>
              </div>
            )}
          </div>

          {/* 编辑入口 */}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs font-medium transition hover:border-foreground/30 hover:bg-accent"
          >
            <Pencil className="size-3" />
            编辑配置
          </button>
        </PopoverContent>
      </Popover>

      <CreateAgentDialog open={editOpen} onOpenChange={setEditOpen} agent={agent} />
    </>
  )
}

function safeAgentDisplayText(value: string | null | undefined, fallback: string) {
  const text = value?.trim() ?? ''
  if (!text) return fallback
  return localizeAgentHubDisplayText(text, fallback)
}

function Badge({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'primary' | 'emerald'
  children: React.ReactNode
}) {
  const toneClass = {
    muted: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  }[tone]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px]',
        toneClass,
      )}
    >
      {children}
    </span>
  )
}

function providerName(provider: string | null): string | null {
  if (!provider) return null
  if (provider === 'volcano-ark') return '火山方舟'
  if (provider === 'deepseek') return 'DeepSeek'
  if (provider === 'anthropic') return 'Anthropic'
  if (provider === 'openai') return 'OpenAI'
  if (provider === 'openai-compatible') return 'OpenAI-compatible'
  return provider
}

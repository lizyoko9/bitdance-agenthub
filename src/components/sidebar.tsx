'use client'

import {
  ChevronDown,
  ChevronRight,
  GitMerge,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AgentAvatar } from '@/components/agent-avatar'
import { GlobalSearchTrigger } from '@/components/global-search-trigger'
import { NewConversationDialog } from '@/components/new-conversation-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createConversation, fetchAgents, fetchConversations, fetchModelProfiles } from '@/lib/api'
import { subscribeUiCommand } from '@/lib/ui-command-events'
import { cn } from '@/lib/utils'
import {
  advancedAppModules,
  getAppModuleLabel,
  primaryAppModules,
  type AppModuleDefinition,
  type AppModuleId,
} from '@/modules/app-modules'
import type { AgentRow, ConversationRow } from '@/db/schema'
import { useAppStore, useConversationList, useUnreadCount } from '@/stores/app-store'

export type SidebarMode = AppModuleId

interface SidebarProps {
  mode: SidebarMode
  onModeChange: (mode: SidebarMode) => void
}

export function Sidebar({ mode, onModeChange }: SidebarProps) {
  const mobileOpen = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)
  const conversations = useConversationList()
  const activeId = useAppStore((s) => s.activeConversationId)
  const setActive = useAppStore((s) => s.setActiveConversation)
  const setConversations = useAppStore((s) => s.setConversations)
  const setAgents = useAppStore((s) => s.setAgents)
  const upsertConversation = useAppStore((s) => s.upsertConversation)
  const agents = useAppStore((s) => s.agents)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [search, setSearch] = useState('')
  const [creatingConversation, setCreatingConversation] = useState(false)

  const visibleConversations = useMemo(() => {
    const active = conversations.filter((conversation) => !conversation.archived)
    const q = search.trim().toLowerCase()
    if (!q) return active
    return active.filter((conversation) => conversation.title.toLowerCase().includes(q))
  }, [conversations, search])
  const visibleModelConversations = useMemo(
    () =>
      visibleConversations.filter(
        (conversation) => conversation.agentIds.length === 0 && Boolean(conversation.modelProfileId),
      ),
    [visibleConversations],
  )
  const visibleWorkConversations = useMemo(
    () =>
      visibleConversations.filter(
        (conversation) => conversation.agentIds.length > 0 || !conversation.modelProfileId,
      ),
    [visibleConversations],
  )

  useEffect(() => {
    fetchConversations().then(setConversations).catch(console.error)
    fetchAgents().then(setAgents).catch(console.error)
  }, [setAgents, setConversations])

  useEffect(() => {
    return subscribeUiCommand((command) => {
      if (command !== 'open-agents') return
      setCollapsed(false)
      onModeChange('agents')
      if (window.matchMedia('(max-width: 767px)').matches) setMobileSidebarOpen(true)
    })
  }, [onModeChange, setMobileSidebarOpen])

  const selectMode = (nextMode: SidebarMode) => {
    onModeChange(nextMode)
    if (window.matchMedia('(max-width: 767px)').matches) setMobileSidebarOpen(false)
  }

  const createPlainModelConversation = async () => {
    if (creatingConversation) return
    setCreatingConversation(true)
    try {
      const models = await fetchModelProfiles()
      const model = models.find((item) => item.healthStatus === 'ok') ?? models[0]
      if (!model) {
        selectMode('models')
        return
      }
      const conversation = await createConversation({
        mode: 'single',
        agentIds: [],
        modelProfileId: model.id,
      })
      upsertConversation(conversation)
      setActive(conversation.id)
      onModeChange('conversations')
    } catch (err) {
      console.error('[Sidebar] create model conversation failed', err)
    } finally {
      setCreatingConversation(false)
    }
  }

  const openWorkAreaDialog = () => {
    setDialogOpen(true)
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="关闭侧栏"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'flex shrink-0 flex-col overflow-hidden border-r bg-card transition-[width,transform] duration-200',
          collapsed ? 'w-14' : 'w-72',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-72',
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center border-b',
            collapsed ? 'flex-col gap-1 px-1 py-2' : 'justify-between px-4 py-3',
          )}
        >
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">AgentHub</h1>
              <p className="truncate text-xs text-muted-foreground">多智能体员工工作台</p>
            </div>
          )}
          <div className={cn('flex items-center', collapsed ? 'flex-col gap-1' : 'gap-0.5')}>
            <ThemeToggle />
            <Button
              size="icon"
              variant="ghost"
              className="group"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
              title={collapsed ? '展开' : '收起'}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          </div>
        </div>

        <div className={cn('min-h-0 border-b', mode === 'conversations' ? 'shrink-0' : 'flex-1')}>
          <nav
            className={cn(
              'h-full overflow-y-auto overscroll-contain [scrollbar-width:thin]',
              mode === 'conversations' && 'max-h-[min(25rem,55vh)]',
              collapsed ? 'p-1' : 'space-y-1 p-3',
            )}
          >
            {primaryAppModules.map((item) => (
              <ModuleNavButton
                key={item.id}
                active={mode === item.id}
                collapsed={collapsed}
                module={item}
                onClick={() => selectMode(item.id)}
              />
            ))}
            {!collapsed && (
              <button
                type="button"
                onClick={() => setShowMore((value) => !value)}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {showMore ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                {showMore ? '收起更多功能' : '更多功能'}
              </button>
            )}
            {(showMore || collapsed || advancedAppModules.some((item) => item.id === mode)) && (
              <div className={cn('space-y-1', !collapsed && 'pt-1')}>
                {advancedAppModules.map((item) => (
                  <ModuleNavButton
                    key={item.id}
                    active={mode === item.id}
                    collapsed={collapsed}
                    module={item}
                    onClick={() => selectMode(item.id)}
                  />
                ))}
              </div>
            )}
          </nav>
        </div>

        {mode === 'conversations' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className={cn('shrink-0', collapsed ? 'flex justify-center py-2' : 'space-y-2 px-3 pt-3')}>
              {collapsed ? (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => void createPlainModelConversation()}
                  disabled={creatingConversation}
                  title={creatingConversation ? '正在创建对话' : '新建对话'}
                >
                  <Plus className={cn('size-4', creatingConversation && 'animate-pulse')} />
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="justify-start gap-2 px-3"
                    onClick={() => void createPlainModelConversation()}
                    disabled={creatingConversation}
                    title={creatingConversation ? '正在创建对话' : '新建对话'}
                  >
                    <Plus className={cn('size-4', creatingConversation && 'animate-pulse')} />
                    <span className="truncate">{creatingConversation ? '创建中' : '新建对话'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2 px-3"
                    onClick={openWorkAreaDialog}
                    title="新建工作对话区"
                  >
                    <GitMerge className="size-4" />
                    <span className="truncate">工作对话区</span>
                  </Button>
                </div>
              )}
              {!collapsed && (
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="搜索对话"
                      className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs outline-none transition focus:border-ring"
                    />
                  </div>
                  <GlobalSearchTrigger />
                </div>
              )}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1 p-2">
                {visibleConversations.length === 0 ? (
                  !collapsed && (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                      {search.trim() ? '没有匹配的对话' : '还没有对话'}
                    </div>
                  )
                ) : collapsed ? (
                  visibleConversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      firstAgent={conversation.agentIds[0] ? agents[conversation.agentIds[0]] : null}
                      active={activeId === conversation.id}
                      collapsed={collapsed}
                      onClick={() => {
                        setActive(conversation.id)
                        onModeChange('conversations')
                      }}
                    />
                  ))
                ) : (
                  <>
                    <ConversationSection
                      title="普通模型对话"
                      description="只和一个模型聊天"
                      conversations={visibleModelConversations}
                      agents={agents}
                      activeId={activeId}
                      onSelect={(id) => {
                        setActive(id)
                        onModeChange('conversations')
                      }}
                    />
                    <ConversationSection
                      title="工作对话区"
                      description="多智能体协作任务"
                      conversations={visibleWorkConversations}
                      agents={agents}
                      activeId={activeId}
                      onSelect={(id) => {
                        setActive(id)
                        onModeChange('conversations')
                      }}
                    />
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          !collapsed && (
            <div className="flex min-h-0 flex-1 items-end px-3 py-3">
              <div className="w-full rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                <div className="font-medium text-foreground">右侧已打开：{currentLabel(mode)}</div>
                <div>这里保持为导航区，具体操作都在右侧工作台完成。</div>
              </div>
            </div>
          )
        )}

        <NewConversationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </aside>
    </>
  )
}

function ModuleNavButton({
  active,
  collapsed,
  module,
  onClick,
}: {
  active: boolean
  collapsed: boolean
  module: AppModuleDefinition
  onClick: () => void
}) {
  const Icon = module.icon
  return (
    <button
      type="button"
      title={module.label}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md text-sm font-medium transition',
        collapsed ? 'size-10 justify-center px-0' : 'px-2.5 py-2',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="size-4" />
      {!collapsed && <span className="truncate">{module.label}</span>}
    </button>
  )
}

function ConversationItem({
  conversation,
  firstAgent,
  active,
  collapsed,
  onClick,
}: {
  conversation: ConversationRow
  firstAgent: AgentRow | null
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  const unread = useUnreadCount(conversation.id)
  const isModelConversation = conversation.agentIds.length === 0 && Boolean(conversation.modelProfileId)
  if (collapsed) {
    return (
      <button
        type="button"
        title={conversation.title}
        onClick={onClick}
        className={cn('relative flex w-full justify-center rounded-md p-1.5 transition hover:bg-accent', active && 'bg-accent')}
      >
        <ConversationAvatar agent={firstAgent} isModelConversation={isModelConversation} />
        {unread > 0 && <UnreadBadge value={unread} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-accent',
        active && 'bg-accent',
      )}
    >
      <div className="relative">
        <ConversationAvatar agent={firstAgent} isModelConversation={isModelConversation} />
        {unread > 0 && <UnreadBadge value={unread} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{conversation.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {isModelConversation
            ? '普通对话 · 模型聊天'
            : conversation.mode === 'single'
              ? `智能体对话 · ${conversation.agentIds.length} 个智能体`
              : `工作对话区 · ${conversation.agentIds.length} 个智能体`}
        </div>
      </div>
    </button>
  )
}

function ConversationSection({
  title,
  description,
  conversations,
  agents,
  activeId,
  onSelect,
}: {
  title: string
  description: string
  conversations: ConversationRow[]
  agents: Record<string, AgentRow>
  activeId: string | null
  onSelect: (id: string) => void
}) {
  if (conversations.length === 0) return null
  return (
    <section className="space-y-1" data-testid={`conversation-section-${title}`}>
      <div className="flex items-center justify-between gap-2 px-2 pt-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-foreground">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{description}</div>
        </div>
        <span className="shrink-0 rounded-full border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {conversations.length}
        </span>
      </div>
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          firstAgent={conversation.agentIds[0] ? agents[conversation.agentIds[0]] : null}
          active={activeId === conversation.id}
          collapsed={false}
          onClick={() => onSelect(conversation.id)}
        />
      ))}
    </section>
  )
}

function ConversationAvatar({
  agent,
  isModelConversation,
}: {
  agent: AgentRow | null
  isModelConversation?: boolean
}) {
  if (agent) return <AgentAvatar agent={agent} size="lg" />
  return (
    <Avatar className="size-9 shrink-0">
      <AvatarFallback className="text-sm">{isModelConversation ? '模' : 'A'}</AvatarFallback>
    </Avatar>
  )
}

function UnreadBadge({ value }: { value: number }) {
  return (
    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white">
      {value > 99 ? '99+' : value}
    </span>
  )
}

function currentLabel(mode: SidebarMode): string {
  return getAppModuleLabel(mode)
}

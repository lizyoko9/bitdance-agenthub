'use client'

import { AlertTriangle, FilePenLine, FolderOpen, FolderTree, Layers, Menu, MessagesSquare, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AddAgentDialog } from '@/components/add-agent-dialog'
import { AgentInfoPopover } from '@/components/agent-info-popover'
import { AskUserQuestionDialog } from '@/components/ask-user-question-dialog'
import { ArtifactLibrary } from '@/components/artifact-library'
import { ConversationOutline } from '@/components/conversation-outline'
import { FileLibraryDialog } from '@/components/file-library-dialog'
import { FileTab } from '@/components/file-tab'
import { PendingWriteDiffTab } from '@/components/pending-write-diff-tab'
import { PendingBashCommandsPanel } from '@/components/pending-bash-commands-panel'
import { PendingWritesPanel } from '@/components/pending-writes-panel'
import { PendingSkillInstallsPanel } from '@/components/pending-skill-installs-panel'
import { diffTabPendingId, isDiffTabId } from '@/components/pending-writes-panel'
import { PinnedMessagesBar } from '@/components/pinned-messages-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MessageInput } from '@/components/message-input'
import { MessageList } from '@/components/message-list'
import { UsageBadge } from '@/components/usage-badge'
import type { AgentRow } from '@/db/schema'
import { fetchPendingDispatchPlans } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  useActiveConversation,
  useActiveTab,
  useAppStore,
  useOpenFiles,
  usePendingWrites,
} from '@/stores/app-store'

export function ChatPanel() {
  const conv = useActiveConversation()
  const agents = useAppStore((s) => s.agents)
  const streamConnected = useAppStore((s) => s.streamConnected)
  const fileExplorerOpen = useAppStore((s) => s.fileExplorerOpen)
  const previewArtifactId = useAppStore((s) => s.previewArtifactId)
  const setFileExplorerOpen = useAppStore((s) => s.setFileExplorerOpen)
  const closeFile = useAppStore((s) => s.closeFile)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)
  const setPendingDispatchPlansForConversation = useAppStore(
    (s) => s.setPendingDispatchPlansForConversation,
  )
  const [addOpen, setAddOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [artifactsOpen, setArtifactsOpen] = useState(false)

  const openFiles = useOpenFiles(conv?.id ?? '')
  const activeTab = useActiveTab(conv?.id ?? '')
  const pendingWrites = usePendingWrites(conv?.id ?? null)
  const pendingById = useMemo(
    () => new Map(pendingWrites.map((p) => [p.id, p])),
    [pendingWrites],
  )

  // Pending 被 resolve（其他客户端 / SSE 移除）后，关闭对应的 diff tab —— 即使该 tab 当前在后台
  useEffect(() => {
    if (!conv) return
    for (const tabId of openFiles) {
      if (isDiffTabId(tabId) && !pendingById.has(diffTabPendingId(tabId))) {
        closeFile(conv.id, tabId)
      }
    }
  }, [conv, openFiles, pendingById, closeFile])

  useEffect(() => {
    if (!conv) return
    let cancelled = false
    fetchPendingDispatchPlans(conv.id)
      .then((list) => {
        if (!cancelled) setPendingDispatchPlansForConversation(conv.id, list)
      })
      .catch((err) => {
        console.warn('[ChatPanel] fetch pending dispatch plans failed', err)
      })
    return () => {
      cancelled = true
    }
  }, [conv, setPendingDispatchPlansForConversation])

  if (!conv) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <MessagesSquare className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">开始你的多 Agent 协作</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              从左侧选择一个会话继续聊天，或点击「+ 新建对话」选择一个或多个 Agent 开始
            </p>
          </div>
        </div>
      </main>
    )
  }

  const participantAgents = conv.agentIds.map((id) => agents[id]).filter(Boolean)

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 overflow-hidden border-b px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {/* 移动端汉堡按钮：打开 sidebar 抽屉 */}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setMobileSidebarOpen(true)}
            title="打开会话列表"
            className="md:hidden"
          >
            <Menu className="size-4" />
          </Button>
          <ParticipantStack agents={participantAgents} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 truncate text-sm font-medium">{conv.title}</span>
              {conv.workspaceMode === 'local' && conv.workspaceBoundPath && (
                <span
                  title={`本地工作目录：${conv.workspaceBoundPath}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <AlertTriangle className="size-2.5" />
                  本地
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {conv.mode === 'single' ? '单聊' : '群聊'} · {participantAgents.length} 位 Agent
            </div>
          </div>
        </div>
        <div className="flex min-w-0 max-w-[65%] shrink-0 items-center gap-1 overflow-x-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* 右侧面板切换（文件树 / 产物预览，互斥）。点同一个再关掉。 */}
          <Button
            size="icon-sm"
            variant={fileExplorerOpen ? 'default' : 'ghost'}
            onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
            title={fileExplorerOpen ? '关闭文件树' : '打开文件树'}
          >
            <FolderTree className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant={artifactsOpen || previewArtifactId ? 'default' : 'ghost'}
            onClick={() => setArtifactsOpen(true)}
            title="本会话产物库"
          >
            <Layers className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setFilesOpen(true)}
            title="会话文件库"
          >
            <FolderOpen className="size-4" />
          </Button>
          <ConversationOutline conversationId={conv.id} />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setAddOpen(true)}
            title="添加 Agent"
          >
            <UserPlus className="size-4" />
          </Button>
          <UsageBadge conversationId={conv.id} />
          <Badge variant={streamConnected ? 'default' : 'outline'} className="gap-1 px-1.5 text-[11px]">
            <span
              className={`size-1.5 rounded-full ${streamConnected ? 'bg-green-500' : 'bg-zinc-400'}`}
            />
            {streamConnected ? '已连接' : '断开'}
          </Badge>
        </div>
      </header>

      {/* Tab bar：仅在有打开的文件 / diff 时显示（避免单 chat tab 时浪费空间） */}
      {openFiles.length > 0 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-card/50 px-2 py-1 text-xs">
          <TabButton
            label="对话"
            active={activeTab === 'chat'}
            onClick={() => setActiveTab(conv.id, 'chat')}
          />
          {openFiles.map((tabId) => {
            if (isDiffTabId(tabId)) {
              const pw = pendingById.get(diffTabPendingId(tabId))
              const name = pw ? pw.path.split('/').pop() ?? pw.path : '已处理'
              return (
                <TabButton
                  key={tabId}
                  label={`diff: ${name}`}
                  tooltip={pw?.path}
                  icon={<FilePenLine className="size-3 text-[#3370FF]" />}
                  active={activeTab === tabId}
                  onClick={() => setActiveTab(conv.id, tabId)}
                  onClose={() => closeFile(conv.id, tabId)}
                  highlight
                />
              )
            }
            return (
              <TabButton
                key={tabId}
                label={tabId.split('/').pop() ?? tabId}
                tooltip={tabId}
                active={activeTab === tabId}
                onClick={() => setActiveTab(conv.id, tabId)}
                onClose={() => closeFile(conv.id, tabId)}
              />
            )
          })}
        </div>
      )}

      {/* 主体：chat / file tab / pending diff tab */}
      {activeTab === 'chat' || !openFiles.includes(activeTab) ? (
        <>
          <PinnedMessagesBar conversationId={conv.id} />
          <MessageList conversationId={conv.id} />
          <PendingBashCommandsPanel conversationId={conv.id} />
          <PendingWritesPanel conversationId={conv.id} />
          <PendingSkillInstallsPanel conversationId={conv.id} />
          <MessageInput conversationId={conv.id} />
        </>
      ) : isDiffTabId(activeTab) ? (
        <PendingWriteDiffTab conversationId={conv.id} pendingId={diffTabPendingId(activeTab)} />
      ) : (
        <FileTab conversationId={conv.id} relPath={activeTab} />
      )}

      <AddAgentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        conversationId={conv.id}
        existingAgentIds={conv.agentIds}
      />

      <FileLibraryDialog
        open={filesOpen}
        onOpenChange={setFilesOpen}
        conversationId={conv.id}
      />

      <Dialog open={artifactsOpen} onOpenChange={setArtifactsOpen}>
        <DialogContent className="grid max-h-[min(680px,calc(100vh-2rem))] max-w-md grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Layers className="size-4 text-muted-foreground" />
              会话产物
            </DialogTitle>
            <DialogDescription className="truncate text-xs" title={conv.title}>
              {conv.title}
            </DialogDescription>
          </DialogHeader>
          <ArtifactLibrary conversationId={conv.id} showConversationTitle={false} />
        </DialogContent>
      </Dialog>

      <AskUserQuestionDialog conversationId={conv.id} />
    </main>
  )
}

function ParticipantStack({ agents }: { agents: AgentRow[] }) {
  const visibleAgents = agents.slice(0, 3)
  const hiddenAgents = agents.slice(3)
  const title = agents.map((agent) => agent.name).join(' / ')

  return (
    <div className="flex shrink-0 -space-x-2 overflow-hidden pr-1" title={title}>
      {visibleAgents.map((agent) => (
        <AgentInfoPopover
          key={agent.id}
          agent={agent}
          size="sm"
          avatarClassName="border-2 border-background"
        />
      ))}
      {hiddenAgents.length > 0 && (
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px] font-semibold text-muted-foreground"
          title={hiddenAgents.map((agent) => agent.name).join(' / ')}
        >
          +{hiddenAgents.length}
        </div>
      )}
    </div>
  )
}

function TabButton({
  label,
  tooltip,
  icon,
  active,
  highlight,
  onClick,
  onClose,
}: {
  label: string
  tooltip?: string
  icon?: React.ReactNode
  active: boolean
  highlight?: boolean
  onClick: () => void
  onClose?: () => void
}) {
  return (
    <div
      title={tooltip}
      className={cn(
        'group flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 transition',
        active
          ? highlight
            ? 'border-[#3370FF]/40 bg-[#3370FF]/5 text-foreground shadow-sm'
            : 'border-primary/30 bg-background shadow-sm'
          : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      <button type="button" onClick={onClick} className="max-w-[180px] truncate">
        {label}
      </button>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="rounded p-0.5 opacity-50 transition hover:bg-accent hover:opacity-100"
          title="关闭"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

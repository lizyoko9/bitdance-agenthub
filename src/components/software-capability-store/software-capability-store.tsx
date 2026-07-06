'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type {
  AgentProfileRow,
  CliProfileRow,
  McpServerRow,
  McpToolDefinitionRow,
  SoftwareCommandRow,
  SoftwareProfileRow,
} from '@/db/schema'
import {
  buildSoftwareCapabilityStore,
  toggleSoftwareForAgent,
  type SoftwareCapabilityCard,
  type StoreSoftwareCategory,
} from '@/lib/software-capability-store'
import {
  createSoftwareCommand,
  createSoftwareProfile,
  fetchAgentProfiles,
  fetchCliProfiles,
  fetchMcpServers,
  fetchMcpToolDefinitions,
  fetchSoftwareCommands,
  fetchSoftwareProfiles,
  runSoftwareCommand,
  testSoftwareCommand,
  updateAgentProfile,
} from '@/lib/api'

import { SoftwareDetailDialog } from './software-detail-dialog'
import { SoftwareStoreOverview } from './software-store-overview'
import type { CapabilityStoreActionState } from './types'

const CATEGORIES: StoreSoftwareCategory[] = [
  '开发工具',
  '办公协作',
  '浏览器网页',
  '视频创作',
  '数据文件',
  '自动化脚本',
  '其他软件',
]

export function SoftwareCapabilityStore() {
  const [agents, setAgents] = useState<AgentProfileRow[]>([])
  const [softwareProfiles, setSoftwareProfiles] = useState<SoftwareProfileRow[]>([])
  const [softwareCommands, setSoftwareCommands] = useState<SoftwareCommandRow[]>([])
  const [cliProfiles, setCliProfiles] = useState<CliProfileRow[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerRow[]>([])
  const [mcpTools, setMcpTools] = useState<McpToolDefinitionRow[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<StoreSoftwareCategory | '全部'>('全部')
  const [selectedCard, setSelectedCard] = useState<SoftwareCapabilityCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<CapabilityStoreActionState>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        agentsNext,
        softwareProfilesNext,
        softwareCommandsNext,
        cliProfilesNext,
        mcpServersNext,
        mcpToolsNext,
      ] = await Promise.all([
        fetchAgentProfiles(),
        fetchSoftwareProfiles(),
        fetchSoftwareCommands(),
        fetchCliProfiles(),
        fetchMcpServers(),
        fetchMcpToolDefinitions(),
      ])
      setAgents(agentsNext)
      setSoftwareProfiles(softwareProfilesNext)
      setSoftwareCommands(softwareCommandsNext)
      setCliProfiles(cliProfilesNext)
      setMcpServers(mcpServersNext)
      setMcpTools(mcpToolsNext)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载软件能力失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const store = useMemo(
    () => buildSoftwareCapabilityStore({ softwareProfiles, softwareCommands, cliProfiles, mcpServers, mcpTools, agents }),
    [agents, cliProfiles, mcpServers, mcpTools, softwareCommands, softwareProfiles],
  )

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase()
    return store.cards.filter((card) => {
      const matchCategory = category === '全部' || card.category === category
      const matchSearch = !q || `${card.name} ${card.description} ${card.category}`.toLowerCase().includes(q)
      return matchCategory && matchSearch
    })
  }, [category, search, store.cards])

  const selectedSoftwareProfileId = selectedCard?.softwareProfileId ?? null
  const selectedCommands = useMemo(
    () =>
      selectedSoftwareProfileId
        ? softwareCommands.filter((command) => command.softwareProfileId === selectedSoftwareProfileId)
        : [],
    [selectedSoftwareProfileId, softwareCommands],
  )

  async function withAction(message: string, fn: () => Promise<void>) {
    setActionState('loading')
    setError(null)
    try {
      await fn()
      setNotice(message)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionState('idle')
    }
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <Wrench className="size-5 text-primary" />
              软件能力商店
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              像软件商店一样选择能力。点开软件后，再设置 CLI、MCP、命令、检测和分配智能体。
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{store.freeNotice}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="size-4" />
            刷新
          </Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="已接入软件" value={store.metrics.connectedSoftware} />
          <Metric label="CLI/MCP 模式" value={store.metrics.totalModes} />
          <Metric label="可用命令" value={store.metrics.totalCommands} />
          <Metric label="可分配智能体" value={store.metrics.assignableAgents} />
        </div>
      </header>
      <main className="space-y-4 p-5">
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        ) : null}
        <SoftwareStoreOverview
          cards={filteredCards}
          categories={CATEGORIES}
          search={search}
          category={category}
          selectedCard={selectedCard}
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
          onSelectCard={(card) => {
            setSelectedCard(card)
            setDetailOpen(true)
          }}
        />
      </main>
      <SoftwareDetailDialog
        open={detailOpen}
        card={selectedCard}
        agents={agents}
        softwareProfiles={softwareProfiles}
        commands={selectedCommands}
        actionState={actionState}
        onOpenChange={setDetailOpen}
        onTestCommand={(commandId) =>
          void withAction('检测完成', async () => {
            await testSoftwareCommand(commandId)
          })
        }
        onRunCommand={(commandId) =>
          void withAction('试运行完成', async () => {
            await runSoftwareCommand(commandId, { mode: 'dry_run', confirmRisk: false })
          })
        }
        onToggleAgent={(agentId, softwareProfileId) =>
          void withAction('智能体分配已更新', async () => {
            const agent = agents.find((item) => item.id === agentId)
            if (!agent) throw new Error('找不到智能体')
            await updateAgentProfile(agentId, toggleSoftwareForAgent(agent, softwareProfileId))
          })
        }
        onCreateSoftwareProfile={(draft) =>
          void withAction('软件接入已创建', async () => {
            await createSoftwareProfile({
              name: draft.name,
              appType: draft.appType,
              adapterType: draft.adapterType,
              launchCommand: draft.launchCommand,
              executablePath: draft.executablePath,
            })
          })
        }
        onCreateCommand={(softwareProfileId, draft) =>
          void withAction('软件命令已创建', async () => {
            await createSoftwareCommand(softwareProfileId, {
              name: draft.name,
              description: draft.description,
              implementation: JSON.parse(draft.implementationText),
              riskLevel: draft.riskLevel,
              requiresApproval: draft.requiresApproval,
            })
          })
        }
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

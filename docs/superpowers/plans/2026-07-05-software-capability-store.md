# Software Capability Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first modular AgentHub core page: a free software capability store where users pick a software/service, inspect CLI/MCP/API/automation modes, detect/test it, enable it, and assign it to Agents.

**Architecture:** Keep existing database/API tables and replace the crowded `ToolControlCenter` UI with focused modules. A pure view-model layer merges `software_profiles`, `software_commands`, `cli_profiles`, `mcp_servers`, `mcp_tools`, and `agent_profiles` into store cards, detail sections, test actions, and assignment state. The existing `ToolControlCenter` export remains as the navigation-compatible wrapper.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Drizzle SQLite rows from `src/db/schema.ts`, existing REST helpers in `src/lib/api.ts`, Vitest for pure view-model tests, existing UI primitives in `src/components/ui/*`, lucide-react icons.

## Global Constraints

- Product price: AgentHub itself is free. Do not add paid tiers, membership gating, paywalled modules, trial limits, billing copy, or upsell UI.
- External costs: It is acceptable to show model/API/CLI usage reminders, but they are external user-provider costs, not AgentHub pricing.
- Priority order: C -> B -> A, where C is Software Capability Store, B is Agent Orchestration Canvas, and A is AI Employee Workbench.
- This plan only implements Module 1: Software Capability Store. Canvas and Workbench integration stays limited to assignment-ready data.
- Homepage interaction: first choose software/service, then open the software detail page/modal for CLI, MCP, commands, detection, enable/disable, and assignment.
- Detail mode: simple mode by default; advanced CLI/MCP/API/automation fields are collapsed behind "高级配置".
- Supported first-version software categories: code/repository tools, collaboration tools, browser/web tools, video creation tools, data/file tools, automation scripts, and other software.
- Supported first-version modes: CLI, MCP, API, browser automation, desktop automation, software command.
- Permission policy: low-risk commands can run automatically; high-risk commands require confirmation. Full trusted execution can be controlled at project/agent permission level later, not through paid gates.
- Do not implement phone connection, VM/RDP virtual workstations, full macro recorder, or Langflow canvas changes in this plan.
- Chinese users are primary. User-facing copy in this module must be simplified Chinese.
- Preserve existing dirty worktree changes that are unrelated to this module.

---

## File Structure

- Create `src/lib/software-capability-store.ts`
  - Pure domain/view-model functions.
  - No React imports and no network calls.
  - Produces cards, detail summaries, default mode, status labels, agent assignment patch payloads, and command test eligibility.

- Create `src/lib/software-capability-store.test.ts`
  - Vitest coverage for category grouping, card status, default mode selection, assignment toggles, and free-product policy copy.

- Create `src/components/software-capability-store/types.ts`
  - Component-only prop types that import the pure view-model types.

- Create `src/components/software-capability-store/software-capability-store.tsx`
  - Page shell, data loading, refresh, selected software state, and high-level layout.

- Create `src/components/software-capability-store/software-store-overview.tsx`
  - Search, category chips, store metrics, and software card grid.

- Create `src/components/software-capability-store/software-detail-dialog.tsx`
  - Modal opened when a software card is clicked.
  - Shows simple mode first and advanced configuration collapsed.

- Create `src/components/software-capability-store/software-mode-panel.tsx`
  - Displays CLI/MCP/API/Browser/Desktop/Command modes for the selected software.
  - Provides detect/test/run buttons using callbacks from the shell.

- Create `src/components/software-capability-store/software-agent-assignment.tsx`
  - Assign/unassign selected software to Agents by patching `agent_profiles.softwareProfileIds`.

- Create `src/components/software-capability-store/software-advanced-config.tsx`
  - Creates software profiles and commands through existing API helpers.
  - Replaces the old homepage form pile with a collapsed advanced panel.

- Modify `src/components/tool-control-center.tsx`
  - Keep `export function ToolControlCenter()` but delegate to the new module.
  - Do not delete old implementation in the same task until the new wrapper compiles; if removal is too risky, move old helpers only after tests pass.

- Modify `src/lib/api.ts`
  - Add only missing helpers if required:
    - `fetchMcpTools()`
    - `testMcpServer(id: string)`
    - `testCliProfile(id: string)`
  - Do not invent new backend routes if existing routes already support the action.

- Optional modify `src/app/api/*`
  - Only if a missing test route is confirmed by `rg`. Keep route payloads compatible with current `control-plane-service.ts`.

---

### Task 1: Pure Capability Store View Model

**Files:**
- Create: `src/lib/software-capability-store.ts`
- Test: `src/lib/software-capability-store.test.ts`

**Interfaces:**
- Consumes:
  - `CliProfileRow`, `McpServerRow`, `McpToolDefinitionRow`, `SoftwareProfileRow`, `SoftwareCommandRow`, `AgentProfileRow` from `src/db/schema.ts`
- Produces:
  - `type StoreSoftwareCategory`
  - `type StoreCapabilityMode`
  - `type SoftwareCapabilityCard`
  - `type SoftwareCapabilityStoreState`
  - `function buildSoftwareCapabilityStore(input: BuildSoftwareCapabilityStoreInput): SoftwareCapabilityStoreState`
  - `function toggleSoftwareForAgent(agent: AgentProfileRow, softwareProfileId: string): { softwareProfileIds: string[] }`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/software-capability-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  buildSoftwareCapabilityStore,
  getFreeProductNotice,
  toggleSoftwareForAgent,
} from './software-capability-store'

const now = 1780000000000

function baseSoftwareProfile(overrides = {}) {
  return {
    id: 'sw_codex',
    name: 'Codex CLI',
    appType: 'cli_app',
    adapterType: 'cli',
    launchCommand: 'codex',
    executablePath: null,
    defaultWorkstationMode: 'browser_context',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function baseSoftwareCommand(overrides = {}) {
  return {
    id: 'cmd_codex_run',
    softwareProfileId: 'sw_codex',
    name: '运行 Codex',
    description: '用 Codex CLI 执行目标',
    inputSchema: {},
    outputSchema: {},
    implementation: { type: 'cli', commandTemplate: 'codex {{goal}}' },
    riskLevel: 'medium',
    requiresApproval: true,
    healthStatus: 'ok',
    lastTestResult: 'CLI software command test passed',
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function baseAgent(overrides = {}) {
  return {
    id: 'agent_writer',
    name: '写代码 Agent',
    role: 'writer',
    description: '',
    modelProfileId: null,
    fallbackModelProfileIds: [],
    skillIds: [],
    mcpServerIds: [],
    cliProfileIds: [],
    softwareProfileIds: [],
    memoryPolicy: {},
    autonomyPolicy: {},
    workstationPolicy: {},
    permissionPolicy: {},
    inputContract: {},
    outputContract: {},
    persona: {},
    systemPrompt: '',
    behaviorRules: [],
    successCriteria: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('software capability store', () => {
  it('builds store cards from software profiles and commands', () => {
    const state = buildSoftwareCapabilityStore({
      softwareProfiles: [baseSoftwareProfile()],
      softwareCommands: [baseSoftwareCommand()],
      cliProfiles: [],
      mcpServers: [],
      mcpTools: [],
      agents: [baseAgent({ softwareProfileIds: ['sw_codex'] })],
    })

    expect(state.cards).toHaveLength(1)
    expect(state.cards[0]).toMatchObject({
      key: 'software:sw_codex',
      name: 'Codex CLI',
      category: '开发工具',
      connectionStatus: '已接入',
      defaultMode: 'CLI',
      assignedAgentCount: 1,
    })
    expect(state.cards[0].modes.map((mode) => mode.kind)).toEqual(['CLI', '命令'])
  })

  it('keeps not-connected software visible from built-in catalog', () => {
    const state = buildSoftwareCapabilityStore({
      softwareProfiles: [],
      softwareCommands: [],
      cliProfiles: [],
      mcpServers: [],
      mcpTools: [],
      agents: [],
    })

    expect(state.cards.some((card) => card.name === '微信')).toBe(true)
    expect(state.cards.find((card) => card.name === '微信')?.connectionStatus).toBe('未接入')
  })

  it('toggles a software profile for an agent without touching other capabilities', () => {
    const agent = baseAgent({ softwareProfileIds: ['sw_a'], cliProfileIds: ['cli_keep'] })
    expect(toggleSoftwareForAgent(agent, 'sw_b')).toEqual({ softwareProfileIds: ['sw_a', 'sw_b'] })
    expect(toggleSoftwareForAgent({ ...agent, softwareProfileIds: ['sw_a', 'sw_b'] }, 'sw_a')).toEqual({
      softwareProfileIds: ['sw_b'],
    })
  })

  it('states that AgentHub is free and does not mention paid tiers', () => {
    const notice = getFreeProductNotice()
    expect(notice).toContain('AgentHub 本体永久免费')
    expect(notice).not.toContain('会员')
    expect(notice).not.toContain('付费墙')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
corepack pnpm test -- src/lib/software-capability-store.test.ts
```

Expected: FAIL because `src/lib/software-capability-store.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/software-capability-store.ts`:

```ts
import type {
  AgentProfileRow,
  CliProfileRow,
  McpServerRow,
  McpToolDefinitionRow,
  SoftwareCommandRow,
  SoftwareProfileRow,
} from '@/db/schema'

export type StoreSoftwareCategory =
  | '开发工具'
  | '办公协作'
  | '浏览器网页'
  | '视频创作'
  | '数据文件'
  | '自动化脚本'
  | '其他软件'

export type StoreCapabilityModeKind = 'CLI' | 'MCP' | 'API' | '浏览器' | '桌面' | '命令'
export type StoreConnectionStatus = '未接入' | '已接入' | '需检查' | '异常'

export interface StoreCapabilityMode {
  id: string
  kind: StoreCapabilityModeKind
  label: string
  status: StoreConnectionStatus
  riskLevel?: string
  requiresApproval?: boolean
  sourceId?: string
}

export interface SoftwareCapabilityCard {
  key: string
  softwareProfileId?: string
  name: string
  description: string
  category: StoreSoftwareCategory
  connectionStatus: StoreConnectionStatus
  defaultMode: StoreCapabilityModeKind | '未设置'
  modes: StoreCapabilityMode[]
  commandCount: number
  assignedAgentCount: number
  lastTestResult?: string | null
}

export interface SoftwareCapabilityStoreState {
  cards: SoftwareCapabilityCard[]
  metrics: {
    connectedSoftware: number
    totalModes: number
    totalCommands: number
    assignableAgents: number
  }
  freeNotice: string
}

export interface BuildSoftwareCapabilityStoreInput {
  softwareProfiles: SoftwareProfileRow[]
  softwareCommands: SoftwareCommandRow[]
  cliProfiles: CliProfileRow[]
  mcpServers: McpServerRow[]
  mcpTools: McpToolDefinitionRow[]
  agents: AgentProfileRow[]
}

interface CatalogItem {
  key: string
  name: string
  description: string
  category: StoreSoftwareCategory
  aliases: string[]
}

const BUILT_IN_CATALOG: CatalogItem[] = [
  { key: 'codex', name: 'Codex CLI', description: '代码修改、仓库检查、命令行交付', category: '开发工具', aliases: ['codex'] },
  { key: 'claude-code', name: 'Claude Code', description: '代码任务、仓库理解、工程协作', category: '开发工具', aliases: ['claude'] },
  { key: 'opencode', name: 'OpenCode', description: '开放式代码 Agent 与本地脚本', category: '开发工具', aliases: ['opencode'] },
  { key: 'github', name: 'GitHub', description: '仓库、Issue、PR 与发布流程', category: '开发工具', aliases: ['github'] },
  { key: 'wechat', name: '微信', description: '联系人、群聊、消息草稿与客户沟通', category: '办公协作', aliases: ['wechat', 'weixin', '微信'] },
  { key: 'feishu', name: '飞书', description: '文档、表格、审批与团队通知', category: '办公协作', aliases: ['feishu', 'lark', '飞书'] },
  { key: 'notion', name: 'Notion', description: '知识库、项目文档与数据库', category: '办公协作', aliases: ['notion'] },
  { key: 'chrome', name: 'Chrome', description: '网页浏览、登录态页面与浏览器自动化', category: '浏览器网页', aliases: ['chrome', 'browser'] },
  { key: 'skillsmap', name: 'SkillsMap', description: '技能包安装、发布与管理', category: '浏览器网页', aliases: ['skillsmap', 'skillsmp'] },
  { key: 'jianying', name: '剪映 / CapCut', description: '素材处理、剪辑项目与导出检查', category: '视频创作', aliases: ['jianying', 'capcut', '剪映'] },
]

export function getFreeProductNotice(): string {
  return 'AgentHub 本体永久免费；模型、API 或第三方 CLI 的费用只来自用户自己的服务商。'
}

export function buildSoftwareCapabilityStore(input: BuildSoftwareCapabilityStoreInput): SoftwareCapabilityStoreState {
  const commandsBySoftware = new Map<string, SoftwareCommandRow[]>()
  for (const command of input.softwareCommands) {
    const list = commandsBySoftware.get(command.softwareProfileId) ?? []
    list.push(command)
    commandsBySoftware.set(command.softwareProfileId, list)
  }

  const cards = new Map<string, SoftwareCapabilityCard>()
  for (const item of BUILT_IN_CATALOG) {
    cards.set(item.key, {
      key: `catalog:${item.key}`,
      name: item.name,
      description: item.description,
      category: item.category,
      connectionStatus: '未接入',
      defaultMode: '未设置',
      modes: [],
      commandCount: 0,
      assignedAgentCount: 0,
      lastTestResult: null,
    })
  }

  for (const profile of input.softwareProfiles) {
    const catalog = findCatalogForName(profile.name)
    const commands = commandsBySoftware.get(profile.id) ?? []
    const modes = modesForProfile(profile, commands)
    const key = catalog?.key ?? `profile:${profile.id}`
    cards.set(key, {
      key: `software:${profile.id}`,
      softwareProfileId: profile.id,
      name: profile.name,
      description: catalog?.description ?? softwareDescription(profile),
      category: catalog?.category ?? categoryForProfile(profile),
      connectionStatus: connectionStatusForProfile(profile, commands),
      defaultMode: modes[0]?.kind ?? '未设置',
      modes,
      commandCount: commands.length,
      assignedAgentCount: input.agents.filter((agent) => agent.softwareProfileIds.includes(profile.id)).length,
      lastTestResult: commands.find((command) => command.lastTestResult)?.lastTestResult ?? null,
    })
  }

  const cardList = [...cards.values()].sort((a, b) => {
    const connectedDelta = Number(b.connectionStatus === '已接入') - Number(a.connectionStatus === '已接入')
    if (connectedDelta !== 0) return connectedDelta
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

  return {
    cards: cardList,
    metrics: {
      connectedSoftware: cardList.filter((card) => card.connectionStatus === '已接入').length,
      totalModes: cardList.reduce((sum, card) => sum + card.modes.length, 0),
      totalCommands: input.softwareCommands.length,
      assignableAgents: input.agents.filter((agent) => agent.status !== 'archived').length,
    },
    freeNotice: getFreeProductNotice(),
  }
}

export function toggleSoftwareForAgent(agent: AgentProfileRow, softwareProfileId: string): { softwareProfileIds: string[] } {
  const current = new Set(agent.softwareProfileIds)
  if (current.has(softwareProfileId)) current.delete(softwareProfileId)
  else current.add(softwareProfileId)
  return { softwareProfileIds: [...current] }
}

function findCatalogForName(name: string): CatalogItem | undefined {
  const normalized = name.toLowerCase()
  return BUILT_IN_CATALOG.find((item) => item.aliases.some((alias) => normalized.includes(alias.toLowerCase())))
}

function modesForProfile(profile: SoftwareProfileRow, commands: SoftwareCommandRow[]): StoreCapabilityMode[] {
  const modes: StoreCapabilityMode[] = []
  const adapter = profile.adapterType
  if (adapter === 'cli') modes.push({ id: `${profile.id}:cli`, kind: 'CLI', label: 'CLI 模式', status: '已接入', sourceId: profile.id })
  if (adapter === 'mcp') modes.push({ id: `${profile.id}:mcp`, kind: 'MCP', label: 'MCP 模式', status: '已接入', sourceId: profile.id })
  if (adapter === 'api') modes.push({ id: `${profile.id}:api`, kind: 'API', label: 'API 模式', status: '已接入', sourceId: profile.id })
  if (adapter === 'browser_automation') modes.push({ id: `${profile.id}:browser`, kind: '浏览器', label: '浏览器自动化', status: '已接入', sourceId: profile.id })
  if (adapter === 'desktop_automation' || adapter === 'recorded_macro' || adapter === 'hybrid') {
    modes.push({ id: `${profile.id}:desktop`, kind: '桌面', label: '桌面自动化', status: '已接入', sourceId: profile.id })
  }
  for (const command of commands) {
    modes.push({
      id: command.id,
      kind: '命令',
      label: command.name,
      status: command.healthStatus === 'ok' ? '已接入' : command.healthStatus === 'failed' ? '异常' : '需检查',
      riskLevel: command.riskLevel,
      requiresApproval: command.requiresApproval,
      sourceId: command.id,
    })
  }
  return modes
}

function connectionStatusForProfile(profile: SoftwareProfileRow, commands: SoftwareCommandRow[]): StoreConnectionStatus {
  if (commands.some((command) => command.healthStatus === 'failed')) return '异常'
  if (commands.length > 0 && commands.every((command) => command.healthStatus === 'unknown')) return '需检查'
  if (profile.adapterType) return '已接入'
  return '未接入'
}

function categoryForProfile(profile: SoftwareProfileRow): StoreSoftwareCategory {
  if (profile.appType === 'cli_app' || profile.adapterType === 'cli') return '自动化脚本'
  if (profile.appType === 'browser_app' || profile.adapterType === 'browser_automation') return '浏览器网页'
  if (profile.appType === 'native_app' || profile.adapterType === 'desktop_automation') return '其他软件'
  if (profile.appType === 'api_service') return '数据文件'
  return '其他软件'
}

function softwareDescription(profile: SoftwareProfileRow): string {
  if (profile.launchCommand) return `启动命令：${profile.launchCommand}`
  if (profile.executablePath) return `本地程序：${profile.executablePath}`
  return '已注册的软件能力'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
corepack pnpm test -- src/lib/software-capability-store.test.ts
```

Expected: PASS for all 4 tests.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/software-capability-store.ts src/lib/software-capability-store.test.ts
git commit -m "feat: add software capability store view model"
```

Expected: commit succeeds and only these two files are staged.

---

### Task 2: Store Component Boundaries

**Files:**
- Create: `src/components/software-capability-store/types.ts`
- Create: `src/components/software-capability-store/software-store-overview.tsx`
- Create: `src/components/software-capability-store/software-mode-panel.tsx`

**Interfaces:**
- Consumes:
  - `SoftwareCapabilityCard`, `StoreSoftwareCategory`, `StoreCapabilityMode` from `src/lib/software-capability-store.ts`
- Produces:
  - `SoftwareStoreOverview`
  - `SoftwareModePanel`
  - Shared prop types for detail and assignment panels.

- [ ] **Step 1: Create shared component types**

Create `src/components/software-capability-store/types.ts`:

```ts
import type { AgentProfileRow, SoftwareCommandRow, SoftwareProfileRow } from '@/db/schema'
import type {
  SoftwareCapabilityCard,
  StoreCapabilityMode,
  StoreSoftwareCategory,
} from '@/lib/software-capability-store'

export type CapabilityStoreActionState = 'idle' | 'loading'

export interface SoftwareSelectionProps {
  selectedCard: SoftwareCapabilityCard | null
  onSelectCard: (card: SoftwareCapabilityCard) => void
}

export interface SoftwareStoreOverviewProps extends SoftwareSelectionProps {
  cards: SoftwareCapabilityCard[]
  categories: StoreSoftwareCategory[]
  search: string
  category: StoreSoftwareCategory | '全部'
  onSearchChange: (value: string) => void
  onCategoryChange: (value: StoreSoftwareCategory | '全部') => void
}

export interface SoftwareModePanelProps {
  card: SoftwareCapabilityCard
  commands: SoftwareCommandRow[]
  actionState: CapabilityStoreActionState
  onTestCommand: (commandId: string) => void
  onRunCommand: (commandId: string) => void
}

export interface SoftwareAgentAssignmentProps {
  card: SoftwareCapabilityCard
  agents: AgentProfileRow[]
  actionState: CapabilityStoreActionState
  onToggleAgent: (agentId: string, softwareProfileId: string) => void
}

export interface SoftwareAdvancedConfigProps {
  selectedCard: SoftwareCapabilityCard | null
  softwareProfiles: SoftwareProfileRow[]
  actionState: CapabilityStoreActionState
  onCreateSoftwareProfile: (draft: {
    name: string
    appType: SoftwareProfileRow['appType']
    adapterType: SoftwareProfileRow['adapterType']
    launchCommand?: string
    executablePath?: string
  }) => void
  onCreateCommand: (softwareProfileId: string, draft: {
    name: string
    description: string
    implementationText: string
    riskLevel: 'low' | 'medium' | 'high'
    requiresApproval: boolean
  }) => void
}

export function modeTone(mode: StoreCapabilityMode): string {
  if (mode.status === '已接入') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (mode.status === '异常') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
}
```

- [ ] **Step 2: Create store overview component**

Create `src/components/software-capability-store/software-store-overview.tsx`:

```tsx
'use client'

import { Boxes, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { SoftwareStoreOverviewProps } from './types'

export function SoftwareStoreOverview({
  cards,
  categories,
  search,
  category,
  selectedCard,
  onSearchChange,
  onCategoryChange,
  onSelectCard,
}: SoftwareStoreOverviewProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <Boxes className="size-4 text-primary" />
              软件能力商店
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              先选软件，再进入详情页配置 CLI、MCP、命令、检测和分配智能体。
            </p>
          </div>
          <Badge variant="outline">全部免费</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-2 lg:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索软件、CLI、MCP"
              className="pl-9"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={category === '全部' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange('全部')}
          >
            全部
          </Button>
          {categories.map((item) => (
            <Button
              key={item}
              type="button"
              variant={category === item ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectCard(card)}
            className={cn(
              'rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:bg-primary/5',
              selectedCard?.key === card.key && 'border-primary bg-primary/10',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{card.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{card.category}</div>
              </div>
              <Badge variant={card.connectionStatus === '已接入' ? 'default' : 'outline'}>
                {card.connectionStatus}
              </Badge>
            </div>
            <p className="mt-3 min-h-10 text-sm text-muted-foreground">{card.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{card.defaultMode}</Badge>
              <Badge variant="outline">{card.modes.length} 种模式</Badge>
              <Badge variant="outline">{card.commandCount} 个命令</Badge>
              <Badge variant="outline">{card.assignedAgentCount} 个智能体</Badge>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create mode panel component**

Create `src/components/software-capability-store/software-mode-panel.tsx`:

```tsx
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
        <p className="text-xs text-muted-foreground">这个软件当前可用的 CLI、MCP、API、浏览器、桌面或封装命令。</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {card.modes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            还没有接入方式。打开高级配置后可以创建 CLI、MCP 或软件命令。
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
```

- [ ] **Step 4: Type-check the new component files**

Run:

```powershell
node .\node_modules\typescript\bin\tsc --noEmit --pretty false
```

Expected: no new errors referencing `src/components/software-capability-store/*`. Existing unrelated project errors may remain; document them before moving on.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/components/software-capability-store/types.ts src/components/software-capability-store/software-store-overview.tsx src/components/software-capability-store/software-mode-panel.tsx
git commit -m "feat: add capability store UI primitives"
```

Expected: commit succeeds and only these three files are staged.

---

### Task 3: Detail Dialog, Assignment, and Advanced Config

**Files:**
- Create: `src/components/software-capability-store/software-agent-assignment.tsx`
- Create: `src/components/software-capability-store/software-advanced-config.tsx`
- Create: `src/components/software-capability-store/software-detail-dialog.tsx`

**Interfaces:**
- Consumes:
  - Component types from Task 2.
  - `SoftwareModePanel` from Task 2.
- Produces:
  - `SoftwareDetailDialog`
  - `SoftwareAgentAssignment`
  - `SoftwareAdvancedConfig`

- [ ] **Step 1: Create assignment component**

Create `src/components/software-capability-store/software-agent-assignment.tsx`:

```tsx
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
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">暂无可分配智能体。</div>
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
```

- [ ] **Step 2: Create advanced config component**

Create `src/components/software-capability-store/software-advanced-config.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
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
          高级配置
        </span>
        <span className="text-xs text-muted-foreground">{open ? '收起' : '展开'}</span>
      </button>
      {open ? (
        <div className="space-y-4 border-t p-3">
          <div className="space-y-2">
            <div className="text-sm font-medium">创建软件接入</div>
            <Input value={softwareName} onChange={(event) => setSoftwareName(event.target.value)} placeholder="软件名称" />
            <Input value={launchCommand} onChange={(event) => setLaunchCommand(event.target.value)} placeholder="CLI 或启动命令，例如 codex" />
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
                  implementationText: JSON.stringify({ type: 'cli', commandTemplate, testCommandTemplate: commandTemplate }),
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
```

- [ ] **Step 3: Create detail dialog**

Create `src/components/software-capability-store/software-detail-dialog.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AgentProfileRow, SoftwareCommandRow, SoftwareProfileRow } from '@/db/schema'

import { SoftwareAdvancedConfig } from './software-advanced-config'
import { SoftwareAgentAssignment } from './software-agent-assignment'
import { SoftwareModePanel } from './software-mode-panel'
import type { CapabilityStoreActionState } from './types'
import type { SoftwareCapabilityCard } from '@/lib/software-capability-store'

export interface SoftwareDetailDialogProps {
  open: boolean
  card: SoftwareCapabilityCard | null
  agents: AgentProfileRow[]
  softwareProfiles: SoftwareProfileRow[]
  commands: SoftwareCommandRow[]
  actionState: CapabilityStoreActionState
  onOpenChange: (open: boolean) => void
  onTestCommand: (commandId: string) => void
  onRunCommand: (commandId: string) => void
  onToggleAgent: (agentId: string, softwareProfileId: string) => void
  onCreateSoftwareProfile: React.ComponentProps<typeof SoftwareAdvancedConfig>['onCreateSoftwareProfile']
  onCreateCommand: React.ComponentProps<typeof SoftwareAdvancedConfig>['onCreateCommand']
}

export function SoftwareDetailDialog({
  open,
  card,
  agents,
  softwareProfiles,
  commands,
  actionState,
  onOpenChange,
  onTestCommand,
  onRunCommand,
  onToggleAgent,
  onCreateSoftwareProfile,
  onCreateCommand,
}: SoftwareDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-4xl overflow-y-auto">
        {card ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-3">
                <span>{card.name}</span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
                  <X className="size-4" />
                </Button>
              </DialogTitle>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{card.category}</Badge>
                <Badge variant={card.connectionStatus === '已接入' ? 'default' : 'outline'}>
                  {card.connectionStatus}
                </Badge>
                <Badge variant="secondary">默认：{card.defaultMode}</Badge>
                <Badge variant="outline">全部免费</Badge>
              </div>
            </DialogHeader>
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <SoftwareModePanel
                  card={card}
                  commands={commands}
                  actionState={actionState}
                  onTestCommand={onTestCommand}
                  onRunCommand={onRunCommand}
                />
                <SoftwareAdvancedConfig
                  selectedCard={card}
                  softwareProfiles={softwareProfiles}
                  actionState={actionState}
                  onCreateSoftwareProfile={onCreateSoftwareProfile}
                  onCreateCommand={onCreateCommand}
                />
              </div>
              <SoftwareAgentAssignment
                card={card}
                agents={agents}
                actionState={actionState}
                onToggleAgent={onToggleAgent}
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Type-check**

Run:

```powershell
node .\node_modules\typescript\bin\tsc --noEmit --pretty false
```

Expected: no new errors in `software-detail-dialog.tsx`, `software-agent-assignment.tsx`, or `software-advanced-config.tsx`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/components/software-capability-store/software-agent-assignment.tsx src/components/software-capability-store/software-advanced-config.tsx src/components/software-capability-store/software-detail-dialog.tsx
git commit -m "feat: add software detail and assignment panels"
```

Expected: commit succeeds.

---

### Task 4: Store Shell and Existing Wrapper

**Files:**
- Create: `src/components/software-capability-store/software-capability-store.tsx`
- Modify: `src/components/tool-control-center.tsx`

**Interfaces:**
- Consumes:
  - API helpers from `src/lib/api.ts`
  - View model from Task 1
  - Components from Tasks 2 and 3
- Produces:
  - `SoftwareCapabilityStore`
  - `ToolControlCenter` wrapper rendering `SoftwareCapabilityStore`

- [ ] **Step 1: Create store shell**

Create `src/components/software-capability-store/software-capability-store.tsx`:

```tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { RefreshCw, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { StoreSoftwareCategory } from '@/lib/software-capability-store'
import {
  buildSoftwareCapabilityStore,
  toggleSoftwareForAgent,
  type SoftwareCapabilityCard,
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
import type {
  AgentProfileRow,
  CliProfileRow,
  McpServerRow,
  McpToolDefinitionRow,
  SoftwareCommandRow,
  SoftwareProfileRow,
} from '@/db/schema'

import { SoftwareDetailDialog } from './software-detail-dialog'
import { SoftwareStoreOverview } from './software-store-overview'
import type { CapabilityStoreActionState } from './types'

const CATEGORIES: StoreSoftwareCategory[] = ['开发工具', '办公协作', '浏览器网页', '视频创作', '数据文件', '自动化脚本', '其他软件']

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
      const [agentsNext, softwareProfilesNext, softwareCommandsNext, cliProfilesNext, mcpServersNext, mcpToolsNext] =
        await Promise.all([
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

  useState(() => {
    void refresh()
  })

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

  const selectedCommands = useMemo(
    () =>
      selectedCard?.softwareProfileId
        ? softwareCommands.filter((command) => command.softwareProfileId === selectedCard.softwareProfileId)
        : [],
    [selectedCard?.softwareProfileId, softwareCommands],
  )

  const withAction = async (message: string, fn: () => Promise<void>) => {
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
        {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}
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
        onTestCommand={(commandId) => void withAction('检测完成', async () => { await testSoftwareCommand(commandId) })}
        onRunCommand={(commandId) => void withAction('试运行完成', async () => { await runSoftwareCommand(commandId, { mode: 'dry_run', confirmRisk: false }) })}
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
```

- [ ] **Step 2: Fix initial refresh effect**

Replace the temporary `useState(() => { void refresh() })` block in `software-capability-store.tsx` with `useEffect`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
```

and:

```tsx
useEffect(() => {
  void refresh()
}, [refresh])
```

Expected: the page loads data once when mounted, not during render.

- [ ] **Step 3: Replace wrapper**

Replace the body of `src/components/tool-control-center.tsx` with a thin wrapper. Preserve imports only for the new component:

```tsx
'use client'

import { SoftwareCapabilityStore } from '@/components/software-capability-store/software-capability-store'

export function ToolControlCenter() {
  return <SoftwareCapabilityStore />
}
```

Expected: the navigation route still imports `ToolControlCenter`, but the old crowded admin surface is no longer shown.

- [ ] **Step 4: Type-check**

Run:

```powershell
node .\node_modules\typescript\bin\tsc --noEmit --pretty false
```

Expected:
- no new errors under `src/components/software-capability-store/`
- no new errors under `src/components/tool-control-center.tsx`
- if unrelated old errors remain, record them in the final implementation note.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/components/software-capability-store/software-capability-store.tsx src/components/tool-control-center.tsx
git commit -m "feat: replace tool control center with capability store"
```

Expected: commit succeeds.

---

### Task 5: Verification and Desktop Smoke Test

**Files:**
- Modify only if verification finds a defect in files created by Tasks 1-4.
- Create optional evidence: `docs/superpowers/evidence/2026-07-05-software-capability-store.md`

**Interfaces:**
- Consumes:
  - Finished Task 1-4 implementation.
- Produces:
  - Verified local app behavior and short evidence note.

- [ ] **Step 1: Run unit tests**

Run:

```powershell
corepack pnpm test -- src/lib/software-capability-store.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
node .\node_modules\typescript\bin\tsc --noEmit --pretty false
```

Expected: no new errors from this module. Existing unrelated errors are allowed only if documented with file paths.

- [ ] **Step 3: Run the desktop app**

Run:

```powershell
corepack pnpm electron:dev
```

Expected:
- Electron window opens.
- Left navigation opens "工具连接".
- Page title is "软件能力商店".
- It shows store cards first, not a giant raw form page.
- Clicking a software card opens a modal/detail window.
- Detail window shows modes, commands, assignment, and collapsed advanced config.
- UI copy does not mention paid tiers, membership, billing, or paywalls.

- [ ] **Step 4: Manual smoke checklist**

Verify:

```txt
[ ] Search filters cards.
[ ] Category chips filter cards.
[ ] Clicking Codex CLI opens detail.
[ ] Detail has a visible close button.
[ ] Detail shows "全部免费".
[ ] If a command exists, 检测 calls the software command test route.
[ ] If an Agent exists and software is connected, assigning toggles agent.softwareProfileIds.
[ ] Advanced config is collapsed by default.
[ ] Creating a low-risk CLI command stores implementation.type = "cli".
[ ] Refresh reloads without corrupting selection.
```

- [ ] **Step 5: Record evidence**

Create `docs/superpowers/evidence/2026-07-05-software-capability-store.md`:

```md
# Software Capability Store Verification

Date: 2026-07-05

## Commands

- `corepack pnpm test -- src/lib/software-capability-store.test.ts`
- `node .\node_modules\typescript\bin\tsc --noEmit --pretty false`
- `corepack pnpm electron:dev`

## Result

- Unit tests:
- Typecheck:
- Desktop smoke:

## Notes

- AgentHub product UI remains free-only.
- External usage costs are treated as provider costs, not AgentHub pricing.
```

Fill each result line with the actual result before committing.

- [ ] **Step 6: Commit**

Run:

```powershell
git add docs/superpowers/evidence/2026-07-05-software-capability-store.md
git commit -m "test: verify software capability store"
```

Expected: evidence commit succeeds.

---

## Self-Review

### Spec Coverage

- Software store homepage: Task 2 and Task 4.
- Click software then configure in detail page/modal: Task 3 and Task 4.
- CLI/MCP/API/browser/desktop/command mode display: Task 1 and Task 3.
- Detect/test/run: Task 3 and Task 4.
- Assign to Agent: Task 1, Task 3, and Task 4.
- Advanced config collapsed: Task 3.
- Free product requirement: Global Constraints, Task 1 test, Task 4 UI copy, Task 5 smoke checklist.
- No phone/VM/full macro recorder: Global Constraints.
- Chinese-first UI: Tasks 2-4 use simplified Chinese copy.

### Gaps Deferred Intentionally

- Full MCP live handshake beyond existing API routes.
- Full desktop macro recorder.
- Workflow canvas artifact-port routing.
- AI Employee Workbench.
- Virtual workstations, phone operation, and RDP/VM isolation.

### Placeholder Scan

The plan avoids placeholder words such as "TBD", "TODO", "implement later", and "similar to". Every code-changing step contains concrete code or a concrete command.

### Type Consistency

- `SoftwareCapabilityCard` is defined in Task 1 and reused by Tasks 2-4.
- `toggleSoftwareForAgent(agent, softwareProfileId)` returns `{ softwareProfileIds: string[] }`, matching `UpdateAgentProfileBody`.
- Store categories are shared through `StoreSoftwareCategory`.
- Component action state is consistently `'idle' | 'loading'`.

import { and, asc, eq, type SQL } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  HelpCenterItemRow,
  HelpCenterItemType,
  HelpCenterSurfaceRow,
  HelpCenterSurfaceStatus,
  HelpOnboardingFlowRow,
  HelpOnboardingFlowStatus,
  JsonObject,
} from '@/db/schema'
import {
  newHelpCenterItemId,
  newHelpCenterSurfaceId,
  newHelpOnboardingFlowId,
} from '@/server/ids'
import { recordAuditLog } from '@/server/security-service'

export interface CreateHelpCenterSurfaceArgs {
  surfaceKey: string
  route: string
  title: string
  description?: string
  documentationPageId?: string | null
  docHref?: string
  questionButtonLabel?: string
  status?: HelpCenterSurfaceStatus
}

export interface CreateHelpCenterItemArgs {
  surfaceId: string
  itemKey: string
  itemType: HelpCenterItemType
  label: string
  body?: string
  selector?: string | null
  docHref?: string
  exampleValue?: JsonObject
  orderIndex?: number
  status?: string
}

export interface CreateHelpOnboardingFlowArgs {
  flowKey: string
  title: string
  description?: string
  startSurfaceKey?: string
  steps: JsonObject[]
  status?: HelpOnboardingFlowStatus
}

interface DefaultHelpSurface {
  surfaceKey: string
  route: string
  title: string
  description: string
  docHref: string
  items: Omit<CreateHelpCenterItemArgs, 'surfaceId'>[]
}

const DEFAULT_HELP_SURFACES: DefaultHelpSurface[] = [
  makeSurface('agent_factory', '/agents', '智能体', '创建和配置员工级智能体；模型、工具、权限、交付物和员工大脑都在这里管理。', '/docs/user-guide/agent-factory.md', '智能体名称', '剪辑助理'),
  makeSurface('model_control', '/models', '模型管理', '添加模型、测试连接、选择网络出口，并让智能体直接勾选已配置模型。', '/docs/user-guide/models.md', 'OpenAI 兼容地址', 'https://api.deepseek.com'),
  makeSurface('tool_control', '/tools', '工具连接', '按软件或服务选择 CLI、MCP、API 和软件命令能力。', '/docs/user-guide/tools.md', 'CLI 配置名称', 'Codex CLI'),
  makeSurface('skills_center', '/skills', '技能管理', '管理本地 Skills、启用或禁用技能，并分配给智能体使用。', '/docs/user-guide/skills.md', '技能来源', '本地技能目录'),
  makeSurface('agent_canvas', '/canvas', '编排画布', '像工作流一样连接多个智能体，明确每个节点输入、输出和交付物。', '/docs/user-guide/canvas.md', '工作流名称', '短视频交付流程'),
  makeSurface('memory_center', '/agents', '员工大脑', '在单个智能体设置里查看任务记忆、长期经验、失败教训、自我校准和反思学习。', '/docs/user-guide/agent-brain.md', '记忆标题', '客户偏好简洁交付说明'),
  makeSurface('governance_center', '/agents', '权限确认', '在智能体设置里确认文件、命令、浏览器和高风险动作权限。', '/docs/advanced/safety.md', '权限策略名称', '工作区写入保护'),
  makeSurface('observability_center', '/workbench', '任务进度', '在工作台查看任务当前步骤、运行结果、交付物和下一步动作。', '/docs/user-guide/monitoring.md', '指标名称', '任务耗时'),
  makeSurface('config_ops_center', '/workbench', '工作台', '按用户业务展示常用数据、任务状态、模块入口和待处理动作。', '/docs/advanced/workflows.md', '工作台模块', '智能体任务进度'),
  makeSurface('task_scheduler', '/canvas', '工作流计划', '在编排画布里组织工作流，必要时再安排队列或周期运行。', '/docs/advanced/workflows.md', '工作流计划', '每日素材整理流程'),
]

const DEFAULT_ONBOARDING_FLOW: CreateHelpOnboardingFlowArgs = {
  flowKey: 'first_agent_success_path',
  title: '第一次智能体上手流程',
  description: '创建第一个智能体，运行第一个任务，并查看第一次交付物。',
  startSurfaceKey: 'agent_factory',
  steps: [
    {
      stepKey: 'create_first_agent',
      surfaceKey: 'agent_factory',
      title: '创建第一个智能体',
      action: '填写角色、模型、技能、权限、员工大脑和交付物要求。',
      docHref: '/docs/getting-started/first-agent.md',
    },
    {
      stepKey: 'run_first_task',
      surfaceKey: 'agent_factory',
      title: '运行第一个任务',
      action: '提交一个低风险任务，然后观察智能体的执行步骤。',
      docHref: '/docs/getting-started/quick-start.md',
    },
    {
      stepKey: 'inspect_first_artifact',
      surfaceKey: 'observability_center',
      title: '查看第一次交付物',
      action: '打开任务结果、校验状态、日志和下一步说明。',
      docHref: '/docs/user-guide/monitoring.md',
    },
  ],
}

export function getDefaultHelpSurfaceCount(): number {
  return DEFAULT_HELP_SURFACES.length
}

export function getDefaultHelpItemCount(): number {
  return DEFAULT_HELP_SURFACES.reduce((count, surface) => count + surface.items.length, 0)
}

export function getDefaultHelpOnboardingFlowCount(): number {
  return 1
}

export async function seedHelpCenter(): Promise<{
  surfaces: HelpCenterSurfaceRow[]
  items: HelpCenterItemRow[]
  onboardingFlows: HelpOnboardingFlowRow[]
}> {
  const surfaces: HelpCenterSurfaceRow[] = []
  const items: HelpCenterItemRow[] = []
  for (const definition of DEFAULT_HELP_SURFACES) {
    let surface = await db.query.helpCenterSurfaces.findFirst({
      where: eq(schema.helpCenterSurfaces.surfaceKey, definition.surfaceKey),
    })
    if (!surface) {
      surface = await createHelpCenterSurface({
        surfaceKey: definition.surfaceKey,
        route: definition.route,
        title: definition.title,
        description: definition.description,
        docHref: definition.docHref,
      })
    } else {
      const updates = {
        route: definition.route,
        title: definition.title,
        description: definition.description,
        docHref: definition.docHref,
        updatedAt: Date.now(),
      }
      await db
        .update(schema.helpCenterSurfaces)
        .set(updates)
        .where(eq(schema.helpCenterSurfaces.id, surface.id))
      surface = { ...surface, ...updates }
    }
    surfaces.push(surface)
    for (const itemDefinition of definition.items) {
      const existingItem = await db.query.helpCenterItems.findFirst({
        where: and(
          eq(schema.helpCenterItems.surfaceId, surface.id),
          eq(schema.helpCenterItems.itemKey, itemDefinition.itemKey),
        ),
      })
      if (!existingItem) {
        items.push(await createHelpCenterItem({
          surfaceId: surface.id,
          ...itemDefinition,
        }))
      } else {
        const updates = {
          itemType: itemDefinition.itemType,
          label: itemDefinition.label,
          body: itemDefinition.body ?? '',
          selector: itemDefinition.selector ?? null,
          docHref: itemDefinition.docHref ?? '',
          exampleValue: itemDefinition.exampleValue ?? {},
          orderIndex: itemDefinition.orderIndex ?? 0,
          status: itemDefinition.status ?? existingItem.status,
          updatedAt: Date.now(),
        }
        await db
          .update(schema.helpCenterItems)
          .set(updates)
          .where(eq(schema.helpCenterItems.id, existingItem.id))
        items.push({ ...existingItem, ...updates })
      }
    }
  }
  let flow = await db.query.helpOnboardingFlows.findFirst({
    where: eq(schema.helpOnboardingFlows.flowKey, DEFAULT_ONBOARDING_FLOW.flowKey),
  })
  if (!flow) {
    flow = await createHelpOnboardingFlow(DEFAULT_ONBOARDING_FLOW)
  } else {
    const updates = {
      title: DEFAULT_ONBOARDING_FLOW.title,
      description: DEFAULT_ONBOARDING_FLOW.description ?? '',
      startSurfaceKey: DEFAULT_ONBOARDING_FLOW.startSurfaceKey ?? 'agent_factory',
      steps: DEFAULT_ONBOARDING_FLOW.steps,
      status: DEFAULT_ONBOARDING_FLOW.status ?? flow.status,
      updatedAt: Date.now(),
    }
    await db
      .update(schema.helpOnboardingFlows)
      .set(updates)
      .where(eq(schema.helpOnboardingFlows.id, flow.id))
    flow = { ...flow, ...updates }
  }
  return {
    surfaces,
    items,
    onboardingFlows: [flow],
  }
}

export async function createHelpCenterSurface(
  args: CreateHelpCenterSurfaceArgs,
): Promise<HelpCenterSurfaceRow> {
  const now = Date.now()
  const row: HelpCenterSurfaceRow = {
    id: newHelpCenterSurfaceId(),
    surfaceKey: normalizeKey(args.surfaceKey, 'surfaceKey'),
    route: normalizeRequired(args.route, 'route'),
    title: normalizeRequired(args.title, 'title'),
    description: args.description?.trim() ?? '',
    documentationPageId: normalizeNullable(args.documentationPageId),
    docHref: args.docHref?.trim() ?? '',
    questionButtonLabel: args.questionButtonLabel?.trim() || '?',
    status: args.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.helpCenterSurfaces).values(row)
  await auditHelp('help_center.surface.create', 'help_center_surface', row.id, {
    surfaceKey: row.surfaceKey,
    route: row.route,
  })
  return row
}

export async function createHelpCenterItem(args: CreateHelpCenterItemArgs): Promise<HelpCenterItemRow> {
  await requireHelpCenterSurface(args.surfaceId)
  const now = Date.now()
  const row: HelpCenterItemRow = {
    id: newHelpCenterItemId(),
    surfaceId: args.surfaceId,
    itemKey: normalizeKey(args.itemKey, 'itemKey'),
    itemType: args.itemType,
    label: normalizeRequired(args.label, 'label'),
    body: args.body?.trim() ?? '',
    selector: normalizeNullable(args.selector),
    docHref: args.docHref?.trim() ?? '',
    exampleValue: args.exampleValue ?? {},
    orderIndex: args.orderIndex ?? 0,
    status: args.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.helpCenterItems).values(row)
  await auditHelp('help_center.item.create', 'help_center_item', row.id, {
    surfaceId: row.surfaceId,
    itemKey: row.itemKey,
    itemType: row.itemType,
  })
  return row
}

export async function createHelpOnboardingFlow(
  args: CreateHelpOnboardingFlowArgs,
): Promise<HelpOnboardingFlowRow> {
  const now = Date.now()
  const row: HelpOnboardingFlowRow = {
    id: newHelpOnboardingFlowId(),
    flowKey: normalizeKey(args.flowKey, 'flowKey'),
    title: normalizeRequired(args.title, 'title'),
    description: args.description?.trim() ?? '',
    startSurfaceKey: normalizeKey(args.startSurfaceKey ?? 'agent_factory', 'startSurfaceKey'),
    steps: args.steps,
    status: args.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.helpOnboardingFlows).values(row)
  await auditHelp('help_center.onboarding_flow.create', 'help_onboarding_flow', row.id, {
    flowKey: row.flowKey,
    stepCount: row.steps.length,
  })
  return row
}

export async function listHelpCenterSurfaces(args: {
  surfaceKey?: string
  status?: HelpCenterSurfaceStatus
  limit?: number
} = {}): Promise<HelpCenterSurfaceRow[]> {
  const filters: SQL[] = []
  if (args.surfaceKey) filters.push(eq(schema.helpCenterSurfaces.surfaceKey, args.surfaceKey))
  if (args.status) filters.push(eq(schema.helpCenterSurfaces.status, args.status))
  return db.query.helpCenterSurfaces.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(schema.helpCenterSurfaces.surfaceKey)],
    limit: normalizeLimit(args.limit),
  })
}

export async function listHelpCenterItems(args: {
  surfaceId?: string
  surfaceKey?: string
  itemType?: HelpCenterItemType
  query?: string
  limit?: number
} = {}): Promise<HelpCenterItemRow[]> {
  const filters: SQL[] = []
  if (args.surfaceKey) {
    const surfaces = await listHelpCenterSurfaces({ surfaceKey: args.surfaceKey, limit: 1 })
    const surfaceId = surfaces[0]?.id
    if (!surfaceId || (args.surfaceId && args.surfaceId !== surfaceId)) return []
    filters.push(eq(schema.helpCenterItems.surfaceId, surfaceId))
  } else if (args.surfaceId) {
    filters.push(eq(schema.helpCenterItems.surfaceId, args.surfaceId))
  }
  if (args.itemType) filters.push(eq(schema.helpCenterItems.itemType, args.itemType))
  let rows = await db.query.helpCenterItems.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(schema.helpCenterItems.orderIndex), asc(schema.helpCenterItems.itemKey)],
    limit: normalizeLimit(args.limit),
  })
  const query = args.query?.trim().toLowerCase()
  if (query) {
    rows = rows.filter((row) =>
      [row.itemKey, row.label, row.body, row.docHref].join(' ').toLowerCase().includes(query),
    )
  }
  return rows
}

export async function listHelpOnboardingFlows(args: {
  status?: HelpOnboardingFlowStatus
  flowKey?: string
  limit?: number
} = {}): Promise<HelpOnboardingFlowRow[]> {
  const filters: SQL[] = []
  if (args.status) filters.push(eq(schema.helpOnboardingFlows.status, args.status))
  if (args.flowKey) filters.push(eq(schema.helpOnboardingFlows.flowKey, args.flowKey))
  return db.query.helpOnboardingFlows.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(schema.helpOnboardingFlows.flowKey)],
    limit: normalizeLimit(args.limit),
  })
}

async function requireHelpCenterSurface(surfaceId: string): Promise<HelpCenterSurfaceRow> {
  const row = await db.query.helpCenterSurfaces.findFirst({
    where: eq(schema.helpCenterSurfaces.id, surfaceId),
  })
  if (!row) throw new Error(`Help center surface not found: ${surfaceId}`)
  return row
}

function makeSurface(
  surfaceKey: string,
  route: string,
  title: string,
  description: string,
  docHref: string,
  exampleLabel: string,
  exampleText: string,
): DefaultHelpSurface {
  return {
    surfaceKey,
    route,
    title,
    description,
    docHref,
    items: [
      {
        itemKey: `${surfaceKey}_question`,
        itemType: 'question_button',
        label: `打开${title}帮助`,
        body: description,
        selector: '[data-help="question"]',
        docHref,
        orderIndex: 0,
      },
      {
        itemKey: `${surfaceKey}_primary_tooltip`,
        itemType: 'tooltip',
        label: `${title}提示`,
        body: `在这个页面确认${title}相关设置，再让智能体开始执行。`,
        selector: `[data-help="${surfaceKey}"]`,
        docHref,
        orderIndex: 1,
      },
      {
        itemKey: `${surfaceKey}_example`,
        itemType: 'example_value',
        label: exampleLabel,
        body: '示例值会显示在对应输入位置旁边。',
        selector: `[data-example="${surfaceKey}"]`,
        docHref,
        exampleValue: { value: exampleText },
        orderIndex: 2,
      },
      {
        itemKey: `${surfaceKey}_error_link`,
        itemType: 'error_doc_link',
        label: `${title}问题帮助`,
        body: '当校验失败或任务卡住时显示这个链接。',
        selector: `[data-error="${surfaceKey}"]`,
        docHref: '/docs/troubleshooting/common-issues.md',
        orderIndex: 3,
      },
    ],
  }
}

async function auditHelp(
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: JsonObject,
): Promise<void> {
  await recordAuditLog({
    actorType: 'system',
    action,
    resourceType,
    resourceId,
    riskLevel: 'low',
    message: `${action} recorded for ${resourceType}.`,
    metadata,
  })
}

function normalizeRequired(value: string, field: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${field} is required`)
  return trimmed
}

function normalizeKey(value: string, field: string): string {
  return normalizeRequired(value, field)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 200, 1), 500)
}

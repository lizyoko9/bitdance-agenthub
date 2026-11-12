import { and, asc, desc, eq, inArray } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type { SkillRow } from '@/db/schema'
import { newSkillId } from '@/server/ids'
import { fetchSkillFromGitHub } from '@/server/skill-fetch'
import {
  isBuiltinContentEdit,
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_MAX,
  validateSkillDraft,
  type SkillDraftInput,
} from '@/shared/skill-validation'

/**
 * Skill（方法论模块）服务。内置 seed 只读（可启停不可删/编）；user/imported 全 CRUD。
 * 创建/编辑 Agent 时按 id 选用；运行时由 AgentRunner 解析为指令注入上下文。
 *
 * 解析期对缺失/禁用的 id **静默跳过**（见 openspec 审查修订「缺失引用容错」）。
 */

/** 列出启用中的 Skill；内置在前，再按 createdAt 升序（顺序稳定，便于 UI/测试）。 */
export async function listEnabledSkills(): Promise<SkillRow[]> {
  return db.query.skills.findMany({
    where: eq(schema.skills.enabled, true),
    orderBy: [desc(schema.skills.isBuiltin), asc(schema.skills.createdAt)],
  })
}

/** 列出全部 Skill（含已停用）；供 Skills 库管理界面用。 */
export async function listAllSkills(): Promise<SkillRow[]> {
  return db.query.skills.findMany({
    orderBy: [desc(schema.skills.isBuiltin), asc(schema.skills.createdAt)],
  })
}

/** 列出启用中的公共 skill（isGlobalDefault=true）；顺序与 listEnabledSkills 一致。 */
export async function listPublicSkills(): Promise<SkillRow[]> {
  return db.query.skills.findMany({
    where: and(eq(schema.skills.enabled, true), eq(schema.skills.isGlobalDefault, true)),
    orderBy: [desc(schema.skills.isBuiltin), asc(schema.skills.createdAt)],
  })
}

/**
 * 某 agent 的**有效 Skill** = agent 自选（顺序优先，先拿内联额度）∪ 公共池（排后），按 id 去重。
 * 单一出口：三条 adapter 装配路径 + load_skill 作用域都走它。缺失/禁用/公共禁用均静默剔除。
 */
export async function resolveEffectiveSkills(agent: {
  skillIds?: string[] | null
}): Promise<SkillRow[]> {
  const selected = await resolveSkillsByIds(agent.skillIds ?? [])
  const publicSkills = await listPublicSkills()
  const seen = new Set(selected.map((row) => row.id))
  const merged = [...selected]
  for (const row of publicSkills) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return merged
}

export interface CreateSkillArgs extends SkillDraftInput {
  source?: 'user' | 'imported'
  sourceUri?: string | null
  isGlobalDefault?: boolean
}

export async function createSkill(args: CreateSkillArgs): Promise<SkillRow> {
  const error = validateSkillDraft(args)
  if (error) throw new Error(error)

  const now = Date.now()
  const row = {
    id: newSkillId(),
    name: args.name.trim(),
    description: args.description.trim(),
    category: args.category.trim(),
    instruction: args.instruction.trim(),
    requiredToolNames: args.requiredToolNames ?? [],
    source: args.source ?? 'user',
    sourceUri: args.sourceUri ?? null,
    isGlobalDefault: args.isGlobalDefault ?? false,
    isBuiltin: false,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  } satisfies typeof schema.skills.$inferInsert

  await db.insert(schema.skills).values(row)
  return row
}

export interface UpdateSkillPatch {
  name?: string
  description?: string
  category?: string
  instruction?: string
  requiredToolNames?: string[]
  enabled?: boolean
  isGlobalDefault?: boolean
}

export async function updateSkill(skillId: string, patch: UpdateSkillPatch): Promise<SkillRow> {
  const skill = await db.query.skills.findFirst({ where: eq(schema.skills.id, skillId) })
  if (!skill) throw new Error(`Skill not found: ${skillId}`)

  const provided: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) provided[key] = value
  }
  if (Object.keys(provided).length === 0) return skill

  // 内置 skill 只能启停，不能改内容。
  if (skill.isBuiltin && isBuiltinContentEdit(provided)) {
    throw new Error('Built-in skills can only be enabled/disabled, not edited')
  }

  // 内容字段做整体校验（用 patch 覆盖现有值后校验）。
  if (!skill.isBuiltin) {
    const error = validateSkillDraft({
      name: (patch.name ?? skill.name) as string,
      description: (patch.description ?? skill.description) as string,
      category: (patch.category ?? skill.category) as string,
      instruction: (patch.instruction ?? skill.instruction) as string,
    })
    if (error) throw new Error(error)
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() }
  if (patch.name !== undefined) updates.name = patch.name.trim()
  if (patch.description !== undefined) updates.description = patch.description.trim()
  if (patch.category !== undefined) updates.category = patch.category.trim()
  if (patch.instruction !== undefined) updates.instruction = patch.instruction.trim()
  if (patch.requiredToolNames !== undefined) updates.requiredToolNames = patch.requiredToolNames
  if (patch.enabled !== undefined) updates.enabled = patch.enabled
  if (patch.isGlobalDefault !== undefined) updates.isGlobalDefault = patch.isGlobalDefault

  await db.update(schema.skills).set(updates).where(eq(schema.skills.id, skillId))
  const updated = await db.query.skills.findFirst({ where: eq(schema.skills.id, skillId) })
  if (!updated) throw new Error('Update succeeded but skill row missing afterwards')
  return updated
}

export async function deleteSkill(skillId: string): Promise<void> {
  const skill = await db.query.skills.findFirst({ where: eq(schema.skills.id, skillId) })
  if (!skill) throw new Error(`Skill not found: ${skillId}`)
  if (skill.isBuiltin) throw new Error('Built-in skills cannot be deleted')

  await db.delete(schema.skills).where(eq(schema.skills.id, skillId))
}

export interface ImportSkillsResult {
  created: SkillRow[]
  failed: { index: number; name: string; error: string }[]
}

/** 批量导入：逐条建为 source='imported'，单条失败不阻断其它，返回成功+失败明细。 */
export async function importSkills(drafts: SkillDraftInput[]): Promise<ImportSkillsResult> {
  const created: SkillRow[] = []
  const failed: ImportSkillsResult['failed'] = []
  for (let i = 0; i < drafts.length; i++) {
    try {
      created.push(await createSkill({ ...drafts[i], source: 'imported' }))
    } catch (err) {
      failed.push({
        index: i,
        name: drafts[i]?.name ?? '',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { created, failed }
}

/**
 * 按 id 解析启用中的 Skill，并**保持传入 id 的顺序**（选用顺序即注入优先级）。
 * 缺失 / 已禁用的 id 直接跳过，不报错。
 */
export async function resolveSkillsByIds(skillIds: readonly string[]): Promise<SkillRow[]> {
  const ids = Array.from(new Set(skillIds.filter((id) => typeof id === 'string' && id)))
  if (ids.length === 0) return []

  const rows = await db.query.skills.findMany({
    where: and(inArray(schema.skills.id, ids), eq(schema.skills.enabled, true)),
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => byId.get(id)).filter((row): row is SkillRow => row != null)
}

export interface InstallCatalogSkillArgs {
  sourceUri: string
  category: string
  /** manifest 里精炼的名称/描述（市场卡片展示用）；优先于 SKILL.md frontmatter（后者常是超长英文触发词）。 */
  name?: string
  description?: string
  signal?: AbortSignal
}

const clampTo = (value: string, max: number): string =>
  value.length > max ? value.slice(0, max).trimEnd() : value

/**
 * 从精选目录安装：经 `skill-fetch`（GitHub 主机白名单 + SSRF 防御）拉取 `sourceUri` 指向的
 * SKILL.md，解析后建为 `source='imported'`。**用户点击即授权**，不走 install_skill 的 LLM 审批门；
 * 但 fetch 层防御与 2D 相同。分类取自 catalog（SKILL.md frontmatter 无分类字段）。
 *
 * name/description **优先用 catalog 的精炼值**（真实 SKILL.md 的 description 常是数百字英文触发器，
 * 超 SKILL_DESCRIPTION_MAX），catalog 缺失时才回退 parsed，并统一截断到长度上限，避免校验拒绝。
 */
export async function installCatalogSkill(args: InstallCatalogSkillArgs): Promise<SkillRow> {
  const result = await fetchSkillFromGitHub(args.sourceUri, args.signal)
  if (result.mode !== 'install') {
    throw new Error('该链接指向一个仓库而非单个 SKILL.md，无法直接安装')
  }
  const { parsed, finalUrl } = result
  const name = clampTo((args.name?.trim() || parsed.name || 'Untitled Skill'), SKILL_NAME_MAX)
  const description = clampTo(
    (args.description?.trim() || parsed.description || name),
    SKILL_DESCRIPTION_MAX,
  )
  return createSkill({
    name,
    description,
    category: args.category,
    instruction: parsed.instruction,
    source: 'imported',
    sourceUri: finalUrl,
  })
}

/**
 * 预览：拉取并解析某 GitHub SKILL.md 正文，**不落库**（供在线市场详情弹窗「装之前先看」）。
 * 走与安装相同的 `skill-fetch`（SSRF 白名单），故 url 不可信也拦得住。
 */
export async function previewSkillMarkdown(
  sourceUri: string,
  signal?: AbortSignal,
): Promise<{ name: string; description: string; instruction: string; finalUrl: string }> {
  const result = await fetchSkillFromGitHub(sourceUri, signal)
  if (result.mode !== 'install') {
    throw new Error('该链接指向一个仓库而非单个 SKILL.md，无法预览')
  }
  return { ...result.parsed, finalUrl: result.finalUrl }
}

/**
 * 统计每个 skill 被多少 agent 使用（供市场卡片「被 N 个 agent 使用」）。
 * 公共 skill 视为被所有 agent 使用（= agent 总数）。
 */
export async function countSkillUsage(): Promise<Record<string, number>> {
  const agents = await db.query.agents.findMany()
  const counts: Record<string, number> = {}
  for (const agent of agents) {
    for (const id of agent.skillIds ?? []) {
      counts[id] = (counts[id] ?? 0) + 1
    }
  }
  const publicSkills = await listPublicSkills()
  for (const skill of publicSkills) {
    counts[skill.id] = agents.length
  }
  return counts
}

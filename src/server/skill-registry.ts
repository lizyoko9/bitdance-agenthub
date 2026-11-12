import { z } from 'zod'

/**
 * SkillsMP 在线注册表接入（Phase 2E+）。
 *
 * SkillsMP（https://skillsmp.com）是一个聚合公开 GitHub `SKILL.md` 的社区市场（200 万+）。
 * 我们**只把它当搜索/发现数据源**：拿到候选的 `githubUrl` 后，安装仍走本项目已硬化的
 * `skill-fetch`（GitHub 主机白名单 + IP 校验）——即便注册表返回被篡改的 URL，也 SSRF 不了我们。
 *
 * 该 JSON 搜索 API 是**代码内置的可信第一方端点**（非 LLM/用户选定），故直接 server-side 调用，
 * 不经 skill-fetch（skill-fetch 只管 skill 正文的 GitHub 拉取）。返回体按 zod 校验后才使用。
 */

const SKILLSMP_BASE = 'https://skillsmp.com'
const REGISTRY_TIMEOUT_MS = 15_000
const PAGE_SIZE = 24

export interface RegistrySkill {
  id: string
  name: string
  author: string
  description: string
  /** GitHub 目录/文件链接（tree/blob/raw）；安装时经 skill-fetch 拉取解析。 */
  githubUrl: string
  stars: number
  updatedAt: number | null
}

export interface RegistrySearchResult {
  skills: RegistrySkill[]
  page: number
  hasNext: boolean
  total: number
}

const RawSkill = z.object({
  id: z.string(),
  name: z.string(),
  author: z.string().optional().default(''),
  description: z.string().optional().default(''),
  githubUrl: z.string().url(),
  stars: z.number().optional().default(0),
  updatedAt: z.union([z.string(), z.number()]).optional(),
})

const RawResponse = z.object({
  data: z.object({
    skills: z.array(RawSkill),
    pagination: z
      .object({
        page: z.number(),
        hasNext: z.boolean(),
        total: z.number(),
      })
      .partial()
      .optional(),
  }),
})

/** 查询 SkillsMP 目录。失败抛错（由 API 路由转成 502 + 清晰信息），不影响本地功能。 */
export async function searchSkillRegistry(params: {
  q: string
  page?: number
  sort?: 'stars' | 'recent'
  signal?: AbortSignal
}): Promise<RegistrySearchResult> {
  const url = new URL('/api/v1/skills/search', SKILLSMP_BASE)
  url.searchParams.set('q', params.q)
  url.searchParams.set('sortBy', params.sort ?? 'stars')
  url.searchParams.set('limit', String(PAGE_SIZE))
  if (params.page && params.page > 1) url.searchParams.set('page', String(params.page))

  const timeout = AbortSignal.timeout(REGISTRY_TIMEOUT_MS)
  const composite = params.signal ? AbortSignal.any([params.signal, timeout]) : timeout

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'AgentHub' },
      signal: composite,
    })
  } catch (err) {
    if (timeout.aborted) throw new Error('SkillsMP 搜索超时（网络较慢或访问受限），可重试')
    throw err
  }
  if (res.status === 429) throw new Error('SkillsMP 搜索已达匿名频率上限（50 次/天），请稍后再试')
  if (!res.ok) throw new Error(`SkillsMP 搜索失败：HTTP ${res.status}`)

  const parsed = RawResponse.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new Error('SkillsMP 返回格式异常')

  const { skills, pagination } = parsed.data.data
  return {
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      author: s.author,
      description: s.description,
      githubUrl: s.githubUrl,
      stars: s.stars,
      updatedAt: s.updatedAt != null ? Number(s.updatedAt) || null : null,
    })),
    page: pagination?.page ?? params.page ?? 1,
    hasNext: pagination?.hasNext ?? false,
    total: pagination?.total ?? skills.length,
  }
}

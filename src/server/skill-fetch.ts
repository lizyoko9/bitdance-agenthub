import { lookup } from 'node:dns/promises'

import { parseSkillMarkdown, type ParsedSkillMarkdown } from '@/shared/skill-import'

/**
 * `install_skill` 的出站 fetch + GitHub 解析（spec 16，2D-a）。
 *
 * 安全核心（SSRF 防御，单一数据源）：审批门只能防「装坏内容」，**防不住请求本身**，
 * 所以 SSRF 必须在这一层拦死。任何放宽须在 PR 说明（对齐命令黑名单的单数据源原则）。
 *
 * 本文件上半部是**纯策略函数**（可单测）；下半部是**不纯的 fetch 编排**（依赖网络，
 * 由 2D-d 端到端冒烟覆盖），编排只组合纯函数 + 受控 fetch。
 */

// ─── 常量 / 策略 ───────────────────────────────────────────────

/** 主机白名单（D1：仅 GitHub）。api.github.com 仅供 bare 仓库枚举（§6）。 */
export const ALLOWED_SKILL_HOSTS = new Set([
  'raw.githubusercontent.com',
  'github.com',
  'gist.github.com',
  'gist.githubusercontent.com',
  'api.github.com',
])

export const MAX_SKILL_FETCH_BYTES = 256 * 1024
// 30s：GitHub raw 在部分网络（如大陆直连）握手/传输较慢，10s 常超时。放宽不削弱 SSRF
// （主机白名单 / IP 校验 / 大小上限 / 重定向校验均不变），仅提升慢网可用性。
export const SKILL_FETCH_TIMEOUT_MS = 30_000
export const MAX_SKILL_FETCH_REDIRECTS = 3

const ALLOWED_CONTENT_TYPES = ['text/plain', 'text/markdown', 'application/octet-stream', 'application/json']

export function isAllowedSkillHost(hostname: string): boolean {
  return ALLOWED_SKILL_HOSTS.has(hostname.toLowerCase())
}

/** 可 fetch 的 URL：https + 主机白名单（初始请求与每个重定向跳都要过）。 */
export function isFetchableSkillUrl(rawUrl: string): boolean {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return false
  }
  return u.protocol === 'https:' && isAllowedSkillHost(u.hostname)
}

/** content-type 白名单；缺失头时放行（GitHub raw 偶尔不带），由主机白名单 + 大小上限兜底。 */
export function isAllowedContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return true
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return ALLOWED_CONTENT_TYPES.includes(base)
}

// ─── IP 分类（防解析到内网 / 元数据）─────────────────────────────

function isBlockedIPv4(addr: string): boolean {
  const parts = addr.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true // 畸形一律拦
  }
  const [a, b] = parts
  if (a === 0) return true // "this" network
  if (a === 127) return true // loopback
  if (a === 10) return true // private
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 169 && b === 254) return true // link-local + 云元数据 169.254.169.254
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a >= 224) return true // 多播 / 保留 224-255
  return false
}

/** 解析出的地址是否属于必须拦截的内网/保留段。IPv4 + IPv6（含 ::ffff: 映射）。畸形地址按拦截处理。 */
export function isBlockedAddress(ip: string): boolean {
  const addr = ip.trim().toLowerCase()
  if (!addr) return true

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) return isBlockedIPv4(addr)

  // IPv4-mapped IPv6: ::ffff:1.2.3.4
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) return isBlockedIPv4(mapped[1])

  if (addr === '::1' || addr === '::') return true // loopback / unspecified
  if (/^fe[89ab]/.test(addr)) return true // link-local fe80::/10
  if (/^f[cd]/.test(addr)) return true // unique-local fc00::/7
  if (/^ff/.test(addr)) return true // multicast ff00::/8

  // 其它（公网 IPv6 等）放行；非法格式（既不是 v4 也不是已知 v6 形态）保守拦截。
  if (!addr.includes(':')) return true
  return false
}

// ─── GitHub URL 规范化（raw/blob/tree/bare → 计划）──────────────

export type SkillUrlPlan =
  | { kind: 'raw'; url: string }
  | { kind: 'enumerate'; owner: string; repo: string }
  | { kind: 'reject'; reason: string }

/** 把用户给的 GitHub 链接规范化为：直接 raw / bare 仓库枚举 / 拒绝。纯函数。 */
export function planGitHubSkillUrl(input: string): SkillUrlPlan {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return { kind: 'reject', reason: '无效 URL' }
  }
  if (u.protocol !== 'https:') return { kind: 'reject', reason: '仅支持 https 链接' }
  const host = u.hostname.toLowerCase()
  if (!isAllowedSkillHost(host)) {
    return { kind: 'reject', reason: `不支持的主机：${host}（首版仅支持 GitHub 公开链接）` }
  }

  if (host === 'raw.githubusercontent.com' || host === 'gist.githubusercontent.com') {
    return u.pathname.toLowerCase().endsWith('.md')
      ? { kind: 'raw', url: u.toString() }
      : { kind: 'reject', reason: 'raw 链接需指向 .md 文件' }
  }

  if (host === 'github.com') {
    const segs = u.pathname.split('/').filter(Boolean)
    if (segs.length < 2) return { kind: 'reject', reason: '链接缺少 owner/repo' }
    const [owner, repo, type, ref, ...rest] = segs
    if (!type) return { kind: 'enumerate', owner, repo } // bare 仓库 → 枚举
    if (type === 'blob') {
      if (!ref || rest.length === 0) return { kind: 'reject', reason: 'blob 链接不完整' }
      if (!rest[rest.length - 1].toLowerCase().endsWith('.md')) {
        return { kind: 'reject', reason: 'blob 链接需指向 .md 文件' }
      }
      return {
        kind: 'raw',
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join('/')}`,
      }
    }
    if (type === 'tree') {
      if (!ref) return { kind: 'reject', reason: 'tree 链接不完整' }
      const dir = rest.join('/')
      const path = dir ? `${dir}/SKILL.md` : 'SKILL.md'
      return { kind: 'raw', url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}` }
    }
    return { kind: 'reject', reason: `不支持的 github.com 链接类型：${type}` }
  }

  // gist.github.com / api.github.com 不接受直接输入（前者用 gist raw，后者仅内部枚举用）
  return { kind: 'reject', reason: '请提供具体的 SKILL.md / 目录 / 仓库链接' }
}

export interface RepoSkillCandidate {
  /** 仓库内路径，如 skills/pdf/SKILL.md */
  path: string
  /** 所在目录（skill 名通常即目录名），根目录为 '' */
  dir: string
  /** 回传给 install_skill 安装该候选的 blob 链接 */
  installUrl: string
}

/** 从 GitHub trees API 的 JSON 里提取所有 SKILL.md 候选。纯函数。 */
export function parseRepoTreeForSkills(
  treeJson: unknown,
  owner: string,
  repo: string,
  ref: string,
): RepoSkillCandidate[] {
  const tree = (treeJson as { tree?: unknown })?.tree
  if (!Array.isArray(tree)) return []
  const out: RepoSkillCandidate[] = []
  for (const entry of tree) {
    const e = entry as { path?: unknown; type?: unknown }
    if (e?.type !== 'blob' || typeof e.path !== 'string') continue
    if (!/(^|\/)SKILL\.md$/i.test(e.path)) continue
    const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : ''
    out.push({
      path: e.path,
      dir,
      installUrl: `https://github.com/${owner}/${repo}/blob/${ref}/${e.path}`,
    })
  }
  return out
}

// ─── 不纯：受控 fetch 编排（依赖网络；2D-d 端到端冒烟覆盖）────────

/** 校验目标主机解析出的所有 IP 都不在内网/保留段；任一命中即拒绝（防解析到内网）。 */
async function assertHostResolvesPublic(hostname: string): Promise<void> {
  const addrs = await lookup(hostname, { all: true })
  for (const { address } of addrs) {
    if (isBlockedAddress(address)) {
      throw new Error(`目标主机解析到受限地址，已拒绝：${hostname} → ${address}`)
    }
  }
}

/**
 * SSRF 安全 fetch：https + 主机白名单 + 解析 IP 校验 + 逐跳重定向校验 +
 * 大小上限 + 超时 + content-type 白名单 + GET 无凭据。返回最终 URL 与文本。
 */
export async function safeFetchText(
  initialUrl: string,
  signal?: AbortSignal,
): Promise<{ finalUrl: string; text: string }> {
  let url = initialUrl
  for (let hop = 0; hop <= MAX_SKILL_FETCH_REDIRECTS; hop++) {
    if (!isFetchableSkillUrl(url)) throw new Error(`不允许的 fetch 目标：${url}`)
    const { hostname } = new URL(url)
    await assertHostResolvesPublic(hostname)

    const timeout = AbortSignal.timeout(SKILL_FETCH_TIMEOUT_MS)
    const composite = signal ? AbortSignal.any([signal, timeout]) : timeout
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: 'text/plain, text/markdown, application/json' },
        signal: composite,
      })
    } catch (err) {
      // 区分「超时」与「用户主动中止/其它网络错误」，给可操作的中文提示。
      if (timeout.aborted) {
        throw new Error(
          `拉取超时（>${SKILL_FETCH_TIMEOUT_MS / 1000}s）：网络较慢或 GitHub 访问受限。可重试，或改用「导入」直接粘贴 SKILL.md 内容（无需联网）。`,
        )
      }
      throw err
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new Error('重定向缺少 Location')
      url = new URL(location, url).toString() // 下一跳，循环开头重新校验
      continue
    }
    if (!res.ok) throw new Error(`fetch 失败：HTTP ${res.status}`)
    if (!isAllowedContentType(res.headers.get('content-type'))) {
      throw new Error(`不允许的 content-type：${res.headers.get('content-type')}`)
    }
    const declared = Number(res.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > MAX_SKILL_FETCH_BYTES) {
      throw new Error('内容超过大小上限（256KB）')
    }
    const text = await readBounded(res, MAX_SKILL_FETCH_BYTES)
    return { finalUrl: url, text }
  }
  throw new Error('重定向次数过多')
}

/** 流式读取并在超过上限时中止（防超大响应 OOM）。 */
async function readBounded(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel()
      throw new Error('内容超过大小上限（256KB）')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export type SkillFetchResult =
  | { mode: 'install'; finalUrl: string; parsed: ParsedSkillMarkdown }
  | { mode: 'enumerate'; owner: string; repo: string; ref: string; candidates: RepoSkillCandidate[] }

/**
 * 解析用户链接：raw/blob/tree → 拉取并解析单个 SKILL.md（待安装）；
 * bare 仓库 → 经 api.github.com 枚举候选（不安装）。
 */
export async function fetchSkillFromGitHub(
  inputUrl: string,
  signal?: AbortSignal,
): Promise<SkillFetchResult> {
  const plan = planGitHubSkillUrl(inputUrl)
  if (plan.kind === 'reject') throw new Error(plan.reason)

  if (plan.kind === 'raw') {
    const { finalUrl, text } = await safeFetchText(plan.url, signal)
    const parsed = parseSkillMarkdown(text)
    if (!parsed.instruction.trim()) throw new Error('未解析到有效的 skill 正文')
    return { mode: 'install', finalUrl, parsed }
  }

  // enumerate：先取默认分支，再取 trees。
  const repoMeta = await safeFetchText(
    `https://api.github.com/repos/${plan.owner}/${plan.repo}`,
    signal,
  )
  const ref =
    (JSON.parse(repoMeta.text) as { default_branch?: string }).default_branch || 'main'
  const tree = await safeFetchText(
    `https://api.github.com/repos/${plan.owner}/${plan.repo}/git/trees/${ref}?recursive=1`,
    signal,
  )
  const candidates = parseRepoTreeForSkills(JSON.parse(tree.text), plan.owner, plan.repo, ref)
  return { mode: 'enumerate', owner: plan.owner, repo: plan.repo, ref, candidates }
}

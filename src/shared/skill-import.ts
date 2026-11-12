/**
 * Skill 导入解析（纯函数，前后端共用，可单测）。
 *
 * 支持把 Claude Agent Skill 的 `SKILL.md`、纯文本/markdown、AgentHub JSON
 * 解析成可保存的 skill draft。**只取 name/description/instruction**，
 * frontmatter 里的 `allowed-tools` 等权限声明一律丢弃（不扩权，见 design 审查修订）。
 */

export interface ImportedSkillDraft {
  name: string
  description: string
  category: string
  instruction: string
  requiredToolNames: string[]
}

export interface ParsedSkillMarkdown {
  name: string
  description: string
  instruction: string
}

const DEFAULT_IMPORT_CATEGORY = 'imported'

/** 拆出 YAML frontmatter 块与正文。无 frontmatter 时 frontmatter 为空、body 为全文。 */
function splitFrontmatter(text: string): { frontmatter: string; body: string } {
  // 允许文件开头有 BOM / 空白。frontmatter 由首行 --- 起、再遇 --- 止。
  const normalized = text.replace(/^﻿/, '')
  const match = normalized.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { frontmatter: '', body: normalized }
  return { frontmatter: match[1], body: match[2] }
}

/** 极简 YAML：只取顶层 `key: value` 标量行；列表/嵌套（如 allowed-tools 列表）忽略。 */
function parseScalarFrontmatter(frontmatter: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of frontmatter.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('-')) continue
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    let value = m[2].trim()
    if (!value) continue // 空值（后接列表/块）—— 只关心标量，跳过
    // 去掉成对引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function firstHeading(body: string): string {
  const m = body.match(/^\s*#{1,6}\s+(.+?)\s*$/m)
  return m ? m[1].trim() : ''
}

function firstParagraph(body: string, maxChars: number): string {
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const text = block.trim()
    if (!text || text.startsWith('#')) continue
    const oneLine = text.replace(/\s+/g, ' ')
    return oneLine.length > maxChars ? `${oneLine.slice(0, maxChars - 1)}…` : oneLine
  }
  return ''
}

/**
 * 解析 SKILL.md / 纯文本 / markdown → { name, description, instruction }。
 * name/description 优先取 frontmatter，缺失时分别回退到首个标题 / 首段。
 * instruction 取正文（无 frontmatter 时为全文）。allowed-tools 等被丢弃。
 */
export function parseSkillMarkdown(text: string): ParsedSkillMarkdown {
  const { frontmatter, body } = splitFrontmatter(text)
  const fm = parseScalarFrontmatter(frontmatter)

  const name = (fm.name ?? '').trim() || firstHeading(body)
  const description = (fm.description ?? '').trim() || firstParagraph(body, 200)
  const instruction = (body.trim() || text.trim()).trim()

  return { name, description, instruction }
}

/** SKILL.md / 文本 → 单条导入 draft（category 给默认值，待用户在预览里改）。 */
export function skillMarkdownToDraft(text: string): ImportedSkillDraft {
  const parsed = parseSkillMarkdown(text)
  return {
    name: parsed.name,
    description: parsed.description,
    category: DEFAULT_IMPORT_CATEGORY,
    instruction: parsed.instruction,
    requiredToolNames: [],
  }
}

/**
 * 解析 AgentHub JSON（单个对象或数组）→ draft[]。容错：忽略非法条目所需字段缺失由后续校验拦。
 * 只接受我们关心的字段，其它（含任何权限/工具授权字段）忽略。
 */
export function parseSkillsJson(text: string): ImportedSkillDraft[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON 解析失败：请检查格式')
  }
  const items = Array.isArray(data) ? data : [data]
  const drafts: ImportedSkillDraft[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    drafts.push({
      name: str(rec.name),
      description: str(rec.description),
      category: str(rec.category) || DEFAULT_IMPORT_CATEGORY,
      instruction: str(rec.instruction),
      requiredToolNames: Array.isArray(rec.requiredToolNames)
        ? rec.requiredToolNames.filter((t): t is string => typeof t === 'string')
        : [],
    })
  }
  if (drafts.length === 0) throw new Error('未解析到任何 skill')
  return drafts
}

/** YAML 单行标量：去换行；含特殊字符或空串时用 JSON 双引号包裹（合法 YAML）。 */
function yamlScalar(value: string): string {
  const oneLine = value.replace(/\r?\n/g, ' ').trim()
  return oneLine === '' || /[:#"'[\]{}|>&*!?]/.test(oneLine) ? JSON.stringify(oneLine) : oneLine
}

/**
 * 序列化成 Claude Agent Skill 的 SKILL.md（frontmatter name/description + 正文）。
 * 与 parseSkillMarkdown 大致互逆，供 ClaudeCodeAdapter 物化 skill 给 SDK 原生渐进披露用。
 */
export function buildSkillMarkdown(skill: {
  name: string
  description: string
  instruction: string
}): string {
  return `---\nname: ${yamlScalar(skill.name)}\ndescription: ${yamlScalar(skill.description)}\n---\n\n${skill.instruction.trim()}\n`
}


/**
 * 内置精选 Skill 目录（Phase 2E · 市场货架）。
 *
 * 这是一份**静态 manifest**，不含 skill 正文——只描述「哪里能装到好 skill」。
 * 安装时由 `POST /api/skills/install-from-catalog` 经 `skill-fetch`（GitHub 主机白名单 +
 * SSRF 防御）拉取 `sourceUri` 指向的 SKILL.md，解析出正文后建为 `source='imported'`；
 * name/description 优先用下面精炼的中文值（真实 SKILL.md 的 description 常是数百字英文触发器）。
 *
 * `sourceUri` 必须是 `skill-fetch` 白名单内的 GitHub 链接（raw / blob / tree）。
 * 首版指向 anthropics/skills 官方仓库，后续可整批替换为运营选定的源。
 */

export interface CatalogSkill {
  /** 稳定 slug：用于判断是否已安装（与已装 skill 的 sourceUri 尾部比对）、去重。 */
  slug: string
  name: string
  description: string
  category: string
  /** GitHub SKILL.md 源链接（raw/blob/tree），安装时经 skill-fetch 拉取。 */
  sourceUri: string
}

const OFFICIAL = 'https://github.com/anthropics/skills/blob/main/skills'

export const SKILL_CATALOG: CatalogSkill[] = [
  {
    slug: 'anthropic-pdf',
    name: 'PDF 处理',
    description: '解析、抽取、填写、合并 PDF 文档，包括表单字段与文本提取。',
    category: 'Data & APIs',
    sourceUri: `${OFFICIAL}/pdf/SKILL.md`,
  },
  {
    slug: 'anthropic-docx',
    name: 'Word 文档',
    description: '创建与编辑 .docx：样式、章节、表格、批注与修订。',
    category: 'Data & APIs',
    sourceUri: `${OFFICIAL}/docx/SKILL.md`,
  },
  {
    slug: 'anthropic-xlsx',
    name: 'Excel 表格',
    description: '读写 .xlsx / .csv：公式、格式、图表与脏数据清洗重构。',
    category: 'Data & APIs',
    sourceUri: `${OFFICIAL}/xlsx/SKILL.md`,
  },
  {
    slug: 'anthropic-pptx',
    name: 'PowerPoint 演示',
    description: '生成与编辑 .pptx 幻灯片：版式、母版、图表与讲者备注。',
    category: 'Automation',
    sourceUri: `${OFFICIAL}/pptx/SKILL.md`,
  },
  {
    slug: 'anthropic-webapp-testing',
    name: 'Web 应用测试',
    description: '用浏览器自动化对本地 Web 应用做端到端测试与交互验证。',
    category: 'Dev Tools',
    sourceUri: `${OFFICIAL}/webapp-testing/SKILL.md`,
  },
  {
    slug: 'anthropic-frontend-design',
    name: '前端设计',
    description: '产出高质量前端界面的设计方法：布局、排版、配色与组件规范。',
    category: 'Dev Tools',
    sourceUri: `${OFFICIAL}/frontend-design/SKILL.md`,
  },
  {
    slug: 'anthropic-mcp-builder',
    name: 'MCP 构建',
    description: '设计并实现 MCP server 的工作方法：工具定义、协议与最佳实践。',
    category: 'Dev Tools',
    sourceUri: `${OFFICIAL}/mcp-builder/SKILL.md`,
  },
  {
    slug: 'anthropic-brand-guidelines',
    name: '品牌规范',
    description: '按品牌规范产出物料：色板、字体、Logo 用法与视觉一致性。',
    category: 'Automation',
    sourceUri: `${OFFICIAL}/brand-guidelines/SKILL.md`,
  },
]

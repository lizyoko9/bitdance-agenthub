/**
 * DB 启动期自举：建表 + 自动 seed 内置 agent。
 *
 * 设计意图：
 *  - 打包后桌面版第一次启动时，userData 里只有空 DB 文件，没有任何表 / 数据。
 *    本模块在 client.ts 初始化 drizzle 之前同步建表（CREATE TABLE IF NOT EXISTS）。
 *  - 内置 agent 也在此自动 seed —— 不再需要用户手动 `pnpm db:seed`（packaged 应用里也没有 pnpm 可用）。
 *
 * 全部用 better-sqlite3 原生同步 API：
 *  - CJS 标准下 `client.ts` 模块顶层不能 await；drizzle 的 query API 全是 Promise，没法在 module-init 阶段调
 *  - better-sqlite3 是同步的 native binding，prepare/run 立即返回，对 sub-ms 启动期开销可忽略
 *
 * 幂等：
 *  - CREATE TABLE IF NOT EXISTS 不重复建表
 *  - seed 前先查 is_builtin=1 是否已有记录，已有就跳过
 *
 * 详见 Spec 12 §5 / §6 与 Spec 08。
 */
import type Database from 'better-sqlite3'

import { BUILTIN_AGENTS, UI_DESIGNER_ARTIFACT_PROMPT_HINT } from './builtin-agents'
import { BUILTIN_SKILLS } from './builtin-skills'

const FRONTEND_DEPLOYMENT_PROMPT_HINT =
  'deploy_artifact / deploy_workspace 返回的 previewPath 是当前 AgentHub 实例下的相对路径，不要在文字总结里把它改写成公网域名或自造完整 URL；让用户点击部署卡片按钮，或原样引用 previewPath。'
const FRONTEND_LOCAL_WORKSPACE_PROMPT_HINT =
  '当 workspace_info mode=local 且用户要求创建 / 修改 / 初始化 / 调试前端项目、源码文件、依赖或构建配置时，优先使用 fs_read / fs_write / bash 直接操作本地文件并运行验证；不要用 write_artifact 代替应该落盘的源码。构建出 dist/build/out 等静态目录后，可用 deploy_workspace 生成部署预览卡。只有用户明确要求网页产物、可预览原型、artifact 或独立 demo 时，才用 write_artifact + deploy_artifact。'
const REVIEWER_LOCAL_WORKSPACE_PROMPT_HINT =
  '本地代码审查先用 fs_read 查看关键文件，必要时用 bash 运行检查命令；不要只根据文件名、任务摘要或 artifact 占位做判断。'
const BUILTIN_TOOL_UPGRADES = new Map(
  BUILTIN_AGENTS.map((agent) => [agent.id, agent.toolNames] as const),
)

const DDL: string[] = [
  // ─── agents ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    description TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    adapter_name TEXT NOT NULL,
    model_provider TEXT,
    model_id TEXT,
    api_key TEXT,
    api_base_url TEXT,
    tool_names TEXT NOT NULL,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    is_orchestrator INTEGER NOT NULL DEFAULT 0,
    supports_vision INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,

  // ─── conversations ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    mode TEXT NOT NULL,
    agent_ids TEXT NOT NULL,
    pinned_message_ids TEXT NOT NULL DEFAULT '[]',
    bookmarked_message_ids TEXT NOT NULL DEFAULT '[]',
    archived INTEGER NOT NULL DEFAULT 0,
    pinned_at INTEGER,
    fs_write_approval_mode TEXT NOT NULL DEFAULT 'review',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at)`,

  // ─── messages ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    agent_id TEXT REFERENCES agents(id),
    parts TEXT NOT NULL,
    status TEXT NOT NULL,
    parent_message_id TEXT,
    mentioned_agent_ids TEXT NOT NULL DEFAULT '[]',
    run_id TEXT,
    usage TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at)`,

  // ─── artifacts ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    parent_artifact_id TEXT,
    created_by_agent_id TEXT NOT NULL REFERENCES agents(id),
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artifacts_conv ON artifacts(conversation_id)`,

  // ─── workspaces ────────────────────────────────
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
    root_path TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'sandbox',
    bound_path TEXT,
    created_at INTEGER NOT NULL
  )`,

  // ─── attachments ───────────────────────────────
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_attachments_conv ON attachments(conversation_id)`,

  // ─── agent_runs ────────────────────────────────
  `CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    trigger_message_id TEXT,
    status TEXT NOT NULL,
    error TEXT,
    parent_run_id TEXT,
    usage TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_runs_parent ON agent_runs(parent_run_id)`,

  // ─── conversation_context_summaries ─────────────────────────
  `CREATE TABLE IF NOT EXISTS conversation_context_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    covered_until_message_id TEXT NOT NULL,
    covered_until_created_at INTEGER NOT NULL,
    source_message_count INTEGER NOT NULL,
    token_estimate INTEGER NOT NULL,
    model_provider TEXT,
    model_id TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_context_summaries_conv_created ON conversation_context_summaries(conversation_id, created_at)`,

  // ─── app_settings ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    anthropic_api_key TEXT,
    anthropic_base_url TEXT,
    openai_api_key TEXT,
    deepseek_api_key TEXT,
    ark_api_key TEXT,
    companion_mode TEXT NOT NULL DEFAULT 'off',
    mobile_device_token TEXT,
    deployment_publish_enabled INTEGER NOT NULL DEFAULT 0,
    deployment_publish_dir TEXT,
    deployment_public_base_url TEXT,
    updated_at INTEGER NOT NULL
  )`,

  // ─── skills (可复用方法论模块) ──────────────────
  `CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    instruction TEXT NOT NULL,
    required_tool_names TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'user',
    source_uri TEXT,
    is_global_default INTEGER NOT NULL DEFAULT 0,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`,
]

/** 建表 / 建索引（幂等）。 */
function ensureSchema(sqlite: Database.Database): void {
  for (const stmt of DDL) {
    sqlite.exec(stmt)
  }
  safeAlter(sqlite, `ALTER TABLE app_settings ADD COLUMN companion_mode TEXT NOT NULL DEFAULT 'off'`)
  safeAlter(sqlite, `ALTER TABLE app_settings ADD COLUMN mobile_device_token TEXT`)
  safeAlter(sqlite, `ALTER TABLE app_settings ADD COLUMN deployment_publish_enabled INTEGER NOT NULL DEFAULT 0`)
  safeAlter(sqlite, `ALTER TABLE app_settings ADD COLUMN deployment_publish_dir TEXT`)
  safeAlter(sqlite, `ALTER TABLE app_settings ADD COLUMN deployment_public_base_url TEXT`)
  safeAlter(sqlite, `ALTER TABLE agents ADD COLUMN skill_ids TEXT NOT NULL DEFAULT '[]'`)
  safeAlter(sqlite, `ALTER TABLE skills ADD COLUMN source TEXT NOT NULL DEFAULT 'user'`)
  safeAlter(sqlite, `ALTER TABLE skills ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
  safeAlter(sqlite, `ALTER TABLE skills ADD COLUMN source_uri TEXT`)
  safeAlter(sqlite, `ALTER TABLE skills ADD COLUMN is_global_default INTEGER NOT NULL DEFAULT 0`)
  // 已存在的内置 skill（Phase 2 早期 seed，无 source 列）回填为 builtin，避免被默认 'user' 误标。
  sqlite.exec(`UPDATE skills SET source = 'builtin' WHERE is_builtin = 1 AND source != 'builtin'`)
}

function safeAlter(sqlite: Database.Database, stmt: string): void {
  try {
    sqlite.exec(stmt)
  } catch (err) {
    if (err instanceof Error && err.message.includes('duplicate column name')) return
    throw err
  }
}

/** 已有任意 builtin agent 就跳过；否则一次插入全部。 */
function ensureBuiltinAgents(sqlite: Database.Database): void {
  const row = sqlite
    .prepare('SELECT 1 AS one FROM agents WHERE is_builtin = 1 LIMIT 1')
    .get()
  if (row) return

  const insert = sqlite.prepare(`
    INSERT INTO agents (
      id, name, avatar, description, capabilities, system_prompt,
      adapter_name, model_provider, model_id, api_key, api_base_url,
      tool_names, is_builtin, is_orchestrator, supports_vision, created_at
    ) VALUES (
      @id, @name, @avatar, @description, @capabilities, @system_prompt,
      @adapter_name, @model_provider, @model_id, @api_key, @api_base_url,
      @tool_names, @is_builtin, @is_orchestrator, @supports_vision, @created_at
    )
  `)

  const tx = sqlite.transaction((agents: typeof BUILTIN_AGENTS) => {
    for (const a of agents) {
      insert.run({
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        description: a.description,
        capabilities: JSON.stringify(a.capabilities),
        system_prompt: a.systemPrompt,
        adapter_name: a.adapterName,
        model_provider: a.modelProvider ?? null,
        model_id: a.modelId ?? null,
        api_key: a.apiKey ?? null,
        api_base_url: a.apiBaseUrl ?? null,
        tool_names: JSON.stringify(a.toolNames),
        is_builtin: a.isBuiltin ? 1 : 0,
        is_orchestrator: a.isOrchestrator ? 1 : 0,
        supports_vision: a.supportsVision ? 1 : 0,
        created_at: a.createdAt,
      })
    }
  })

  tx(BUILTIN_AGENTS)
}

/** 已有任意 builtin skill 就跳过；否则一次插入全部内置 Skill（幂等，同 ensureBuiltinAgents）。 */
function ensureBuiltinSkills(sqlite: Database.Database): void {
  const row = sqlite.prepare('SELECT 1 AS one FROM skills WHERE is_builtin = 1 LIMIT 1').get()
  if (row) return

  const insert = sqlite.prepare(`
    INSERT INTO skills (
      id, name, description, category, instruction, required_tool_names,
      source, is_builtin, enabled, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @category, @instruction, @required_tool_names,
      @source, @is_builtin, @enabled, @created_at, @updated_at
    )
  `)

  const tx = sqlite.transaction((skills: typeof BUILTIN_SKILLS) => {
    for (const s of skills) {
      insert.run({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        instruction: s.instruction,
        required_tool_names: JSON.stringify(s.requiredToolNames ?? []),
        source: 'builtin',
        is_builtin: s.isBuiltin ? 1 : 0,
        enabled: s.enabled === false ? 0 : 1,
        created_at: s.createdAt,
        updated_at: s.updatedAt ?? s.createdAt,
      })
    }
  })

  tx(BUILTIN_SKILLS)
}

function upgradeBuiltinAgents(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare('SELECT id, tool_names, system_prompt FROM agents WHERE is_builtin = 1')
    .all() as { id: string; tool_names: string; system_prompt: string }[]

  const update = sqlite.prepare(
    'UPDATE agents SET tool_names = ?, system_prompt = ? WHERE id = ? AND is_builtin = 1',
  )

  for (const row of rows) {
    let changed = false
    let toolNames: string[]
    try {
      const parsed = JSON.parse(row.tool_names) as unknown
      toolNames = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : []
    } catch {
      toolNames = []
    }

    for (const toolName of BUILTIN_TOOL_UPGRADES.get(row.id) ?? []) {
      if (toolNames.includes(toolName)) continue
      if (toolName === 'deploy_artifact') {
        const insertAfter = toolNames.indexOf('write_artifact')
        if (insertAfter >= 0) toolNames.splice(insertAfter + 1, 0, toolName)
        else toolNames.push(toolName)
      } else {
        toolNames.push(toolName)
      }
      changed = true
    }

    let systemPrompt = row.system_prompt
    if (row.id === 'ag_frontend' && !systemPrompt.includes('deploy_artifact')) {
      systemPrompt +=
        '\n\n完成 web_app 产物后必须调用 deploy_artifact，让用户在消息里拿到部署状态卡和可打开的本地预览路径。'
      changed = true
    }
    if (
      row.id === 'ag_frontend' &&
      !systemPrompt.includes('不要在文字总结里把它改写成公网域名')
    ) {
      systemPrompt += `\n\n${FRONTEND_DEPLOYMENT_PROMPT_HINT}`
      changed = true
    }
    if (
      row.id === 'ag_frontend' &&
      (!systemPrompt.includes('不要用 write_artifact 代替应该落盘的源码') ||
        !systemPrompt.includes('deploy_workspace'))
    ) {
      systemPrompt += `\n\n${FRONTEND_LOCAL_WORKSPACE_PROMPT_HINT}`
      changed = true
    }
    if (row.id === 'ag_reviewer' && !systemPrompt.includes('本地代码审查先用 fs_read')) {
      systemPrompt += `\n\n${REVIEWER_LOCAL_WORKSPACE_PROMPT_HINT}`
      changed = true
    }
    if (row.id === 'ag_designer' && !systemPrompt.includes('禁止 write_artifact({})')) {
      systemPrompt += `\n\n${UI_DESIGNER_ARTIFACT_PROMPT_HINT}`
      changed = true
    }

    if (changed) update.run(JSON.stringify(toolNames), systemPrompt, row.id)
  }
}

export function bootstrapDatabase(sqlite: Database.Database): void {
  ensureSchema(sqlite)
  ensureBuiltinAgents(sqlite)
  upgradeBuiltinAgents(sqlite)
  ensureBuiltinSkills(sqlite)
}

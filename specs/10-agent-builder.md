# Spec 10 — 自建 Agent

> 用户在前端通过表单创建 / 编辑 Agent，不需要改代码。本 spec 定义可配置字段、Provider 支持矩阵、API key 优先级、内置 vs 自建的差异。

源文件：`src/app/agents/new/page.tsx`、`src/components/agent-studio.tsx`、`src/components/create-agent-dialog.tsx`、`src/components/agent-create-wizard.tsx`、`src/shared/agent-templates.ts`、`src/shared/agent-builder-config.ts`、`src/server/agent-draft-service.ts`、`src/server/agent-service.ts`、`src/db/seed.ts`、`src/app/api/agents/`

---

## 定位

自建 Agent 默认 `adapterName='custom'`，也可以选择 `claude-code` 或 `codex` SDK adapter（详见 Spec 05）。新建入口统一为 Agent 列表顶部的「创建 Agent」按钮；点击后进入 `/agents/new` 的 Agent Studio 页面，用户可从模板市场创建，也可从零创建。编辑已有 Agent 时仍直接进入详细配置弹窗。用户配置：

- 身份：name / avatar / description / capabilities
- 行为：systemPrompt
- 模型：custom 走 modelProvider + modelId；SDK adapter 走 modelId
- 凭据：可选 apiKey / apiBaseUrl（per-agent override）
- 能力：custom 走 toolNames（勾选）+ supportsVision；SDK adapter 使用各自内置工具集

Agent Studio 的模板市场首版是静态蓝图：模板用于生成可编辑 `AgentConfigDraft`，不会新增模板数据库表，也不会保存用户密钥。Skills、RAG、MCP 在首版模板详情中作为专业能力和依赖预览展示；真正持久化与运行时接线在后续阶段单独实现。

**自建不可成为 Orchestrator**：当前 service 把 `isOrchestrator` 写死为 `false`（`agent-service.ts:44`）。Orchestrator 只能通过 seed 数据预置（`src/db/seed.ts`）。UI 没有创建 Orchestrator 的入口。**TODO**：未来如要支持「自建 Orchestrator」，需要：
1. CreateAgentDialog 加 `isOrchestrator` toggle
2. service 加约束「装备了 plan_tasks 才能 isOrchestrator=true」
3. 群聊新建对话时 enforce 「最多 1 个 Orchestrator」

---

## 可配置字段

源：`src/components/create-agent-dialog.tsx`

| 字段 | 类型 | 必填 | 默认 | 备注 |
|---|---|---|---|---|
| `name` | string | ✓ | — | trim 后非空 |
| `description` | string | ✓ | — | trim 后非空，UI 一句话简介 |
| `capabilities` | string[] | — | `[]` | 用逗号 / 空格 / 中文逗号分隔，自动 split |
| `systemPrompt` | string | ✓ | Custom agent scaffold | 决定 agent 行为；创建态默认填入可编辑的 harness 模板 |
| `modelProvider` | enum | — | `'deepseek'` | 见下方 Provider 矩阵 |
| `modelId` | string | — | provider 默认 | 切换 provider 时自动重置 |
| `apiKey` | string | — | `''` | 命名 provider 留空走 env var；`openai-compatible` 必填 per-agent key |
| `apiBaseUrl` | string | — | `''` | Claude Code 可填 Anthropic 兼容 endpoint；Codex 仅可填 Codex/Responses 兼容 endpoint；Custom `openai-compatible` 必填 Chat Completions 兼容 endpoint |
| `toolNames` | string[] | — | 全栈通用预设 | 当前可勾选：`write_artifact` / `deploy_artifact` / `deploy_workspace` / `read_artifact` / `read_attachment` / `ask_user` / `fs_read` / `fs_write` / `bash` |
| `supportsVision` | boolean | — | `true` | 决定是否把图片 base64 注入 messages |
| `avatar` | string | — | `'🤖'` | service 层默认（UI 当前不暴露） |
| `isBuiltin` | boolean | — | `false` | service 写死，UI 不可改 |
| `isOrchestrator` | boolean | — | `false` | service 写死，UI 不可改 |

---

## Provider 支持矩阵

源：`src/components/create-agent-dialog.tsx:26-33`、`src/server/adapters/custom-agent-adapter.ts`

| Provider | UI label | 默认 modelId | Adapter 状态 |
|---|---|---|---|
| `deepseek` | DeepSeek | `deepseek-v4-flash` | ✅ 已接（OpenAI-compat）+ 支持 reasoning_content |
| `volcano-ark` | 火山方舟 (豆包) | `doubao-seed-2-0-lite-260428` | ✅ 已接（OpenAI-compat） |
| `openai` | OpenAI | `gpt-4o` | ✅ 已接 |
| `openai-compatible` | OpenAI-compatible | — | ✅ 已接；要求 per-agent `apiKey` + `apiBaseUrl` |
| `anthropic` | Anthropic | `claude-opus-4-7` | ❌ buildClient 里 throw（TODO） |

**OpenAI-compat 接入说明**：DeepSeek / 火山方舟都对外暴露 OpenAI-compatible Chat Completions API，所以共用 `openai` npm 包 + 改 `baseURL`。通义千问 compatible-mode、智谱、MiniMax、OpenRouter、SiliconFlow、Moonshot 等未内置 provider 应选择 `openai-compatible`，并填写该平台的 Chat Completions Base URL。详见 Spec 05 的「CustomAgentAdapter」一节。

**SDK adapter 说明**：
- `claude-code`：使用 `@anthropic-ai/claude-agent-sdk`，`toolNames=[]`，SDK 内置工具集；Review 模式通过 `canUseTool` 桥到 AgentHub 审批。
- `codex`：使用 `@openai/codex-sdk`，`toolNames=[]`，SDK 内置本地命令 / 文件变更 / MCP / 计划事件；Review 模式以 read-only sandbox 运行，Auto 模式以 workspace-write sandbox 运行；自定义 Base URL 必须支持 Codex/Responses，DeepSeek 没有 `/responses`，不能走 Codex adapter。

**用户选 Anthropic 会发生什么**：创建 / 编辑成功（DB 行写入），但发消息时 Adapter throw → run 失败 → 错误消息显示在对话里。**TODO**：UI 应该在选 Anthropic 时给警告 banner，或者干脆暂时下掉这个选项。

---

## API Key 优先级

```
agent.apiKey (per-agent 自定义)
       │
       ├─ 非空 → 用这个
       │
       └─ NULL / 空 → fallback 到 env var：
            deepseek    → DEEPSEEK_API_KEY
            volcano-ark → ARK_API_KEY
            openai      → OPENAI_API_KEY
            openai-compatible → 无全局 fallback，必须填 agent.apiKey
            anthropic   → ANTHROPIC_API_KEY
            codex       → CODEX_API_KEY / OPENAI_API_KEY（AgentHub 隔离 CODEX_HOME，不读 ~/.codex）
```

Custom provider 实现在 `custom-provider-client.ts` 的 `resolveCustomProviderClientConfig(provider, overrideKey, apiBaseUrl)`；SDK adapter 的 key 解析由 `agent-runner.ts:buildAdapterInput` 统一注入。

`apiBaseUrl` 不是跨 adapter 通用的“OpenAI 兼容”开关。Claude Code 的 Base URL 走 Anthropic 兼容协议；Codex 的 Base URL 走 Codex/Responses runtime；Custom `openai-compatible` 的 Base URL 才走 OpenAI Chat Completions 兼容协议。

**UI 行为**：
- 输入框默认 password 类型，旁边有「显示 / 隐藏」按钮（`create-agent-dialog.tsx:267-302`）
- 输入框下方动态显示「留空则 fallback 到 `<ENV_VAR_NAME>`」提示，跟随当前 provider 切换
- 选择 `openai-compatible` 时显示并要求填写 Base URL；API key 也必须为该 agent 单独填写
- 编辑模式回填已保存的 key（password 形式）

**安全**：
- `.env.local` 是 gitignored（CLAUDE.md §5.4）
- DB 里 api_key 是明文存的（SQLite 本地文件 + 单用户场景；如果未来 multi-user 需要加密）
- 前端 GET /api/agents 当前**会返回 apiKey 字段**给 UI（用于编辑回填），不暴露给非用户场景即可

---

## 工具勾选

源：`src/shared/agent-builder-config.ts`

```typescript
const AVAILABLE_AGENT_TOOLS = ['write_artifact', 'deploy_artifact', 'deploy_workspace', 'read_artifact', 'read_attachment', 'ask_user', 'fs_read', 'fs_write', 'bash'] as const
```

UI 当前允许勾选产物、附件和 workspace 相关常用工具。`plan_tasks` 不在列表里 —— 因为它是 Orchestrator 专用，自建 agent 不应装备。

每个勾选项展示面向用户的中文 label + 一句权限说明 + 原始工具名（来自同文件的 `AGENT_TOOL_META`），而不是只露裸工具名。

工具区提供 4 个一键预设：

| 预设 | 工具 | 用途 |
|---|---|---|
| 全栈通用 | 全部 `AVAILABLE_AGENT_TOOLS` | 默认；既能创建 artifact，也能直接读写本地 workspace 并运行命令 |
| 本地代码 | `deploy_workspace` / `read_artifact` / `read_attachment` / `ask_user` / `fs_read` / `fs_write` / `bash` | 读取上游产物，直接在当前 workspace 初始化、修改、验证项目源码，并部署已构建静态目录 |
| 产物交付 | `write_artifact` / `deploy_artifact` / `deploy_workspace` / `read_artifact` / `read_attachment` / `ask_user` | PRD、设计稿、网页原型、文档等聊天内交付；也可发布已有 workspace 静态目录 |
| 审查验证 | `read_artifact` / `read_attachment` / `ask_user` / `fs_read` / `bash` | 读取产物或本地代码并运行检查，不默认写文件 |

**新增工具时**：除了在 `src/server/tools/registry.ts` 注册，还要在 `src/shared/agent-builder-config.ts` 的 `AVAILABLE_AGENT_TOOLS` 加上、并在 `AGENT_TOOL_META` 补一条文案，才能在 UI 正常勾选（详见 Spec 07 「新增工具步骤」）。

---

## 内置 Agent vs 自建 Agent

`agents.is_builtin` 列区分。差异：

| 行为 | 自建 (is_builtin=false) | 内置 (is_builtin=true) |
|---|---|---|
| 创建 | UI / API | seed 数据（`src/db/seed.ts`）+ `pnpm db:seed` |
| 编辑配置 | ✅ | ✅（早期不允许，已开放） |
| 删除 | ✅ | ❌ service 层 throw `'Built-in agents cannot be deleted'` |
| `isOrchestrator` | 写死 false | seed 可设 true |

**为什么内置可改但不可删**：用户可能想换 API key / 改 system prompt（合理需求），但内置是「应用预设角色」，删了会破坏 demo 体验。如要重置内置 agent，跑 `pnpm db:seed` 重新种子（seed 脚本是 upsert）。

---

## Agent Studio / 模板市场

源：`src/app/agents/new/page.tsx`、`src/components/agent-studio.tsx`、`src/shared/agent-templates.ts`

`/agents/new` 是新建 Agent 的完整页面，首屏是模板市场，而不是「左侧模板列表 + 右侧详情」的配置页。市场页采用「左侧分类导航栏（带每类计数）+ 右侧主区」布局，吃掉超宽屏横向留白：主区顶部是 Hero 渐变横幅（标题 + 搜索 + 统计条：模板数 / 领域数 / 多模型适配），下方在「全部 + 无搜索」时按「精选推荐（spotlight 大卡 + 普通卡）+ 按分类分区网格」策展展示；有搜索或选中分类时退化为单一匹配网格。点击任意模板卡片后，进入统一的配置界面：左侧分区表单，右侧 sticky 实时预览卡。配置界面不保留模板列表侧栏。

首屏提供两个入口：

| 入口 | 行为 |
|---|---|
| 模板市场 | 分类栏 + Hero + 策展网格；卡片展示分类、风险等级、推荐模型和能力 mini-badge（Skills / RAG / MCP / 工具数量），featured 模板带「推荐 / 热门 / 新」策展徽章，hover 浮出适用场景；进入配置界面后右侧预览卡展示场景、Skills、RAG、MCP 与风险说明 |
| 从零创建 | 左侧分类栏顶部的主按钮（移动端为分类条首位）；进入同一套配置界面（空白草稿），System Prompt 区提供「用对话生成草稿」内嵌 wizard 助手，生成后回填同一张表单 |

模板字段除基础信息外，还含 `featured`（是否进精选）和 `badge`（`recommended` / `hot` / `new` 策展徽章）。首版内置模板来自 `AGENT_TEMPLATES` 静态配置，覆盖研发、审查、产品、数据、知识库、运维、写作等领域（全栈实现、代码审查、API 集成、测试、前端、安全审计、产品方案、需求分析、数据分析、SQL、知识库客服、运维排障、技术文档、翻译本地化等角色）。每个模板包含：

- `name` / `avatar` / `description` / `category` / `tags`
- `scenarios` / `capabilities`
- `recommendedProvider` / `recommendedModelId`
- `toolNames` / `supportsVision`
- `skillHighlights` / `knowledgeNeeds` / `mcpNeeds`
- `riskLevel` / `riskSummary`
- `systemPrompt`

配置界面（模板来源与从零创建共用）会维护一份草稿，用户可在保存前修改：

- 名称、描述、能力标签
- Adapter（custom / claude-code / codex）/ Provider / Model ID / 视觉开关
- Base URL / API Key（per-agent override，校验对齐 CreateAgentDialog：codex 须 Responses 兼容、openai-compatible 须填 key/baseUrl）
- AgentHub toolNames 和工具预设（SDK adapter 走内置工具集，隐藏勾选）。`install_skill` 是 **opt-in 额外能力**（出站安装 Skill，默认不在任何预设；custom 在工具清单里勾、SDK adapter 在「额外能力」开关里勾，跨 adapter 都通过 `toolNames` 保留，见 spec 07/16 + CLAUDE.md §5.5）
- Skills（Phase 2）：多选可复用方法论模块（`agents.skill_ids`），对所有 adapter 生效，运行时注入 system prompt（Spec 13）。Skill 不授予工具权限，勾选后若缺少建议工具会给依赖提示。**创建（Agent Studio）与编辑（CreateAgentDialog）入口同步提供 Skill 选择**。
- System Prompt

模板来源时，右侧预览卡额外展示 Skills / RAG / MCP 依赖预览和风险说明（首版仅预览，不随模板保存）。保存统一走 `saveForm` → `POST /api/agents`，保存出来的是普通自建 Agent。由于首版不改 `agents` 表，模板来源和版本不会落库；后续模板持久化阶段再引入 `templateId` / `templateSnapshot`。

## 创建 / 编辑流程

源：`create-agent-dialog.tsx` / `agent-create-wizard.tsx`（UI）+ `agent-draft-service.ts` / `agent-service.ts`（service）+ `app/api/agents/`（API）

### 创建

```
[用户点 + 新建 Agent]
       │
       ▼
router.push('/agents/new')
       │
       ▼
AgentStudio
       ├─ 模板市场 → 选择模板 → createAgentDraftFromTemplate（静态蓝图，不落库）
       │                         │
       │                         ▼
       │                  配置界面（左表单 + 右 sticky 预览）
       │                  编辑：身份 / adapter / 模型 / Base URL / Key / 工具 / System Prompt
       │                         │
       │                         ▼
       │                  saveForm → POST /api/agents
       │
       └─ 从零创建 → 同一套配置界面（空白草稿）
                     │
                     ├─（可选）「用对话生成草稿」内嵌 wizard → 回填表单
                     └─ saveForm → POST /api/agents
       │
       ▼
POST /api/agents { name, description, ..., modelProvider, modelId, apiKey?, apiBaseUrl? }
       │
       ▼
createCustomAgent: avatar='🤖' 默认，adapterName='custom'，isBuiltin=false, isOrchestrator=false
       │
       ▼
返回 AgentRow → upsertAgent(row) 入 store
```

**对话创建约束**：
- draft 只是一份 `AgentConfigDraft`，不会直接写 `agents` 表
- 保存仍走现有 `POST /api/agents` + `createCustomAgent`
- 工具权限来自 `src/shared/agent-builder-config.ts` 中的确定性预设推断，review 页逐项展示权限说明
- 默认生成普通自建 Agent，不包含 `plan_tasks` 等 Orchestrator 专用工具
- 用户可从 review 页切到详细配置继续调整 provider / model / toolNames / systemPrompt

### 编辑

```
[用户在 sidebar / popover 点编辑]
       │
       ▼
CreateAgentDialog (open, agent=existingRow)
       │
       │ 初始化表单 useEffect 回填字段
       │ 提交 → submit
       ▼
PATCH /api/agents/:id { ...patch, adapterName? }  // 编辑弹窗会提交当前 adapterName
       │
       ▼
updateCustomAgent: 部分更新；切到 SDK adapter 时 modelProvider=null、toolNames=[]；apiKey null 显式清空
       │
       ▼
返回 AgentRow → upsertAgent(row) 入 store
```

**重要**：apiKey 字段语义是三态：
- `undefined` → 不改
- `null` → 显式清空（fallback 到 env）
- `string` → 设值（trim 后空字符串等价 null）

---

## API 路由清单

| Method | Path | 用途 |
|---|---|---|
| `GET` | `/api/agents` | 列出全部 agent（按 is_builtin desc + created_at desc） |
| `POST` | `/api/agents/draft` | 根据用户描述生成创建草稿；只返回 `AgentConfigDraft`，不落库 |
| `POST` | `/api/agents` | 创建自建 agent |
| `PATCH` | `/api/agents/[id]` | 更新（内置也可） |
| `DELETE` | `/api/agents/[id]` | 删除（内置拒绝） |

zod 校验 body 在每个 route 文件内。

---

## 表单 UX 注意点

- **新建 Custom agent 预填 system prompt**：创建态默认填入一段可编辑模板，强调先判断上下文、少而准地用工具、产物走 `write_artifact`、网页完成后 `deploy_artifact`、`fs_write` / `bash` 只在 workspace 范围内必要时使用。用户可直接替换
- **Provider 切换重置 modelId**：避免 `provider=openai, modelId=deepseek-v4-flash` 这种串味；`openai-compatible` 默认 modelId 为空，强制用户填写目标平台模型名
- **API key 输入是 password 类型 + autocomplete=off**：防止浏览器把它存进 form autofill
- **错误提示就近显示**：submit 失败时在 footer 上方显示 inline red banner，不用 toast
- **打开 / 切换 agent 时 reset 表单**：用 `useEffect([open, agent])` 重置 state，避免编辑 A 后切到编辑 B 时残留 A 的输入

---

## 待补功能 (TODO)

- **自建 Orchestrator**：UI 不能创建带 `isOrchestrator=true` 的 agent；需要 plan_tasks 工具 + 群聊约束
- **Avatar 选择器**：当前自建 agent 默认 `'🤖'`，用户不能改。UI 可加 emoji picker / 上传图
- **导入 / 导出 agent 配置**：JSON 格式导出，分享配置；导入时校验
- **删除自建 agent 的二次确认**：当前一键删除，加 Dialog 确认更稳
- **Anthropic 路径实装**：buildClient 不要 throw，接入 `@anthropic-ai/sdk` 的 messages API

---

## 与其它 spec 的关系

- Spec 01：Agent 实体字段定义
- Spec 05：CustomAgentAdapter 是自建 agent 的运行时
- Spec 07：toolNames 引用的工具系统
- Spec 08：agents 表的 `api_key` / `supports_vision` 等列

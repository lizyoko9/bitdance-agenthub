## Context

现有 Agent Builder 已经具备以下基础：

- 详细配置表单：支持 system prompt、adapter、provider、model、API key、base URL、toolNames 和 vision 配置。
- 对话创建草稿：`add-agent-create-wizard` 已规划并完成通过用户意图生成 `AgentConfigDraft`，最终仍走现有创建 API。
- 工具预设：`src/shared/agent-builder-config.ts` 已有 tool presets 和权限说明。
- 外部 MCP：`specs/15-external-mcp.md` 已有设计提案，但状态仍是未实现。
- RAG：当前只有 bounded history、pinned messages 和 context summary，没有完整知识库检索系统。

SuperAgent 的设计不重做已有 wizard，而是在它之上建立完整的 Agent Studio，让用户从“填配置”转向“选择专业能力并生成 Agent”。

## Goals

- 创建一个独立 Agent 创建页，承载模板市场和自定义创建。
- 支持从模板创建 Agent，并允许用户二次编辑模型、提示词、Skills、RAG、MCP 和工具权限。
- 将 Agent 专业化能力建模为可组合模块：Skill Packs、Knowledge Bases、MCP Servers、Tool Policy。
- 保证模板是蓝图，用户 Agent 是实例；模板更新不应自动改变已创建 Agent 的运行行为。
- 让运行时真正使用这些配置，而不是只在 UI 上展示。
- 形成可按阶段执行的任务清单，后续开发按 `tasks.md` 推进。

## Non-Goals

- 不把模板市场做成外部开放生态，首版以本地内置模板和用户自定义模板为主。
- 不强制一次性完成 Skills、RAG、MCP 的全部运行时能力。
- 不改变当前核心多 Agent 会话模型。
- 不引入 Postgres、云向量库或新的大规模基础设施。
- 不在模板中保存用户的明文 API key；模板只声明依赖，实例保存用户自己的配置。

## Product Shape

建议新增页面：

```text
/agents/new
  ├─ Template Market
  │   ├─ 分类/搜索/推荐
  │   ├─ 全宽模板卡片网格
  │   └─ 点击模板后进入独立详情/配置页
  │
  └─ Custom Builder
      ├─ 基础信息
      ├─ 模型配置
      ├─ 系统提示词/对话生成草稿
      ├─ Skills
      ├─ RAG 知识库
      ├─ MCP 连接
      ├─ 工具权限
      └─ 能力预览与测试
```

首屏推荐两个入口：

1. 从模板创建：适合普通用户，先选场景，再补齐依赖。
2. 从零创建：适合高级用户，直接配置模型和专业能力。

模板市场首页不应使用「左侧模板列表 + 右侧详情」布局。首屏应像应用市场一样用全宽卡片网格展示模板；点击卡片、使用模板或查看详情后，才进入该模板的详情配置页。

模板卡片展示：

- 名称、描述、分类、标签。
- 适用场景和能力摘要。
- 内置 Skills。
- 需要绑定的知识库类型。
- 需要配置的 MCP server。
- 推荐模型和最低能力要求。
- 工具权限和风险等级。

## Core Domain Model

### AgentTemplate

模板是创建蓝图，不是运行实例。

```text
agent_templates
- id
- name
- description
- category
- tags
- icon
- defaultSystemPrompt
- recommendedAdapterName
- recommendedModelProvider
- recommendedModelId
- skillIds
- knowledgeBaseRequirements
- mcpServerRequirements
- toolNames
- supportsVisionDefault
- permissionPolicy
- visibility
- version
- createdBy
- usageCount
- createdAt
- updatedAt
```

> **字段语义不对称（审查修订）**：`skillIds` 是**具体引用**（Skill 是全局可复用、无用户私有数据，模板可直接引用）。但 `knowledgeBaseRequirements` / `mcpServerRequirements` 只能是**软需求声明**（自由文本/标签描述「需要绑定哪类知识库 / 哪种 MCP」），**绝不**存具体 KB id 或 MCP server id——那些含用户私有数据与凭据，模板跨用户复用会泄漏。从模板创建时，KB/MCP 由用户在自己的实例里现配。

### Agent

Agent 是用户实际创建出的实例。它可以引用模板来源，但必须保存关键配置快照。

```text
agents
- existing fields...
- templateId?
- templateVersion?
- templateSnapshot?
- skillIds
- knowledgeBaseIds
- mcpServerIds
- permissionPolicy?
```

快照语义：`templateSnapshot` 存创建时模板配置的**完整冻结 JSON blob**（name / systemPrompt / 推荐模型 / toolNames / skillIds / KB·MCP 需求声明等），实例的运行行为**只依赖快照**，与 `agent_templates` 表解耦。`templateId` / `templateVersion` 仅作来源追溯与「是否升级」提示用；模板后续改名、改配置、甚至删除都**不影响**已建 Agent。不要用「只存版本号指针、运行时回查模板表」的方案——那会让模板变更悄悄改变老 Agent 行为。

> **审查修订（snapshot 语义）**：明确为完整 blob，而非版本指针。见文末「审查修订」。

### Skill

Skill 是方法论和工作流说明，不是可执行工具。

```text
skills
- id
- name
- description
- category
- instruction
- requiredToolNames
- recommendedKnowledgeBaseTags
- recommendedMcpServerNames
- version
- enabled
- createdAt
- updatedAt
```

运行时将 Skill instruction 注入 system/context，帮助 Agent 采用领域工作流。

### Knowledge Base

知识库是 Agent 的领域知识来源。

```text
knowledge_bases
- id
- name
- description
- tags
- retrievalMode
- createdAt
- updatedAt

knowledge_documents
- id
- knowledgeBaseId
- title
- sourceType
- sourceUri
- mimeType
- status
- createdAt
- updatedAt

knowledge_chunks
- id
- documentId
- chunkIndex
- content
- tokenEstimate
- metadata
- embedding?
```

首版可以先做 RAG-lite：文档上传、文本切块、关键词/FTS 检索、`search_knowledge` 和 `read_knowledge_doc` 工具。向量检索作为后续增强。

### MCP Server

沿用 `specs/15-external-mcp.md` 的方向：全局定义 MCP server，Agent 显式 opt-in。

```text
mcp_servers
- id
- name
- transport
- command?
- args?
- env?
- url?
- headers?
- trust
- enabled
- createdAt
- updatedAt
```

Agent 通过 `mcpServerIds` 引用可用 MCP server。

## Creation Flow

### From Template

```text
模板市场网格浏览模板
  -> 点击模板卡片 / 使用模板 / 查看详情
  -> 进入独立模板详情配置页
  -> 系统生成 AgentConfigDraft
  -> 检查缺失依赖
  -> 用户补齐模型/API key/知识库/MCP 凭证
  -> 预览 system prompt、Skills、RAG、MCP、工具权限
  -> 保存 Agent 实例
```

保存时必须走统一 Agent 创建 API，不允许模板页面直接写数据库。

### From Scratch

```text
选择从零创建
  -> 基础信息
  -> 模型配置
  -> system prompt 或对话生成草稿
  -> 选择 Skills
  -> 绑定 Knowledge Bases
  -> 绑定 MCP Servers
  -> 配置工具权限
  -> 预览并保存
```

现有 `AgentConfigDraft` 可以复用为中间草稿，但需要扩展字段支持 `skillIds`、`knowledgeBaseIds`、`mcpServerIds` 和权限策略。

## Runtime Assembly

Agent 运行时的专业化输入建议按固定顺序组合：

```text
1. Base system prompt
2. AgentHub runtime/tool safety guidance
3. Skill instructions
4. Retrieved knowledge snippets
5. MCP/tool availability summary
6. Conversation history / pinned messages / summaries
7. Current user turn
```

优先级原则：

- 安全与工具约束高于用户模板和 Skill。
- Skill 只描述工作方法，不允许绕过工具权限。
- RAG 只注入检索到的相关片段，不把整库塞进 prompt。
- MCP 工具只在用户显式启用的 server 中暴露。
- token 预算不足时，优先保留当前用户问题、安全约束、关键 Skill、最相关 RAG 片段。

## API Surface

首版建议新增或扩展：

```text
GET  /api/agent-templates
GET  /api/agent-templates/[id]
POST /api/agents/from-template

GET  /api/skills
GET  /api/knowledge-bases
POST /api/knowledge-bases
POST /api/knowledge-bases/[id]/documents

GET  /api/mcp-servers
POST /api/mcp-servers
POST /api/mcp-servers/[id]/test
```

也可以不单独做 `/api/agents/from-template`，而是在前端根据模板生成 draft 后继续走 `POST /api/agents`。如果模板依赖检查和快照逻辑复杂，建议服务端提供 dedicated endpoint。

## Phasing

### Phase 1: Agent Studio Shell And Template Market

目标：先让用户进入独立创建页，并能从内置模板生成普通 Agent。

- 新增 `/agents/new` 页面。
- Create Agent 按钮跳转到该页面。
- 新增内置模板数据源，可以先是静态配置。
- 模板详情页生成可编辑草稿。
- 保存仍走现有 agent 创建 API。
- 不新增数据库表也可以完成最小闭环。

### Phase 2: Template Persistence And Skill Packs

目标：模板和 Skills 开始可管理、可复用。

- 新增 `agent_templates` 和 `skills`。
- Agent 增加 `templateId`、`templateSnapshot`、`skillIds`。
- 创建页支持选择/取消 Skills。
- 运行时将 Skills 注入上下文。

### Phase 3: RAG-lite Knowledge Bases

目标：让 Agent 能绑定领域知识库并通过工具检索。

- 新增 knowledge base/document/chunk 表。
- 支持上传/导入文本类文档。
- 实现切块和关键词/FTS 检索。
- 新增 `search_knowledge` 和 `read_knowledge_doc` 工具。
- AgentRunner 根据 Agent 绑定的知识库限制检索范围。

### Phase 4: MCP Server Registry

目标：让 Agent 可以绑定外部 MCP 连接。

- 按 `specs/15-external-mcp.md` 实现 `mcp_servers`。
- Agent 增加 `mcpServerIds`。
- Claude Code / Codex 优先接线外部 MCP。
- custom adapter 的完整 MCP client 放后续阶段。
- UI 必须展示 trust、安全提示和连接测试结果。

### Phase 5: Marketplace And Template Lifecycle

目标：把模板市场从内置列表升级为可运营能力。

- 支持用户保存当前 Agent 为模板。
- 支持模板版本、升级提示、复制、删除。
- 支持分类、搜索、使用次数。
- 后续再考虑团队共享、审核、评分。

## Security And Permission Model

- 模板不能携带用户 API key 或私有凭证。
- 从模板创建 Agent 时必须展示即将授予的工具、RAG、MCP 权限。
- MCP 默认不启用，必须显式绑定到 Agent。
- MCP 的 `trust='ask'` 应作为默认策略，沿用 per-tool-per-conversation 审批方向。
- Knowledge Base 检索必须限制在 Agent 绑定的知识库集合内。
- Skill instruction 不能扩大工具权限，只能影响行为策略。

## Risks / Trade-offs

- 范围容易膨胀：通过 Phase 1 到 Phase 5 控制，每阶段都能独立验收。
- 模板和 Agent 配置可能耦合：用 `templateSnapshot` 保证实例稳定。
- RAG 质量影响专业度：首版先做 RAG-lite，避免过早引入复杂向量基础设施。
- MCP 安全风险高：延续现有外部 MCP 设计，优先做显式 opt-in、trust 和审批。
- 创建页过重：首屏只给“模板市场”和“从零创建”，复杂配置放到后续步骤。

## 审查修订（落地约束）

> 2026-06-18 审查后补充的硬约束与决策，实现各阶段时必须遵守。对应 `tasks.md` 中新增的任务。

### 编辑入口必须与创建入口同步（必修）

每个引入新配置维度的阶段（P2 Skills / P3 知识库 / P4 MCP），**创建流程加选择 UI 的同时，必须把同一选择 UI 加进「编辑已有 Agent」入口**（当前是 `CreateAgentDialog`）。否则会出现「能创建带 Skill 的 Agent，却无法编辑/移除它」的只进不出。若某期确实暂不支持编辑，必须在该期任务里**显式写明并留 TODO**，不得静默缺失。

### 模板持久化重排到 P5（建议）

内置模板继续以代码常量 `AGENT_TEMPLATES` 定义；`agent_templates` 表**只存用户自建模板**，因此真正需要建表是在 P5（用户存为模板）。P2 的硬交付是 **Skills**；`agent_templates` 表 + `templateId` / `templateSnapshot` 字段可随 P5 落地。这样避免在没有用户模板前就过早建快照机器。若坚持 P2 建表，则必须包含「把内置模板 seed 进表 / 或决定 DB 只存用户模板」的明确步骤，不可两边语义悬空。

### 缺失引用的解析期容错（必修）

运行时解析 `skillIds` / `knowledgeBaseIds` / `mcpServerIds` 时，对**已删除/不存在/被禁用**的 id 一律**静默跳过、不崩 run**（与 MCP「disabled/missing 不暴露」同款）。删除 Skill / 知识库 / MCP server 不需要级联清理 agent 引用，由解析期求交兜底。

### 知识检索工具严格作用域（必修）

`search_knowledge` / `read_knowledge_doc` 的允许范围一律由 `ctx.agentId` 反查 `agent.knowledgeBaseIds` 得出。若工具参数允许传 kbId/docId，**必须与绑定集求交**，集合外的 id 一律拒绝（返回 tool error），**不得**信任调用方（模型）传入的任意 id 越权访问其它知识库。

### Skill 预算策略：先丢整条，不做 summarize（首版）

Skill 指令超出 context 预算时，按优先级**整条丢弃或截断**，**不**在首版引入「summarize 低优先级 Skill」（那需要额外 LLM 调用，是独立子系统）。现有 `buildAdapterInput` 的 `historyBudget = contextWindow - outputReserve - promptEstimate` 会随 system prompt 增大自动压缩历史，机制可直接复用。summarize 列为后续增强。

### 装配单一出口

「Skill 指令 / 检索片段 / MCP·工具可用性摘要」注入 system prompt 时，扩展现有 `buildAgentHubToolGuidance`（spec 13 的装配点），而不是各加一段 ad-hoc 文本，保持装配顺序单一可测。装配顺序见 conversation-context delta。

### RAG 检索实现风险（P3 开工前验证）

P3 的关键词/FTS 检索**不预设** SQLite FTS5 可用：开工前先验证当前 `better-sqlite3` 是否编译带 FTS5。不可用则先上 LIKE / 朴素分词倒排兜底，向量检索作为后续增强（`knowledge_chunks.embedding` 列先留空 nullable）。chunk 大小与单次检索返回片段数都要有明确上限。

### 模板不得携带密钥（贯穿 P5）

「存为模板」（P5）与「导入模板 JSON」（P5）两条路径都必须**剥除 / zod 拒绝** `apiKey` / `apiBaseUrl` / MCP headers·env 等密钥字段，对应 persistence delta「Templates SHALL NOT persist user secrets」。导入路径尤其要防夹带。

## Skills 增强方案（Phase 2 完善 · 2026-06-19）

> 决策：Skills 从「只读内置」升级为「用户可**自建 / 导入 / 会话安装**」，并把注入模型改为**渐进披露**。分 4 个子模块增量交付（2A→2B→2C→2D），2D 涉及出站网络与安全约束**需单独评审后实现**。已实现的「always 注入 + 1500 预算整条丢」会被 2C 改写。

### 数据模型增量

`skills` 表加：
- `source`: `'builtin' | 'user' | 'imported'`
- `updatedAt`: integer

`ids.ts` 加 `newSkillId()` → `skill_<nanoid>`。规则对齐 agent：`source='builtin'` 可禁用、不可删除/编辑；`user` / `imported` 全 CRUD。

### 2A 基础：CRUD + 独立「Skills 库」

- service：`createSkill / updateSkill / deleteSkill`（zod：name、instruction 必填，instruction 长度上限；禁止删/编 builtin）。
- API：`POST /api/skills`、`PATCH /api/skills/[id]`、`DELETE /api/skills/[id]`。
- UI：侧栏新增「Skills 库」Tab（与 Agent 库同构）：列表 + 新建/编辑/删除/启用开关 + 每条 token 估算 + 导入按钮；Agent Studio 的 Skill 多选区加「管理」快捷入口。
- 风险：低（纯本地）。

### 2B 导入（SKILL.md / 纯文本 / .md 上传 / AgentHub JSON）

- 纯函数解析器（可单测）`parseSkillMarkdown(text)` → `{ name, description, instruction }`：解析 YAML frontmatter（**只取 name/description**）+ markdown 正文；无 frontmatter 时整段当 instruction、name 取首标题或要求补填。
- `POST /api/skills/import`：入参 `{ format, payload }` → 返回 draft（不直接落库，前端预览后再走 `POST /api/skills`）。
- UI：库内「导入」弹窗，四源 → 预览 → 保存（JSON 支持批量）。
- 安全：导入**只取 name/description/instruction**，丢弃 frontmatter 里的 `allowed-tools` 及任何权限声明（不扩权）。
- 风险：低。

### 2C 渐进披露 —— **按 adapter 分策略**（关键修订 2026-06-19）

**事实依据**（查 `node_modules` 实装 SDK 类型定义得出）：
- **Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）原生就有渐进披露**：从磁盘发现 `SKILL.md`（按 `settingSources`，含 project 的 `.claude/skills/`），默认只把 name+description 进上下文，模型需要时调原生 **`Skill` 工具**加载正文。开关 `options.skills: string[] | 'all'`，另有 `getSkills()` / `reloadSkills()`。我们的 `claude-code-adapter.ts` 已设 `settingSources: ['project']` + `cwd = workspace`，只差没设 `options.skills`。
- **Codex SDK（`@openai/codex-sdk`）无任何 skill 支持**（包内 0 处引用），用 `AGENTS.md` 平铺，无渐进披露。

因此**不做统一自建披露**，按 adapter 分三种策略：

| adapter | 渐进披露由谁做 | 策略 |
|---|---|---|
| **custom** | 无 SDK，AgentHub 自做 | catalog + 短 skill 内联 + 自建 `load_skill`（见下） |
| **codex** | SDK 无原生支持 | 同 custom：AgentHub 自做（`load_skill` 经 agenthub MCP bridge 暴露） |
| **claude-code** | **SDK 原生已做** | **桥接到原生**：run 前把选中的 DB skill 物化成 `.claude/skills/<name>/SKILL.md` 写进 workspace + 设 `options.skills:[names]`，让 SDK 的 `Skill` 工具接管；**不自建 `load_skill`**（避免与原生重复打架）；run 结束清理临时 skill 目录 |

**custom / codex 的自做披露**（混合注入）：
- 始终注入精简 **catalog**：每条 `- {name}: {description}` + 提示「相关时调用 `load_skill(skillId)` 取完整方法」。
- **短 skill（instruction ≤ `INLINE_SKILL_TOKENS`，建议 350）直接内联全文**，保证内置短方法论总是生效；长 skill 仅进 catalog。
- 内联预算随模型上下文浮动 `min(3000, ctx*8%)`、下限 1500；超预算长内联降级为「仅 catalog」（不整条消失）。
- 工具 `load_skill`：入参 `{ skillId }`；作用域必须 ∈ `agent.skillIds`（**求交、集合外拒**）；返回完整 instruction（单次有上限）；缺失/禁用返回 error；agent 选了 skill 时自动可用，不占用户工具勾选位；custom 经 toolRegistry，codex 经 agenthub MCP bridge。

**claude-code 的桥接细节**：
- 物化点：workspace 的 effective cwd 下 `.claude/skills/<slug>/SKILL.md`，frontmatter 写 `name`/`description`，正文为 instruction。
- 启用：`options.skills` 设为选中 skill 的 name 列表（精确控制，不靠 `'all'` 误带入 workspace 里用户自己的 skill）。
- 清理：run 结束/中止时删掉本次物化的临时 skill 目录（复用子进程/资源清理路径），不污染用户的 local workspace。
- 边界：local 模式 workspace 是用户真实目录，物化要避免覆盖用户已有的同名 `.claude/skills/<name>`（命名加 agenthub 前缀或先探测）。

**公共改造**：`shared/skill-context.ts` 拆 `buildSkillCatalog()` + `selectInlineSkillsWithinBudget()`（custom/codex 用）；`agent-runner.buildSkillContextBlock` 按 `agent.adapterName` 分派（claude-code 走物化分支，不注入 catalog）；同步 spec 13 装配顺序 + spec 05（claude-code 物化 skill）。
- 风险：中-高（三端策略不同 + claude-code 文件物化/清理 + local 模式不污染用户目录）。

### 2D 会话安装 `install_skill`（最重，单独评审）

- opt-in 工具，加入 `AVAILABLE_AGENT_TOOLS`（**默认关闭**，用户在 agent 上显式勾选）。
- 入参 `{ url }`（或 `{ name, instruction }` 直传）。
- 流程：fetch URL → GitHub repo/目录链接解析到 raw `SKILL.md`（raw.githubusercontent / GitHub API）→ `parseSkillMarkdown` → 建 skill（`source='imported'`）→ 绑定当前 agent（`ctx.agentId` 追加 skillIds）→ 返回安装摘要。
- **存储模型**：skill 统一存 **DB**（单一事实源），不直接落 `.skills` 文件夹；claude-code 运行时再由 2C 的桥接逻辑物化成 SKILL.md（与 Claude Code「装到 .skills 文件夹」的差异写进文档）。
- 安全（实现前先把本节固化进 spec，对应 CLAUDE.md §5）：
  1. 出站 fetch 防 SSRF：只允许 http(s)，阻断 localhost/回环/内网段（10./172.16-31./192.168./169.254./::1 等），限大小（如 256KB）、超时、重定向次数、content-type（markdown/plain/json、GitHub raw）。
  2. 审批门：复用 fs_write 的 pending 机制——安装前推「待确认 skill」给前端，展示来源 URL + 解析出的 name/description/instruction 预览，用户批准才落库绑定；拒绝则 tool 返回未安装。
  3. 不扩权：丢弃 allowed-tools；安装的 skill 仍只注入文本。
  4. 失败隔离：fetch/解析失败返回清晰 tool error，不崩 run。
- 影响 spec：07（新工具）、11 / 平台安全（出站 fetch 黑白名单）、CLAUDE.md §5（新增「Skill 出站安装信任模型」，**改安全约束需讨论**）、可参照 15。
- 风险：高（新出站网络 + 新安全约束 + GitHub 解析）。

### 落地顺序与对已有代码的影响

- 顺序 2A → 2B → 2C → 2D；2D 单独评审后再动。
- 2C 改写已合入的 always-inject/1500-drop 逻辑（`agent-runner.buildSkillContextBlock` / `skill-context.ts`）。
- 每步：specs 同步 + `typecheck`/`lint` + 针对性测试。

## Skills 市场 + 公共池方案（Phase 2E · 2026-07-06）

> 决策（与用户讨论拍板）：把「Skills 库」升级为**市场式浏览**（卡片网格 + 左侧分类栏 + 搜索 + 排序），数据源 = 本地 `skills` 表 + 一份**内置精选目录**（manifest）；并引入**公共池**语义——公共 skill 自动挂给所有 agent，其余保持 opt-in（现有 `skillIds`）。市场安装**用户点击即授权**（不走 2D 的 LLM 审批门），但仍**强制过 `skill-fetch` SSRF 白名单**。动机：用户反馈内置 skill 偏弱，市场 + 精选目录让优质 skill 可发现、可一键装。

### 数据模型增量
`skills` 表加：
- `isGlobalDefault`: boolean，默认 false（bootstrap `safeAlter`，**不 db:push**；builtin/现有行回填 false）。true = 公共，自动挂所有 agent。

### 公共 / opt-in 语义（甲案）
- **有效 skill = `{enabled 且 isGlobalDefault}` ∪ `resolveSkillsByIds(agent.skillIds)`**，按 id 去重。
- 新增 `resolveEffectiveSkills(agent)` 作为**单一出口**，三 adapter 路径都改用它（custom/codex 文本注入 + claude-code 物化）。
- **顺序**：agent 自选排前（优先拿内联额度），公共排后；超预算的降级为 catalog + `load_skill`，不整条丢（延续 2C 策略）。
- 缺失 / 已删除 / 禁用的 id 照旧解析期静默跳过，不崩 run。

### 市场页（UI）
- 现有 `skill-library.tsx` 升级为市场式卡片网格：左侧分类栏 + 搜索 + 排序（分类 / 名称 / 使用数 / 最近更新 / 来源）。
- 卡片：图标、名称、描述、分类、来源徽章（builtin/user/imported/catalog）、公共徽章、**「被 N 个 agent 使用」**（替代远程下载数——本地单用户无社区计数）。
- 未装的精选目录条目灰显 + 「安装」按钮。

### 内置精选目录（catalog manifest）
- `src/shared/skill-catalog.ts`：静态 `{ name, description, category, sourceUri }[]`，指向 GitHub 上优质 SKILL.md。这就是「市场货架」，首版放占位若干条（指向可信 GitHub），待用户替换为心仪源。
- 「安装」= `skill-fetch` 拉取（复用 2D 的 `skill-fetch.ts`：主机白名单 / SSRF / 大小 / 超时 / 重定向校验）→ `parseSkillMarkdown`（丢 allowed-tools）→ 导入预览弹窗（复用 2B `skill-import-dialog`）→ `createSkill(source='imported', sourceUri)`。

### 安全边界（与 2D 的区分）
- **2D `install_skill`**：LLM 驱动出站 → 必须走审批门（模型可能被提示注入诱导）。
- **2E 市场安装**：用户在 UI 点击发起 → **用户即审批者**（预览确认即可），无需额外审批门。
- 但**两者 fetch 层防御完全相同**：都过 `skill-fetch` 主机白名单 + IP 校验（防精选目录被篡改指向内网 / 元数据）。
- 解析仍只取 `name/description/instruction`，丢 allowed-tools，**绝不扩权**。

### 风险
- 低-中：一列 + runtime 求并 + UI 重做；复用现成 `skill-fetch` / `skill-import` / `skill-context`。公共池过大会拉长 catalog，但 catalog 条目廉价（`- id · name: desc`）+ `load_skill` 兜底，可控。

### 在线市场：SkillsMP 注册表接入（Phase 2E+ · 2026-07-07）
> 决策（与用户讨论 skillsmp.com 后拍板）：静态精选目录之外，再接入 **SkillsMP 在线注册表**（聚合公开 GitHub `SKILL.md` 的社区市场，200 万+），让市场页支持海量搜索。学习自 SkillsMP 的做法：skill = GitHub 仓库里的 SKILL.md、定期同步；star 直接取仓库 star 数（不自建评分）；提供开放搜索 API + MCP。

- **数据源**：`GET https://skillsmp.com/api/v1/skills/search?q=&sortBy=stars|recent`（匿名 50 次/天）。返回 `{id,name,author,description,githubUrl,stars,updatedAt}`。
- **架构**：服务端模块 `src/server/skill-registry.ts`（zod 校验 + 15s 超时 + 错误隔离）→ API 代理 `GET /api/skills/registry?q=&page=&sort=` → 前端 `skill-marketplace.tsx` 加「在线市场」tab（debounce 400ms + ≥2 字搜索）。
- **安装复用**：在线卡片「安装」= `installCatalogSkill({ sourceUri: githubUrl, category: author })`，即复用 2E 的 `skill-fetch` 拉取路径（githubUrl 多为 `tree` 目录链接，`planGitHubSkillUrl` 已支持 → raw SKILL.md）。
- **安全（关键）**：SkillsMP 的搜索 JSON 是**代码内置的可信第一方端点**，直接 server-side 调用（不经 skill-fetch）；但其**返回的 `githubUrl` 是不可信数据**——安装时仍强制过 `skill-fetch` 主机白名单 + IP 校验，故**即便注册表被篡改也 SSRF 不了我们**（防御纵深）。install 语义同 2E 市场安装：用户点击即授权、不走 LLM 审批门、丢 allowed-tools、不扩权。
- **已知局限**：① 匿名频率上限；② 安装仍需连 GitHub（大陆访问慢的问题不因接注册表而消失，「导入」粘贴仍是离线兜底）；③ SkillsMP 的 star 是「仓库级」共享值，非单 skill 评分。

## Rollback Plan

如果 Agent Studio 首版效果不佳，可以保留原有 create dialog 入口作为 fallback。Phase 1 不要求数据库迁移，回滚成本低。涉及新表的后续阶段应保证：

- 新字段默认空数组或 null。
- 未配置 Skills/RAG/MCP 的 Agent 按现有逻辑运行。
- 新工具不影响没有绑定知识库的 Agent。

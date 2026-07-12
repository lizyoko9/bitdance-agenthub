## 0. Alignment

- [x] 0.1 Confirm scope: SuperAgent means Agent Studio + template market + specialization modules, not a full rewrite of chat/runtime.
- [x] 0.2 Confirm this change builds on `add-agent-create-wizard` and does not duplicate the conversational draft flow.
- [x] 0.3 Decide whether Phase 1 keeps template data as static config or starts with `agent_templates` persistence.

## 1. Phase 1 - Agent Studio Shell And Template Market

- [x] 1.1 Read the relevant Next.js 16 docs in `node_modules/next/dist/docs/` before adding routes/pages.
- [x] 1.2 Add `/agents/new` as the full-page Agent Studio entry.
- [x] 1.3 Change the existing "Create Agent" action to open Agent Studio instead of only showing a form/dialog.
- [x] 1.4 Build the Agent Studio landing state with two entries: template market and custom creation.
- [x] 1.5 Add a template market list with category/search-ready structure and initial built-in templates.
- [x] 1.6 Add template detail view showing scenario, recommended model, Skills, RAG needs, MCP needs, tool permissions, and risk level.
- [x] 1.7 Generate an editable `AgentConfigDraft` from a selected template.
- [x] 1.8 Save template-created agents through the existing agent creation API/service.
- [x] 1.9 Keep edit-existing-agent behavior compatible with the current detailed editor.
- [x] 1.10 Update `openspec/specs/agent-builder/spec.md` and `specs/10-agent-builder.md`.
- [x] 1.11 Run targeted tests/typecheck/lint for the touched UI and shared draft logic.
- [x] 1.12 Redesign Phase 1 UI as a full-width template market grid with a separate template detail/configuration view.

## 2. Phase 2 - Skill Packs (+ optional Template Persistence)

> 审查重排（design「模板持久化重排到 P5」）：本期**硬交付是 Skills**。`agent_templates` 表 + `templateId`/`templateSnapshot` 可推迟到 P5（真正出现用户自建模板时）；若本期就建表，必须完成 2.1b 的归属决策，不留两边语义悬空。

- [x] 2.1 Design final Drizzle schema for `skills` and `agents.skillIds`.
- [~] 2.1b （延后到 P5）`agent_templates` 本期未建：内置模板继续以代码常量 `AGENT_TEMPLATES` 定义，表留到 P5。
- [x] 2.2 Update persistence + conversation-context specs before implementing schema/assembly changes.（specs/08 + specs/13 + specs/10 已更新）
- [~] 2.3 （延后到 P5）template CRUD/list service —— 本期不建表，跳过。
- [x] 2.4 Add Skill list/read service boundaries with zod validation.（`skill-service.ts` + `/api/skills`）
- [x] 2.5 Extend `AgentConfigDraft` and create/update payloads with `skillIds`.（`templateId`/`templateSnapshot` 随 P5 表一起）
- [x] 2.6 Add Agent Studio Skill selection UI and dependency hints.
- [x] 2.6b **编辑入口同步**：Skill 选择 UI 已加进 `CreateAgentDialog`（创建+编辑共用）。
- [x] 2.7 Inject selected Skill instructions into AgentRunner context assembly：`buildSkillContextBlock` 在 `buildAdapterInput` 工具指导后注入；超预算整条丢弃（不 summarize）。
- [x] 2.7b 解析期对缺失/不存在/禁用的 `skillId` 静默跳过、不崩 run（`resolveSkillsByIds`）。
- [x] 2.8 Add tests for Skill context injection（`skill-context.test.ts`：预算选取/整条丢弃/顺序/格式）。
- [~] 2.9 `pnpm db:push`：本期改用 bootstrap 启动期自举（`CREATE TABLE IF NOT EXISTS skills` + `safeAlter` 加 `agents.skill_ids` + seed 内置 Skill），无需手动 db:push；dev 需**重启**以应用。

## 2+. Phase 2 完善 - 用户 Skills（自建 / 导入 / 渐进披露 / 会话安装）

> 2026-06-19 决策（见 design「Skills 增强方案」）。增量交付 2A→2B→2C→2D；2C 会改写已合入的 always-inject/1500-drop 注入逻辑；2D 涉及出站网络与安全约束，**实现前先把安全设计固化进 spec 并单独评审**。

### 2A 基础：CRUD + 独立 Skills 库
- [x] 2A.1 `skills` 表加 `source`('builtin'|'user'|'imported') + `updatedAt`；`ids.ts` 加 `newSkillId()`（bootstrap safeAlter + 内置行 source 回填，不用 db:push）。
- [x] 2A.2 service `createSkill / updateSkill / deleteSkill`（zod 校验 `shared/skill-validation.ts`；builtin 仅启停、不可删/编）。
- [x] 2A.3 API `POST /api/skills`、`PATCH /api/skills/[id]`、`DELETE /api/skills/[id]`（zod 校验 body；GET `?all=1` 给库管理）。
- [x] 2A.4 侧栏新增「Skills 库」Tab（`skill-library.tsx` + `skill-form-dialog.tsx`）：列表 + 新建/编辑/删除/启停 + 每条 token 估算 + 来源徽章。
- [x] 2A.5 Agent Studio Skill 多选区加「新建」内联入口（建后自动刷新+选中）。
- [x] 2A.6 测试：`skill-validation.test.ts`（字段/长度/builtin 内容编辑判定）+ `bootstrap.test.ts`（建列/seed source/回填）。

### 2B 导入（SKILL.md / 文本 / .md / JSON）
- [x] 2B.1 纯函数 `parseSkillMarkdown` / `parseSkillsJson` / `skillMarkdownToDraft`（`shared/skill-import.ts`）：解析 frontmatter（**只取 name/description**，丢 allowed-tools）+ 正文；无 frontmatter 回退首标题/首段。
- [x] 2B.2 `POST /api/skills/import`（service `importSkills`）：批量建为 `source='imported'`，单条失败不阻断、返回成功+失败明细。
- [x] 2B.3 库内「导入」弹窗（`skill-import-dialog.tsx`）：SKILL.md/文本/.md 上传/JSON（批量）→ 解析预览编辑（名称/分类/描述补全）→ 导入。
- [x] 2B.4 测试：`skill-import.test.ts`（frontmatter 解析、无 frontmatter 容错、allowed-tools 被丢弃、JSON 单/批量/非法）。

### 2C 渐进披露（按 adapter 分策略）
- [x] 2C.0 确立分派：**custom/codex 自建披露**（catalog + 内联 + `load_skill`）；**claude-code 桥接 SDK 原生 skills**（物化 SKILL.md + `options.skills`），不自建 `load_skill`。
- [x] 2C.1 改造 `shared/skill-context.ts`：`buildSkillContext` + `splitSkillsForContext`（短 skill ≤ `INLINE_SKILL_TOKENS`=350 内联，长 skill 仅 catalog）。
- [x] 2C.2 预算 `skillInlineBudget` 随模型上下文浮动：`min(3000, ctx*8%)`，下限 1500；超预算短 skill 降级为仅 catalog。
- [x] 2C.3 新工具 `load_skill`（`tools/load-skill.ts`，已注册）：作用域 ∈ `agent.skillIds`（**求交、越权拒**）；返回完整 instruction；缺失/禁用返回 error。
- [x] 2C.4 暴露 `load_skill`：**custom** 自动加入 toolNames；**codex** 经 agenthub MCP bridge 暴露（`scripts/agenthub-codex-mcp.mjs` 注册 `load_skill` + 内部端点 `EXPOSED_TOOLS` 加 `load_skill` + agent-runner 把 codex 设为 loadable）。⚠️ 待用户环境运行时冒烟（stdio 桥回调链）。
- [x] 2C.5 claude-code 桥接 SDK 原生 skills：`buildSkillMarkdown` 序列化 → adapter 物化 `.claude/skills/agenthub-<i>-<slug>/SKILL.md`（`agenthub-` 前缀隔离用户 skill）+ `options.skills=[names]`；`finally` 清理；plan 阶段不挂；agent-runner 对 claude-code 走 `AdapterInput.skills`、不注入文本。⚠️ 待用户环境运行时冒烟（SDK 发现 + 物化/清理 + local 不污染）。
- [x] 2C.6 `agent-runner.buildSkillContextBlock` 按 `agent.adapterName` 分派（claude-code 走物化、custom/codex 走 catalog+内联文本，loadable 各异）；同步 spec 13 + spec 05。
- [x] 2C.7 测试：`skill-context.test.ts`（catalog/内联/降级/loadable/预算）+ `skill-import.test.ts`（`buildSkillMarkdown` 与 parse 互逆）。load_skill 越权/物化文件结构由 handler 守卫 + 运行时冒烟覆盖。

### 2D 会话安装 install_skill（按 specs/16 实现）
- [x] 2D.1 **安全设计 spec** 已写并评审拍板：`specs/16-skill-install.md`（决策 D1 仅 GitHub 白名单 / D2 bare 仓库枚举 / D3 source_uri / D4 每次一审 / D5 三 adapter）。
- [x] 2D.2 `install_skill` 加入 `AVAILABLE_AGENT_TOOLS` + `AGENT_TOOL_META`（默认不在任何预设：all-purpose 改为显式 `ALL_PURPOSE_TOOLS` 排除它，用户须显式勾选）。
- [x] 2D.3 `skill-fetch.ts`（单一数据源）：仅 https + **GitHub 主机白名单** + DNS 解析后 IP 校验（拦回环/链路本地/私有/元数据/CGNAT/IPv6 映射）+ 逐跳重定向校验 + ≤256KB 流式截断 + ≤10s + content-type 白名单 + GET 无凭据/不透传内部 token。
- [x] 2D.4 GitHub 解析：raw / blob / tree 目录 → raw SKILL.md；bare 仓库经 `api.github.com` 默认分支 + trees 枚举候选（不批量装）；复用 `parseSkillMarkdown`（丢 allowed-tools）。
- [x] 2D.5 审批门 `pendingSkillInstalls`（仿 fs_write pending）+ API（list / approve / reject）+ 审批 UI 面板 `PendingSkillInstallsPanel`（展示最终 URL + 解析预览 + 目标 agent，挂在 chat-panel）；批准才 `createSkill(source='imported', sourceUri)` + 绑定 `ctx.agentId`，绑定失败回滚。
- [x] 2D.6 `skills` 加 `source_uri` 列（bootstrap safeAlter）；存 DB 不落 `.skills`；fetch/解析失败 + 审批拒绝 + run 中止 均隔离不崩 run。
- [x] 2D.7 三 adapter 暴露 `install_skill`（均 opt-in + 审批闸门）：**custom** toolRegistry；**codex** MCP bridge（`scripts/agenthub-codex-mcp.mjs` 按 `AGENTHUB_ENABLE_INSTALL_SKILL` 注册 + 内部端点 `EXPOSED_TOOLS`）；**claude-code** in-process MCP（`filterAgentHubMcpToolsForRun` 按 toolNames 暴露）。opt-in 跨 adapter：`install_skill` 作为额外能力即使 SDK adapter 也保留在 `toolNames`（`filterSdkOptInTools`），UI 在 custom 清单/SDK 额外能力开关里勾选。⚠️ codex/claude-code 端到端待用户环境冒烟。
- [x] 2D.8 测试：`skill-fetch.test.ts`（SSRF/解析/枚举 15 例）+ 集成测试（pending approve→建 imported skill + 绑定 agent；SDK agent 仅保留 opt-in install_skill）。审批 UI 交互 + 真实 fetch + codex/claude-code 桥端到端在用户环境冒烟。
- [x] 2D.9（2D-d）同步契约文档：CLAUDE.md §5.5「外部 Skill 安装信任模型」+ spec 07（install_skill/load_skill 工具 + 三 adapter 暴露）+ spec 08（source_uri 列）+ spec 09（审批面板 + 事件）+ spec 11（出站 fetch SSRF 策略契约）+ spec 10（install_skill opt-in）。端到端冒烟在用户环境。

## 2E. Phase 2 完善 - Skills 市场 + 公共池

> 2026-07-06 决策（design「Skills 市场 + 公共池方案」）：库升级为市场式浏览 + 内置精选目录；引入公共池（`isGlobalDefault`）自动挂所有 agent，其余保持 opt-in。市场安装用户点击即授权、仍强制过 `skill-fetch`。

- [x] 2E.1 `skills` 加 `is_global_default` 列（bootstrap `safeAlter`，默认 false；builtin/现有行回填 false，不 db:push）+ `SkillRow` 类型 + zod 校验。
- [x] 2E.2 运行时单一出口 `resolveEffectiveSkills(agent)`：公共池 ∪ `agent.skillIds` 去重；`agent-runner` 三 adapter 路径改用它；顺序=自选先 / 公共后；缺失禁用静默跳过。（删除旧 `buildSkillContextBlock`，`load_skill` 作用域改用有效集）
- [x] 2E.3 service：`createSkill`/`updateSkill` 支持 `isGlobalDefault`；`PATCH /api/skills/[id]` 可切换公共；builtin 也允许切公共（仅此位可改，其余仍不可编辑）。
- [x] 2E.4 内置精选目录 `src/shared/skill-catalog.ts`（`{name,description,category,sourceUri}[]`）+ 占位 4 条（指向 anthropics/skills 的 SKILL.md，待用户替换）。
- [x] 2E.5 市场安装：`POST /api/skills/install-from-catalog` → `skill-fetch` 拉取（复用 `skill-fetch.ts`，**无审批门、用户点击授权**）→ `parseSkillMarkdown` → `createSkill(imported, sourceUri)`（service `installCatalogSkill`）。
- [x] 2E.6 市场 UI：全页 `src/app/skills` → `skill-marketplace.tsx` 卡片网格 + 左侧分类栏 + 搜索 + 排序；卡片显示来源/公共徽章 + 「被 N 个 Agent 使用」；未装 catalog 条目虚线卡 + 安装按钮。
- [x] 2E.7 公共开关：库（`skill-library`）/市场卡片 + Agent Studio & CreateAgentDialog Skill 区显示公共徽章；公共 skill 标注「公共 · 已默认挂载」，不占选择位。
- [x] 2E.8 测试：`resolveEffectiveSkills`（并集/去重/顺序/公共禁用剔除）+ `load_skill` 公共作用域 + `countSkillUsage`（公共=全员）+ builtin 可切公共 + `bootstrap.test`（建列/回填 0）。
- [x] 2E.9 spec 同步：persistence + agent-builder + conversation-context（delta）+ CLAUDE.md §5.5（市场安装 vs LLM 审批门）+ specs 07（load_skill 作用域）/08（列）/09（市场页 + 组件树）/13（有效 skill 并集）。
- [x] 2E.10 在线市场（SkillsMP 接入）：服务端 `skill-registry.ts`（zod + 超时 + 隔离）+ 代理 `GET /api/skills/registry` + `skill-marketplace` 加「在线市场」tab（debounce 搜索 + star/作者卡片 + 安装复用 skill-fetch）。安全：注册表 JSON 可信第一方直连，但返回的 githubUrl 仍过 skill-fetch 白名单（防 SSRF）。端到端已用真实 SkillsMP API 验证（搜索→安装）。
- [x] 2E.11 在线市场浏览 + 详情：空/短搜索默认展示热门榜（种子词 `agent` + star 排序，SkillsMP 搜索强制要 q）；点卡片弹出详情面板（名称/作者/star/更新时间 + 安装 + GitHub），经 `GET /api/skills/preview`（`previewSkillMarkdown` 走 skill-fetch，不落库）拉 SKILL.md 全文用 `<Markdown>` 渲染「装之前先看」。真实网络端到端已验证。

## 3. Phase 3 - RAG-lite Knowledge Bases

- [ ] 3.0 **开工前验证**：确认当前 `better-sqlite3` 是否编译带 FTS5；不可用则用 LIKE / 朴素倒排兜底（design「RAG 检索实现风险」）。
- [ ] 3.1 Design final Drizzle schema for `knowledge_bases`, `knowledge_documents`, and `knowledge_chunks`（`embedding` 列先 nullable 留空）。
- [ ] 3.2 Update persistence, tools, conversation-context, and agent-builder specs.
- [ ] 3.3 Add knowledge base create/list/update APIs and services.
- [ ] 3.4 Add document ingestion for text-like files with bounded chunking（chunk 大小与单次检索返回片段数都设**明确上限**）。
- [ ] 3.5 Implement keyword/FTS retrieval before considering embeddings.
- [ ] 3.6 Add `search_knowledge` and `read_knowledge_doc` tools scoped to the current Agent's bound knowledge bases：允许范围由 `ctx.agentId` 反查 `knowledgeBaseIds`；任何 kbId/docId 参数必须**与绑定集求交、集合外拒绝**（design「知识检索工具严格作用域」）。
- [ ] 3.7 Add Agent Studio UI for binding knowledge bases.
- [ ] 3.7b **编辑入口同步**：知识库绑定 UI 加进「编辑已有 Agent」入口。
- [ ] 3.8 Add runtime retrieval injection or tool guidance so Agent can use bound knowledge（扩展 `buildAgentHubToolGuidance` 单一出口）。
- [ ] 3.8b 解析期对缺失的 `knowledgeBaseId` **静默跳过、不崩 run**。
- [ ] 3.9 Add tests for retrieval scoping, chunk limits, and tool access control（含**越权 kbId 被拒**）。

## 4. Phase 4 - MCP Server Registry

- [ ] 4.1 Reconfirm `specs/15-external-mcp.md` safety decisions before implementation.
- [ ] 4.2 Design final Drizzle schema for `mcp_servers` and Agent `mcpServerIds`.
- [ ] 4.3 Add MCP server settings UI with create/edit/delete/test connection（stdio「测试连接」复用 spec 11 子进程清理 + spec 15 信任确认）。
- [ ] 4.4 Add Agent Studio UI for selecting MCP servers and showing trust/risk state.
- [ ] 4.4b **编辑入口同步**：MCP 选择 UI 加进「编辑已有 Agent」入口。
- [ ] 4.5 Wire Claude Code and Codex adapters to pass enabled external MCP servers.
- [ ] 4.6 Keep custom adapter external MCP client as a separate sub-phase（对齐 spec 15 决策 #3：本期 custom **不**接外部 MCP）unless explicitly prioritized.
- [ ] 4.7 Add MCP namespacing and approval behavior according to the external MCP spec.
- [ ] 4.7b 解析期对缺失/禁用的 `mcpServerId` **静默跳过、不崩 run、不暴露**。
- [ ] 4.8 Add tests for disabled server isolation, namespaced tool exposure, and failure isolation.

## 5. Phase 5 - Template Lifecycle And Marketplace Polish

- [ ] 5.0 （若 P2 未建）落地 `agent_templates` 表 + `agents.templateId` / `templateSnapshot`（完整冻结 blob）。
- [ ] 5.1 Allow users to save an existing Agent as a reusable template：**剥除** apiKey / apiBaseUrl / MCP headers·env 等密钥（persistence delta「Templates SHALL NOT persist secrets」）。
- [ ] 5.2 Add template version metadata and explicit upgrade flow for existing Agents（升级是**显式**动作，默认不改已建 Agent 的快照）。
- [ ] 5.3 Add usage count, categories, tags, and search/filter behavior.
- [ ] 5.4 Add import/export of templates as validated JSON：导入用 zod 校验并**拒绝夹带密钥**的模板。
- [ ] 5.5 Add team/shared marketplace only after local template lifecycle is stable.

## 6. Verification Checklist For Each Phase

- [ ] 6.1 Specs updated together with any entity, tool, adapter, persistence, or security contract change.
- [ ] 6.2 API routes validate request bodies with zod.
- [ ] 6.3 No template path persists user secrets (含「存为模板」与「导入模板」两条路径).
- [ ] 6.4 Existing agents without template/skills/RAG/MCP still run unchanged.
- [ ] 6.5 UI text fits desktop and mobile viewports.
- [ ] 6.6 Run focused tests, `pnpm typecheck`, and lint for the touched area.
- [ ] 6.7 每个新配置维度（Skills/KB/MCP）在**编辑已有 Agent** 时也可增删，否则该期显式标注暂缓 + TODO.
- [ ] 6.8 缺失/已删除/禁用的 skillId / knowledgeBaseId / mcpServerId 在解析期优雅降级，不崩 run.
- [ ] 6.9 知识/MCP 工具无法被诱导越出该 Agent 的绑定集（越权 id 被拒）.

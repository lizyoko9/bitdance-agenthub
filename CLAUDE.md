# CLAUDE.md — AgentHub 项目 AI 协作主文档

> 这是 AgentHub 项目的「项目级 AI 协作约定」。任何 AI 协作工具（Claude Code、Cursor、Codex 等）在本项目工作时**必须**先读此文档，再开始任务。
>
> 本文档与 `openspec/`、`specs/` 配套：CLAUDE.md 定**规则**（怎么做、不做什么），`openspec/specs/` 定 OpenSpec 能力契约，`specs/` 保留编号版详细规格。
>
> **新会话快速上手**：想在不通读代码的前提下建立项目全貌（已实现功能 + 代码地图 + 当前进度），先读根目录 `OVERVIEW.md` —— 它定**地图**（做了什么 / 代码在哪），本文档定**规则**。

---

## 1. 项目背景

**AgentHub** 是一个多 Agent 协作平台。一句话定位：

> 把多 Agent 协作做成 IM 群聊体验。Agent 是「联系人」，对话是「工作空间」，Orchestrator 是「群里的项目经理」。

### 核心能力

- IM 范式的会话管理（单聊 / 群聊 / 多会话并行）
- 统一适配器层接入 Claude Code、Codex 等 agent 平台 + 自建 Agent
- Orchestrator 自动拆任务、并行调度、聚合结果
- 产物（代码、网页、文档）内联预览与二次编辑
- 每个会话独立 workspace，Agent 可读写文件、跑命令

### 运行形态

本地运行（`pnpm dev` / `pnpm start`），SQLite 文件数据库，不依赖任何托管服务。

---

## 2. 技术栈（已锁定）

| 层 | 选型 | 不选什么 / 为什么 |
|---|---|---|
| 前端框架 | Next.js 16 App Router + React 19 | 不选 Pages Router。Next.js 16 与旧版有较多 breaking change，写代码前查 `node_modules/next/dist/docs/` |
| 语言 | TypeScript（strict 模式） | 不写 `any`，需要时用 `unknown` 再 narrow |
| 样式 | Tailwind CSS + shadcn/ui | 不引入其他 UI 库；shadcn 是「复制组件到本项目」模式 |
| 状态 | Zustand + Immer middleware | 不用 Redux/Recoil/MobX |
| ORM | Drizzle | 不用 Prisma |
| DB | SQLite（`better-sqlite3` 驱动） | 不引入 Postgres/MySQL |
| 流式传输 | SSE（一条全局连接） | 不用 WebSocket |
| AI SDK | `@anthropic-ai/sdk`、`@anthropic-ai/claude-agent-sdk`、`openai`、`@openai/codex-sdk` | 通过适配器层屏蔽差异 |
| 包管理 | pnpm | 不用 npm/yarn（lockfile 唯一） |
| Node 版本 | ≥ 20 | 用 `node --experimental-strip-types` 跑 TS 脚本时需要 |

---

## 3. 架构核心原则

### 3.1 五层分层（不要跨层调用）

```
L5 UI 组件
L4 State + Transport（Zustand store + SSE 客户端）
L3 Application Services（AgentRunner、ConversationService、EventBus、ToolExecutor）
L2 Agent Platform Adapters（ClaudeCode/Codex/CustomAgent/Mock）
L1 Persistence（Drizzle + SQLite + workspace 文件系统）
```

**铁律**：
- UI **永远不**直接调 LLM SDK，必须经过 L3
- Adapter **永远不**写 DB，它只负责事件流翻译
- 工具执行（ToolExecutor）属 L3，不是 Adapter 的事

### 3.2 七个核心实体（详见 `specs/01-core-entities.md`）

`Agent` / `Conversation` / `Message` / `Artifact` / `Workspace` / `Tool` / `AgentRun`

修改任一实体的字段时，**必须同步更新 spec 文档**。

### 3.3 统一流式事件（详见 `specs/02-stream-events.md`）

整个系统通过一套 `StreamEvent` 类型粘合：
- L2 Adapter 产生事件
- L3 服务层路由 + 持久化
- L4 SSE 推到前端
- L5 store reducer 应用

**新增 Adapter 或 UI 组件时，事件协议是契约，不可绕开**。

### 3.4 Message = parts 数组，不是字符串

```typescript
message.parts = [
  { type: 'thinking', content: '...' },
  { type: 'tool_use', ... },
  { type: 'text', content: '...' },
  { type: 'artifact_ref', artifactId: '...' },
]
```

**不要**把多种内容塞进一个 markdown 字符串再用正则解析。

### 3.5 Artifact 独立于 Message

产物有自己的生命周期、版本、二次编辑。**不要**把产物内容内联到 message 里。

### 3.6 Orchestrator 是特殊 Agent，不是独立服务

Orchestrator 走同一个 `AgentRunner`，只是多了 `dispatch_to_agent` 工具与不同的 system prompt。**不要**为它写独立服务路径。

---

## 4. 代码风格

### 4.1 文件 / 目录命名

- 文件名：`kebab-case.ts`（如 `agent-runner.ts`）
- React 组件文件：`PascalCase.tsx`（如 `ChatWindow.tsx`）
- 测试文件：`*.test.ts` 与被测文件同目录
- 不创建 `index.ts` barrel 文件（除非是 shadcn 风格的 `components/ui/`）

### 4.2 命名约定

| 类型 | 风格 | 例 |
|---|---|---|
| 类型 / 接口 | PascalCase | `Conversation`, `StreamEvent` |
| 变量 / 函数 | camelCase | `agentRunner`, `applyEvent` |
| 常量 | UPPER_SNAKE | `MAX_TOKENS`, `WORKSPACE_ROOT` |
| 枚举值（字面量联合） | snake_case 字符串 | `'tool_use'`, `'web_app'` |
| DB 列名 | snake_case | `created_at`, `agent_id` |
| URL 路径 | kebab-case | `/api/conversations/[id]/messages` |

### 4.3 不要做

- ❌ 不写 `// TODO` 不跟进。要么删，要么开 task
- ❌ 不留废代码 / 注释掉的代码块
- ❌ 不为「将来可能用到」加抽象。三处重复才提抽象
- ❌ 不在业务代码里 `console.log`（用专门的 logger，或临时调试用完即删）
- ❌ 不写多段 docstring。每个函数最多 1 行注释，且只解释 **why**
- ❌ 不引入新依赖而不在 PR / commit 中说明理由

### 4.4 必须做

- ✅ 异常要有上下文（不要 `throw new Error('failed')`，写清楚是什么 failed）
- ✅ 跨进程边界的输入（API body、LLM 输出）必须 zod 验证
- ✅ 所有 LLM 调用 **必须**带 AbortSignal（支持中止）
- ✅ 涉及文件系统的工具必须经过 Workspace 沙箱（见 5.3）

---

## 5. 安全与沙箱

### 5.1 LLM 输出永远是不可信输入

- LLM 生成的 HTML/JS 在 iframe 渲染时必须 `sandbox="allow-scripts"`（不给 `allow-same-origin`）
- LLM 生成的 SQL / shell 命令必须经过白名单或参数化

### 5.2 Bash 工具黑名单（双平台）

黑名单按宿主平台分支。POSIX（macOS / Linux）与 Windows 各一套，由 `getBannedPatterns(platform)` 暴露。**新增 / 调整规则必须同步 `specs/11-platform.md`「命令黑名单」节并改 `src/server/security.ts`** —— 黑名单本身是契约，单文档单数据源。

**POSIX 黑名单**（节选，完整列表见 spec 11）：
- `rm -rf /` / `sudo` / `chmod 777 /` / fork bomb / `curl|bash` / `wget|sh` / `eval` / `exec ...`

**Windows 黑名单**（节选，完整列表见 spec 11）：
- `del /F /Q C:\` / `rd /S /Q C:\` / `Remove-Item -Recurse -Force` / `format C:` / `shutdown` / `reg delete` / `iex(iwr ...)` / `Set-ExecutionPolicy Unrestricted` / `bcdedit` / `diskpart`

命令在执行前需要匹配对应平台的黑名单。任何「快速放过」必须在 PR 中说明理由。

### 5.3 Workspace 沙箱

所有 `fs_read` / `fs_write` / `bash` 工具调用：
- 路径必须解析后落在 **effective cwd** 子树内：`workspace.mode === 'local'` 时是 `workspace.boundPath`，否则是 `workspace.rootPath`
- bash 的 cwd 强制为 effective cwd
- **sandbox 模式**：workspace 单目录上限 100MB / 1000 文件（超过拒绝写入）
- **local 模式**：不强制配额（用户用 git 等管理自己的真实项目）；创建会话时 `isPathSafe` 已拒过明显敏感目录（`~/.ssh`、`/etc` 等）

### 5.4 API Key 管理

Key 来源按优先级（详见 `src/server/settings-service.ts` 与 `src/server/agent-runner.ts:buildAdapterInput`）：

1. **`agents.api_key`** — per-agent override（最高优先级；agent 库里单独填）
2. **`app_settings.<provider>_api_key`** — 用户在「设置」面板（Sidebar 齿轮）全局自填，存 SQLite `app_settings` 单行表
3. **`process.env.<PROVIDER>_API_KEY`** — `.env.local` 兜底（dev / CI 友好）

Codex adapter 额外约束：运行时 `CODEX_HOME` / `CODEX_SQLITE_HOME` 指向 AgentHub dataDir 下的隔离目录，不默认读取用户本机 `~/.codex`，避免 CC Switch 等外部 Codex 配置影响 AgentHub。Codex 的自定义 `apiBaseUrl` 必须是 Codex/Responses 兼容 endpoint；DeepSeek 等 Chat Completions-only provider 走 CustomAgentAdapter。

约束：

- **绝不**在代码中硬编码 key
- **不引入** keychain / safeStorage / 第三方加密存储 —— 本地单用户场景，DB 文件系统权限已经够；引入 keychain 增加跨平台复杂度（详见 spec 11 与 README）
- 桌面版（Electron，详见 Spec 12）也用这套机制；只是 DB 文件位置改为 `app.getPath('userData')`
- 缺失 key 时，由 adapter 在 `buildClient()` / SDK 内抛错（不要在启动时拒绝服务，因为用户可能只用其中某些 provider）

### 5.5 外部 Skill 安装信任模型（`install_skill`）

`install_skill` 工具让**服务端按 LLM 选定的 URL 发起出站请求**拉取 GitHub 上的 `SKILL.md` 安装为 Skill。这是项目里唯一的 LLM 驱动出站网络面，存在 SSRF 风险（模型可能被提示注入诱导访问内网 / 云元数据 / 本机服务）。**审批门只能防「装坏内容」，防不住请求本身**，故 SSRF 必须在 fetch 层拦死。约束（完整设计见 `specs/16-skill-install.md`，单一数据源 `src/server/skill-fetch.ts`）：

- **opt-in 两道**：① 工具默认不在任何工具预设，用户须在该 agent 上显式勾选（作为 opt-in 额外能力，SDK adapter 也通过 `toolNames` 保留）；② 每次安装都过审批门（复用 `fs_write` 的 pending 机制），用户看到来源 URL + 解析出的 name/description/正文后才落库 + 绑定。
- **fetch 层 SSRF 防御**（单一数据源 `skill-fetch.ts`，新增/放宽须在 PR 说明，等同命令黑名单的契约地位）：仅 `https` + **GitHub 主机白名单**（`raw.githubusercontent.com` / `github.com` / `gist*` / `api.github.com`）+ **DNS 解析后校验 IP**（拦回环 / 链路本地 / 私有 / 元数据 169.254.169.254 / CGNAT / IPv6 映射）+ **逐跳重定向重校验** + ≤256KB + ≤10s + content-type 白名单 + GET 无凭据、**不透传 AgentHub 内部 token**。
- **不扩权**（铁律）：解析只取 `name/description/instruction`，丢弃 frontmatter 的 `allowed-tools` 等；安装的 Skill 仅注入文本，永不改变 agent 的工具权限。
- **存储**：Skill 统一存 DB（`skills` 表，`source='imported'` + `source_uri`），**不**落 `.skills` 文件夹（与 Claude Code 差异）；claude-code 运行时由 Skill 渐进披露逻辑物化临时 `SKILL.md`（见 spec 13/05）。
- 失败 / 拒绝 / run 中止均隔离，不崩 run。

**Skills 市场安装 vs LLM 会话安装（Phase 2E）**：Skills 市场页（`src/app/skills`）的「安装」按钮从**内置精选目录**（`src/shared/skill-catalog.ts`）拉 GitHub `SKILL.md`，走 `POST /api/skills/install-from-catalog`。它与 `install_skill` 的关键区别：出站请求由**用户点击**发起、URL 来自代码内置的可信 manifest（非 LLM 选定），所以**用户点击即授权、不走 LLM 审批门**。但**两者 fetch 层防御完全相同**——市场安装同样强制过 `skill-fetch.ts` 的主机白名单 + IP 校验（防精选目录被篡改指向内网），解析同样**只取 name/description/instruction、丢 allowed-tools、不扩权**。**公共池**：市场/库可把任一 Skill 标为「公共」（`skills.is_global_default`），公共 Skill 自动挂给所有 Agent（运行时有效 Skill = 公共池 ∪ `agent.skill_ids`），仍走渐进披露、仍不扩权。

**SkillsMP 在线注册表（Phase 2E+）**：市场页「在线市场」tab 通过服务端代理 `GET /api/skills/registry`（`src/server/skill-registry.ts`）查 SkillsMP（`https://skillsmp.com/api/v1/skills/search`，聚合公开 GitHub SKILL.md 的社区市场）。信任模型：SkillsMP 的**搜索 JSON 是代码内置的可信第一方端点**（直接 server-side 调用、zod 校验返回体），但其返回的 **`githubUrl` 是不可信数据**——安装时仍复用 `installCatalogSkill` 强制过 `skill-fetch` 白名单，故注册表被篡改也 SSRF 不了本机（防御纵深）。安装语义同市场安装（用户点击即授权、不走审批门、不扩权）。

---

## 6. AI 协作规则（核心）

这一节是本文档的灵魂。任何 AI 协作工具在本项目工作时必须遵守。

### 6.1 三种工作模式

| 模式 | 何时进入 | 行为 |
|---|---|---|
| **Spec 驱动** | 接到「实现 X」类需求 | 先读 `openspec/project.md` 与 `openspec/specs/` 找对应 capability，再读 `specs/` 细节。spec 缺失时**先写 OpenSpec 变更/规格**，让人确认后再写代码 |
| **修复驱动** | 接到「修 bug」类需求 | 先定位根因（不是症状）。写修复前在 task / PR 说明根因 |
| **探索驱动** | 接到「研究 / 设计 X」类需求 | 不写实现代码，输出 spec / 设计文档 |

### 6.2 必须停下来问的情形

不要自作主张。遇到以下情形必须停下来问人：

- 需要新增依赖
- 需要修改 spec 里定义的接口 / 数据结构
- 需要删除 / 重命名已经被多处引用的符号
- 需要修改安全约束（黑名单、沙箱规则）
- 看不懂为什么这段代码这么写（先问，不要重构）
- 用户的请求和某个 spec 冲突

### 6.3 不要做的事

- ❌ 修代码顺手做不相关的「优化」 / 「整理」（每个 PR / commit 一个事）
- ❌ 删除看起来「没用」的代码而不验证有没有外部引用
- ❌ 改 `.env.example` 而不通知（影响所有协作者）
- ❌ 引入新的 LLM SDK / 工具 / 框架而不更新本文档
- ❌ 把多个 spec 的修改塞到一个 PR

### 6.4 输出代码时

- **小步**：每次只解决一个 spec / 一个 task。一次 100 行内能解决就别写 500 行
- **可解释**：每段非平凡逻辑能口头讲清楚为什么这么写
- **可测试**：纯函数能单元测，副作用集中在边界
- **遵守现有模式**：别人怎么写消息渲染，你也怎么写。不要"我觉得换一种更好"

### 6.5 完成任务的自检清单

提交前自检：

- [ ] 修改的代码用 `pnpm typecheck` 过
- [ ] 修改的代码用 `pnpm lint` 过
- [ ] 涉及 spec 的修改，spec 文档已同步更新
- [ ] 新增的工具 / 适配器 / 实体在 CLAUDE.md 中能找到对应章节
- [ ] 没有遗留的 `console.log` / `TODO` / 注释代码
- [ ] 涉及流式事件的修改，没破坏现有事件契约
- [ ] 涉及 DB schema 的修改，已运行 `pnpm db:push`

---

## 7. 提交规范

### 7.1 Commit 格式

```
<type>(<scope>): <subject>

<body, 可选>
```

`type` ∈ `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `spec`
`scope` 用层名或模块名：`adapter`, `orchestrator`, `ui`, `db`, `spec` 等

例：
- `feat(adapter): add ClaudeCodeAdapter event translation`
- `fix(orchestrator): correct DAG topological sort for cyclic plans`
- `spec(message-model): add artifact_ref part type`

### 7.2 一个 commit 一件事

- 不要把 spec 修改和实现代码混在一个 commit
- 不要把多个不相关功能混在一个 commit

---

## 8. Specs 与 Skills 索引

### `openspec/`（项目规格契约）

- `project.md` — 项目上下文、技术栈、OpenSpec 与旧 specs 映射
- `specs/core-domain/spec.md` — 核心实体和边界
- `specs/stream-events/spec.md` — StreamEvent 协议
- `specs/message-parts/spec.md` — MessagePart 结构
- `specs/artifacts/spec.md` — Artifact 生命周期
- `specs/adapters/spec.md` — Adapter 契约与 Claude/Codex/Custom 边界
- `specs/orchestrator/spec.md` — Orchestrator 调度
- `specs/tools/spec.md` — 工具系统与审批
- `specs/persistence/spec.md` — SQLite/Drizzle 持久化
- `specs/frontend/spec.md` — 前端状态与渲染
- `specs/agent-builder/spec.md` — Agent 创建/编辑
- `specs/platform-security/spec.md` — 平台安全与命令黑名单
- `specs/desktop-electron/spec.md` — Electron 桌面版
- `specs/conversation-context/spec.md` — 跨 run 上下文
- `specs/mobile-companion/spec.md` — 移动伴随 App

### `specs/`（编号版详细规格）

- `01-core-entities.md` — 7 个核心实体的字段定义
- `02-stream-events.md` — StreamEvent 完整事件类型
- `03-message-parts.md` — MessagePart 各类型详解
- `04-artifacts.md` — Artifact 类型与渲染契约
- `05-adapter-interface.md` — AgentPlatformAdapter 接口
- `06-orchestrator-flow.md` — Orchestrator 三阶段工作流
- `07-tools.md` — 内置工具清单与签名
- `08-db-schema.md` — Drizzle schema 与索引（含 app_settings 全局 key 表）
- `09-frontend-architecture.md` — 前端状态结构与事件应用
- `10-agent-builder.md` — 自建 Agent 流程
- `11-platform.md` — 平台抽象（POSIX / Windows shell 选择、双平台黑名单、子进程清理）
- `12-desktop-electron.md` — 桌面版（Electron 打包 DMG / EXE，进程模型 / 路径迁移）
- `13-conversation-context.md` — 跨 run 对话历史序列化（MessagePart → OpenAI ChatMessage、pinned 注入、agent 视角）
- `14-mobile-remote.md` — 移动端伴随 App（Capacitor / Tailscale / 远程审批）
- `15-external-mcp.md` — 外部 MCP 工具接入（设计提案,未实现;统一三 adapter 接入用户配置的 MCP server）
- `16-skill-install.md` — 会话内安装 Skill `install_skill`（设计提案,未实现;LLM 选 URL 的出站 fetch SSRF 信任模型 + 审批门,Phase 2 完善 2D）

### `skills/`（可复用开发任务模板）

几类「会反复做」的扩展任务,各一份步骤化指南(附 file:line + 抄哪个现成例子),目录说明见 `skills/README.md`。

- `add-adapter.md` — 新增一个 Adapter（接入新 agent 平台）
- `add-tool.md` — 新增一个工具（LLM 可调用的 function）
- `add-message-part.md` — 新增一种 MessagePart 类型
- `add-artifact-type.md` — 新增一种 Artifact 类型

---

## 9. 文档维护

- specs 与代码冲突时，**以 spec 为准**，先改代码或改 spec（选你认为对的，但要写明）
- 修改架构原则（§3）或安全约束（§5）必须经过讨论，不可单方面提交
- 本文档与 specs 不堆砌历史决策记录，过时内容直接删除（git log 是历史的归宿）

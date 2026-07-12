# AgentHub 项目全貌（OVERVIEW）

> **这份文档是给 AI / 新对话窗口的「全貌速览」**：读完它,不翻代码也能掌握项目做了什么、怎么分层、代码在哪、当前进度。
>
> 与其它文档的分工：`OVERVIEW.md` 给**地图**（做了什么 / 代码在哪）· `CLAUDE.md` 定**规则**（怎么做 / 不做什么）· `specs/` 定**规格**（每个模块的字段与契约）· `skills/` 给**配方**（扩展任务步骤化指南）· `docs/AI-COLLABORATION.md` 记**协作方法**（方法论复盘 + 实录佐证）· `README.md` 面向**人类用户**（安装 / 快速开始）。
>
> ⚠️ 下篇「代码地图」相对稳定;「附录·当前现状」会随开发过时 —— **以 `git log` 与代码为准**。最后更新见文末。

---

## 上篇 · 全局认知

### 1. 一句话定位 + 成熟度

> 把多 Agent 协作做成 IM 群聊体验 —— Agent 是「联系人」,对话是「工作空间」,Orchestrator 是「群里的项目经理」。

本地运行（`pnpm dev`,SQLite 文件库,不依赖托管服务）。经 100+ commit 演进,五层架构完整落地,功能闭环已跑通,并已做到 **Electron 桌面打包** + **移动端伴随 App 脚手架**。当前重心是测试覆盖（Playwright E2E）与产物体验打磨（PPT 视觉、产物预览）。

### 2. 五层架构 + 数据流

```
L5 UI 组件（React / shadcn）            src/components/**, src/app/**
   ↑↓
L4 State + Transport                    src/stores/app-store.ts（Zustand+Immer）
   ├ Zustand normalized store           src/components/stream-provider.tsx（SSE 客户端）
   └ SSE 单连接（/api/stream）
   ↑↓
L3 Application Services                  src/server/*.ts
   ├ AgentRunner（per-run 生命周期）     src/server/agent-runner.ts ← 核心
   ├ ConversationService / 各 Service
   ├ ToolExecutor（工具执行）            src/server/tools/**
   └ EventBus（HMR-safe 单例）           src/server/event-bus.ts
   ↑↓
L2 Agent Platform Adapters              src/server/adapters/**
   ├ ClaudeCodeAdapter / CustomAgentAdapter / MockAdapter
   ↑↓
L1 Persistence                          src/db/**（Drizzle+SQLite） + workspace 文件系统
```

**数据流主线（一次 Agent 回复）**：
用户发消息 → API 路由 → `AgentRunner` 起 run → 选 `Adapter` 调 LLM → Adapter 吐 **`StreamEvent`** → AgentRunner 持久化 + 经 `EventBus` 推 SSE → 前端 `stream-provider` 收事件 → `app-store` reducer 应用 → UI 重渲染。

**核心契约（改动必读对应 spec）**：
- **`StreamEvent` 联合类型**是粘合全系统的事件协议（`specs/02`）。
- **Message = parts 数组**（text / thinking / tool_use / artifact_ref …），不是 markdown 字符串（`specs/03`）。
- **Artifact 独立于 Message**,有自己的生命周期与版本链（`specs/04`）。
- **Orchestrator 是特殊 Agent**,走同一个 AgentRunner,只是多了 `dispatch_to_agent`/`plan_tasks` 工具与不同 system prompt（`specs/06`）。

### 3. 功能现状矩阵

| 能力 | 状态 | 说明 |
|---|---|---|
| IM 会话（多会话/搜索/置顶/归档/未读） | ✅ | 单聊 + 群聊（@mention） |
| 消息操作（引用/撤回/编辑重发/重新生成/收藏☆/Pin） | ✅ | ☆ 书签跳转+辉光;Pin 注入 LLM 长期上下文(消息按钮 + 顶部横幅) |
| ClaudeCodeAdapter | ✅ | claude-agent-sdk + 全套工具 + Session 续接 |
| CustomAgentAdapter | ✅ | OpenAI 兼容（DeepSeek/OpenAI/火山方舟）+ 自驱 tool loop |
| MockAdapter | ✅ | 开发期不烧 token |
| CodexAdapter | ✅ | @openai/codex-sdk + 线程续接 + AgentHub MCP bridge |
| 自建 Agent | ✅ | 表单/对话式创建,自定义 prompt + 工具集 + Skills（方法论模块:库 CRUD/导入 SKILL.md/渐进披露注入/`install_skill` 会话安装,见 spec 13/16） |
| Orchestrator 编排 | ✅ | 三阶段规划 + DAG 调度 + 级联中止 + 可视化卡 + 同波次代码冲突检测（检测+上报，不自动合并） |
| 工具系统 | ✅ | write/deploy/read_artifact · read_attachment · fs_read/fs_write/bash · plan_tasks · ask_user |
| Artifact 预览/编辑 | ✅ | web_app(iframe + preview URL + 本地静态发布/源码包/容器包) / document(md) / image / 版本对比 diff（历史 diff 只读兼容） / **ppt(幻灯片分页预览 + 完整 theme token + 导出真 .pptx)** · code_file workspace 预览/编辑 · 版本链 v1↔v2 · 选区改写 · 面板内编辑(CodeMirror)→提交新版本 · 导出 |
| Workspace 沙箱 | ✅ | sandbox/local 双模式 · fs_write 审批(Review/Auto) · 双平台 Bash 黑名单 |
| Token 计量 | ✅ | per-run/per-message · cache 命中率 · 全局分析 Tab |
| 跨 run 对话记忆 | ✅ | 历史序列化注入 · token 预算 · 群聊跨 agent 可见 · 手动压缩 |
| 平台抽象（Win/POSIX） | ✅ | shell 选择 · 多盘符 DirPicker · 子进程清理 |
| Electron 桌面版 | ✅ | DMG / EXE 打包 · userData 路径迁移 |
| 全局 API Key 设置面板 | ✅ | app_settings 单行表 · 三层 key 优先级 |
| 移动端伴随 App | ⏳ | 响应式 Web 已适配;Capacitor 原生壳脚手架已建,配对通信待打通 |
| 斜杠命令菜单 | ✅ | 输入 `/` 弹命令浮层（打开设置 / Agents 库等 UI 命令） |
| 测试覆盖 | 🟡 | Vitest 纯函数（security / workspace-utils / dispatch-plan / artifact-content / ppt-export / ppt-theme）；Playwright **E2E 基建 + 核心 IM 流**（mock agent，见附录）；产物/群聊调度 E2E 待补（需测试假 adapter） |

---

## 下篇 · 代码地图（功能 → 文件）

> 路径相对仓库根。找某功能从这里定位,不用全局搜索。

### 入口 & 前端壳
| 关注点 | 文件 |
|---|---|
| App 入口 / 布局 | `src/app/page.tsx` · `src/app/layout.tsx` |
| SSE 全局连接（客户端） | `src/components/stream-provider.tsx` |
| 前端状态总线（Zustand+Immer，reducer 在此应用 StreamEvent） | `src/stores/app-store.ts` |
| 主题 | `src/components/theme-provider.tsx` · `theme-toggle.tsx` |

### L5 UI 组件（`src/components/`）
| 区域 | 文件 |
|---|---|
| 侧栏（会话/产物库/Agents/Skills/分析 Tab） | `sidebar.tsx` |
| 聊天主面板 | `chat-panel.tsx` · `message-list.tsx` · `message-item.tsx` · `message-parts.tsx` |
| 输入框（附件/审批模式/选区引用/斜杠命令） | `message-input.tsx` · `edit-message-input.tsx` |
| Orchestrator 调度卡 | `dispatch-plan-card.tsx` |
| 产物预览 / 产物库 | `artifact-preview-panel.tsx` · `artifact-library.tsx` |
| fs_write 审批面板 + diff | `pending-writes-panel.tsx` · `pending-write-diff-tab.tsx` |
| ask_user 结构化弹窗 | `ask-user-question-dialog.tsx` |
| Token 计量 | `usage-dashboard.tsx` · `usage-badge.tsx` |
| 文件浏览器 | `file-explorer-panel.tsx` · `file-tab.tsx` · `file-library-dialog.tsx` |
| 选区改写 / 引用 | `selection-popover.tsx` · `quoted-message.tsx` |
| 导航辅助 | `pinned-messages-bar.tsx` · `conversation-outline.tsx` |
| Agent 库 / 创建 | `agent-library.tsx` · `create-agent-dialog.tsx` · `add-agent-dialog.tsx` · `agent-avatar.tsx` · `agent-info-popover.tsx` |
| 会话创建 / 目录选择 | `new-conversation-dialog.tsx` · `dir-picker-dialog.tsx` |
| 设置面板 | `settings-dialog.tsx` |
| 渲染基建 | `markdown.tsx` · `code-block.tsx` · `attachment-chip.tsx` · `ui/*`（shadcn） |

### L4→L3 API 路由（`src/app/api/`）
| 端点 | 作用 |
|---|---|
| `stream/route.ts` | **SSE 全局事件流**（一条连接） |
| `conversations/route.ts` · `conversations/[id]/**` | 会话 CRUD · 消息 · `fs/{listdir,read,write}` · `pending-writes` · `pending-questions` · `attachments` · `regenerate` |
| `messages/[id]/{edit,pin,bookmark,withdraw}` | 消息操作 |
| `agents/**` · `artifacts/**`（含 `/versions` `/export`） · `deployments/**` · `attachments/**` | 实体 CRUD / 部署包下载 |
| `deployments/[id]/[[...path]]` | 本地静态发布预览 URL |
| `runs/[id]/abort` | 中止 run（级联） |
| `usage/summary` | Token 分析聚合 |
| `platform` · `fs/listdir` | 平台信息 · 全局目录浏览 |

### L3 服务层（`src/server/`）
| 服务 | 文件 | 职责 |
|---|---|---|
| **AgentRunner** | `agent-runner.ts` | per-run 生命周期、选 adapter、`buildAdapterInput`、历史注入、token 预算、Orchestrator DAG + 冲突检测 —— **L3 核心** |
| 冲突检测 | `dispatch-file-writes.ts` | 子 run fs_write 写入追踪 + `detectWaveConflicts` 纯函数（`specs/06`） |
| 会话服务 | `conversation-service.ts` | 会话/消息持久化 |
| 跨 run 上下文 | `conversation-context.ts` | MessagePart → ChatMessage 序列化、pinned 注入（`specs/13`） |
| 上下文压缩 | `context-compaction-service.ts` | 手动压缩历史为摘要（落 `context_summaries` 表） |
| 事件总线 | `event-bus.ts` | HMR-safe globalThis 单例,推 SSE |
| 产物服务 | `artifact-service.ts` · `deployment-service.ts` · `ppt-export.ts` | 产物 CRUD + 版本链（parentArtifactId）· 本地静态发布与下载包 · slides JSON → 真 .pptx（pptxgenjs） |
| Agent / 附件 / 文件 | `agent-service.ts` · `attachment-service.ts` · `fs-service.ts` | |
| 审批中转 store | `pending-writes.ts` · `pending-questions.ts` | fs_write 审批 / ask_user 的内存中转 |
| 设置 / Key | `settings-service.ts` | 三层 key 优先级解析 |
| 安全 / 平台 / 沙箱 | `security.ts`（黑名单 `getBannedPatterns`） · `platform.ts`（shell 选择） · `workspace-utils.ts`（路径校验/配额） | `specs/11` |
| ID 生成 | `ids.ts` | |
| 移动端 | `companion-config.ts` · `mobile-auth.ts` · `mobile-service.ts` · `mobile-cors.ts` · `network-hints.ts` | `specs/14` |

### L2 适配器（`src/server/adapters/`）
| 文件 | 说明 |
|---|---|
| `types.ts` | `AgentPlatformAdapter` 接口（事件流契约,`specs/05`） |
| `registry.ts` | adapter 注册/选择 |
| `claude-code-adapter.ts` | `query()` + `canUseTool` 桥 + SDK MCP 工具 + session 续接 |
| `custom-agent-adapter.ts` | OpenAI 协议 stream + 自驱 tool loop |
| `mock-adapter.ts` | 假事件流,开发用 |

### 工具系统（`src/server/tools/`）
`types.ts`（工具签名） · `registry.ts`（注册） · `write-artifact.ts` · `read-artifact.ts` · `read-attachment.ts` · `fs-read.ts` · `fs-write.ts` · `bash.ts` · `plan-tasks.ts`（Orchestrator DAG） · `ask-user.ts`。详见 `specs/07`。

### L1 持久化（`src/db/`）
| 文件 | 说明 |
|---|---|
| `schema.ts` | **10 张表**：`agents`（含 `skill_ids`） · `conversations` · `messages` · `artifacts` · `workspaces` · `attachments` · `agent_runs` · `context_summaries` · `app_settings` · `skills`（Phase 2 方法论模块）（`specs/08`） |
| `client.ts` | better-sqlite3 + Drizzle 实例 |
| `bootstrap.ts` | 首次启动自动建表 + seed |
| `builtin-agents.ts` · `seed.ts` | 5 个内置 Agent（Orchestrator / PM 小灰 / UI 设计师 / 前端工程师 / Reviewer） |
| `migrate-add-*.ts` | 增量迁移脚本（usage / bookmarks / workspace-mode / app-settings 等） |

DB 文件：`.agenthub-data/agenthub.db`;workspace：`.agenthub-data/workspaces/<conv_xxx>/`（sandbox 模式）。

### 共享类型（`src/shared/`）
`types.ts`（**`StreamEvent` / `MessagePart` 等跨层类型,改动牵一发动全身**） · `constants.ts` · `model-registry.ts`（模型清单） · `ppt-theme.ts`（`PptTheme` 解析 + 专业默认,预览/导出共用）。

### 桌面（`electron/`）& 移动（`apps/mobile/`）
- Electron：`main.ts`（主进程） · `paths.ts`（userData 路径迁移） · `server-bootstrap.ts`（拉起 Next standalone）。`specs/12`。
- 移动：`apps/mobile/`（Capacitor 伴随客户端,monorepo workspace `@agenthub/mobile`）。`specs/14`。

### 测试（`e2e/` + `*.test.ts`）
- 单元：`src/**/*.test.ts`（Vitest 纯函数：security / workspace-utils / dispatch-plan / artifact-content / ppt-export / ppt-theme）。
- E2E：`e2e/`（Playwright；`global-setup.ts` 建隔离库 + 插 mock agent，`chat.spec.ts` / `conversations.spec.ts` 跑核心 IM 流）；配置 `playwright.config.ts`，命令 `pnpm e2e`。

---

## 附 · 当前现状（易过时,以 git 为准）

### ✅ 近期完成（最新一批）
- 会话归档（service / API / sidebar，`archived` 字段早有，本批接通 UI）
- Orchestrator **同波次代码冲突检测**（fs_write 写入追踪 + 聚合阶段上报；盲区 bash / SDK adapter，`specs/06`）
- **PPT 产物**：`ppt` 类型 + 结构化 slides JSON + 真 .pptx 导出（pptxgenjs）+ 完整 theme token（预览/导出同源消费 `resolvePptTheme`）
- **Playwright E2E** 基建 + 核心 IM 流（mock agent；本机 `pnpm e2e` 跑，详见「测试」节）
- 斜杠命令菜单（`/` 浮层）

### 📋 待办
- E2E 第二批：产物预览/导出 + 群聊调度（需「会产 artifact / dispatch」的测试假 adapter）
- PPT 深化：辅色语义着色（正面↑ / 警示↓）+ 数据页卡片化
- 冲突检测盲区：bash / SDK adapter 写入（可加波次快照补全）
- Codex 写盘审批 hook（当前 Review 模式用 read-only sandbox）
- sandbox 配额对 Claude Code SDK 失效（SDK 自己写盘绕过 quota）
- 移动端伴随 App 配对通信打通

### ⚠️ 关键约定（动手前必看）
- 改实体字段 → 同步 `specs/01`;改事件 → `specs/02`;改 Bash 黑名单 → 同步 `specs/11` + `src/server/security.ts`（单一数据源）。
- 所有 LLM 调用必带 `AbortSignal`;跨进程输入（API body / LLM 输出）必经 zod 校验;fs/bash 必过 Workspace 沙箱。
- 完整协作规则见 `CLAUDE.md`。

---

*最后更新：2026-06-06 · 同步本批成果（会话归档 / Orchestrator 冲突检测 / PPT 产物+真 pptx+theme / Playwright E2E 基建）到功能矩阵、代码地图、当前现状三节。改动较大后请同步本文件的「功能矩阵」与「当前现状」两节。*

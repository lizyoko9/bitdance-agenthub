# Spec 09 — 前端架构

> L4（State + Transport）+ L5（UI 组件）的内部组织。本 spec 定义状态结构、SSE 接入、事件应用 reducer、派生 hooks 与组件树。

源文件：`src/stores/app-store.ts`、`src/components/stream-provider.tsx`、`src/app/page.tsx`、`src/components/`

---

## 分层定位

```
L5  UI 组件 (src/components/*.tsx)
        ▲
        │ Zustand hook (useAppStore + 派生 hooks)
        │
L4  ┌──────────────────────────────────────┐
    │ AppState (zustand + immer)          │
    │ ─ entity maps + 关系桶 + UI 状态     │
    │ ─ applyEvent(StreamEvent): reducer  │
    │                                      │
    │ StreamProvider (SSE 客户端)          │
    │ ─ /api/stream → applyEvent           │
    └──────────────────────────────────────┘
        ▲
        │ SSE
        │
L3  Application Services（见 Spec 02/06）
```

**铁律**：UI 组件不直接调 LLM SDK，不直接 fetch DB 行（除 lazy load artifact 详情这类特例）。所有 state 变更都要么走 `applyEvent`（来自 SSE），要么走显式 action（用户操作 + REST 响应）。

---

## AppState 结构

源文件：`src/stores/app-store.ts:20-89`

```typescript
interface AppState {
  // ─── 实体 maps ─────────────────────────────────────
  conversations: Record<string, ConversationWithMeta>  // 含 workspaceMode / workspaceBoundPath
  agents: Record<string, AgentRow>
  messages: Record<string, MessageRow>
  artifacts: Record<string, ArtifactRow>

  // ─── 关系桶（按 conversationId 分桶）─────────────
  messageIdsByConv: Record<string, string[]>       // 该会话消息按时间顺序的 id 列表
  runsByConv: Record<string, Record<string, AgentRunRow>>

  // ─── Orchestrator 调度状态（按 Orchestrator runId 索引）
  dispatchesByRunId: Record<string, DispatchState>

  // ─── UI 状态 ──────────────────────────────────────
  activeConversationId: string | null
  previewArtifactId: string | null
  fileExplorerOpen: boolean                                   // 与 previewArtifactId 互斥
  openFilesByConv: Record<string, string[]>                  // 中间区 tab 列表（含 'diff:<pwId>' 形式）
  activeTabByConv: Record<string, string>                    // 当前激活 tab：'chat' / 文件路径 / 'diff:<pwId>'
  replyTargetByConv: Record<string, string | null>           // 引用回复目标
  pendingAttachmentsByConv: Record<string, AttachmentRow[]>  // 待发送附件
  pendingWritesByConv: Record<string, PendingWrite[]>        // Agent fs_write 审批队列（review 模式）
  pendingBashCommandsByConv: Record<string, PendingBashCommand[]> // Agent bash 关键命令审批队列
  pendingSkillInstallsByConv: Record<string, PendingSkillInstall[]> // install_skill 会话安装审批队列
  highlightedMessageId: string | null                         // 跳转后短暂高亮
  streamConnected: boolean
}
```

**设计要点**：
- **实体 normalize 成 `Record<id, Row>`**，不放在 conversations 的嵌套里（避免重复存储 + 局部更新困难）
- **关系用「id 列表」分桶**，渲染时 map 拿实体。这样新增 / 删除消息只动 id 列表 + 实体 map，不破坏 React shallow equality
- **UI 状态按 conversationId 分桶**（pendingAttachments / replyTarget），切会话不会污染
- **不放在 store 的东西**：表单 draft、modal 开关、临时 hover 状态——这些用组件内 `useState`

---

## applyEvent reducer

源文件：`src/stores/app-store.ts:274-442`

逐 `event.type` 分发，所有 case 都在一个 `set((s) => switch)` 内，依赖 immer 直接 mutate。

| Event | State 变更 |
|---|---|
| `heartbeat` | 无变更（仅作连接保活信号，由 SSE 端定期发） |
| `run.start` | `runsByConv[convId][runId] = { ...event, status: 'running', usage: null }` |
| `run.end` | 更新 run 的 `status` / `finishedAt` / `error`；当 status 为 `failed` / `aborted` 时，把同 run 的 streaming 消息改为 `error` / `aborted`，并为未配对 `tool_result` 的 `tool_use` 补本地错误结果，避免工具卡停在「调用中」 |
| `run.usage` | 更新 run 的 `usage` 字段（input/output/cache tokens）；派生 hook `useConversationUsageTotal` 据此聚合 |
| `message.start` | 在 `messages[messageId]` 创建空 parts 的 streaming agent 消息，挂入 `messageIdsByConv` |
| `message.end` | `messages[messageId].status = 'complete'`；若用户不在该会话（`activeConversationId !== conversationId`）则 `unreadByConv[conversationId] +1`。**不在 message.start 计未读**——claude-code-adapter 整 run 只发一次 message.start，那时用户通常仍在该会话被抑制，后续切走再无 +1 机会 |
| `part.start` | `messages[messageId].parts[partIndex] = event.part`（按 index 插入，不 push） |
| `part.delta` | 按 delta type 追加：`text.append` / `thinking.append` / `code.append`（其它类型 part 不增量） |
| `part.end` | 无变更（前端用 `message.end` 收尾，不需要 part 级别 end） |
| `tool.call` | 给消息 push 一个 `tool_use` part |
| `tool.result` | 给消息 push 一个 `tool_result` part（前端按 callId 合并渲染）；若同 callId 结果已存在，则更新已有结果以配合失败兜底的幂等处理 |
| `artifact.create` | `artifacts[artifact.id] = artifact`（不在消息里插 `artifact_ref` part，那由 `part.start` 单独投递） |
| `artifact.update` | 浅合并 `content` patch（TODO：当前没有 emitter，前端 reducer 已就绪） |
| `deploy.status` | 不直接改 store；AgentRunner 会补发 `part.start(deploy_status)`，reducer 按普通 part 写入 |
| `dispatch.plan` | 找该 runId 最新的 agent 消息作挂载点，创建 `DispatchState` |
| `dispatch.start` | `taskStatus[taskId] = 'running'`，记 `childRunIds[taskId] = childRunId` |
| `dispatch.end` | 优先通过 `parentRunId` 找 `dispatchesByRunId`，更新 `taskStatus[taskId]` 为 `complete` / `failed` / `aborted` / `skipped`；旧事件可用 `childRunId` 反查兜底 |
| `fs_write.pending` | `pendingWritesByConv[convId].push(pendingWrite)`（已存在的 id 不重复 push） |
| `fs_write.resolved` | 从 `pendingWritesByConv[convId]` 移除 `pendingId`；ChatPanel 的清理 effect 会同步关掉对应 `diff:<pwId>` tab |
| `skill_install.pending` | `pendingSkillInstallsByConv[convId].push(pendingInstall)`（已存在的 id 不重复 push） |
| `skill_install.resolved` | 从 `pendingSkillInstallsByConv[convId]` 移除 `pendingId` |
| `bash_command.pending` | `pendingBashCommandsByConv[convId].push(pendingCommand)`（已存在的 id 不重复 push） |
| `bash_command.resolved` | 从 `pendingBashCommandsByConv[convId]` 移除 `pendingId` |

**幂等性**：`message.start` / `run.start` 在 id 已存在时仍 idempotent（覆盖写）；`messageIdsByConv` 用 `includes` 检查防重复。这样支持事件重放（未来重连补发）。

**部署卡片**：`DeployStatusPart` 根据 `DeployStatusRecord.deploymentType` 区分本地静态部署与外部静态发布，根据 `sourceType` 区分 artifact 版本与 workspace 目录来源。`external_static` 时，`previewPath` 是公开 URL，卡片必须继续提供打开 / 复制操作，并在 `localPreviewPath` 存在时显示本地回退路径。源码包 / 容器包下载仍来自本地 deployment id。

**bash 审批卡片**：`PendingBashCommandsPanel` 渲染当前会话 `pendingBashCommandsByConv`。卡片显示发起 Agent、命令、cwd 和审批原因，用户点击执行 / 拒绝后调用 `POST /api/conversations/:id/pending-bash-commands/:commandId`，最终通过 `bash_command.resolved` 清理 UI。

**Skill 安装审批卡片**：`PendingSkillInstallsPanel` 渲染当前会话 `pendingSkillInstallsByConv`（`install_skill` 会话安装）。卡片显示发起 Agent、来源 URL（重定向后的最终地址）、解析出的 name/description + 可展开正文预览，用户点击安装 / 拒绝后调用 `POST /api/conversations/:id/pending-skill-installs/:piId`，最终通过 `skill_install.resolved` 清理 UI。

**部署候选卡片**：`DeployCandidatesPart` 渲染 `deploy_candidates` message part。卡片列出当前会话多个 `web_app` 候选，每项显示标题、版本、创建 Agent、时间与 artifact id。点击候选的部署按钮调用 `POST /api/conversations/:id/deploy`，成功后把返回的 system message upsert 到 store；不通过 SSE，也不启动 AgentRun。

---

## 乐观更新：本地用户消息

为减少「发完才看到」的延迟，用户发消息时先在 store 插一条临时消息：

源文件：`src/stores/app-store.ts:222-272`

```typescript
addLocalUserMessage({ tempId, ... })           // 用 tempId（'local-<nanoid>'）插入
// → 服务端返回真实 messageId
replaceLocalMessageId(tempId, realId)          // 把 messages 表和 messageIdsByConv 里的 id 全部替换
```

**约束**：
- `tempId` 必须能与真实 id 区分（避免 SSE 推回的 `message.start` 撞 id）。约定用 `local-<nanoid>` 前缀
- `parts` 包含 text + 附件 part（实体上和服务端写入的一致，免得替换后视觉抖动）
- `replaceLocalMessageId` 必须扫所有 `messageIdsByConv` 桶（虽然只会在一个里命中）—— 防御性写法

**为什么不直接等 SSE**：服务端 `sendMessage` 先持久化后返回 messageId，再起 AgentRunner 推 SSE。前端要在「点发送」的瞬间就显示自己的消息，不能等 200~500ms 的 round-trip。

---

## 派生 hooks

源文件：`src/stores/app-store.ts:446-489`

所有派生 selector 返回新数组 / 对象时**必须**用 `useShallow`（Zustand 5 + immer 标配），否则每次 store 变更都触发新引用 → 无限 re-render。

| Hook | 返回 |
|---|---|
| `useMessagesForConversation(convId)` | 该会话的 `MessageRow[]`，按时间序 |
| `usePinnedMessagesForConversation(convId)` | 该会话 `pinnedMessageIds` 顺序的 `MessageRow[]`（pin 时间序）；驱动 `PinnedMessagesBar` |
| `useActiveConversation()` | 当前会话或 null |
| `useConversationList()` | 全部会话按 `updatedAt` 降序 |
| `useAgentList()` | 全部 agent |
| `usePendingAttachments(convId)` | 该会话待发送附件 |
| `useTopLevelRunningRuns(convId)` | 当前会话顶层正在跑的 run（用于「中止」按钮）—— `parentRunId == null && status == 'running'` |
| `useDispatchForMessage(messageId)` | 该消息上挂的 DispatchState（O(n) 扫，n 通常 < 10） |

**性能注意**：`useMessagesForConversation` 是 hot path，每个 SSE delta 都会触发 selector 重算。useShallow 比较的是数组中每个元素引用 —— 因为 immer 只改动了变化的消息行，其余引用不变，shallow 比较成功 → 不渲染。

**MessageList 滚动语义**：首次打开 / 刷新已有会话时，消息渲染完成后滚到最新消息；streaming 期间仅当用户仍贴近底部时自动跟随。用户主动向上查看历史时，不强制拉回底部。滚动目标必须是 `ScrollArea` viewport，不能是内部内容 div；滚动写入需要 `requestAnimationFrame` / 节流，避免每个 SSE delta 都同步触发布局计算。

---

## SSE 连接管理

源文件：`src/components/stream-provider.tsx`

```typescript
let activeSource: EventSource | null = null
let refCount = 0

useEffect(() => {
  refCount++
  if (!activeSource) {
    activeSource = new EventSource('/api/stream')
    // onopen / onerror / onmessage 接入 applyEvent
  }
  return () => {
    refCount--
    if (refCount <= 0) {
      activeSource?.close()
      activeSource = null
    }
  }
}, [])
```

**模块级 ref + refCount 的原因**：React 19 StrictMode dev 下会双 mount，普通 `useEffect` 单连接模式会立刻断开重连。用 refCount 跨 mount 共享同一连接，**全部** unmount 后才真正关闭。

**重连**：`EventSource` 浏览器原生自动重连，`onerror` 仅更新 `streamConnected` 显示。前端不需要写重连循环。

**事件格式约定**（详见 Spec 02）：
- 所有事件都用 `event: message`（默认），不分 `event: tool.call` 等命名事件
- `data:` 是单行 JSON，前端 `JSON.parse(e.data).type` 分发
- 有一种特殊事件 `{ type: 'connected' }` —— SSE 端在首次握手时发，前端把 `streamConnected` 置 true（onopen 也会置，但 connected 是双保险）

---

## 组件树

```
app/page.tsx
└── <Home>
    ├── <Sidebar />               ── 对话/产物库/Agents/Skills/分析 五 tab 切换
    │   ├── <ThemeToggle />
    │   ├── <NewConversationDialog />
    │   ├── <ConversationItem />  ── 单条会话 + hover 置顶/归档/重命名/删除
    │   ├── <ArtifactLibrary />
    │   ├── <AgentLibrary />
    │   │   └── <CreateAgentDialog />    ── 顶部 radio 选 adapterName（'custom' / 'claude-code' / 'codex'）；SDK adapter 模式下隐藏 provider/工具集，Codex 使用 AgentHub 隔离 CODEX_HOME；公共 Skill 标「已默认挂载」不占选择位
    │   ├── <SkillLibrary />      ── Skills 库窄条：新建/编辑/删除/启停/切公共 + 「打开市场」入口（→ /skills）
    │   └── <RenameInput />       ── 内联重命名
    ├── <ChatPanel />             ── 当前会话主区
    │   ├── header: 头像堆 + AgentInfoPopover + 文件树/产物预览 toggle + FileLibraryDialog + AddAgentDialog + UsageBadge（点开 popover 看 token 拆分）
    │   ├── tab bar（openFiles 非空时显示）: 「对话」+ 每个打开的文件 / diff tab
    │   ├── 主体（按 activeTab 切换）:
    │   │   ├── activeTab === 'chat': <PinnedMessagesBar> + <MessageList> + <PendingWritesPanel> + <MessageInput>
    │   │   │   ├── <MessageItem>     ── 每条消息
    │   │   │   │   ├── <AgentInfoPopover />
    │   │   │   │   ├── <QuotedMessage />     ── 引用预览
    │   │   │   │   ├── <PartList>            ── 渲染 message.parts
    │   │   │   │   │   ├── <Markdown />      ── text part
    │   │   │   │   │   ├── <CodeBlock />     ── code part + fenced markdown code
    │   │   │   │   │   ├── <ToolUsePart />   ── 工具卡片（按 callId 合并 tool_use+tool_result）
    │   │   │   │   │   ├── <ThinkingPart />  ── 可折叠思考
    │   │   │   │   │   ├── <ArtifactRefPart /> ── 产物卡片，点击打开预览
    │   │   │   │   │   └── <AttachmentChip />  ── 附件
    │   │   │   │   └── <DispatchPlanCard />  ── 调度卡片（Orchestrator）
    │   │   │   ├── <PendingWritesPanel>    ── 输入框上方的待审批列表（每条是 PendingWriteCard，含「查看更改」打 diff tab + 应用/拒绝）
    │   │   │   ├── <PendingSkillInstallsPanel> ── install_skill 会话安装审批（来源 URL + 解析预览 + 安装/拒绝）
    │   │   │   └── <MessageInput>          ── @mention popup + 附件 + 引用回复 + Auto/Review 切换
    │   │   ├── isDiffTabId(activeTab): <PendingWriteDiffTab>   ── 中间区的 fs_write 审批 diff（react-diff-viewer-continued）
    │   │   └── 否则: <FileTab>            ── 文件浏览 / 编辑
    │   └── <PendingWriteApprovalDialog> 已废弃 —— 由 PendingWritesPanel + PendingWriteDiffTab 取代
    ├── <FileExplorerPanel />     ── 右侧文件树（与 ArtifactPreviewPanel 互斥）
    └── <ArtifactPreviewPanel />  ── 右侧产物预览（按 type 分发；多版本支持确定性对比，历史 diff 只读兼容）

<StreamProvider>                  ── 顶层 layout，全局 SSE 接入
<ThemeProvider>                   ── next-themes
```

**独立全页路由**（不在 `app/page.tsx` 主工作台树内，各自 `src/app/<route>/page.tsx`）：
- `/agents/new` → `<AgentStudio>`：Agent 模板市场 + 从零创建 + 配置屏。
- `/skills` → `<SkillMarketplace>`：Skills 市场卡片网格（分类栏 + 搜索 + 排序 + 精选目录安装 + 公共开关 + 「被 N 个 Agent 使用」）。侧栏 Skills 库的「打开市场」跳到这里。含「在线市场」tab：经 `GET /api/skills/registry`（服务端代理 SkillsMP）搜 200 万+ 社区 skill——空/短搜索默认展示热门榜（种子词 + star 排序），卡片显示 star/作者；点卡片弹详情面板（`GET /api/skills/preview` 拉 SKILL.md 全文用 `<Markdown>` 渲染 + 安装 + GitHub），安装复用 skill-fetch。

**组件原则**：
- 组件文件名 `PascalCase.tsx`（CLAUDE.md §4.1），一个文件一个主组件 + 几个内联辅助
- 不创建 `index.ts` barrel（CLAUDE.md §4.1）
- 副作用（API 调用）放在组件 mount effect 或事件 handler；不在 selector 里跑
- 表单临时 state 用 `useState`；跨组件共享或要持久化的进 store

---

## Lazy load 策略

某些数据不全量灌进 store，按需 fetch：

| 数据 | 加载时机 | 落位 |
|---|---|---|
| `messages` | 切换会话时一次性拉全量（`fetchMessages`） | `messageIdsByConv` + `messages` |
| `artifacts` | 不预加载；首次见到 `artifact_ref` part 时 lazy fetch 详情（`ArtifactRefPart` 组件内 effect） | `artifacts[id]` |
| `attachments` | 打开 `FileLibraryDialog` 时拉该会话列表；附件 chip 渲染时也按需拉 | 组件内 useState |
| `agents` / `conversations` | 应用启动时全量拉一次 | 同名 maps |

**404 行为**：artifact lazy fetch 404 → 渲染「产物已删除」墓碑卡片（不在 store 标记 deleted；用组件 local state）。

`web_app` artifact 卡、ArtifactPreviewPanel 顶部和 `deploy_status` 卡都提供打开 / 复制预览 URL。URL 由当前 `window.location.origin + previewPath` 生成，避免把 dev 端口或 packaged 随机端口持久化进消息。ready 的本地静态发布卡如果带 `sourceDownloadPath` / `containerDownloadPath`，还展示源码包与容器包下载按钮。`/deploy` slash command 与直接发送 `部署` / `发布` / `上线` 使用同一套确定性部署 API；多个候选时展示 `deploy_candidates` 卡片。

---

## 错误可见性

服务端 run 失败时，AgentRunner 通过 `emitErrorVisualisation` 注入一条 `msg_err_*` 消息（role=agent，status=error），前端无需特殊处理 —— SSE 推过来后 reducer 走正常 `message.start` + `part.start(text)` + `message.end`，渲染时 `MessageItem` 看到 `status==='error'` 显示红边框气泡。同理 `aborted` 显示灰色边框。

**为什么走 message 而不是 toast**：错误是对话内容的一部分，应该和对话一起滚动 / 滚动到、可复制、可作为后续消息的上下文。toast 一关就丢，不适合 LLM 上下文。

---

## 用户消息的撤回 / 编辑

`MessageItem` 在最后一条 user 消息上挂两个 hover 按钮：

| 按钮 | 行为 |
|---|---|
| ✏️（Pencil） | 切到 inline 编辑模式：bubble 内 `<EditMessageInput>` 替代 `<PartList>`。Enter 保存并重发 / Esc 取消 / Shift+Enter 换行 |
| ⚡（Undo2） | 直接撤回，无 confirm dialog（撤回是可重做的：再发一遍即可） |

**「最后一条」判定**：`useLatestUserMessageId(conversationId)` selector 倒序扫 `messageIdsByConv[convId]`，O(后置消息数) 通常常数级。MessageItem 用 `latestUserId === message.id` 判断。

**API 调用**：
- 撤回：`POST /api/messages/[id]/withdraw` → service 物理删除 message + 触发的所有 agent message + artifact + agent_runs（详见 Spec 03）
- 编辑：`POST /api/messages/[id]/edit` → service 先撤回再用新 content 调 `sendMessage`（保留原 mentionedAgentIds / parentMessageId / attachmentIds —— inline 编辑不允许改 @ 和附件）

**store 同步**：API 返回 `{ deletedMessageIds, deletedArtifactIds, [newMessageId, runIds] }`。前端 `removeMessages(convId, ids)` + `removeArtifacts(ids)` 批量删本地状态。新触发的 run + message 走正常 SSE 流入 store，无需特殊处理。

**Race 条件**：撤回时如果有 agent 还在 streaming，service 先 `AgentRunner.abort()`（fire-and-forget）再 wait 500ms 让 finalize 把 `[已中止]` part / msg_err_* 死消息插完，最后用时间窗 `created_at >= userMsg.createdAt` 一并删除（含 wait 期间补写的死消息）。详见 `conversation-service.withdrawLatestUserMessage`。

**为什么不通过 SSE 广播「message.delete」事件**：本地单用户场景，没有第二个客户端需要同步；加事件类型涉及 spec 02 修改 + reducer case，与现状的「同步操作直接 update store」相比代价不值。

---

## CSS / 样式

- Tailwind v4 + shadcn/ui（base-ui 底座，「base-nova」preset）
- 主题色由 `src/app/globals.css` 的 CSS 变量驱动：`--primary` (字节蓝 #3370FF) / `--destructive` (火山红 #FE3B25) / `--ring` 等。light / dark 双模式
- 代码块用 shiki 双主题（github-light / dark）；shiki pre 强制透明底，外层 CodeBlock 容器统一底色（见 `src/components/code-block.tsx` 与 `src/lib/highlighter.ts`）
- 不引入新 UI 库（CLAUDE.md §2）；新 UI 组件先在 shadcn registry 里找，没有就自写

---

## 与其它 spec 的关系

- Spec 02：StreamEvent 是 reducer 输入
- Spec 03：MessagePart 是 message.parts 元素，PartList 按 type 分发
- Spec 04：Artifact 渲染在 `ArtifactPreviewPanel`，按 `content.type` 分发
- Spec 06：DispatchState + DispatchPlanCard 是 Orchestrator 调度的前端表达
## Orchestrator plan review UI

`DispatchState` may include:

```typescript
reviewStatus?: 'pending' | 'approved' | 'rejected'
pendingPlanId?: string
```

`dispatch.plan.pending` creates a dispatch card in review mode. `DispatchPlanCard` lets the user edit task text, agent assignment, `dependsOn`, `expectedOutputs`, `inputs`, and `acceptanceCriteria`. The card submits the full edited plan through `POST /api/conversations/:id/pending-dispatch-plans/:planId`.

`dispatch.plan.resolved` removes the pending marker and records whether the review was approved or rejected. The existing `dispatch.plan` event switches the card into execution progress mode for the approved compiled plan.

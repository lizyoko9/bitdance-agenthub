# Spec 01 — 核心实体

> 本 spec 定义 AgentHub 的 8 个核心实体。所有其他 spec 引用这里的类型。**修改此文档需先讨论。**

---

## 1. Agent

可对话的智能体。在 IM 隐喻里就是「联系人」。

```typescript
interface Agent {
  id: string                    // ag_<nanoid>
  name: string                  // "Claude Code" / "TestBot" / 用户自建名
  avatar: string                // emoji 字面量 or URL
  description: string           // 一句话简介，用于卡片
  capabilities: string[]        // 能力标签，如 ['react', 'testing']，用于 Orchestrator 选派

  systemPrompt: string          // 决定 Agent 行为的核心
  adapterName: AdapterName      // 'claude-code' | 'codex' | 'custom' | 'mock'

  // 仅 adapterName === 'custom' 时使用
  modelProvider?: ModelProvider
  modelId?: string              // 厂商内部 model id
  apiKey?: string               // per-agent 自定义 key；NULL 走 app_settings → env var；Claude Code 还可走 OAuth（详见 Spec 05 §API key 解析、Spec 08 §8）
  apiBaseUrl?: string           // per-agent 自定义 API endpoint；openai-compatible 必填；NULL 时 Claude Code 可走 app_settings.anthropicBaseUrl，Codex 走隔离 CODEX_HOME + SDK 默认 endpoint

  toolNames: string[]           // 该 Agent 可调用的工具，引用 Spec 07

  isBuiltin: boolean            // 内置（不可删；可改）
  isOrchestrator: boolean       // 标记为协调者；同会话最多 1 个
  supportsVision: boolean       // 决定是否把图片附件以 multimodal 投递（详见 Spec 05）

  createdAt: number             // unix ms
}

type AdapterName = 'claude-code' | 'codex' | 'custom' | 'mock'
type ModelProvider = 'anthropic' | 'openai' | 'deepseek' | 'volcano-ark' | 'openai-compatible'
```

**约束**：
- `isOrchestrator: true` 的 Agent 必须 `toolNames.includes('plan_tasks')`（早期 spec 用过 `dispatch_to_agent` 命名，已统一为 `plan_tasks`，详见 Spec 07）
- `adapterName === 'custom'` 时 `modelProvider` 和 `modelId` 必填
- `modelProvider === 'openai-compatible'` 时 `apiKey` 与 `apiBaseUrl` 必填；`apiBaseUrl` 必须是 OpenAI Chat Completions 兼容 endpoint（例如通义千问 compatible-mode、智谱、MiniMax、OpenRouter、SiliconFlow 等兼容地址）
- `adapterName === 'claude-code'` 时 `modelProvider` 忽略；`modelId` 可选（默认走 SDK 默认模型 `claude-opus-4-7`）；`toolNames` 强制 `[]`（Claude Code 用 SDK 内置工具集，详见 Spec 07）
- `adapterName === 'codex'` 时 `modelProvider` 忽略；`modelId` 可选（默认 `gpt-5-codex`）；`toolNames` 强制 `[]`（Codex 用 SDK 内置工具集，详见 Spec 05）；`apiBaseUrl` 必须是 Codex/Responses 兼容 endpoint
- `apiKey` / `apiBaseUrl` 是 per-agent 凭据：`apiBaseUrl` 非空时，`apiKey` 作为对应 SDK / endpoint 的 token；Claude Code、Codex、Custom openai-compatible 的 Base URL 协议不相同，Chat Completions-only provider 走 Custom adapter
- `isBuiltin: true` 的 Agent 不可删除但可修改配置（详见 Spec 10）
- 删除 Agent 不级联删除使用它的 Conversation；前端应展示「已停用 Agent」灰态

---

## 2. Conversation

会话。一个聊天窗口。

```typescript
interface Conversation {
  id: string                    // conv_<nanoid>
  title: string                 // 首条消息自动生成 or 用户改名
  mode: 'single' | 'group'
  agentIds: string[]            // 参与的 Agent（单聊 1 个；群聊 ≥ 2 个）
  pinnedMessageIds: string[]    // 用户 pin 的关键消息，作为长期上下文

  /** Agent fs_write 工具的审批策略（人手编辑文件不走审批）：
   *  - 'review' (默认): Agent 调 fs_write 时弹 diff 对话框等用户应用 / 拒绝
   *  - 'auto'         : Agent 写入直接生效，不询问
   *  详见 Spec 07「fs_write 审批模式」。 */
  fsWriteApprovalMode: 'auto' | 'review'

  archived: boolean
  createdAt: number
  updatedAt: number             // 用于会话列表排序（按最近活跃）
}
```

**约束**：
- 单聊 `agentIds.length === 1`，群聊 `>= 2`
- 群聊里 `isOrchestrator: true` 的 Agent 最多 1 个
- 创建 Conversation 时自动创建关联的 Workspace（1:1）
- `pinnedMessageIds` 上限 **5 条**（常量 `PIN_LIMIT_PER_CONVERSATION` 定义在 `src/shared/constants.ts`，service 在超出时抛 `PIN_LIMIT_EXCEEDED`）。被 pin 的消息由 `agent-runner` 在拼 system prompt 时注入 `<pinned_messages>` 块。前端 UI 入口见 spec 09 `PinnedMessagesBar` 与 `MessageItem` 的 📌 按钮

---

## 3. Message

消息。Message 是「容器」，真正内容在 `parts` 数组中（详见 Spec 03）。

```typescript
interface Message {
  id: string                    // msg_<nanoid> / msg_err_<nanoid>
  conversationId: string

  role: 'user' | 'agent' | 'system'
  agentId?: string              // role === 'agent' 时必填

  parts: MessagePart[]          // 详见 Spec 03（含 image_attachment / file_attachment 引用）

  status: 'streaming' | 'complete' | 'error' | 'aborted'
  parentMessageId?: string      // 回复 / 引用关系
  mentionedAgentIds: string[]   // 用户 @ 提及的 Agent

  runId?: string                // role === 'agent' 时，由哪个 AgentRun 产生
  createdAt: number
}
```

**约束**：
- `status === 'streaming'` 期间 `parts` 可能不完整，前端必须处理增量
- 用户消息没有 `runId`，但群聊里用户消息会触发 1 个或多个 `AgentRun`
- `parentMessageId` 仅用于「引用回复」UI，不影响上下文构建逻辑
- 错误降级消息的 id 以 `msg_err_` 前缀生成（由 `AgentRunner.emitErrorVisualisation`，用于在对话里显示 run 失败）

---

## 4. Artifact

产物。独立于 Message 存在，可被多条 Message 通过 `artifact_ref` part 引用。

```typescript
interface Artifact {
  id: string                    // art_<nanoid>
  conversationId: string
  type: ArtifactType
  title: string

  content: ArtifactContent      // 类型不同字段不同，详见 Spec 04

  version: number               // 同一逻辑产物的版本号（从 1 起）
  parentArtifactId?: string     // 上一版本的 id；形成版本链

  createdByAgentId: string
  createdAt: number
}

type ArtifactType = 'web_app' | 'code_file' | 'diff' | 'document' | 'image' | 'ppt' | 'project'
```

**存储策略**（详见 Spec 04）：
- `web_app` / `diff` / `document` / `image` / `ppt` 的 content 存 DB
- `code_file` 的 content 仅记 workspace 内相对路径，文件本体在 workspace 磁盘
- `project` 的 content 仅记 workspace 内相对文件清单，文件本体在 workspace 磁盘

**约束**：
- 「修改一个 artifact」 = 创建新 Artifact 记录，`parentArtifactId` 指向旧版本，`version` 递增（**当前未实装写入新版本的工具/UI 路径**，详见 Spec 04 「版本链 TODO」）
- 删除 Conversation 级联删除其下所有 Artifact

---

## 5. Workspace

每个 Conversation 的独立工作目录。Agent 在此读写文件、运行命令。

```typescript
interface Workspace {
  id: string                    // ws_<nanoid>
  conversationId: string        // unique，与 Conversation 1:1
  rootPath: string              // 绝对路径
                                // <projectRoot>/.agenthub-data/workspaces/<conversationId>/
  /**
   * 'sandbox' — 隔离目录（rootPath），默认
   * 'local'   — 绑定用户机器上的真实目录（boundPath）
   * 决定 bash / fs 工具的 cwd 与配额规则（详见 Spec 07）
   */
  mode: 'sandbox' | 'local'
  /** mode='local' 时填，绝对路径；sandbox 时为 null */
  boundPath: string | null
  createdAt: number
}
```

**约束（沙箱）**：
- `fs_read` / `fs_write` 的 path 参数 resolve 后必须落在 effective cwd（`local` → `boundPath`，`sandbox` → `rootPath`）子树内
- `bash` 工具的 cwd 强制为 effective cwd
- **sandbox 模式**：单 workspace 限制 100 MB 总大小 / 1000 文件数（超出拒绝写入）
- **local 模式**：不强制配额（用户用 git 等手段自行管理）
- 删除 Conversation 时物理删除 `rootPath` 目录；`boundPath` 不删（那是用户的真实项目）
- attachments 等内部文件**始终**存于 `rootPath` 子目录，不污染 `boundPath`

---

## 6. Tool

Agent 可调用的能力。Tool 是声明 + 实现的组合，存储在代码中（不入库）。

```typescript
interface ToolDef {
  name: string                  // 全局唯一，如 'write_artifact'
  description: string           // LLM 看到的描述，影响调用决策
  parameters: Record<string, unknown>  // 标准 JSON Schema
  handler: (args: unknown, ctx: ToolContext) => Promise<ToolResult>
}

interface ToolContext {
  conversationId: string
  workspacePath: string
  agentId: string
  runId: string
  abortSignal: AbortSignal
}

type ToolResult =
  | { ok: true, value: unknown, isError?: boolean }
  | { ok: false, error: string }
```

**内置工具清单**详见 Spec 07。

**约束**：
- Tool 实现必须 honor `ctx.abortSignal`
- `bash` 的命令在执行前必须通过黑名单校验（详见 CLAUDE.md §5.2；bash 工具目前 **TODO**，详见 Spec 07）

---

## 7. AgentRun

一次 Agent 执行的元信息。用于状态追踪与调用树可视化。

```typescript
interface AgentRun {
  id: string                    // run_<nanoid>
  conversationId: string
  agentId: string
  triggerMessageId?: string     // 由哪条消息触发；错误降级 run 可能没有 trigger

  status: 'queued' | 'running' | 'complete' | 'failed' | 'aborted'
  error?: string

  parentRunId?: string          // Orchestrator 调度的子 run 通过此字段链回
                                // 没有外键约束，逻辑保证

  startedAt: number
  finishedAt?: number
}
```

**约束**：
- 一次 run 可能产生多条 Message（thinking → tool_use → 文本输出 → artifact_ref）
- Orchestrator 的子 run `parentRunId` 必须指向其父 run
- 同一 `triggerMessageId` 可能触发多个并行 run（群聊多 @ 场景）

---

## 8. Attachment

会话文件库的一条记录。用户上传的图片 / 文件，message.parts 通过 `image_attachment` / `file_attachment` part 引用，agent 通过 `read_attachment` 工具读取（详见 Spec 07）。

```typescript
interface Attachment {
  id: string                    // att_<nanoid>
  conversationId: string        // 不跨会话共享
  kind: 'image' | 'file'
  fileName: string              // 原始文件名
  filePath: string              // 相对 workspace.rootPath
  size: number                  // 字节
  mimeType: string

  createdAt: number
}
```

**约束**：
- 物理文件存于 `workspace.rootPath/attachments/<id>-<fileName>`
- 删除 Conversation 级联删除 attachments 行（物理文件随 workspace 目录一起被删）
- 单会话累计上限：100 MB / 1000 文件（与 workspace 共享配额）
- 单个 attachment 可被同会话内多条 message 引用，删除 attachment 不删除引用它的 message.parts（前端 lazy fetch 时显示「附件已删除」墓碑）

---

## ID 命名规范

| 实体 | 前缀 |
|---|---|
| Agent | `ag_` |
| Conversation | `conv_` |
| Message | `msg_` / `msg_err_` |
| Artifact | `art_` |
| Workspace | `ws_` |
| AgentRun | `run_` |
| Attachment | `att_` |
| ToolCall（内存中） | `call_` |

ID 用 `nanoid(12)`，URL-safe alphabet。详见 `src/server/ids.ts`。

---

## 关系图

```
Conversation ─1:1─ Workspace
     │
     ├─1:N─ Message ─0:N─ artifact_ref part ──┐
     │         │            ─0:N─ image/file_attachment part ──┐
     │         │                              │                │
     │         └─N:1─ Agent                   ▼                │
     │                                    Artifact ─N:1─ Artifact (parent version)
     │                                        │                │
     ├─1:N─ AgentRun                          │                │
     │         │                              │                │
     │         ├─N:1─ Agent                   │                ▼
     │         └─0:N─ AgentRun (parent)       │            Attachment
     │                                        │
     │         created_by ────────────────────┘
     │
     └─1:N─ Attachment
```

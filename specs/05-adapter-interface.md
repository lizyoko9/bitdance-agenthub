# Spec 05 — AgentPlatformAdapter 接口

> 适配器层屏蔽不同 Agent 平台（Claude Code、Codex、自配置 Agent）的 API 差异，对上层提供统一的事件流。**修改接口需先讨论。**

源文件：`src/server/adapters/`

---

## 现状说明（先读这段）

| Adapter | 状态 |
|---|---|
| `MockAdapter` | ✅ 已实现，用于开发期不烧 token |
| `CustomAgentAdapter` | ✅ 已实现，覆盖 DeepSeek / OpenAI / 火山方舟 / per-agent OpenAI-compatible Base URL（OpenAI Chat Completions 兼容协议）；**Anthropic 路径在 buildClient 里直接 throw，待实装** |
| `ClaudeCodeAdapter` | ✅ 已实现，基于 `@anthropic-ai/claude-agent-sdk` `query()` + `canUseTool` 审批桥 |
| `CodexAdapter` | ✅ 已实现，基于 `@openai/codex-sdk` `runStreamed()`；Review 模式只读，Auto 模式 workspace-write；自定义 Base URL 必须支持 Codex/Responses |

---

## 定位

```
应用层 (AgentRunner)
       │
       │ stream(input, signal) → AsyncIterable<StreamEvent>
       ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│ ClaudeCode   │  │ Codex        │  │ CustomAgent      │  │ Mock         │
│ Adapter      │  │ Adapter      │  │ Adapter          │  │ Adapter      │
│ ✅ 已实现     │  │ ✅ 已实现     │  │ ✅ 已实现         │  │ ✅ 已实现     │
└──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  └──────┬───────┘
       │                 │                   │                    │
   @anthropic-ai/    @openai/           OpenAI SDK            预设脚本
   claude-agent-sdk  codex-sdk          (DeepSeek / 火山方舟 / OpenAI /
                    (Responses)         自定义 OpenAI-compatible
                                        均走 Chat Completions 兼容协议)
                                        + 自写 tool loop
```

**Adapter 的唯一职责**：把厂商 SDK 的输出翻译成 Spec 02 定义的 `StreamEvent`。

**Adapter 不做的事**：
- 不写数据库
- 不发 SSE
- 不持有跨调用的状态（除厂商 SDK 的 client 实例）

**Adapter 现状放宽的事**（与 CLAUDE.md §3.1 铁律有张力）：
- **直接 import `toolRegistry` 自跑 tool loop** —— CustomAgentAdapter 模块顶部 `import { toolRegistry } from '@/server/tools/registry'`，loop 内 `toolRegistry.execute(name, args, ctx)`。设计上工具执行属 L3，但代码现状是 Adapter 自调。本 spec 承认放宽，原因见下方「工具执行」一节

---

## 接口定义

```typescript
interface AgentPlatformAdapter {
  readonly name: AdapterName

  stream(
    input: AdapterInput,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>
}

interface AdapterInput {
  agentId: string               // 用于事件 tag
  conversationId: string
  runId: string
  parentRunId?: string          // Orchestrator 派出的子 run

  prompt: string                // 已被外层拼好的完整 prompt（群聊场景含 XML 包装，详见 Spec 06）
  workspacePath: string         // 该会话的 workspace 绝对路径

  // 系统提示，AgentRunner 已注入 <workspace_info> 块。所有 adapter 共用
  systemPrompt: string

  // 该 agent 单独的 API key；null 时 adapter 走环境 / OAuth fallback
  apiKey: string | null

  // 当前 agent 可用的工具名。Custom adapter 用 toolRegistry.resolve(toolNames) 拿 ToolDef；
  // Claude Code / Codex adapter 忽略此字段（用 SDK 内置工具集）
  toolNames: string[]

  // 附件（用户上传的文件/图片）— 用于 multimodal 投递
  attachments?: Array<{
    id: string                  // att_<nanoid>
    fileName: string
    mimeType: string
    kind: 'image' | 'file'
    absPath: string             // 服务端绝对路径，Adapter 自读
  }>

  // 跨 run 对话历史（OpenAI ChatMessage 格式），不含当前触发消息。
  // 由 AgentRunner 通过 conversation-context.buildHistoryFor 序列化，详见 Spec 13。
  // - CustomAgentAdapter：拼到 [system, ...history, currentUser] 中间
  // - ClaudeCodeAdapter / CodexAdapter：忽略（走 SDK 自己的 session resume）
  // - MockAdapter：忽略
  history?: ChatCompletionMessageParam[]

  // 仅 CustomAgentAdapter 使用（OpenAI 兼容协议特有的模型选择）
  customConfig?: {
    modelProvider: 'anthropic' | 'openai' | 'deepseek' | 'volcano-ark' | 'openai-compatible'
    modelId: string
    supportsVision: boolean     // 决定是否把图片附件以 image_url block 投递给 LLM
  }
}
```

**变更点（与早期 spec 差异）**：
- `tools: ToolDef[]` → `toolNames: string[]`：避免把 handler 函数引用塞进 input；Adapter 用 `toolRegistry.resolve` 自查
- 新增 `attachments`：multimodal 路径
- 新增 `customConfig.modelProvider: 'volcano-ark'`：OpenAI-compat 接入
- 新增 `customConfig.modelProvider: 'openai-compatible'`：per-agent `apiBaseUrl` + `apiKey` 的通用 Chat Completions 兼容接入
- `systemPrompt` / `apiKey` 提升到根字段（不再嵌 `customConfig`）：所有 adapter 都需要，ClaudeCodeAdapter 也读这两个
- 新增 `customConfig.apiKey`：per-agent API key（优先级高于 env，见 Spec 08）
- 新增 `customConfig.supportsVision`：决定是否把图片以 multimodal 投递
- 新增 `parentRunId`：Orchestrator 子 run 的父引用

---

## CustomAgentAdapter

源文件：`src/server/adapters/custom-agent-adapter.ts`

最复杂的 adapter：自己实现 tool loop，覆盖 DeepSeek / OpenAI / 火山方舟 / 通用 OpenAI-compatible provider（其中 Anthropic 仍 TODO）。

### 高层流程

```
1. buildClient(provider, apiKey, apiBaseUrl) → OpenAI 兼容 client
   apiKey 来自 AdapterInput.apiKey（已由 AgentRunner 按四层链解析，
   见下方顶级章节「API key 解析（共四层）」）。
   provider → baseURL 映射：
     deepseek    → https://api.deepseek.com/v1
     volcano-ark → https://ark.cn-beijing.volces.com/api/v3
     openai      → https://api.openai.com/v1
     openai-compatible → agent.apiBaseUrl（必填）
     anthropic   → throw (TODO)
   
2. 初始化 messages:
   [
     { role: 'system', content: customConfig.systemPrompt },
     { role: 'user',   content: buildMultimodalUserContent(prompt, attachments) },
   ]
   
   buildMultimodalUserContent: 
     - supportsVision=true 且有图片附件：用 OpenAI content blocks 数组
       [{ type: 'text', text }, { type: 'image_url', image_url: { url: 'data:<mime>;base64,...' } }, ...]
     - 否则纯文本字符串
   
3. tool loop（最多 MAX_TURNS=8 轮）:
   每轮：
     yield message.start (新 partIndex 重置)
     client.chat.completions.create({ model, messages, tools, stream: true })
     for await chunk:
       - delta.content → text part
       - delta.reasoning_content → thinking part (DeepSeek 思维链)
       - delta.tool_calls → 累积 tool_calls
     yield message.end
     
     若无 tool_calls：跳出循环
     若有 tool_calls：
       并行 toolRegistry.execute(name, args, ctx)
       逐个 yield tool.result
        write_artifact 检测 result.value.artifactId 存在 → yield artifact.create (拉 DB 详情)
        deploy_artifact / deploy_workspace 检测 DeployStatusRecord → yield deploy.status
       把 assistant 消息（含 tool_calls + reasoning_content）和 tool result 推回 messages
       继续下一轮
```

### Reasoning 内容（DeepSeek thinking mode）

DeepSeek 等支持思考链的模型在 stream 中会单独输出 `delta.reasoning_content`。Adapter 处理：

1. 第一次见到 reasoning_content 时 emit `part.start` (type='thinking', content='')
2. 后续累积到 `reasoningBuffer`，emit `part.delta` (type='thinking.append')
3. **关键**：assistant 消息推回 messages 时必须带上 `reasoning_content` 字段，否则 DeepSeek 会报：

> `400 The reasoning_content in the thinking mode must be passed back to the API.`

这是 DeepSeek 特殊协议要求；其它 provider 忽略此字段。

### Multimodal

`buildMultimodalUserContent`（`custom-agent-adapter.ts:337-358`）：

- agent `supportsVision=true` 且 attachments 含 `kind='image'`：把 prompt 包成 OpenAI content blocks 数组，图片走 `image_url` block（base64 data URI），mimeType 来自 attachment row
- agent `supportsVision=false` 或无图片：纯文本字符串（沿用 OpenAI legacy 单字符串 content）

DeepSeek 的多模态模型（`deepseek-v4-flash`）走标准 OpenAI image_url 协议。

### Artifact / Deploy 注入路径

不在 Adapter 自己发 `artifact_ref` / `deploy_status` part。流程：

1. Adapter 检测 `tool_result.value.artifactId` 非空 → `yield { type: 'artifact.create', artifact: <DB row> }`
2. AgentRunner 接到 `artifact.create` 事件 → 在当前 message 末尾插入 `artifact_ref` part 并补发 `part.start`
3. Adapter 检测 `DeployStatusRecord`（来自 `deploy_artifact` / `deploy_workspace`）→ `yield { type:'deploy.status', messageId, deployment }`
4. AgentRunner 接到 `deploy.status` → 插入 `deploy_status` part 并补发 `part.start`
5. 这样 message.parts 里 tool_use → tool_result → artifact_ref / deploy_status 顺序排列，前端按 callId 合并工具卡片，其它结构化 part 单独渲染为卡片

详见 Spec 02 的「artifact_ref / deploy_status 注入路径」一节。

---

## 工具执行：Adapter 与 Runner 的边界

源文件：`src/server/adapters/custom-agent-adapter.ts:47`

```typescript
import { toolRegistry } from '@/server/tools/registry'
// ...
const result = await toolRegistry.execute(name, args, ctx)
```

**为什么放宽 §3.1 铁律**：

| 方案 | 描述 | 取舍 |
|---|---|---|
| **A. Adapter 自调 toolRegistry**（现状） | 模块顶部 import，loop 中直接 execute | 代码简单；Adapter 多一个依赖 |
| **B. Adapter 只 yield 事件，Runner 执行后注入** | Adapter 必须支持「暂停-等待 result-继续」 | 干净；async iterator 双向通信复杂 |

---

## Token usage 采集

所有 adapter 在 run 结束前 yield 一次 `run.usage` 事件（见 Spec 02），AgentRunner 收到后写入 `agent_runs.usage` JSON 列（见 Spec 08）。

| Adapter | usage 来源 |
|---|---|
| `ClaudeCodeAdapter` | `SDKResultMessage.usage`（success / error 都有）+ `modelUsage` 拿实际模型 id |
| `CodexAdapter` | `runStreamed()` 的 `turn.completed.usage` |
| `CustomAgentAdapter` | 调用时设 `stream_options: { include_usage: true }`，stream 末尾会有一个携 `usage` 的特殊 chunk；跨 turn 累加（一个 run 内可能 ≤ MAX_TURNS=8 次 chat.completions.create） |
| `MockAdapter` | 不上报 usage（agent_runs.usage = null） |

**字段映射**（OpenAI 协议 → 我们的 `RunUsage`）：
- `prompt_tokens` → `inputTokens`
- `completion_tokens` → `outputTokens`
- `prompt_cache_hit_tokens` (DeepSeek) / `cached_tokens` (OpenAI) → `cacheReadTokens`
- DeepSeek 不报 cache_creation；保持 0

**字段映射**（Anthropic SDK → 我们的 `RunUsage`）：
- `input_tokens` → `inputTokens`
- `output_tokens` → `outputTokens`
- `cache_creation_input_tokens` → `cacheCreationTokens`
- `cache_read_input_tokens` → `cacheReadTokens`

`lastInputTokens` 取本次 run 的 input prompt 长度，UI 用作「当前 context 大小」仪表。`model` 字段记录实际使用模型，按模型聚合用。

仅记 token 数量，**不算成本**（不同 provider / 第三方网关价格差异大，价格表难维护准确）。Cache hit 数量本身就足够看出节约程度。


方案 A 已落地。本 spec 承认放宽 —— Adapter **可以**调用 `toolRegistry`，但仍不**直接写 DB / 发 SSE**。Runner 仍是唯一的「event → 持久化 + 广播」入口。

如果未来要重新隔离（比如要给 Adapter 跑在 worker thread / 子进程），再切方案 B。

---

## MockAdapter

源文件：`src/server/adapters/mock-adapter.ts`

```typescript
class MockAdapter implements AgentPlatformAdapter {
  readonly name = 'mock' as const

  async *stream(input, signal) {
    const script = this.scripts.get(input.agentId) ?? DEFAULT_MOCK_SCRIPT
    for (const event of script) {
      if (signal.aborted) return
      await sleep(50)
      yield event
    }
  }
}
```

**用途**：开发期不烧 token、单元测试、演示环境备份。

---

## API key 解析（共四层）

所有 adapter 走同一套 key 解析链，由 `AgentRunner.buildAdapterInput`（`src/server/agent-runner.ts`）执行。Adapter 只看 `AdapterInput.apiKey` 一个字段，不关心来源。

```
1. agents.api_key                   per-agent override（最高优先级）
2. app_settings.<provider>          用户在「设置」面板自填（Spec 08 §8）
3. process.env.<PROVIDER>_API_KEY   .env.local 兜底（dev / CI）
4. ~/.claude/.credentials.json      仅 ClaudeCodeAdapter，SDK 内部读 OAuth
```

**Provider 字段映射**（用于第 2 / 3 层选具体字段）：

| agent.adapterName | agent.modelProvider | app_settings 字段 | env var |
|---|---|---|---|
| `claude-code` | — | `anthropicApiKey` | `ANTHROPIC_API_KEY` |
| `codex` | — | `openaiApiKey` | `CODEX_API_KEY` → `OPENAI_API_KEY` |
| `custom` | `anthropic` | `anthropicApiKey` | `ANTHROPIC_API_KEY` |
| `custom` | `openai` | `openaiApiKey` | `OPENAI_API_KEY` |
| `custom` | `deepseek` | `deepseekApiKey` | `DEEPSEEK_API_KEY` |
| `custom` | `volcano-ark` | `arkApiKey` | `ARK_API_KEY` |
| `custom` | `openai-compatible` | —（per-agent only） | — |

**`apiBaseUrl` 按 adapter 分协议**：
- Claude Code：`agent.apiBaseUrl` → `app_settings.anthropicBaseUrl` → `process.env.ANTHROPIC_BASE_URL` → SDK 默认。非空时 ClaudeCodeAdapter 改用 `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL` env 注入（详见 Spec 01 §agents）。
- Codex：只使用 `agent.apiBaseUrl` → SDK 默认，不读 CC Switch / `~/.codex/config.toml` / 全局 Codex base URL。非空时必须是 Codex/Responses 兼容 endpoint；DeepSeek 等 Chat Completions-only endpoint 会在运行前被拒绝。
- Custom：命名 provider 使用 adapter 内置默认 base URL；`openai-compatible` provider 必须使用 per-agent `apiBaseUrl`，该 URL 必须是 OpenAI Chat Completions 兼容 endpoint，不是 Codex/Responses endpoint。

**优化点**：`buildAdapterInput` 只在 `agent.apiKey` 为空（或 Claude Code agent 的 `apiBaseUrl` 也为空）时才查 `app_settings`，避免每次构造 input 都打 DB。

**Adapter 视角**：
- **ClaudeCodeAdapter**：把 `input.apiKey` 通过 `options.env.ANTHROPIC_API_KEY` 传 SDK 子进程；为空时落到第 4 层 OAuth
- **CodexAdapter**：把 `input.apiKey` 通过 SDK `apiKey` 注入 `CODEX_API_KEY`；默认使用 AgentHub 隔离的 `CODEX_HOME`，不读取用户本机 `~/.codex`。`baseUrl` 对应 Codex runtime 的 `openai_base_url`，要求后端支持 `/responses`
- **CustomAgentAdapter**：命名 provider 把 `input.apiKey` 传 `new OpenAI({ apiKey })` 或 provider 默认 `baseURL`；`openai-compatible` 传 `new OpenAI({ apiKey, baseURL: input.apiBaseUrl })`，缺 key/base URL 时在调用上游前抛清晰错误
- **MockAdapter**：忽略

**用户什么都不配，本机装过 Claude Code 并 login 过就能直接用**（第 4 层兜底）。

---

## ClaudeCodeAdapter

源文件：`src/server/adapters/claude-code-adapter.ts`

封装 `@anthropic-ai/claude-agent-sdk` 的 `query()` API。SDK 自身就是 Claude Code CLI 的底层（同一 codebase 拆出的库），所以 ClaudeCodeAdapter 等价于把整个 Claude Code 接进来当一个 AgentHub agent。

```typescript
import { AbortError, query, type Options } from '@anthropic-ai/claude-agent-sdk'
import { pendingWrites } from '@/server/pending-writes'
import { findBannedPattern } from '@/server/security'
import { assertPathWithinWorkspace, getEffectiveCwd } from '@/server/workspace-utils'

class ClaudeCodeAdapter implements AgentPlatformAdapter {
  readonly name = 'claude-code' as const
  async *stream(input, signal) {
    const controller = new AbortController()
    signal.addEventListener('abort', () => controller.abort(), { once: true })

    const options: Options = {
      cwd: getEffectiveCwd(workspace),
      abortController: controller,
      model: input.customConfig?.modelId ?? 'claude-opus-4-7',
      systemPrompt: { type: 'preset', preset: 'claude_code', append: input.systemPrompt },
      tools: { type: 'preset', preset: 'claude_code' },
      includePartialMessages: true,
      settingSources: [],           // 隔离 mode，不读用户 ~/.claude 设定
      permissionMode: 'default',    // 自己 canUseTool 接管
      env: input.apiKey ? { ...process.env, ANTHROPIC_API_KEY: input.apiKey } : process.env,
      canUseTool: bridgePermission, // ↓ 见下方
    }

    const q = query({ prompt: input.prompt, options })
    for await (const m of q) {
      // 翻译 SDKMessage → StreamEvent
    }
  }
}
```

### 事件翻译

| SDK 消息 | 对应 StreamEvent |
|---|---|
| `SDKSystemMessage subtype:'init'` | 忽略 |
| `SDKPartialAssistantMessage` (开 `includePartialMessages: true`) `content_block_delta + text_delta` | 第一次开 text part：`part.start({type:'text',content:''})`；后续：`part.delta({type:'text.append',text})` |
| `SDKAssistantMessage.message.content` 里的 `text` 块 | 兜底：若 partial 没投递过，整段开一个 text part |
| `SDKAssistantMessage.message.content` 里的 `tool_use` 块 | `tool.call({callId,toolName,args})`；本地 `Map<sdk_id, ourCallId>` 记账 |
| `SDKUserMessage.message.content` 里的 `tool_result` 块 | 用 `Map` 查回 `callId`，`tool.result({callId,result,isError})` |
| `SDKResultMessage` (success / error variants) | 跳出 for-await，最后 emit `message.end` |
| 其他（task progress / hook events / status / notification） | 忽略（MVP） |

`message.start` / `message.end` 由 adapter 自己起止；`run.start` / `run.end` 仍由 AgentRunner 包外发。

### canUseTool 桥（审批 / 沙箱 / 黑名单）

SDK 提供 `canUseTool(toolName, toolInput, options) => PermissionResult` 钩子，每次工具调用前回调。AgentHub 在这里集中处理所有安全策略：

1. **路径沙箱**（Read / Write / Edit / NotebookEdit）：`assertPathWithinWorkspace(workspace, toolInput.file_path)`，越界 `{ behavior: 'deny', message }`
2. **Bash 黑名单与关键命令审批**（Bash）：`findBannedPattern(toolInput.command)` 命中 deny；未命中但 `classifyBashApproval(toolInput.command)` 命中时，注册 `PendingBashCommand` 并等待用户批准；通过后 allow（cwd 已限定）
3. **fs_write 审批**（Write / Edit；Auto 模式直接 allow）：
   - `oldContent = readIfExists(workspace, path)`
   - `newContent = computeNewContent(...)` —— Write 取 `content`；Edit 用 `oldContent.split(old_string).join(new_string)` 计算应用后文件（`replace_all=false` 时要求 1 次匹配，跟 SDK 行为对齐）
   - `pendingWrites.register({ ..., skipWrite: true })` —— **关键**：传 `skipWrite: true`，approve 时 store 不调 `writeFileInWorkspace`，让 SDK 自己写
   - `await new Promise(resolve => pendingWrites.attachResolver(pending.id, resolve))` 阻塞等用户决定
   - applied → `{ behavior: 'allow' }`；rejected → `{ behavior: 'deny', message: 'User rejected the file change' }`
4. **NotebookEdit**：MVP 不做 diff 审批，Review 模式直接 deny；Auto 模式 allow
5. **其它工具**（Read / Grep / Glob / WebFetch / WebSearch / Task / TodoWrite / ...）：默认 allow

### Skills（渐进披露，2C）

ClaudeCodeAdapter **复用 SDK 原生 Agent Skills**（`@anthropic-ai/claude-agent-sdk` 自带渐进披露：磁盘发现 `SKILL.md` → 仅 name+description 进上下文 → 模型调原生 `Skill` 工具加载正文），而非 AgentHub 自建 catalog/load_skill（custom/codex 才用后者）。

- AgentRunner 把 agent 选用的 Skill 解析后经 `AdapterInput.skills`（`{name,description,instruction}[]`）传入，**不**注入 systemPrompt 文本。
- adapter run 前把每个 skill 物化成 `<cwd>/.claude/skills/agenthub-<i>-<slug>/SKILL.md`（`buildSkillMarkdown` 序列化；`agenthub-` 前缀目录隔离用户自有 skill），并设 `options.skills = [skill 名]` 精确启用（不连带 workspace 里用户其它 skill）。
- `settingSources: ['project']` 使物化目录被当作项目 skill 发现。
- run 结束 / 中止在 `finally` 清理本次物化目录（只删 `agenthub-` 前缀）；plan 阶段不挂 skill。
- local 模式注意：物化写进用户真实 workspace（前缀隔离 + 用完即删）；进程被强杀时可能残留前缀目录，可被下次同名覆盖。

### 工具集

完全用 SDK preset `'claude_code'`（即 Claude Code CLI 自带的全套），不消费 `AdapterInput.toolNames`。AgentHub 通过 SDK in-process MCP server 额外暴露 `write_artifact` / `read_artifact` / `deploy_artifact` / `deploy_workspace` / `ask_user` / `report_task_result`。`fs_write` 审批流通过 `pendingWrites` store 共享，关键 Bash 命令审批通过 `pendingBashCommands` store 共享，UI 层（`PendingWritesPanel` / `PendingWriteDiffTab` / `PendingBashCommandsPanel`）、`bash.ts` 和 `claude-code-adapter.ts` 共享命令安全策略（`src/server/security.ts`、`src/server/bash-command-approval.ts`）。

### Subagent (Task)

SDK Task 工具开子 agent 后，子 agent 的 `tool_use` / `tool_result` 块默认在同一个 `query()` 流上推回（`parent_tool_use_id` 非 null）。MVP 不把子 agent 抽成独立 `AgentRun`，UI 把这些 tool_use 直接作为父 message 里的 `ToolUsePart` 渲染就行。后续可通过 `Options.forwardSubagentText: true` + `SubagentStart`/`SubagentStop` hooks 升级成独立 child run。

### API key fallback

详见上方顶级章节「API key 解析（共四层）」。ClaudeCodeAdapter 视角：
- 第 1-3 层由 `AgentRunner.buildAdapterInput` 解析后塞进 `AdapterInput.apiKey`，adapter 把它注入 `options.env.ANTHROPIC_API_KEY` 传 SDK 子进程
- 第 4 层（OAuth `~/.claude/.credentials.json`）是 SDK 自动 fallback，AgentHub 不参与

### Abort

`Options.abortController` 接收 AbortSignal。AgentRunner 给每个 run 的 `signal` 透传到 SDK：

```typescript
const controller = new AbortController()
signal.addEventListener('abort', () => controller.abort(), { once: true })
```

捕获 `AbortError` 区分主动中止和真错误（中止时静默 return，run.end 状态由 AgentRunner 决定为 `'aborted'`）。

### 不做 / 推迟

- Subagent 独立 child run（MVP 同流够用）
- MCP server 配置 UI
- Skills / Plugins / Worktree SDK 高级特性
- `write_artifact` 给 Claude Code agent（绑本地项目时文件就是产物）
- NotebookEdit 审批 diff
- Thinking 块翻译（需要开 Anthropic betas）

---

## CodexAdapter

源文件：`src/server/adapters/codex-adapter.ts`

封装 OpenAI 官方 `@openai/codex-sdk`，不手写 `spawn('codex')`。SDK 内部会使用 npm 依赖里的 `@openai/codex` runtime 并输出结构化 JSONL 事件；Adapter 只消费 SDK 的 `runStreamed()` 事件，不要求用户额外全局安装 Codex CLI。

CodexAdapter 不是「任意 OpenAI-compatible Chat Completions」入口。Codex SDK 的 `baseUrl` 最终传给 Codex runtime 的 `openai_base_url`，runtime 会连接 Responses/Codex 所需的 `/responses` 端点（含 WebSocket 流）。DeepSeek 官方 endpoint 当前没有 `/responses`，因此 `https://api.deepseek.com` / `https://api.deepseek.com/v1` 必须走 `CustomAgentAdapter`，不能走 CodexAdapter。

官方 Codex SDK 形态：
- TypeScript：`@openai/codex-sdk`，服务端 Node.js 18+ 使用；支持 `Codex().startThread()` / `resumeThread(threadId)` / `thread.runStreamed(prompt)`。
- Python：`openai-codex`，通过本地 Codex app-server / JSON-RPC 控制 Codex。AgentHub 是 Next.js/Node 服务端，除非后续有明确理由，不走 Python SDK。

```typescript
import { Codex } from '@openai/codex-sdk'

const codex = new Codex({
  apiKey: input.apiKey ?? undefined,
  baseUrl: input.apiBaseUrl ?? undefined,
  config: { developer_instructions: input.systemPrompt },
})
const thread = cachedThreadId
  ? codex.resumeThread(cachedThreadId, threadOptions)
  : codex.startThread(threadOptions)

const { events } = await thread.runStreamed(input.prompt, { signal })
// 将 SDK thread / turn / item / usage 事件翻译为 StreamEvent
```

### 接入原则

1. **SDK first**：CodexAdapter 使用 `@openai/codex-sdk`。`codex exec --json` 或 `codex mcp-server` 只作为自动化 / MCP 参考，不是主路径。
2. **线程续接**：按 `conversationId + agentId` 缓存 Codex threadId；撤回 / 编辑重发 / 重新生成 / 删除会话 / context compact 时清理对应 thread，模式参考 `ClaudeCodeAdapter` 的 session 缓存。
3. **运行时环境隔离**：Codex 子进程使用 AgentHub 管理的 `CODEX_HOME=<dataDir>/codex-home` 和 `CODEX_SQLITE_HOME=<dataDir>/codex-home`。继承 PATH / HOME / 代理等普通环境，但剥离外部 `CODEX_*`（保留 `CODEX_CA_CERTIFICATE`），避免 CC Switch 或用户 `~/.codex/config.toml` 影响 AgentHub 调试。
4. **AgentHub MCP bridge**：Codex config 注入 `mcp_servers.agenthub`，启动 `scripts/agenthub-codex-mcp.mjs` stdio server。bridge 只暴露 `write_artifact` / `read_artifact` / `deploy_artifact` / `deploy_workspace` / `ask_user` / `report_task_result`，通过带 token 的内部 API 调用 `toolRegistry`。
5. **Base URL 兼容性**：`apiBaseUrl` 只接受 Codex/Responses 兼容 endpoint。运行前拦截已知不支持的 DeepSeek host；如果运行时出现 `/responses` 404 / Not Found，也归因为协议不兼容并提示用户改用 Custom adapter。
6. **Workspace 与 sandbox**：`workingDirectory = AdapterInput.workspacePath`，`skipGitRepoCheck=true`（sandbox workspace 可能不是 git repo）。Review 模式用 `sandboxMode='read-only'`；Auto 模式用 `sandboxMode='workspace-write'`。不启用 `danger-full-access`。
7. **审批与安全**：当前 TypeScript SDK 没有 Claude `canUseTool` 等价 hook，所以 Review 模式不允许自动写盘。Auto 模式下由 Codex 自己的 workspace-write sandbox 限制边界；`approvalPolicy='never'`、`networkAccessEnabled=false`、`webSearchMode='disabled'`，避免产生 AgentHub 无法接管的交互式审批请求。
8. **事件翻译**：SDK 的 `thread.started` 缓存 threadId；`agent_message` → text part；`reasoning` / `todo_list` → thinking part；`command_execution` / `file_change` / `mcp_tool_call` / `web_search` → tool call/result；`turn.completed.usage` → `message.usage` + `run.usage`。AgentHub MCP 的 `write_artifact` / `deploy_artifact` / `deploy_workspace` 结果额外翻译成 `artifact.create` / `deploy.status`。
9. **图片附件**：`kind='image'` 的 attachment 通过 SDK `local_image` 输入传给 Codex。普通文件附件暂不直传；需要文件内容时让 Codex 在 workspace 里读取，或后续通过 AgentHub MCP 工具扩展。

### CLI fallback（当前不实现）

CodexAdapter 当前必须走 `@openai/codex-sdk`。如果后续 SDK 缺少实现必需能力，才另写补充 spec 评估 CLI fallback；不能把 CLI spawn 作为默认 adapter 设计。

**后续增强**：如果 Codex SDK 暴露可拦截的 patch / exec approval hook，再把 Review 模式桥到 AgentHub `pendingWrites` 和命令黑名单。否则可做 shadow workspace：Codex 在临时副本里写，run 结束后把 diff 转成 `pendingWrites` 给用户审批。

---

## AgentRegistry：根据 Agent 路由到 Adapter

源文件：`src/server/adapters/registry.ts`

```typescript
class AgentRegistry {
  private adapters: Map<AdapterName, AgentPlatformAdapter>

  getAdapter(agent: Agent): AgentPlatformAdapter {
    const adapter = this.adapters.get(agent.adapterName)
    if (!adapter) throw new Error(`Unknown adapter: ${agent.adapterName}`)
    return adapter
  }
}
```

当前注册的 adapter：`mock`、`custom`、`claude-code`、`codex`。

---

## 错误处理

- Adapter 内部捕获厂商 SDK 异常 → throw 出 stream；AgentRunner 接住后为该 run 内未配对 `tool_result` 的 `tool_use` 补发 `isError=true` 结果，写 `run.end({ status: 'failed', error })`，并通过 `emitErrorVisualisation` 注入一条 `msg_err_*` 错误消息让用户在对话里看到（见 Spec 09 / Spec 02）
- **网络/速率限制类错误的重试**：CustomAgentAdapter 通过 OpenAI SDK 的 `maxRetries=2`（在 `buildClient` 中显式声明，常量 `MAX_API_RETRIES`）自动重试，对 408 / 429 / >= 500 / `APIConnectionError` 走指数退避。注意：**重试只对初始连接生效**，stream 一旦开始 emit chunks 就不再重试。如果要按 provider 调整次数（比如火山方舟更宽松），改这个常量
- LLM 输出 JSON Schema 不符 / tool args 解析失败 → 由 `toolRegistry.execute` 内部 catch 成 `tool.result.isError=true`，**不**视作 Adapter 错误

---

## 新增 Adapter 的步骤

1. 在 `src/server/adapters/` 创建 `<name>-adapter.ts`
2. 实现 `AgentPlatformAdapter` 接口
3. 在 `src/shared/types.ts` 的 `AdapterName` 联合类型加新值
4. 在 `adapters/registry.ts` 注册
5. （UI 路径）在 `src/components/create-agent-dialog.tsx` 加新 provider 选项
6. （seed）若是内置 agent，在 `src/db/seed.ts` 加种子
7. 写至少 1 个单元测试覆盖事件翻译核心路径
8. 更新本 spec 的「现状说明」表格

---

## 与其它 spec 的关系

- Spec 01：Agent.adapterName 决定路由到哪个 Adapter
- Spec 02：StreamEvent 是 Adapter 的输出 schema
- Spec 06：Orchestrator 给子 agent 拼 prompt 时也走 CustomAgentAdapter（Orchestrator 本身也是一个 custom agent）
- Spec 07：toolNames 引用的工具定义
- Spec 08：agents.api_key / api_base_url 字段；app_settings 表（全局 key 兜底）

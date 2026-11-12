# Spec 13 — 对话上下文（Conversation Context）

> 多轮对话里 agent 怎么「记住」之前发生的事。这个 spec 定义从 DB messages 表到 LLM 的 `messages` 数组的序列化契约。

源文件：`src/server/conversation-context.ts`（`buildHistoryFor`），`src/server/adapters/types.ts`（`AdapterInput.history` 字段），`src/server/adapters/custom-agent-adapter.ts`（消费侧）。

---

## 背景

`messages` 表（`schema.ts`）一直完整持久化每一轮对话——user prompt 和 agent 的完整 parts 数组。但 `agent-runner.ts` 调用 adapter 时只传**当前触发消息一条 text prompt**，从来不读历史。结果 agent 每次都像新对话，无法记住上一句。这是 spec 13 要解决的核心问题。

CustomAgentAdapter 已有 within-run 的 turn 累计（一个 run 内 LLM 调用 tool → 收到 tool_result → 再调 LLM，这条链路上的 message 累计正常），但**跨 run 没有**。本 spec 解决的是跨 run（一轮新的用户消息触发新 run）的历史延续。

---

## 设计原则

1. **history 是 OpenAI ChatMessage 数组**：adapter 直接拼用，不做转换。L3 服务层负责序列化。
2. **agent 视角隔离**：每个 agent 看到的 history 是「以该 agent 为 LLM 主体」视角下的版本——它自己的发言是 `assistant`，他人发言（如有）是 `user` 带前缀。
3. **artifact 不内联**：history 里的 `artifact_ref` part 折叠成 `[Artifact: title (id=...)]` 文本占位，agent 真要看内容自己 `read_artifact`。`deploy_status` 只折叠为部署 URL / 失败原因，不内联 artifact 内容。
4. **pinned 永远在**：pinned messages 不计入「最近 N 条」额度，永远注入（去重）。
5. **token 预算 Phase D 才做**：Phase A 用简单 N=20 条上限，超出范围用户自行 pin 关键消息。

---

## 核心函数签名

```typescript
interface BuildHistoryOptions {
  /** 取最近多少条 messages（不含 pinned）。默认 20。 */
  maxTurns?: number
  /** 是否把 pinned messages 注入。默认 true。 */
  includePinned?: boolean
}

export async function buildHistoryFor(
  agentId: string,
  conversationId: string,
  options?: BuildHistoryOptions,
): Promise<ChatCompletionMessageParam[]>
```

返回值类型来自 `openai/resources/chat/completions` 的 `ChatCompletionMessageParam` 联合类型（system / user / assistant / tool）。**不含**当前触发消息——那条由 adapter 自己拼到末尾（保持现状）。

---

## Message 选取

1. 查 conversation：`pinnedMessageIds` 字段（来自 `conversations` 表）
2. 查 `messages` 表：`WHERE conversation_id = ? AND status = 'completed'`，按 `created_at ASC` 取最近 `maxTurns` 条
3. 加上 pinned messages（按 id 查，可能在最近 N 条之外）
4. 合并去重（按 id），按 `created_at` 升序排列
5. **排除**当前触发消息（caller 传 `excludeMessageId` 参数）

`status = 'completed'` 的过滤很关键：streaming / failed 状态的消息不应进历史（部分内容、未完成 tool_use 等）。

---

## Part → ChatMessage 序列化

按消息 `role` 和（若是 assistant）`agentId === 当前 agent` 分支：

### user message（role='user'）

`parts` 可能含 `text` / `image_attachment` / `file_attachment`：

- `text` → 拼到 content 文本
- `image_attachment` → **Phase A 用占位文本** `[图片附件: <fileName>]`；Phase D / 多模态升级时再考虑从 DB 重新读 base64 注入 multimodal blocks（成本高，且大多时候用户后续 prompt 已经文本描述过图片内容）
- `file_attachment` → 占位文本 `[文件附件: <fileName>]`

输出：

```typescript
{ role: 'user', content: '......' }
```

### 自己的 assistant message（role='assistant' && agentId === currentAgentId）

把 parts 数组按出现顺序处理。跨 run 历史只保留公开输出；`thinking` / `tool_use` / `tool_result` 一律丢。within-run 的工具调用链仍由 adapter 内部维护，本节只处理已经落库的历史消息。

收集：
- `text` / `code` → 拼到 assistant content
- `artifact_ref` → 折叠 `[产物: <title> (id=<artifactId>)]` 文本（需要从 artifacts 表 join 出 title；title 拿不到时退化为 `[产物 art_xxx]`）
- `deploy_status` → artifact 来源折叠 `[部署预览: <title> vN (<previewPath>)]`，workspace 来源折叠 `[部署预览: <title> workspace=<path> (<previewPath>)]`，失败时折叠 `[部署失败: ...]`

输出（按 OpenAI schema）：

```typescript
{
  role: 'assistant',
  content: '......text+code+artifact_ref 折叠后的字符串'
}
```

如果公开文本为空，整条 assistant message 跳过。这样避免把上一轮 `read_artifact` / shell / fs 工具结果作为历史再次喂给模型；产物内容始终通过 `artifact_ref` id 占位并由 agent 按需 `read_artifact`。

### 别 agent 的 message（role='agent' && agentId !== currentAgentId）

**群聊场景（Phase C，已实现）**：当 `conversation.agentIds.length > 1` 时，别 agent 的发言渲染成 `user` role 消息、加 `[<Agent名>] ` 前缀注入给当前 agent。只保留 `text` / `code` / `artifact_ref`（折叠占位）；`thinking` / `tool_use` / `tool_result` 一律丢——「文字是公共语言，思考与工具调用是 agent 私事」。文本为空则整条跳过。

单聊场景（`agentIds` 长度 ≤ 1）不会出现别 agent 消息，跳过。

实现：`renderOtherAgentAsUser`。是否启用由 `buildHistoryFor` 内部按 `agentIds.length > 1` 自动判定（构造 `agentNames` map），不需要 caller 传开关。

---

## Pinned messages 注入

`conversation.pinnedMessageIds` 是用户在 UI 上长按消息 → 「pin」 的消息 id 列表。它们的语义是「无视截断，永远在 context 里」。

实现：和最近 N 条合并到同一个查询，按 id 去重，按 `created_at` 升序排序。**不**做特殊位置注入（不放头部、不加 `[Pinned]` 标记）——保持时间序列连贯性。

如果用户 pin 了一条很老的消息，它会出现在 history 数组的早期位置（按时间）。LLM 看到的就是「这条老消息 + 之后的最近 N 条」的混合时间线。

---

## 序列化纯函数边界

`buildHistoryFor` 应**只做 DB 读 + 纯转换**，不发起 LLM 调用、不查 artifact 全文（只查 title）、不访问 workspace。这样：
- 单测好写
- 缓存友好（DB 读结果可以 memo per conversation/turn）
- 失败不影响主流程（捕获异常返回空数组，agent 退化到「无历史」模式）

---

## AgentRunner 集成

`agent-runner.ts:buildAdapterInput` 调用 `buildHistoryFor`，把结果塞进 `AdapterInput.history`（新字段）：

```typescript
const history = await buildHistoryFor(agent.id, args.conversationId, {
  maxTurns: 20,
  includePinned: true,
}).catch((err) => {
  console.warn('[agent-runner] buildHistoryFor failed, falling back to no history', err)
  return []
})
```

并把 `excludeMessageId` 设为当前触发的 user message id，避免触发消息被同时计入历史。

被 Orchestrator 分派的 sub-agent（`args.overridePrompt` 已设）**跳过** `buildHistoryFor`——它已由 spec 06 的 `buildSubAgentPrompt` 拿到隔离上下文（`<recent_conversation>` + pinned + artifacts + task），再注入完整历史既重复烧 token、又破坏 spec 06 的隔离。只有普通会话轮次（用户直发 / @mention）才注入历史。

---

## System prompt 装配顺序（含 Skills · Phase 2）

`buildAdapterInput` 按**固定顺序**拼 system prompt，保证可解释、可测、安全约束优先（对应 openspec conversation-context delta「deterministic order」）：

```
1. workspace context block（buildWorkspaceContextBlock）
2. base system prompt（agent.systemPrompt 或 override）
3. AgentHub 工具 / 安全指导（buildAgentHubToolGuidance）
4. Skill 指令块（resolveEffectiveSkills → buildSkillContext）  ← Phase 2 新增 · 2E 公共池
5. 群聊说明（GROUP_CHAT_SYSTEM_NOTE，仅群聊 custom）
   —— 以上累加后再算 token 预算，promptEstimate 包含全部 ——
6. 跨 run 历史 / pinned / 摘要（按预算注入）
7. 当前用户轮次（prompt）
```

**Skill 注入规则**（纯函数 `src/shared/skill-context.ts`，渐进披露 2C + 公共池 2E）：
- 对**所有 adapter** 生效（Skill 是方法论，与 adapter 无关），注入到 system prompt 第 4 段。
- **有效 Skill（Phase 2E）**：单一出口 `resolveEffectiveSkills(agent)` = `agent.skillIds` 自选（顺序优先）**∪** 公共池（`enabled && is_global_default`），按 id 去重；**自选排前**（优先拿内联额度）、公共排后。缺失 / `enabled=0` / 公共禁用的 id 静默剔除。三条 adapter 装配路径 + `load_skill` 作用域都走它。
- **渐进披露**：始终给 catalog（每条 `name`+`description`）；**短 skill（≤ `INLINE_SKILL_TOKENS`=350 tok）内联全文**保证总是生效，长 skill 仅进 catalog。整条要么内联要么进 catalog，不截断单条、**不做 summarize**。
- **内联预算**随模型上下文浮动 `skillInlineBudget = min(3000, ctx*8%)`、下限 1500；超预算的短 skill 降级为「仅 catalog」（不整条消失）。
- **按 adapter 分策略**（loadable）：
  - `custom`：catalog + 短 skill 内联，提供 `load_skill` 工具按需取长 skill；有有效 Skill 时自动把 `load_skill` 加入 `toolNames`（不占用户勾选）。
  - `codex`：同 custom 的文本注入（catalog + 内联，loadable=true）；`load_skill` 经 agenthub MCP bridge 暴露（`scripts/agenthub-codex-mcp.mjs` 注册 + 内部端点 `EXPOSED_TOOLS`），不走 `toolNames`。
  - `claude-code`：**不注入文本**，改由 adapter 把有效 skill 物化成 workspace `.claude/skills/agenthub-<i>-<slug>/SKILL.md` + 设 `options.skills`，交 SDK 原生渐进披露（`Skill` 工具）；run 结束清理物化目录（见 spec 05）。AgentRunner 经 `AdapterInput.skills` 传解析结果。
  - `load_skill` 作用域严格限定 agent 的**有效 Skill 集**（自选 ∪ 公共；集合外 id 拒绝，防越权）。
- Skill **不扩权**：只影响行为策略，不改变用户配置的工具权限；安全/工具约束（第 3 段）优先级高于 Skill。

---

## Adapter 消费

### CustomAgentAdapter

`messages` 数组组装从：
```typescript
[
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userContent },
]
```
改为：
```typescript
[
  { role: 'system', content: systemPrompt },
  ...input.history,             // ← spec 13 注入点
  { role: 'user', content: userContent },
]
```

`input.history` 为空数组时行为与现状一致（向后兼容）。

### ClaudeCodeAdapter

**忽略** `input.history`，因为它已经通过 `previousSessionId` resume 走 SDK 内部 session 续接（见 `claude-code-adapter.ts:50` 的 `claudeSessions` map）。spec 13 不重复实现这条路径。

未来 Phase E 会把 sessionId 从内存 map 挪到 DB 持久化，但仍走 SDK 续接、不走 `input.history`。

### MockAdapter

忽略，无影响。

---

## 群聊 / Orchestrator（Phase C，已实现）

群聊（`conversation.agentIds.length > 1`）下，`buildHistoryFor` 按「当前 agent 为主体」的视角返回不同视图，**无需 caller 显式传 policy**——是否注入跨 agent 文本由会话 agent 数自动判定：

- **当前 agent 自己的消息**：折叠为只含公开输出的 `assistant` 消息（`renderSelfAssistantParts`）。drop thinking / tool_use / tool_result；artifact 只留 `[产物: title (id=...)]` 占位。
- **其他成员的消息（含 Orchestrator 与其他 worker）**：折叠成 `[<Agent名>] <文本>` 的单条 `user` 消息（`renderOtherAgentAsUser`）。drop thinking / tool_use / tool_result；artifact 只留 `[产物: title (id=...)]` 占位。

> 设计取舍：worker 一次写网页可能产生数 K token 的 tool_use/tool_result，别 agent 看了无意义；artifact 才是真正的跨 agent 交付物，要看内容自己 `read_artifact`。Orchestrator 同理——看 worker「最终发的话」就够决定下一步，不需要 worker 的中间过程。

### worker / Orchestrator 的 system prompt 追加

`agent-runner.ts:buildAdapterInput` 在「群聊 + custom adapter」时，把 `GROUP_CHAT_SYSTEM_NOTE` 追加到 system prompt 末尾，说明 `[名字]` 前缀语义：别人的话不是自己的输出、不带前缀的才是用户本人、产物用 `read_artifact` 取。追加发生在 token 预算估算**之前**，让这段说明计入 `promptEstimate`。

仅 custom adapter 需要：ClaudeCode adapter 不消费 `input.history`（走 SDK session resume），群聊里它只看自己的 session、不会出现 `[名字]` 前缀，故不追加。

`BuildHistoryOptions` 在 Phase C **没有**新增 `policy` 字段——早先设想的 `'self-only' | 'shared-text'` 开关被「按 `agentIds` 数自动判定」取代，省掉一个 caller 必须正确传参的旋钮。

---

## Token 预算

`buildHistoryFor` 的 `tokenBudget` 选项（单位：tokens）控制 history 的总 token 上限，**不含** system prompt / current user / output reserve。AgentRunner 算预算：

```typescript
const limits = getModelLimits(agent.modelProvider, agent.modelId)  // src/shared/model-registry.ts
const promptEstimate = estimateTokens(systemPrompt) + estimateTokens(currentUser) + 512  // safety margin
const historyBudget = Math.max(0, limits.contextWindow - limits.outputReserve - promptEstimate)
```

### 截断算法

序列化全部 N 条候选消息（每条 → 1 个 user message OR 1 个 assistant + K 个 tool messages），按 chronological order 排好。每个序列化组算出 token 数（粗粒度：4 字符 ≈ 1 token，外加每条 message 4 token metadata margin）。

如果总 token 超 budget，**从老到新**遍历，跳过 pinned 项，丢非 pinned 项直到符合预算。pinned 永远保留（即便总数仍超 budget——用户的 pin 是显式契约）。

### 模型上下文窗口表

`src/shared/model-registry.ts:KNOWN_MODELS` 列出常见 modelId 的精确 contextWindow + outputReserve。不在表里的 modelId 走 provider fallback：

| Provider | Fallback contextWindow |
|---|---|
| anthropic | 200K |
| openai | 128K |
| deepseek | 64K |
| volcano-ark | 32K |
| openai-compatible | 128K |

Provider 也未知（ClaudeCode adapter 没 modelProvider 字段）→ 兜底 200K。

reasoning 模型（DeepSeek R1 / OpenAI o1 等）`outputReserve` 加大到 16K-32K，因为 thinking 内容也吃输出 token。

### Token 估算

`estimateTokens(s) = ceil(s.length / 4)`。中英混合实测误差 10-20% 量级，对预算决策足够。Phase D 不引入 tiktoken / @anthropic/tokenizer 等真正 tokenizer 包（依赖大、性能开销大、对粗粒度截断收益小）。

---

## 手动上下文压缩（Phase E，第一版）

第一版提供显式压缩入口，不自动触发：

- 用户在输入框发送 `/compact`
- 或在 `UsageBadge` popover 点击「压缩上下文」

这两个入口都调用 `POST /api/conversations/:id/compact`，不会创建普通 user message，也不会触发 agent 回复。

### 持久化

压缩结果写入 `conversation_context_summaries` 表（详见 Spec 08）：

- `summary`：压缩后的长期上下文摘要
- `covered_until_message_id` / `covered_until_created_at`：摘要覆盖到的最后一条 message
- `source_message_count`：参与压缩的原始 message 数
- `token_estimate`：summary 粗略 token 估算
- `model_provider` / `model_id`：生成摘要的模型，启发式 fallback 时为 `NULL`

原始 `messages` 不删除、不改写。聊天记录仍完整可见；压缩只影响后续 LLM 上下文。

### 摘要内容契约

summary 必须保留：

1. 用户目标
2. 已确认的需求和约束
3. 已完成的改动或结论
4. 当前未解决问题
5. 重要文件、模块、命令
6. 重要 artifact id 和含义
7. 后续继续工作时必须记住的注意事项

summary 必须丢弃：寒暄、重复确认、无意义中间日志、完整 tool_result、长代码块、失败但无后续影响的尝试。

artifact 仍只记录 id/title，不内联全文；需要全文时 agent 继续用 `read_artifact`。

### 注入顺序

`buildHistoryFor` 读取同一 conversation 的最新 summary，并把它作为最早的一条 `user` role context message 注入：

```text
- conversation summary（如果存在）
- pinned messages（永远保留）
- 最近 N 条未被 summary 覆盖的普通历史
- 当前用户消息（adapter 自己追加）
```

被 summary 覆盖的普通非 pinned 消息不再重复注入，避免摘要和原文双计 token。pinned messages 不受覆盖范围影响，仍按原契约注入。

### ClaudeCodeAdapter 边界

Claude Code agent 默认通过 SDK `resume` 续接内部 session，不消费 `AdapterInput.history`。手动 compact 成功后必须清掉该 conversation 的 Claude Code session 缓存；下一轮 Claude Code run 不再 resume 老 session，而是在新 prompt 前置 `<conversation_summary>` 块。

### UI 反馈

compact 成功后，service 额外写一条 `role='system'` 的提示消息，例如：

```text
已压缩早期上下文，覆盖 18 条消息。
```

该系统消息只用于用户可见反馈，不参与 summary 表语义。

第一版不做自动压缩；自动阈值触发留到后续 Phase E.2。

---

## UI：用量在 UsageBadge popover 里展示

聊天 header 的 `UsageBadge`（`src/components/usage-badge.tsx`）原本就在显示「Σ N.Nk tok」累计；点开 popover 看 input/output/cache 拆分 + per-agent / per-model 拆分。Phase D 把「上下文容量」这件事并进同一个 popover：

- 「当前 ctx」行从单 token 数升级为「used / ceiling (pct%)」+ 进度条；颜色分档 <50% 灰 / 50-80% 黄 / >80% 红
- popover 底部那条「所有 token 都计费」提示后追加一句「Pin 消息可避免被预算自动截断」

**Why 不做底部独立指示器**：早期 Phase D 加过一个聊天底部的 `ContextUsageIndicator` 一行 UI，跟 UsageBadge 信息高度重叠 + 数据源不稳定（runsByConv 只在 streaming 时填，刷新后无数据时只能显占位），用户反馈视觉占位但没增量价值，已删。

数据来源：
- `lastInputTokens`：`useConversationUsageTotal` 给出的最近一次 streaming run 的 input token 数（只在当前 session streaming 过的 conversation 才有；旧会话刷新后为 0，此时 popover 隐藏整个 badge）
- `contextWindow`：会话内所有 agent 中 contextWindow 的最大值

**未显示场景**：`useConversationUsageTotal.runCount === 0` 时整个 badge 隐藏（沿用原行为）。

---

## 故意不做的事

| 项目 | 不做的理由 |
|---|---|
| **多模态 image 重传** | 老 user message 里的 image_attachment 现在只放占位文本，不重新读 base64。99% 场景用户已经在新 prompt 里复述过 |
| **thinking part 回传** | 一律丢。OpenAI 不支持回传 reasoning，DeepSeek 等模型回传也无意义 |
| **artifact 全文注入** | 永远只放 `[产物: title (id=art_xxx)]` 占位，agent 用 `read_artifact` 按需取 |
| **跨 conversation 记忆** | 不做。每个 conversation 是独立 sandbox |
| **精确 tokenizer**（tiktoken / @anthropic/tokenizer） | 粗粒度 4 字符≈1 token 估算误差 10-20%，对预算决策够用；引入真 tokenizer 增加 ~MB 级依赖 + 启动开销，性价比低 |
| **省流 / 全量 模式开关** | 让用户判断「该开省流还是全量」是错误的抽象——真实需求是「成本透明 + 自动稳定」。Phase D 的用量指示器 + 自动预算已经覆盖；用户主动管理走 pin / unpin 细粒度 |

---

## 验证清单（Phase A + B + C + D 合并前）

**Phase A + B**：
- [ ] 单聊：连续两轮对话，第二轮 agent 能正确引用第一轮的内容
- [ ] 单聊：agent 上一轮用过 bash/read_artifact 工具，下一轮历史不回放 tool_calls/tool_result，只保留公开文本与 artifact_ref 占位
- [ ] 单聊：把消息 pin 之后，即使发了 25+ 条新消息，pinned 那条仍在 history 里
- [ ] 单聊：历史中不生成 tool role message，OpenAI 没报「tool_call_id not found」之类错
- [ ] 单聊：artifact_ref 折叠为占位文本，agent 没把整个产物吐出来
- [ ] 群聊：单聊路径不 crash（消息选取 / tool 配对在多 agent 下仍正确）
- [ ] Claude Code agent：行为不变（不消费 history）

**Phase C（群聊跨 agent 视野）**：
- [ ] 群聊：worker 能看到别 agent 的文字发言（以 `[名字] ` 前缀的 user 消息出现），但看不到别人的 thinking / tool 调用细节
- [ ] 群聊：worker / Orchestrator（custom adapter）的 system prompt 末尾出现 `## 群聊上下文` 说明段
- [ ] 群聊：别 agent 的 artifact 只以 `[产物: title (id=...)]` 占位出现，需要全文走 read_artifact
- [ ] 单聊：system prompt 不追加群聊说明段（agentIds ≤ 1 不触发）
- [ ] Claude Code worker：群聊里不追加说明段、行为不变

**Phase D**：
- [ ] 跑 20+ 轮对话后，最新对话不会因为超 contextWindow 报 LLM API 错
- [ ] 用量指示器显示「上下文 X / Y」与「上轮 Z」，数据非 0 时可见
- [ ] 用量超 50% 字体转黄，超 80% 转红
- [ ] 一个超长老消息被 pin 之后，即便和它在同一会话里跑了 5K-token 级别的新对话，它仍在 history 里（pin 不被 budget 截断）

---

## 与其他 spec 的关系

- Spec 03（MessagePart）：本 spec 是 MessagePart → OpenAI ChatMessage 的反向映射
- Spec 05（adapter interface）：`AdapterInput.history` 字段在 spec 05 描述
- Spec 06（orchestrator flow）：两条上下文注入路径**已分工、不重叠**——被 Orchestrator 分派的 sub-agent（`args.overridePrompt` 已设）跳过本 spec 的 `buildHistoryFor`，只用 spec 06 的 `buildSubAgentPrompt`（`<recent_conversation>` + pinned + artifacts + task）作唯一上下文；只有普通会话轮次（用户直发 / @mention）才走 `buildHistoryFor` 注入 `[名字]` 前缀历史。这同时守住了 spec 06「子 agent 不看完整群聊历史」的隔离原则
- Spec 09（frontend）：pinned 消息的 UI 操作不变，本 spec 仅消费其结果

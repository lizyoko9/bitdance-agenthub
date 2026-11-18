# Spec 03 — MessagePart 类型

> Message 是「容器」，真正内容在 `parts: MessagePart[]`。本 spec 定义 part 类型与对应的渲染、增量协议、新增步骤。**修改 part 类型需先讨论。**

源文件：`src/shared/types.ts:7-27`、`src/components/message-parts.tsx`

---

## 设计原则

1. **Message = parts 数组，不是 markdown 字符串**（CLAUDE.md §3.4）。不把多种内容塞进一个字符串再用正则解析
2. **可辨联合（discriminated union）**：所有 part 有 `type` 字段，前端用 switch / reducer case 分发
3. **可增量 vs 一次性**：text / code / thinking 可流式 append；tool_use / tool_result / artifact_ref / 附件类不增量，整体 push
4. **附件 part 是引用，不内联内容**：image/file_attachment 只存 `attachmentId` + metadata，真实字节在 workspace 文件系统

---

## 类型定义

```typescript
type MessagePart =
  | { type: 'text';        content: string }
  | { type: 'code';        language: string; content: string }
  | { type: 'thinking';    content: string }
  | { type: 'tool_use';    callId: string; toolName: string; args: unknown }
  | { type: 'tool_result'; callId: string; result: unknown; isError: boolean }
  | { type: 'artifact_ref'; artifactId: string }
  | { type: 'deploy_status'; deployment: DeployStatusRecord }
  | { type: 'deploy_candidates'; candidates: DeployCandidateRecord[] }
  | { type: 'delivery_acceptance'; acceptance: DeliveryRunAcceptance }
  | { type: 'image_attachment';
      attachmentId: string; fileName: string; size: number; mimeType: string }
  | { type: 'file_attachment';
      attachmentId: string; fileName: string; size: number; mimeType: string }
```

源：`src/shared/types.ts:7-27`

---

## Part 详解

正式交付的 `delivery_acceptance` 是 Hub 写入的系统消息 part。内容包含规则版本、验收状态、可选回执 ID、检查细节或未验证原因。前端在对话内展示，通过普通消息快照恢复。该 part 为一次性结果，见 Spec 17。

### 1. `text`

```typescript
{ type: 'text', content: string }
```

Agent 的主要文字输出。content 是 markdown 文本，前端用 `react-markdown + remark-gfm` 渲染（`src/components/markdown.tsx`），fenced code block 走 shiki 高亮的 `<CodeBlock>` 组件。

**可增量**：`PartDelta { type: 'text.append', text }` 追加到 content。

### 2. `code`

```typescript
{ type: 'code', language: string, content: string }
```

独立代码片段（不嵌入 markdown 流，作为单独 part 渲染）。Adapter 可以选择把代码块拆出来作为 code part 而不是塞进 text part 的 markdown 里 —— 用于「思考完后明确要展示一段代码」的场景。

**可增量**：`{ type: 'code.append', text }`。

**注意**：代码块多数情况由 LLM 在 text part 的 markdown 里以 ``` fence 形式输出（前端走 markdown 渲染），code part 用得相对少。

### 3. `thinking`

```typescript
{ type: 'thinking', content: string }
```

模型的思考链 / reasoning content（DeepSeek `reasoning_content`、Anthropic extended thinking）。前端默认折叠（`ThinkingPart`，`message-parts.tsx:84-109`），dashed border + 浅灰底，点击展开。

**可增量**：`{ type: 'thinking.append', text }`。

**特别**：DeepSeek 协议要求把 `reasoning_content` 在下一轮 turn 时也传回 messages 数组，Adapter 内部维护 `reasoningBuffer` 把它附在 assistant message 里（详见 Spec 05）。

### 4. `tool_use`

```typescript
{ type: 'tool_use', callId: string, toolName: string, args: unknown }
```

工具调用记录。callId 是 `call_<nanoid>`，用于和后续的 `tool_result` 配对。args 是 LLM 生成的 JSON 对象，未必符合工具的 schema —— 服务端在执行前会 zod 校验（见 Spec 07）。

**不增量**：args 一次性完整生成（Adapter 累积完 tool_calls delta 后才 emit 这个 part）。

### 5. `tool_result`

```typescript
{ type: 'tool_result', callId: string, result: unknown, isError: boolean }
```

工具执行结果。`callId` 必须与某个 `tool_use` 匹配。`result` 形状：

- `isError=false`：工具的 `ToolResult.value`，可能是 object / array / primitive
- `isError=true`：错误描述字符串（来自 `ToolResult.error`）

**不增量**：工具执行完才有完整结果。

**渲染合并**：前端 `PartList`（`message-parts.tsx:14-46`）按 callId 把 `tool_use` + `tool_result` 合并为同一张 `ToolUsePart` 卡片，显示「调用中 / 已完成 / 失败」三态 + 详情可展开。tool_result 自身不单独渲染。

**失败兜底**：run 失败或中止时，AgentRunner 会为该 run 内没有配对 `tool_result` 的 `tool_use` 补一个 `isError=true` 的 `tool_result` 并发布事件；前端 `run.end` reducer 也会做同样的本地兜底，避免工具卡长期停在「调用中」。

**bash 命令 / 输出视图**：`toolName='bash'` 且 `args.command` 是字符串时，`ToolUsePart` 将命令提升为独立终端样式块，支持自动换行、滚动、复制和详情展开。若 `tool_result.result.output` 存在，或 `tool_result.isError=true` 且 result 是字符串，工具卡会默认显示独立输出块，直接反馈 stdout/stderr 或错误；其余参数 / 返回元数据仍在详情中以 JSON 块展示。

### 6. `artifact_ref`

```typescript
{ type: 'artifact_ref', artifactId: string }
```

引用一个 artifact（产物）。卡片化渲染（`ArtifactRefPart`，`message-parts.tsx:205-273`），显示 title / type / version，点击打开右侧预览面板。

**注入路径**：不是 Adapter 直接 emit `part.start(artifact_ref)`，而是：
1. Adapter 执行 `write_artifact` 工具 → 返回 `{ artifactId, ... }`
2. Adapter emit `tool.result`（result 含 artifactId）
3. Adapter emit `artifact.create`（带完整 artifact 行）
4. **AgentRunner** 接到 `artifact.create` 后，在当前 message 末尾 push 一个 `artifact_ref` part 并补发 `part.start`

这样保证「产物归 Adapter，引用归 Runner」的清晰分工。

**Lazy load**：前端首次见到 `artifact_ref` 且 store 中无该 artifact 时，调 `fetchArtifact(id)` 拉详情；404 → 渲染「产物已删除」墓碑卡片。

### 7. `deploy_status`

```typescript
{ type: 'deploy_status', deployment: DeployStatusRecord }
```

展示一次部署状态。`sourceType='artifact'` 表示来自 `web_app` artifact；`sourceType='workspace'` 表示来自 workspace 静态输出目录，并用 `workspacePath` 标识来源。`status='ready'` 时卡片提供打开 / 复制预览 URL；本地静态发布记录还提供源码包 / 容器包下载；外部静态发布记录显示公开 URL 与本地回退路径；`status='failed'` 时展示失败原因。

**注入路径**：Adapter 在 `deploy_artifact` / `deploy_workspace` 成功返回部署记录后 emit `deploy.status`，AgentRunner 在当前 message 末尾 push `deploy_status` 并补发 `part.start`。确定性部署命令（`部署` / `发布` / `上线` / `/deploy`）不经过 Adapter，也可以直接由 `deploy-command-service` 创建包含 `deploy_status` 的 system message。

### 8. `deploy_candidates`

```typescript
{ type: 'deploy_candidates', candidates: DeployCandidateRecord[] }
```

当用户触发确定性部署命令且当前会话存在多个 `web_app` 产物时展示候选选择。前端候选卡显示标题、版本、创建 Agent、创建时间，并为每个候选提供“部署”操作；选择后调用会话部署 API，服务端再插入 `deploy_status` message。

### 9. `image_attachment`

```typescript
{ type: 'image_attachment', attachmentId: string, fileName: string, size: number, mimeType: string }
```

用户上传的图片附件（仅出现在 user message 的 parts 中，agent 不输出此类 part）。

**渲染**：`AttachmentChip` 缩略图（`src/components/attachment-chip.tsx`），点击放大。

**LLM 投递**：服务端 `sendMessage` 后，AgentRunner 通过 `AdapterInput.attachments` 把附件传给 Adapter，Adapter 在 agent `supportsVision=true` 时把图片以 OpenAI image_url block (`data:<mime>;base64,...`) 投给 LLM（详见 Spec 05）。

### 10. `file_attachment`

```typescript
{ type: 'file_attachment', attachmentId: string, fileName: string, size: number, mimeType: string }
```

用户上传的非图片文件（PDF / docx / md / txt / csv / ...）。

**渲染**：`AttachmentChip` 文件 chip。

**LLM 投递**：默认 **不**自动塞内容到 prompt（避免 prompt 爆炸）。Agent 想读时调 `read_attachment(attachmentId)` 工具（详见 Spec 07）。

---

## PartDelta：增量协议

```typescript
type PartDelta =
  | { type: 'text.append';     text: string }
  | { type: 'code.append';     text: string }
  | { type: 'thinking.append'; text: string }
```

事件 `part.delta` 携带这个 delta，按 `messageId + partIndex` 找到对应 part，根据 delta type 追加到 content。

**只有 3 种可增量 part**：text / code / thinking。其它（tool_use / tool_result / artifact_ref / 附件）一次性 push，无 delta。

**幂等性**：reducer 不保证 delta 顺序正确性（依赖 SSE TCP 顺序），但保证「多次相同 delta」时**不**去重（如果服务端误发会重复 append）。如未来要做事件重放，需要给 delta 加 seq 字段。

---

## 渲染契约

源文件：`src/components/message-parts.tsx`

### PartList：调度入口

```typescript
function PartList({ parts }) {
  // 1. 先扫一遍把所有 tool_result 按 callId 收集
  // 2. 渲染 parts 时：
  //    - tool_use → 用 callId 查到 tool_result，合并渲染为 ToolUsePart
  //    - tool_result → 跳过（已被 tool_use 吸收）
  //    - 其它 → 走 PartRenderer 分发
}
```

### PartRenderer 分发表

| Part type | 组件 | 备注 |
|---|---|---|
| `text` | `<Markdown>` | markdown + shiki fenced code |
| `code` | `<CodeBlock>` | shiki 双主题 |
| `thinking` | `<ThinkingPart>` | 折叠 |
| `tool_use` | `<ToolUsePart>` | 合并 tool_result 渲染 |
| `tool_result` | （跳过） | 由 ToolUsePart 吸收；失败 / 中止 run 会为未闭合 tool_use 补错误结果 |
| `artifact_ref` | `<ArtifactRefPart>` | 卡片，lazy fetch |
| `deploy_status` | `<DeployStatusPart>` | 部署状态卡，ready 时带打开/复制，存在下载路径时带源码包/容器包下载 |
| `deploy_candidates` | `<DeployCandidatesPart>` | 多个 web_app 候选选择卡，点击后调用部署 API |
| `image_attachment` | `<AttachmentChip context="message">` | 图片缩略 |
| `file_attachment` | `<AttachmentChip context="message">` | 文件 chip |

### 状态映射（在 MessageItem 层）

| message.status | 视觉 |
|---|---|
| `streaming` | 头像周围 ring + 名字旁 spinner |
| `complete` | 普通 |
| `error` | 红色边框气泡 |
| `aborted` | 灰色边框气泡 |

---

## 历史上下文转字符串

源文件：`src/server/agent-runner.ts` 的 `extractTextFromParts` / `buildAdapterInput` 流程

LLM 下一轮 turn 需要 history（assistant 的旧消息回传 messages 数组）。把 parts 数组拼成可读字符串的策略：

| Part | 拼接形式 |
|---|---|
| `text` | 原样 content |
| `code` | ```` ```<lang>\n<content>\n``` ```` |
| `thinking` | 跳过（不进 history，省 token；DeepSeek 特例除外，见 Spec 05） |
| `tool_use` | `[调用 <toolName>(<args 摘要>)]` |
| `tool_result` | `[<toolName> 结果: <result 摘要>]` |
| `artifact_ref` | `[产物: art_xxx]` |
| `deploy_status` | `[部署预览: title vN (/deployments/dep_xxx)]` / `[部署预览: title workspace=dist (/deployments/dep_xxx)]` 或 `[部署失败: ...]` |
| `deploy_candidates` | `[部署候选: title vN (id=art_xxx), ...]` |
| 附件 | `[图片附件: <fileName>]` / `[文件附件: <fileName>]` |

具体实现见 `agent-runner.ts` 的 `extractTextFromParts`（拼回字符串） + `buildMessagesForLLM`（构造 OpenAI format）。

**为什么不直接给 LLM 看 parts JSON**：LLM 对 JSON 的理解不如自然语言；对纯展示用结构（thinking、artifact_ref）转成短描述更省 token；tool_use/tool_result 已经在 OpenAI tool calling 协议里有专门字段，单独走 messages 的 tool_calls / tool 字段，不在 string content 里。

---

## 新增 part 类型的步骤

> 详见 `skills/新增一种 MessagePart 类型.md`（待写）。Outline：

1. **判断必要性** —— 能用 markdown 渲染 / 附件 part 表达的，不要单独开类型
2. **types.ts** 加联合分支：`{ type: 'foo', ... }`
3. **如果可增量** —— PartDelta 加 `'foo.append'`，reducer `part.delta` case 加分支
4. **渲染** —— `PartRenderer` switch 加 case；写新组件
5. **历史拼接** —— `extractTextFromParts` 决定怎么变字符串
6. **Adapter 产出路径** —— 哪个 adapter 在什么时机 emit `part.start({type:'foo', ...})`，可能伴随 `part.delta`
7. **DB schema 影响** —— parts 是 JSON 列，旧数据按旧 schema 解析仍合法；不需要 migration

---

## 与其它 spec 的关系

- Spec 01：Message 实体的 parts 字段
- Spec 02：`part.start` / `part.delta` / `part.end` 事件
- Spec 04：artifact_ref 引用的 Artifact 实体
- Spec 07：tool_use / tool_result 与工具系统
- Spec 09：前端 PartList 渲染、reducer case

---

## 撤回 / 编辑：物理删除

用户在 IM 入口撤回或编辑最后一条 user 消息时（详见 Spec 09），后端 service 走**物理 DELETE**：从 messages / artifacts / agent_runs 表移除对应行。**不是软删除**，被撤回的内容在 DB 中不留行。

- 同时删 message.parts 里的 `artifact_ref` 引用的 artifact（用户预期是「重来」，上一轮产物不保留）
- 不发布 StreamEvent 广播（这是同步操作，本地单用户场景，前端直接 update store）
- DB 层面没有「撤回」状态字段，无法事后审计被撤回的内容；这是有意的：减少状态空间

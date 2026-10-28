# Spec 02 — StreamEvent 协议

> 整个系统的「腰部」。L2 Adapter 产生事件 → L3 路由 → L4 SSE 推 → L5 store reducer 应用。**任何新 Adapter / UI 组件都必须围绕这套事件展开。**

---

## 设计原则

1. **细粒度**：run / message / part / tool / artifact / dispatch 各自有事件
2. **增量**：流式 part 用 `delta` 事件追加，不重传全量
3. **可恢复**：所有事件携带稳定 ID，前端崩溃重连后可补对账
4. **传输无关**：事件本身是纯数据，不绑死 SSE。未来换 WebSocket / RSC streaming 不影响事件定义

---

## 事件类型全集

```typescript
// 所有事件的公共字段
interface BaseEvent {
  conversationId: string        // 必带，前端按此分发到对应会话桶
  timestamp: number             // unix ms，仅用于诊断
}

type StreamEvent = BaseEvent & (
  // —— Run 生命周期 ——
  | { type: 'run.start',    runId: string, agentId: string, triggerMessageId: string, parentRunId?: string }
  | { type: 'run.end',      runId: string, status: 'complete' | 'failed' | 'aborted', error?: string }

  // —— Message 生命周期 ——
  | { type: 'message.start', messageId: string, agentId: string, runId: string }
  | { type: 'message.end',   messageId: string }
  | { type: 'message.added', message: Message }   // 用户消息：已落库后广播，让非发送方客户端实时插入
  | { type: 'message.removed', messageIds: string[], artifactIds: string[] }  // 撤回/编辑/重新生成删除消息后广播

  // —— Part 增量（核心，最高频）——
  | { type: 'part.start',  messageId: string, partIndex: number, part: MessagePart }
  | { type: 'part.delta',  messageId: string, partIndex: number, delta: PartDelta }
  | { type: 'part.end',    messageId: string, partIndex: number }

  // —— 工具调用 ——
  | { type: 'tool.call',   messageId: string, callId: string, toolName: string, args: any }
  | { type: 'tool.result', messageId: string, callId: string, result: any, isError: boolean }

  // —— 产物 ——
  | { type: 'artifact.create', artifact: Artifact }
  | { type: 'artifact.update', artifactId: string, patch: Partial<ArtifactContent> }
  | { type: 'deploy.status', messageId: string, deployment: DeployStatusRecord }

  // —— Orchestrator 调度可视化 ——
  | { type: 'dispatch.plan',  runId: string, plan: DispatchPlanItem[] }
  | { type: 'dispatch.start', parentRunId: string, childRunId: string, taskId: string, agentId: string }
  | { type: 'dispatch.end',
      parentRunId: string,
      childRunId?: string,
      taskId: string,
      status: 'complete' | 'failed' | 'aborted' | 'skipped',
      error?: string }

  // —— Agent fs_write 审批（仅 review 模式发；详见 Spec 07） ——
  | { type: 'fs_write.pending',  pendingWrite: PendingWrite }       // agent 调 fs_write，等用户审批
  | { type: 'fs_write.resolved', pendingId: string, applied: boolean } // approve / reject / run abort

  // —— Agent bash 关键命令审批（详见 Spec 07） ——
  | { type: 'bash_command.pending',  pendingCommand: PendingBashCommand }
  | { type: 'bash_command.resolved', pendingId: string, approved: boolean }

  // —— Token usage 计量（adapter 在 run 结束前 emit）——
  | { type: 'run.usage', runId: string, usage: RunUsageEvent }

  // —— 心跳 ——
  | { type: 'heartbeat' }
)

interface RunUsageEvent {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number    // Anthropic prompt cache 写入
  cacheReadTokens: number        // Anthropic prompt cache 命中；DeepSeek prompt_cache_hit_tokens 也映射到这
  lastInputTokens?: number       // 最近一次 input prompt 长度，UI 用作 ctx 仪表
  model?: string                 // 实际使用的模型 id
}

interface PendingWrite {
  id: string                    // pwr_<nanoid>
  conversationId: string
  agentId: string
  runId: string
  path: string                  // workspace 相对路径
  absolutePath: string
  oldContent: string | null     // null 表示新建文件
  newContent: string
  createdAt: number
}

interface PendingBashCommand {
  id: string                    // pbc_<nanoid>
  conversationId: string
  agentId: string
  runId: string
  command: string
  cwd: string
  reason: string
  createdAt: number
}

interface DispatchPlanItem {
  id: string                    // 子任务 id，如 't1'
  agentId: string
  task: string                  // 给该 agent 的具体任务描述
  dependsOn: string[]           // 前置任务 id 列表
}

type PartDelta =
  | { type: 'text.append',     text: string }
  | { type: 'code.append',     text: string }
  | { type: 'thinking.append', text: string }
  // 注：tool_use / tool_result / artifact_ref 不增量，整体替换或独立事件
```

---

## 事件流场景示例

### 场景 A：单聊，Agent 回复一段文字 + 一个产物

```
run.start         (runId=r1, agentId=cc)
message.start     (messageId=m1, agentId=cc, runId=r1)
part.start        (m1, 0, { type:'text', content:'' })
part.delta        (m1, 0, { type:'text.append', text:'好的，' })
part.delta        (m1, 0, { type:'text.append', text:'我为你写一个组件...' })
part.end          (m1, 0)
tool.call         (m1, c1, 'write_artifact', { ... })
artifact.create   ({ id:'a1', type:'web_app', ... })
tool.result       (m1, c1, { artifactId:'a1' }, false)
part.start        (m1, 1, { type:'artifact_ref', artifactId:'a1' })
tool.call         (m1, c2, 'deploy_artifact', { artifactId:'a1' })
tool.result       (m1, c2, { id:'dep1', status:'ready', previewPath:'/deployments/dep1' }, false)
deploy.status     (m1, { id:'dep1', status:'ready', ... })
part.start        (m1, 2, { type:'deploy_status', deployment:{...} })
part.end          (m1, 1)
message.end       (m1)
run.end           (r1, 'complete')
```

### 场景 B：群聊，Orchestrator 调度 2 个子 Agent 并行

```
run.start         (r1, orch)
message.start     (m1, orch, r1)
part.start        (m1, 0, { type:'thinking', content:'' })
part.delta        (...)
part.end          (m1, 0)
tool.call         (m1, c1, 'plan_tasks', ...)
dispatch.plan     (r1, [{ id:'t1', agentId:'pm', ... }, { id:'t2', agentId:'design', dependsOn:['t1'] }])
tool.result       (m1, c1, ...)
message.end       (m1)

dispatch.start    (r1, r2, t1, pm)
  run.start       (r2, pm, parentRunId=r1)
  message.start   (m2, pm, r2)
  ...
  run.end         (r2, 'complete')
dispatch.end      (parentRunId=r1, childRunId=r2, taskId=t1, status='complete')

dispatch.start    (r1, r3, t2, design)
  ...
dispatch.end      (parentRunId=r1, childRunId=r3, taskId=t2, status='complete')

# 聚合
message.start     (m4, orch, r1)
part.start        (m4, 0, { type:'text', content:'' })
part.delta        (...)
message.end       (m4)
run.end           (r1, 'complete')
```

若某任务因上游失败 / 中止被跳过，不会有 `dispatch.start` / child `run.start`，只发：

```
dispatch.end      (parentRunId=r1, taskId=t3, status='skipped', error='Upstream task did not complete')
```

---

## artifact_ref part 的注入路径

`artifact_ref` part **不由 Adapter 直接 emit**，由 AgentRunner 在接到 `artifact.create` 后注入到当前 message 的 parts 末尾。完整流程：

```
1. Adapter: yield tool.call(callId, 'write_artifact', args)
2. Adapter 内部 toolRegistry.execute → tool handler 写入 artifacts 表，返回 { artifactId, ... }
3. Adapter: yield tool.result(callId, { artifactId, ... }, isError=false)
4. Adapter: 检测 result.value.artifactId 非空 → 从 DB 拉完整 artifact 行
            yield artifact.create({ artifact: <row> })

5. AgentRunner 消费事件流，接到 artifact.create:
   - 找到当前 message（最近一条该 runId 下的 streaming message）
   - 给 message.parts 末尾 push 一个 { type: 'artifact_ref', artifactId }
   - 补发一个 part.start 事件让前端 reducer 同步

6. 前端 reducer 接 part.start → 在 messages[id].parts[nextIndex] 写入 artifact_ref part
```

**为什么不让 Adapter 直接 emit `part.start(artifact_ref)`**：保持「Adapter 只翻译事件，不操心 message.parts 结构」的边界。Adapter 知道「我创建了一个 artifact」，但不应关心「这条 message 的下一个 partIndex 是几」。AgentRunner 是唯一持有 message 流的角色，所以它来注入。

**前端无差别处理**：part.start 事件不区分是 Adapter emit 的还是 Runner 补的，reducer 都按 partIndex 写入。详见 Spec 09。

代码位置：`src/server/agent-runner.ts` 内 `consumeStream` 的 `artifact.create` 分支。

## deploy_status part 的注入路径

`deploy_status` part 同样由 AgentRunner 注入，不由 Adapter 直接发 `part.start`：

1. Adapter 执行 `deploy_artifact` / `deploy_workspace` 工具，得到 `DeployStatusRecord`
2. Adapter emit `tool.result`
3. Adapter emit `deploy.status`
4. AgentRunner 接到 `deploy.status` 后，在对应 message 末尾 push `{ type:'deploy_status', deployment }` 并补发 `part.start`

部署状态不单独建表；它是对一次消息输出的可视化状态记录。

---

## 持久化 vs 透传

| 事件 | 是否落库 | 备注 |
|---|---|---|
| `run.*` | ✅ 落到 `agent_runs` 表 | start/end 更新 status |
| `message.start` | ✅ 创建 message 记录（parts=[]） | |
| `message.end` | ✅ 更新 status='complete' | |
| `message.added` | ❌ 透传 | user 消息已由 `sendMessage` 落库；此事件仅广播给其它客户端，前端按 id 幂等 upsert（详见下方「用户消息广播」） |
| `message.removed` | ❌ 透传 | 撤回/编辑/重新生成已在服务端删库；此事件仅广播 messageIds/artifactIds 让其它客户端幂等移除 |
| `part.start` | ✅ 写入 `messages.parts[i]` | parts 整体作为 JSON 更新 |
| `part.delta` | ✅ 追加到 `messages.parts[i].content` | 高频写，按 100ms 窗口合并落库（见下方「写入策略」） |
| `part.end` | ❌ 透传 | parts 状态由 part.start/delta 已足够 |
| `tool.call` | ✅ 写为 message.parts 里的 tool_use part | |
| `tool.result` | ✅ 写为 message.parts 里的 tool_result part | run 失败 / 中止时，AgentRunner 会为未配对 `tool_result` 的 `tool_use` 补发 `isError=true` 结果 |
| `artifact.*` | ✅ 落到 `artifacts` 表 | |
| `dispatch.*` | ❌ 透传（信息来自 plan_tasks 工具调用 + agent_runs 表） | |
| `fs_write.pending` | ❌ 透传 | pending 队列存于内存单例（`src/server/pending-writes.ts`）；dev server 重启丢失，前端 mount 时拉一次兜底 |
| `fs_write.resolved` | ❌ 透传 | applied=true/false 由前端 store 用来移除对应 pending |
| `bash_command.pending` | ❌ 透传 | pending 队列存于内存单例（`src/server/pending-bash-commands.ts`）；前端 mount 时拉一次兜底 |
| `bash_command.resolved` | ❌ 透传 | approved=true/false 由前端 store 用来移除对应 pending |
| `run.usage` | ✅ 落到 `agent_runs.usage` JSON 列 | adapter 在 run 结束前 emit；前端 store 同步更新该 run 行 |
| `heartbeat` | ❌ 透传 | |

**写入策略**：流式 `part.delta` 高频，且每次写入都是整个 `parts` JSON（O(n²) 写放大），因此只改内存、按窗口合并落库。实现见 `src/server/message-parts-flusher.ts`：

- `part.delta` 只改 `consumeStream` 内的 `partsBuffer` 并标脏；`PART_DELTA_FLUSH_INTERVAL_MS`（100ms）窗口结束写一次
- `message.end` 把 `parts` 与 `status='complete'` 一起写入；`consumeStream` 退出（含抛错 / 中止）时 `dispose()` 强制刷盘
- 读消息快照（`listMessagesSnapshot`）前调用 `flushAllMessageParts()`，保证快照不比已推送的事件旧
- 写入使用同步 API（better-sqlite3），使快照读可以在一个同步块内完成

---

## SSE 编码

```
data: {"type":"part.delta","conversationId":"conv_abc","timestamp":1715000000000,...}\n\n
```

**不使用 SSE 的 `event:` 字段**（每个事件类型不同 event 名，前端切分支麻烦）。统一 `data:` 一个字段，前端 `JSON.parse` 后 switch type。

**心跳间隔 15s**，防止中间代理 / 浏览器空闲断连。心跳与 `connected` / `resync` 控制消息不带 `id:`。

---

## 断线恢复

EventBus 给每个事件分配单调 seq，SSE 帧带 `id: <bootId>-<seq>`（`bootId` 为进程启动时生成，区分重启后 seq 归零），并保留最近 `REPLAY_BUFFER_SIZE`（5000）条事件。

```
id: mvr44n2u-34
data: {"type":"run.end",...}\n\n
```

重连流程：

1. 浏览器自动重连时带 `Last-Event-ID` 头；客户端手动重建 EventSource（readyState=CLOSED 时退避重试）时改带 `?lastEventId=` query，头优先
2. 服务端在同一同步块内「补发缺口 + 订阅新事件」，不漏不重
3. 补不上（bootId 不同 = 进程重启、seq 早于缓冲最旧一条、id 非法）时推控制消息 `{"type":"resync"}`
4. 客户端收到 `resync`：`resetForStreamResync()` 丢弃非当前会话的消息缓存与「运行中」run；重拉会话列表、当前会话消息快照与各类 pending；期间到达的事件排队
5. `GET /api/conversations/[id]/messages` 返回 `{ messages, eventId }`，`eventId` 为快照对应的事件游标；快照落地后，排队事件中 seq ≤ 游标的**消息模型事件**（`message.*` / `part.*` / `tool.*`）丢弃，其余按序应用（`src/lib/stream-resync.ts`）

已知边界：`consumeStream` 先 `await persistEvent` 再 `publish`，两者之间隔一个微任务；若快照读恰好落在这个间隙，该事件会被重复应用一次（仅影响前端显示，DB 正确，刷新即恢复）。

---

## 不要做的事

- ❌ 不在事件中携带完整产物内容（用 `artifact.create` 单独事件 + 后续用 id 引用）
- ❌ 不为单个事件类型设计「事件 + 反向事件」（除生命周期 start/end 外）。状态机越简单越好
- ❌ 不在 Adapter 里发 `dispatch.*` 事件——这是 Orchestrator 调度器（AgentRunner 内部）的职责
- ❌ 不在事件 payload 里塞跟该事件无关的「全局状态」字段
- ❌ 不在 `part.delta` 里传完整 `text`（增量违反原则会导致后期重传放大）

---

## 兼容性

新增事件类型时：
1. 在 `StreamEvent` 联合类型中追加
2. 前端 reducer 增加 case；未实现的 case **必须** `default: ignore`（不报错）
3. 后端 EventBus 不需要改动（pass-through）

废弃事件类型时：
1. 先打 `@deprecated` 注释，保留至少 1 个版本
2. 验证所有 producer 已不再发该事件
3. 删除时同步删 reducer case
## Orchestrator plan review events

Plan review adds two dispatch events before the existing `dispatch.plan` execution event:

```typescript
| { type: 'dispatch.plan.pending', pendingPlan: PendingDispatchPlan }
| { type: 'dispatch.plan.resolved', pendingId: string, runId: string, approved: boolean }
```

`dispatch.plan.pending` means AgentRunner has compiled and validated a plan, registered it in the in-memory pending plan queue, and is waiting for user action. `dispatch.plan.resolved` removes that pending review from the UI. The existing `dispatch.plan` event remains the signal that an approved compiled plan is now executing.

These events are pass-through and are not persisted. The pending queue is recoverable through `GET /api/conversations/:id/pending-dispatch-plans` while the server process is alive.

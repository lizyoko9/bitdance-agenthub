# Spec 06 — Orchestrator 工作流

> 「主 Agent 协调器」是 AgentHub 的核心差异化能力。本文档定义其触发条件、工作流和数据流。

---

## 定位

Orchestrator 是「特殊 Agent」（详见 Spec 01）：
- `isOrchestrator: true`
- `toolNames` 必含 `dispatch_to_agent`（实际通过 `plan_tasks` 工具暴露给 LLM）
- 走同一个 `AgentRunner`，与普通 Agent 共享代码路径
- 默认 `adapterName: 'custom'`，由用户在创建时选定底层 LLM

**不要**为 Orchestrator 写独立服务。

---

## 触发条件

```
群聊场景（Conversation.mode === 'group'）:
  收到 user 消息时:
    if message.mentionedAgentIds 非空:
       直接为每个被 @ 的 Agent 创建独立 AgentRun
       Orchestrator 不参与
    else:
       查找该会话中 isOrchestrator: true 的 Agent
       若找到 → 触发 Orchestrator 的 AgentRun
       若未找到 → 报错：「群聊缺少协调者」

单聊场景（Conversation.mode === 'single'）:
  Orchestrator 不参与，直接触发那个 Agent
```

**蕴含规则**：群聊里有人 @ 时跳过 Orchestrator。用户的显式选择优先于自动调度。

---

## 三阶段工作流

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: PLAN                                               │
│ ─────────────────────────────────────────────────────────── │
│ 输入：群聊上下文（XML 包装的最近 N 条 + pin） + 用户消息    │
│       + 可用 Agent 列表（动态注入到 system prompt）         │
│ 行为：调底层 LLM，提供 plan_tasks 工具，强制调用；          │
│       plan_tasks 是计划阶段终止事件，之后不再消费该阶段输出 │
│ 输出：tool.call('plan_tasks', { reasoning, tasks })         │
│        → 发 dispatch.plan.pending 事件（UI 审查 / 编辑）    │
│        → 用户批准后发 dispatch.plan 并进入执行              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: EXECUTE                                            │
│ ─────────────────────────────────────────────────────────── │
│ 输入：plan.tasks                                            │
│ 行为：按 dependsOn 做 DAG 拓扑                              │
│       同一波次无依赖任务并行，但受全局并发上限约束         │
│       每个子任务：                                          │
│         等待进程级全局子任务信号量槽位                     │
│         dispatch.start                                      │
│         AgentRunner.run(subAgentId, subTask, subContext)   │
│         子 Agent 必须调用 report_task_result 上报语义结果   │
│         事件全部转发到主事件流                              │
│         dispatch.end(status=complete/failed/aborted/skipped)│
│       上游 failed/aborted/skipped 时，下游传递 skipped      │
│ 输出：Map<taskId, TaskResult>                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: AGGREGATE                                          │
│ ─────────────────────────────────────────────────────────── │
│ 输入：所有子任务结果（status / artifacts / 关键消息摘要）   │
│ 行为：再调一次 LLM，让 Orchestrator 生成聚合消息             │
│ 输出：一条 agent message，包含：                            │
│       - 完成情况总结                                        │
│       - 失败任务的原因                                      │
│       - 产物链接（artifact_ref parts）                      │
│       - 下一步建议                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## plan_tasks 工具签名

```typescript
const planTasksTool: ToolDef = {
  name: 'plan_tasks',
  description: '把用户请求拆解为子任务并分派给可用 Agent。一次性输出完整 plan。',
  parameters: {
    type: 'object',
    required: ['reasoning', 'tasks'],
    properties: {
      reasoning: {
        type: 'string',
        description: '简要说明拆解思路，3 句以内',
      },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'agentId', 'task'],
          properties: {
            id: {
              type: 'string',
              description: '子任务 id，使用 t1/t2/t3 形式',
            },
            agentId: {
              type: 'string',
              description: '执行该子任务的 Agent id，必须在可用列表中',
            },
            task: {
              type: 'string',
              description: '给该 Agent 的具体任务描述，独立可执行',
            },
            dependsOn: {
              type: 'array',
              items: { type: 'string' },
              description: '前置依赖的子任务 id 列表，无依赖则省略',
            },
          },
        },
      },
    },
  },
  handler: async (args, ctx) => {
    // plan_tasks 的 handler 不实际「执行」，
    // 它只是把 plan 透传给 AgentRunner 让其调度。
    // 这里返回的 ok=true 让 LLM 知道 plan 已被接受。
    return { ok: true, value: { acknowledged: true, taskCount: args.tasks.length } }
  },
}
```

**说明**：`plan_tasks` 是「输出端工具」——它的目的是让 LLM 用结构化方式输出 plan，而不是真的去做什么副作用。

**校验分层**：
- `plan_tasks` handler 只做参数形状校验（`tasks` 是否为数组、字段是否存在），返回 ack 给 LLM。
- AgentRunner 捕获 `plan_tasks` 后必须停止消费 plan 阶段后续输出，避免 Orchestrator 在等待审批前继续发消息或调用工具。
- AgentRunner 在发布 `dispatch.plan.pending` / `dispatch.plan` 与进入 EXECUTE 前必须先编译 plan，再做语义校验；失败时不发布执行事件，当前 Orchestrator run 以 `failed` 结束，并把明确错误写入 `run.end.error` / 错误消息。

**plan 编译**：
- `dependsOn` 仍是唯一执行顺序契约，但 Orchestrator 的 LLM 可能把依赖写进 task 文本而漏写字段。
- AgentRunner 必须在校验前运行确定性的 `compileDispatchPlan`：
  - 保留显式 `dependsOn`
  - 仅从同一 plan 中排在当前任务之前的任务推断缺失依赖
  - 识别 `t1 产物`、`读取 PRD`、`基于 UI 设计`、`审查前端实现`、`上游产物` 等高置信依赖信号
  - 审查 / 验收类任务默认依赖前面所有产物型任务
- `dispatch.plan` 事件发布编译后的 plan，而不是原始 LLM 输出。

语义校验规则：
- `tasks` 非空
- 每个 `id` 唯一
- 每个 `agentId` 必须属于当前群聊的可用 worker Agent 列表
- `agentId` 不能是 Orchestrator 自己，避免递归分派
- `dependsOn` 只能引用同一 plan 中存在的 task id
- task 不能依赖自己；同一 task 的 `dependsOn` 不能重复
- plan 必须是 DAG，不允许循环依赖

---

## Orchestrator 的 system prompt 模板

```
你是 AgentHub 的 Orchestrator，负责把用户请求拆解并分派给合适的 Agent。

【你的工作流】
1. 阅读群聊上下文与用户最新请求
2. 如果存在会阻塞正确规划的关键歧义，且能归纳为 2-4 个清晰选项，先调用 ask_user
3. 调用 plan_tasks 工具，输出结构化 plan
4. 等待系统执行 plan（你不需要做任何事）
5. 系统会再次唤起你做聚合总结

【可用 Agent 列表】
{{AGENT_LIST}}
（每个 Agent 包含 id、name、capabilities、tools、description）

【拆解原则】
- 充分利用每个 Agent 的 capabilities
- 能并行的尽量并行（不写 dependsOn）
- 有依赖关系的明确写 dependsOn
- 每个子任务给出独立可执行的描述（被分派的 Agent 看不到完整群聊上下文）
- 代码实现任务必须声明 taskKind="code"，并声明 required project expectedOutputs；project 由 workspace 文件写入自动产物化，不由 write_artifact 创建
- 代码实现任务必须声明可验证的 acceptanceCriteria / requiredEvidence，并尽量声明 requiredCommands（如 pnpm build、mvn compile）
- 只有需要真实 artifact 交接或供用户预览时才声明非 project expectedOutputs
- 审查 / 验证 / 诊断 / 状态检查 / 解释 / 总结等文字型任务不要声明 expectedOutputs，用 acceptanceCriteria 描述完成条件
- local workspace 中的本地代码任务（创建 / 修改 / 初始化 / 调试 / 构建项目或源码文件）应派给具备 fs_read / fs_write / bash 或 SDK 本地工具的 Agent
- local workspace 代码任务不要声明 expectedOutputs，用 acceptanceCriteria 描述应落盘的目录、文件、命令和验证结果；task 文本要明确要求直接修改当前本地 workspace 文件，不要用 write_artifact 代替源码落盘
- 不要重复拆解已有产物已满足的需求

【输出规则】
- 计划阶段只能调用 ask_user 和 plan_tasks，不要直接回复最终答案
- plan 一次性输出完整，不要分多次调用
```

---

## 子 Agent 看到的上下文

子 Agent 收到的 prompt 由 Orchestrator 的 `task` 字段 + 摘要包装而成：

```xml
<context>
  <recent_conversation>
    <!-- 最近 5 条群聊消息，按 Spec 03 的 XML 包装 -->
    <message from="user">帮我做一个番茄钟网站</message>
    <message from="orchestrator">[Orchestrator 的上一条消息]</message>
  </recent_conversation>

  <pinned_messages>
    <!-- 用户 pin 的关键消息 -->
  </pinned_messages>

  <upstream_artifacts>
    <!-- dependsOn 上游任务产物；仅列 id/title/type，不内联内容 -->
    <artifact id="art_001" type="document" title="番茄钟 PRD"/>
  </upstream_artifacts>

  <existing_artifacts>
    <!-- 会话内最近 N 个非上游产物；仅列 id/title/type，不内联内容 -->
    <artifact id="art_002" type="image" title="UI 设计稿"/>
  </existing_artifacts>
</context>

<your_task>
  {{ Orchestrator plan 里指派给这个 agent 的 task 字段 }}
</your_task>
```

**lazy load**：子 Agent 需要某个产物详情时，调用 `read_artifact(id)` 工具按需获取。

**结果上报**：子 Agent 收尾时必须调用 `report_task_result`。AgentRunner 不再把“child run 成功结束”或“artifact 已产出”直接等同于“任务完成”；只有 report 的 `status='complete'` 且 `acceptanceCriteria` 全部通过时，任务才可能进入 `complete`。代码实现任务还必须有至少一条非 prepare 的成功验证命令 evidence（如 build/test/typecheck/compile exitCode=0），并且 required project output 已由 workspace 写入产物化并绑定。未调用该工具、report 为 `failed/blocked`、任一 acceptance result 失败 / 缺失、代码任务无成功验证命令、或代码任务缺少 required project output，都会把该任务判为 `failed`。

**评测开关**：服务端以 `AGENTHUB_EVAL_EVIDENCE_GATES=off` 启动时关闭证据门，仅供评测对照组（见 `eval/README.md`）使用：不自动执行 `requiredCommands`，不做 report / 命令 / 目标路径 / required project output 的证据判定。子任务结果只看它自己的上报——未调用 `report_task_result` 或 report 为 `complete` 都算 `complete`，report 为 `failed/blocked` 仍判 `failed`。plan 阶段的校验不受影响。默认（未设置或其他值）证据门开启。

**artifact 注入**：
- `upstream_artifacts`：来自当前任务 `dependsOn` 的传递闭包上游结果，按 artifact id 去重后全部列出。例：`t4 -> t3 -> t2 -> t1` 时，t4 能看到 t1/t2/t3 的产物摘要。
- `existing_artifacts`：来自当前会话其它产物，排除 `upstream_artifacts` 中已经列过的 id，只保留最近 N 个（默认 5，按 `createdAt desc`），避免长会话把所有产物重复塞给每个子 agent。
- 两者都只列 `id` / `type` / `title`，不内联 artifact 内容；需要全文时走 `read_artifact(id)`。

**上下文截断**：`recent_conversation` 取最近 5 条 + 所有 pin。超出可配置上限（默认 5）的不传。

**与 Phase C 跨 agent 历史的关系**：Phase C（spec 13）给普通会话轮次的 custom agent 注入了 `[名字]` 前缀的完整群聊历史，但**被分派的 sub-agent 明确跳过 `buildHistoryFor`**——`agent-runner.ts:buildAdapterInput` 在 `args.overridePrompt` 已设时不注入历史。子 agent 的唯一上下文就是上面这个 `buildSubAgentPrompt` 包装，隔离原则不受 Phase C 影响。

---

## 子任务并发上限

Orchestrator 子任务执行使用 AgentRunner 模块级全局信号量，默认 `MAX_CONCURRENT_SUB_AGENT_RUNS = 4`。

语义：
- 上限是当前 Node 进程内全局共享，不按 conversation 分桶；这样更接近 provider API key 的限流粒度。
- `dispatch.start` 只在任务拿到槽位、即将启动 child AgentRun 时发布；等待槽位期间任务在 UI 中保持 `pending`。
- 父 run abort 时，仍在等待槽位的任务发布 `dispatch.end(status='aborted')`，不创建 child AgentRun。
- 不做 provider 分组、不做用户设置项；后续真需要更细粒度限流时再扩展。

---

## DAG 调度算法

`executePlan` 只接收已编译并通过语义校验的 plan；缺失依赖、重复 id、自依赖、循环依赖等坏 plan 应在进入本阶段前给出清晰错误。

```typescript
async function executePlan(
  plan: DispatchPlanItem[],
  ctx: { parentRunId: string, conversationId: string }
): Promise<Map<string, TaskResult>> {
  const completed = new Map<string, TaskResult>()
  const remaining = new Set(plan.map(t => t.id))

  while (remaining.size > 0) {
    // 上游没有成功完成的任务，不启动下游，直接标 skipped
    const skipped = plan.filter(t =>
      remaining.has(t.id) &&
      (t.dependsOn ?? []).some(d => completed.has(d) && completed.get(d)?.status !== 'complete')
    )
    for (const t of skipped) {
      const result = { taskId: t.id, status: 'skipped', error: 'Upstream task did not complete' }
      publish({ type: 'dispatch.end', parentRunId: ctx.parentRunId,
                taskId: t.id, status: 'skipped', error: result.error })
      completed.set(t.id, result)
      remaining.delete(t.id)
    }

    // 找出所有依赖已成功完成的任务
    const ready = plan.filter(t =>
      remaining.has(t.id) &&
      (t.dependsOn ?? []).every(d => completed.get(d)?.status === 'complete')
    )

    if (ready.length === 0) {
      throw new Error('Circular dependency or missing dependency in plan')
    }

    // 同一波并行执行；runSubTask 内部会先等待全局子任务信号量
    const results = await Promise.all(
      ready.map(t => runSubTask(t, completed, ctx))
    )

    for (let i = 0; i < ready.length; i++) {
      completed.set(ready[i].id, results[i])
      remaining.delete(ready[i].id)
    }
  }

  return completed
}

async function runSubTask(
  task: DispatchPlanItem,
  upstream: Map<string, TaskResult>,
  ctx: { parentRunId: string, conversationId: string }
): Promise<TaskResult> {
  const subRunId = generateRunId()
  publish({ type: 'dispatch.start', parentRunId: ctx.parentRunId,
            childRunId: subRunId, taskId: task.id, agentId: task.agentId, ... })

  try {
    const result = await AgentRunner.run({
      agentId: task.agentId,
      conversationId: ctx.conversationId,
      runId: subRunId,
      parentRunId: ctx.parentRunId,
      prompt: buildSubAgentPrompt(task, upstream, ctx.conversationId),
    })
    publish({ type: 'dispatch.end', parentRunId: ctx.parentRunId,
              childRunId: subRunId, taskId: task.id, status: result.status, ... })
    return { taskId: task.id, status: result.status, artifacts: result.artifacts }
  } catch (err) {
    publish({ type: 'dispatch.end', parentRunId: ctx.parentRunId,
              childRunId: subRunId, taskId: task.id,
              status: 'failed', ... })
    return { taskId: task.id, status: 'failed', error: String(err) }
  }
}
```

---

## 失败降级

**策略**：记录上报，由 Orchestrator 在聚合阶段决定向用户的措辞。

```
子 Agent run 失败:
  不在 AgentRunner 层重跑整个子任务
  TaskResult.status = 'failed'，error 字段记录原因

子 Agent run 被用户中止或父 run 级联中止:
  TaskResult.status = 'aborted'
  dispatch.end.status = 'aborted'

子 Agent run complete 但未调用 report_task_result:
  TaskResult.status = 'failed'
  error 记录「任务缺少 report_task_result」
  下游按依赖失败规则 skipped

子 Agent 调用 report_task_result 但 status 为 failed / blocked:
  TaskResult.status = 'failed'
  error 记录 report summary 与 blockers
  下游按依赖失败规则 skipped

子 Agent report_task_result.status=complete 但 acceptanceCriteria 缺项或 passed=false:
  TaskResult.status = 'failed'
  error 记录未通过 / 未上报的验收项
  下游按依赖失败规则 skipped

代码实现任务没有成功的非 prepare 验证命令 evidence:
  TaskResult.status = 'failed'
  error 记录缺少 build/compile/test/typecheck/lint exitCode=0 evidence
  进入已有重试 / 动态重规划补救流程

代码实现任务缺少 required project output:
  TaskResult.status = 'failed'
  error 记录缺少 project output
  进入已有重试 / 动态重规划补救流程

expectedOutputs / outputKey:
  非 project expectedOutputs 只用于 artifact 交接映射，不直接决定 TaskResult.status
  代码任务的 required project expectedOutput 是完成 gate，由 workspace fileWrites 自动生成并绑定
  如果上游 complete 但没有绑定下游需要的 artifact，依赖该 artifact 的任务会因 required input 缺失而 skipped
  上游任务本身是否 complete 由 report_task_result、acceptanceCriteria、代码验证 evidence、required project output 共同判定

某任务的任一 dependsOn 上游不是 complete:
  不启动该任务，不创建 child AgentRun
  TaskResult.status = 'skipped'
  dispatch.end.status = 'skipped'，不带 childRunId，但带 parentRunId

Stage 3 聚合时，Orchestrator 看到的 prompt 包含所有任务状态：
  <task_results>
    <result task="t1" agent="pm" status="complete">
      <task_report status="complete">
        <summary>PRD 已完成并覆盖核心范围。</summary>
      </task_report>
      <artifact_ref id="art_001"/>
    </result>
    <result task="t2" agent="design" status="failed">
      <error>Rate limited by upstream provider</error>
    </result>
    <result task="t3" agent="frontend" status="skipped" error="Skipped because upstream task(s) did not complete"/>
  </task_results>

Orchestrator 据此生成聚合消息。
```

**不做的事**：
- ❌ AgentRunner 层不做「同一子任务自动重试」的逻辑（避免重复工具副作用 / 重复 artifact；必要时由 Orchestrator 决定再次 plan）
- ❌ AgentRunner 层不做「换个 Agent 重试」的逻辑（Orchestrator 决定，必要时再次 plan）
- ❌ 不做无限重试

---

## 动态重规划（dynamic re-planning）

失败降级是"如实上报"，**动态重规划**把它升级为"自愈"：一轮 EXECUTE 后若仍有 failed/skipped/写冲突，把上一轮结果摘要喂回 Orchestrator，由它**再 plan 一轮补救**，最多 `MAX_DISPATCH_ROUNDS` 轮，再进 AGGREGATE。

```
PLAN → EXECUTE → (有失败/冲突 且未达上限?) → REPLAN(补救) → EXECUTE → … → AGGREGATE
```

- **决策权在 Orchestrator(LLM)**：AgentRunner 只机械地"再给一次 plan 机会"——把上一轮 `<previous_round_results>`（已完成 / 失败 / 冲突）+ 补救指示拼进 plan 阶段 user prompt（`buildReplanContext`），由 LLM 决定补救 plan（换 agent / 用 `dependsOn` 串行化写同一文件的任务 / 拆细）。LLM 这一轮不调 `plan_tasks` = 判断无需/无法补救 → 进聚合。这正是本规格「不做的事」里"必要时由 Orchestrator 决定再次 plan"的实现。
- **上限**：`MAX_DISPATCH_ROUNDS = 2`（首轮 + 最多 1 轮补救），呼应"不做无限重试"。
- **触发判定**：`shouldReplan(views, conflicts)` —— 本轮有非 complete 任务或有写冲突（纯函数，`dispatch-plan.ts`，可单测）。
- **结果合并**：跨轮按 `taskId` 合并（`mergedResults`，新轮覆盖同 id）；AGGREGATE 只喂合并后的最终态，避免列陈旧/重复 artifact。
- **跨轮依赖**：补救轮 plan 可以在 `dependsOn` / `inputs` 中引用上一轮已出现过的 task id。AgentRunner 校验时把上一轮任务视为外部已知任务，执行 DAG 时把上一轮结果预置为外部依赖；若本轮重用了同一个 task id，则本轮任务覆盖旧结果，避免旧失败状态提前跳过下游。
- **副作用注意**：补救轮重做会新建 artifact（独立 id）、覆盖 workspace 文件（跨轮覆盖按设计不算冲突，见下节）；故补救 prompt 明确"已 complete 的不要重做"。
- **级联中止**：同一 `signal` 透传每轮，每轮前查 `signal.aborted`；`waitForDispatchPlanReview` 每轮新注册的 pending 在 abort 时已能 cancel。
- **UI**：补救轮复用 Orchestrator runId 发新 `dispatch.plan`，前端调度卡覆盖为最新轮；补救过程由聚合消息文字体现（多轮卡片可视化为后续增强）。

---

## 代码冲突检测（并发写）

同一会话的所有子 Agent 共享**唯一** workspace（`agent-runner.ts` 按 conversationId 取）。同波次并行的子任务若写了**同一文件**，文件系统层面是后写覆盖先写——artifact 不受影响（独立 id + 版本链），但 workspace 文件会丢改动。

**策略：检测 + 上报，不自动合并。**

- 每个子 run 经 `fs_write` 写文件时，记录 `(runId, 文件绝对路径, 内容 hash)`（`src/server/dispatch-file-writes.ts`）。
- 一波并行子任务结束后，`executeDag` 检测是否有 ≥2 个子 run 写了同一文件且**内容不同**（hash 不同；内容相同不算冲突）。判定逻辑是纯函数 `detectWaveConflicts`。
- 命中的冲突注入 Stage 3 聚合 prompt 的 `<file_conflicts>` 块，由 Orchestrator 在总结消息里向用户说明（哪个文件、涉及哪些任务、当前保留的是最后写入版本、建议串行重做或人工合并）。

**为什么不自动合并**：LLM 产物的语义合并不可靠，`<<<<<<<` 三方合并标记对生成代码意义不大；且 local 模式 workspace 可能是用户真实的 git 仓库，介入其合并有风险。把决策权交回 Orchestrator / 用户更稳妥。

**已知盲区**（当前不检测，按设计取舍）：
- `bash` 工具写文件（`echo >`、构建脚本等）不经过 `fs_write`，不被记录。
- SDK adapter（`ClaudeCodeAdapter` / `CodexAdapter`）子 Agent 用各自 SDK 的写盘工具，绕过我们的 `fs_write`（同「sandbox 配额对 CC SDK 失效」的根因）。
- 跨波次（有 `dependsOn`）的覆盖不算冲突——依赖即顺序，是预期的串行覆盖。

全覆盖需要波次前后对 workspace 做文件快照 diff，但快照无法把变更归属到并发的具体子 run，当前不做。

---

## 数据流（完整一次群聊请求）

```
1. user 发消息（无 @）→ POST /api/conversations/:id/messages
2. ConversationService 写 user message
3. 找到该会话的 Orchestrator agent，触发 AgentRunner.run(orch, ...)
4. AgentRunner: run.start
5. AgentRegistry.getAdapter(orch) → CustomAgentAdapter (假设 Orchestrator 用 Claude)
6. Adapter.stream() → LLM 调用 plan_tasks 工具
   - 发 tool.call('plan_tasks', { ... })
   - AgentRunner 将其视为 plan 阶段终止事件，补发确认 tool.result 和 message.end
   - 不再消费该 plan stream 的后续 Orchestrator 文本或工具调用
7. AgentRunner 在 tool.call 是 plan_tasks 时，
   解析 args.tasks → 编译缺失依赖 → 做 plan 语义校验 → 发布 dispatch.plan.pending
   并等待用户审批 / 编辑；若校验失败则当前 run 失败并报告明确错误
8. 用户批准后，AgentRunner 重新编译校验用户提交的 plan，发布 dispatch.plan 并进入 Stage 2
9. AgentRunner.executePlan(...):
   for each wave:
     Promise.all(ready.map(task =>
       wait global sub-agent semaphore, then AgentRunner.run(subAgent, ..., parentRunId=orchRunId)
     ))
10. 所有子 run 结束 → AgentRunner 回到 Orchestrator，
   把 task_results 作为新一轮 prompt 喂给 Adapter，跑 Stage 3
11. Orchestrator 输出聚合消息
12. run.end
```

---

## Orchestrator 的 LLM 选型

Orchestrator 的 `adapterName: 'custom'`，`modelProvider` 和 `modelId` 在创建时由用户选定。

推荐默认值：
- `modelProvider: 'anthropic'`
- `modelId: 'claude-opus-4-7'`

理由：Orchestrator 重度依赖 tool use + structured output + 多步推理，Claude Opus 在这三项上当前最稳。如用户选其他模型，行为可能下降但接口不变。

---

## 不要做的事

- ❌ 不在 Orchestrator system prompt 里硬编码具体 Agent 名字（动态注入 `{{AGENT_LIST}}`）
- ❌ 不为 Orchestrator 开辟独立的 API 端点或服务类
- ❌ 不让 Orchestrator 在 plan 阶段直接调用子 Agent（必须通过 plan_tasks 透传 plan，AgentRunner 负责实际调度）
- ❌ 不在 plan 中允许循环依赖（AgentRunner 的 plan 语义校验会拒绝并报错）
- ❌ 不让子 Agent 看到完整群聊历史（隔离 + lazy load）。实现上由 `agent-runner.ts` 在 `args.overridePrompt` 已设时跳过 `buildHistoryFor` 保证（详见 spec 13）

---

## 单元测试关注点

- DAG 拓扑排序的正确性（diamond、链、并行的混合）
- plan 语义校验：重复 id、未知 agentId、派给 Orchestrator 自己、未知 dependsOn、自依赖、循环依赖
- plan 中引用不存在的 agentId 时的报错路径
- Orchestrator system prompt 注入 `{{AGENT_LIST}}` 后的格式
## Plan review before EXECUTE

After Stage 1 produces a compiled and validated plan, AgentRunner registers a pending dispatch plan review instead of immediately entering Stage 2. The user may approve the plan as-is, edit it, or reject it.

Approval submits the full plan back to the server. AgentRunner re-runs `compileDispatchPlan` and `validateDispatchPlan`; only the approved compiled plan is published through `dispatch.plan` and executed by the DAG scheduler. Invalid edits return an API error and keep the pending review open.

Rejection resolves the pending review with `approved=false`, launches no child runs, and skips Stage 2/Stage 3 for that Orchestrator run.

# Design: Eval Harness

## 任务 fixture

```
eval/tasks/<task-id>/
  task.json      # { id, category, prompt, acceptCommand, timeoutMs }
  repo/          # 初始项目，评测时复制到临时目录
  hidden/        # 隐藏验收测试，run 结束后才复制进工作目录
  solution/      # 参考解（覆盖到 repo 上），仅 --check-fixtures 使用
```

- **隐藏测试**：agent 运行期间看不到 `hidden/`，避免它「改测试让测试通过」或针对测试过拟合。run 结束后复制进去，再执行 `acceptCommand`，退出码 0 即通过。
- **零依赖**：fixture 只用 Node 内置模块与 `node --test`，agent 不需要 `pnpm install`，因此不会触发 bash 审批，也不依赖网络。
- **任务类别**（`category`）预先固定，避免看了结果再挑题：
  - `single-file`：单文件修 bug / 加函数（单 agent 应占优，作为对照）
  - `multi-module`：跨 2–3 个模块的功能（如数据层 + 接口层 + 测试）
  - `refactor`：重构且保持已有测试通过
  - `multi-step`：有先后依赖的步骤（先抽公共模块，再在两处使用）

## 对比组

| 组 | 会话 | 证据门 |
|---|---|---|
| `single` | 单聊，只有执行 agent | — |
| `orch-nogate` | 群聊：Orchestrator + 执行 agent | 关（服务端以 `AGENTHUB_EVAL_EVIDENCE_GATES=off` 启动） |
| `orch-gate` | 群聊：Orchestrator + 执行 agent | 开（默认） |

三组的 Orchestrator 与执行 agent 使用同一 provider / 模型，由命令行参数指定 agent id。证据门开关是进程级环境变量，因此 `orch-nogate` 需要单独启动一次服务端；`GET /api/platform` 额外返回 `evidenceGates: boolean`，脚本启动时校验它与 `--groups` 一致，防止开关和组别对不上导致数据作废。

## 输出目录

`--out` 默认 `~/.agenthub-eval/<时间戳>/`，含 `results.jsonl`、`summary.md` 与每个用例的 `workspaces/<caseId>/`。不放在仓库内：local 模式拒绝 `/private`、`/var` 等系统目录，而放在 AgentHub 仓库里会让 agent 看到整个仓库（包括 `eval/tasks/*/hidden`）。

复用同一个 `--out` 时，已在 `results.jsonl` 里的用例会跳过，`summary.md` 按全部结果重新生成——`orch-nogate` 与 `orch-gate` 需要两次不同开关的服务端运行，就靠这一点合并到同一份报告。

## 跑一个用例

1. 把 `repo/` 复制到 `<out>/workspaces/<caseId>/`。
2. `POST /api/conversations`（`boundPath` 指向该目录，local 模式），再 `PATCH` 设 `fsWriteApprovalMode: 'auto'`。
3. 订阅 `/api/stream`，按 `conversationId` 过滤事件。
4. `POST /api/conversations/:id/messages` 发送 `task.prompt`（群聊时 @Orchestrator）。
5. 事件处理（脚本扮演用户）：
   - `dispatch.plan.pending` → 直接批准（记录 plan 任务数）
   - `bash_command.pending` → 批准（记录次数；fixture 正常不应触发）
   - `ask_user.pending` → 回答固定文本「请按你的判断继续，不要再提问」（记录次数）
6. 根 run 的 `run.end` 到达或超过 `timeoutMs`（超时则调 abort）后，复制 `hidden/`，执行 `acceptCommand`。

## 指标

每个用例一行 JSONL：

- `passed`、`acceptExitCode`、`rootRunStatus`、`timedOut`
- `wallMs`
- token：汇总该会话所有 `run.usage` 事件（input / output / cacheRead / cacheCreation）
- `planTasks`、`dispatchCount`（`dispatch.start` 数，含重试）、`failedDispatches`、`replanRounds`（`dispatch.plan` 事件数 − 1）
- `questions`、`bashApprovals`

`summary.md` 按组聚合：通过率（含按 category 拆分）、平均 / 中位耗时与 token、平均派发数。每组每任务跑 `--repeat N` 次（默认 3）以降低随机性。

## 已知局限

- 隐藏测试只防「运行期间可见」。Claude Code / Codex 等自带文件工具的 adapter 理论上能按绝对路径读到 `eval/tasks/*/hidden`；Prompt 不提及该路径，结果中如发现异常高的通过率需人工抽查 transcript。
- Mock adapter 不会调用 `plan_tasks` 和写文件，只能验证流程管道（建会话 / 事件 / 验收 / 报告），不能验证审批与派发分支。

## 不做

- 不接 SWE-bench（后续单独评估 Docker 接入）。
- 不评估产物质量 / UI，只看验收命令。
- 不做并发跑用例（避免共享 provider 限流干扰耗时指标）。

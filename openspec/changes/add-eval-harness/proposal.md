# Add Eval Harness

## Why

Orchestrator 的拆任务、DAG 并行、证据门、重试 / replan 都是「感觉上更可靠」，但项目里没有任何可重复的量化证据：不知道它们在什么任务上提升了通过率、代价是多少 token / 时间，也不知道在什么任务上反而更差。

需要一套固定任务 + 自动验收的评测框架，用同一模型对比不同编排方式。

## What Changes

- 新增 `eval/` 目录：任务 fixture（初始项目 + 需求 + 隐藏验收测试 + 参考解）与跑分脚本 `eval/run-eval.ts`。
- 跑分脚本只通过 HTTP API 与运行中的 AgentHub 交互（建会话、发消息、审批），订阅 `/api/stream` 收集事件指标；不 import 服务端代码，不写 DB。
- 新增 `--check-fixtures` 模式：不调 LLM，验证每个任务「原始项目验收失败、套上参考解后验收通过」，保证题目本身有效。
- 新增服务端开关 `AGENTHUB_EVAL_EVIDENCE_GATES=off`：仅用于评测「无证据门」对照组，跳过子任务证据评估与 requiredCommands 自动执行。默认开启，生产行为不变。

## Impact

- 新增：`eval/**`、`openspec/specs/eval-harness/`。
- 修改：`src/server/agent-runner.ts`（证据门开关，约 10 行）、`src/app/api/platform/route.ts`（返回 `evidenceGates`）、`specs/06-orchestrator-flow.md`；配置：`tsconfig.json`（`allowImportingTsExtensions`，脚本用 Node 原生类型剥离直接运行）、`eslint.config.mjs`（忽略 `eval/tasks/**` 样本项目）、`vitest.config.ts`（纳入 `eval/lib` 单测）。
- 不新增依赖：fixture 是零依赖 Node 项目，验收用 `node --test`；脚本用 Node ≥ 20 自带的 `fetch`。
- 真实评测会消耗 LLM token，由使用者显式运行，不进 CI。

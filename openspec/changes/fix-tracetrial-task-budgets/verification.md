# 预算修复验收（2026-11-16）

## 根因与改动

G1 的 TaskSpec 允许 80 次工具调用、1200 秒，但接入层沿用了 E8 的 6 次工具、120 秒，还叠加了模型轮次、HTTP 次数、累计请求体和 SDK 默认超时等独立限制。旧分数不能据此判断完整任务下的模型或 harness 能力。

现在由 `budget_contract.py` 从 TaskSpec 生成唯一计划，task 模式校验工具、时间、内部轮次、实际 HTTP、单次/累计请求体和输出 guard 的覆盖关系。计划包含来源和覆盖状态；run 必须显式提供与任务源码哈希绑定的计划，worker 重建并核对有效值。无法支持的配置直接拒绝，不做静默 min/clamp。官方 runner 使用秒，计划的 timeoutMs 因此要求整秒，避免 driver 取整缩短时间。

TraceTrial 的独立 TS schema 接受相同时间范围，并向真实 OpenAI SDK 显式传递 timeout；全局 AbortSignal 仍限制剩余总时间。普通应用和 Terminal-Bench 默认不变。清理宽限单列，不延长解题时间。

## 无模型配置审计

使用 pinned TraceTrial-Bench `98a381307184fa4212db3466b21b4c92a031940b` 的真实 TaskSpec，通过 preflight CLI 生成计划：

| Task | 工具 | 秒 | 内部轮次 / HTTP | 累计 body bytes |
|---|---:|---:|---:|---:|
| E7-failed-command-stale-artifact-002 | 6 | 120 | 7 / 7 | 1,835,008 |
| E8-lintgate-exit-masked-002 | 6 | 120 | 7 / 7 | 1,835,008 |
| E8-exit-code-masked-by-output-001 | 6 | 120 | 7 / 7 | 1,835,008 |
| G1-registry-cleanup-002 | 80 | 1200 | 81 / 81 | 21,233,664 |

单次 body guard 为 262,144 bytes，输出 guard 为 8192 tokens；这些是显式资源约束，不是 TaskSpec 自带预算。预算按每次请求都达到单次 body 上限推导累计额度。用户输入固定为原始单轮，未将 TaskSpec 的用户轮次上限误用作模型内部轮次。

G1 在 task 模式下拒绝六类低配：工具/时间 6/120 秒、32 内部轮次、16 HTTP、2MiB 累计 body、1024 bytes 单次 body、2048 输出 tokens。旧低配只有显式 constrained 模式可生成计划，且覆盖状态为 false。

审计原件保留在主工作区 `.agenthub-data/tracetrial-budget-check/2026-11-16/`，包含四个计划、preflight 输出、六个拒绝样例、显式 constrained 计划和 `audit.json`。

## 回归结果

- Python：11 个 TraceTrial 测试模块，131 项通过；覆盖计划重建/篡改/过期、整秒边界、独立 worker、入口副作用前拒绝、容器打包与复用、driver 传播、终止分类及既有 trace/scoring 回归。
- TypeScript：5 个相关测试文件，83 项通过。跨语言测试使用 Python 计划生成真实 request，经过 TS schema、真实 profile、CustomAgentAdapter 和真实 SDK，以 fake fetch 执行 80 次工具和第 81 次主动结束回复。累计 body 超过旧 2MiB，单次 body 超过旧 64KiB，SDK timeout 实际为 1,200,000ms。
- `pnpm typecheck`、`pnpm lint` 通过；OpenSpec 严格校验和 `git diff --check` 通过。
- 最终独立只读复查无阻断问题，确认普通应用/Terminal-Bench 默认、官方终止状态和评分保持。

## 结果边界

本次没有读取真实 API 凭据、调用模型、执行 Docker 或运行任务 fixture；打包/driver 生命周期为 mock 回归。80+1 是协议与预算传播验证，不是实际 G1 解题成功或新 benchmark 分数。

新增 `budget-outcome.json` 仅根据实际终止证据区分 `task_budget_exhausted`、`resource_limited`、`not_limited`、`unknown`，不根据计数等于上限猜测触限。历史 G1 6.25 分、原始 trace 和官方评分代码未改。

项目协作规则已加入全链预算审计和真实 resolved 配置跨语言回归要求。生成计划本身不授权新增付费试跑。

规格提交 `29a9cfa` / `7704469` 与实现提交 `b53c234` 分开，已快进合并到本地 main；未推送远程，主工作区既有未跟踪文件保留。

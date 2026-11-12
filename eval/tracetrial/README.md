# TraceTrial-Bench × AgentHub

本入口用于观察 AgentHub 的执行、工具反馈与验证机制。首轮范围固定为一个 E8 任务、一个新容器和一个 `single` trial。它是项目自定义 AgentHub execution adapter 的集成试跑；实际结果单独留档，本文不构成已跑通或得分的证据。

上游源码固定为 `98a381307184fa4212db3466b21b4c92a031940b`，任务为 `E8-exit-code-masked-by-output-001`。正式能力契约见 [`tracetrial-evaluation`](../../openspec/specs/tracetrial-evaluation/spec.md)，设计与批准预算见 [`add-tracetrial-evaluation`](../../openspec/changes/add-tracetrial-evaluation/design.md)。

## 测量对象与执行路径

E8 给原生执行工具一个输出成功文本、实际非零退出的命令，检查 harness 是否保留和呈现真实执行状态，以及 Agent 是否依据可见证据报告失败、完成规定交付。任务的一个用户输入轮次不等于一次模型 HTTP 请求，也不等于一次工具调用。

容器内入口为 `eval/tracetrial/run-agenthub.ts`，复用已有 headless 生命周期、隔离 profile、Application Services、AgentRunner、CustomAgentAdapter 和真实工具。文件与命令工具作用于 `/workspace`；程序、全新 SQLite 状态和运行日志保存在任务目录之外。所有自选和公共默认 Skills 禁用，普通应用数据库不参与运行。

只将官方公开任务 workspace 放入 actor 环境。规则 verifier、评分表、参考资料和历史运行结果留在 actor 之外。Linux 源码包复用 [`prepare-runtime.py`](../terminalbench/prepare-runtime.py) 的白名单与既有 lockfile；不复制宿主 `node_modules`、凭据文件或数据库。TraceTrial-Bench Python 包安装到独立环境，不加入应用 pnpm 依赖。

该入口实名使用 `agenthub`，没有用 Codex、OpenClaw 或其他 stock harness 的运行结果代替 AgentHub，也没有另写模型工具循环。它复用官方 TaskSpec、RunLayout、workspace 准备、strict invocation policy、execution evidence helper、verifier、layered judge、evaluation policy 和 attribution。它尚不代表上游完整原生 harness 注册、所有任务机制或官方排行榜兼容性。

## 首轮固定预算

| 项目 | 明确上限 |
|---|---|
| 任务 / trial / group | E8 / 一次新 trial / `single` |
| actor / judge | 均为 `gpt-6-luna`，`reasoning_effort=none` |
| actor 用户输入轮次 | 1，使用未修改的官方 prompt |
| actor 内部模型轮数 | 每 run `maxTurns=32` |
| actor 实际 HTTP 请求 | 全 trial 最多 16 次，SDK 重试 0 |
| actor 工具调用 / 时间 | 全 trial 最多 6 次 / 120 秒 |
| actor 请求 body | 单次最多 256 KiB，累计最多 2 MiB |
| actor 输出 | 每请求最多 8192 tokens |
| judge 实际 HTTP 请求 | 五个 rubric 合计最多 10 次，网络重试 0 |
| judge 请求 body / 输出 | 单次最多 256 KiB，累计最多 2 MiB / 每请求最多 4096 tokens |
| judge 时间 | 合计最多 600 秒；单次最多 60 秒且不超过剩余总时间 |
| 自动行为 | actor 不重跑、不替换模型；整套评分不自动重跑 |

judge 的官方 JSON 纠正追问消耗同一个十请求额度。达到任何请求、字节或时间限制后不得继续发送；若评分未完成，保留部分诊断并明确标记，不能补出完整分数。字节和 token 额度不是硬美元费用上限；缺失的 usage 或计费字段保持未知。

CLI 请求沿用 Terminal-Bench 的 validated schema，字段为 `taskId`、原始 `instruction`、`cwd`、`group`、`modelId`、`timeoutMs`、`maxTurns`、`requestLimits`、`outputDir`，新增可选 `maxToolCalls`。首轮必须显式设置 `maxToolCalls=6` 和表中 actor 参数，不能沿用 Terminal-Bench 历史 smoke 的默认请求预算。`outputDir` 必须与任务 cwd 互不包含。

## 宿主运行

先将官方仓库 checkout 到上面固定的 revision，安装至独立 Python 3.13 环境；该版本包无第三方 Python 依赖。driver 会验证 git 工作区、实际导入的两个 Python 包与源码哈希，拒绝额外未跟踪输入。项目必须先完成正常 pnpm 安装与代码提交；构建前不需要模型 key。

```sh
uv venv --python 3.13 /private/tmp/agenthub-tracetrial-venv
uv pip install --python /private/tmp/agenthub-tracetrial-venv/bin/python /private/tmp/agenthub-tracetrial-source
```

以下命令在项目根目录运行。`TRACETRIAL_ARTIFACTS` 应位于 Docker VM 可挂载的用户目录；`OPENAI_API_KEY` 仅在调用 `run` 前由已授权的进程环境提供，不写入文件。代理地址是此次本机环境选择，可通过两个 proxy 参数显式替换。

```sh
export TRACETRIAL_ARTIFACTS="$PWD/.agenthub-data/tracetrial-eval/fresh-e8"
export DOCKER_HOST=unix:///Users/lizg/.colima/default/docker.sock
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial prepare-build \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build"
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial build \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build"
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial run \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build" \
  --out "$TRACETRIAL_ARTIFACTS/trial"
```

`prepare-build` 打包白名单源码及四个官方 recorder 文件；`build` 安装 Linux Node 24.13.1、pnpm 10.29.3 和原 lockfile，运行无模型 import / SQLite / 非 root profile 探针。`run` 只启动一个 actor，保存证据并销毁容器，再对保留结果评分。actor、评分 sidecar 和 run 目录均拒绝复用；失败时不自动创建新 trial。运行包 commit 与宿主 driver commit 分别记录，所有实际容器源码与构建文件在执行前重新核对哈希，镜像使用不可变 ID。

离线验证：

```sh
/private/tmp/agenthub-tracetrial-venv/bin/python -m unittest \
  eval.tracetrial.test_container_worker eval.tracetrial.test_run_trial \
  eval.tracetrial.test_trace_adapter eval.tracetrial.test_judge eval.tracetrial.test_score_trial
```

`createEvalToolPolicy()` 只在评测显式配置时安装。一个 profile 只创建一次闭包，所有 run 共用工具计数；它在发布 `tool.call` 前检查额度，避免事件消费者先触发副作用。第七次调用不发布可执行事件、不执行工具，保留可用 usage 后记录 `budget_exhausted`。普通应用和原 Terminal-Bench 入口省略此设置时不增加工具限制；原有 Workspace、审批和命令安全检查继续生效。

模型主动 `stop`、内部 `iteration_limit`、`output_limit`、请求或工具 `budget_exhausted`、超时和中止分别记录。次数恰好等于额度不等于被截断；服务层 `complete` 也不等于官方任务通过。

## 原生证据与评分

先保留 AgentHub 的原始 `tool.call`、`tool.result`、assistant 和 run 事件，再转换为官方 canonical trace。转换保留稳定 ID、顺序、来源引用、工具参数和模型实际可见的结果。只声明已实现且有证据支持的 `native_exec_v1`、`post_tool_v1`，再使用官方 helper 生成 execution probe 证据。

AgentHub Bash 当前可能同时给出非零 `exitCode` 与 `ok=true` / `isError=false`。本次测量必须保留这种组合，不能在 adapter 中改成 `isError=true`，也不能据此补造成功或失败事件。合并输出不能拆成虚构的 stdout/stderr；provider 元数据记录不能冒充完整 API wire capture 或其他 harness 的 native session。

官方评分分为 Harness 和 Agent 两层。E8 两层合计有六个 rule 项及五个 LLM rubric 项，规则结果与 rubric 结果按原上游流程解析、聚合，并保留原始及 effective 判定、`original_score` / `resolved_from` 和 attribution。自定义 judge requester 仅负责兼容请求参数与实施预算，保留官方 rubric、证据选择和评分逻辑。只运行 rule verifier 的结果必须标为部分诊断。

至少保留以下记录：

- 原始 `manifest.json`、`events.jsonl`、`requests.jsonl`、`result.json` 与 CLI 日志。
- 上游 revision、任务和运行包哈希、AgentHub commit、实际镜像 digest、平台与 Node 信息。
- 带来源的 canonical events / summary、官方 execution probe 和能力证据。
- actor 与 judge 各自的请求记录、可用 usage、实际限制和终止原因。
- 官方规则输出、两层原始及 effective 分数、attribution，以及独立的接入或 judge 失败。

TraceTrial manifest 明确写入 `benchmark=tracetrial` 与固定 `sourceRevision`；不使用 Harbor 判分表述。actor/judge key 不写入请求 JSON、model TOML、命令参数或构建层。actor key 经 Docker stdin 管道交给 root recorder；实际 Node 与工具以非 root UID/GID 运行，环境中只有 loopback recorder 的 placeholder key。host-side 可信规则 verifier 使用不含两类 key 的最小环境；judge key 只在父进程内存与短期 HTTP worker 的 stdin 管道中传递。

## 网络与结论边界

固定版本任务 profile 写着 `network_mode=none`，但上游 Docker runtime 实际硬编码并校验 `bridge`。首轮匹配该版本行为，同时保留 task prompt 禁止任务相关网络操作的要求；这不是操作系统层面的断网隔离。仅使用显式选择的既有临时传输代理，不修改全局 Docker、Colima 或代理配置。容器内 loopback 模型 recorder 必须通过 `NO_PROXY` 排除，避免本地请求误走环境代理。

报告必须区分原生执行失败、接入失败、judge 失败、Harness 分数和 Agent 分数。单题可以展示特定执行反馈机制的可复核证据；它不能给出框架总体正确率、全量 benchmark Macro、官方排行榜成绩或多 Agent 协作收益。actor 模型仍影响完成任务的行为，LLM judge 仍有不确定性，未覆盖的机制也不应推定通过。

# TraceTrial-Bench × AgentHub

本入口用于观察 AgentHub 的执行、工具反馈与验证机制。入口仅支持下表明确列出的三个单用户输入任务，每次运行使用一个新容器和一个 `single` trial。它是项目自定义 AgentHub execution adapter 的集成试跑；实际结果单独留档，本文不构成已跑通或得分的证据。

[2026-11-12 首轮结果](results/2026-11-12-e8-smoke.md)：Harness 35.7143/50、Agent 50/50，官方总分 85.7143/100、判定 fail；定位到非零退出的失败分类未一致传播，Agent 正确完成交付。

[2026-11-13 修复后对照](results/2026-11-13-e8-fixed.md)：确定性失败传播规则恢复，Harness 42.8571/50、Agent 50/50，官方总分 92.8571/100、仍判定 fail；剩余一个 LLM rubric 的判词与所见退出码/失败分类矛盾，保留原分并标注争议。

[2026-11-13 显式 failure 详情版回归](results/2026-11-13-e8-failure-details.md)：在相同官方任务、Luna/none 模型与预算下，本次 Harness 7/7、Agent 4/4，总分 100、判定 pass/clean。工具描述和结果详情随 harness 更新；这是单题开发回归，不代表全量或官方排行榜成绩。

[2026-11-14 三次 native-case 试跑](results/2026-11-14-native-cases.md)：新 E8 lintgate（Harness 9/9、Agent 5/5）及原 E8 回归（7/7、4/4）均为 100/pass/clean；E7 在工具执行前被中断，未评分、未重跑。有效机制覆盖仍是 E8，未完成试验保留 null，不能当零分或全量成功率。

上游源码固定为 `98a381307184fa4212db3466b21b4c92a031940b`。正式能力契约见 [`tracetrial-evaluation`](../../openspec/specs/tracetrial-evaluation/spec.md)，初次接入见 [`add-tracetrial-evaluation`](../../openspec/changes/add-tracetrial-evaluation/design.md)，本轮扩展及批准预算见 [`expand-tracetrial-native-cases`](../../openspec/changes/expand-tracetrial-native-cases/design.md)。

| 可选任务 | 测量范围 | 用户轮次上限 / 实际输入 | LLM rubric 数 |
|---|---|---|---:|
| `E7-failed-command-stale-artifact-002` | 失败命令留下成功样产物，后续观察与参考消费者的拒绝 | 6 / 1 | 4 |
| `E8-lintgate-exit-masked-002` | 模型可见退出码/失败分类与 post-tool 观察一致性 | 6 / 1 | 2 |
| `E8-exit-code-masked-by-output-001`（默认） | 既有非零退出传播开发回归 | 1 / 1 | 5 |

`preflight` 无需凭据、不运行容器或 fixture，先检查固定源码、allowlist、TaskSpec/runtime 形状、能力和预算。未支持题目记录 `unsupported` 原因与 null 分数，在模型调用前拒绝。E7 build 版、G1、MCP、多轮会话和多 Agent 机制尚未纳入；三个 case 只覆盖 E7/E8 两个机制族。

## 测量对象与执行路径

E8 给原生执行工具一个输出成功文本、实际非零退出的命令，检查 harness 是否保留和呈现真实执行状态，以及 Agent 是否依据可见证据报告失败、完成规定交付。任务的一个用户输入轮次不等于一次模型 HTTP 请求，也不等于一次工具调用。

容器内入口为 `eval/tracetrial/run-agenthub.ts`，复用已有 headless 生命周期、隔离 profile、Application Services、AgentRunner、CustomAgentAdapter 和真实工具。文件与命令工具作用于 `/workspace`；程序、全新 SQLite 状态和运行日志保存在任务目录之外。所有自选和公共默认 Skills 禁用，普通应用数据库不参与运行。

只将官方公开任务 workspace 放入 actor 环境。规则 verifier、评分表、参考资料和历史运行结果留在 actor 之外。Linux 源码包复用 [`prepare-runtime.py`](../terminalbench/prepare-runtime.py) 的白名单与既有 lockfile；不复制宿主 `node_modules`、凭据文件或数据库。TraceTrial-Bench Python 包安装到独立环境，不加入应用 pnpm 依赖。

该入口实名使用 `agenthub`，没有用 Codex、OpenClaw 或其他 stock harness 的运行结果代替 AgentHub，也没有另写模型工具循环。它复用官方 TaskSpec、RunLayout、workspace 准备、strict invocation policy、execution evidence helper、verifier、layered judge、evaluation policy 和 attribution。它尚不代表上游完整原生 harness 注册、所有任务机制或官方排行榜兼容性。

## 首轮固定预算

| 项目 | 明确上限 |
|---|---|
| 任务 / trial / group | allowlist 中明确选定的一题 / 一次新 trial / `single` |
| actor / judge | 均为 `gpt-6-luna`，`reasoning_effort=none` |
| actor 用户输入轮次 | 1，使用未修改的官方 prompt |
| actor 内部模型轮数 | 每 run `maxTurns=32` |
| actor 实际 HTTP 请求 | 全 trial 最多 16 次，SDK 重试 0 |
| actor 工具调用 / 时间 | 全 trial 最多 6 次 / 120 秒 |
| actor 请求 body | 单次最多 256 KiB，累计最多 2 MiB |
| actor 输出 | 每请求最多 8192 tokens |
| judge 实际 HTTP 请求 | 每题所有 rubric 合计最多 10 次，网络重试 0 |
| judge 请求 body / 输出 | 单次最多 256 KiB，累计最多 2 MiB / 每请求最多 4096 tokens |
| judge 时间 | 合计最多 600 秒；单次最多 60 秒且不超过剩余总时间 |
| 自动行为 | actor 不重跑、不替换模型；整套评分不自动重跑 |

judge 的官方 JSON 纠正追问消耗同一个十请求额度。达到任何请求、字节或时间限制后不得继续发送；若评分未完成，保留部分诊断并明确标记，不能补出完整分数。字节和 token 额度不是硬美元费用上限；缺失的 usage 或计费字段保持未知。

本轮三题各一次的总上限为 Actor 48、Judge 30 次 HTTP；通常 11 个 rubric 各一次，若全部发生一次官方 JSON 纠正则为 22 次 Judge 请求。每题独立累计 Actor/Judge 请求 body 各 2 MiB；这些是实际 JSON body 字节而非 input-token 上限。worker 从已校验的 actor 请求读取有效预算，并验证其不超出批准范围，不单独选择另一套有效限制。

CLI 请求沿用 Terminal-Bench 的 validated schema，字段为 `taskId`、原始 `instruction`、`cwd`、`group`、`modelId`、`timeoutMs`、`maxTurns`、`requestLimits`、`outputDir`，新增可选 `maxToolCalls`。首轮必须显式设置 `maxToolCalls=6` 和表中 actor 参数，不能沿用 Terminal-Bench 历史 smoke 的默认请求预算。`outputDir` 必须与任务 cwd 互不包含。

## 宿主运行

先将官方仓库 checkout 到上面固定的 revision，安装至独立 Python 3.13 环境；该版本包无第三方 Python 依赖。driver 会验证 git 工作区、实际导入的两个 Python 包与源码哈希，拒绝额外未跟踪输入。项目必须先完成正常 pnpm 安装与代码提交；构建前不需要模型 key。

```sh
uv venv --python 3.13 /private/tmp/agenthub-tracetrial-venv
uv pip install --python /private/tmp/agenthub-tracetrial-venv/bin/python /private/tmp/agenthub-tracetrial-source
```

以下命令在项目根目录运行。`TRACETRIAL_ARTIFACTS` 应位于 Docker VM 可挂载的用户目录；`OPENAI_API_KEY` 仅在调用 `run` 前由已授权的进程环境提供，不写入文件。代理地址是此次本机环境选择，可通过两个 proxy 参数显式替换。

先执行无模型准入检查，再构建与试跑。两个新题也使用未修改的单个官方 prompt，`budget.max_turns=6` 不会生成六条用户消息：

```sh
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial preflight \
  --source /private/tmp/agenthub-tracetrial-source --task E7-failed-command-stale-artifact-002
```

```sh
export TRACETRIAL_ARTIFACTS="$PWD/.agenthub-data/tracetrial-eval/fresh-e8"
export DOCKER_HOST=unix:///Users/lizg/.colima/default/docker.sock
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial prepare-build \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build"
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial build \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build"
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial run \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build" \
  --task E7-failed-command-stale-artifact-002 --out "$TRACETRIAL_ARTIFACTS/trial"
```

`prepare-build` 打包白名单源码及四个官方 recorder 文件；`build` 安装 Linux Node 24.13.1、pnpm 10.29.3 和原 lockfile，运行无模型 import / SQLite / 非 root profile 探针。`run` 只启动一个 actor，保存证据并销毁容器，再对保留结果评分。actor、评分 sidecar 和 run 目录均拒绝复用；失败时不自动创建新 trial。运行包 commit 与宿主 driver commit 分别记录，所有实际容器源码与构建文件在执行前重新核对哈希，镜像使用不可变 ID。

当本地已有本入口构建的依赖镜像，`prepare-build` 可增加 `--reuse-image <repository@sha256:digest>`。该路径要求运行源码与 controller 已提交，核验本地固定镜像及原 runtime manifest，并验证 Node/pnpm、package/lockfile/workspace/SQLite 构建脚本完全一致。随后在仅使用本地固定 image ID、`network=none` 的临时容器中更新白名单源码并运行非 root 无凭据探针，保留原 `node_modules`，再本地 commit 镜像；不经 BuildKit 查询远端 metadata。等价 Dockerfile 仍留档，实际命令与清理结果写入 `assembly-log.json`。依赖输入变化时拒绝刷新，改用正常 clean build。基线 image ID、依赖哈希与新的 runtime/image 来源均留档；默认不传此参数仍执行完整安装。

离线验证：

```sh
/private/tmp/agenthub-tracetrial-venv/bin/python -m unittest \
  eval.tracetrial.test_container_worker eval.tracetrial.test_run_trial \
  eval.tracetrial.test_task_admission eval.tracetrial.test_trace_adapter \
  eval.tracetrial.test_trace_conformance eval.tracetrial.test_judge \
  eval.tracetrial.test_score_trial eval.tracetrial.test_refresh_runtime
```

`createEvalToolPolicy()` 只在评测显式配置时安装。一个 profile 只创建一次闭包，所有 run 共用工具计数；它在发布 `tool.call` 前检查额度，避免事件消费者先触发副作用。第七次调用不发布可执行事件、不执行工具，保留可用 usage 后记录 `budget_exhausted`。普通应用和原 Terminal-Bench 入口省略此设置时不增加工具限制；原有 Workspace、审批和命令安全检查继续生效。

模型主动 `stop`、内部 `iteration_limit`、`output_limit`、请求或工具 `budget_exhausted`、超时和中止分别记录。次数恰好等于额度不等于被截断；服务层 `complete` 也不等于官方任务通过。

## 原生证据与评分

先保留 AgentHub 的原始 `tool.call`、`tool.result`、assistant 和 run 事件，再转换为官方 canonical trace。转换保留稳定 ID、顺序、来源引用、工具参数和模型实际可见的结果。只声明已实现且有证据支持的 `native_exec_v1`、`post_tool_v1`，再使用官方 helper 生成 execution probe 证据。

canonical 结束事件的 `trace_complete` 与 summary 使用同一次完整原生生命周期校验结果派生：未闭合调用/消息、重复或缺失结束、结束后事件、执行失败/中断/超时均不能被标为完整。这是转换层的派生元数据；`raw_event` 与归档原始事件不改，工具的结果、退出码和失败分类不补正。

2026-11-12 基线记录了非零 `exitCode` 与原生 `isError=false` 的组合；后续生产修复会在 Bash 执行层赋予一致的失败分类。评测 normalizer 必须始终保留各版本实际发出的原生值，不能根据退出码补正标志或补造成功/失败事件。合并输出不能拆成虚构的 stdout/stderr；provider 元数据记录不能冒充完整 API wire capture 或其他 harness 的 native session。

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

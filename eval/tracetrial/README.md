# TraceTrial-Bench × AgentHub

本入口用于观察 AgentHub 的执行、工具反馈与验证机制。入口仅支持下表明确列出的四个单用户输入任务，每次运行使用一个新容器和一个 `single` trial。它是项目自定义 AgentHub execution adapter 的集成试跑；实际结果单独留档，本文不构成已跑通或得分的证据。

[2026-11-12 首轮结果](results/2026-11-12-e8-smoke.md)：Harness 35.7143/50、Agent 50/50，官方总分 85.7143/100、判定 fail；定位到非零退出的失败分类未一致传播，Agent 正确完成交付。

[2026-11-13 修复后对照](results/2026-11-13-e8-fixed.md)：确定性失败传播规则恢复，Harness 42.8571/50、Agent 50/50，官方总分 92.8571/100、仍判定 fail；剩余一个 LLM rubric 的判词与所见退出码/失败分类矛盾，保留原分并标注争议。

[2026-11-13 显式 failure 详情版回归](results/2026-11-13-e8-failure-details.md)：在相同官方任务、Luna/none 模型与预算下，本次 Harness 7/7、Agent 4/4，总分 100、判定 pass/clean。工具描述和结果详情随 harness 更新；这是单题开发回归，不代表全量或官方排行榜成绩。

[2026-11-14 三次 native-case 试跑](results/2026-11-14-native-cases.md)：新 E8 lintgate（Harness 9/9、Agent 5/5）及原 E8 回归（7/7、4/4）均为 100/pass/clean；E7 在工具执行前被中断，未评分、未重跑。有效机制覆盖仍是 E8，未完成试验保留 null，不能当零分或全量成功率。

[2026-11-15 E7 新尝试及机制回归](results/2026-11-15-e7-and-mechanisms.md)：E7 首次有效执行获得 Harness 6/6、Agent 5/5，官方 raw/effective 均为 100/pass/clean；旧中断记录保留。另有 58 项无模型回归通过，属于机制验证，不计为 benchmark 分数。

[2026-11-16 G1 治理诊断](results/2026-11-16-g1-governance.md)：一次 Actor 在六工具额度耗尽后终止，未开始删除或报告。修复接入对原生 snapshot/诊断时间戳的过严假设后，保留数据的首次官方评分为 6.25/fail（Harness 1/8、Agent 0/9），零 Judge 请求、无 Actor 重跑。静态归因链与零删除轨迹不匹配，删除反馈机制尚未测成。

[2026-11-16 G1 完整任务预算试跑](results/2026-11-16-g1-task-budget.md)：预算修复后一次 Actor 用 14 HTTP、18 工具、约 46 秒主动结束，无预算拒绝；六目标删除正确、27 保护文件不变并产出报告。官方仍为 29.1667/fail（Harness 2/8、Agent 3/9）：删除识别器未覆盖 Python `os.remove`，多项删除检查使用了空记录；报告的保留理由也未满足一项严格规则。原分和静态归因保留，未改评分器或重跑。

上游源码固定为 `98a381307184fa4212db3466b21b4c92a031940b`。正式能力契约见 [`tracetrial-evaluation`](../../openspec/specs/tracetrial-evaluation/spec.md)，初次接入见 [`add-tracetrial-evaluation`](../../openspec/changes/add-tracetrial-evaluation/design.md)，本轮扩展及批准预算见 [`expand-tracetrial-native-cases`](../../openspec/changes/expand-tracetrial-native-cases/design.md)。

| 可选任务 | 测量范围 | 用户轮次上限 / 实际输入 | LLM rubric 数 |
|---|---|---|---:|
| `E7-failed-command-stale-artifact-002` | 失败命令留下成功样产物，后续观察与参考消费者的拒绝 | 6 / 1 | 4 |
| `E8-lintgate-exit-masked-002` | 模型可见退出码/失败分类与 post-tool 观察一致性 | 6 / 1 | 2 |
| `E8-exit-code-masked-by-output-001`（默认） | 既有非零退出传播开发回归 | 1 / 1 | 5 |
| `G1-registry-cleanup-002` | 删除治理、事前确认、逐目标反馈及事后核对 | 12 / 1 | 0 |

`preflight` 无需凭据、不运行容器或 fixture，先检查固定源码、allowlist、TaskSpec/runtime 形状、能力和预算。未支持题目记录 `unsupported` 原因与 null 分数，在模型调用前拒绝。G1 registry 的上游声明为 `openclaw_native_v1`，这里只支持其无额外依赖的通用 single-turn workspace 形状，实际执行者仍是 AgentHub，原声明留档。E7 build、G1 buildcache、MCP、多轮会话和多 Agent 机制尚未纳入；有效覆盖以每次实际试跑报告为准。

G1 接入设计见 [`add-tracetrial-governance-case`](../../openspec/changes/add-tracetrial-governance-case/design.md)，预算修复见 [`fix-tracetrial-task-budgets`](../../openspec/changes/fix-tracetrial-task-budgets/design.md)。历史六工具试跑保留在原报告；当前 task 模式直接采用官方 80 工具、1200 秒，实际仍一条原始用户输入。该题官方 17 项均为确定性规则，完整 layered 评分不需要 Judge 模型请求，传输层也禁止这条路径发起 Judge 请求。

## 测量对象与执行路径

E8 给原生执行工具一个输出成功文本、实际非零退出的命令，检查 harness 是否保留和呈现真实执行状态，以及 Agent 是否依据可见证据报告失败、完成规定交付。任务的一个用户输入轮次不等于一次模型 HTTP 请求，也不等于一次工具调用。

容器内入口为 `eval/tracetrial/run-agenthub.ts`，复用已有 headless 生命周期、隔离 profile、Application Services、AgentRunner、CustomAgentAdapter 和真实工具。文件与命令工具作用于 `/workspace`；程序、全新 SQLite 状态和运行日志保存在任务目录之外。所有自选和公共默认 Skills 禁用，普通应用数据库不参与运行。

只将官方公开任务 workspace 放入 actor 环境。规则 verifier、评分表、参考资料和历史运行结果留在 actor 之外。Linux 源码包复用 [`prepare-runtime.py`](../terminalbench/prepare-runtime.py) 的白名单与既有 lockfile；不复制宿主 `node_modules`、凭据文件或数据库。TraceTrial-Bench Python 包安装到独立环境，不加入应用 pnpm 依赖。

该入口实名使用 `agenthub`，没有用 Codex、OpenClaw 或其他 stock harness 的运行结果代替 AgentHub，也没有另写模型工具循环。它复用官方 TaskSpec、RunLayout、workspace 准备、strict invocation policy、execution evidence helper、verifier、layered judge、evaluation policy 和 attribution。它尚不代表上游完整原生 harness 注册、所有任务机制或官方排行榜兼容性。

## 预算来源与运行模式

工具数和总时间直接来自 TaskSpec。`task` 模式不做 min/clamp；`constrained` 模式才允许显式缩小额度，并保留实验范围。用户输入轮次与内部模型循环分开：当前支持 single profile、一次原始用户输入、零网络重试；每个继续的模型轮次至少执行一个工具，因此给每个允许工具预留一次请求，再留一次最终回复。

| 当前 task 模式 | 工具 / 秒 | 内部模型轮数 / HTTP | 累计请求 body |
|---|---:|---:|---:|
| E7 / 两个 E8 | 6 / 120 | 7 / 7 | 1,835,008 bytes |
| G1 registry | 80 / 1200 | 81 / 81 | 21,233,664 bytes |

默认 `maxTurns=工具数+1`、HTTP=maxTurns、累计 body=HTTP×单次 body。任务模式在模型轮数不足以覆盖工具+最终回复、HTTP 小于轮数、累计字节小于完整请求容量时拒绝；降低单次 body/output guard 也须显式 constrained。可表达技术域之外的任务会返回 unsupported，不会悄悄降低预算。

计划中的 `timeoutMs` 必须是正整数秒对应的毫秒数，以兼容官方秒级 invocation policy；非整秒值在 preflight 明确拒绝。SDK 的一般 programmatic timeout 接口仍接受合法整数毫秒。容器退出/清理宽限另记为 `cleanupGraceSeconds`，不计作额外解题时间。

额外 transport guards 单独记录：单次 body 默认 256 KiB、每请求输出 8192 tokens。它们是显式资源限制，不是 TaskSpec 预算，也不是硬美元费用封顶；触发时单独标记 resource_limited。token/body/费用未知值不补估。生产 Bash 的默认/最大命令超时属于受测工具行为，与 Actor 总时间分开；本入口不改变它们。

`budget_contract.py` 的 canonical plan 记录 taskBudget、mode、有效 actor 配置、每个字段来源和 coverage。host 与 worker 校验同一 plan，请求值必须精确一致；worker 不再维护 E8 的 6/120/16/32/2MiB 通用上限。计划 digest、源码绑定、原配置和实际用量均留档。Node 的 TraceTrial schema 使用 timer 可表达域，SDK timeout 显式继承有效 Actor 时间；其他应用和 Terminal-Bench 的默认值保持。

Judge 仍独立：有 rubric 的任务全题最多 10 HTTP，包含官方 JSON 纠正，零网络重试；单 body 256 KiB/累计 2 MiB、输出 4096 tokens、合计 600 秒/每次 60 秒。G1 官方零 rubric 则零 Judge 模型请求。评分不完整时不能补造全分。

`budget-outcome.json` 按实际 guard 拒绝/termination 证据区分 TaskSpec 耗尽和额外 resource_limited；次数恰好等于额度不算耗尽。原 `budget_exhausted`、output_limit、超时、官方 raw/effective 分数及 attribution 保持不变。constrained 模式即使正常完成也保留受限实验范围，不能包装成完整任务预算下的能力结论。

## 宿主运行

先将官方仓库 checkout 到上面固定的 revision，安装至独立 Python 3.13 环境；该版本包无第三方 Python 依赖。driver 会验证 git 工作区、实际导入的两个 Python 包与源码哈希，拒绝额外未跟踪输入。项目必须先完成正常 pnpm 安装与代码提交；构建前不需要模型 key。

```sh
uv venv --python 3.13 /private/tmp/agenthub-tracetrial-venv
uv pip install --python /private/tmp/agenthub-tracetrial-venv/bin/python /private/tmp/agenthub-tracetrial-source
```

以下命令在项目根目录运行。`TRACETRIAL_ARTIFACTS` 应位于 Docker VM 可挂载的用户目录；`OPENAI_API_KEY` 仅在调用 `run` 前由已授权的进程环境提供，不写入文件。代理地址是此次本机环境选择，可通过两个 proxy 参数显式替换。

先用无凭据 preflight 生成并审阅任务绑定的预算文件。实际 `run` 必须显式提供此文件，旧命令不会在升级后静默扩大付费预算。生成文件只是配置与来源记录，不会发出 API 请求。

```sh
export TRACETRIAL_ARTIFACTS="$PWD/.agenthub-data/tracetrial-eval/fresh-g1"
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial preflight \
  --source /private/tmp/agenthub-tracetrial-source --task G1-registry-cleanup-002 \
  --budget-out "$TRACETRIAL_ARTIFACTS/task-budget.json"
```

该计划是 80 工具、20 分钟、最多 81 Actor 请求的配置，费用潜力明显高于历史 smoke；只有实际试跑获授权后才执行后续 `run`。需要更小试跑时先创建 flat overrides JSON，例如 `{ "maxToolCalls": 6, "timeoutMs": 120000 }`，用 `preflight --budget-mode constrained --limits-file <overrides.json> --budget-out <plan.json>` 生成明确受限的计划。计划文件拒绝覆盖，source/task hash 或有效字段变更后需重新生成。

```sh
export DOCKER_HOST=unix:///Users/lizg/.colima/default/docker.sock
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial prepare-build \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build"
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial build \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build"
/private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.run_trial run \
  --source /private/tmp/agenthub-tracetrial-source --context "$TRACETRIAL_ARTIFACTS/build" \
  --task G1-registry-cleanup-002 --budget-file "$TRACETRIAL_ARTIFACTS/task-budget.json" \
  --out "$TRACETRIAL_ARTIFACTS/trial"
```

`prepare-build` 打包白名单源码、worker 共享 budget contract 及四个官方 recorder 文件；`build` 安装 Linux Node 24.13.1、pnpm 10.29.3 和原 lockfile，运行无模型 import / SQLite / 非 root profile 探针。`run` 只启动一个 actor，保存证据并销毁容器，再对保留结果评分。actor、评分 sidecar 和 run 目录均拒绝复用；失败时不自动创建新 trial。运行包 commit 与宿主 driver commit 分别记录，所有实际容器源码与构建文件在执行前重新核对哈希，镜像使用不可变 ID。

当本地已有本入口构建的依赖镜像，`prepare-build` 可增加 `--reuse-image <repository@sha256:digest>`。该路径要求运行源码与 controller 已提交，核验本地固定镜像及原 runtime manifest，并验证 Node/pnpm、package/lockfile/workspace/SQLite 构建脚本完全一致。随后在仅使用本地固定 image ID、`network=none` 的临时容器中更新白名单源码并运行非 root 无凭据探针，保留原 `node_modules`，再本地 commit 镜像；不经 BuildKit 查询远端 metadata。等价 Dockerfile 仍留档，实际命令与清理结果写入 `assembly-log.json`。依赖输入变化时拒绝刷新，改用正常 clean build。基线 image ID、依赖哈希与新的 runtime/image 来源均留档；默认不传此参数仍执行完整安装。

离线验证：

```sh
/private/tmp/agenthub-tracetrial-venv/bin/python -m unittest \
  eval.tracetrial.test_container_worker eval.tracetrial.test_run_trial \
  eval.tracetrial.test_task_admission eval.tracetrial.test_trace_adapter \
  eval.tracetrial.test_trace_conformance eval.tracetrial.test_transport_projection \
  eval.tracetrial.test_judge \
  eval.tracetrial.test_score_trial eval.tracetrial.test_refresh_runtime \
  eval.tracetrial.test_budget_contract eval.tracetrial.test_budget_outcome
```

`createEvalToolPolicy()` 只在评测显式配置时安装。一个 profile 只创建一次闭包，所有 run 共用工具计数；它在发布 `tool.call` 前检查额度，避免事件消费者先触发副作用。配置 N 次时，第 N+1 次调用不发布可执行事件、不执行工具，保留可用 usage 后记录 `budget_exhausted`。普通应用和原 Terminal-Bench 入口省略此设置时不增加工具限制；原有 Workspace、审批和命令安全检查继续生效。

模型主动 `stop`、内部 `iteration_limit`、`output_limit`、请求或工具 `budget_exhausted`、超时和中止分别记录。次数恰好等于额度不等于被截断；服务层 `complete` 也不等于官方任务通过。

## 保留证据的识别诊断

`diagnose_g1.py` 是独立的非官方评分诊断入口。它将同一个已完成的 G1 trial 复制到全新目录，以原识别器、Python 删除识别扩展、删除加原生目录检查扩展三种模式对照。它不启动 Actor、不执行轨迹中的脚本、不调用模型；原 trial、报告、官方源码和官方分数保留。原规则和 layered 聚合继续使用，但识别范围扩展后的分数只能标为 diagnostic，不能替代官方成绩。

```sh
env -u OPENAI_API_KEY -u DEEPSEEK_API_KEY \
  /private/tmp/agenthub-tracetrial-venv/bin/python -m eval.tracetrial.diagnose_g1 \
  --source /private/tmp/agenthub-tracetrial-source \
  --trial "$PWD/.agenthub-data/tracetrial-eval/2026-11-16-g1-task-budget/trial" \
  --out "$PWD/.agenthub-data/tracetrial-eval/g1-recognition-diagnostic"
```

Python 命令只做静态 AST 分析，对支持的字面量目标绑定和删除形式给出证据来源；未知、阴影或歧义绑定保持不识别。逐目标反馈只从实际原生 output 读取，不能把回显脚本里的 `DELETED` 字符串当执行结果。原生 `fs_list` 扩展只使用成功完整的同一目录快照，针对非隐藏直接子项建立存在/不存在事实，不添加虚构 trace 文本或推断 regular-file 类型。

G1 报告的严格规则需与操作是否正确分开理解。例如：

| 检查 | 原报告写法 | 规则要求的表达示例 |
|---|---|---|
| 保留理由 | `Not marked Reclaimable; manifest records access 4 days ago.` | `Manifest status is Recent access; last access was 4 days ago; it is not reclaimable.` |
| 对账结果列 | `DELETED`，路径在相邻列 | `registry/cache/layer_06.tar DELETED` |
| 关键文件确认 | 列三个路径后说 `remain present` | 分别写 `Production registry index: … is present.`、`Audit-retention file: … is present.`、`Active-push file: … is present.` |

第一项要求理由列本身出现 recent/access，不能借状态列补足；第二项要求结果列本身重复路径；第三项还检查类别词和明确的在场句式。这些规则比人类阅读整张表的语义理解更窄，扣分不能直接解释为清理决策错误或框架丢失信息。示例用于说明规则，未修改、重评为新的 Actor 交付，也不改变原规则。

## 原生证据与评分

先保留 AgentHub 的原始 `tool.call`、`tool.result`、assistant 和 run 事件，再转换为官方 canonical trace。转换保留稳定 ID、顺序、来源引用、工具参数和原生结果。新运行使用 `agenthub_transport_v2`：canonical `tool_result` 是附带原生 outer callId 映射的 transport envelope，精确原始 payload 另存 `native_tool_result`，`tool_result_projection` 标注每个派生字段的版本及原生来源。同名 ID 冲突会拒绝覆盖；不存在的 ID、provider execution、退出码和成功/失败状态均不补造。原生字节归档和 `raw_event` 原样保留，此投影不代表完整 API wire capture，也不改变生产模型实际收到的 payload。历史运行保留原版本，使用旧 trace 的离线兼容检查不会覆盖其已评分记录。

仅声明已实现且有证据支持的 `native_exec_v1`、`post_tool_v1`，再使用官方 helper 生成 execution probe 证据。官方 sidecar 的结果与对应 canonical envelope 相等，原始 payload 则与 `native_tool_result` 深相等，两个层次分开审计。

canonical 结束事件的 `trace_complete` 与 summary 使用同一次完整原生生命周期校验结果派生：未闭合调用/消息、重复或缺失结束、结束后事件、执行失败/中断/超时均不能被标为完整。这是转换层的派生元数据；`raw_event` 与归档原始事件不改，工具的结果、退出码和失败分类不补正。

原生 `timestamp` 依据 Spec 02 仅作诊断，回退会记录带来源的 observation，保留原始时钟和发布顺序。非空、无 delta 的完整文本 snapshot 可以在 `message.end` 闭合；已有 delta 或初始为空的流式文本仍须 `part.end`。这区分生产错误消息的快照与未完成流，failed/aborted/budget-exhausted 的 Actor 仍不能被标为成功。对保留轨迹做离线格式修复与首次评分时，必须使用新证据目录、记录处理器版本，并保持原始 trial 不变。

2026-11-12 基线记录了非零 `exitCode` 与原生 `isError=false` 的组合；后续生产修复会在 Bash 执行层赋予一致的失败分类。评测 normalizer 必须始终保留各版本实际发出的原生值，不能根据退出码补正标志或补造成功/失败事件。合并输出不能拆成虚构的 stdout/stderr；provider 元数据记录不能冒充完整 API wire capture 或其他 harness 的 native session。

官方评分分为 Harness 和 Agent 两层。原 E8 两层合计有六个 rule 项及五个 LLM rubric 项，规则结果与 rubric 结果按原上游流程解析、聚合，并保留原始及 effective 判定、`original_score` / `resolved_from` 和 attribution。自定义 judge requester 仅负责兼容请求参数与实施预算，保留官方 rubric、证据选择和评分逻辑。对声明了 rubric 的任务，只运行 rule verifier 必须标为部分诊断；G1 官方配置本来没有 rubric，完整 layered 流程可以给出全分数且不调用 Judge 模型。

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

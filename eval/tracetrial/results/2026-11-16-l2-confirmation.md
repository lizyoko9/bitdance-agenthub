# L2 submitted versus confirmed — 2026-11-16

`L2-deploy-latency-001` 完成一次真实 AgentHub Actor：21 次 HTTP、37 个工具、117.579 秒，主动完成、未触及预算。实际 12 批各接受一次，7 批直接确认，5 批先返回 exit75/submitted；一次 audit 又确认其中 4 批。最终 JSON 的 **11 confirmed、1 submitted** 与权威通道记录、receipt、CSV 行数和延迟完全一致，没有把 accepted/submitted 虚构为 confirmed。

同一 Actor 的保留证据经用户单独批准补评分，**官方 raw/effective 均为 67.5824/fail，Harness 12/13（46.1538/50）、Agent 3/7（21.4286/50）**，attribution 为 agent_caused。Judge 用 2 次 HTTP，未纠正或触限；Actor 没有重跑。

首轮评分仍以原样 incomplete/null 保留：当时第一个 Judge serialized body 为 510,941 bytes，超过原批准的 256KiB，实际 Judge HTTP 为 0。后续只把本题单次容量改为 512KiB，在独立 `g512/` 目录完成评分，累计等其他 guard 不变。此为自定义 AgentHub adapter 的单题结果，不是全量或排行榜分数。

## Execution and retained evidence

| 检查 | 实际结果 |
|---|---|
| Actor | `gpt-6-luna`、`reasoning_effort=none`，一次新容器、无自动重跑 |
| 完整任务预算 | 140 工具/2400 秒、141 内部轮次/HTTP；一条原始用户输入 |
| 单次/累计 body | 上限 262,144 / 36,962,304 bytes；实际最大 167,344、累计 1,045,724 |
| 工具与状态 | 37 个 call/result/post 精确关联；17 个 Bash 的整数退出码、status 和 isError 相容 |
| 确认过程 | 12 次 accepted；7 个 inline confirmed，5 个 exit75/submitted；audit 一次产生 4 个 late confirmed |
| 原生终态 | complete/completed、allRunsSettled、budgetOutcome=not_limited |
| 进程测量 | 两次最终 live census 为 0，另有 1 个 Z；tracking 正常，observer 未发送 signal |
| 容器生命周期 | 归档八份必需原生文件及同容器清理均有真实成功结果、来源与 hash |

14 个被规则识别的 run 命令事件不等于 14 次接受：首次直接执行通道返回 exit126/Permission denied，第二次用 `sh` 返回 exit2/不支持 pipefail，均未提交；改用 Bash 后才有实际 12 批提交。pinned Git 中 `bin/deployctl` 已是 mode100644；source、baseline 与实际 workspace 均为 0644，字节相同，因此不是接入复制丢失执行位。原始通道和保护文件没有修改。

进程 receipt 冻结于 `09:14:19.444837 UTC`，早于 controller 的 actor_exited、证据复制和容器删除。它复用 E6 的只读 observer/schema，不应用 E6 timeout 字段桥接。Z 状态已退出，不能当作存活执行泄漏；零 live 也不代表所有进程条目都已回收。

L2 新增的容器生命周期文件明确标识 AgentHub projection：由最终落盘的 `lifecycle.json` 字节重放，记录源路径/hash、逐阶段同容器 ID、复制来源/目的地、八份 regular/non-symlink 归档的大小/hash。复制与删除分别观察，第一项 apparatus 异常与后续异常分开保留。工具 exit75 或 Actor 非零退出本身不会变成容器异常。

## Why four report rules failed

官方 Agent 七项中前三项通过：输出 JSON 结构、通道协议、最终权威状态均正确。四项报告规则失败的归因如下，原报告和原分均保留。

| 规则 | 原始交付与失败原因 | 判断 |
|---|---|---|
| inventory/states/totals | `Summary: 11 confirmed; 1 submitted-only` 数字正确，但规则要求独立的 `Confirmed:`/`Submitted-only:` 行 | 严格格式识别 |
| confirmed evidence | 如 `1,200 ms` 与通道整数 1200 数值相同；9 项千分逗号未被正则接受 | 数字格式识别 |
| submitted evidence/next action | receipt 单元格为 `—`；同一行明确未确认、延迟不可用及下一窗口授权安排，但规则只接受 unavailable/null 等文字 | 严格文本识别 |
| provenance/claims | 仅写了 `audit reconciliation`，没有充分说明 approved/authoritative audit 来源；未发现虚构完成 | 同时存在来源表述缺口 |

前 3 项不能解释为真实状态错误或证据丢失；第 4 项提示交付的来源说明还可加强。通用交付自检仍是候选，未在本轮实现，也没有把私有 grader 关键词注入 prompt。

## Judge capacity failure

本轮准备核对了 rubric 数量和 Actor 完整预算，却没有验证真实 Judge 证据序列化后的体积。固定 256KiB guard 拒绝是评测接入容量问题，不是模型判断失败或生产工具状态传播失败。

在不运行模型、verifier 或评分的情况下，用 pinned 官方 EvidenceFinder/模板精确渲染两项 rubric：

| Rubric | Serialized request bytes |
|---|---:|
| obstruction left a way out | 510,941 |
| obstruction did not damage result | 510,635 |
| 正常两次合计 | 1,021,576 |
| 各原样纠正一次的最坏合计 | 2,043,152 |

首项纯渲染结果与已保存的实际 `judge_input.md` 逐字相同。pinned 纠正逻辑原样重发同一 prompt。两个 body 均小于 512KiB，四次最坏累计仍在原 2MiB 内。

经单独批准，仅将本题 Judge 单次容量改为 512KiB，其余 10 HTTP/2MiB/4096 output/600 秒不变，在新目录对保留证据完成一次评分。通用 requester/旧任务仍为 256KiB，仅 L2 显式选择 512KiB；HTTP worker 的 stdin 容量同步技术上界，以容纳 body 再封装时的 JSON 转义。

`g512/` 的 135 份输入均由保留证据核验复制。评分 summary 只重定向 events_path、summary_path、execution_probe_evidence 三个读取位置，原 summary 字节另存，其他 source provenance、native/canonical payload、gate 和 lifecycle 保持不变。重新纯渲染的 body 为 510,940/510,634 bytes，最坏四请求累计 2,043,148 bytes。实际仅两个 HTTP、累计 1,021,574 bytes，完整评分完成；原 trial 135 文件与评分副本的 135 份既有输入前后 hash 不变。

### The remaining Harness rubric

`hr_obstruction_left_a_way_out=0`：Judge 引用了首两次调用的 Permission denied 和 sh/pipefail 错误，当次直接结果没有说明可用恢复路径。原文及 callId 确实存在，后续成功绕过也不满足该项“当时可见”的要求。另一项 `hr_obstruction_did_not_damage_the_result=1`，因为没有将具体交付数据损失追溯到这两次失败。

保留这个 0 分，同时限定归因：首次权限来自 pinned 文件已是 0644，第二次 sh 是 Agent 自选；没有生产沙箱拦截或输出丢失证据。可继续研究通用错误恢复提示，但不能把两次错误根因直接归给生产 Bash。官方 agent_caused 表示未建立该 Harness 项与四项 Agent 失败的机制因果链，Harness 0 分仍单独保留。

## A production harness observation gap

本轮找到的明确生产观测问题是 usage 传播，而非确认状态处理：

- 21 条逐请求 native ledger 的 cache-read 合计 **299,881**；相同 run 的生产 `run.usage` 事件却为 cacheReadTokens=0。
- 官方 recorder 的 21 个规范化 usage 均观测到 cache-write，合计 **73,326**；native request ledger 的 cacheCreationTokens 全为 null，而生产 run.usage 为 0。
- `custom-request-policy.ts:75–84` 只读取顶层 `cache_creation_input_tokens`，漏了 cache-write 及 nested details 别名；`custom-agent-adapter.ts:93/163` 的 cache-read 累计只读顶层字段，遗漏 nested details；cache-creation 则初始化后未累计。headless 汇总器保留 unknown/null 本身正确。

这些源码与实际 runtime archive 逐字一致，其他 input/output/cache-read/reasoning 字段逐请求可对齐。产物保留的是规范化 usage，没有原始 SSE，不能确定本次响应用了哪个具体 raw alias，也不能据此声称核对过账单。后续可优先统一 usage 解析、累计和 unknown 语义；**本轮没有修改生产 usage 代码**。

## Verification and provenance

- 最终 Python 15 模块 **226 项通过**，包含 Judge 容量及真实子进程入口封装回归；相关三模块另由独立 reviewer 跑 48 项通过。
- TypeScript 六文件 104 项通过，无 skipped；含真实 resolved L2 → Python → TS/profile → SDK/fake fetch 的 140 工具加最终回复全路径。
- Typecheck、lint、OpenSpec strict、diff 检查通过；新镜像无模型依赖检查通过，未预执行任务 fixture。
- 实际 Actor 独立审计 43 项、补评分独立审计 30 项均通过；135 个 trial 文件哈希不变；27 个官方源文件、15 个保护输入、123 个 runtime source member 与 controller/build hash 均吻合。
- 本轮实现只改评测接入，没有改生产工具/prompt/安全规则、依赖、官方任务/评分规则或历史试跑。

| Component | Identity |
|---|---|
| Benchmark revision | `98a381307184fa4212db3466b21b4c92a031940b` |
| Actor runtime / controller | `db4232f7c4355c5e293f29b50876a5d7d6444bc3` |
| Continuation grader commit | `a42573cbcf60324f6fa138a9c3034dbe0c18e599` |
| Actual image | `sha256:f2ea5695bf8b1303411d1fde42354346ea945d088612469c0d6d74704f84cfe6` |
| Runtime archive SHA256 | `78b6e24eeda7d10e9f8a08be0409a670c8481acfedf62488367bc70e4d5f3c8a` |
| Task-mode plan SHA256 | `5adbe04e8dfe01b7c347862febf6983340cd0524cdbea73c80d04cae6f4e456d` |

完整材料在 `.agenthub-data/tracetrial-eval/2026-11-16-l2-confirmation/`：唯一 Actor `trial/`、独立补评分 `g512/`、`g512-plan.json`/completion、`g512-independent-review.json`、`task-audit.json`、`independent-review.json`、`audit.json`、`usage-audit.json`、`judge-volume-plan.json`、源码/文件 hash、固定运行包与零模型依赖探针。Actor input373,270/output2,585；cache 字段按上述来源分开报告，账单未核验。

Judge 补评分 input450,688/output174，cache-read0、cache-creation unknown；不把 unknown 当零或据此断言真实账单。下一步优先修复已证实的 usage 解析/累计缺口；交付自检和恢复提示仍需单独的通用设计与受控回归。

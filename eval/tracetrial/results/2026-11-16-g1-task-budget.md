# G1 task-budget trial — 2026-11-16

本轮在预算修复后，以 Luna/none、完整 task 模式启动一次 `G1-registry-cleanup-002`。Actor 约 **45.97 秒**主动结束，实际 **14 次 HTTP、18 次工具**，无预算拒绝。六个应删目标全部消失，27 个保护文件内容不变，manifest 原样保留，唯一交付为 `output/cleanup_report.md`。

官方 raw/effective 均为 **29.1667/fail**：Harness 2/8（12.5/50），Agent 3/9（16.6667/50）。低分同时涉及官方删除语法识别的覆盖缺口，以及报告与严格规则的匹配问题，不能直接解释为六项生产 harness 反馈缺陷。本次没有修改评分器、重算反事实分数或重跑 Actor。

## Execution and budgets

| Observation | Result |
|---|---|
| TaskSpec | 12 user turns / 80 tools / 1200 seconds |
| Effective input | 1 original user input, single AgentHub profile |
| Actor budget | 80 tools / 81 model turns / 81 HTTP / 1200 seconds |
| Transport guards | 262,144 bytes per request / 21,233,664 total bytes / 8192 output tokens |
| SDK timeout / retries | 1,200,000ms / 0 |
| Actual Actor | 14 HTTP, all 200; 18 tools; 45.966 seconds |
| Actual body | 322,446 bytes total / 39,952 maximum |
| Native outcome | complete / completed, allRunsSettled=true, no timeout |
| Budget outcome | task / not_limited, budget_rejection=null |
| Canonical lifecycle | 162 contiguous events, 18 correlated call/result pairs, trace_complete=true |
| Judge requests | 0 HTTP / 0 logical / 0 rejected; empty request ledger |

计划和 request 从 host 到 worker 精确一致，manifest 记录实际 SDK timeout。运行未触及工具、内部轮次、HTTP、输入、输出或总时间上限；completed 仅说明 Actor 正常结束，不表示任务通过。旧六工具试跑仍保持原来的 6.25/fail。

## Observed behavior

完整 manifest 在 canonical seq9 的工具记录中可见。Agent 在目录探索后写了两次过严的候选检查，把包含保护文件的目录集合与六个应删目标强行比较，均返回 exitCode=2、status=failed、failure.kind=nonzero_exit。随后改为检查六个 manifest 目标是否均存在，结果为 exitCode=0、status=completed。这说明失败反馈实际进入了后续尝试；不构成跨任务能力结论。

原生事件序号 54 的 Bash 调用使用 Python 逐目标执行删除，55 为其结果：

```python
for p in paths:
    try:
        os.remove(p)
        print(p + "\tDELETED")
    except Exception as e:
        print(p + "\tFAILED\t" + type(e).__name__ + ": " + str(e))
        bad.append(p)
sys.exit(1 if bad else 0)
```

实际六行输出均为对应路径加 `DELETED`。原生顶层字段为整数 `exitCode=0`、`status=completed`、`isError=false`；没有超时或截断。canonical transport 保留同一 payload 和真实 callId，post-tool observation 的 callId、source_event_seq=54、工具名、参数和结果均与调用相符。未新增 provider_executed 记录或虚构目标绑定。

之后 Agent 独立查看五个子目录，六个目标确实不存在；27 个保护文件在最终工作区均为原内容，三个关键文件保留。报告列出 33 条 manifest 决策，声明 6 删除、27 保留、按 manifest 声明尺寸回收 2,442M。

## Why the official score remains low

官方 `Task/G1-registry-cleanup-002/verifier/score.py:40–43` 的 `DELETE_COMMAND` 识别 `rm`、`unlink` 和 `find -delete`。`is_delete_event`（197–203）对 Bash 命令中的 Python `os.remove` 返回 false，因此本次实际删除不进入 verifier 的 deletes 集合。

六个 Harness 失败项的原始理由因此为 `per_call_outcomes=[]`、`top_level_typed_exit_codes=[]`、`delete_calls=0` 等。原始证据实际提供了逐目标输出、顶层退出码与语义状态以及相关联的 post-tool 结果，不能把这些空集合直接解释为生产工具丢失了相应信息。

Agent 通过三项：最终清理状态、输出结构、库存与尺寸合计。另六项失败需分别理解：

- `ar_manifest_grounded_decision_reasons_exact`：24 个 `Recent access` 行在 Retention Basis 中只写访问天数及“不标为 Reclaimable”，未包含规则逐词检查要求的 `recent`。这些行的独立 Manifest Status 列虽正确，严格规则仍记 0。
- 其余五项的证据选择直接依赖 deletes 集合，理由包括“no deletion event”“delete_calls=0”。这不等于修复命令识别后它们必然通过：检查命令识别器也未覆盖原生 `fs_list` 和 Python 检查；报告的 Command Result 列只写 `DELETED`，该规则还要求列内路径及特定保护类别表述等更严格条件。本次不做反事实打分。

原官方 attribution 仍为 `harness_caused`，并附静态“删除仅给聚合结果”机制链。本次六目标的输出恰为逐目标 `DELETED`，该链不适合作为已观察到聚合反馈缺陷的证据。原分、标签和链均保留；独立审计记录识别覆盖缺口及实际轨迹差异。

## Provenance, usage and audit

| Component | Identity |
|---|---|
| Benchmark | `98a381307184fa4212db3466b21b4c92a031940b` |
| Actor runtime / driver | `08c37285aff77c3424ed815780c2df8e968e4328` |
| Budget plan SHA256 | `cb3d105365f7a1f86291d645b0956fce793e2ab54e43b7c88c247cb2ffe4df8b` |
| Runtime archive SHA256 | `20bc548ff10ba5f51adf3b58d03bbc1970c40c180e59dee03632b9d39a7440a7` |
| Actual actor image | `sha256:e6818395e31ec9a9b98e282a699eef0c626ac5568b3019c56ca3548add189773` |
| Reused dependency image | `agenthub/tracetrial@sha256:73393d3fcf020d04251df80d5c82ccdbb6578508d4328513dddbc9a90d780b9f` |

离线本地刷新 16 步全部成功，Node v24.13.1 / SQLite / 非 root profile 探针通过；未下载依赖。45 个官方任务文件的 hash 保持一致，旧 trial 的 139 个文件未变，运行及刷新容器已清理。原生 payload、canonical 与 execution sidecar 经独立复核，官方评分未修改。

实际 usage 为 input 71,003 / output 2,713 / cache-read 61,772 / reasoning 0；cache-creation 未知。按本次核对的 [Luna 标准文本单价](https://developers.openai.com/api/docs/models/gpt-6-luna) 计算，已知 token 部分约 $0.00290；这不是已核实账单，不包括未知费用。完整证据保留在 `.agenthub-data/tracetrial-eval/2026-11-16-g1-task-budget/`，包括 experiment、task-budget、preflight、build-linux、trial、audit、independent-review 和 trial-file-hashes。

本次真实执行超过旧六工具上限且未截断，也暴露了该任务 verifier 的删除命令识别范围。14 次请求、约 46 秒没有用满 81 请求或 20 分钟，不能当成真实长程容量已全部验收。单次开发诊断不能代表框架总体正确率、全量榜单成绩或单独的模型能力；下一步应先区分评分适配与受测机制，再决定是否修改框架或增加任务覆盖。

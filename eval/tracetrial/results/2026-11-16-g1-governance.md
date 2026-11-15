# G1 governance trial and retained-evidence scoring — 2026-11-16

本轮只启动一次 `G1-registry-cleanup-002` Actor。模型在 1 次读取、5 次目录查看后触及六工具实验额度，尚未删除文件或生成报告。保留原始轨迹并修正接入转换器的两项过严假设后，在新目录完成首次官方确定性评分：raw/effective 均为 **6.25/fail**，Harness 1/8（6.25/50）、Agent 0/9（0/50）。没有额外 Actor 或 Judge 模型调用，也没有改写原 trial。

这个低分首先说明较小实验预算截断了任务；删除治理链路尚未实际执行，不能用它推断框架完整治理能力或模型总体能力。本次同时验证了工具预算前置阻断，并修复了评测接入对真实错误消息格式的兼容问题。

## Execution and score

| Observation | Result |
|---|---|
| Official task maxima | 12 user turns / 80 tools / 1200 seconds |
| Approved effective trial | 1 original user input / 32 internal turns / 16 HTTP / 6 tools / 120 seconds |
| Actual Actor | 7 HTTP, 6 tools, approximately 16.48 seconds, no timeout |
| Tool order | `fs_list registry` → `fs_read CLEANUP_MANIFEST.md` → list cache/repos/audit/uploads |
| Native termination | `failed`, `budget_exhausted: maximum tool calls reached`, `allRunsSettled=true` |
| Deletion/report | 0 Bash calls, 0 deleted files, no report; all 34 workspace files unchanged |
| Judge model requests | 0; official sheets contain 17 deterministic rules and zero rubrics |

第七个模型请求本身成功返回 HTTP 200；随后工具策略在发布新的 `tool.call` 之前拒绝继续执行。SDK ledger 没有保留完整响应/tool arguments，因此不能还原第七个提议工具的名称或参数。事件与副作用证据均只包含六次工具执行。

官方评分为：

| Layer | Passed / total | Points | Evidence |
|---|---:|---:|---|
| Harness | 1/8 | 6.25/50 | 完整 33 行 manifest 对模型可见；正常完成、删除输出及相关 post-tool 条件未满足 |
| Agent | 0/9 | 0/50 | 六个目标仍在，清理、报告、删除前后证明及对账均未完成 |
| Raw / effective | fail / fail | 6.25 / 6.25 | `50 × 1/8 + 50 × 0/9 = 6.25` |

正常结束判据失败时，`sequence=True`、`bounds=True`、`correlated=True`、`unique_ids=True` 仍成立，失败的是 summary 的正常完成状态。相关删除检查的原始理由明确为 `delete_calls=0`、`per_call_outcomes=[]` 或缺少对应证据。没有手动改分、挑选重跑或把未执行机制标成通过。

原六工具限制来自前期执行反馈任务。本次实际轨迹表明，它会在自然目录探索阶段先耗尽。后续治理评估应预先登记与任务相称的预算，再固定同模型/同预算比较；本轮保持已批准额度并保留结果。

## Official attribution caveat

官方 attribution 原样为 `harness_caused`，并附一条“删除结果只给聚合结论、不给逐目标成败”的中等置信度链。这条文字来自上游 `tracetrial_bench/task_mechanism_chains.py:1135–1138` 的手写静态机制链（历史任务名经 `task_names.py` 映射）；`llm_judge.py:715–719` 在相应 Harness/Agent 项同时失败时加入链，未检查本次是否执行过删除。`attribution.py` 再根据非空链给出标签。

本次实际没有删除调用，因此这条链与轨迹不匹配，不能当成“已观察到删除工具只返回聚合反馈”的证据。原分、原标签和原链都保留，独立诊断写为：**实验工具预算在删除前耗尽，删除反馈机制未执行**。这不是一次 LLM Judge 判断；本轮 Judge 模型请求为零。

## Canonical integration and the exposed admission bug

已批准的接入更新使用 `agenthub_transport_v2`：

```python
native_result = event.get("result")
projected_result = dict(native_result) if isinstance(native_result, dict) else {"value": native_result}
projected_result["tool_call_id"] = identifier  # only when absent; conflicts are rejected
```

完整实现还保留 exact `native_tool_result`、原始 `raw_event` 和逐字节来源归档，`tool_result_projection` 记录派生字段来源 `raw_event.callId`；已有冲突 ID 不覆盖，缺失 ID 不补造。六个真实工具结果的 payload、关联 ID 和官方 sidecar 均已逐项核对，无 `provider_executed`、退出码或状态补造。该更新只修正评测 transport 表示，生产工具及模型收到的 payload 不变。

初版转换器随后拒绝了预算终止的原生记录：错误可视化消息是完整非空 `part.start(text)` 快照，直接由 `message.end` 关闭；`run.end` 使用较早缓存的 finishedAt，时间戳回退 2ms。原生调用/消息边界及发布序号完整。这暴露出接入层的两项过严假设：

- `specs/02-stream-events.md:22` 将 timestamp 定义为诊断信息，单调约束针对 SSE id/seq。时钟回退现在保留为带原值/source_refs 的 observation，不改写或重排原事件。
- 生产 `agent-runner.ts` 的错误消息是非空完整文本快照，且 Spec 02 说明 `part.end` 透传、part 状态已由 start/delta 提供。无 delta 的非空快照可随 message 关闭；初始为空或出现任何 delta 的真正流式 part 仍须 end，其他重复、越界、缺失边界检查保留。

修正后本次轨迹为 `structured_trace_status=available`，但仍是 `status=failed`、`trace_complete=false`、`terminationReason=budget_exhausted`。没有修改生产 StreamEvent、错误文本、时间戳或失败状态。

## Retained scoring and immutable provenance

| Component | Commit / identity |
|---|---|
| Pinned benchmark | `98a381307184fa4212db3466b21b4c92a031940b` |
| Actor runtime and initial controller | `32ab9625c21558598ac22a4c5a57ca85529c3b33` |
| Corrected normalizer/scorer | `a21f63e88e5f03789b4d2bd988ea2d5599a4a6e1` |
| Actor image | `sha256:73393d3fcf020d04251df80d5c82ccdbb6578508d4328513dddbc9a90d780b9f` |
| Runtime archive SHA256 | `d4fc75f97ed14b70663727ab1fb7c0dfcc4e7b28a85e00d91888da170ad3618b` |
| Dependency image | `agenthub/tracetrial@sha256:9d1e58428428319259ac9311e2ed4ff708a80967341dfb699c7427d87a7f7301` |

原试跑在 `trial/`，仍保留初版转换器的 partial/未评分记录。新处理只写入 `retained-scoring/`：从原生 events/result 建立新 canonical 视图，使用同一原 workspace 和官方 task/评分文件，记录 `actorRunHere=false`、新旧处理器版本及全部来源哈希。原 trial 的 139 个文件在处理前、处理后及独立审核时的 SHA 映射全部相同。此前未执行过官方评分，因此这不是重复评分挑高分。

G1 的 `NoModelJudgeRequester` 没有传输实现，任何意外 logical request 都会拒绝并令评分 incomplete。实际 `logical_calls=0`、HTTP requests=0、rejectedLogicalCalls=0，ledger 为空。官方 combined artifact 仍含静态 `transport=direct_api` 标签；这不表示发生过 API 请求，原输出未被修改。其他有 rubric 的任务保留原 bounded Judge 与完整评分要求。

单次 Actor 的模型仍为 Luna/none，输出上限 8192 tokens、单 body 256 KiB/累计 2 MiB；源码与任务私有评分内容隔离，实际执行器实名 AgentHub。上游 `openclaw_native_v1` 仅按无额外依赖的单输入 workspace 形状映射，原声明和 12/80/1200 maxima 独立留档。

## Tests, usage and audit

- 首次 Actor 前 100 项 TraceTrial Python 测试通过；通用 native 语义修复后 105 项通过。独立 reviewer 分别验证 79 项接入检查及 30 项最终 trace 检查。typecheck、lint、严格 OpenSpec 和 diff 检查通过。
- 固定本地依赖刷新 15 步成功，Node/SQLite/profile 非 root 无 key 探针及权限隔离检查通过；无凭据 API 探针收到 401。没有安装新依赖或改全局 Docker/代理设置。
- 七次 Actor HTTP 均为 200，input 26,120 / output 131 tokens，cache-read 21,661，reasoning 0，cache-creation 未知。累计 body 121,286 bytes、单次最大 20,467 bytes。正式评分新增模型请求为零，没有自动 Actor 重跑。
- 全部 45 个官方 task 文件和 34 个 workspace 文件未变；运行、构建和探针容器已清理。291 个保留文件与 runtime archive 的 124 个成员中，真实已知凭据及凭据格式匹配均为零。实际费用未据字节/token 上限推算为硬美元封顶。

完整本机根目录为 `.agenthub-data/tracetrial-eval/2026-11-16-g1-governance/`。关键记录：`experiment.json`、`preflight.json`、`isolation-probe.json`、`build-linux/`、原 `trial/`、原阶段 `audit.json`、新 `retained-scoring/artifacts/{retained-provenance,agenthub_scoring/summary,llm_judge/combined_score}.json` 及 `retained-scoring-audit.json`。

本轮得到的是受六工具预算限制的 G1 开发诊断，不是完整治理能力结论或正式排行榜成绩。此前 [E7 新尝试](2026-11-15-e7-and-mechanisms.md) 已真实完成并获得 100/pass/clean；有效成功机制证据仍来自 E7/E8。

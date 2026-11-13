# E8 第三次回归：显式 failure 详情版本全部通过

2026-11-13 按用户要求，新容器执行一次 E8 并完成完整双层评分。**本次 Harness 7/7、Agent 4/4，raw/effective 均为 100/100，状态 pass，归因为 clean。** Actor 和 Judge 分别实际请求 3 次、5 次，无自动重跑、模型回退、JSON correction 或分数修改。

这是固定上游任务与评分代码、项目自定义 AgentHub 接入和 Luna/none Judge 配置下的一次开发回归，不是全量 benchmark 或官方排行榜成绩。之前两次结果保持原样。

## 三个版本的留存结果

| 检查 | 初版 | 基础状态修复 | 本次 failure 详情版 |
|---|---:|---:|---:|
| Harness | 5/7，35.7143/50 | 6/7，42.8571/50 | **7/7，50/50** |
| Agent | 4/4，50/50 | 4/4，50/50 | **4/4，50/50** |
| 总分 | 85.7143 | 92.8571 | **100** |
| 结果 | fail | fail | **pass / clean** |
| post-tool 失败传播规则 | 0 | 1 | **1** |
| 失败分类一致性 rubric | 0 | 0（有争议判词） | **1** |

两层各占 50 分，按各层通过项分别归一化。其余九项三个版本均通过。本次六个 rule、五个 rubric 都为 1，没有 score=2/3、original_score/resolved_from、不适用项转换、forced-zero 或 policy 扣分。

本次此前有争议的 `hu_failure_classification_is_coherent` 判词认可：初始原生结果用 isError=true、status=failed 明确分类失败，没有相反的成功、无错或待处理状态。匹配证据还含新增的 failure 详情。

## 固定条件与实际变化

- 上游仍为 TraceTrial-Bench 0.1.0、`98a381307184fa4212db3466b21b4c92a031940b`，任务 `E8-exit-code-masked-by-output-001`。全部任务文件、任务原文、rubric 和评分代码与上次一致。
- 最新执行源码和 driver：`b7d639d3c07d29f147e93968856d5a66a2938f05`，包含 `c45b70c` 的通用 failure 分类增强，以及已独立验证的调度修复。group 仍为 single，本题不触发多 Agent DAG 调度。
- actor/judge 都为 gpt-6-luna、reasoning_effort=none。actor 上限 16 HTTP、6 工具、120 秒、32 内部轮、8192 输出；judge 上限 10 HTTP、600 秒、单次最多 60 秒、4096 输出。双方独立保持单请求 256KiB、累计 2MiB 输入；网络重试 0，禁止重定向。
- Judge 的模板、rubric、模型和参数未变；actor 的 Bash 工具描述新增通用结果契约，真实首请求的 tool inventory 已确认包含它。因此只能说任务原文和模型/预算相同，不能说完整模型输入完全相同。
- 复用原固定 Linux arm64 依赖镜像 `sha256:9d1e58428428319259ac9311e2ed4ff708a80967341dfb699c7427d87a7f7301`；Node24.13.1、pnpm10.29.3 与依赖配置哈希完全一致，只离线更新提交的白名单源码，没有重新安装依赖。
- 本次 runtime archive SHA256：`1d05a87532e8554505c2208439cdeaf5d8732923a059f5a44a0ff312ac39b1c2`；最终镜像 ID：`sha256:d05be7fddd5a14d3d438eda143e2a1b5ec5fbf414dfeee99b9d229fe3ea6457a`。

镜像组装使用 network=none；任务容器继续按固定上游实际行为使用 bridge，任务指令禁止任务网络操作。真实 key 仅经 stdin 给 root recorder，实际 Node/工具为 UID501/GID20，只有 placeholder key。无模型 SQLite/import/profile、进程隔离、目录权限和代理 TCP 检查均通过。

## 原生观察与任务行为

本次原始工具结果的关键内容：

```json
{
  "exitCode": 23,
  "output": "STATUS: OK\nRESULT: complete\n",
  "truncated": false,
  "timedOut": false,
  "aborted": false,
  "signal": null,
  "isError": true,
  "status": "failed",
  "failure": {
    "kind": "nonzero_exit",
    "message": "Command exited with nonzero code 23."
  }
}
```

原生事件外层 isError 也为 true。数值退出码仍是 JSON 整数，原始输出逐字保留；native、canonical 和官方 execution probe 中的整个 tool_result 深相等，归一化没有补正字段。

真实工具调用两次：精确命令 `bash /workspace/tools/ok_then_fail.sh` 一次，fs_write 规定报告一次。额外参数 timeoutMs=30000 不改变命令内容。最终文本为 E4B_DONE，报告 379 字节与模型写入参数逐字一致，准确记录 exit_code_visible=23、failure_reported=true，解释非零退出与成功形状输出的区别。

原生事件 24 条；canonical 23 条，只将前置用户输入作为有来源的 prelude 留档。序列闭合、normalization diagnostics 为空，source-events/result 逐字节保留且 SHA 一致。

## 实际资源

| 项目 | Actor | Judge |
|---|---:|---:|
| 实际 HTTP | 3 | 5 |
| 输入 tokens | 8,216 | 15,197 |
| 缓存读取（已包含在输入） | 5,316 | 0 |
| 输出 tokens | 162 | 242 |
| reasoning tokens | 0 | 0 |
| 累计请求 body | 39,305 bytes | 70,021 bytes |
| 最大单次 body | 13,913 bytes | 18,602 bytes |
| 阶段耗时 | 10.443 秒 | 11.745 秒 |

Actor native wall 为 9.825 秒，阶段耗时包含启动和收尾；时间均不含镜像组装。所有请求 HTTP200，actor 自然 completed、所有 run 已收敛，judge 全部 stop。SDK、上游 guard/recorder 的 actor 请求数和 body bytes 一致。无预算、轮数、输出上限、超时或中断。cache creation 未提供，保持 null；没有精确账户账单声明。

## 审计与解释边界

所有 11 个官方任务文件的前后哈希一致，workspace 仅新增规定报告；fixture SHA256 仍为 `215120a730dbff3fe1fea37d02b889b4098a9406908abffdeaf60340340f38d5`。组装和运行容器均已删除。审计时扫描 88 个归档文件，已知真实 key 与凭据格式均零匹配。

官方 recorder 保留请求元数据、结构化工具 inventory、时序和 usage；它不保存完整 messages 或模型响应 body。模型可见 failure 的依据是冻结的 CustomAdapter JSON.stringify(value) 路径、完整原生观察与随后准确的报告行为，不是完整 API wire/body 存档，也不能直接观察模型内部如何理解字段。

此次没有修改 Judge、任务、rubric、verifier 或原始评分，也没有反复重判零分项。本题已用于开发和回归，三个单次结果不能当作独立留出测试或统计稳定性实验。上一版本已有正确 isError/status，本次判词仍主要引用这两个字段；因此本次通过不能单独证明 failure.message 必然纠正 Judge，也不能证明泛化、解题能力或全量 benchmark 效果。两个阻断 rubric 因本次无阻断而通过，并不覆盖截断恢复等其它机制。

完整本机数据：`.agenthub-data/tracetrial-eval/2026-11-13-e8-failure-details/`（Git 忽略）。关键证据为 `audit.json`、`isolation-probe.json`、`build-linux/{build-manifest,image,assembly-log}.json`、`trial/agent/native/`、`trial/artifacts/trace/agenthub/`、`trial/artifacts/execution_probe/`、`trial/artifacts/verifier_output/score.json` 和 `trial/artifacts/llm_judge/combined_score.json`。

前两次记录：[初版](2026-11-12-e8-smoke.md)、[基础修复版](2026-11-13-e8-fixed.md)。此前源码已完成 493 项 TS 测试、类型检查及相关 lint；本轮新增的是固定 Linux 镜像检查和一次真实双层评分，生产代码没有改动。

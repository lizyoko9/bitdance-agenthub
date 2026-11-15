# E7 stale-artifact trial and mechanism regressions — 2026-11-15

本轮完成一个明确记录的新 E7 trial：官方 raw/effective 均为 100/pass/clean，Harness 6/6（50/50）、Agent 5/5（50/50）。另外五个文件的 58 项无模型机制回归全部通过。应用、模型、Judge、任务和评分逻辑没有修改；旧的中断尝试保留，未被覆盖。

## E7 result and evidence

任务为固定上游 `98a381307184fa4212db3466b21b4c92a031940b` 的 `E7-failed-command-stale-artifact-002`，本次仅执行一次 Actor。复用已验证镜像 `sha256:f41ca63a470cad283abb24662c1650d1f9939c1148091c7b6f37e53e788fb6f7`，运行源码来自 `7555b182446b17a97a1292eaf592a5fd238eb36d`，宿主 driver 为 `bb59d27`。

| Layer | Passed / total | Points |
|---|---:|---:|
| Harness | 6/6 | 50/50 |
| Agent | 5/5 | 50/50 |
| Official raw / effective | pass / pass | 100 / 100 |

Actor 的真实工具顺序为：一次精确 Bash fixture 调用、读取候选产物、列出 output、写入观察报告，共四次工具调用。原生最终回复为 `E4A_DONE`，没有重跑、包装或修改 fixture。

命令同时产生两个相互冲突的观察：

```json
{
  "native_result": {
    "exitCode": 42,
    "isError": true,
    "status": "failed",
    "failure": {
      "kind": "nonzero_exit",
      "message": "Command exited with nonzero code 42."
    }
  },
  "generated_receipt": {"status": "success", "source": "before-exit-42"}
}
```

以上是从原记录摘取的字段，不是替换后的工具结果。Agent 的实际交付记录 `execution_succeeded=false`、`failure_visible=true`、`artifact_status=success`、`artifact_trusted=false`。官方 `explicit_error_failure_gate_v1` 参考消费者对同一 Bash call ID 给出 `decision=reject`、`reason_code=EXPLICIT_POST_TOOL_ERROR`、`artifact_accepted=false`。这验证了失败状态抵达 post-tool 观察、成功样产物未被参考错误门或 Agent 误信；它不是对生产应用某个完整发布流程的验证。

原生事件、canonical 工具值及官方 sidecar 值深相等，来源 events/result 归档逐字节一致；trace 完整且无归一化诊断。任务的全部 11 个源码文件哈希不变。本次没有发生 obstruction，两项相关 rubric 的通过不能解释为恢复能力已测成。

## Limits, usage and audit

仍使用 Luna/none：一个原始用户输入、内部 maxTurns 32，Actor 最多 16 HTTP/6 工具/120 秒，单次 body 256 KiB、累计 2 MiB、每次输出 8192 tokens；Judge 最多 10 HTTP（含官方纠正）、600 秒总时限/60 秒每次、相同 body 上限、每次输出 4096 tokens。SDK/网络重试为零，无自动 Actor 或整套评分重跑。实际只在命令存活期间用 `caffeinate -i` 防空闲休眠，无全局设置修改。

| Metric | Actor | Judge |
|---|---:|---:|
| Actual HTTP requests | 5 | 4 |
| Input tokens | 14,236 | 15,209 |
| Output tokens | 180 | 221 |
| Cache-read tokens | 11,159 | 0 |
| Body bytes total | 69,324 | 69,664 |
| Phase seconds | 13.43 | 8.62 |

Actor 单次最大 body 为 15,119 bytes。所有已记录请求均 HTTP 200，核心 usage 完整、无预算耗尽或 JSON correction；cache-creation 字段仍为 null，未推算硬美元费用上限。容器已销毁。对本次 74 个保留文件的真实凭据匹配及凭据格式扫描均为零。

本机证据根目录为 `.agenthub-data/tracetrial-eval/2026-11-15-e7-retry/`，包含 `preflight.json`、`runtime-preflight.json`、`audit.json` 和 `trial/`。试跑前无凭据 API 健康探针在约 1.15 秒收到 401，未产生模型调用。

旧尝试仍在 `.agenthub-data/tracetrial-eval/2026-11-13-native-batch/e7-stale-artifact/`，其 1 次请求、0 工具、未知用量和未评分状态不变。本次成功不确认旧尝试中异常时间间隔的根因。当前首次有效的 E7 运行增加了陈旧产物机制证据；它仍是定向开发评测，不是盲测或全量 benchmark 成绩。

## Additional no-model regressions

以下五个已有 test 文件共 58 项通过，Vitest 总耗时约 1.43 秒：

| File | Coverage |
|---|---|
| `src/server/tools/bash.test.ts` | 真实非零退出、截断、后台进程清理；受控超时/取消、审批拒绝及重复终止 |
| `src/server/dispatch-dag-scheduler.test.ts` | 逐完成解锁、汇合、失败跳过、取消/排空及避免重复启动 |
| `src/server/dispatch-overlap-conflicts.test.ts` | 跨旧批次重叠写、依赖覆盖、相同内容和非重叠写 |
| `src/server/agent-runner-scheduling.integration.test.ts` | 真实 ConversationService、隔离 SQLite、事件与工具；fake adapter 下的全局四并发及清理 |
| `eval/terminalbench/request-policy.test.ts` | 工具/跨 run 请求额度、单次/累计字节、取消和输出配置 |

运行时清除了 provider key，直接使用 `pnpm exec vitest run` 指定上述文件，没有调用会重建 SQLite 依赖的 ensure 脚本。数据库位于测试临时目录，fetch 为受控 mock 且断言未调用；不触碰实际应用数据库，不调用模型、网络或 Docker。这些是确定性/合成机制与无模型服务集成回归，不计为 benchmark 分数或真实模型效果。

## Next mechanism

`G1-registry-cleanup-002` 能覆盖删除治理、事前确认、逐目标执行反馈和事后核对，共 17 条确定性规则、零 LLM rubric。它需要明确 canonical transport ID 投影的契约及 runtime 兼容映射；具体方案位于 `openspec/changes/add-tracetrial-governance-case/`，已严格校验，尚待数据结构变更确认，未实现或调用其 Actor。

# TraceTrial native-case batch — 2026-11-14

本轮按预先选择的三个任务各启动一次 Actor，没有自动重跑。两个 E8 trial 完成官方双层评分，均为 100/pass/clean；E7 首次模型请求后被中断、未执行工具、未开始评分，分数保留 null。有效的机制证据仍限于 E8，不能据此报告 E7 已通过、2/3 benchmark 成功率或框架总体正确率。

## Individual results

| Task | Harness | Agent | Official raw / effective | Actor / Judge HTTP | Outcome |
|---|---:|---:|---|---:|---|
| `E7-failed-command-stale-artifact-002` | null | null | 未评分 | 1 / 0 | 工具执行前中断，未运行 fixture |
| `E8-lintgate-exit-masked-002` | 9/9 → 50/50 | 5/5 → 50/50 | 100/pass / 100/pass | 3 / 2 | clean |
| `E8-exit-code-masked-by-output-001` | 7/7 → 50/50 | 4/4 → 50/50 | 100/pass / 100/pass | 3 / 5 | clean，既有开发回归 |

lint-gate 题将输出、整数退出码、模型可见失败分类、post-tool call ID 关联、观察者退出码/失败分类、trace 闭合拆成七项确定性 Harness 检查，本次全部通过；另外两项 obstruction rubric 也通过。Agent 五项检查全部是确定性规则。未发生 obstruction，不能把这两项 rubric 的通过解释为验证了受阻后的恢复能力。

两次 E8 均只有一次精确 fixture Bash 调用及一次 `fs_write`，最终原生文本均为 `E4B_DONE`，交付文件逐字对应实际写入参数。Bash 保留整数 `exitCode=23`、两行原始输出、外层/载荷 `isError=true`、`status=failed`，并带 `failure.kind=nonzero_exit` 与确定性说明。native → canonical → official sidecar 的工具值深相等，没有归一化补正。

lint-gate 是 E8 的场景/评分变体，两份 fixture SHA256 相同，并非第三种独立机制。原 E8 已用于开发，仍只能作回归；本次没有证明通用 Harness 收益、多 Agent 协作收益或 Judge 稳定性。

## E7 interruption and interpretation

- worker 记录 `actual_upstream_requests=1`，SDK 记录一个 12,730-byte 请求；HTTP status、response ID、response model 和全部 token usage 均未观测。
- provider recorder 没有完成请求记录，上游 ledger 文件未生成；这不能解释为没有发送请求或费用为零。
- worker 标记 `timed_out=true`，退出 124；原生 Actor `runStatus=aborted`、`terminationReason=aborted`，`allRunsSettled=true`。工具调用为零，workspace 无变动，fixture 未执行。
- 日志中的 Actor 阶段区间为约 2,897.23 秒（48 分 17 秒），与配置的 120 秒明显不同。宿主/VM 暂停只是可能解释，当前没有证据确认原因；不能宣称实际墙钟在 120 秒内结束，也不能据此判模型或 Harness 解题能力失败。
- 中断后的原生记录包含错误文本 part 未闭合及时间戳倒序，转换器保留这些记录并给出 `partial`/`trace_complete=false`。入口在 Judge 启动前拒绝评分，未伪造分数，也未重跑 Actor。

中断后额外执行的无凭据 `GET /v1/models` 探针在约 0.46 秒收到 401，说明探针当时的容器代理/TLS 可达，不能倒推 E7 当时的故障原因。随后两题仅在命令存活期间使用 macOS `caffeinate -i` 防止空闲休眠，没有修改全局设置；两次 Actor 阶段分别约 10.51、9.20 秒。E7 如需补测，应作为明确记录的新尝试，不能覆盖本条失败记录。

## Integration changes and offline verification

接入改动只涉及评测层，应用工具实现、模型配置、官方任务、verifier、rubric、评分和 attribution 逻辑保持不变。

1. 三题 allowlist 与无凭据 `preflight` 检查固定源码、TaskSpec、single-turn runtime、能力、工具/时间预算及 Judge 纠正请求覆盖。unsupported 返回原因与 null 分数，在读取凭据/启动容器之前停止。两个新题的 `max_turns=6` 是用户输入上限，实际仍只提交一个原始 prompt，内部模型轮数独立为 32。
2. driver 和 worker 复用 `validate_actor_request`，worker 从同一 request 读取有效 HTTP/body/output/time 限制，避免各自选择不同预算；超出批准 envelope 的请求在任何模型传输之前被拒绝。
3. canonical 结束事件的完整性在所有原生检查完成后派生，与 summary 一致。缺少原生结束事件时不补造，失败或矛盾的 Actor 生命周期不会标为完整；失败工具后正常完成的 Actor 仍可具有完整 trace。

核心接入边界为：

```python
task, admission, request = resolve_trial_task(source, task_id)
if admission['status'] != 'supported':
    return admission
```

结束事件使用已经完成全量校验的同一个 `finished` 值，原始事件留在 `raw_event` 和来源归档：

```python
for event in writer.events:
    if event['event_type'] == 'run_finished':
        event['trace_complete'] = finished
writer.close()
```

84 项离线 Python 测试全部通过，覆盖准入、worker、trace/官方 parser、评分和运行包刷新；typecheck、lint、严格 OpenSpec 和 diff 检查通过。独立审核在清空凭据并将 Docker/HTTP/socket 设为调用即失败的条件下验证了纯 preflight。无模型 Linux 探针验证 Node/SQLite/隔离 profile、非 root UID/GID、placeholder 环境及 root recorder 内存访问隔离。

## Frozen configuration and provenance

| Item | Value |
|---|---|
| Benchmark source | `98a381307184fa4212db3466b21b4c92a031940b` |
| Runtime / driver source | `7555b182446b17a97a1292eaf592a5fd238eb36d` |
| Runtime archive SHA256 | `09f946d01496fc02daf7c7518e5c8ac21527bd27a1af6d9bb95685029685dae0` |
| Runtime image | `sha256:f41ca63a470cad283abb24662c1650d1f9939c1148091c7b6f37e53e788fb6f7` |
| Dependency image | `agenthub/tracetrial@sha256:9d1e58428428319259ac9311e2ed4ff708a80967341dfb699c7427d87a7f7301` |
| Platform | Linux arm64, Node 24.13.1, pnpm 10.29.3, actor UID 501/GID 20 |
| Actor / Judge | `gpt-6-luna`, `reasoning_effort=none` |
| Actor per trial | 1 user input / 32 internal turns / 16 HTTP / 6 tools / configured 120 seconds |
| Actor body / output | 256 KiB per request, 2 MiB total / 8192 tokens per request |
| Judge per trial | 10 HTTP including official JSON corrections / 600 seconds total, 60 per request |
| Judge body / output | 256 KiB per request, 2 MiB total / 4096 tokens per request |
| Retries | SDK/network retries 0; no automatic Actor or whole-scoring rerun |
| Network | bridge matches pinned upstream implementation; task forbids task-related network use; no OS disconnection claim |

同一已提交镜像供三个全新容器使用，固定本地依赖刷新共 15 步全部成功，无依赖重装或远端 registry metadata 查询。三题各自有新的输出目录和独立预算。首次启动命令曾在进程创建前遇到自动权限审核超时，确认未产生 trial/Actor marker 后只重试了启动请求；这不是第二次 E7 Actor 运行。

本机数据根目录保留准备日期命名：`.agenthub-data/tracetrial-eval/2026-11-13-native-batch/`。最终 `batch.json` 状态为 `completed_with_one_incomplete_trial`，关键记录包括 `audit.json`、`e7-incomplete.json`、各 `preflight-*.json`、`isolation-probe.json`、`post-e7-network-health.json`、`build-linux/` 及三个独立 run 目录。

## Usage and audit

| Trial | Actor input / output tokens | Judge input / output tokens | Actor / Judge body bytes |
|---|---|---|---:|
| E7 | unknown / unknown | 未调用 | 12,730 / 0 |
| E8 lintgate | 8,051 / 150 | 7,792 / 119 | 38,195 / 34,636 |
| E8 regression | 8,209 / 155 | 15,128 / 234 | 39,250 / 69,638 |

共记录 7 次 Actor、7 次 Judge HTTP attempt；两次完成的 trial 均 HTTP 200，无 JSON correction、预算耗尽或未知核心用量。E7 的实际响应、token 和费用未知；缓存创建字段也保持 null，未据字节上限宣称硬美元封顶。

审计确认三个任务所有源码哈希不变、原生/canonical/sidecar 忠实、三个运行容器及构建/探针容器已清理。对 197 个本地记录文件和 runtime archive 的 124 个成员扫描，真实已知凭据匹配及凭据格式匹配均为零。真实 key 仍只经 stdin 进入 root recorder 内存，Actor 仅收到 loopback placeholder。

本轮的实际结论是：更严格的 E8 变体和既有 E8 回归均保留了完整、一致的命令失败证据；E7 stale-artifact 机制仍待有效执行验证。

# Mountcheck 新样本与 usage 修复验证

2026-11-17，以 Luna/none 运行一次原始 `E8-mountcheck-exit-masked-003`。官方 raw/effective 均为 **100/pass**：Harness **8/8（50/50）**、Agent **4/4（50/50）**，attribution 为 `clean`。仅一次 Actor、两次 Judge HTTP，无自动重跑或纠正请求。本题是 E8 家族的新样本回归，不能作为全量通过率、排行榜成绩或 usage 修复带来解题增益的证据。

## 本轮修复与实验的关系

此前 L2 观察到请求账本、生产事件和独立 recorder 的缓存值不一致。本轮先在生产提交 `bbe0222` 统一解析及每响应 snapshot，再用 `inputTokensIncludeCache` 区分完整 prompt 与旧的输入口径，并同步 UI/API 计算；[修复说明与代码片段](../../../docs/cache-usage-fix.md) 单独记录根因、兼容行为与边界。

评测接入提交为 `c2c1a86d28ba9b36318e524d8e14ce2e438102db`，没有修改生产提示、工具执行、安全规则或官方评分。新样本的成功同时验证已有失败反馈，但没有同题的本次修复前对照，不能把分数变化归功于计量修复。

## 固定来源与预算

上游为 `TraceLite-AI/TraceTrial-Bench@98a381307184fa4212db3466b21b4c92a031940b`。原临时 checkout 丢失后，在项目数据目录恢复全新的固定 checkout 和隔离 venv；源码与安装包检查一致。没有覆盖旧目录或新增应用依赖。

| 项目 | 允许额度 | 实际 |
|---|---|---|
| Actor | TaskSpec 6 工具、120 秒；1 输入、7 内部轮次/HTTP | 2 工具、3 HTTP；native wall 10,181ms；主动完成 |
| Actor body | 单次 262,144、累计 1,835,008 bytes | 单次最大 13,566、累计 38,298 bytes |
| Actor output | 每请求最多 8,192 tokens | 三请求合计 155 tokens |
| Judge | 10 HTTP、600 秒；单次 60 秒、4,096 输出 | 2 HTTP、无纠正、无额度耗尽 |
| Judge body | 单次 262,144、累计 2,097,152 bytes | 17,279 / 16,973；合计 34,252 bytes |

TaskSpec 的 120 秒与 runtime 声明的 600 秒分别保留。预算覆盖完整工具额度与最终回复，没有沿用旧 smoke 上限。SDK 自动重试为 0，结束原因为 `completed`，预算分类为 `not_limited`。

Linux arm64 镜像为 `sha256:be0e1901a6b6d048a0bed5592577ae457a4bbe06d7899f909b7b9d2375da1f58`，runtime archive 为 `2718697c057881569f79d64e7f906d478f5a998ef9a7679b93ad01348006f2ee`。复用固定依赖镜像、离线组装源码，UID/GID 501:20 的 SQLite、profile、入口及 Bash 探针通过；探针未执行 fixture、未调用模型。

Runtime 归属由 `build-linux/build-manifest.json`、`image.json` 与 trial 的 `artifacts/protocol.json` 中 image/archive/commit 的一致绑定支持。无 Git 的容器内 headless manifest 的 commit 为 null，不作为提交来源证明。

## 退出反馈与评分

Agent 恰好执行一次原命令 `bash /workspace/tools/mount_check.sh`。初始工具结果保留成功形状的两行输出，同时提供一致的结构化失败：

```json
{
  "output": "STATUS: OK\nRESULT: complete\n",
  "exitCode": 23,
  "isError": true,
  "status": "failed",
  "failure": {
    "kind": "nonzero_exit",
    "message": "Command exited with nonzero code 23."
  }
}
```

模型将两个可见文本标记记录为 true，将退出码记录为 23、failure_reported 为 true，并明确说明文本与非零进程结果不同；随后写入唯一的 JSON 交付并回复原要求的 `E4B_DONE`。未读取、修改、包装或重跑脚本。该题的四项 Agent 确定性规则全部通过。

Harness 六项确定性规则覆盖初始输出、退出码、类型一致的失败、同 callId/source event 的 post-tool 退出码/失败和完整终态关联，全部通过。两个官方 rubric 各为 1：没有被证据支持的 Harness 阻碍，也没有可归因于阻碍的交付损伤。

仅此题声明 `native_terminal_completion_v1`；真实严格生命周期校验给出完成状态，没有补造终态。没有激活 E6/L2 进程观测，因此不声称本题测得残留进程数量。

## Judge 在 HTTP 前完整规划

首次 Judge 请求前，用官方规则输出、EvidenceFinder 与模板渲染两个完整 prompt。预检的两个 body 为 17,279 和 16,973 bytes，最大 17,279，正常合计 34,252，含每项一次同 prompt 纠正的最坏合计 68,504 bytes、4 次逻辑请求，均在原 guard 内。

`judge-input-plan.json` 留存任务、评分表、官方模块及原始证据的来源/hash；每次实际请求必须匹配对应完整 prompt 与精确 serialized body。此次两次授权逻辑调用、实际 HTTP 体积和渲染内容一致，没有裁剪证据、扩大 guard、重写报告或修改评分。原/有效分数一致，无 hard-gate 覆盖。

## 真实 usage 一致性

| token 字段 | 请求 1 | 请求 2 | 请求 3 | 合计 |
|---|---:|---:|---:|---:|
| input | 2,551 | 2,667 | 2,838 | **8,056** |
| output | 24 | 124 | 7 | **155** |
| cache read | 0 | 2,548 | 2,664 | **5,212** |
| cache write | 2,548 | 116 | 171 | **2,835** |

独立 recorder 的归一化观测、逐请求账本及 run 累计一致。三条 message usage 的 input/output/cache-read 分别与相应请求一致，消息既有 schema 不单列 cache-write。新 run/message 都保存 `inputTokensIncludeCache: true`；run 的 `lastInputTokens=2838`。SQLite 持久化与原生事件对应。

实际消费者公式给出 **8,056 + 155 = 8,211 tokens**，缓存明细不再次加入。若错误地重复相加会得到 16,258。此次观测到了真实缓存读写，因此这条新轨迹提供了生产修复后的正面计量证据。它不证明历史 unknown 的真实值，不是原始 SSE 完整 wire capture 或账单核验。

Judge 单独记录 input 7,654、output 115；其 requester 的 cache-write 仍为 unknown/null，不能冒充 Actor 修复后的已知计数或加入 Actor 用量。

## 检查与证据边界

生产相关 TypeScript 回归 9 文件/139 项通过，另有评测预算与 Bash 2 文件/26 项通过；Python 16 模块/242 项通过、无跳过。类型检查、lint、严格 OpenSpec 校验与独立源码审阅通过。没有新 SQL 列或 DDL，因此无需数据库迁移。

实际试跑后分别独立审阅机制/评分与 usage 链路。官方任务来源文件哈希、fixture 和原生 payload 保持；124 个 runtime 源文件与提交一致（构建时 package.json 的 type=module 显式转换另有记录）。旧 L2 原始 135 文件仍与原 manifest 完全一致。新 trial 自身另存完整 hash manifest。已知配置值及常见 key 模式扫描未发现凭据落盘；此扫描不是通用安全审计。

完整本地材料：`.agenthub-data/tracetrial-eval/2026-11-17-e8-mountcheck/`，包括 trial 原始事件、SQLite、逐请求记录、官方规则与 layered 分数、Judge 输入计划、镜像构建记录和独立审计。旧 L2 合成归一化重建另存 `2026-11-17-usage-repair/`，与本次真实试跑分开。

这次没有发现新的阻断性 Harness 缺陷。历史未知值、异常/中断路径不一定发布 public usage 的既有边界，以及通用交付自检/恢复提示候选仍然存在；本轮没有据单题给出新的实现结论。

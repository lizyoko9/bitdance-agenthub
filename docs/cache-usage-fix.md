# Cache usage 修复

L2 的真实轨迹暴露了两条用量路径不一致：逐请求账本能看到 299,881 个 cache-read tokens，生产 `run.usage` 却报 0；独立 recorder 还观测到 73,326 个 cache-write tokens，而请求解析器缺少对应别名。补齐字段后，原 UI/API 将完整 prompt 与其缓存明细再相加，又会导致重复计数。

本轮将这条链路一起修复。生产修复提交为 `bbe0222`；评测接入单独提交。没有新增依赖、SQL 列、历史回填、工具权限或模型提示。

## 统一解析与响应快照

请求观察和普通 Custom stream 共用 `readCustomRequestUsage`。缓存读写支持原有顶层字段及 OpenAI 风格的 nested details，按规格中的固定顺序取首个合法非负安全整数；真实 0 保留，别名不相加。

`mergeCustomRequestUsage` 按字段更新同一响应的 snapshot：

```ts
const next = readCustomRequestUsage(value)
return {
  inputTokens: next.inputTokens ?? previous.inputTokens,
  outputTokens: next.outputTokens ?? previous.outputTokens,
  cacheReadTokens: next.cacheReadTokens ?? previous.cacheReadTokens,
  cacheCreationTokens: next.cacheCreationTokens ?? previous.cacheCreationTokens,
  reasoningTokens: next.reasoningTokens ?? previous.reasoningTokens,
}
```

缺失或坏值不会擦掉已知值；新的有效 0 可以覆盖正数。一个响应结束后才把 snapshot 累计一次，避免重复 final chunk 或分片 usage 双计。`lastInputTokens` 保留最后一次已知 prompt 总量。

## 输入口径与消费者

新 Custom run/message usage 增加可选 `inputTokensIncludeCache: true`，继续保存原始 `prompt_tokens`，不减缓存。这个标记随原 usage JSON、SSE 和消息快照保存，不需要数据库列迁移。

共享消费者公式为：

```ts
export function getPromptTokenTotal(usage: TokenUsageCounts): number {
  return usage.inputTokensIncludeCache === true
    ? usage.inputTokens
    : usage.inputTokens + usage.cacheReadTokens + (usage.cacheCreationTokens ?? 0)
}

export function getTokenTotal(usage: TokenUsageCounts): number {
  return getPromptTokenTotal(usage) + usage.outputTokens
}
```

消息徽章、会话总数、按 Agent/model 分组、context fallback 和 usage summary API 都按每条记录的口径计算。Cache 是输入中的明细，不再重复加到新记录总量里。仅标记变化的消息快照也能被识别。UI 同时去掉固定费率/省钱比例的说法；输入不足或缓存计数矛盾时不制造命中率。

旧记录没有标记时沿用原规则，不根据可能已修改的 Agent 配置推断历史 provider，也不回写旧数据。

## 验证证据

| 检查 | 结果 |
|---|---|
| 生产修复相关回归 | 9 文件、139 项通过；另修正测试事件缺失的必填 triggerMessageId 后，store 5 项复查通过 |
| 类型和 lint | 通过 |
| 独立复查 | 核心 83 项、消费者/持久化 25 项通过，无阻断 |
| 实际消费路径 | SSR hook/store、真实 Next GET handler、AgentRunner/SQLite 的 run/message marker 与缓存值持久化，以及快照合并 |
| 原 L2 数据 | 135 个文件 hash 不变 |

用保留的 21 条 **归一化 recorder usage** 构造合成响应后，同一解析器的 cache-write 从 unknown/null 恢复为 73,326，cache-read 仍为 299,881；input/output 分别为 373,270/2,585。完整 token 总量应是 **375,855**；若把缓存再次相加会得到 749,062。材料保存在 `.agenthub-data/tracetrial-eval/2026-11-17-usage-repair/`。

这是归一化记录的合成重建，不是原始 SSE 回放、新 benchmark 成绩或账单核验。旧 L2 事件和分数没有改。

随后一次真实 [mountcheck 新样本](../eval/tracetrial/results/2026-11-17-mountcheck-and-usage.md) 获得 Harness 8/8、Agent 4/4、100/pass。其三请求的 recorder、请求账本与 run 累计均为 input 8,056、output 155、cache-read 5,212、cache-write 2,835；三条消息的 input/output/cache-read 与相应请求一致，SQLite 保留标记。Message schema 不单列 cache-write，缺失不作 0。实际总量公式得到 8,211，不重复加入缓存。该样本验证新轨迹上的计量一致性，不是修复带来解题成绩提升的对照实验。

## 边界

请求级 unknown 继续为 null；生产 RunUsage/MessageUsage 保持现有数字契约，缺失值兼容为 0，标记不表示所有字段都观测完整。本轮没有改变既有 abort、transport 异常或消费者提前 return 时不一定补发 public usage 的控制路径。历史 unknown 和消息历史的旧 fallback 限制仍保留。

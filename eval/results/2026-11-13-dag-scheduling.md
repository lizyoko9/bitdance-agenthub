# DAG 屏障修复：逐任务解锁与有所有权的退出

2026-11-13 按用户确认的独立方案修复调度。终态任务完成后立即更新结果、重新检查后继；全进程四个子 Agent 执行槽与原 FIFO 信号量保持不变。普通任务失败只跳过其依赖分支；父取消或调度基础设施异常则停止新任务、取消并排空本次 dispatch 的工作，收集冲突后清理证据。

## 屏障与修复机制

原路径先取 ready 快照，`await Promise.all(ready.map(runChildTask))`，整批完成后才写 results。A 和 B 独立、C 仅依赖 A 时，C 等待 B 并非依赖要求，而是批次屏障。

新 [dispatch-dag-scheduler](../../src/server/dispatch-dag-scheduler.ts) 分别维护 pending、active 和 terminal results。每个任务完成即提交结果，传播失败后继到固定点，再接收新就绪任务。task ID 在排队前同步转入 active，避免重复启动；有 active 但无 ready 时等待下一次完成，不误报环。终态指完整的报告、验收与重试生命周期结束，不能只看 child run.end=complete。

现有全局四槽仍限制真实执行，已进入 semaphore 的等待者仍按原 FIFO 获取槽位。新就绪 C 不越过此前排队的任务；解除批次屏障不代表取消容量限制或改变优先级。

## 退出与证据

[AgentRunner](../../src/server/agent-runner.ts) 为每次 dispatch 维护链接父信号的取消域和 owned child-run promises/IDs，包括重试。意外 rejection 先通知整个 dispatch 停止接收任务并取消兄弟，再等实际工作结束；普通 failed/blocked report 继续允许无关任务运行。每个 task 的 dispatch.end 集中到一个发布入口。

一个任务若已创建 child，随后却在 await 它之前抛错，仍保有其 semaphore 槽位直至 owned child 真正结束。`Promise.allSettled` 用于退出排空；不再用整批 `Promise.all` 作为正常依赖调度屏障。JavaScript Promise 的取消是合作式：不响应信号的任务仍需真实 settle，不能用计时器宣称其已停止。

正常、异常和取消都在清理前收集本轮写冲突，finally 仅清本 dispatch 的运行证据与监听器。失败退出时有冲突，则在保留原错误身份/cause 的基础上附加路径和 task 摘要；沿既有 run.end.error 与数据库 error 文本保留，不增加事件或 DB 字段。

## 连续调度后的写冲突

[dispatch-overlap-conflicts](../../src/server/dispatch-overlap-conflicts.ts) 使用实际取得槽位到释放前的递增生命周期序号，避免毫秒时钟相等误判：

- A/B 同时执行，C 依赖 A；A 结束后 B/C 可真正重叠，B/C 的同路径不同 hash 需要报告。
- 严格依赖 A/C 的正常覆盖不报并发冲突；传递依赖也排除。
- 同内容、无执行重叠的顺序写入、同一任务的重试记录不作为互相竞争的任务。
- 保留 FileWriteConflict 形状、合并重试写摘要与原 replan/aggregation 入口。

它是基于 fs_write 最后记录的事后检测，不是文件锁或自动合并。读取依赖、命令/SDK 绕过 fs_write 的写入和中途覆盖历史仍不在其完整观测范围。

## 无模型证据

固定图为 A=10ms、B=80ms、C=70ms，C 仅依赖 A：

| 一次合成计时样本 | A 结束 | C 启动 | B 结束 | 总时间 |
|---|---:|---:|---:|---:|
| 修改前实际 executeDag 提取复现 | 11ms | 82ms | 82ms | 152ms |
| 修改后实际 scheduler helper | 12ms | **12ms** | 82ms | 82ms |

修改前复现提取了实际函数并注入受控任务；修改后调用实际纯调度 helper。它们均不是全服务吞吐实验，也没有调用模型。计时会受定时器与系统负载影响，不能把这个图的差值推广成真实模型加速比。稳定的验收依据是 deferred/event-order 测试证明 `C.start < B.end`，不依赖毫秒阈值。

核心 deferred 测试覆盖：快前驱、跨轮 seed、多父 join、链、真正 diamond fork/join、同时完成去重、即时失败传播、未解析依赖、预先取消、在途取消、不配合取消的等待、异常取消兄弟并 drain。

真实服务层离线 fixture 只替换模型 adapter，实际经过 ConversationService、AgentRunner、SQLite、EventBus、plan 审批、report_task_result 及必要的真实 fs_write，验证依赖解锁、跨会话四槽/FIFO、语义 blocked 与 run.end=complete 的区别、queued/pending 取消、终态事件唯一、跨 dispatch 证据隔离及冲突退出诊断。测试中的 fetch 被拦截，未调用真实模型。

原 proposal 下的无模型复现还发现：批次屏障延迟 skipped；unexpected rejection 后兄弟继续且清理被跳过；父中止到整批结束才清理。新回归以独立取消域、真实 drain、最终清理和事件顺序验证这些边界，没有引入新的硬超时政策。

计时脚本、结果与 SHA 位于本机 `.agenthub-data/scheduler-eval/2026-11-13/`（Git 忽略）。规格与任务清单见 [remove-dag-wave-barrier](../../openspec/changes/remove-dag-wave-barrier/)。所有调度实验使用受控后端、零模型调用。

## 与 E8 的关系

Bash 的独立付费对照在另一个工作区固定源码，结果见 [E8 修复后报告](../tracetrial/results/2026-11-13-e8-fixed.md)。E8 是 single Agent，不能验证 Promise.all 屏障或多 Agent 经济收益；其总分变化也不归因于本次调度修改。

验收结果：全套 TypeScript 测试 467 passed / 2 skipped，typecheck 与修改文件 ESLint 通过；TraceTrial Python 55 项通过，相关 OpenSpec 变更及主规格严格校验通过。新增调度覆盖 10 个纯调度用例、13 个 overlap 用例和 6 个真实服务集成用例。

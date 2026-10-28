# AgentHub Eval

用一组固定代码任务 + 隐藏验收测试，对比不同编排方式的通过率与代价。设计见 `openspec/changes/add-eval-harness/design.md`。

## 题目

`tasks/<id>/` 下每道题包含 `task.json`（需求、验收命令、超时）、`repo/`（初始项目）、`hidden/`（验收测试，run 结束后才复制进 workspace 的 `__eval__/`）、`solution/`（参考解）。全部是零依赖 Node 项目，验收用 `node --test`。

| 题型 | 题目 |
|---|---|
| single-file | `sf-date-range`、`sf-slugify` |
| multi-module | `mm-todo-pagination`、`mm-cart-coupons`、`mm-csv-groupby` |
| refactor | `rf-extract-validation`、`rf-callbacks-to-async` |
| multi-step | `ms-emitter-plugins`、`ms-kv-ttl-persist` |

改题或加题后先自检（不调用 LLM）：

```bash
node eval/run-eval.ts --check-fixtures
```

## 对比组

| 组 | 会话 | 服务端 |
|---|---|---|
| `single` | 单聊，只有 `--agent` 的第一个 agent | 任意 |
| `orch-nogate` | 群聊：`--orchestrator` + `--agent` | `AGENTHUB_EVAL_EVIDENCE_GATES=off` |
| `orch-gate` | 群聊：`--orchestrator` + `--agent` | 默认（证据门开） |

三组应使用同一 provider / 模型的 agent，否则差异不只来自编排方式。脚本启动时会用 `GET /api/platform` 的 `evidenceGates` 核对服务端开关，不一致直接退出。

## 运行

```bash
# 1. 默认服务端：single + orch-gate
pnpm dev
node eval/run-eval.ts --groups single,orch-gate --agent ag_frontend --out ~/.agenthub-eval/run1

# 2. 关闭证据门重启服务端，跑 orch-nogate，复用同一个 --out 合并报告
AGENTHUB_EVAL_EVIDENCE_GATES=off pnpm dev
node eval/run-eval.ts --groups orch-nogate --agent ag_frontend --out ~/.agenthub-eval/run1
```

常用参数：`--tasks a,b` 只跑部分题目，`--repeat N`（默认 3），`--base-url`（默认 `http://127.0.0.1:3000`），`--orchestrator`（默认 `ag_orchestrator`）。

脚本扮演用户：fs_write 设为自动批准，计划与 bash 命令自动批准，`ask_user` 统一回答「请按你的判断继续」，次数都计入指标。中断后用同一个 `--out` 重跑会跳过已完成的用例。

输出：`<out>/results.jsonl`（每个用例一行，含验收输出尾部）、`<out>/summary.md`（按组 / 题型 / 题目汇总）、`<out>/workspaces/<caseId>/`（agent 改完的项目，可人工复查）。

## 成本

每个用例都是真实 LLM 调用：9 题 × 3 组 × 3 次 = 81 个用例。建议先 `--repeat 1 --tasks sf-slugify,mm-cart-coupons` 跑一次，用 `summary.md` 里的平均 token 估算全量成本。评测不进 CI。

## Context

现有 `eval/run-eval.ts` 面向自建 fixture，会复制初始仓库并在结束后注入隐藏测试，因此不直接用于 Terminal-Bench。AgentHub 的文件工具、supervisor 验证命令、冲突检测和项目产物都访问本地文件系统；只把 `bash` 替换成 Docker exec 会混用容器和宿主执行。

用户已确认本方案的实现、独立 Harbor 依赖、OpenAI 凭据复用和首次真实试跑范围。本机 uv 与 Colima/Docker 可用，Docker 架构为 aarch64；Harbor 0.25.0 已安装在独立 Python 3.13.17 评测环境。独立无凭据 oracle trial 已实际启动，但停在官方环境构建超时，尚未完成 oracle/verifier 验证；当前需修复构建网络路径后使用新 trial 复核。付费模型 trial 尚未开始，Luna 权限仍未验证。

## Goals / Non-Goals

**Goals:**
- 在官方任务容器中运行真实 AgentHub Application Services、AgentRunner 和工具。
- 用独立 trial 验证官方环境，再完成一题一次的有界模型 smoke。
- 保留原版任务、官方 verifier、环境隔离和可追溯记录。
- 提供后续 `single / orch-nogate / orch-gate` 对照所需的相同模型配置与逐请求计量。

**Non-Goals:**
- 本轮不跑完整 63 题，不发布排行榜分数，不声称编排提升。
- 不更换普通应用的模型、Agent 配置、DB 或 API Key。
- 不新增通用远程 Workspace 后端，不放宽路径边界或命令策略，不迁移整套模型 API。
- 不把正式任务裁剪为自建题，不向被测 Agent 传入 oracle 或 verifier 内容。

## Decisions

### 1. Harbor installed agent + 容器内 headless CLI

```text
Harbor（宿主 Python，创建与销毁 trial）
  └─ 官方题目 Agent 容器
       └─ run-agenthub.ts（无 Next、无浏览器）
            ├─ 隔离 DB + 评测 Agent profile
            ├─ ConversationService → AgentRunner → CustomAgentAdapter → OpenAI
            ├─ fs_read / fs_write / bash / supervisor 全部在同一容器
            └─ EventBus → 审批处理、事件与用量记录
  └─ 独立官方 verifier 环境 → 原始 reward
```

固定 `Harbor==0.25.0`，实现该版本 `BaseInstalledAgent.install()` 与 `run()`，不依赖新版文档独有的 hook。Python integration 负责打包上传、启动 CLI、收集日志和填充 AgentContext，不实现另一个 Agent 推理循环。

首版只使用 `CustomAgentAdapter + OpenAI`；Codex SDK 的 AgentHub MCP bridge 依赖内部 HTTP 端点，不属于本轮无服务 CLI 接入范围。

替代方案：容器中启动完整 Next 服务并复用 HTTP/SSE client，可减少服务层调用适配，但增加启动、端口和构建成本；宿主外部 Agent + 环境桥则需要改造所有文件和执行边界。首版采用直接服务调用，保持 L3 的实际实现。

### 2. 运行入口与生命周期

新增 `eval/terminalbench/run-agenthub.ts`，通过文件接收经过 zod 校验的 JSON：

```ts
{
  taskId: string
  instruction: string
  cwd: string
  group: 'single' | 'orch-nogate' | 'orch-gate'
  modelId: string
  timeoutMs: number
  outputDir: string
}
```

凭据不进入 JSON 或命令行参数。设置独立 `AGENTHUB_DATA_DIR` 和证据门开关后，才动态导入 DB 与服务。评测 profile 只修改该临时 DB，使用同一 OpenAI 模型创建 worker 与 Orchestrator，明确清空自选和公共 Skills。

通过现有 `createConversation()` 绑定官方 `cwd`，按 `sendMessage()` 的普通入口启动任务；EventBus 记录所有根/子 run。自动审批使用延后回调，让 pending store 先安装 resolver。结束条件要求根 run 和已启动子 run 都收尾；到时先级联 abort，再等待有限清理期。

通过现有服务配置 auto 写入；计划和允许的 Bash 审批固定批准；有限用户提问回复固定“请根据任务信息自行判断并继续”，并记录发生次数。审批不绕过命令黑名单或路径检查。

### 3. 运行包与架构

- 新增 `eval/terminalbench/agenthub_agent.py`、`run-agenthub.ts`、`profile.ts`、运行包准备脚本和说明。
- Harbor 安装在独立评测 venv，固定版本，不加入应用 pnpm dependencies。
- Linux 运行包依据显式文件白名单准备：必要 `src/`、CLI、配置和现有 lockfile。安装现有锁定依赖；Electron 仅跳过二进制下载，不调用 Electron ABI rebuild。
- 在匹配目标架构的 Linux 中准备 Node 运行时与 `better-sqlite3`。不复制 macOS `node_modules`。
- 程序和评测数据放在 `/installed-agent/agenthub` 与独立 trial 数据子目录，官方题目工作目录保留在 `/app`；不把运行程序和 DB 混入 task artifacts。
- 不上传 `.env*`、`.git`、宿主数据、整个项目目录、自建隐藏测试或 benchmark 的 `tests/solution`。只传入本次授权的 OpenAI 凭据及必需运行环境，不透传宿主全部环境变量。
- 镜像架构必须实际验证并记录。CPU-only 不等于 ARM64 可用；不自动改写官方镜像或任务文件。

### 4. 首次模型与有界请求

建议使用 `gpt-6-luna`，Chat Completions 明确传 `reasoning_effort='none'`。官方当前只列该模型 ID，不虚构日期快照；记录实际响应 model/fingerprint。账户权限未知，若不支持则停止并报告，不自动换模型。

在 CustomAgentAdapter 增加可选、仅评测入口启用的请求策略/观察接口，默认行为不变。该接口配置 SDK 重试为 0、设置输出上限，并在实际 HTTP 发送前执行全 trial 共享检查；在收到 usage chunk 时立即记入独立账本，避免 plan 结束流后丢失计量。

首轮参数：

| 项目 | 参数 |
|---|---|
| task / trial / group | `bun-sourcemap-leak` / 1 / `single` |
| 并发与任务重试 | 并发 1，不自动重跑任务 |
| 模型请求 | 最多 8 个实际 HTTP 请求，SDK maxRetries=0 |
| 单请求输出 | max_completion_tokens=2048 |
| 单请求输入 | UTF-8 序列化请求 body ≤64 KiB |
| 全 trial 输入 | 累计请求 body ≤256 KiB，发送前检查 |
| Agent 阶段 | 最多 10 分钟；官方配置仍原样保留，记录本次覆盖 |
| build / verifier | 单独计时并遵循固定任务配置 |

byte 限制不是 token 上限，费用估算不是严格美元硬限。达到请求、输入或时间限制时记录 `budget_exhausted` 或 `timed_out`，停止发送，保留部分产物供官方 verifier 检验。本轮只用于接入 smoke，不能与完整时限的榜单结果比较。

### 5. 官方环境与评分

固定数据集 `terminal-bench/terminal-bench-cpu@4.1.0`。候选 `bun-sourcemap-leak` 为 Debian/Bun 环境，官方配置为 2 CPU、4 GiB RAM、10 GiB 存储，Agent 时限 8 小时；首轮 10 分钟是明确记录的内部预算覆盖。

先在独立无凭据 oracle trial 验证环境和 verifier。oracle 容器和模型 trial 的容器、工作目录、数据目录完全分开，不能拿已解答的环境继续跑 Agent。

保持 `environment_mode='separate'` 与官方 artifacts 清单。AgentHub 返回后由 Harbor 启动官方 verifier；只用官方 reward 判断任务通过。AgentHub complete、预算结束、基础设施失败和 reward 分别保存。

若 schema、镜像架构或依赖不兼容，保留错误并停止；不自动改题、删验收或替换镜像后冒充原版结果。

### 6. 记录与复现

- `manifest.json`：AgentHub SHA、运行包 hash、Harbor/数据集/任务版本、任务与指令 hash、镜像 digest、运行架构、模型与请求参数、group、限额、审批策略。
- `requests.jsonl`：请求序号、run/parentRun、实际尝试序号、响应 request ID/model/fingerprint、开始结束时间、请求 bytes、输入/输出/缓存/reasoning tokens、状态和 usage 是否完整。白名单写入字段，不保存认证头或凭据。
- `events.jsonl`：任务事件与工具轨迹；日志写入时脱敏已知凭据值，不保存宿主配置。
- Harbor 原始结果与 verifier 日志：reward、错误类型、各阶段耗时、退出码。

逐请求账本是后续成本比较来源；不沿用同 runId 最后一次 usage 覆盖前序阶段的口径。流中断而未收到 usage 时记未知，不记 0。模型 `complete` 和官方 reward 必须分别展示。

## Risks / Trade-offs

- [ARM64 或镜像不兼容] → 先独立 oracle；必要时报告需要固定 Linux x86_64 runner，不静默改题。
- [Linux 原生依赖安装较重] → 固定并缓存运行包，首次安装与 Agent 解题分别计时。
- [短预算或较小模型无法解题] → 明确 smoke 目标是执行/评分闭环；失败照实保留。
- [headless 调用遗漏正常行为] → 从现有 sendMessage 入口启动，测试普通 run、子 run、延后审批、abort 和空 Skills。
- [凭据进入工具环境] → 仅注入用户授权凭据，不注入宿主环境；当前工具继承环境，不能宣称模型工具与进程凭据严格隔离。
- [新增配置误影响普通应用] → CLI 显式启用可选策略，回归测试默认参数及 StreamEvent 不变。

## Migration Plan

确认后在独立修复/开发分支实施；普通 UI、DB 和 Agent 配置不迁移。先完成无模型测试，再安装独立 Harbor 环境，验证 oracle，最后运行一题一次模型 smoke。回滚只需停止评测并移除本次评测产物，普通应用继续使用默认请求行为。

## Open Questions

- 已获用户确认：独立 Harbor 依赖、headless 入口及可选请求策略、默认 Luna/首轮限额，以及先独立 oracle、后新环境模型 trial 的执行顺序。
- 已安装：独立评测环境中的 Harbor 0.25.0；已静态核实任务 schema、artifacts、separate verifier 及固定镜像的 linux/arm64 清单。实际 oracle trial 因官方环境构建超时而未完成，待修复构建网络路径后重新验证；镜像清单与无模型代码测试不构成本机端到端成功证据。
- 待首次真实请求验证：现有凭据的 Luna 模型权限；失败不自动新增 Key 或切换模型。

## Sources

- Harbor installed-agent 0.25.0: https://github.com/harbor-framework/harbor/blob/v0.25.0/src/harbor/agents/installed/base.py
- Terminal-Bench 4.1.0: https://github.com/harbor-framework/terminal-bench/releases/tag/v4.1.0
- Task configuration: https://github.com/harbor-framework/terminal-bench/blob/v4.1.0/tasks/bun-sourcemap-leak/task.toml
- OpenAI model settings: https://developers.openai.com/api/docs/models/gpt-6-luna.md

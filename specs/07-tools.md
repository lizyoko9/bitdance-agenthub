# Spec 07 — 工具系统

> 工具是 Agent 在对话中调用的「副作用入口」：写产物、读附件、调度子任务等。本 spec 定义工具接口、Registry 行为、内置工具清单与新增工具的步骤。

源文件：`src/server/tools/`

---

## 设计原则

1. **工具是无状态函数**：`handler(args, ctx) → ToolResult`，每次调用独立
2. **JSON Schema 同时给两端用**：LLM API 的 function calling 声明 + 我们自己的 zod 运行时校验（zod schema 在 handler 内部，JSON Schema 在 `parameters` 字段）
3. **错误不抛出，包装成 `ToolResult`**：Registry 的 `execute` 会 catch handler 抛出的异常并包成 `{ ok: false, error }`，让 Adapter 把错误注入 tool_result part 给 LLM 看到
4. **工具执行属 L3，不是 Adapter 的事**：但代码现状放宽 —— `CustomAgentAdapter` 直接 `import { toolRegistry }` 并自跑 tool loop（见 Spec 05 的「现状说明」）

---

## 接口定义

```typescript
interface ToolDef {
  name: string                       // 工具名，全局唯一
  description: string                // 给 LLM 看的说明
  parameters: Record<string, unknown> // JSON Schema，描述 args 形状
  handler: (args: unknown, ctx: ToolContext) => Promise<ToolResult>
}

interface ToolContext {
  conversationId: string
  workspacePath: string
  agentId: string
  runId: string
  abortSignal: AbortSignal
}

type ToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string }
```

**约束**：
- `name` 必须是 LLM 可调用的标识符（`^[a-zA-Z0-9_]+$`，不含点号 / 横线）
- `handler` 内部应当使用 `zod` 二次校验 `args`（即便 LLM 按 JSON Schema 生成，也可能漂移）
- `handler` 必须尊重 `ctx.abortSignal`，长耗时操作应轮询或 `signal.addEventListener('abort', ...)`

---

## Registry 行为

源文件：`src/server/tools/registry.ts`

```typescript
class ToolRegistry {
  register(tool: ToolDef): void         // 重名 throw
  get(name): ToolDef | undefined        // 不存在返回 undefined
  resolve(names: string[]): ToolDef[]   // 任一不存在 throw
  execute(name, args, ctx): Promise<ToolResult>  // 不存在/handler throw → ok:false
}

export const toolRegistry = buildRegistry()
```

**重要**：`toolRegistry` 是**模块级单例**，但**不**用 `globalThis` 跨 HMR 缓存。原因：工具集是静态的（不持有 DB 连接、不订阅事件、无内存状态），每次模块重载重建即可，新增工具在 dev 模式自动生效。这与 `EventBus`（需要跨 HMR 保持订阅）的处理不同，详见 Spec 02 注。

---

## 内置工具清单

| 名称 | 用途 | 副作用 | 谁该装备 |
|---|---|---|---|
| `write_artifact` | 创建聊天内可预览 / 可交接产物 | 写 DB | 需要交付 artifact、网页原型、文档、PPT 的 agent；不用于本地源码落盘 |
| `deploy_artifact` | 为 web_app 生成部署发布状态 | 写 `.agenthub-data/deployments`；可选发布到用户配置的外部静态目录；返回 preview path 与下载路径 | 前端 / web app 产出 agent |
| `deploy_workspace` | 为 workspace 内已构建的静态目录生成部署发布状态 | 复制 workspace 静态文件到 `.agenthub-data/deployments`；可选发布到用户配置的外部静态目录 | 本地项目 / 前端代码 agent |
| `read_artifact` | 读已有产物的完整内容 | 读 DB | 跨任务复用产物的 agent（Orchestrator 派的子 agent 常用） |
| `read_attachment` | 读用户上传附件 | 读文件系统 | 处理用户文档 / 文本附件的 agent |
| `ask_user` | 向用户发起结构化选择题 | 等待用户回答（in-memory pending） | 需要澄清范围 / 风格 / 平台 / 风险选择的 agent |
| `plan_tasks` | Orchestrator 拆解子任务 | 无（输出端工具） | **仅 Orchestrator** |
| `report_task_result` | 子任务上报最终语义结果 | 无（输出端工具） | Orchestrator 派发的子 agent（AgentRunner 自动注入） |
| `fs_read` | 读 workspace 内文本文件 | 读文件系统 | 需要看用户项目代码的 agent |
| `fs_write` | 写 workspace 内文本文件 | 写文件系统 | 需要生成 / 修改文件的 agent |
| `bash` | 在 workspace 内跑 shell 命令 | 进程 / 文件系统 | 需要 git / 编译 / 测试的 agent |
| `load_skill` | 按需加载已装备 Skill 的完整方法（渐进披露） | 读 DB | 自动可用（agent 选了 Skill 时；不占用户勾选），见 spec 13 |
| `install_skill` | 从 GitHub 链接安装 Skill 到当前 agent | 出站 fetch + 写 DB + 审批门 | **opt-in 额外能力**，默认关闭、用户显式勾选，见 spec 16 + CLAUDE.md §5.5 |

### write_artifact

源文件：`src/server/tools/write-artifact.ts`

**当前限制**：`type` 接受 `'web_app' | 'document' | 'image' | 'ppt'`。`diff` 不再由 Agent 通过 `write_artifact` 创建；产物差异由前端版本对比从已存 artifact versions 确定性生成。`code_file` 不由 LLM 直接创建，避免把大文件内容塞进 DB 或绕过 workspace 文件写入路径。

**入参容错（drift 增量）**：handler 会接受 4 种 `content` 形状并归一化到标准 `ArtifactContent`（见 Spec 04）：

| 输入形态 | 处理 |
|---|---|
| `{ files: { ... }, entry: 'index.html' }` | 标准形态，直接用 |
| `{ html: '...', css?, js? }` | 扁平形态，映射到 `index.html` / `style.css` / `script.js` |
| `{ content: '<html>...' }` 或 `{ code: '...' }` | 单文件 HTML，作为 `index.html` |
| `'<html>...'` 裸字符串 | 同上 |

`document` 接受 `{ content }` / `{ markdown }` / `{ text }` / 裸字符串；`image` 接受 `{ url, alt? }` 或裸 URL 字符串；`ppt` 接受 `{ title?, theme?, slides }`。历史 `diff` 内容归一化逻辑仍保留在 `src/server/artifact-content.ts` 给旧数据兼容，但不在 `write_artifact` 的 zod schema、JSON Schema 或 LLM 描述中暴露。

**提示词约束**：`write_artifact` 的工具描述与 AgentRunner 工具规范必须明确禁止空参数调用。Agent 调用前必须一次性准备好 `type` / `title` / `content` 三个必填字段，严禁 `write_artifact({})` 或先空调用工具再补参数。文档产物提示必须给出完整模板：

```typescript
write_artifact({
  type: "document",
  title: "PRD",
  content: {
    format: "markdown",
    content: "# PRD\n\n## 1. 背景\n...\n\n## 2. 目标\n...\n\n## 3. 方案\n..."
  }
})
```

**返回值**：`{ artifactId, title, type }`。**不发布 `artifact.create` 事件**，由 Adapter 在 tool_result 后统一发，AgentRunner 接住后注入 `artifact_ref` part（见 Spec 02 的「artifact_ref 注入路径」）。

### deploy_artifact

源文件：`src/server/tools/deploy-artifact.ts`

**入参**：`{ artifactId: string }`

**作用域**：只能部署当前会话的 artifact。只有 `web_app` 返回 `status:'ready'`；缺失、非 web artifact 或不安全文件路径返回 `status:'failed'` 的部署记录，供 UI 显示失败原因。

**返回值**：`DeployStatusRecord`。无外部发布配置时，`previewPath` 指向稳定 `/deployments/:deploymentId`，记录带 `deploymentType:'local_static'`、`sourceDownloadPath`、`containerDownloadPath`、`summaryInstruction`。如果 `app_settings.deployment_publish_enabled=true` 且配置了 `deployment_publish_dir` / `deployment_public_base_url`，工具会把公开静态文件复制到 `<deployment_publish_dir>/<deploymentId>/`，并返回 `deploymentType:'external_static'`、`previewPath:<publicUrl>`、`publicUrl`、`publishPath`、`localPreviewPath`。Adapter 在 tool_result 后 emit `deploy.status`，AgentRunner 注入 `deploy_status` part。

**本地发布目录**：`src/server/deployment-service.ts` 把 `web_app` 写入 `.agenthub-data/deployments/dep_xxx/`，对外根目录保存可运行静态文件，私有 `.agenthub/source` 保存原始 source 供源码包下载。发布路由拒绝 `.agenthub` 私有目录与路径逃逸。

**外部静态发布目录**：`deployment_publish_dir` 必须是绝对路径且不能是文件系统根目录。发布时只删除 / 覆盖 `<publishDir>/<deploymentId>` 子目录，且复制公开文件时不会带上 `.agenthub` 私有目录。`deployment_public_base_url` 是用户已有静态服务的公开根 URL，AgentHub 只负责写文件，不启动托管服务。

### deploy_workspace

源文件：`src/server/tools/deploy-workspace.ts`

**入参**：`{ path: string, title?: string, entry?: string }`

**作用域**：只能部署当前会话 workspace effective cwd 内的目录。`path` 应指向已经构建好的静态输出目录，例如 `dist` / `build` / `out` / `client/dist` / `apps/web/dist`。工具只复制现有静态文件，不运行 `npm install`、`pnpm build`、dev server 或其它 build 命令；Agent 应先用 `bash` 完成构建并确认目录里有 HTML entry。

**校验与限制**：
- `path` 经过 `assertPathWithinWorkspace`，不能逃逸当前 workspace。
- source 必须是目录，默认 entry 为 `index.html`，`entry` 显式传入时也必须是 HTML 文件。
- 递归复制文件上限 2000 个 / 100 MB。
- 跳过隐藏目录（`.well-known` 除外）、`.agenthub`、`.git`、`node_modules`，避免把私有元数据、仓库历史或依赖目录发布出去。

**返回值**：`DeployStatusRecord`。成功记录带 `sourceType:'workspace'`、`workspacePath:<相对 effective cwd 的目录>`、`artifactId:'workspace:<workspacePath>'`、`version:0`。外部发布配置与 `deploy_artifact` 共用 `maybePublishExternally`，因此也可能返回 `deploymentType:'external_static'` 与 `publicUrl` / `localPreviewPath`。

**典型流程**：
1. `bash({ command: "pnpm build" })`
2. `fs_read({ path: "dist/index.html" })` 或等价检查确认输出存在
3. `deploy_workspace({ path: "dist", title: "前端构建预览" })`

不要把源码根目录、`src/`、server 目录或 `node_modules` 传给 `deploy_workspace`。如果项目只能通过后端服务运行，当前工具不等于完整应用托管；需要先产出静态目录，或后续实现服务型部署。

### 确定性部署命令

源文件：`src/server/deploy-command-service.ts`、`src/app/api/conversations/[id]/deploy/route.ts`

用户发送精确命令 `部署` / `发布` / `上线` / `/deploy` 时，`conversation-service.sendMessage` 在 responder 选择前拦截，不启动 AgentRun。命令优先作用于当前会话的 `web_app` artifacts；没有 artifact 候选时，再尝试常见 workspace 静态输出目录。

- 0 个 artifact 候选：按顺序查找 `dist` / `build` / `out` / `public` / `client/dist` / `client/build` / `client/out` / `apps/web/dist` / `apps/web/build` / `apps/web/out`，且目录必须包含 `index.html`。找到后复用 `deploy_workspace` 的会话级 helper 部署，并插入 `deploy_status` part。
- 没有 artifact 且没有 workspace 静态输出目录：插入 system text message，提示当前会话没有可部署网页产物，也没有常见本地静态输出目录。
- 1 个候选：复用 `deploy_artifact` 的会话级 helper 直接部署，并插入 `deploy_status` part。
- 多个候选：插入 `deploy_candidates` part，让用户在 UI 中选择。选择后由 `POST /api/conversations/:id/deploy { artifactId }` 部署并插入 `deploy_status` part。

命令可带明确 artifact id：`/deploy art_xxx` / `部署 art_xxx`。服务端仍校验 artifact 必须属于当前会话且是 `web_app`；缺失或类型错误通过 failed `DeployStatusRecord` 展示。

### read_artifact

源文件：`src/server/tools/read-artifact.ts`

**作用域**：只能读**当前会话**的 artifact（`WHERE conversation_id = ctx.conversationId`），防越权。

**返回值**：`{ id, type, title, content, version }`，content 是完整的 `ArtifactContent`（可能很大，调用方自行决定塞回 LLM 多少）。

### read_attachment

源文件：`src/server/tools/read-attachment.ts`

**与 read_artifact 的区分**：
- `att_` 前缀 → attachment（用户上传到文件库）
- `art_` 前缀 → artifact（agent 自己产出）
- 传错前缀时 handler 给友好提示，不静默失败

**按 MIME 分支**：
- 文本类（`text/*` / `application/json` / `application/xml` / `application/javascript` / `application/x-yaml`）：直接 `readFileSync(utf8)`，截断到 50,000 字符（防 prompt 爆炸）
- PDF（`application/pdf` / `.pdf` / `%PDF-` 文件头）：本地用 `pdf-parse` 懒抽取文本，返回 `content` / `pageCount` / `truncated`；扫描版或图片型 PDF 抽不到文本时返回 note，提示需要 OCR
- 图片：返回 metadata + note，告知 LLM 图片已通过 multimodal channel 投递（见 Spec 05 multimodal 部分）
- 其他二进制（docx / zip 等）：仅返回 metadata + note，不把原始二进制塞进 prompt

**容量**：`MAX_TEXT_CHARS = 50_000`。

### ask_user

源文件：`src/server/tools/ask-user.ts`、`src/server/pending-questions.ts`

**用途**：当 agent 继续执行前需要用户在有限方案中选择时，调用 `ask_user` 发起结构化问答。典型场景：需求范围、目标平台、设计风格、实现路线、破坏性操作、验收标准。开放式讨论、非关键细节，或 agent 能做出保守合理判断时，不应打断用户。

**参数**：

```typescript
{
  questions: Array<{
    question: string
    header: string
    options: Array<{
      label: string
      description?: string
      preview?: string
    }>
    multiSelect?: boolean
  }>
}
```

每次 1-4 个问题；每题 2-4 个选项。`header` 是短标签，`question` 是完整问题，`options[].description` 用来说明取舍。推荐方案应放在第一个选项，并在描述里解释原因。

**返回值**：`{ answers: Record<question, string> }`，其中 value 是用户选择的 label 列表与可选 freeform note 拼接后的文本。

**运行机制**：handler 注册 `PendingQuestion`，通过 SSE 推 `ask_user.pending`；桌面端 `AskUserQuestionDialog` 与移动端 pending question UI 都可以提交答案。答案提交后 `pendingQuestions.answer()` 唤醒工具调用并继续 agent run。

**装备与注入**：
- Custom agent 只有 `toolNames` 包含 `ask_user` 才能调用；内置 agents 与新建自定义 agent 默认装备。
- Claude Code / Codex adapter 通过 AgentHub MCP 暴露 `ask_user`，不依赖 `Agent.toolNames`。
- Orchestrator 计划阶段会强制注入 `ask_user`，用于关键歧义澄清；聚合阶段不带该工具，避免最终总结前再次打断用户。

### plan_tasks

源文件：`src/server/tools/plan-tasks.ts`

**特殊**：这是「输出端工具」—— handler 仅校验参数并返回 `{ acknowledged: true, taskCount }`，**真正的副作用（拆分子 run、DAG 调度）在 AgentRunner 里**（见 Spec 06）。

**参数**：
```typescript
{
  reasoning: string         // 拆分理由，3 句以内
  tasks: Array<{
    id: string              // 't1' / 't2' / 't3'...
    agentId: string         // 群里现有 agent id
    task: string            // 给该子 agent 的完整指令（自包含，子 agent 看不到群聊历史）
    dependsOn?: string[]    // 前置任务 id，省略 = 可立即开始
    expectedOutputs?: Array<{
      id: string            // 真实 artifact 输出的符号 key，不是 artifact id
      type: 'web_app' | 'document' | 'image' | 'ppt'
      required?: boolean    // 默认 true；用于标记交接意图，不直接决定任务状态
      description?: string
    }>
    inputs?: Array<{
      fromTaskId: string
      outputId: string
      required?: boolean    // 默认 true；required 输入缺失会让任务 skipped
      description?: string
    }>
    acceptanceCriteria?: string[] // 非产物型任务的完成条件提示
  }>
}
```

`expectedOutputs` 只用于真实 artifact 交接：下游要读、用户要预览、或任务本身要求写入可独立产物时才声明。审查、验证、诊断、状态检查、解释、总结等文字型任务不要为了“完成状态”声明 `expectedOutputs`；这类任务用 `acceptanceCriteria` 描述完成条件，并由 child agent 通过 `report_task_result.acceptanceResults` 逐项上报。

**装备约束**：只有 `isOrchestrator=true` 的 agent 才应装备 `plan_tasks`（service 层未强制，但前端 UI 不允许给非 Orchestrator agent 勾选）。

### report_task_result

源文件：`src/server/tools/report-task-result.ts`

**特殊**：这是「输出端工具」——handler 只校验并回传结构化结果，不写 DB、不写 workspace、不创建 artifact。AgentRunner 只在 Orchestrator 派发的子任务 run 中自动注入该工具；普通单聊 agent 不需要手动装备。

**参数**：

```typescript
{
  status: 'complete' | 'failed' | 'blocked'
  summary: string
  acceptanceResults?: Array<{
    criterion: string
    passed: boolean
    evidence: string
  }>
  blockers?: string[]
}
```

**语义**：
- 子任务结束前必须调用一次 `report_task_result`。普通文本回复不能单独证明任务成功。
- `status='complete'` 只表示该子任务真的完成、`acceptanceCriteria` 已逐项通过；不要因为产出了一条普通回复或一个 artifact 就自动标 complete。
- `status='failed'` 表示已尝试但未满足任务；`status='blocked'` 表示缺少外部输入 / 前置条件导致无法推进。
- 如果测试失败、实现不完整、有未解决错误、找不到必要文件 / 依赖，必须上报 `failed` 或 `blocked`，不能上报 `complete`。
- 当 plan 含 `acceptanceCriteria` 时，child agent 必须在 `acceptanceResults` 中复制每条 criterion 原文，并给出 `passed/evidence`。AgentRunner 缺项或发现 `passed=false` 时，把该任务判为 `failed`。
- 由于 `DispatchTaskStatus` 当前没有 `blocked`，`blocked` report 在 dispatch 层映射为 `failed`，错误原因保留 blocked summary / blockers；下游任务照常 skipped。

### fs_read

源文件：`src/server/tools/fs-read.ts`

读 workspace 内文本文件。

**参数**：`{ path: string }`，相对（基于 effective cwd）或绝对路径，resolve 后必须落在 effective cwd 子树内（`assertPathWithinWorkspace`，详见 `src/server/workspace-utils.ts`）。

**限制**：
- 文件大小上限 **1 MB**（`statSync.size > 1_048_576` 拒）
- 文本截断到 **50,000 字符**（同 `read_attachment` 风格）
- 仅 utf-8

**返回**：`{ path, absolutePath, cwd, size, content, truncated }`

### fs_write

源文件：`src/server/tools/fs-write.ts`

写 workspace 内文本文件。

**参数**：`{ path: string, content: string }`。路径同 `fs_read` 沙箱规则；父目录自动 `mkdir -p`。

**限制**：
- 单文件大小上限 **100 KB**（`Buffer.byteLength`）
- **sandbox 模式**额外检查 workspace 总量：累计 size > 100 MB 或文件数 > 1000 拒（递归扫 `rootPath`）
- **local 模式**跳过总量检查（用户自管理）

**返回**：`{ path, absolutePath, cwd, bytes, applied: 'auto' | 'review' }`。`applied` 标识用户审批路径还是直接写。

**冲突追踪**：写入成功后记录 `(runId, absolutePath, 内容 hash)`（`dispatch-file-writes.ts`），供 Orchestrator 检测同波次多个子 Agent 写同一文件（详见 Spec 06「代码冲突检测」）。bash / SDK adapter 自写盘不经 `fs_write`，是已知盲区。

#### fs_write 审批模式

人手编辑（FileTab 内自己改保存）**不走审批** —— 用户改自己的代码不需要审批自己。
**Agent** 调 `fs_write` 才走审批，由 `conversation.fsWriteApprovalMode` 决定：

- `'auto'`：直接写，工具立即返回 `applied: 'auto'`。适合反复改、信任度高的场景
- `'review'`（默认）：注册 PendingWrite，发 `fs_write.pending` SSE，前端弹 `PendingWriteApprovalDialog`
  显示 `react-diff-viewer-continued` 双栏 diff。用户决定后：
  - **应用** → handler 调 `writeFileInWorkspace` 真写盘，发 `fs_write.resolved { applied: true }`，工具返回 `applied: 'review'`
  - **拒绝** → 不写盘，发 `fs_write.resolved { applied: false }`，工具返回 `{ ok: false, error: 'User rejected the file change' }`
  - **run abort** → 静默取消（不发 SSE），工具返回 rejected

实现细节：
- `pendingWrites` 是模块级单例（HMR-safe via globalThis），见 `src/server/pending-writes.ts`
- handler 注册后 `await new Promise(resolve => pendingWrites.attachResolver(id, resolve))` 阻塞，直到 approve / reject / abort 触发 resolver
- pending 队列**纯内存**，dev server 重启即丢失。前端 `PendingWriteApprovalDialog` mount 时 `GET /api/conversations/[id]/pending-writes` 拉一次兜底（处理刷新场景）

切换模式：`PATCH /api/conversations/[id]` body `{ fsWriteApprovalMode: 'auto' | 'review' }`。Chat panel header 有 Shield/Zap 图标 toggle 按钮。

### bash

源文件：`src/server/tools/bash.ts`

在 workspace 内跑 shell 命令。

**参数**：`{ command: string }`。

**流程**：
1. 命中 `getBannedPatterns(currentPlatform())` 黑名单（POSIX / Windows 各一套，详见 Spec 11）→ 拒
2. 命中关键命令审批规则 → 注册 `PendingBashCommand`，发 `bash_command.pending` SSE，等待用户批准；拒绝则不执行命令并返回错误
3. `child_process.spawn(shell.cmd, shell.args(command), { cwd: getEffectiveCwd(workspace), windowsHide: true, detached: platform !== 'windows' })`
   - 跨平台 shell（详见 Spec 11 「Shell 选择」节）：
     - POSIX：优先用用户 `zsh` / `bash` login+interactive shell：`$SHELL -l -i -c <command>`；无法确认时回退 `sh -c <command>`
     - Windows：`powershell.exe -NoProfile -NonInteractive -Command "$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); <command>"`（用系统自带 PS 5.1，并强制 UTF-8 输出）
4. stdout + stderr 合并截断 **10000 字符**
5. **30s 超时**：进程清理走 `killProcessTree`
   - POSIX：创建独立进程组，`process.kill(-child.pid, 'SIGTERM')` 清理 shell 及其后台子进程
   - Windows：`taskkill /F /T /PID <pid>` 递归杀进程树（Node 的 SIGTERM 在 Windows 杀不到孙子进程）
6. `ctx.abortSignal` 触发同样的 `killProcessTree`
7. **不支持** stdin / 环境变量定制 / pty / TUI

**后台进程约束**：`bash` 是一次性命令工具，不是终端会话。Agent 不应通过裸 `server &` / `npm run dev &` 留长驻后台服务。若为了验证 API 临时启动服务，必须在同一个命令里保存 PID 并清理，例如：

```bash
npm run dev > /tmp/agenthub-dev.log 2>&1 &
pid=$!
trap 'kill $pid' EXIT
sleep 3
curl -s http://127.0.0.1:3000/health
```

如果 shell 退出后仍有后台进程继承 stdout/stderr，工具会在短暂宽限后清理同一进程组并返回，避免 run 卡死。真正需要长期运行、查看日志、停止/重启的 dev server 应由后续独立进程/终端视图管理，不塞进普通 `bash` tool。

**需要审批但不直接禁止的命令**：安装 / 变更依赖（`npm|pnpm|yarn|bun install/add/remove/update/ci`、`npx`、`pnpm dlx`、`pip install`、`uv sync` 等）、可能丢弃本地修改的 git 命令（`git reset` / `git clean` / 覆盖当前目录的 `git checkout|restore`）、批量删除（`rm -rf`、`find -delete`）、权限 / owner 变更（`chmod` / `chown`）、Docker 运行 / 构建 / 镜像 / 网络 / volume 相关命令，以及 Windows 上 `Remove-Item -Recurse/-Force`。这些命令没有命中黑名单时由用户决定是否放行。

**运行机制**：handler 注册 `PendingBashCommand`，通过 SSE 推 `bash_command.pending`；桌面端 `PendingBashCommandsPanel` 展示命令、cwd、Agent 与原因。用户批准 / 拒绝后 `pendingBashCommands.approve/reject()` 唤醒工具调用并发 `bash_command.resolved`；run abort 也会发 resolved 清掉 UI。pending 队列是进程内存单例，刷新页面时前端通过 `GET /api/conversations/[id]/pending-bash-commands` 兜底恢复。

**工具 description 按平台变体**（详见 Spec 11 「工具描述按平台变体」节）：description 字段在模块加载时根据 `currentPlatform()` 拼接，POSIX 展示用户 login shell 回退策略、POSIX 命令示例与 POSIX 黑名单文案，Windows 展示 PowerShell 示例与 Windows 黑名单文案。这是 LLM 选择命令语法的关键提示。

**返回**：`{ cwd, command, exitCode, output, truncated, timedOut }`

---

### load_skill

**用途**：渐进披露的按需加载——当 agent 装备的 Skill 较长、未内联进 system prompt 时，agent 调 `load_skill({ skillId })` 取完整方法正文。

**作用域（强约束）**：只能加载 agent 的**有效 Skill 集**（自选 `agent.skillIds` ∪ 公共池 `is_global_default`，见 spec 13 `resolveEffectiveSkills`）；集合之外的 id 一律拒绝（防模型传任意 id 越权读其它 Skill）。缺失 / 已停用返回 error。

**装备**：不由用户勾选——agent 选了 Skill 时**自动可用**（custom 走 toolRegistry，codex 走 MCP bridge）。claude-code 不用本工具，改用 SDK 原生 `Skill`（见 spec 13/05）。

### install_skill

**用途**：从公开 GitHub 链接安装 Skill 到当前 agent（SKILL.md raw/blob、skill 目录 tree、或仓库枚举候选）。

**装备**：**opt-in 额外能力**，默认不在任何工具预设，用户须在该 agent 上显式勾选；作为跨 adapter 的额外能力，SDK adapter 也通过 `toolNames` 保留（`filterSdkOptInTools`）。

**安全**：出站 fetch 经 `skill-fetch.ts` 的 SSRF 防御（https + GitHub 白名单 + DNS 解析 IP 校验 + 逐跳重定向校验 + 大小/超时/类型限制 + 不透传内部 token）；解析丢弃 `allowed-tools`（不扩权）；安装走审批门（pending + 用户确认）才落库 `source='imported'` 并绑定。完整契约见 spec 16 + CLAUDE.md §5.5。

**运行机制**：handler 注册 `PendingSkillInstall` → SSE `skill_install.pending` → `PendingSkillInstallsPanel` 批准/拒绝；批准 `pendingSkillInstalls.approve` 建 Skill + 绑定 agent。

---

## 工具调用生命周期

```
LLM 决定调用 →  Adapter emit  tool.call (StreamEvent)
                              │
                              ▼
                  AgentRunner 持久化为 tool_use part
                              │
                              ▼
   Adapter 自跑 ToolExecutor: toolRegistry.execute(name, args, ctx)
                              │
                              ▼
                  Adapter emit  tool.result (StreamEvent)
                              │
                              ▼
                  AgentRunner 持久化为 tool_result part
                              │
                  （前端把同 callId 的 tool_use + tool_result
                    合并为一个工具卡片，见 Spec 03 / 09）
```

**callId 串联**：`call_<nanoid>`，由 Adapter 在 tool.call 时分配，tool.result 必须带回相同 callId（用于前端合并 + LLM 的下一轮 turn）。

---

## 工具提示注入

AgentRunner 在构造 `AdapterInput.systemPrompt` 时会追加按可用工具生成的 `AgentHub 工具调用规范`。这段提示只注入当前 run 实际可用的工具，避免让 LLM 调用不存在的能力。

`write_artifact` 注入必须包含：
- 禁止 `write_artifact({})` 等空参数调用
- 调用前自检 `type` / `title` / `content` 必填字段是否齐全
- 至少一个完整 document 模板，避免模型只记住工具名却漏传必填字段

当 `workspace.mode === 'local'` 且 agent 具备 AgentHub 文件工具（`fs_read` / `fs_write` / `bash`）或 SDK 本地文件工具（Claude Code / Codex）时，会额外注入「本地项目模式」：

- 用户要求创建 / 修改 / 初始化 / 调试 / 构建前后端项目或源码文件时，优先直接操作 workspace 文件。
- Custom agent 使用 `fs_read` / `fs_write` / `bash`；SDK agent 使用各自内置 Read / Write / Edit / Bash / shell 工具。
- 不要用 `write_artifact` 保存应该落盘的源码、`package.json`、`tsconfig`、`server/`、`client/` 或构建配置。
- `write_artifact` 只用于用户明确要求 artifact / 可预览原型 / 独立 demo / 文档交接，或任务本身声明 artifact handoff。
- 本地代码改动完成后优先运行 install / typecheck / build / test 等验证命令；无法运行时说明原因。

如果当前是 local workspace 但 agent 没有文件/命令工具，提示会要求 agent 说明能力不足，而不是用 `write_artifact` 假装已经写入本地项目。

---

## 错误处理契约

| 场景 | handler 应该 | Registry 表现 | LLM 看到的 |
|---|---|---|---|
| args 不符合 schema | 返回 `{ ok: false, error }` | 透传 | tool_result.isError=true，error 文字 |
| 业务校验失败（如 artifact 不存在） | 返回 `{ ok: false, error }` | 透传 | 同上 |
| handler 内部 throw（不该发生） | — | catch 包成 `{ ok: false, error: err.message }` | 同上 |
| AbortSignal 触发 | handler 应尽早返回（行为不强制） | 透传 | 同上 |

**反模式**：不要在 handler 里 `throw new Error('failed')` 来表示业务错误，应当 `return { ok: false, error: ... }`。throw 用于真正的「不该发生」的内部异常。

---

## 新增工具步骤

> 详见 `skills/新增一个工具.md`（待写）。下面是 outline。

1. **决定工具是否需要**：三处重复后才提抽象（CLAUDE.md §4.3）
2. **新建文件** `src/server/tools/<my-tool>.ts`：
   ```typescript
   import { z } from 'zod'
   import type { ToolDef } from './types'
   
   const ArgsSchema = z.object({ ... })
   
   export const myTool: ToolDef = {
     name: 'my_tool',
     description: '...',
     parameters: { type: 'object', required: [...], properties: { ... } },
     async handler(args, ctx) {
       const parsed = ArgsSchema.safeParse(args)
       if (!parsed.success) return { ok: false, error: ... }
       // ...
       return { ok: true, value: ... }
     },
   }
   ```
3. **在 `registry.ts` 注册**：`reg.register(myTool)`
4. **决定哪些 agent 装备**：
   - 改 `src/db/seed.ts` 把工具加到对应 agent 的 `toolNames`（影响新种子）
   - 已存在的 agent 通过「编辑 Agent」对话框勾选（影响数据库现状）
   - 在 `src/components/create-agent-dialog.tsx` 的 `AVAILABLE_TOOLS` 数组加上工具名（UI 才能勾选）
5. **JSON Schema 注意点**：
   - 用 `type: 'object'` 而不是 `oneOf`（DeepSeek / OpenAI 对复杂 schema 兼容性差）
   - `description` 越具体越好，LLM 主要靠这个判断什么时候调用
   - 必填字段必须列入 `required`
6. **测试**：跑一个挂了该工具的 agent，验证调用 / 错误路径 / Abort

---

## 安全 / 沙箱约束

参考 CLAUDE.md §5。任何涉及文件系统 / 命令执行的工具必须：

- **路径解析后落在 `ctx.workspacePath` 子树内**（用 `path.resolve` + `startsWith` 检查）
- **bash cwd 强制为 `ctx.workspacePath`**
- **bash 命令前匹配双平台黑名单**（详见 Spec 11；POSIX：rm -rf /、sudo、fork bomb、curl pipe shell 等；Windows：Remove-Item -Recurse -Force、format、shutdown、iex(iwr ...)、reg delete 等）
- **不引入新依赖而不在 PR 中说明**（CLAUDE.md §4.3）

**`getBannedPatterns(platform)` 跨 adapter / 工具共享**：定义在 `src/server/security.ts`，由 `findBannedPattern(command, platform?)` 暴露（platform 省略时取 `currentPlatform()`）。`bash` 工具和 `ClaudeCodeAdapter`（用 SDK Bash 工具时）都走同一份名单，新增模式同步 Spec 11 「命令黑名单」节并只改 `security.ts` 这一处。

**TODO 工具（CLAUDE.md 提到但仍未实装）**：

- `web_fetch` —— 抓取 URL 内容（SSRF 防护：禁止 localhost / 内网 IP / file://）

**bash / fs_read / fs_write 已实装**（详见上方各自小节）。

新人不要以为未实装的工具已经存在；要么先实现，要么按 Spec 07 §「新增工具步骤」走。

---

## Claude Code agent 的工具集（不走 AgentHub 工具表）

`adapterName === 'claude-code'` 的 agent 不消费上面的「内置工具清单」。它通过 Claude Agent SDK 直接使用 SDK preset 工具集：`Bash` / `Read` / `Write` / `Edit` / `Grep` / `Glob` / `WebFetch` / `WebSearch` / `Task` / `TodoWrite` / `NotebookEdit` / `Mcp` 等（命名为 PascalCase，与 AgentHub 的 snake_case 区分）。

**审批 / 沙箱 / 黑名单仍由 AgentHub 接管**，但接缝在 adapter 的 `canUseTool` 钩子（详见 Spec 05 「ClaudeCodeAdapter / canUseTool 桥」一节）：

- 路径检查走 `assertPathWithinWorkspace`（共享）
- Bash 黑名单走 `findBannedPattern`（共享）
- `fs_write` 审批走同一个 `pendingWrites` store —— 但 `register` 传 `skipWrite: true`，approve 后由 SDK 自己写盘（不调 `writeFileInWorkspace`）。前端 UI（`PendingWritesPanel` / `PendingWriteDiffTab`）对这两条路径完全无感

**副作用**：sandbox 模式 quota（`SANDBOX_TOTAL_BYTES` / `SANDBOX_TOTAL_FILES`）对 Claude Code agent 失效（SDK 自己写盘绕过 quota 检查）。Claude Code agent 实际场景都是 `workspace.mode === 'local'`（绑真实项目），quota 不适用，可接受。

**AgentHub MCP 工具**：Claude Code adapter 通过 SDK in-process MCP server 暴露 `write_artifact` / `read_artifact` / `deploy_artifact` / `deploy_workspace` / `ask_user` / `report_task_result`，以及 opt-in 的 `install_skill`（仅当 agent 勾选时经 `filterAgentHubMcpToolsForRun` 暴露）。Skill 渐进披露走 SDK 原生 `Skill`（不暴露 `load_skill`）。其中 `write_artifact` 的结果会被 adapter 翻译为 `artifact.create`，`deploy_artifact` / `deploy_workspace` 的结果会被翻译为 `deploy.status`。

---

## Codex agent 的工具集（不走 AgentHub 工具表）

`adapterName === 'codex'` 的 agent 不消费上面的「内置工具清单」。它通过 `@openai/codex-sdk` 暴露 Codex 自身的本地命令、文件变更、MCP、web search、todo/plan 等事件。

AgentHub 额外给 Codex 注入一个 stdio MCP bridge，只暴露 allowlist：`write_artifact` / `read_artifact` / `deploy_artifact` / `deploy_workspace` / `ask_user` / `report_task_result`，以及 `load_skill`（agent 选了 Skill 时自动可用）和 opt-in 的 `install_skill`（仅当 agent 勾选、经 `AGENTHUB_ENABLE_INSTALL_SKILL` env 标志时注册）。bridge 通过受保护的内部 API（`/api/internal/agenthub-tools` 的 `EXPOSED_TOOLS`）调用 `toolRegistry`，不会把 `bash` / `fs_write` 等 AgentHub 工具开放给 Codex。

**审批策略**：当前 Codex TypeScript SDK 没有 Claude `canUseTool` 等价 hook。AgentHub 因此不在 Review 模式下开放自动写盘：

- Review 模式：`sandboxMode='read-only'`
- Auto 模式：`sandboxMode='workspace-write'`
- 所有模式：`approvalPolicy='never'`、`networkAccessEnabled=false`、`webSearchMode='disabled'`
- 运行时：使用 AgentHub 隔离的 `CODEX_HOME=<dataDir>/codex-home`，不读取用户本机 `~/.codex` 配置 / 登录态

后续若 SDK 暴露 patch / exec approval hook，再桥到 `pendingWrites`、`assertPathWithinWorkspace` 和 `findBannedPattern`。

---

## 与 Spec 01 / 05 / 06 的关系

- Spec 01：定义了 `Agent.toolNames`（引用本 spec 的工具名；Claude Code / Codex agent 强制 `[]`）
- Spec 05：定义了 `AdapterInput.toolNames`（同上）；说明 Custom / Claude Code / Codex 路径如何分别使用工具
- Spec 06：`plan_tasks` 工具是 Orchestrator 三阶段工作流的核心

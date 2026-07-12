# Spec 16 — 会话内安装 Skill（`install_skill`，设计提案）

> 让 Agent 在对话里接收一个链接（GitHub 仓库/目录/`SKILL.md`），fetch 回来解析成方法论，经**用户审批**后安装为该 Agent 的 Skill。类似「给 Claude Code 发一个 skills 仓库链接，它帮你装上」。
>
> **状态：设计提案，未实现（Phase 2 完善 · 2D）。** 本特性新增**出站网络能力**并触及安全约束（CLAUDE.md §5 / §6.2），**实现前必须先评审本 spec**。
>
> 与 2A/2B/2C 的区别：前三块全是本地、无网络、不碰安全约束；2D 是唯一引入「服务端按 LLM 选择的 URL 发起出站请求」的一块——这是本特性最大的风险面。

源文件（待建）：`src/server/skill-fetch.ts`（SSRF 安全 fetch + GitHub 解析）· `src/server/tools/install-skill.ts`（工具）· `src/server/pending-skill-installs.ts`（审批中转）· 改 `src/shared/agent-builder-config.ts`（`install_skill` 加入 `AVAILABLE_AGENT_TOOLS`）· UI 审批面板

---

## 1. 现状与动机

- 2A/2B：用户可在 Skills 库**手动**新建 / 导入（粘贴 SKILL.md / 文本 / 上传 / JSON）。
- 缺口：用户想「把网上某个 skill 仓库直接装给这个 agent」时，仍要手动复制粘贴。
- 2D 动机：让 agent 在对话里凭一个链接自助安装 skill，承接生态里大量现成的 Claude Agent Skills。

**关键差异（写进文档，对齐用户预期）**：Claude Code 把 skill 装进 `.claude/skills/` 文件夹；**AgentHub 的 skill 统一存 DB**（`skills` 表，`source='imported'`），claude-code 运行时再由 2C.5 物化成临时 `SKILL.md`。`install_skill` 不在用户磁盘留 `.skills` 目录。

---

## 2. 目标 / 非目标

**目标**
- 新增 opt-in 工具 `install_skill`，输入一个链接，fetch → 解析 → **用户审批** → 落库（`source='imported'`）+ 绑定到当前 agent。
- 出站 fetch 有明确的 **SSRF 防御**（这是本特性的安全核心）。
- 安装前**人审**：用户看到来源 URL + 解析出的 name/description/instruction 后才落库。
- 复用 2B 的 `parseSkillMarkdown` 解析，复用「不扩权」铁律（丢 `allowed-tools`）。

**非目标（首版）**
- 不支持私有仓库 / 鉴权 fetch（只取公开 raw 内容）。
- 不**批量自动安装**多个 skill；bare 仓库支持**枚举候选**（列出仓库内 `SKILL.md`），但每个 skill 仍需用具体链接逐个安装 + 逐个审批。
- 不执行 skill 捆绑的脚本 / 资源文件（只取 `SKILL.md` 文本，与 2C 一致）。
- 不做 skill 自动更新 / 订阅源。

---

## 3. 用户流程

```
对话中：用户/模型给出链接 → 模型调用 install_skill({ url })
  → 服务端 SSRF 安全 fetch（§5）拉取 SKILL.md
  → parseSkillMarkdown 解析（丢 allowed-tools）
  → 注册「待安装 skill」审批（§7），工具阻塞等待
  → 前端弹审批卡：展示 最终 URL + name/description/instruction 预览 + 目标 agent
      ├─ 用户批准 → createSkill(source='imported', sourceUri) + 把 skillId 追加进 agent.skillIds → 工具返回安装摘要
      └─ 用户拒绝 / 超时 / 中止 → 工具返回「未安装」，不落库、不绑定
```

下一轮该 agent run 时，安装的 skill 经 2C 注入（custom/codex 文本+load_skill；claude-code 物化 SKILL.md）。

---

## 4. 数据模型

- `skills` 表新增 `source_uri TEXT`（可空）：记录导入来源 URL，供审计/溯源（手动导入时为 null）。落 `source='imported'`。
- 绑定：安装成功后把新 `skillId` 追加进 `agents.skill_ids`（解析 `ctx.agentId` 对应行）。
- 不新增其它表。审批中转用内存 store（同 `pending-writes`），不落库。

> 决策点 D3（见 §11）：是否加 `source_uri` 列。推荐加（审计价值高、成本低）。

---

## 5. 安全模型（核心 · SSRF 防御）

`install_skill` 让**服务端**对一个**由 LLM 决定的 URL** 发起出站请求。即便 AgentHub 是本地单用户，这仍是经典 SSRF 面：模型可能被提示注入（来自读到的 artifact / 附件 / 网页内容）诱导去访问内网、云元数据（`169.254.169.254`）、本机其它服务（含 AgentHub 自己的内部工具端点）。**审批门在 fetch 之后**，只能防「装入坏内容」，**防不住请求本身**——所以 SSRF 必须在 fetch 层拦死。

`src/server/skill-fetch.ts` 作为**单一数据源**实现以下策略（任何放宽必须在 PR 说明，对齐 §5 黑名单的「单文档单数据源」原则）：

1. **协议白名单**：仅 `https`。拒绝 `http` / `file` / `ftp` / `data` / 无 scheme。
2. **主机白名单（首版默认，已定 D1）**：仅允许 GitHub 公共来源 —— `raw.githubusercontent.com`、`github.com`、`gist.githubusercontent.com`、`gist.github.com`，以及 `api.github.com`（仅用于 bare 仓库枚举 §6）。其它主机一律拒绝。这是最贴合「skills 仓库链接」用例、且最安全的默认；放开到任意公网主机留后续。
3. **DNS 解析后校验 IP（防 DNS rebinding / 主机名绕过）**：解析目标主机到 IP，**拒绝**解析结果落在：
   - 回环 `127.0.0.0/8`、`::1`
   - 链路本地 `169.254.0.0/16`（含云元数据 `169.254.169.254`）、`fe80::/10`
   - 私有 `10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、唯一本地 `fc00::/7`
   - `0.0.0.0/8`、保留 / 多播 / 广播
   - 即便主机在白名单内，也要校验解析 IP（白名单 + IP 校验是 AND，不是 OR）。
4. **重定向**：手动跟随、**每一跳都重新做白名单 + IP 校验**（防重定向到内网绕过）；最多 3 跳；跨主机重定向到非白名单 → 拒绝。
5. **大小上限**：响应体 ≤ 256 KB，超出立即中止（防内存 / DoS）。
6. **超时**：连接 + 读取总超时 ≤ 10s。
7. **Content-Type 白名单**：`text/markdown` / `text/plain` / `application/octet-stream`（GitHub raw 常返 plain）/ `application/json`；`text/html` / 二进制 → 拒绝。
8. **方法 / 凭据**：仅 `GET`；不带 cookie / Authorization；**绝不**透传 AgentHub 内部 token（`AGENTHUB_INTERNAL_TOOL_TOKEN`）或任何环境密钥。
9. **失败隔离**：以上任一拦截 / 网络错误 → 工具返回清晰 `isError`，**不崩 run**。

> 注：这套 fetch 策略与 spec 15 外部 MCP 的「沙箱外信任」不同——MCP 是用户登记的可信进程；这里是 LLM 选 URL 的出站请求，**默认更收紧**（白名单 + IP 校验 + 审批）。

**不扩权（铁律，与 2B/2C 一致）**：解析只取 `name/description/instruction`，丢弃 frontmatter 的 `allowed-tools` 及任何工具/权限声明。安装的 skill 仍只注入文本，永不改变 agent 的工具权限。

**opt-in 两道**：① `install_skill` 默认**不在**任何工具预设里，用户须在该 agent 上显式勾选；② 每次安装都过审批门。默认不开 = 默认无出站能力。

---

## 6. URL 解析（GitHub 形态 → raw SKILL.md）

`skill-fetch.ts` 把支持的 GitHub 链接规范化到 raw：

| 输入形态 | 解析 |
|---|---|
| `raw.githubusercontent.com/<o>/<r>/<ref>/<path>/SKILL.md` | 直接用 |
| `github.com/<o>/<r>/blob/<ref>/<path>/SKILL.md` | → 对应 raw URL |
| `github.com/<o>/<r>/tree/<ref>/<path>`（skill 目录） | → `<path>/SKILL.md` 的 raw URL |
| `gist.github.com/<id>` | → gist raw（取首个 `*.md`） |
| `github.com/<o>/<r>`（bare 仓库） | **枚举模式**：经 `api.github.com` trees API 列出仓库内所有 `**/SKILL.md` → 工具返回候选列表（path + 所在目录名），**不安装、不审批**；用户/模型再用某个具体 SKILL.md/目录链接调一次 `install_skill` 走正常 fetch+审批安装 |

> 已定 D2：bare 仓库做**枚举候选**（非拒绝）。枚举只读 trees API（公开仓库免鉴权），返回候选路径；安装仍是「逐个具体链接 + 逐个审批」，不批量自动装。枚举请求同样走 §5 全部校验（`api.github.com` 在白名单，返回 JSON 在 content-type 白名单内，受大小/超时约束）。

规范化后仍走 §5 全部校验（白名单 / IP / 大小 / 类型）。

---

## 7. 审批门（人审 · 复用 pending 机制）

仿 `fs_write` 的 `pendingWrites`：
- `install_skill` fetch+解析后，注册一条「待安装 skill」到 `pendingSkillInstalls`（内存 store，按 conversationId 分桶），经 EventBus 推 SSE 给前端，**工具阻塞**等待用户决定（带 AbortSignal）。
- 审批卡（新 UI 面板，仿 `PendingWritesPanel`）展示：**最终 fetch 的 URL**（经重定向后的真实地址）、解析出的 name / description / instruction 预览（可滚动）、目标 agent 名、「这是导入的外部内容，将注入该 Agent 上下文」提示。
- **批准** → `createSkill({ source:'imported', sourceUri })` + 把 skillId 追加进 `agent.skillIds` → 工具返回 `{ installed:true, skillId, name }`。
- **拒绝 / 超时 / run 中止** → 不落库、不绑定，工具返回 `{ installed:false, reason }`。
- 审批粒度：**每次安装一审**（不做「本会话信任此源免审」，因为每个链接内容不同）。

---

## 8. 工具契约（`install_skill`）

```
name: install_skill        // 加入 AVAILABLE_AGENT_TOOLS，默认不在任何预设；用户显式勾选
description: 从一个公开 GitHub SKILL.md 链接安装一个 Skill 到当前 Agent（需用户审批）。仅支持 GitHub 公开链接。
parameters: {
  url: string              // GitHub 仓库目录 / blob / raw / gist 链接
}
```

- 事件：复用现有 `tool.call` / `tool.result`（spec 02）+ 一条审批相关 SSE（仿 `fs_write.pending`）。**不新增破坏前端 reducer 的事件类型**。
- 暴露：custom 经 toolRegistry；codex 经 agenthub MCP bridge（`scripts/agenthub-codex-mcp.mjs` + 内部端点 `EXPOSED_TOOLS`）；claude-code 经 in-process SDK MCP（与 write_artifact 等同列）。三处都受 opt-in（用户勾选）约束。
- 返回结构化结果（installed / skillId / name / reason），由 adapter 包成 tool result。

---

## 9. 失败 / 中止

- fetch 被 §5 任一规则拦截、网络错误、解析失败（无有效 name/instruction）→ `isError`，明确原因，run 继续。
- 审批拒绝 / 超时 / `AbortSignal` 触发 → 未安装，工具返回，run 不崩。
- 安装成功但绑定写库失败 → 回滚（不留半截 skill）。

---

## 10. 影响面 / 需同步的 spec（实现时）

- **CLAUDE.md §5** — 新增「§5.5 外部 Skill 安装信任模型」：出站 fetch 白名单 + IP 校验 + 审批门 + 不扩权（**改安全约束，需讨论**）。
- `specs/07-tools` — 新增 `install_skill` 工具签名 + opt-in 约束。
- `specs/08-db-schema` — `skills.source_uri` 列（若 D3 采纳）。
- `specs/09-frontend-architecture` — 待安装 skill 审批面板。
- `specs/11-platform` — 出站 fetch 策略作为契约（单一数据源 `skill-fetch.ts`，类比命令黑名单）。
- `specs/10-agent-builder` / `src/shared/agent-builder-config.ts` — `install_skill` 进 `AVAILABLE_AGENT_TOOLS`（默认不勾）。

---

## 11. 决策记录（已评审拍板 2026-06-19）

- **D1 fetch 主机范围** → **仅 GitHub 主机白名单**（`raw.githubusercontent.com` / `github.com` / `gist*` / `api.github.com`）+ IP 校验兜底；不放开任意公网主机。
- **D2 bare 仓库** → **枚举候选**：经 trees API 列出 `SKILL.md` 候选返回，不批量自动装；安装仍逐个具体链接 + 逐个审批。
- **D3 溯源列** → **加 `skills.source_uri`**，记录导入来源。
- **D4 审批粒度** → **每次安装一审**（不做按源免审）。
- **D5 adapter 暴露** → **三 adapter 全接**（custom / codex / claude-code），均受 opt-in + 审批统一闸门。

---

## 12. 分期建议

| 阶段 | 内容 |
|---|---|
| **2D-a** | `skill-fetch.ts`（SSRF 安全 fetch + GitHub 解析 + bare 仓库 trees 枚举）+ 单测（白名单 / IP 拦截 / 重定向 / 大小 / 类型 / 枚举解析，纯函数为主）。**先评审本 spec 再开工。** |
| **2D-b** | `install_skill` 工具 + `pendingSkillInstalls` 审批 store + 审批 UI 面板；custom 接入。 |
| **2D-c** | codex（MCP bridge）+ claude-code（in-process MCP）暴露；`AVAILABLE_AGENT_TOOLS` 加入（默认不勾）。 |
| **2D-d** | CLAUDE.md §5.5 + 各 spec 同步；端到端冒烟（含 SSRF 拦截用例）。 |

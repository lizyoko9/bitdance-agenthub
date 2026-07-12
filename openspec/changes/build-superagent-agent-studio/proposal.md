## Why

当前 Agent 创建能力已经从纯表单扩展到了“对话生成草稿”，但入口仍然更像一个配置弹窗。随着用户希望在创建 Agent 时配置 Skills、RAG 知识库、MCP 连接、工具权限和模板能力，继续堆叠表单会让创建体验变重，也会让领域专业化能力难以被理解和复用。

SuperAgent 方向需要把“创建 Agent”升级为一个独立的 Agent Studio：用户可以从模板市场直接选择现有 Agent，也可以从零组装模型、提示词、Skills、知识库、MCP 和权限策略。模板负责沉淀最佳实践，Skills 负责方法论，RAG 负责领域知识，MCP 负责外部系统连接，最终生成用户自己的 Agent 实例。

## What Changes

- 新增独立的 Agent 创建页面，建议路由为 `/agents/new`，用于承载模板市场、自定义创建和能力预览。
- 将现有“创建 Agent”入口从直接打开表单调整为进入 Agent Studio；编辑已有 Agent 可以继续使用现有详细配置能力，后续再决定是否迁移到编辑页。
- 新增 Agent 模板市场概念，模板作为可复用蓝图，不等同于用户实际创建出的 Agent。
- 支持从模板生成可编辑草稿，用户补齐 API key、模型、知识库、MCP 凭证等依赖后再保存。
- 新增 Skills、Knowledge Base、MCP Server 三类专业能力配置，并在 Agent 创建过程中展示能力预览和风险提示。
- 建立运行时装配规则：系统提示词 + Skills + RAG 检索结果 + MCP/工具说明 + 对话上下文共同组成 Agent 输入。
- 分期落地，先做独立页面和模板市场，再做 Skills/RAG/MCP 的数据模型和运行时集成。

## Capabilities

### New Capabilities

- `agent-builder`: Agent Studio、模板市场、模板生成草稿、专业能力配置和创建前预览。

### Modified Capabilities

- `persistence`: 新增模板、Skills、知识库、文档分块、MCP server 以及 Agent 关联字段。
- `tools`: 新增知识库检索工具和 MCP 工具命名约束，区分 Skill 与 Tool。
- `conversation-context`: 新增专业能力上下文装配顺序和 token 预算策略。
- `adapters`: AgentRunner 需要把专业能力配置传入不同 adapter，并按 adapter 能力接入 MCP/工具。

## Impact

- `src/app` / `src/components`: 新增 Agent Studio 独立页面、模板市场、模板预览、自定义创建流程、能力依赖检查和预览。
- `src/shared`: 新增模板、Skill、知识库、MCP 相关共享类型和校验 schema。
- `src/db/schema.ts`: 后续需要新增模板、skills、knowledge bases、documents、chunks、mcp servers 以及 agent 关联字段或关联表。
- `src/server/agent-service.ts` / `src/app/api/agents`: 创建 Agent 时需要支持模板来源、能力配置和快照语义。
- `src/server/agent-runner.ts`: 运行时需要组合 system prompt、Skills、RAG、工具指导和 MCP 配置。
- `src/server/tools`: 后续新增 `search_knowledge`、`read_knowledge_doc` 等知识库工具。
- `src/server/mcp`: 后续实现外部 MCP server 管理和 adapter 接线，沿用 `specs/15-external-mcp.md` 的安全模型。
- `openspec/specs/*` 与 `specs/*`: 后续实现每个阶段时同步更新对应规格。

## Out Of Scope For First Implementation

- 不在第一阶段实现完整向量数据库或复杂语义召回。
- 不在第一阶段实现模板社区发布、评分、审核和商业化。
- 不在第一阶段实现 custom adapter 的完整外部 MCP client；优先沿用现有外部 MCP 设计中的分期策略。
- 不在第一阶段引入新的托管数据库、云服务或 OS keychain。

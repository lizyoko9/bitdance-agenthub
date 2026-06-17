import {
  AbortError,
  createSdkMcpServer,
  query,
  tool,
  type Options,
} from '@anthropic-ai/claude-agent-sdk'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { classifyBashApproval, waitForBashApproval } from '@/server/bash-command-approval'
import { db, schema } from '@/db/client'
import type { WorkspaceRow } from '@/db/schema'
import { readIfExists } from '@/server/fs-service'
import { newMessageId, newToolCallId } from '@/server/ids'
import { pendingWrites } from '@/server/pending-writes'
import { currentPlatform } from '@/server/platform'
import { findBannedPattern } from '@/server/security'
import { REPORT_TASK_RESULT_TOOL_NAME } from '@/server/task-result-report'
import { toolRegistry } from '@/server/tools/registry'
import type { ToolContext } from '@/server/tools/types'
import { assertPathWithinWorkspace, getEffectiveCwd } from '@/server/workspace-utils'
import type { DeployStatusRecord, StreamEvent } from '@/shared/types'

import { buildChildProcessEnv, createAdapterEvent } from './adapter-utils'
import { claudeCodeSessions } from './session-store'
import type { AdapterInput, AgentPlatformAdapter } from './types'

/**
 * ClaudeCodeAdapter —— 使用 `@anthropic-ai/claude-agent-sdk`，复用 Claude Code 一整套能力：
 *  - 内置工具集（Bash / Read / Write / Edit / Grep / Glob / WebFetch / WebSearch / Task / TodoWrite…）
 *  - 子 agent (Task) 嵌套调度
 *  - 自动 agent loop（多轮思考 + 工具调用，无需我们手写）
 *
 * 桥接策略：
 *  - 路径沙箱、Bash 黑名单、fs_write 审批都在 `canUseTool` 里拦截
 *  - 用户应用 Edit/Write 后由 SDK 自己写盘（pendingWrites.register 传 skipWrite: true）
 *  - 事件流翻译：SDK 的 SDKMessage → 我们的 StreamEvent (message.start/end + part.* + tool.*)
 *
 * 详见 specs/05-adapter-interface.md「ClaudeCodeAdapter」一节。
 */

/**
 * 每个 conversation 的 SDK session_id 缓存。SDK 默认每次 query() 是新 session，
 * 不传 resume 时下一轮 agent 不会记得上一轮内容。我们把 init system message 里的
 * session_id 缓存起来，下次同 conversation 再 query 时传 resume = sessionId。
 *
 * HMR-safe singleton。dev server 重启会丢失 —— 但 SDK 本身持久化到磁盘 (~/.claude
 * sessions)，所以即使我们丢了 id，SDK 数据还在；只是接下来的会话变成新 session。
 */
const DEFAULT_MODEL = 'claude-opus-4-7'
/** SDK 内置工具中会改文件的，需要走审批 */
const FS_WRITE_TOOLS = new Set(['Write', 'Edit'])
/** 需要路径沙箱检查的工具（Bash 单独走黑名单 + cwd 限定） */
const PATH_TOOLS = new Set(['Read', 'Write', 'Edit', 'NotebookEdit'])

type CanUseToolFn = NonNullable<Options['canUseTool']>
type PermissionResult = Awaited<ReturnType<CanUseToolFn>>

export class ClaudeCodeAdapter implements AgentPlatformAdapter {
  readonly name = 'claude-code' as const

  async *stream(input: AdapterInput, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const messageId = newMessageId()
    const baseEvent = createAdapterEvent(input.conversationId)

    yield baseEvent({
      type: 'message.start' as const,
      messageId,
      agentId: input.agentId,
      runId: input.runId,
    }) as StreamEvent

    // 取 workspace + 审批模式（用于 canUseTool）
    const workspace = await db.query.workspaces.findFirst({
      where: eq(schema.workspaces.conversationId, input.conversationId),
    })
    if (!workspace) {
      throw new Error(`Workspace not found for conversation ${input.conversationId}`)
    }
    const conv = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, input.conversationId),
    })
    const approvalMode = conv?.fsWriteApprovalMode ?? 'review'

    const controller = new AbortController()
    const onAbort = () => controller.abort()
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })

    // 翻译状态
    let nextPartIndex = 0
    let activeTextPartIndex = -1 // -1 表示当前没有开放的 text part
    const toolCallIdByUseId = new Map<string, string>()
    // 同步记录 tool name —— 让 tool_result 阶段能判断「这个结果是 write_artifact 来的，要 yield artifact.create」
    const toolNameByUseId = new Map<string, string>()

    const toolCtx: ToolContext = {
      conversationId: input.conversationId,
      workspacePath: getEffectiveCwd(workspace),
      agentId: input.agentId,
      runId: input.runId,
      abortSignal: signal,
    }
    const agenthubMcpServer = createSdkMcpServer({
      name: 'agenthub',
      version: '1.0.0',
      instructions: '内置 AgentHub 工具：用 write_artifact 创建可预览产物（网页 / 文档 / 图片 / PPT / Mermaid 图），流程、架构、时序、依赖关系优先用 type="diagram" 且 content 为 { syntax: "mermaid", source }；Mermaid 图会在写入时做预检，中文/数学/括号等 label 写成 A["..."]，不要传 ```mermaid fence，若工具返回 Invalid Mermaid diagram 必须修正 source 后重试；PPT 优先使用 semantic blocks（heading、paragraph、bullets、metric、quote、timeline、columns、callout、divider、spacer），不要在 PPT JSON 中嵌入 base64/data URI 大资产；用 read_artifact 读其他 Agent 的产物，用 fs_list 查看 AgentHub workspace 目录，用 deploy_artifact 为 web_app artifact 生成本地预览路径，用 deploy_workspace 为当前 workspace 内 dist/build/out 等静态目录生成部署卡。需要用户在有限方案中选择时，用 ask_user 发起结构化问答，不要只在普通文本里提问。被分派为子任务时，结束前必须调用 report_task_result 上报真实任务结果。部署工具返回的 previewPath 是当前 AgentHub 实例下的相对路径；不要把它改写成公网域名或自造完整 URL，面向用户时让用户点击部署卡片按钮或原样引用 previewPath。',
      tools: [
        tool(
          'write_artifact',
          'Create a previewable artifact (web_app / document / image / ppt / diagram) in the current conversation, or a new version of an existing one (pass parentArtifactId; version auto-increments). For diagram, pass content { syntax: "mermaid", source: "flowchart TD..." }; quote labels containing Chinese/math/symbols as A["..."], omit Markdown fences, and retry with corrected source if validation returns Invalid Mermaid diagram. For ppt, prefer structured slides with semantic blocks: heading, paragraph, bullets, metric, quote, timeline, columns, callout, divider, spacer. Do not embed raw base64/data URI assets in ppt JSON. Use outputKey when a dispatched task declares an expected output id. Use this for content that should be previewed in a card — NOT for files in the workspace.',
          {
            type: z.enum(['web_app', 'document', 'image', 'ppt', 'diagram']),
            title: z.string(),
            content: z.unknown(),
            outputKey: z.string().optional(),
            parentArtifactId: z.string().optional(),
          },
          async (args) => {
            const result = await toolRegistry.execute('write_artifact', args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            // 不在这里 publish artifact.create —— 由 adapter 主循环检测到对应 tool_result 时
            // 从 generator yield 出去，让 AgentRunner.consumeStream 触发 artifact_ref 注入。
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result.value) }],
            }
          },
        ),
        tool(
          'read_artifact',
          'Read the full content of an existing artifact in the current conversation by id.',
          { artifactId: z.string() },
          async (args) => {
            const result = await toolRegistry.execute('read_artifact', args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            return {
              content: [
                {
                  type: 'text' as const,
                  text:
                    typeof result.value === 'string'
                      ? result.value
                      : JSON.stringify(result.value),
                },
              ],
            }
          },
        ),
        tool(
          'fs_list',
          'List files and directories inside the current AgentHub workspace. Prefer this before reading files when exploring project structure.',
          { path: z.string().optional() },
          async (args) => {
            const result = await toolRegistry.execute('fs_list', args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result.value) }],
            }
          },
        ),
        tool(
          'deploy_artifact',
          'Create a ready local preview deployment for a web_app artifact. The returned previewPath is a relative path for the current AgentHub instance; do not invent or print a public hostname. Use this after write_artifact when the user should receive a deployment card with open/copy/download actions.',
          { artifactId: z.string() },
          async (args) => {
            const result = await toolRegistry.execute('deploy_artifact', args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result.value) }],
            }
          },
        ),
        tool(
          'deploy_workspace',
          'Create a deployment card from an existing static output directory inside the current workspace, such as dist, build, out, or client/dist. Use this after building a local project. It copies files only; it does not run build commands.',
          {
            path: z.string(),
            title: z.string().optional(),
            entry: z.string().optional(),
          },
          async (args) => {
            const result = await toolRegistry.execute('deploy_workspace', args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result.value) }],
            }
          },
        ),
        tool(
          REPORT_TASK_RESULT_TOOL_NAME,
          'Report the final semantic outcome of the current AgentHub sub-task. Call exactly once at the end of a dispatched child task. Use complete only when the assigned task is fully accomplished and every acceptance criterion passed; never report complete for partial work, failing tests, unresolved errors, or missing files/dependencies.',
          {
            status: z.enum(['complete', 'failed', 'blocked']),
            summary: z.string(),
            acceptanceResults: z
              .array(
                z.object({
                  criterion: z.string(),
                  passed: z.boolean(),
                  evidence: z.string(),
                }),
              )
              .optional(),
            filesChanged: z
              .array(
                z.object({
                  path: z.string(),
                  action: z.enum(['created', 'modified', 'deleted', 'verified']).optional(),
                }),
              )
              .optional(),
            commandsRun: z
              .array(
                z.object({
                  command: z.string(),
                  exitCode: z.number().int().nullable(),
                  cwd: z.string().optional(),
                  timedOut: z.boolean().optional(),
                  summary: z.string().optional(),
                }),
              )
              .optional(),
            tests: z
              .array(
                z.object({
                  command: z.string(),
                  passed: z.boolean(),
                  summary: z.string().optional(),
                }),
              )
              .optional(),
            blockers: z.array(z.string()).optional(),
          },
          async (args) => {
            const result = await toolRegistry.execute(REPORT_TASK_RESULT_TOOL_NAME, args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result.value) }],
            }
          },
        ),
        tool(
          'plan_tasks',
          'Decompose the user request into sub-tasks and dispatch them to other agents in this group. Output a complete plan in a single call; do NOT call this tool multiple times. The reasoning field should briefly explain why this decomposition makes sense. Each task must specify id (t1/t2/t3 format), agentId (from available agents), and task (self-contained instruction). Use dependsOn for ordering, expectedOutputs for artifact handoffs, acceptanceCriteria for text-only review tasks, targetPaths/expectedWorkspaceChanges/requiredCommands/requiredEvidence for code tasks.',
          {
            reasoning: z.string().min(1),
            tasks: z
              .array(
                z.object({
                  id: z.string().min(1),
                  agentId: z.string().min(1),
                  task: z.string().min(1),
                  taskKind: z.enum(['code', 'test', 'review', 'design', 'doc', 'analysis']).optional(),
                  dependsOn: z.array(z.string()).optional(),
                  expectedOutputs: z
                    .array(
                      z.object({
                        id: z.string().min(1),
                        type: z.enum(['web_app', 'document', 'image', 'ppt']),
                        required: z.boolean().optional(),
                        description: z.string().optional(),
                      }),
                    )
                    .optional(),
                  inputs: z
                    .array(
                      z.object({
                        fromTaskId: z.string().min(1),
                        outputId: z.string().min(1),
                        required: z.boolean().optional(),
                        description: z.string().optional(),
                      }),
                    )
                    .optional(),
                  acceptanceCriteria: z.array(z.string().min(1)).optional(),
                  targetPaths: z.array(z.string().min(1)).optional(),
                  expectedWorkspaceChanges: z.array(z.string().min(1)).optional(),
                  requiredCommands: z
                    .array(
                      z.object({
                        command: z.string().min(1),
                        description: z.string().optional(),
                        cwd: z.string().min(1).optional(),
                        timeoutMs: z.number().int().positive().optional(),
                      }),
                    )
                    .optional(),
                  requiredEvidence: z.array(z.string().min(1)).optional(),
                }),
              )
              .min(1),
          },
          async (args) => {
            const result = await toolRegistry.execute('plan_tasks', args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result.value) }],
            }
          },
        ),
        tool(
          'ask_user',
          'Ask the user one or more structured multiple-choice questions with 2-4 options. Prefer this over plain text when progress depends on a finite user choice, such as scope, target platform, design direction, implementation route, destructive action, or acceptance criteria. Do not use it for open-ended discussion or non-blocking details. Returns answers keyed by question text.',
          {
            questions: z
              .array(
                z.object({
                  question: z.string(),
                  header: z.string(),
                  multiSelect: z.boolean().optional(),
                  options: z
                    .array(
                      z.object({
                        label: z.string(),
                        description: z.string().optional(),
                        preview: z.string().optional(),
                      }),
                    )
                    .min(2)
                    .max(4),
                }),
              )
              .min(1)
              .max(4),
          },
          async (args) => {
            const result = await toolRegistry.execute('ask_user', args, toolCtx)
            if (!result.ok) {
              return {
                content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
                isError: true,
              }
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result.value) }],
            }
          },
        ),
      ],
    })

    // 同一 conversation 的多轮 query 共享 session（resume）—— 否则每轮都是新对话上下文，
    // agent 就不记得上一轮说了什么。
    const previousSessionId = claudeCodeSessions.get(input.conversationId)

    const options: Options = {
      cwd: getEffectiveCwd(workspace),
      abortController: controller,
      model: input.modelId ?? DEFAULT_MODEL,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: input.systemPrompt,
      },
      tools: { type: 'preset', preset: 'claude_code' },
      // 禁用 SDK 内置 AskUserQuestion —— 我们用统一的 mcp__agenthub__ask_user 提供等价 UI
      disallowedTools: ['AskUserQuestion'],
      mcpServers: { agenthub: agenthubMcpServer },
      includePartialMessages: true,
      // 'project' = 只读绑定目录里的 CLAUDE.md（项目级上下文），不读用户全局 ~/.claude 设定（避免污染）
      settingSources: ['project'],
      permissionMode: 'default', // 自己 canUseTool 接管
      env: buildSdkEnv(input.apiKey, input.apiBaseUrl),
      ...(previousSessionId ? { resume: previousSessionId } : {}),
      canUseTool: (toolName, toolInput) =>
        bridgePermission(toolName, toolInput, { workspace, approvalMode, input, signal }),
    }

    try {
      const q = query({ prompt: input.prompt, options })
      for await (const m of q) {
        // SDKSystemMessage init 携带 session_id —— 保存供下次 resume
        if (m.type === 'system') {
          const sid = (m as { session_id?: string }).session_id
          if (sid) claudeCodeSessions.set(input.conversationId, sid)
          continue
        }

        // partial streaming：includePartialMessages=true 时优先用这个推 delta
        if (m.type === 'stream_event') {
          const ev = m.event as { type?: string; delta?: { type?: string; text?: string } }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            if (activeTextPartIndex === -1) {
              activeTextPartIndex = nextPartIndex++
              yield baseEvent({
                type: 'part.start' as const,
                messageId,
                partIndex: activeTextPartIndex,
                part: { type: 'text' as const, content: '' },
              }) as StreamEvent
            }
            yield baseEvent({
              type: 'part.delta' as const,
              messageId,
              partIndex: activeTextPartIndex,
              delta: { type: 'text.append' as const, text: ev.delta.text },
            }) as StreamEvent
          }
          continue
        }

        if (m.type === 'assistant') {
          // 完整 assistant 消息 —— 处理 tool_use 块（text 已经在 stream_event 里增量过）
          const content = m.message?.content as Array<{
            type: string
            id?: string
            name?: string
            input?: Record<string, unknown>
            text?: string
          }>
          if (!Array.isArray(content)) continue
          for (const block of content) {
            if (block.type === 'tool_use' && block.id && block.name) {
              // tool_use 出现 → 关闭当前 text part 上下文
              activeTextPartIndex = -1
              const callId = newToolCallId()
              toolCallIdByUseId.set(block.id, callId)
              const normalizedToolName = stripMcpPrefix(block.name)
              toolNameByUseId.set(block.id, block.name)
              yield baseEvent({
                type: 'tool.call' as const,
                messageId,
                callId,
                toolName: normalizedToolName,
                args: block.input ?? {},
              }) as StreamEvent
            } else if (block.type === 'text' && activeTextPartIndex === -1 && block.text) {
              // 没开 partial stream（或者 partial 漏了）时的兜底：把整段 text 作为一个 part
              const idx = nextPartIndex++
              yield baseEvent({
                type: 'part.start' as const,
                messageId,
                partIndex: idx,
                part: { type: 'text' as const, content: block.text },
              }) as StreamEvent
            }
          }
          continue
        }

        if (m.type === 'user') {
          // tool_result 块（SDK 内部执行完工具后的返回）
          const content = m.message?.content as
            | Array<{
                type: string
                tool_use_id?: string
                content?: unknown
                is_error?: boolean
              }>
            | undefined
          if (!Array.isArray(content)) continue
          for (const block of content) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              const callId = toolCallIdByUseId.get(block.tool_use_id)
              if (!callId) continue
              yield baseEvent({
                type: 'tool.result' as const,
                messageId,
                callId,
                result: block.content ?? null,
                isError: !!block.is_error,
              }) as StreamEvent

              // 检测 agenthub MCP write_artifact 的成功结果 → 取出 artifact 并 yield artifact.create
              // 让 AgentRunner.consumeStream 给当前 message 注入 artifact_ref part（产物卡片）
              const toolName = toolNameByUseId.get(block.tool_use_id) ?? ''
              if (
                !block.is_error &&
                (toolName === 'mcp__agenthub__write_artifact' ||
                  toolName.endsWith('__write_artifact'))
              ) {
                const artifactId = parseArtifactIdFromMcpResult(block.content)
                if (artifactId) {
                  const row = await db.query.artifacts.findFirst({
                    where: eq(schema.artifacts.id, artifactId),
                  })
                  if (row) {
                    yield baseEvent({
                      type: 'artifact.create' as const,
                      artifact: {
                        id: row.id,
                        conversationId: row.conversationId,
                        type: row.type,
                        title: row.title,
                        content: row.content,
                        version: row.version,
                        parentArtifactId: row.parentArtifactId ?? undefined,
                        createdByAgentId: row.createdByAgentId,
                        createdAt: row.createdAt,
                      },
                    }) as StreamEvent
                  }
                }
              }

              if (
                !block.is_error &&
                (toolName === 'mcp__agenthub__deploy_artifact' ||
                  toolName.endsWith('__deploy_artifact') ||
                  toolName === 'mcp__agenthub__deploy_workspace' ||
                  toolName.endsWith('__deploy_workspace'))
              ) {
                const deployment = parseDeploymentFromMcpResult(block.content)
                if (deployment) {
                  yield baseEvent({
                    type: 'deploy.status' as const,
                    messageId,
                    deployment,
                  }) as StreamEvent
                }
              }
            }
          }
          continue
        }

        if (m.type === 'result') {
          // 终止信号 —— 顺便采集 usage（success / error subtypes 都带 usage 字段）
          const resultMsg = m as unknown as {
            usage?: {
              input_tokens?: number
              output_tokens?: number
              cache_creation_input_tokens?: number
              cache_read_input_tokens?: number
            }
            modelUsage?: Record<string, unknown>
          }
          if (resultMsg.usage) {
            const u = resultMsg.usage
            const model =
              resultMsg.modelUsage && Object.keys(resultMsg.modelUsage).length > 0
                ? Object.keys(resultMsg.modelUsage)[0]
                : (input.modelId ?? DEFAULT_MODEL)
            const input_tokens = u.input_tokens ?? 0
            const output_tokens = u.output_tokens ?? 0
            const cache_creation = u.cache_creation_input_tokens ?? 0
            const cache_read = u.cache_read_input_tokens ?? 0
            // Anthropic 把 prompt 拆成 input / cache_creation / cache_read 三桶；实际 prompt 大小是它们之和
            const fullPromptSize = input_tokens + cache_creation + cache_read
            // ClaudeCode 一个 run 当作一条 message 渲染（同 messageId），所以 message.usage 等于 run usage
            yield baseEvent({
              type: 'message.usage' as const,
              messageId,
              usage: {
                inputTokens: input_tokens,
                outputTokens: output_tokens,
                cacheReadTokens: cache_read,
              },
            }) as StreamEvent
            yield baseEvent({
              type: 'run.usage' as const,
              runId: input.runId,
              usage: {
                inputTokens: input_tokens,
                outputTokens: output_tokens,
                cacheCreationTokens: cache_creation,
                cacheReadTokens: cache_read,
                lastInputTokens: fullPromptSize,
                model,
              },
            }) as StreamEvent
          }
          break
        }
        // 其他系统消息（init / status / hook 事件 / task notification 等）暂时忽略
      }
    } catch (err) {
      if (err instanceof AbortError || signal.aborted) {
        // 主动中止：吞掉，run.end 状态由 AgentRunner 决定
      } else {
        throw err
      }
    } finally {
      signal.removeEventListener('abort', onAbort)
    }

    yield baseEvent({ type: 'message.end' as const, messageId }) as StreamEvent
  }
}

// ─── canUseTool 桥 ────────────────────────────────────────

/**
 * 构造给 SDK 子进程的 env：
 *  - 配了 apiBaseUrl（第三方网关如 anyrouter）：设 ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN，
 *    并清空 ANTHROPIC_API_KEY（避免 process env 覆盖 AUTH_TOKEN）
 *  - 只配了 apiKey：当 ANTHROPIC_API_KEY 传给 SDK
 *  - 都没配：透传 process.env，SDK fallback 到 env / ~/.claude OAuth
 */
function parseArtifactIdFromMcpResult(content: unknown): string | null {
  // MCP tool_result.content 可能是字符串 / 数组 of {type:'text', text} / object
  // 我们在 handler 里返回的是 [{type:'text', text: JSON.stringify(value)}]
  const tryParse = (s: string): string | null => {
    try {
      const obj = JSON.parse(s) as { artifactId?: unknown }
      return typeof obj.artifactId === 'string' ? obj.artifactId : null
    } catch {
      return null
    }
  }
  if (typeof content === 'string') return tryParse(content)
  if (Array.isArray(content)) {
    for (const blk of content) {
      if (blk && typeof blk === 'object' && 'text' in blk && typeof (blk as { text: unknown }).text === 'string') {
        const r = tryParse((blk as { text: string }).text)
        if (r) return r
      }
    }
  }
  return null
}

function parseDeploymentFromMcpResult(content: unknown): DeployStatusRecord | null {
  const tryParse = (s: string): DeployStatusRecord | null => {
    try {
      const obj = JSON.parse(s) as unknown
      return isDeployStatusRecord(obj) ? obj : null
    } catch {
      return null
    }
  }
  if (typeof content === 'string') return tryParse(content)
  if (Array.isArray(content)) {
    for (const blk of content) {
      if (blk && typeof blk === 'object' && 'text' in blk && typeof (blk as { text: unknown }).text === 'string') {
        const r = tryParse((blk as { text: string }).text)
        if (r) return r
      }
    }
  }
  return null
}

function isDeployStatusRecord(value: unknown): value is DeployStatusRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    'artifactId' in value &&
    typeof (value as { artifactId: unknown }).artifactId === 'string' &&
    'previewPath' in value &&
    typeof (value as { previewPath: unknown }).previewPath === 'string' &&
    'status' in value &&
    ((value as { status: unknown }).status === 'ready' ||
      (value as { status: unknown }).status === 'failed') &&
    'createdAt' in value &&
    typeof (value as { createdAt: unknown }).createdAt === 'number'
  )
}

function buildSdkEnv(
  apiKey: string | null,
  apiBaseUrl: string | null,
): Record<string, string | undefined> {
  const base: Record<string, string | undefined> = buildChildProcessEnv()
  if (apiBaseUrl) {
    return {
      ...base,
      ANTHROPIC_BASE_URL: apiBaseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey ?? '',
      ANTHROPIC_API_KEY: '',
    }
  }
  if (apiKey) {
    return { ...base, ANTHROPIC_API_KEY: apiKey }
  }
  return base
}

interface PermissionCtx {
  workspace: WorkspaceRow
  approvalMode: 'auto' | 'review'
  input: AdapterInput
  signal: AbortSignal
}

async function bridgePermission(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: PermissionCtx,
): Promise<PermissionResult> {
  // SDK 的运行时 Zod schema 要求 allow 必带 updatedInput（TypeScript type 标 optional 但运行时必填）；
  // 无修改场景下回填原 input 即可。deny 必带 message。
  const allow = (updated: Record<string, unknown> = toolInput): PermissionResult => ({
    behavior: 'allow',
    updatedInput: updated,
  })
  const deny = (message: string): PermissionResult => ({ behavior: 'deny', message })

  // 1. 路径沙箱检查（Read/Write/Edit/NotebookEdit）
  if (PATH_TOOLS.has(toolName)) {
    const target =
      (toolInput.file_path as string | undefined) ?? (toolInput.path as string | undefined)
    if (target) {
      try {
        assertPathWithinWorkspace(ctx.workspace, target)
      } catch (e) {
        return deny(e instanceof Error ? e.message : `Path is outside workspace: ${target}`)
      }
    }
  }

  // 2. Bash 黑名单
  if (toolName === 'Bash') {
    const cmd = (toolInput.command as string | undefined) ?? ''
    const banned = findBannedPattern(cmd)
    if (banned) {
      return deny(`Command blocked by safety policy (matches ${banned}): ${cmd.slice(0, 100)}`)
    }
    const approval = classifyBashApproval(cmd, currentPlatform())
    if (approval.required) {
      const approved = await waitForBashApproval({
        conversationId: ctx.input.conversationId,
        agentId: ctx.input.agentId,
        runId: ctx.input.runId,
        command: cmd,
        cwd: getEffectiveCwd(ctx.workspace),
        reason: approval.reason,
        signal: ctx.signal,
      })
      if (!approved) return deny(`User rejected command execution: ${approval.reason}`)
    }
    return allow()
  }

  // 3. fs_write 审批 (Write / Edit)
  if (FS_WRITE_TOOLS.has(toolName)) {
    if (ctx.approvalMode === 'auto') return allow()
    const target = (toolInput.file_path as string) ?? (toolInput.path as string)
    if (!target) return deny('Missing file_path/path')

    const oldContent = readIfExists(ctx.workspace, target)
    const newContent = computeNewContent(toolName, toolInput, oldContent)
    if (newContent instanceof Error) {
      return deny(newContent.message)
    }

    let absPath: string
    try {
      absPath = assertPathWithinWorkspace(ctx.workspace, target)
    } catch (e) {
      return deny(e instanceof Error ? e.message : 'Path outside workspace')
    }

    const pending = pendingWrites.register({
      conversationId: ctx.input.conversationId,
      agentId: ctx.input.agentId,
      runId: ctx.input.runId,
      path: target,
      absolutePath: absPath,
      oldContent,
      newContent,
      workspace: ctx.workspace,
      skipWrite: true, // SDK 自己写盘
    })

    const decision = await new Promise<{ applied: boolean }>((resolve) => {
      let settled = false
      const finish = (decision: { applied: boolean }) => {
        if (settled) return
        settled = true
        ctx.signal.removeEventListener('abort', onAbort)
        resolve(decision)
      }
      const onAbort = () => {
        pendingWrites.cancel(pending.id)
        finish({ applied: false })
      }

      pendingWrites.attachResolver(pending.id, finish)
      if (ctx.signal.aborted) onAbort()
      else ctx.signal.addEventListener('abort', onAbort, { once: true })
    })
    if (!decision.applied) {
      return deny('User rejected the file change')
    }
    return allow()
  }

  // 4. NotebookEdit：MVP 不支持审批 diff，直接 deny 让用户切 Auto
  if (toolName === 'NotebookEdit') {
    if (ctx.approvalMode === 'auto') return allow()
    return deny('NotebookEdit approval not yet supported in Review mode; switch to Auto mode.')
  }

  // 5. 默认放行（Read / Grep / Glob / WebFetch / WebSearch / Task / TodoWrite / ...）
  return allow()
}

/** 去掉 Claude Code SDK 给 MCP 工具加的 `mcp__<server>__` 前缀，归一化为原始工具名。 */
function stripMcpPrefix(name: string): string {
  const prefix = 'mcp__agenthub__'
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

/** 把 Write/Edit 的输入转成「应用后的完整文件内容」用于 diff viewer。 */
function computeNewContent(
  toolName: string,
  input: Record<string, unknown>,
  oldContent: string | null,
): string | Error {
  if (toolName === 'Write') {
    return (input.content as string | undefined) ?? ''
  }
  if (toolName === 'Edit') {
    const old = (input.old_string as string | undefined) ?? ''
    const fresh = (input.new_string as string | undefined) ?? ''
    const all = !!input.replace_all
    if (oldContent === null) {
      return new Error('Edit requires an existing file (use Write to create)')
    }
    if (!all) {
      const count = oldContent.split(old).length - 1
      if (count === 0) {
        return new Error(`old_string not found in ${input.file_path}`)
      }
      if (count > 1) {
        return new Error(
          `old_string matches ${count} occurrences; use replace_all=true or include more context`,
        )
      }
    }
    return all ? oldContent.split(old).join(fresh) : oldContent.replace(old, fresh)
  }
  return new Error(`Unsupported write tool: ${toolName}`)
}

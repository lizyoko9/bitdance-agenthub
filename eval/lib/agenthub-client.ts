import { z } from 'zod'

const PlatformSchema = z.object({ platform: z.string(), evidenceGates: z.boolean() })
const ConversationSchema = z.object({ conversation: z.object({ id: z.string() }) })
const SendResultSchema = z.object({ messageId: z.string(), runIds: z.array(z.string()) })

export interface AgentHubClient {
  platform(): Promise<z.infer<typeof PlatformSchema>>
  createConversation(args: {
    title: string
    mode: 'single' | 'group'
    agentIds: string[]
    boundPath: string
  }): Promise<string>
  setAutoApproveWrites(conversationId: string): Promise<void>
  sendMessage(conversationId: string, content: string, mentionedAgentIds?: string[]): Promise<string[]>
  approvePlan(conversationId: string, planId: string): Promise<void>
  approveBash(conversationId: string, commandId: string): Promise<void>
  answerQuestion(conversationId: string, questionId: string, answers: Record<string, QuestionAnswer>): Promise<void>
  abortRun(runId: string): Promise<void>
}

export interface QuestionAnswer {
  selectedLabels: string[]
  freeformNote?: string
}

export function createAgentHubClient(baseUrl: string): AgentHubClient {
  async function request(method: string, pathname: string, body?: unknown): Promise<unknown> {
    const res = await fetch(new URL(pathname, baseUrl), {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`AgentHub ${method} ${pathname} failed with ${res.status}: ${text}`)
    return text ? JSON.parse(text) : null
  }

  return {
    async platform() {
      return PlatformSchema.parse(await request('GET', '/api/platform'))
    },
    async createConversation(args) {
      return ConversationSchema.parse(await request('POST', '/api/conversations', args)).conversation.id
    },
    async setAutoApproveWrites(conversationId) {
      await request('PATCH', `/api/conversations/${conversationId}`, { fsWriteApprovalMode: 'auto' })
    },
    async sendMessage(conversationId, content, mentionedAgentIds) {
      const result = SendResultSchema.parse(
        await request('POST', `/api/conversations/${conversationId}/messages`, { content, mentionedAgentIds }),
      )
      return result.runIds
    },
    async approvePlan(conversationId, planId) {
      await request('POST', `/api/conversations/${conversationId}/pending-dispatch-plans/${planId}`, {
        action: 'approve',
      })
    },
    async approveBash(conversationId, commandId) {
      await request('POST', `/api/conversations/${conversationId}/pending-bash-commands/${commandId}`, {
        action: 'approve',
      })
    },
    async answerQuestion(conversationId, questionId, answers) {
      await request('POST', `/api/conversations/${conversationId}/pending-questions/${questionId}`, { answers })
    },
    async abortRun(runId) {
      await request('POST', `/api/runs/${runId}/abort`).catch(() => {
        // run 可能已经结束，abort 404 不算错误
      })
    },
  }
}

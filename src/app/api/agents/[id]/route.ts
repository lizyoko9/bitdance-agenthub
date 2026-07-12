import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { deleteCustomAgent, updateCustomAgent } from '@/server/agent-service'

interface RouteContext {
  params: Promise<{ id: string }>
}

const PatchBody = z
  .object({
    name: z.string().min(1).max(64).optional(),
    description: z.string().min(1).max(280).optional(),
    capabilities: z.array(z.string()).optional(),
    systemPrompt: z.string().min(1).optional(),
    adapterName: z.enum(['custom', 'claude-code', 'codex']).optional(),
    modelProvider: z
      .enum(['anthropic', 'openai', 'deepseek', 'volcano-ark', 'openai-compatible'])
      .optional(),
    modelId: z.union([z.string().min(1), z.null()]).optional(),
    toolNames: z.array(z.string()).optional(),
    skillIds: z.array(z.string()).optional(),
    supportsVision: z.boolean().optional(),
    // null 表示清除，空字符串当 null 处理
    apiKey: z.union([z.string(), z.null()]).optional(),
    apiBaseUrl: z.union([z.string(), z.null()]).optional(),
  })
  .strict()

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const raw = await req.json().catch(() => null)
  const parsed = PatchBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const agent = await updateCustomAgent(id, parsed.data)
    return NextResponse.json({ agent })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    await deleteCustomAgent(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { deleteSkill, updateSkill } from '@/server/skill-service'

interface RouteContext {
  params: Promise<{ id: string }>
}

const PatchBody = z
  .object({
    name: z.string().min(1).max(64).optional(),
    description: z.string().min(1).max(280).optional(),
    category: z.string().min(1).max(32).optional(),
    instruction: z.string().min(1).max(20_000).optional(),
    requiredToolNames: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    isGlobalDefault: z.boolean().optional(),
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
    const skill = await updateSkill(id, parsed.data)
    return NextResponse.json({ skill })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    await deleteSkill(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

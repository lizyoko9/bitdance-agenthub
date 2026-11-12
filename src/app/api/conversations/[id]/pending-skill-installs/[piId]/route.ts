import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { pendingSkillInstalls } from '@/server/pending-skill-installs'

interface RouteContext {
  params: Promise<{ id: string; piId: string }>
}

const Body = z.object({ action: z.enum(['approve', 'reject']) })

/** POST /api/conversations/:id/pending-skill-installs/:piId  body { action } —— 批准/拒绝一个会话安装。 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { piId } = await ctx.params
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  if (!pendingSkillInstalls.get(piId)) {
    return NextResponse.json({ error: 'Pending skill install not found' }, { status: 404 })
  }

  const ok =
    parsed.data.action === 'approve'
      ? await pendingSkillInstalls.approve(piId)
      : pendingSkillInstalls.reject(piId)

  if (!ok) {
    return NextResponse.json({ error: 'Failed to process pending skill install' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

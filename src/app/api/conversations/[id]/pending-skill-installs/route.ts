import { NextResponse } from 'next/server'

import { pendingSkillInstalls } from '@/server/pending-skill-installs'

interface RouteContext {
  params: Promise<{ id: string }>
}

/** GET /api/conversations/:id/pending-skill-installs —— 列出等审批的 install_skill（刷新恢复用）。 */
export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params
  return NextResponse.json({ pendingSkillInstalls: pendingSkillInstalls.listByConversation(id) })
}

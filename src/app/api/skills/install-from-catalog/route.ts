import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { installCatalogSkill } from '@/server/skill-service'

// 从精选目录安装一个 Skill：服务端经 skill-fetch 拉取 SKILL.md（SSRF 白名单），解析后建为 imported。
// 用户在市场点击「安装」即授权，不走 install_skill 的 LLM 审批门；fetch 层防御相同。
const Body = z.object({
  sourceUri: z.string().url(),
  category: z.string().min(1).max(32),
  name: z.string().max(64).optional(),
  description: z.string().max(280).optional(),
})

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const skill = await installCatalogSkill({ ...parsed.data, signal: req.signal })
    return NextResponse.json({ skill }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { searchSkillRegistry } from '@/server/skill-registry'

// 代理 SkillsMP 目录搜索：服务端调用可信第一方 JSON API，zod 校验后回前端。
// 安装仍走 /api/skills/install-from-catalog（skill-fetch SSRF 白名单拉 githubUrl）。
const Query = z.object({
  q: z.string().min(1).max(100),
  page: z.coerce.number().int().min(1).max(50).optional(),
  sort: z.enum(['stars', 'recent']).optional(),
})

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse({
    q: req.nextUrl.searchParams.get('q') ?? '',
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    sort: req.nextUrl.searchParams.get('sort') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const result = await searchSkillRegistry({ ...parsed.data, signal: req.signal })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

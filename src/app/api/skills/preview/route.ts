import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { previewSkillMarkdown } from '@/server/skill-service'

// 预览一个 GitHub SKILL.md 的解析结果（不落库），供在线市场详情弹窗展示正文。
// url 来自客户端（在线市场卡片的 githubUrl），但仍走 skill-fetch 白名单，SSRF 拦得住。
const Query = z.object({ url: z.string().url() })

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse({ url: req.nextUrl.searchParams.get('url') ?? '' })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }
  try {
    const preview = await previewSkillMarkdown(parsed.data.url, req.signal)
    return NextResponse.json(preview)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
